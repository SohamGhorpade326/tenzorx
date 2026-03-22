from __future__ import annotations

import re
from typing import Any, Dict

from state.schema import OnboardingState
from utils.logger import audit_log, record_failure
from agents.monitoring_agent import MAX_ACCOUNT_RETRIES, MAX_ASSET_RETRIES


_EMPLOYEE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{3,64}$")


def _validate_employee_inputs(employee_id: str, name: str) -> str | None:
    if not employee_id or not _EMPLOYEE_ID_RE.match(employee_id):
        return "employee_id must be 3-64 chars of letters/numbers/_-"
    if not name or len(name.strip()) < 2:
        return "name must be at least 2 characters"
    return None


async def hr_agent(state: OnboardingState) -> Dict[str, Any]:
    """HR Agent: validates employee data and initializes onboarding."""

    agent = "HR Agent"
    step = "New Hire Created"

    # Ensure required containers exist even when validation fails early.
    state.setdefault("logs", [])
    state.setdefault("failures", [])
    state.setdefault(
        "retry_counts",
        {
            "account_creation": 0,
            "asset_assignment": 0,
        },
    )
    state.setdefault("escalations", [])
    state.setdefault(
        "recovery_flags",
        {
            "account_creation": False,
            "asset_assignment": False,
        },
    )

    validation_error = _validate_employee_inputs(state["employee_id"], state["name"])
    if validation_error:
        record_failure(
            state,
            failure_type="validation",
            step=step,
            agent=agent,
            reason=validation_error,
        )
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Failure",
            reason=validation_error,
        )
        state["status"] = "failed"
        return state

    # Initialize / normalize state fields.
    state["account_created"] = bool(state.get("account_created", False))
    state["asset_assigned"] = bool(state.get("asset_assigned", False))
    state["orientation_scheduled"] = bool(state.get("orientation_scheduled", False))

    state["status"] = "in_progress"
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Success",
        reason="Employee record validated and onboarding initiated",
        meta={"employee_id": state["employee_id"], "name": state["name"]},
    )
    return state


async def hr_escalation_agent(state: OnboardingState) -> Dict[str, Any]:
    """HR Agent escalation handler.

    Called when automated retries have been exhausted.
    """

    agent = "HR Agent"
    step = "Escalation"

    state.setdefault("escalations", [])

    escalation_type = "unknown"
    escalation_step = "Unknown"
    retry_counts = state.get("retry_counts", {})

    if state.get("account_created") is not True and int(retry_counts.get("account_creation", 0)) > MAX_ACCOUNT_RETRIES:
        escalation_type = "account_creation"
        escalation_step = "Account Creation"
    elif state.get("asset_assigned") is not True and int(retry_counts.get("asset_assignment", 0)) > MAX_ASSET_RETRIES:
        escalation_type = "asset_assignment"
        escalation_step = "Asset Assignment"

    state["escalations"].append(
        {
            "type": escalation_type,
            "step": escalation_step,
            "agent": agent,
            "reason": "Automated retries exceeded; manual intervention required",
        }
    )

    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Escalated",
        reason="Automated retries exceeded; manual intervention required",
        meta={
            "type": escalation_type,
            "escalation_step": escalation_step,
            "retry_counts": state.get("retry_counts", {}),
        },
    )
    return state
