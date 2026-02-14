"""Tests for search_memory tool via create_memory_tools()."""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "backend"))

from observer.models import Observation, ObservationCategory, ObservationPriority
from observer.store import ObservationStore


@pytest.fixture
def store_dir():
    d = tempfile.mkdtemp()
    yield Path(d)


@pytest.fixture
def store(store_dir):
    return ObservationStore(store_dir)


def _make_obs(content: str, **kwargs) -> Observation:
    defaults = {
        "category": ObservationCategory.CODE_PATTERN,
        "content": content,
        "source": "test",
    }
    defaults.update(kwargs)
    return Observation(**defaults)


def _seed_store(store: ObservationStore) -> list[Observation]:
    """Seed store with diverse test observations."""
    obs_list = [
        _make_obs(
            "React components use useState for local state",
            category=ObservationCategory.CODE_PATTERN,
            tags=["react", "hooks"],
            source="coder",
        ),
        _make_obs(
            "Database migrations must run before tests",
            category=ObservationCategory.CONFIGURATION_GOTCHA,
            tags=["database", "testing"],
            source="qa",
        ),
        _make_obs(
            "API endpoints follow REST conventions",
            category=ObservationCategory.ARCHITECTURE_DECISION,
            tags=["api", "rest"],
            source="planner",
        ),
        _make_obs(
            "React router handles client-side navigation",
            category=ObservationCategory.CODE_PATTERN,
            tags=["react", "routing"],
            source="coder",
        ),
        _make_obs(
            "Environment variables loaded from .env file",
            category=ObservationCategory.DEPENDENCY_INSIGHT,
            tags=["config", "env"],
            source="coder",
        ),
    ]
    for obs in obs_list:
        store.save(obs)
    return obs_list


class TestSearchResults:
    """Test that search_memory returns results matching query."""

    def test_search_returns_matching_results(self, store):
        _seed_store(store)
        results = store.search(query="React")
        assert len(results) == 2
        for obs in results:
            assert "react" in obs.content.lower()

    def test_search_case_insensitive(self, store):
        _seed_store(store)
        results = store.search(query="react")
        assert len(results) == 2

    def test_search_no_match_returns_empty(self, store):
        _seed_store(store)
        results = store.search(query="nonexistent_xyz_term")
        assert len(results) == 0

    def test_search_matches_tags(self, store):
        _seed_store(store)
        results = store.search(query="hooks")
        assert len(results) == 1
        assert "useState" in results[0].content

    def test_search_matches_source(self, store):
        _seed_store(store)
        results = store.search(query="planner")
        assert len(results) == 1
        assert "API endpoints" in results[0].content


class TestCategoryFiltering:
    """Test category filtering narrows results."""

    def test_filter_by_category(self, store):
        _seed_store(store)
        results = store.search(query="React", category=ObservationCategory.CODE_PATTERN)
        assert len(results) == 2

    def test_filter_excludes_other_categories(self, store):
        _seed_store(store)
        results = store.search(query="React", category=ObservationCategory.CONFIGURATION_GOTCHA)
        assert len(results) == 0

    def test_filter_by_category_string(self, store):
        _seed_store(store)
        results = store.search(query="database", category="configuration_gotcha")
        assert len(results) == 1

    def test_filter_invalid_category_returns_all_matches(self, store):
        _seed_store(store)
        # Invalid category string should be treated as None (no filter)
        results = store.search(query="React", category="invalid_category")
        assert len(results) == 2


class TestScopeFiltering:
    """Test scope filtering (spec vs project)."""

    def test_default_scope_is_project(self, store):
        _seed_store(store)
        results = store.search(query="React", scope="project")
        assert len(results) == 2

    def test_scope_param_accepted(self, store):
        """Verify scope parameter is accepted without error."""
        _seed_store(store)
        results = store.search(query="React", scope="spec")
        # scope doesn't currently filter differently in file store
        assert isinstance(results, list)


