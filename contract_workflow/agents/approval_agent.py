from __future__ import annotations

import asyncio
import random
from typing import Any, Dict

from contract_workflow.state.schema import ContractState
from contract_workflow.utils.logger import audit_log


async def approval_agent(state: ContractState) -> Dict[str, Any]:
    """Approval Agent: attempts to approve the contract.

    Failure case: "stuck in approval" (simulated random failure).
    """

    agent = "Approval Agent"
    step = "Approve Contract"

    state.setdefault("retry_counts", {"approval": 0, "signing": 0})

    if state.get("approved") is True:
        audit_log(state, step=step, agent=agent, decision="Info", reason="Already approved; skipping")
        return state

    await asyncio.sleep(0.08)

    # Simulate occasional stuck approvals.
    success = random.random() > 0.30

    if success:
        prior_retries = int(state["retry_counts"].get("approval", 0))
        state["approved"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Recovered" if prior_retries > 0 else "Success",
            reason=("Approved after retry" if prior_retries > 0 else "Approved"),
            retry_count=prior_retries,
        )
    else:
        state["approved"] = False
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Failure",
            reason="Approval stuck (simulated)",
        )

    return state
