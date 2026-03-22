from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agents.hr_agent import hr_agent, hr_escalation_agent
from agents.it_agent import it_assign_asset_agent, it_create_account_agent
from agents.monitoring_agent import (
    MAX_ACCOUNT_RETRIES,
    MAX_ASSET_RETRIES,
    monitoring_account_agent,
    monitoring_asset_agent,
)
from agents.task_agent import completion_agent, orientation_agent, task_agent
from state.schema import OnboardingState


def _route_after_hr(state: OnboardingState) -> Literal["continue", "end"]:
    # Validation failure should terminate quickly.
    if state.get("status") == "failed":
        return "end"
    return "continue"


def _route_after_monitor_account(state: OnboardingState) -> Literal["retry", "escalate", "continue"]:
    if state.get("account_created") is True:
        return "continue"
    retries = int((state.get("retry_counts") or {}).get("account_creation", 0))
    if retries > MAX_ACCOUNT_RETRIES:
        return "escalate"
    return "retry"


def _route_after_monitor_asset(state: OnboardingState) -> Literal["retry", "escalate", "continue"]:
    if state.get("asset_assigned") is True:
        return "continue"
    retries = int((state.get("retry_counts") or {}).get("asset_assignment", 0))
    if retries > MAX_ASSET_RETRIES:
        return "escalate"
    return "retry"


def build_workflow():
    """Build and compile the onboarding workflow graph."""

    g: StateGraph[OnboardingState] = StateGraph(OnboardingState)

    g.add_node("hr", hr_agent)
    g.add_node("it_account", it_create_account_agent)
    g.add_node("monitor_account", monitoring_account_agent)
    g.add_node("it_asset", it_assign_asset_agent)
    g.add_node("monitor_asset", monitoring_asset_agent)
    g.add_node("task_after_account", task_agent)
    g.add_node("task_after_escalation_account", task_agent)
    g.add_node("task_after_escalation_asset", task_agent)
    g.add_node("task_after_asset", task_agent)
    g.add_node("task_after_orientation", task_agent)
    g.add_node("orientation", orientation_agent)
    g.add_node("complete", completion_agent)
    g.add_node("hr_escalation_account", hr_escalation_agent)
    g.add_node("hr_escalation_asset", hr_escalation_agent)

    g.add_edge(START, "hr")

    g.add_conditional_edges(
        "hr",
        _route_after_hr,
        {
            "continue": "it_account",
            "end": END,
        },
    )

    # Account creation + monitoring loop
    g.add_edge("it_account", "task_after_account")
    g.add_edge("task_after_account", "monitor_account")
    g.add_conditional_edges(
        "monitor_account",
        _route_after_monitor_account,
        {
            "retry": "it_account",
            "escalate": "hr_escalation_account",
            "continue": "it_asset",
        },
    )

    # If escalated, continue forward but keep state marked.
    g.add_edge("hr_escalation_account", "task_after_escalation_account")
    g.add_edge("task_after_escalation_account", "it_asset")

    # Asset assignment + monitoring loop
    g.add_edge("it_asset", "task_after_asset")
    g.add_edge("task_after_asset", "monitor_asset")
    g.add_conditional_edges(
        "monitor_asset",
        _route_after_monitor_asset,
        {
            "retry": "it_asset",
            "escalate": "hr_escalation_asset",
            "continue": "orientation",
        },
    )

    g.add_edge("hr_escalation_asset", "task_after_escalation_asset")
    g.add_edge("task_after_escalation_asset", "orientation")

    g.add_edge("orientation", "task_after_orientation")
    g.add_edge("task_after_orientation", "complete")
    g.add_edge("complete", END)

    return g.compile()
