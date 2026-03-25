#!/usr/bin/env python3
"""
Code Review Runner - Local diff/file review using Claude SDK

Supports:
- Reviewing git diffs (--diff <ref>)
- Reviewing specific files (--file <path>)
- Streaming AI-powered review feedback

Usage:
    python runners/codex_review_runner.py --project /path/to/project --diff main
    python runners/codex_review_runner.py --project /path/to/project --file src/auth.py
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Validate platform dependencies
from core.dependency_validator import validate_platform_dependencies

validate_platform_dependencies()

# Inline dotenv loading to avoid importing cli/utils.py (which has heavy deps)
try:
    from dotenv import load_dotenv as _load_dotenv
except ImportError:
    _load_dotenv = lambda *a, **k: None  # type: ignore[assignment]

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    _load_dotenv(env_file)


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class ReviewFinding:
    severity: Severity
    title: str
    description: str
    file: str = ""
    line: int | None = None
    rule: str = ""


@dataclass
class ReviewResult:
    success: bool
    overall_status: str = ""
    summary: str = ""
    findings: list[ReviewFinding] = field(default_factory=list)
    error: str = ""


SYSTEM_PROMPT = """You are an expert code reviewer. Analyze the provided code diff or files and identify issues.

Focus on:
1. **Correctness** - Bugs, logic errors, edge cases
2. **Security** - Vulnerabilities, injection risks, auth issues
3. **Performance** - Inefficiencies, N+1 queries, missing indexes
4. **Maintainability** - Code smells, duplication, unclear naming
5. **Best practices** - Error handling, type safety, testing gaps

Respond in JSON format with this structure:
{
  "status": "approved" | "changes_requested" | "blocked",
  "summary": "One sentence summary of the review",
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "title": "Brief finding title",
      "description": "Detailed explanation",
      "file": "relative/path.rb",
      "line": 42,
      "rule": "rule-id-if-applicable"
    }
  ]
}

Only include findings for real issues. Do not nitpick style unrelated to project conventions."""


async def _stream_review(
    project_path: Path,
    diff_content: str,
    file_contents: list[tuple[str, str]],
    model: str,
    thinking_level: str,
) -> tuple[str, list[ReviewFinding]]:
    """Run streaming review using Claude SDK."""
    try:
        from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
    except ImportError:
        return _fallback_review(diff_content, file_contents)

    from core.auth import ensure_claude_code_oauth_token, get_auth_token
    from phase_config import get_thinking_budget, resolve_model_id

    if not get_auth_token():
        return _fallback_review(diff_content, file_contents)

    ensure_claude_code_oauth_token()

    max_thinking = get_thinking_budget(thinking_level)

    # Build the review content
    content_parts = []
    if diff_content:
        content_parts.append(f"## Git Diff\n```diff\n{diff_content}\n```")
    for path, content in file_contents:
        content_parts.append(f"## File: {path}\n```{_detect_language(path)}\n{content}\n```")

    prompt = f"""Review the following code changes:

{chr(10).join(content_parts)}

Respond with ONLY valid JSON (no markdown, no explanation)."""

    options = ClaudeAgentOptions(
        model=resolve_model_id(model),
        system_prompt=SYSTEM_PROMPT,
        allowed_tools=["Read", "Glob", "Grep"],
        max_turns=5,
        cwd=str(project_path),
        max_thinking_tokens=max_thinking,
    )

    client = ClaudeSDKClient(options=options)
    response_text = ""

    async with client:
        await client.query(prompt)
        async for msg in client.receive_response():
            if type(msg).__name__ == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        print(block.text, flush=True, end="")
                        response_text += block.text

    # Parse the JSON response
    findings = _parse_findings(response_text)
    return response_text, findings


def _fallback_review(
    diff_content: str,
    file_contents: list[tuple[str, str]],
) -> tuple[str, list[ReviewFinding]]:
    """Simple fallback using claude CLI."""
    import subprocess

    content_parts = []
    if diff_content:
        content_parts.append(f"## Git Diff\n```diff\n{diff_content}\n```")
    for path, content in file_contents:
        content_parts.append(f"## File: {path}\n```{_detect_language(path)}\n{content}\n```")

    prompt = f"""{SYSTEM_PROMPT}

## Code to Review

{chr(10).join(content_parts)}

