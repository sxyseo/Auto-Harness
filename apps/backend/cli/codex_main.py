"""
Auto Claude CodeX CLI - Main Entry Point
=========================================

Unified CLI hub with subcommands wrapping existing runners.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

# Ensure parent directory is in path for imports
_PARENT_DIR = Path(__file__).parent.parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

# Inline dotenv loading to avoid importing cli/utils.py (which has heavy deps)
try:
    from dotenv import load_dotenv as _load_dotenv
except ImportError:
    _load_dotenv = lambda *a, **k: None  # type: ignore[assignment]

from phase_config import sanitize_thinking_level


def _resolve_project(project: Path | None) -> Path:
    """Resolve project directory, defaulting to cwd."""
    return (project or Path.cwd()).resolve()


def _setup_sentry(component: str) -> None:
    """Initialize Sentry for error tracking."""
    try:
        from core.sentry import capture_exception, init_sentry

        init_sentry(component=component)
    except Exception:
        pass  # Sentry is optional


def _subcommand_runner(
    module_path: str,
    func_name: str = "main",
    argv: list[str] | None = None,
) -> int:
    """
    Run a subcommand by invoking another script's main().

    This lets each runner manage its own argparse without circular imports.
    """
    backend_dir = _PARENT_DIR
    script = backend_dir / module_path

    cmd = [sys.executable, str(script)]
    if argv:
        cmd.extend(argv)

    result = subprocess.run(cmd, cwd=str(backend_dir))
    return result.returncode


# ─────────────────────────────────────────────────────────────────
# Subcommand handlers
# ─────────────────────────────────────────────────────────────────


def cmd_write(args: argparse.Namespace) -> int:
    """Handle: codex write <task>"""
    argv = ["--task", args.task]
    if args.interactive:
        argv.append("--interactive")
    if args.project:
        argv.extend(["--project", str(args.project)])
    if args.model:
        argv.extend(["--model", args.model])
    if args.no_build:
        argv.append("--no-build")
    if args.fast_mode:
        argv.append("--fast-mode")

    return _subcommand_runner("runners/spec_runner.py", argv=argv)


def cmd_review(args: argparse.Namespace) -> int:
    """Handle: codex review [--diff <ref>] [--file <path>]"""
    project = _resolve_project(args.project)

    # GitHub PR review: delegate to github runner
    if args.github:
        return _subcommand_runner(
            "runners/github/runner.py",
            argv=[
                "--project",
                str(project),
                "review-pr",
                str(args.github),
            ],
        )

    # Local diff/file review: use dedicated codex_review_runner
    argv = ["--project", str(project)]
    if args.diff:
        argv.extend(["--diff", args.diff])
    if args.file:
        for fp in args.files:
            argv.extend(["--file", str(fp)])
    if args.model:
        argv.extend(["--model", args.model])
    if args.thinking_level:
        argv.extend(["--thinking-level", args.thinking_level])

    return _subcommand_runner("runners/codex_review_runner.py", argv=argv)


def cmd_insights(args: argparse.Namespace) -> int:
    """Handle: codex insights <message> [--history-file <path>]"""
    argv = [
        "--project-dir",
        str(args.project or Path.cwd()),
        "--message",
        args.message,
    ]
    if args.history_file:
        argv.extend(["--history-file", str(args.history_file)])
    if args.model:
        argv.extend(["--model", args.model])
    if args.thinking_level:
        argv.extend(["--thinking-level", args.thinking_level])

    return _subcommand_runner("runners/insights_runner.py", argv=argv)


def cmd_spec(args: argparse.Namespace) -> int:
    """Handle: codex spec [--task <desc>] [--interactive]"""
    argv = []
    if args.task:
        argv.extend(["--task", args.task])
    if args.interactive:
        argv.append("--interactive")
    if args.project:
        argv.extend(["--project", str(args.project)])
    if args.model:
        argv.extend(["--model", args.model])
    if args.no_build:
        argv.append("--no-build")

    return _subcommand_runner("runners/spec_runner.py", argv=argv)


def cmd_ideation(args: argparse.Namespace) -> int:
    """Handle: codex ideation"""
    argv = ["--project", str(args.project or Path.cwd())]
    if args.types:
        argv.extend(["--types", args.types])
    if args.no_roadmap:
        argv.append("--no-roadmap")
    if args.no_kanban:
        argv.append("--no-kanban")
    if args.max_ideas:
        argv.extend(["--max-ideas", str(args.max_ideas)])
    if args.model:
        argv.extend(["--model", args.model])
    if args.thinking_level:
        argv.extend(["--thinking-level", args.thinking_level])
    if args.refresh:
        argv.append("--refresh")
    if args.fast_mode:
        argv.append("--fast-mode")

    return _subcommand_runner("runners/ideation_runner.py", argv=argv)


def cmd_github(args: argparse.Namespace) -> int:
    """Handle: codex github <subcommand> [args...]"""
    argv = ["--project", str(args.project or Path.cwd())]
    if args.token:
        argv.extend(["--token", args.token])
    if args.model:
        argv.extend(["--model", args.model])
    if args.thinking_level:
        argv.extend(["--thinking-level", args.thinking_level])
    if args.fast_mode:
        argv.append("--fast-mode")

    # Append the GitHub subcommand and its args
    argv.extend(args.github_args)

    return _subcommand_runner("runners/github/runner.py", argv=argv)


def cmd_analyze(args: argparse.Namespace) -> int:
    """Handle: codex analyze"""
    argv = ["--project-dir", str(args.project or Path.cwd())]
    if args.skip_cache:
        argv.append("--skip-cache")
    if args.analyzers:
        argv.extend(args.analyzers)

    return _subcommand_runner("runners/ai_analyzer_runner.py", argv=argv)


# ─────────────────────────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────────────────────────

DEFAULT_MODEL = "sonnet"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codex",
        description="Auto Claude CodeX — AI-powered coding CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Write code
  codex write "Add user authentication with JWT"
  codex write --interactive
  codex write "Fix the login bug" --project /path/to/project

  # Review code
  codex review --diff main
  codex review --file src/auth.py
  codex review --github 123      # GitHub PR review

  # Ask about codebase
  codex insights "How does the auth flow work?"
  codex insights "What files handle payments?" --history-file history.json

  # Create spec
  codex spec --task "Add dark mode"
  codex spec --interactive

  # Ideation
  codex ideation
  codex ideation --types low_hanging_fruit,high_value_features

  # GitHub automation
  codex github review-pr 123
  codex github triage --apply-labels
  codex github auto-fix 456

  # Code analysis
  codex analyze
  codex analyze --analyzers security performance
        """,
    )

    # Global options
    parser.add_argument(
        "--project",
        type=Path,
        default=None,
        help="Project directory (default: current working directory)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help=f"AI model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--thinking-level",
        type=str,
        default=None,
        help="Thinking level: low, medium, high",
    )
    parser.add_argument(
        "--fast-mode",
        action="store_true",
        help="Enable Fast Mode for faster Opus output",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ── write ──────────────────────────────────────────────────────
    p_write = subparsers.add_parser(
        "write",
        help="Write or modify code from a task description",
        description="Create a spec and build code for the given task.",
    )
    p_write.add_argument("task", type=str, help="Task description (use quotes)")
    p_write.add_argument(
        "--interactive",
        action="store_true",
        help="Run in interactive mode with AI-guided questioning",
    )
    p_write.add_argument(
        "--no-build",
        action="store_true",
        help="Create spec without building (skip the build phase)",
    )
    p_write.set_defaults(func=cmd_write)

    # ── review ─────────────────────────────────────────────────────
    p_review = subparsers.add_parser(
        "review",
        help="Review code changes or files",
        description="Review local diffs or files. Use --github for PR review.",
    )
    p_review.add_argument(
        "--diff",
        type=str,
        default=None,
        metavar="REF",
        help="Git ref to diff against (e.g., main, HEAD~1)",
    )
    p_review.add_argument(
        "--file",
        type=Path,
        default=None,
        action="append",
        dest="files",
        help="Specific file(s) to review (can be repeated)",
    )
    p_review.add_argument(
        "--github",
        type=int,
        metavar="PR",
        help="Review a GitHub pull request by number",
    )
    p_review.set_defaults(func=cmd_review)

    # ── insights ───────────────────────────────────────────────────
    p_insights = subparsers.add_parser(
        "insights",
        help="Ask questions about your codebase",
        description="AI-powered Q&A for understanding your codebase.",
    )
    p_insights.add_argument("message", type=str, help="Question to ask")
    p_insights.add_argument(
        "--history-file",
        type=Path,
        default=None,
        help="Path to JSON file with conversation history",
    )
    p_insights.set_defaults(func=cmd_insights)

    # ── spec ───────────────────────────────────────────────────────
    p_spec = subparsers.add_parser(
        "spec",
        help="Create a feature specification",
        description="Create a spec document for a feature or fix.",
    )
    p_spec.add_argument(
        "--task",
        type=str,
        default=None,
        help="Task description (use quotes)",
    )
    p_spec.add_argument(
        "--interactive",
        action="store_true",
        help="Run in interactive mode",
    )
    p_spec.add_argument(
        "--no-build",
        action="store_true",
        help="Create spec without building",
    )
    p_spec.set_defaults(func=cmd_spec)

    # ── ideation ───────────────────────────────────────────────────
    p_ideation = subparsers.add_parser(
        "ideation",
        help="Discover improvement opportunities",
        description="Generate ideas for features, fixes, and improvements.",
    )
    p_ideation.add_argument(
        "--types",
        type=str,
        default=None,
        help="Comma-separated types: low_hanging_fruit, ui_ux, high_value_features, "
        "technical_debt, performance, security",
    )
    p_ideation.add_argument(
        "--no-roadmap",
        action="store_true",
        help="Don't include roadmap context",
    )
    p_ideation.add_argument(
        "--no-kanban",
        action="store_true",
        help="Don't include kanban context",
    )
    p_ideation.add_argument(
        "--max-ideas",
        type=int,
        default=None,
        help="Maximum ideas per type (default: 5)",
    )
    p_ideation.add_argument(
        "--refresh",
        action="store_true",
        help="Force regeneration even if ideation exists",
    )
    p_ideation.set_defaults(func=cmd_ideation)

    # ── github ─────────────────────────────────────────────────────
    p_github = subparsers.add_parser(
        "github",
        help="GitHub automation",
        description="PR review, issue triage, auto-fix, batching. "
        "See: codex github --help for subcommands",
    )
    p_github.add_argument(
        "github_args",
        nargs=argparse.REMAINDER,
        help="Arguments passed to github/runner.py (e.g. review-pr 123)",
    )
    p_github.add_argument(
        "--token",
        type=str,
        default=None,
        help="GitHub token (or set GITHUB_TOKEN env var)",
    )
    p_github.set_defaults(func=cmd_github)

    # ── analyze ────────────────────────────────────────────────────
    p_analyze = subparsers.add_parser(
        "analyze",
        help="AI-powered codebase analysis",
        description="Deep analysis of codebase structure, patterns, and health.",
    )
    p_analyze.add_argument(
        "--skip-cache",
        action="store_true",
        help="Skip cached results and re-analyze",
    )
    p_analyze.add_argument(
        "--analyzers",
        nargs="+",
        default=None,
        help="Run specific analyzers only (e.g. security performance)",
    )
    p_analyze.set_defaults(func=cmd_analyze)

    return parser


# ─────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────

def main() -> None:
    _setup_sentry("codex-cli")

    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Sanitize thinking level
    if hasattr(args, "thinking_level") and args.thinking_level:
        args.thinking_level = sanitize_thinking_level(args.thinking_level)

    try:
        exit_code = args.func(args)
        sys.exit(exit_code if exit_code is not None else 0)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
    except Exception as e:
        try:
            from core.sentry import capture_exception

            capture_exception(e)
        except Exception:
            pass
        print(f"Error: {e}")
        sys.exit(1)
