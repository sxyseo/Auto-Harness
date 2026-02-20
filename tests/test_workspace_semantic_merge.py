#!/usr/bin/env python3
"""
Tests for the semantic analysis merge path in workspace.py
==========================================================

Tests the git merge execution code path added for the "Merge with AI" feature,
specifically the section in _try_smart_merge_inner that runs after semantic
analysis finds no conflicts (or only auto-mergeable conflicts).

Covers:
- Successful merge with no_commit=True (staged but not committed)
- Successful merge with no_commit=False (staged then committed)
- 'Already up to date' handling
- Merge failure + abort path
- Merge failure + abort failure (returns None for fallback)
- Stats dict alignment with established conventions
"""

import importlib.util
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Load workspace_module the same way core/workspace/__init__.py does,
# so we can patch attributes on the actual module that owns the functions.
# ---------------------------------------------------------------------------

_workspace_file = Path(__file__).parent.parent / "apps" / "backend" / "core" / "workspace.py"
_spec = importlib.util.spec_from_file_location("workspace_module", _workspace_file)
_workspace_module = importlib.util.module_from_spec(_spec)

# We need the module loaded to be able to reference its functions
# It was already loaded by conftest.py (via core.workspace.__init__),
# so we can just grab it from the already-loaded core.workspace package.
import core.workspace as _ws_pkg

