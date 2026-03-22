from __future__ import annotations

import asyncio
import random
from typing import Any, Dict

from contract_workflow.state.schema import ContractState
from contract_workflow.utils.logger import audit_log


async def verification_agent(state: ContractState) -> Dict[str, Any]:
    """Verification Agent: ensures the contract is signed and valid.

    Failure case: missing signature (simulated).

    For simplicity (and to keep agent list minimal), this node also performs
    a signing attempt if not already signed.
    """

    agent = "Verification Agent"
    step = "Sign Contract"

    state.setdefault("retry_counts", {"approval": 0, "signing": 0})

    if state.get("signed") is True:
        audit_log(state, step=step, agent=agent, decision="Info", reason="Already signed; skipping")
        return state

    await asyncio.sleep(0.08)

    success = random.random() > 0.25

    if success:
        prior_retries = int(state["retry_counts"].get("signing", 0))
        state["signed"] = True
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Recovered" if prior_retries > 0 else "Success",
            reason=("Signed after retry" if prior_retries > 0 else "Signed"),
            retry_count=prior_retries,
        )
    else:
        state["signed"] = False
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Failure",
            reason="Missing signature (simulated)",
        )

    return state
