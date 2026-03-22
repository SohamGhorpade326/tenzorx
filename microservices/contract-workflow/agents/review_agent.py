from __future__ import annotations

import asyncio
from typing import Any, Dict

from state.schema import ContractState
from utils.logger import audit_log


def _needs_changes(contract_id: str) -> bool:
    """Deterministic rule: IDs ending in 'R' simulate change request."""
    return contract_id.strip().upper().endswith("R")


async def review_agent(state: ContractState) -> Dict[str, Any]:
    """Review Agent: reviews the contract.

    Deterministic: can request changes based on contract_id.
    To keep the overall workflow minimal, we still mark review as completed,
    but record the decision in audit logs.
    """

    agent = "Review Agent"
    step = "Review Contract"

    await asyncio.sleep(0.05)

    state["review_completed"] = True

    if _needs_changes(state["contract_id"]):
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Info",
            reason="Reviewer requested minor changes (simulated); proceeding",
            meta={"changes_requested": True},
        )
    else:
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Success",
            reason="Review completed",
        )

    return state