# The actual module object that holds _try_smart_merge_inner
_ws_mod = _ws_pkg._workspace_module


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_completed_process(
    returncode: int = 0,
    stdout: str = "",
    stderr: str = "",
) -> subprocess.CompletedProcess:
    """Create a subprocess.CompletedProcess for mocking run_git."""
    return subprocess.CompletedProcess(
        args=["git"],
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_deps():
    """Patch all heavy dependencies of _try_smart_merge_inner.

    We patch attributes directly on the dynamically-loaded workspace_module
    since that is the module namespace where the functions look up their deps.
    """
    # Save originals
    originals = {}
    attrs_to_patch = [
        "run_git",
        "MergeOrchestrator",
        "FileTimelineTracker",
        "_check_git_conflicts",
        "_create_merge_progress_callback",
        "muted",
        "print_status",
        "warning",
        "success",
    ]
    for attr in attrs_to_patch:
        originals[attr] = getattr(_ws_mod, attr)

    mocks = {}

    # Create mocks
    mocks["run_git"] = MagicMock()
    mocks["MergeOrchestrator"] = MagicMock()
    mocks["FileTimelineTracker"] = MagicMock()
    mocks["_check_git_conflicts"] = MagicMock()
    mocks["_create_merge_progress_callback"] = MagicMock(return_value=None)
    mocks["muted"] = MagicMock(side_effect=lambda x: x)
    mocks["print_status"] = MagicMock()
    mocks["warning"] = MagicMock(side_effect=lambda x: x)
    mocks["success"] = MagicMock(side_effect=lambda x: x)

    # Apply mocks
    for attr, mock_obj in mocks.items():
        setattr(_ws_mod, attr, mock_obj)

    # Default: no git conflicts, no divergence
    mocks["_check_git_conflicts"].return_value = {
        "has_conflicts": False,
        "diverged_but_no_conflicts": False,
        "needs_rebase": False,
        "commits_behind": 0,
    }

    # Default orchestrator: preview returns no conflicts
    orchestrator_instance = MagicMock()
    orchestrator_instance.preview_merge.return_value = {
        "files_to_merge": ["src/app.py", "src/utils.py"],
        "conflicts": [],
        "summary": {"auto_mergeable": 0},
    }
    mocks["MergeOrchestrator"].return_value = orchestrator_instance

    yield mocks

    # Restore originals
    for attr, original in originals.items():
        setattr(_ws_mod, attr, original)


@pytest.fixture
def call_merge(mock_deps):
    """Return a callable that invokes _try_smart_merge_inner with defaults."""

    def _call(no_commit: bool = False):
        manager = MagicMock()
        return _ws_mod._try_smart_merge_inner(
            project_dir=Path("/fake/project"),
            spec_name="001-test-feature",
            worktree_path=Path("/fake/worktree"),
            manager=manager,
            no_commit=no_commit,
        )

    return _call


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSemanticMergeSuccess:
    """Tests for the successful merge code path."""

    def test_merge_no_commit_true_stages_without_committing(
        self, mock_deps, call_merge
    ):
        """With no_commit=True, merge uses --no-commit and does NOT call git commit."""
        run_git = mock_deps["run_git"]

        # First call: merge command -> success
        merge_ok = _make_completed_process(returncode=0, stdout="Merging...")
        # Second call: diff --cached -> list of files
        diff_ok = _make_completed_process(
            returncode=0, stdout="src/app.py\nsrc/utils.py\n"
        )
        run_git.side_effect = [merge_ok, diff_ok]

        result = call_merge(no_commit=True)

        assert result["success"] is True
        assert set(result["resolved_files"]) == {"src/app.py", "src/utils.py"}

        # Verify merge command includes --no-commit
        merge_call_args = run_git.call_args_list[0]
        assert "--no-commit" in merge_call_args[0][0]

        # Verify git commit was NOT called (only 2 run_git calls: merge + diff)
        assert run_git.call_count == 2

    def test_merge_no_commit_false_commits_after_staging(
        self, mock_deps, call_merge
    ):
        """With no_commit=False, merge stages files, inspects them, then commits."""
        run_git = mock_deps["run_git"]

        merge_ok = _make_completed_process(returncode=0, stdout="Merging...")
        diff_ok = _make_completed_process(
            returncode=0, stdout="src/app.py\n"
        )
        commit_ok = _make_completed_process(returncode=0)
        run_git.side_effect = [merge_ok, diff_ok, commit_ok]

        result = call_merge(no_commit=False)

        assert result["success"] is True
        assert result["resolved_files"] == ["src/app.py"]

        # Verify commit was called (3 run_git calls: merge + diff + commit)
        assert run_git.call_count == 3
        commit_call_args = run_git.call_args_list[2]
        assert "commit" in commit_call_args[0][0]

    def test_stats_dict_has_all_required_keys(self, mock_deps, call_merge):
        """Stats dict should match the established pattern from the diverged merge path."""
        run_git = mock_deps["run_git"]

        merge_ok = _make_completed_process(returncode=0)
        diff_ok = _make_completed_process(
            returncode=0, stdout="a.py\nb.py\nc.py\n"
        )
        commit_ok = _make_completed_process(returncode=0)
        run_git.side_effect = [merge_ok, diff_ok, commit_ok]

        result = call_merge(no_commit=False)

        stats = result["stats"]
        assert "files_merged" in stats
        assert "conflicts_resolved" in stats
        assert "ai_assisted" in stats
        assert "auto_merged" in stats
        assert "git_merge" in stats

        assert stats["files_merged"] == 3
        assert stats["auto_merged"] == 3
        assert stats["conflicts_resolved"] == 0
        assert stats["ai_assisted"] == 0
        assert stats["git_merge"] is True

    def test_auto_claude_files_are_filtered(self, mock_deps, call_merge):
        """Files under .auto-claude/ should be excluded from merged_files."""
        run_git = mock_deps["run_git"]

        merge_ok = _make_completed_process(returncode=0)
        diff_ok = _make_completed_process(
            returncode=0,
            stdout="src/app.py\n.auto-claude/specs/001/spec.md\n",
        )
        run_git.side_effect = [merge_ok, diff_ok]

        result = call_merge(no_commit=True)

        assert result["resolved_files"] == ["src/app.py"]
        assert result["stats"]["files_merged"] == 1


class TestAlreadyUpToDate:
    """Tests for the 'already up to date' handling."""

    def test_already_up_to_date_returns_success(self, mock_deps, call_merge):
        """When git says 'Already up to date', return success with zero files."""
        run_git = mock_deps["run_git"]

        already_up_to_date = _make_completed_process(
            returncode=0, stdout="Already up to date.\n"
        )
        run_git.side_effect = [already_up_to_date]

        result = call_merge(no_commit=False)

        assert result["success"] is True
        assert result["resolved_files"] == []
        assert result["stats"]["files_merged"] == 0
        assert result["stats"]["git_merge"] is True

    def test_already_up_to_date_stats_have_all_keys(self, mock_deps, call_merge):
        """The 'already up to date' stats dict should also have all required keys."""
        run_git = mock_deps["run_git"]

        already_up_to_date = _make_completed_process(
            returncode=0, stdout="Already up to date.\n"
        )
        run_git.side_effect = [already_up_to_date]

        result = call_merge(no_commit=False)

        stats = result["stats"]
        assert stats["files_merged"] == 0
        assert stats["conflicts_resolved"] == 0
        assert stats["ai_assisted"] == 0
        assert stats["auto_merged"] == 0
        assert stats["git_merge"] is True


class TestMergeFailure:
    """Tests for merge failure and abort handling."""

    def test_merge_failure_aborts_and_returns_failure_dict(
        self, mock_deps, call_merge
    ):
        """When merge fails, abort is called and a failure dict is returned (not an exception)."""
        run_git = mock_deps["run_git"]

        merge_fail = _make_completed_process(
            returncode=1, stderr="CONFLICT (content): Merge conflict in foo.py"
        )
        abort_ok = _make_completed_process(returncode=0)
        run_git.side_effect = [merge_fail, abort_ok]

        result = call_merge(no_commit=False)

        assert result["success"] is False
        assert "Git merge failed" in result["error"]
        assert result["conflicts"] == []

        # Verify abort was called
        abort_call_args = run_git.call_args_list[1]
        assert abort_call_args[0][0] == ["merge", "--abort"]

    def test_merge_failure_abort_failure_returns_none(
        self, mock_deps, call_merge
    ):
        """When both merge and abort fail, return None to trigger outer fallback."""
        run_git = mock_deps["run_git"]

        merge_fail = _make_completed_process(
            returncode=1, stderr="merge conflict"
        )
        abort_fail = _make_completed_process(
            returncode=128, stderr="fatal: no merge in progress"
        )
        run_git.side_effect = [merge_fail, abort_fail]

        result = call_merge(no_commit=False)

        assert result is None

    def test_merge_failure_does_not_raise_exception(
        self, mock_deps, call_merge
    ):
        """Merge failure should return a dict, NOT raise a generic Exception."""
        run_git = mock_deps["run_git"]

        merge_fail = _make_completed_process(
            returncode=1, stderr="error"
        )
        abort_ok = _make_completed_process(returncode=0)
        run_git.side_effect = [merge_fail, abort_ok]

        # This should NOT raise - it should return a failure dict
        result = call_merge(no_commit=False)
        assert isinstance(result, dict)
        assert result["success"] is False
