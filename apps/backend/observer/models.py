"""
Observer memory system data models.

Defines core data structures for the observer memory system including
observations, categories, priorities, statuses, and session events.
"""

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class ObservationCategory(str, Enum):
    """Categories of observations the observer can capture."""

    ARCHITECTURE_DECISION = "architecture_decision"
    CODE_PATTERN = "code_pattern"
    ERROR_RESOLUTION = "error_resolution"
    DEPENDENCY_INSIGHT = "dependency_insight"
    TESTING_INSIGHT = "testing_insight"
    PERFORMANCE_FINDING = "performance_finding"
    SECURITY_CONCERN = "security_concern"
    API_BEHAVIOR = "api_behavior"
    CONFIGURATION_GOTCHA = "configuration_gotcha"
    WORKFLOW_PREFERENCE = "workflow_preference"
    FILE_RELATIONSHIP = "file_relationship"
    BUILD_SYSTEM = "build_system"


class ObservationPriority(str, Enum):
    """Priority levels for observations."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ObservationStatus(str, Enum):
    """Lifecycle status of an observation."""

    ACTIVE = "active"
    MERGED = "merged"
    PRUNED = "pruned"
    ARCHIVED = "archived"


@dataclass
class Observation:
    """A single observation captured by the observer system."""

    category: ObservationCategory
    content: str
    source: str
    priority: ObservationPriority = ObservationPriority.MEDIUM
    status: ObservationStatus = ObservationStatus.ACTIVE
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    context: str | None = None
    file_path: str | None = None
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        data = asdict(self)
        data["category"] = self.category.value
        data["priority"] = self.priority.value
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Observation":
        """Deserialize from dictionary."""
        return cls(
            category=ObservationCategory(data["category"]),
            content=data["content"],
            source=data["source"],
            priority=ObservationPriority(data.get("priority", "medium")),
            status=ObservationStatus(data.get("status", "active")),
            id=data.get("id", str(uuid.uuid4())),
            timestamp=data.get("timestamp", datetime.utcnow().isoformat()),
            context=data.get("context"),
            file_path=data.get("file_path"),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
        )


@dataclass
class SessionEvent:
    """An event captured during an agent session."""

    event_type: str
    data: dict[str, Any]
    source: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SessionEvent":
        """Deserialize from dictionary."""
        return cls(
            event_type=data["event_type"],
            data=data.get("data", {}),
            source=data["source"],
            timestamp=data.get("timestamp", datetime.utcnow().isoformat()),
        )
