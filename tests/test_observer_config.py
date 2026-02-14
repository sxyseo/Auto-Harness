"""
Tests for Observer Memory System Configuration
================================================

Tests that ObserverConfig.from_env() correctly loads defaults, respects env var overrides,
and handles invalid values gracefully.
"""

import os
from unittest.mock import patch

import pytest

from observer.config import ObserverConfig


class TestObserverConfigDefaults:
    """Test that from_env() returns correct defaults when no env vars are set."""

    def test_enabled_defaults_to_true(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.enabled is True

    def test_model_defaults_to_gemini_flash(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.model == "gemini-2.0-flash"

    def test_max_calls_per_session_defaults_to_20(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.max_calls_per_session == 20

    def test_timeout_seconds_defaults_to_30(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.timeout_seconds == 30

    def test_min_buffer_defaults_to_5000(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.min_buffer == 5000

    def test_max_in_prompt_defaults_to_30(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.max_in_prompt == 30

    def test_scope_defaults_to_project(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.scope == "project"

    def test_auto_archive_days_defaults_to_28(self):
        with patch.dict(os.environ, {}, clear=True):
            config = ObserverConfig.from_env()
        assert config.auto_archive_days == 28


class TestObserverConfigEnvOverrides:
    """Test that env var overrides work for all fields."""

    def test_observer_enabled_false(self):
        with patch.dict(os.environ, {"OBSERVER_ENABLED": "false"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.enabled is False

    def test_observer_enabled_true(self):
        with patch.dict(os.environ, {"OBSERVER_ENABLED": "true"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.enabled is True

    def test_observer_enabled_zero(self):
        with patch.dict(os.environ, {"OBSERVER_ENABLED": "0"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.enabled is False

    def test_observer_enabled_no(self):
        with patch.dict(os.environ, {"OBSERVER_ENABLED": "no"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.enabled is False

    def test_model_override(self):
        with patch.dict(os.environ, {"OBSERVER_MODEL": "claude-3-opus"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.model == "claude-3-opus"

    def test_max_calls_per_session_override(self):
        with patch.dict(os.environ, {"OBSERVER_MAX_CALLS_PER_SESSION": "50"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.max_calls_per_session == 50

    def test_timeout_seconds_override(self):
        with patch.dict(os.environ, {"OBSERVER_TIMEOUT_SECONDS": "60"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.timeout_seconds == 60

    def test_min_buffer_override(self):
        with patch.dict(os.environ, {"OBSERVER_MIN_BUFFER": "10000"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.min_buffer == 10000

    def test_max_in_prompt_override(self):
        with patch.dict(os.environ, {"OBSERVATION_MAX_IN_PROMPT": "15"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.max_in_prompt == 15

    def test_scope_override_global(self):
        with patch.dict(os.environ, {"OBSERVATION_SCOPE": "global"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.scope == "global"

    def test_auto_archive_days_override(self):
        with patch.dict(os.environ, {"OBSERVATION_AUTO_ARCHIVE_DAYS": "7"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.auto_archive_days == 7


class TestObserverConfigInvalidValues:
    """Test that invalid values fall back to defaults gracefully."""

    def test_invalid_max_calls_defaults_to_20(self):
        with patch.dict(os.environ, {"OBSERVER_MAX_CALLS_PER_SESSION": "abc"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.max_calls_per_session == 20

    def test_invalid_timeout_defaults_to_30(self):
        with patch.dict(os.environ, {"OBSERVER_TIMEOUT_SECONDS": "xyz"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.timeout_seconds == 30

    def test_invalid_min_buffer_defaults_to_5000(self):
        with patch.dict(os.environ, {"OBSERVER_MIN_BUFFER": "not_a_number"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.min_buffer == 5000

    def test_invalid_max_in_prompt_defaults_to_30(self):
        with patch.dict(os.environ, {"OBSERVATION_MAX_IN_PROMPT": "bad"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.max_in_prompt == 30

    def test_invalid_auto_archive_days_defaults_to_28(self):
        with patch.dict(os.environ, {"OBSERVATION_AUTO_ARCHIVE_DAYS": "nope"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.auto_archive_days == 28

    def test_invalid_scope_defaults_to_project(self):
        with patch.dict(os.environ, {"OBSERVATION_SCOPE": "invalid"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.scope == "project"

    def test_invalid_enabled_defaults_to_true(self):
        with patch.dict(os.environ, {"OBSERVER_ENABLED": "maybe"}, clear=True):
            config = ObserverConfig.from_env()
        assert config.enabled is True
