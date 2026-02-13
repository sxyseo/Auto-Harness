"""
Rule-based fallback extractor for observation extraction without LLM.

Uses regex and pattern matching to extract observations from session events
when LLM-based extraction is unavailable or as a supplement.
"""

import re
from typing import Any

from observer.models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    SessionEvent,
)


class RuleBasedExtractor:
    """Extracts observations from session events using regex/pattern matching."""

    # Python error patterns
    PYTHON_ERROR_PATTERNS: list[re.Pattern] = [
        re.compile(r"(ModuleNotFoundError:\s*.+)"),
        re.compile(r"(ImportError:\s*.+)"),
        re.compile(r"(SyntaxError:\s*.+)"),
        re.compile(r"(TypeError:\s*.+)"),
        re.compile(r"(ValueError:\s*.+)"),
        re.compile(r"(AttributeError:\s*.+)"),
        re.compile(r"(KeyError:\s*.+)"),
        re.compile(r"(NameError:\s*.+)"),
        re.compile(r"(FileNotFoundError:\s*.+)"),
        re.compile(r"(PermissionError:\s*.+)"),
    ]

    # JS/TS error patterns
    JS_ERROR_PATTERNS: list[re.Pattern] = [
        re.compile(r"(ReferenceError:\s*.+)"),
        re.compile(r"(TypeError:\s*.+)"),
        re.compile(r"(SyntaxError:\s*.+)"),
        re.compile(r"(RangeError:\s*.+)"),
        re.compile(r"(URIError:\s*.+)"),
    ]

    # File path patterns
    FILE_PATH_PATTERN: re.Pattern = re.compile(
        r"(?:^|\s)((?:[a-zA-Z]:[\\/]|\.{0,2}/)[\w./-]+\.\w+)"
    )

    # Test output patterns
    TEST_PATTERNS: list[tuple[re.Pattern, str]] = [
        (re.compile(r"(\d+)\s+(?:tests?\s+)?passed"), "passed"),
        (re.compile(r"(\d+)\s+(?:tests?\s+)?failed"), "failed"),
        (re.compile(r"(\d+)\s+(?:tests?\s+)?skipped"), "skipped"),
        (re.compile(r"Tests:\s+(\d+)\s+passed"), "passed"),
        (re.compile(r"Tests:\s+(\d+)\s+failed"), "failed"),
        (re.compile(r"PASS\s+(.+)"), "test_pass"),
        (re.compile(r"FAIL\s+(.+)"), "test_fail"),
    ]

    # Build/compilation error patterns
    BUILD_PATTERNS: list[re.Pattern] = [
        re.compile(r"(error\s+TS\d+:\s*.+)"),
        re.compile(r"(ERROR\s+in\s+.+)"),
        re.compile(r"(Compilation\s+failed.*)"),
        re.compile(r"(Build\s+failed.*)"),
        re.compile(r"(Module\s+build\s+failed.*)"),
        re.compile(r"(Cannot\s+find\s+module\s+.+)"),
    ]

    # Config patterns
    CONFIG_PATTERNS: list[tuple[re.Pattern, str]] = [
        (re.compile(r"([A-Z][A-Z0-9_]{2,})=(\S+)"), "env_var"),
        (re.compile(r"port\s*[:=]\s*(\d{2,5})", re.IGNORECASE), "port"),
        (re.compile(r"(https?://[^\s\"']+)"), "url"),
    ]

    def extract(
        self,
        events: list[SessionEvent],
        spec_id: str,
        project_id: str,
        session_num: int,
    ) -> list[Observation]:
        """Extract observations from session events using pattern matching.

        Args:
            events: List of session events to analyze.
            spec_id: The spec identifier.
            project_id: The project identifier.
            session_num: The session number.

        Returns:
            List of extracted Observation objects.
        """
        observations: list[Observation] = []
        base_metadata = {
            "spec_id": spec_id,
            "project_id": project_id,
            "session_num": session_num,
            "extraction_method": "rule_based",
        }

        for event in events:
            text = self._get_event_text(event)
            if not text:
                continue

            observations.extend(self._extract_errors(text, event, base_metadata))
            observations.extend(self._extract_file_paths(text, event, base_metadata))
            observations.extend(self._extract_test_output(text, event, base_metadata))
            observations.extend(self._extract_build_output(text, event, base_metadata))
            observations.extend(self._extract_config(text, event, base_metadata))

        return observations

    def _get_event_text(self, event: SessionEvent) -> str:
        """Extract searchable text from an event."""
        parts: list[str] = []
        data = event.data

        if "result" in data:
            parts.append(str(data["result"]))
        if "output" in data:
            parts.append(str(data["output"]))
        if "error" in data:
            parts.append(str(data["error"]))
        if "content" in data:
            parts.append(str(data["content"]))
        if "message" in data:
            parts.append(str(data["message"]))

        return "\n".join(parts)

    def _extract_errors(
        self,
        text: str,
        event: SessionEvent,
        base_metadata: dict[str, Any],
    ) -> list[Observation]:
        """Extract error resolution observations from text."""
        observations: list[Observation] = []
        seen: set[str] = set()

        all_patterns = self.PYTHON_ERROR_PATTERNS + self.JS_ERROR_PATTERNS
        for pattern in all_patterns:
            for match in pattern.finditer(text):
                error_msg = match.group(1).strip()
                if error_msg in seen:
                    continue
                seen.add(error_msg)

                observations.append(
                    Observation(
                        category=ObservationCategory.ERROR_RESOLUTION,
                        content=f"Error encountered: {error_msg}",
                        source=event.source,
                        priority=ObservationPriority.MEDIUM,
                        tags=["auto-extracted", "error"],
                        metadata={**base_metadata, "error_message": error_msg},
                    )
                )

        return observations

    def _extract_file_paths(
        self,
        text: str,
        event: SessionEvent,
        base_metadata: dict[str, Any],
    ) -> list[Observation]:
        """Extract file relationship observations from tool_result events."""
        if event.event_type != "tool_result":
            return []

        observations: list[Observation] = []
        paths: set[str] = set()

        for match in self.FILE_PATH_PATTERN.finditer(text):
            path = match.group(1).strip()
            if path not in paths and len(path) > 3:
                paths.add(path)

        if paths:
            path_list = sorted(paths)[:10]  # Limit to 10 paths
            observations.append(
                Observation(
                    category=ObservationCategory.FILE_RELATIONSHIP,
                    content=f"Files referenced: {', '.join(path_list)}",
                    source=event.source,
                    priority=ObservationPriority.LOW,
                    tags=["auto-extracted", "file-paths"],
                    metadata={**base_metadata, "file_paths": path_list},
                )
            )

        return observations

    def _extract_test_output(
        self,
        text: str,
        event: SessionEvent,
        base_metadata: dict[str, Any],
    ) -> list[Observation]:
        """Extract testing insight observations from test output."""
        results: dict[str, str] = {}

        for pattern, label in self.TEST_PATTERNS:
            match = pattern.search(text)
            if match:
                results[label] = match.group(1)

        if not results:
            return []

        summary_parts = [f"{v} {k}" for k, v in results.items()]
        return [
            Observation(
                category=ObservationCategory.TESTING_INSIGHT,
                content=f"Test results: {', '.join(summary_parts)}",
                source=event.source,
                priority=ObservationPriority.MEDIUM,
                tags=["auto-extracted", "testing"],
                metadata={**base_metadata, "test_results": results},
            )
        ]

    def _extract_build_output(
        self,
        text: str,
        event: SessionEvent,
        base_metadata: dict[str, Any],
    ) -> list[Observation]:
        """Extract build system observations from compilation output."""
        observations: list[Observation] = []
        seen: set[str] = set()

        for pattern in self.BUILD_PATTERNS:
            for match in pattern.finditer(text):
                error_msg = match.group(1).strip()
                if error_msg in seen:
                    continue
                seen.add(error_msg)

                observations.append(
                    Observation(
                        category=ObservationCategory.BUILD_SYSTEM,
                        content=f"Build issue: {error_msg}",
                        source=event.source,
                        priority=ObservationPriority.MEDIUM,
                        tags=["auto-extracted", "build"],
                        metadata={**base_metadata, "build_error": error_msg},
                    )
                )

        return observations

    def _extract_config(
        self,
        text: str,
        event: SessionEvent,
        base_metadata: dict[str, Any],
    ) -> list[Observation]:
        """Extract configuration gotcha observations."""
        observations: list[Observation] = []
        seen: set[str] = set()

        for pattern, config_type in self.CONFIG_PATTERNS:
            for match in pattern.finditer(text):
                key = match.group(0).strip()
                if key in seen:
                    continue
                seen.add(key)

                observations.append(
                    Observation(
                        category=ObservationCategory.CONFIGURATION_GOTCHA,
                        content=f"Configuration reference: {key}",
                        source=event.source,
                        priority=ObservationPriority.LOW,
                        tags=["auto-extracted", "config", config_type],
                        metadata={**base_metadata, "config_type": config_type},
                    )
                )

        return observations
