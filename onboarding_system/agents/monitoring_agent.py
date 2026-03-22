from __future__ import annotations

from typing import Any, Dict

from onboarding_system.state.schema import OnboardingState
from onboarding_system.utils.logger import audit_log, record_failure


MAX_ACCOUNT_RETRIES = 2
MAX_ASSET_RETRIES = 2


def _inc_retry(state: OnboardingState, key: str) -> int:
    state.setdefault(
        "retry_counts",
        {
            "account_creation": 0,
            "asset_assignment": 0,
        },
    )
    state["retry_counts"][key] = int(state["retry_counts"].get(key, 0)) + 1
    return int(state["retry_counts"][key])


async def monitoring_account_agent(state: OnboardingState) -> Dict[str, Any]:
    """Monitoring Agent: checks account creation outcome and updates retry/escalation tracking."""

    agent = "Monitoring Agent"
    step = "Monitoring Check"

    if state.get("account_created") is True:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Success",
            reason="Account present; continuing",
            meta={"check": "account_creation"},
        )
        return state

    retry_count = _inc_retry(state, "account_creation")
    record_failure(
        state,
        failure_type="account_creation",
        step="Account Creation",
        agent=agent,
        reason="Account not created",
        increment=1,
    )

    if retry_count <= MAX_ACCOUNT_RETRIES:
        audit_log(
            state,
            step="Account Creation",
            agent=agent,
            decision="Retry",
            reason="Account not created - retrying",
            retry_count=retry_count,
        )
        return state

    audit_log(
        state,
        step="Account Creation",
        agent=agent,
        decision="Escalated",
        reason="Multiple failures, escalated to HR",
        retry_count=retry_count,
    )
    return state


async def monitoring_asset_agent(state: OnboardingState) -> Dict[str, Any]:
    """Monitoring Agent: checks asset assignment outcome and updates retry/escalation tracking."""

    agent = "Monitoring Agent"
    step = "Monitoring Check"

    if state.get("asset_assigned") is True:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Success",
            reason="Asset present; continuing",
            meta={"check": "asset_assignment"},
        )
        return state

    retry_count = _inc_retry(state, "asset_assignment")
    record_failure(
        state,
        failure_type="asset_assignment",
        step="Asset Assignment",
        agent=agent,
        reason="Laptop not assigned",
        increment=1,
    )

    if retry_count <= MAX_ASSET_RETRIES:
        audit_log(
            state,
            step="Asset Assignment",
            agent=agent,
            decision="Retry",
            reason="Laptop not assigned - retrying",
            retry_count=retry_count,
        )
        return state

    audit_log(
        state,
        step="Asset Assignment",
        agent=agent,
        decision="Escalated",
        reason="Multiple failures, escalated to HR",
        retry_count=retry_count,
    )
    return state
