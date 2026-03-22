from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from onboarding_system.state.schema import AuditLogEntry, FailureEntry, OnboardingState


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def audit_log(
    state: OnboardingState,
    *,
    step: str,
    agent: str,
    decision: Literal[
        "Success",
        "Failure",
        "Retry",
        "Escalate",
        "Escalated",
        "Recovered",
        "Info",
    ],
    reason: str,
    meta: Optional[Dict[str, Any]] = None,
    retry_count: Optional[int] = None,
) -> None:
    """Append an audit log entry to the shared state."""

    entry: AuditLogEntry = {
        "step": step,
        "agent": agent,
        "decision": decision,
        "timestamp": _utc_now_iso(),
        "reason": reason,
    }
    if retry_count is not None:
        entry["retry_count"] = int(retry_count)
    if meta:
        entry["meta"] = meta

    state["logs"].append(entry)


def record_failure(
    state: OnboardingState,
    *,
    failure_type: Literal["account_creation", "asset_assignment", "validation"],
    step: str,
    agent: str,
    reason: str,
    increment: int = 1,
) -> int:
    """Record (and increment) a failure counter; returns updated count."""

    existing = None
    for f in state["failures"]:
        if f.get("type") == failure_type:
            existing = f
            break

    if existing is None:
        entry: FailureEntry = {
            "type": failure_type,
            "step": step,
            "agent": agent,
            "timestamp": _utc_now_iso(),
            "reason": reason,
            "count": increment,
        }
        state["failures"].append(entry)
        return increment

    new_count = int(existing.get("count", 0)) + increment
    existing["count"] = new_count
    existing["timestamp"] = _utc_now_iso()
    existing["reason"] = reason
    existing["step"] = step
    existing["agent"] = agent
    return new_count


def get_failure_count(
    state: OnboardingState,
    *,
    failure_type: Literal["account_creation", "asset_assignment", "validation"],
) -> int:
    for f in state["failures"]:
        if f.get("type") == failure_type:
            return int(f.get("count", 0))
    return 0
