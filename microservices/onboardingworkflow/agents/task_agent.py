from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Literal, Tuple

from state.schema import OnboardingState
from utils.logger import audit_log


StepDecision = Literal["pending", "completed", "failed", "escalated"]


def _has_escalation(state: OnboardingState, escalation_type: str) -> bool:
    for e in state.get("escalations", []) or []:
        if str(e.get("type", "")) == escalation_type:
            return True
    return False


def _compute_task_statuses(state: OnboardingState) -> List[Tuple[str, StepDecision, str]]:
    """Derive task status in a lightweight way.

    We keep the central state schema minimal (per spec) and represent task progress
    via audit log entries.
    """

    tasks: List[Tuple[str, StepDecision, str]] = []

    tasks.append(("New Hire Created", "completed" if state.get("status") != "" else "pending", "HR validation"))

    if _has_escalation(state, "account_creation"):
        tasks.append(("Account Creation", "escalated", "Escalated to HR"))
    elif state.get("account_created") is True:
        tasks.append(("Account Creation", "completed", "System account"))
    else:
        tasks.append(("Account Creation", "pending", "Waiting for IT account"))

    if _has_escalation(state, "asset_assignment"):
        tasks.append(("Asset Assignment", "escalated", "Escalated to HR"))
    elif state.get("asset_assigned") is True:
        tasks.append(("Asset Assignment", "completed", "Laptop assignment"))
    else:
        tasks.append(("Asset Assignment", "pending", "Waiting for laptop"))

    if state.get("orientation_scheduled") is True:
        tasks.append(("Orientation Scheduling", "completed", "Orientation"))
    else:
        tasks.append(("Orientation Scheduling", "pending", "Waiting to schedule"))

    if state.get("status") in {"completed", "recovered"}:
        tasks.append(("Completion", "completed", "Workflow complete"))
    elif state.get("status") in {"failed"}:
        tasks.append(("Completion", "failed", "Needs attention"))
    else:
        tasks.append(("Completion", "pending", "Not finished"))

    return tasks


async def task_agent(state: OnboardingState) -> Dict[str, Any]:
    """Task Agent: tracks and logs step-by-step task status."""

    agent = "Task Agent"
    step = "Task Update"

    tasks = _compute_task_statuses(state)

    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Info",
        reason="Task state updated",
        meta={"tasks": [{"step": s, "status": st, "detail": d} for (s, st, d) in tasks]},
    )
    return state


async def orientation_agent(state: OnboardingState) -> Dict[str, Any]:
    """Orientation step (kept lightweight and async)."""

    agent = "Task Agent"
    step = "Orientation Scheduling"

    if state.get("orientation_scheduled") is True:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Info",
            reason="Orientation already scheduled; skipping",
        )
        return state

    await asyncio.sleep(0.10)
    state["orientation_scheduled"] = True
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Success",
        reason="Orientation scheduled successfully",
    )
    return state


async def completion_agent(state: OnboardingState) -> Dict[str, Any]:
    """Final completion step."""

    agent = "Task Agent"
    step = "Completion"

    # Final status rules:
    # - failed: any unresolved failure (missing required outputs OR escalations)
    # - recovered: all required outputs present but at least one recovery occurred
    # - completed: all required outputs present with no failures/retries
    all_required = bool(state.get("account_created")) and bool(state.get("asset_assigned")) and bool(
        state.get("orientation_scheduled")
    )

    has_escalations = bool(state.get("escalations"))
    recovered = any(bool(v) for v in (state.get("recovery_flags") or {}).values())
    used_retries = any(int(v) > 0 for v in (state.get("retry_counts") or {}).values())

    if not all_required or has_escalations:
        state["status"] = "failed"
    elif recovered or used_retries:
        state["status"] = "recovered"
    else:
        state["status"] = "completed"
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Success",
        reason=f"Onboarding workflow finished with status '{state['status']}'",
        meta={
            "retry_counts": state.get("retry_counts", {}),
            "recovery_flags": state.get("recovery_flags", {}),
            "escalations": state.get("escalations", []),
        },
    )
    return state