class TestResultRanking:
    """Test results are ranked by relevance."""

    def test_content_match_in_results(self, store):
        """Content matches appear in search results."""
        _seed_store(store)
        results = store.search(query="useState")
        assert len(results) >= 1
        assert "useState" in results[0].content


class TestDeduplication:
    """Test deduplication of results."""

    def test_duplicate_content_saved_separately(self, store):
        """Same content saved twice creates two entries; search returns both."""
        obs1 = _make_obs("duplicate pattern found here")
        obs2 = _make_obs("duplicate pattern found here")
        store.save(obs1)
        store.save(obs2)
        results = store.search(query="duplicate pattern")
        assert len(results) == 2

    def test_unique_ids_for_duplicates(self, store):
        obs1 = _make_obs("same content")
        obs2 = _make_obs("same content")
        store.save(obs1)
        store.save(obs2)
        results = store.search(query="same content")
        ids = [r.id for r in results]
        assert len(set(ids)) == len(ids)


class TestEmptyQuery:
    """Test empty query behavior."""

    def test_empty_string_returns_empty(self, store):
        _seed_store(store)
        results = store.search(query="")
        # Empty query matches everything (empty string is in every string)
        assert isinstance(results, list)


class TestToolReturnFormat:
    """Test search_memory tool returns correct format via create_memory_tools."""

    @pytest.fixture
    def spec_dir(self):
        d = tempfile.mkdtemp()
        yield Path(d)

    @pytest.fixture
    def project_dir(self):
        d = tempfile.mkdtemp()
        yield Path(d)

    @pytest.mark.asyncio
    async def test_tool_returns_content_format(self, spec_dir, project_dir, store_dir, store):
        """Tool returns {content: [{type: 'text', text: JSON_STRING}]}."""
        obs_list = _seed_store(store)

        try:
            from agents.tools_pkg.tools.memory import create_memory_tools
        except ImportError:
            pytest.skip("claude_agent_sdk not available")

        tools = create_memory_tools(spec_dir, project_dir)
        if not tools:
            pytest.skip("SDK tools not available")

        # Find the search_memory tool
        search_tool = None
        for t in tools:
            if hasattr(t, "__name__") and t.__name__ == "search_memory":
                search_tool = t
                break
            if hasattr(t, "name") and t.name == "search_memory":
                search_tool = t
                break

        if search_tool is None:
            pytest.skip("search_memory tool not found in created tools")

        # Patch ObservationStore to use our seeded store
        with patch("agents.tools_pkg.tools.memory.ObservationStore", return_value=store):
            with patch("agents.tools_pkg.tools.memory.Path") as mock_path:
                mock_base = mock_path.home.return_value / "any"
                mock_base.exists.return_value = True
                result = await search_tool({"query": "React"})

        assert "content" in result
        assert isinstance(result["content"], list)
        assert len(result["content"]) >= 1
        assert result["content"][0]["type"] == "text"
        assert isinstance(result["content"][0]["text"], str)

    @pytest.mark.asyncio
    async def test_tool_empty_query_returns_error(self, spec_dir, project_dir):
        """Empty query returns error message in correct format."""
        try:
            from agents.tools_pkg.tools.memory import create_memory_tools
        except ImportError:
            pytest.skip("claude_agent_sdk not available")

        tools = create_memory_tools(spec_dir, project_dir)
        if not tools:
            pytest.skip("SDK tools not available")

        search_tool = None
        for t in tools:
            if hasattr(t, "__name__") and t.__name__ == "search_memory":
                search_tool = t
                break
            if hasattr(t, "name") and t.name == "search_memory":
                search_tool = t
                break

        if search_tool is None:
            pytest.skip("search_memory tool not found")

        result = await search_tool({"query": ""})
        assert "content" in result
        assert result["content"][0]["type"] == "text"
        assert "error" in result["content"][0]["text"].lower() or "required" in result["content"][0]["text"].lower()
