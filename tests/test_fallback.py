"""Tests for RuleBasedExtractor fallback pattern matching."""

import pytest

from observer.fallback import RuleBasedExtractor
from observer.models import ObservationCategory, SessionEvent


def _event(text: str, event_type: str = "tool_result", source: str = "test") -> SessionEvent:
    """Helper to create a SessionEvent with output text."""
    return SessionEvent(event_type=event_type, data={"output": text}, source=source)


@pytest.fixture
def extractor():
    return RuleBasedExtractor()


def _extract(extractor, text, event_type="tool_result"):
    events = [_event(text, event_type=event_type)]
    return extractor.extract(events, spec_id="001", project_id="proj", session_num=1)


class TestErrorResolution:
    def test_module_not_found(self, extractor):
        obs = _extract(extractor, "ModuleNotFoundError: No module named 'foo'")
        errors = [o for o in obs if o.category == ObservationCategory.ERROR_RESOLUTION]
        assert len(errors) >= 1
        assert "ModuleNotFoundError" in errors[0].content

    def test_import_error(self, extractor):
        obs = _extract(extractor, "ImportError: cannot import name 'bar' from 'baz'")
        errors = [o for o in obs if o.category == ObservationCategory.ERROR_RESOLUTION]
        assert len(errors) >= 1
        assert "ImportError" in errors[0].content


class TestTestingInsight:
    def test_pytest_output(self, extractor):
        obs = _extract(extractor, "5 passed, 2 failed")
        insights = [o for o in obs if o.category == ObservationCategory.TESTING_INSIGHT]
        assert len(insights) == 1
        assert "passed" in insights[0].content
        assert "failed" in insights[0].content


class TestBuildSystem:
    def test_ts_error_2339(self, extractor):
        obs = _extract(extractor, "error TS2339: Property 'x' does not exist on type 'Y'.")
        builds = [o for o in obs if o.category == ObservationCategory.BUILD_SYSTEM]
        assert len(builds) >= 1
        assert "TS2339" in builds[0].content

    def test_ts_error_2345(self, extractor):
        obs = _extract(extractor, "error TS2345: Argument of type 'A' is not assignable.")
        builds = [o for o in obs if o.category == ObservationCategory.BUILD_SYSTEM]
        assert len(builds) >= 1
        assert "TS2345" in builds[0].content


class TestFileRelationship:
    def test_extracts_file_paths_from_tool_result(self, extractor):
        obs = _extract(extractor, "Modified ./src/components/App.tsx and ./utils/helpers.ts")
        files = [o for o in obs if o.category == ObservationCategory.FILE_RELATIONSHIP]
        assert len(files) == 1
        assert "App.tsx" in files[0].content

    def test_no_file_paths_for_non_tool_result(self, extractor):
        obs = _extract(extractor, "Modified ./src/App.tsx", event_type="assistant_message")
        files = [o for o in obs if o.category == ObservationCategory.FILE_RELATIONSHIP]
        assert len(files) == 0


class TestNoPatterns:
    def test_empty_for_plain_text(self, extractor):
        obs = _extract(extractor, "Everything looks good, no issues found.")
        assert obs == []

    def test_empty_for_no_events(self, extractor):
        obs = extractor.extract([], spec_id="001", project_id="proj", session_num=1)
        assert obs == []


class TestConfigurationGotcha:
    def test_env_var_error(self, extractor):
        obs = _extract(extractor, "DATABASE_URL=postgres://localhost:5432/mydb")
        configs = [o for o in obs if o.category == ObservationCategory.CONFIGURATION_GOTCHA]
        assert len(configs) >= 1
        assert any("DATABASE_URL" in o.content for o in configs)
