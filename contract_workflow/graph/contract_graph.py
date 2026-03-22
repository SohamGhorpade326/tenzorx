from __future__ import annotations

import asyncio
from typing import Literal

from langgraph.graph import END, START, StateGraph

from contract_workflow.agents.approval_agent import approval_agent
from contract_workflow.agents.draft_agent import draft_agent
from contract_workflow.agents.monitoring_agent import (
    MAX_APPROVAL_RETRIES,
    MAX_SIGNING_RETRIES,
    monitoring_approval_agent,
    monitoring_signing_agent,
)
from contract_workflow.agents.review_agent import review_agent
from contract_workflow.agents.verification_agent import verification_agent
from contract_workflow.state.schema import ContractState
from contract_workflow.utils.logger import audit_log


async def storage_step(state: ContractState) -> ContractState:
    """Store Contract step (graph node, not an agent module)."""

    agent = "Storage"
    step = "Store Contract"

    await asyncio.sleep(0.05)

    if state.get("stored") is True:
        audit_log(state, step=step, agent=agent, decision="Info", reason="Already stored; skipping")
        return state

    if state.get("approved") is True and state.get("signed") is True:
        state["stored"] = True
        audit_log(state, step=step, agent=agent, decision="Success", reason="Stored successfully")
    else:
        state["stored"] = False
        audit_log(
            state,
            step=step,
            agent=agent,
            decision="Failure",
            reason="Cannot store: missing approval or signature",
            meta={"approved": state.get("approved"), "signed": state.get("signed")},
        )

    return state


async def completion_step(state: ContractState) -> ContractState:
    """Compute final status: completed / recovered / failed."""

    agent = "System"
    step = "Complete Workflow"

    all_required = (
        bool(state.get("draft_created"))
        and bool(state.get("review_completed"))
        and bool(state.get("approved"))
        and bool(state.get("signed"))
        and bool(state.get("stored"))
    )

    has_escalations = bool(state.get("escalations"))
    used_retries = any(int(v) > 0 for v in (state.get("retry_counts") or {}).values())

    if not all_required or has_escalations:
        state["status"] = "failed"
    elif used_retries:
        state["status"] = "recovered"
    else:
        state["status"] = "completed"

    audit_log(
        state,
        step=step,
        agent=agent,
        decision="Success",
        reason=f"Workflow finished with status '{state['status']}'",
        meta={"retry_counts": state.get("retry_counts", {}), "escalations": state.get("escalations", [])},
    )

    return state


def _route_after_approval_monitor(state: ContractState) -> Literal["retry", "escalate", "continue"]:
    if state.get("approved") is True:
        return "continue"
    retries = int((state.get("retry_counts") or {}).get("approval", 0))
    if retries > MAX_APPROVAL_RETRIES:
        return "escalate"
    return "retry"


def _route_after_signing_monitor(state: ContractState) -> Literal["retry", "escalate", "continue"]:
    if state.get("signed") is True:
        return "continue"
    retries = int((state.get("retry_counts") or {}).get("signing", 0))
    if retries > MAX_SIGNING_RETRIES:
        return "escalate"
    return "retry"


def build_contract_workflow():
    g: StateGraph[ContractState] = StateGraph(ContractState)

    g.add_node("draft", draft_agent)
    g.add_node("review", review_agent)
    g.add_node("approval", approval_agent)
    g.add_node("monitor_approval", monitoring_approval_agent)
    g.add_node("verification", verification_agent)
    g.add_node("monitor_signing", monitoring_signing_agent)
    g.add_node("storage", storage_step)
    g.add_node("complete", completion_step)

    g.add_edge(START, "draft")
    g.add_edge("draft", "review")
    g.add_edge("review", "approval")

    # Approval loop
    g.add_edge("approval", "monitor_approval")
    g.add_conditional_edges(
        "monitor_approval",
        _route_after_approval_monitor,
        {
            "retry": "approval",
            "escalate": "verification",  # move forward but keep escalation recorded
            "continue": "verification",
        },
    )

    # Signing loop (verification step attempts signing and verifies it)
    g.add_edge("verification", "monitor_signing")
    g.add_conditional_edges(
        "monitor_signing",
        _route_after_signing_monitor,
        {
            "retry": "verification",
            "escalate": "storage",  # move forward but keep escalation recorded
            "continue": "storage",
        },
    )

    g.add_edge("storage", "complete")
    g.add_edge("complete", END)

    return g.compile()