Respond with ONLY valid JSON."""

    try:
        result = subprocess.run(
            ["claude", "--print", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout.strip()
        findings = _parse_findings(output)
        return output, findings
    except Exception as e:
        return f"{{\"error\": \"{e}\"}}", []


def _parse_findings(text: str) -> list[ReviewFinding]:
    """Parse JSON findings from the model response."""
    findings = []

    # Try to extract JSON from the response
    import json

    text = text.strip()

    # Remove markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        in_block = False
        json_lines = []
        for line in lines:
            if line.startswith("```"):
                in_block = not in_block
                continue
            if in_block:
                json_lines.append(line)
        text = "\n".join(json_lines)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON-like structure
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start:end])
            except json.JSONDecodeError:
                return findings

    summary = data.get("summary", "")
    findings_data = data.get("findings", [])

    for f in findings_data:
        try:
            findings.append(
                ReviewFinding(
                    severity=Severity(f.get("severity", "medium")),
                    title=f.get("title", "Untitled finding"),
                    description=f.get("description", ""),
                    file=f.get("file", ""),
                    line=f.get("line"),
                    rule=f.get("rule", ""),
                )
            )
        except ValueError:
            pass

    return findings


def _detect_language(path: str) -> str:
    """Detect language from file extension."""
    ext_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".rb": "ruby",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".cpp": "cpp",
        ".c": "c",
        ".h": "c",
        ".cs": "csharp",
        ".php": "php",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".md": "markdown",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".sh": "bash",
        ".bash": "bash",
        ".sql": "sql",
        ".html": "html",
        ".css": "css",
    }
    return ext_map.get(Path(path).suffix.lower(), "")


def _get_git_diff(project_path: Path, ref: str) -> str:
    """Get git diff for a given ref."""
    try:
        result = subprocess.run(
            ["git", "diff", ref, "--", "."],
            cwd=str(project_path),
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return result.stdout
        return f"Git error: {result.stderr}"
    except Exception as e:
        return f"Git error: {e}"


def _get_untracked_files(project_path: Path) -> str:
    """Get content of new/untracked files."""
    try:
        result = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            cwd=str(project_path),
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


async def run_review(
    project_path: Path,
    diff_ref: str | None,
    file_paths: list[Path] | None,
    model: str,
    thinking_level: str,
) -> ReviewResult:
    """Run code review."""
    diff_content = ""
    file_contents: list[tuple[str, str]] = []

    if diff_ref:
        diff_content = _get_git_diff(project_path, diff_ref)
        if not diff_content or "Git error" in diff_content:
            return ReviewResult(success=False, error=diff_content or "No diff found")

    if file_paths:
        for fp in file_paths:
            try:
                content = fp.read_text(encoding="utf-8")
                rel = fp.relative_to(project_path) if fp.is_absolute() else fp
                file_contents.append((str(rel), content))
            except Exception as e:
                return ReviewResult(success=False, error=f"Cannot read {fp}: {e}")

    if not diff_content and not file_contents:
        return ReviewResult(
            success=False,
            error="No diff or files provided. Use --diff <ref> or --file <path>",
        )

    summary_text, findings = await _stream_review(
        project_path, diff_content, file_contents, model, thinking_level
    )

    # Try to parse status from response
    try:
        data = json.loads(summary_text)
        status = data.get("status", "changes_requested")
        summary = data.get("summary", "")
    except (json.JSONDecodeError, TypeError):
        status = "changes_requested"
        summary = summary_text[:200] if summary_text else "Review complete"

    return ReviewResult(
        success=True,
        overall_status=status,
        summary=summary,
        findings=findings,
    )


def print_summary(result: ReviewResult) -> None:
    """Print review summary."""
    sep = "=" * 60
    print(f"\n{sep}")
    print("Code Review Complete")
    print(f"{sep}")
    print(f"Status: {result.overall_status}")
    print(f"Summary: {result.summary}")
    if result.findings:
        print(f"\nFindings: {len(result.findings)}")
        emoji = {
            Severity.CRITICAL: "!",
            Severity.HIGH: "*",
            Severity.MEDIUM: "-",
            Severity.LOW: ".",
        }
        for f in result.findings:
            print(f"  {emoji.get(f.severity, '?')} [{f.severity.value.upper()}] {f.title}")
            if f.file:
                line_str = f":{f.line}" if f.line else ""
                print(f"    File: {f.file}{line_str}")
    elif not result.success:
        print(f"\nError: {result.error}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI-powered local code review",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--project",
        type=Path,
        default=Path.cwd(),
        help="Project directory (default: current)",
    )
    parser.add_argument(
        "--diff",
        type=str,
        default=None,
        metavar="REF",
        help="Git ref to diff against (e.g., main, HEAD~1)",
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=None,
        action="append",
        dest="files",
        help="Specific file(s) to review (can be repeated)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="sonnet",
        help="Model to use",
    )
    parser.add_argument(
        "--thinking-level",
        type=str,
        default="medium",
        help="Thinking level: low, medium, high",
    )

    args = parser.parse_args()
    project_path = args.project.resolve()

    from phase_config import sanitize_thinking_level

    args.thinking_level = sanitize_thinking_level(args.thinking_level)

    result = asyncio.run(
        run_review(
            project_path=project_path,
            diff_ref=args.diff,
            file_paths=args.files,
            model=args.model,
            thinking_level=args.thinking_level,
        )
    )

    print_summary(result)

    if result.success:
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())
