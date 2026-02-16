"""Tests for investigation context loading with correct Pydantic field names."""
import json
import pytest
from pathlib import Path

from agents.investigation_context import load_investigation_context, load_investigation_for_qa


@pytest.fixture
def spec_dir(tmp_path):
    """Create a spec dir with a realistic investigation_report.json."""
    report = {
        "issue_number": 42,
        "issue_title": "Login button broken",
        "investigation_id": "inv-001",
        "timestamp": "2026-01-01T00:00:00Z",
        "root_cause": {
            "identified_root_cause": "Missing null check in auth handler",
            "code_paths": [
                {"file": "src/auth.py", "start_line": 10, "end_line": 20, "description": "Auth handler"}
            ],
            "confidence": "high",
            "evidence": "The auth handler at line 15 dereferences user.session without checking if session is None.",
            "related_issues": ["null reference"],
            "likely_already_fixed": False,
        },
        "impact": {
            "severity": "high",
            "affected_components": [],
            "blast_radius": "All login flows",
            "user_impact": "Users cannot log in",
            "regression_risk": "Low",
        },
        "fix_advice": {
            "approaches": [
                {
                    "description": "Add null check before session access",
                    "complexity": "simple",
                    "files_affected": ["src/auth.py"],
                    "pros": ["Simple fix"],
                    "cons": [],
                }
            ],
            "recommended_approach": 0,
            "files_to_modify": ["src/auth.py"],
            "patterns_to_follow": [
                {"file": "src/utils.py", "description": "Null guard pattern used there"}
            ],
            "gotchas": ["Don't forget to handle expired sessions too"],
        },
        "reproduction": {
            "reproducible": "yes",
            "reproduction_steps": ["Go to login page", "Click login", "Observe crash"],
            "test_coverage": {
                "has_existing_tests": True,
                "test_files": ["tests/test_auth.py"],
                "coverage_assessment": "Partial coverage",
            },
            "related_test_files": ["tests/test_auth.py"],
            "suggested_test_approach": "Add a test for null session scenario",
        },
        "ai_summary": "Login crash due to missing null check",
        "severity": "high",
        "likely_resolved": False,
        "suggested_labels": [],
        "linked_prs": [],
    }
    spec_dir_path = tmp_path / "spec"
    spec_dir_path.mkdir()
    (spec_dir_path / "investigation_report.json").write_text(json.dumps(report))
    return spec_dir_path


def test_load_investigation_context_correct_field_mapping(spec_dir):
    ctx = load_investigation_context(spec_dir)
    assert ctx is not None
    assert ctx["root_cause"]["summary"] == "Missing null check in auth handler"
    assert isinstance(ctx["root_cause"]["evidence"], str)
    assert "dereferences user.session" in ctx["root_cause"]["evidence"]
    assert len(ctx["root_cause"]["code_paths"]) == 1
    assert ctx["root_cause"]["code_paths"][0]["file"] == "src/auth.py"
    assert len(ctx["fix_approaches"]) == 1
    assert ctx["fix_approaches"][0]["description"] == "Add null check before session access"
    assert len(ctx["gotchas"]) == 1
    assert "expired sessions" in ctx["gotchas"][0]
    assert len(ctx["patterns_to_follow"]) == 1
    assert ctx["patterns_to_follow"][0]["file"] == "src/utils.py"
    assert ctx["reproducer"] is not None
    assert ctx["reproducer"]["reproducible"] == "yes"
    assert len(ctx["reproducer"]["reproduction_steps"]) == 3
    assert ctx["reproducer"]["suggested_test_approach"] == "Add a test for null session scenario"
    assert ctx["impact"]["severity"] == "high"


def test_load_investigation_for_qa_correct_field_mapping(spec_dir):
    ctx = load_investigation_for_qa(spec_dir, "main")
    assert ctx is not None
    assert ctx["root_cause"]["summary"] == "Missing null check in auth handler"
    assert isinstance(ctx["root_cause"]["evidence"], str)
    assert ctx["reproducer"]["reproducible"] == "yes"
    assert ctx["base_branch"] == "main"


def test_load_investigation_context_returns_none_when_no_file(tmp_path):
    assert load_investigation_context(tmp_path) is None


def test_load_investigation_context_returns_none_on_invalid_json(tmp_path):
    (tmp_path / "investigation_report.json").write_text("not json")
    assert load_investigation_context(tmp_path) is None
