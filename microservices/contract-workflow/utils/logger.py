from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from state.schema import AuditLogEntry, ContractState


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def audit_log(
    state: ContractState,
    *,
    step: str,
    agent: str,
    decision: Literal["Success", "Failure", "Retry", "Reminder", "Escalated", "Recovered", "Info"],
    reason: str,
    retry_count: Optional[int] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    entry: AuditLogEntry = {
        "step": step,
        "agent": agent,
        "decision": decision,
        "reason": reason,
        "timestamp": _utc_now_iso(),
    }
    if retry_count is not None:
        entry["retry_count"] = int(retry_count)
    if meta:
        entry["meta"] = meta
    state["logs"].append(entry)


def record_escalation(
    state: ContractState,
    *,
    escalation_type: Literal["approval", "signing"],
    step: str,
    agent: str,
    reason: str,
    retry_count: int,
) -> None:
    state.setdefault("escalations", [])
    state["escalations"].append(
        {
            "type": escalation_type,
            "step": step,
            "agent": agent,
            "reason": reason,
            "retry_count": int(retry_count),
            "timestamp": _utc_now_iso(),
        }
    )
