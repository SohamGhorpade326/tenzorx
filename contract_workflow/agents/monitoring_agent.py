from __future__ import annotations

from typing import Any, Dict, Literal

from contract_workflow.state.schema import ContractState
from contract_workflow.utils.logger import audit_log, record_escalation


MAX_APPROVAL_RETRIES = 2
MAX_SIGNING_RETRIES = 2


def _inc_retry(state: ContractState, key: Literal["approval", "signing"]) -> int:
    state.setdefault("retry_counts", {"approval": 0, "signing": 0})
    state["retry_counts"][key] = int(state["retry_counts"].get(key, 0)) + 1
    return int(state["retry_counts"][key])


async def monitoring_approval_agent(state: ContractState) -> Dict[str, Any]:
    """Monitoring Agent: detects stuck approval and triggers retry/reminder/escalation."""

    agent = "Monitoring Agent"
    step = "Approval"

    if state.get("approved") is True:
        audit_log(state, step=step, agent=agent, decision="Success", reason="Approval verified")
        return state

    retry_count = _inc_retry(state, "approval")

    # Reminder before escalation on the final attempt.
    if retry_count == MAX_APPROVAL_RETRIES:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Reminder",
            reason="Approval pending - sending reminder before escalation",
            retry_count=retry_count,
        )
        return state

    if retry_count <= MAX_APPROVAL_RETRIES:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Retry",
            reason="Approval not completed - retrying",
            retry_count=retry_count,
        )
        return state

    record_escalation(
        state,
        escalation_type="approval",
        step=step,
        agent=agent,
        reason="Approval stuck after retries - escalated to manager",
        retry_count=retry_count,
    )
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Escalated",
        reason="Approval stuck after retries - escalated to manager",
        retry_count=retry_count,
    )
    return state


async def monitoring_signing_agent(state: ContractState) -> Dict[str, Any]:
    """Monitoring Agent: detects missing signature and triggers retry/reminder/escalation."""

    agent = "Monitoring Agent"
    step = "Signing"

    if state.get("signed") is True:
        audit_log(state, step=step, agent=agent, decision="Success", reason="Signature verified")
        return state

    retry_count = _inc_retry(state, "signing")

    if retry_count == MAX_SIGNING_RETRIES:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Reminder",
            reason="Signature missing - sending reminder before escalation",
            retry_count=retry_count,
        )
        return state

    if retry_count <= MAX_SIGNING_RETRIES:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Retry",
            reason="Signature missing - retrying signing",
            retry_count=retry_count,
        )
        return state

    record_escalation(
        state,
        escalation_type="signing",
        step=step,
        agent=agent,
        reason="Missing signature after retries - escalated to manager",
        retry_count=retry_count,
    )
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Escalated",
        reason="Missing signature after retries - escalated to manager",
        retry_count=retry_count,
    )
    return state
