"""
AuditTrailAgent — passive listener.
Every other agent calls AuditTrailAgent.record(...) after significant actions.
Writes timestamped, immutable rows to audit_log.
Does NOT inherit run() flow — it is fire-and-forget.
"""
from typing import Any, Optional

from db.db import write_audit, get_audit_log, get_all_audit_log
from models.enums import AuditStatus
from models.schemas import AuditEvent


class AuditTrailAgent:
    """
    Usage:
        audit = AuditTrailAgent(run_id="RUN-ABC123")
        audit.record("BUDGET_APPROVED", AuditStatus.SUCCESS, payload={"amount": 410000})
        audit.record("PO_DISPATCH_FAILED", AuditStatus.RETRY, error="Connection refused")
    """

    name = "AuditTrailAgent"

    def __init__(self, run_id: str):
        self.run_id = run_id

    def record(
        self,
        action: str,
        status: AuditStatus = AuditStatus.INFO,
        payload: Optional[Any] = None,
        error: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> None:
        """
        Write one event to the audit log.
        agent_name defaults to 'AuditTrailAgent' — override when recording
        on behalf of another agent.
        """
        # Convert Pydantic models to dicts before logging
        if payload is not None:
            if hasattr(payload, 'model_dump'):  # Pydantic model
                serializable_payload = payload.model_dump()
            elif isinstance(payload, dict):
                serializable_payload = payload
            else:
                serializable_payload = {"value": str(payload)}
        else:
            serializable_payload = None
            
        event = AuditEvent(
            run_id=self.run_id,
            agent_name=agent_name or self.name,
            action=action,
            status=status,
            payload=serializable_payload,
            error_msg=error,
        )
        write_audit(event)

    def get_log(self) -> list[dict]:
        """Return all audit events for this run, oldest first."""
        return get_audit_log(self.run_id)

    @staticmethod
    def get_full_log(limit: int = 200) -> list[dict]:
        """Return most recent audit events across all runs."""
        return get_all_audit_log(limit=limit)