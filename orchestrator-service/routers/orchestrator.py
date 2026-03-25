from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from models.event import Event
from models.workflow_state import AuditEntry, InMemoryAuditLog, InMemoryWorkflowStateStore
from services.decision_engine import DecisionEngine, WorkflowAction
from services.workflow_router import WorkflowRouter, ActionExecutionResult

logger = logging.getLogger("orchestrator")

router = APIRouter(tags=["orchestrator"])


class DecisionResponse(BaseModel):
    event_id: str
    workflow_key: str
    decision_summary: str
    actions: list[dict[str, Any]]
    results: list[dict[str, Any]]
    decision_time_ms: float


@router.post("/events", response_model=DecisionResponse)
async def receive_event(event: Event, request: Request) -> DecisionResponse:
    """Receive an event, make a deterministic decision, and trigger workflows."""

    event_id = str(uuid.uuid4())
    received_at = datetime.now(timezone.utc).isoformat()

    state_store: InMemoryWorkflowStateStore = request.app.state.state_store
    audit_log: InMemoryAuditLog = request.app.state.audit_log
    engine: DecisionEngine = request.app.state.decision_engine
    workflow_router: WorkflowRouter = request.app.state.workflow_router

    workflow_key = state_store.compute_key(event.payload or {}, event_id)

    await state_store.upsert_event(
        key=workflow_key,
        event={
            "event_id": event_id,
            "received_at": received_at,
            "event_type": event.event_type,
            "source_service": event.source_service,
            "payload": event.payload,
            "timestamp": event.timestamp,
        },
    )

    t0 = time.perf_counter()
    decision = engine.decide(event)
    decision_time_ms = (time.perf_counter() - t0) * 1000.0

    # Execute downstream calls (async; may dominate total time, but decision time stays low)
    results = await workflow_router.execute_actions(decision.actions)

    # Update in-memory state + audit log per action
    for action, result in zip(decision.actions, results):
        await _apply_result_to_state(state_store, workflow_key, action, result)
        await _audit(audit_log, event, action, result)

    # Compliance-grade audit entry: always record SLA breach with both layers.
    if event.event_type == "task.sla_breached":
        p = event.payload or {}
        retry_count = int(p.get("retry_count") or 0)
        operational_action = "Final Escalation"
        if any(a.type == "retry_task" for a in decision.actions):
            operational_action = "Retry"
        entry = AuditEntry(
            event=event.event_type,
            decision=decision.summary,
            target_service=str(p.get("workflow") or ""),
            timestamp=datetime.now(timezone.utc).isoformat(),
            details={
                "task_id": p.get("task_id"),
                "workflow": p.get("workflow"),
                "step": p.get("step"),
                "compliance_action": "Escalated",
                "operational_action": operational_action,
                "retry_count": retry_count,
                "reason": p.get("reason"),
                "source_service": event.source_service,
            },
        )
        await audit_log.append(entry)
        logger.info(json.dumps({"event": entry.event, "decision": entry.decision, "target_service": entry.target_service, "timestamp": entry.timestamp, "details": entry.details}, ensure_ascii=False))

    # Return a clean decision payload
    return DecisionResponse(
        event_id=event_id,
        workflow_key=workflow_key,
        decision_summary=decision.summary,
        actions=[_action_to_dict(a) for a in decision.actions],
        results=[_result_to_dict(r) for r in results],
        decision_time_ms=decision_time_ms,
    )


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "service": "global-orchestrator"}


def _action_to_dict(a: WorkflowAction) -> dict[str, Any]:
    return {
        "type": a.type,
        "target_service": a.target_service,
        "description": a.description,
        "payload": a.payload,
    }


def _result_to_dict(r: ActionExecutionResult) -> dict[str, Any]:
    return {
        "action_type": r.action_type,
        "target_service": r.target_service,
        "ok": r.ok,
        "status_code": r.status_code,
        "response_json": r.response_json,
        "error": r.error,
    }


async def _apply_result_to_state(
    store: InMemoryWorkflowStateStore,
    key: str,
    action: WorkflowAction,
    result: ActionExecutionResult,
) -> None:
    if action.type in ("trigger_procurement", "trigger_onboarding", "trigger_contract"):
        run_id = None
        if isinstance(result.response_json, dict):
            run_id = result.response_json.get("run_id")
        if isinstance(run_id, str) and run_id:
            await store.update_run(
                key=key,
                service=action.target_service or "unknown",
                run_id=run_id,
                status="started" if result.ok else "error",
            )

    if action.type == "update_meeting_task" and not result.ok:
        await store.set_flag(key=key, flag="meeting_task_update_failed", value=True)

    if action.type == "noop" and action.description.startswith("No-op (requires human escalation)"):
        await store.set_flag(key=key, flag="requires_human", value=True)

    if action.type in ("compliance_escalate", "final_escalation"):
        # Compliance tracking for SLA breaches.
        task_id = None
        if isinstance(action.payload, dict):
            task_id = action.payload.get("task_id")
        await store.set_flag(key=key, flag="sla_escalated", value=True)
        if isinstance(task_id, str) and task_id:
            await store.set_flag(key=key, flag="sla_task_id", value=task_id)


async def _audit(
    audit_log: InMemoryAuditLog,
    event: Event,
    action: WorkflowAction,
    result: ActionExecutionResult,
) -> None:
    decision_text = f"{action.description} ({'ok' if result.ok else 'failed'})"
    entry = AuditEntry(
        event=event.event_type,
        decision=decision_text,
        target_service=action.target_service,
        timestamp=datetime.now(timezone.utc).isoformat(),
        details={
            "source_service": event.source_service,
            "action_type": action.type,
            "ok": result.ok,
            "status_code": result.status_code,
            "error": result.error,
        },
    )
    await audit_log.append(entry)

    # Structured JSON log for auditability
    logger.info(
        json.dumps(
            {
                "event": entry.event,
                "decision": entry.decision,
                "target_service": entry.target_service,
                "timestamp": entry.timestamp,
                "details": entry.details,
            },
            ensure_ascii=False,
        )
    )
