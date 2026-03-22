from __future__ import annotations

from typing import Any, Dict, List, Literal, TypedDict


class AuditLogEntry(TypedDict, total=False):
    step: str
    agent: str
    decision: Literal["Success", "Failure", "Retry", "Reminder", "Escalated", "Recovered", "Info"]
    reason: str
    timestamp: str
    retry_count: int
    meta: Dict[str, Any]


class ContractState(TypedDict):
    contract_id: str
    draft_created: bool
    review_completed: bool
    approved: bool
    signed: bool
    stored: bool
    status: str
    retry_counts: Dict[str, int]  # {"approval": int, "signing": int}
    escalations: List[Dict[str, Any]]
    logs: List[AuditLogEntry]
