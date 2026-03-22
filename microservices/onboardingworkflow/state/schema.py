from __future__ import annotations

from typing import Any, Dict, List, Literal, TypedDict


class AuditLogEntry(TypedDict, total=False):
    step: str
    agent: str
    decision: Literal[
        "Success",
        "Failure",
        "Retry",
        "Escalate",
        "Escalated",
        "Recovered",
        "Info",
    ]
    timestamp: str
    reason: str
    retry_count: int
    meta: Dict[str, Any]


class FailureEntry(TypedDict, total=False):
    type: Literal["account_creation", "asset_assignment", "validation"]
    step: str
    agent: str
    timestamp: str
    reason: str
    count: int


class OnboardingState(TypedDict):
    """Central workflow state.

    Note: This includes exactly the keys required by the spec.
    More derived views (task status, etc.) are computed from logs.
    """

    employee_id: str
    name: str
    account_created: bool
    asset_assigned: bool
    orientation_scheduled: bool
    status: str
    retry_counts: Dict[str, int]
    escalations: List[Dict[str, Any]]
    recovery_flags: Dict[str, bool]
    logs: List[AuditLogEntry]
    failures: List[FailureEntry]
