from __future__ import annotations

import asyncio
from typing import Any, Dict

from contract_workflow.state.schema import ContractState
from contract_workflow.utils.logger import audit_log


async def draft_agent(state: ContractState) -> Dict[str, Any]:
    """Draft Agent: creates or refreshes a contract draft (simulated)."""

    agent = "Draft Agent"
    step = "Draft Contract"

    state.setdefault("logs", [])
    state.setdefault("retry_counts", {"approval": 0, "signing": 0})
    state.setdefault("escalations", [])

    # Keep latency low.
    await asyncio.sleep(0.05)

    if state.get("draft_created"):
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Info",
            reason="Draft already exists; refreshing metadata",
        )
    else:
        state["draft_created"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Success",
            reason="Draft created",
        )

    state["status"] = "in_progress"
    return state
