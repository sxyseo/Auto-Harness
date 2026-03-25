#!/usr/bin/env python3
"""
Auto Claude CodeX CLI
=====================

Unified command-line interface for AI-powered coding tasks:
- write: Write or modify code from a task description
- review: Review code changes or files
- insights: Ask questions about your codebase
- spec: Create a feature specification
- ideation: Discover improvement opportunities
- github: GitHub automation (PR review, issue triage, etc.)
- analyze: AI-powered codebase analysis

Usage:
    python codex.py write "Add user authentication"
    python codex.py review --diff main
    python codex.py insights "How does the auth system work?"
    python codex.py spec --interactive
    python codex.py ideation
    python codex.py github review-pr 123
    python codex.py analyze --project /path/to/project

Prerequisites:
    - Claude Code CLI installed and authenticated
    - python >= 3.10
"""

import sys

# Python version check - must be before any imports using 3.10+ syntax
if sys.version_info < (3, 10):  # noqa: UP036
    sys.exit(
        f"Error: Auto Claude requires Python 3.10 or higher.\n"
        f"You are running Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\n"
        f"\n"
        f"Please upgrade Python: https://www.python.org/downloads/"
    )

import io

# Configure safe encoding on Windows BEFORE any imports that might print
# This handles both TTY and piped output (e.g., from Electron)
if sys.platform == "win32":
    for _stream_name in ("stdout", "stderr"):
        _stream = getattr(sys, _stream_name)
        # Method 1: Try reconfigure (works for TTY)
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")
                continue
            except (AttributeError, io.UnsupportedOperation, OSError):
                pass
        # Method 2: Wrap with TextIOWrapper for piped output
        try:
            if hasattr(_stream, "buffer"):
                _new_stream = io.TextIOWrapper(
                    _stream.buffer,
                    encoding="utf-8",
                    errors="replace",
                    line_buffering=True,
                )
                setattr(sys, _stream_name, _new_stream)
        except (AttributeError, io.UnsupportedOperation, OSError):
            pass
    # Clean up temporary variables
    del _stream_name, _stream
    if "_new_stream" in dir():
        del _new_stream

# Validate platform-specific dependencies BEFORE any imports that might
# trigger graphiti_core -> real_ladybug -> pywintypes import chain (ACS-253)
from core.dependency_validator import validate_platform_dependencies

validate_platform_dependencies()

import importlib.util
from pathlib import Path

# Define parent dir for codex_main import
_BACKEND_DIR = Path(__file__).parent

# Import codex_main directly by file path to avoid triggering cli/__init__.py
# which has heavy imports requiring claude_agent_sdk
_spec = importlib.util.spec_from_file_location("codex_main", _BACKEND_DIR / "cli" / "codex_main.py")
_codex_main = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_codex_main)
main = _codex_main.main

if __name__ == "__main__":
    main()
