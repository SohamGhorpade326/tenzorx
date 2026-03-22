from __future__ import annotations

import asyncio
import random
from typing import Any, Dict

from state.schema import OnboardingState
from utils.logger import audit_log


# Lightweight in-memory caches to avoid repeated work/latency.
# In a real system these would be external (Redis/DB) with TTL.
_ACCOUNT_CACHE: dict[str, bool] = {}
_ASSET_CACHE: dict[str, bool] = {}


async def it_create_account_agent(state: OnboardingState) -> Dict[str, Any]:
    """IT Agent: create system account (simulated, with random failure)."""

    agent = "IT Agent"
    step = "Account Creation"
    employee_id = state["employee_id"]
    retry_counts = state.setdefault("retry_counts", {"account_creation": 0, "asset_assignment": 0})
    recovery_flags = state.setdefault("recovery_flags", {"account_creation": False, "asset_assignment": False})

    if state.get("account_created") is True:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Info",
            reason="Account already created; skipping",
        )
        return state

    cached = _ACCOUNT_CACHE.get(employee_id)
    if cached is True:
        state["account_created"] = True
        if int(retry_counts.get("account_creation", 0)) > 0:
            recovery_flags["account_creation"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Recovered" if int(retry_counts.get("account_creation", 0)) > 0 else "Success",
            reason=(
                "Account created successfully after retry (cache)"
                if int(retry_counts.get("account_creation", 0)) > 0
                else "Account creation reused from cache"
            ),
        )
        return state

    # Simulated fast async work (keep per-step latency low).
    await asyncio.sleep(0.15)

    # Demo failure rate (tune as needed).
    success = random.random() > 0.25

    if success:
        state["account_created"] = True
        _ACCOUNT_CACHE[employee_id] = True
        if int(retry_counts.get("account_creation", 0)) > 0:
            recovery_flags["account_creation"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Recovered" if int(retry_counts.get("account_creation", 0)) > 0 else "Success",
            reason=(
                "Account created successfully after retry"
                if int(retry_counts.get("account_creation", 0)) > 0
                else "Account created successfully"
            ),
        )
        return state

    state["account_created"] = False
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Failure",
        reason="Transient directory service error (simulated)",
    )
    return state


async def it_assign_asset_agent(state: OnboardingState) -> Dict[str, Any]:
    """IT Agent: assign laptop/asset (simulated, with random failure)."""

    agent = "IT Agent"
    step = "Asset Assignment"
    employee_id = state["employee_id"]
    retry_counts = state.setdefault("retry_counts", {"account_creation": 0, "asset_assignment": 0})
    recovery_flags = state.setdefault("recovery_flags", {"account_creation": False, "asset_assignment": False})

    if state.get("asset_assigned") is True:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Info",
            reason="Asset already assigned; skipping",
        )
        return state

    cached = _ASSET_CACHE.get(employee_id)
    if cached is True:
        state["asset_assigned"] = True
        if int(retry_counts.get("asset_assignment", 0)) > 0:
            recovery_flags["asset_assignment"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Recovered" if int(retry_counts.get("asset_assignment", 0)) > 0 else "Success",
            reason=(
                "Asset assigned successfully after retry (cache)"
                if int(retry_counts.get("asset_assignment", 0)) > 0
                else "Asset assignment reused from cache"
            ),
        )
        return state

    await asyncio.sleep(0.15)

    # Slightly lower failure rate than account creation.
    success = random.random() > 0.20

    if success:
        state["asset_assigned"] = True
        _ASSET_CACHE[employee_id] = True
        if int(retry_counts.get("asset_assignment", 0)) > 0:
            recovery_flags["asset_assignment"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Recovered" if int(retry_counts.get("asset_assignment", 0)) > 0 else "Success",
            reason=(
                "Laptop assigned successfully after retry"
                if int(retry_counts.get("asset_assignment", 0)) > 0
                else "Laptop assigned successfully"
            ),
        )
        return state

    state["asset_assigned"] = False
    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Failure",
        reason="Inventory system timeout (simulated)",
    )
    return state
