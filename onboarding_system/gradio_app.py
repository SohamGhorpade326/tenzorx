from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple

import gradio as gr

from onboarding_system.graph.workflow_graph import build_workflow
from onboarding_system.state.schema import OnboardingState


_WORKFLOW = build_workflow()


def _derive_tasks(state: OnboardingState) -> List[List[str]]:
    """Compute step-by-step task status (pending/completed/failed).

    Kept deterministic and rule-based to avoid extra calls/overhead.
    """

    def status_for(flag: bool, *, pending_msg: str) -> Tuple[str, str]:
        return ("completed", "") if flag else ("pending", pending_msg)

    def has_escalation(escalation_type: str) -> bool:
        for e in state.get("escalations", []) or []:
            if str(e.get("type", "")) == escalation_type:
                return True
        return False

    rows: List[List[str]] = []

    rows.append(["New Hire Created", "completed" if state.get("status") else "pending", "HR validation"])

    if has_escalation("account_creation"):
        rows.append(["Account Creation", "escalated", "Escalated to HR"])
    else:
        s, detail = status_for(bool(state.get("account_created")), pending_msg="Waiting for account")
        rows.append(["Account Creation", s, detail or "System account ready"])

    if has_escalation("asset_assignment"):
        rows.append(["Asset Assignment", "escalated", "Escalated to HR"])
    else:
        s, detail = status_for(bool(state.get("asset_assigned")), pending_msg="Waiting for laptop")
        rows.append(["Asset Assignment", s, detail or "Laptop assigned"])

    s, detail = status_for(bool(state.get("orientation_scheduled")), pending_msg="Waiting to schedule")
    rows.append(["Orientation Scheduling", s, detail or "Orientation scheduled"])

    if state.get("status") == "completed":
        rows.append(["Completion", "completed", "Workflow complete"])
    elif state.get("status") in {"failed", "escalated"}:
        rows.append(["Completion", "failed", "Needs attention"])
    else:
        rows.append(["Completion", "pending", "Not finished"])

    return rows


def _last_step(state: OnboardingState) -> str:
    logs = state.get("logs") or []
    if not logs:
        return "(starting)"
    return str(logs[-1].get("step") or "(unknown)")


def _status_badge(status: str) -> str:
    # Minimal HTML styling for a clear badge. (Gradio Markdown supports basic HTML.)
    normalized = (status or "").lower()
    if normalized == "completed":
        color = "#16a34a"  # green
    elif normalized == "recovered":
        color = "#ca8a04"  # yellow
    elif normalized == "failed":
        color = "#dc2626"  # red
    else:
        color = "#64748b"  # gray
    return f"<span style='display:inline-block;padding:2px 10px;border-radius:999px;background:{color};color:white;font-weight:600;'> {status or '(not started)'} </span>"


def _render(state: OnboardingState):
    status = state.get("status") or "(not started)"
    step = _last_step(state)

    badge = _status_badge(status)
    status_md = f"## ✅ Final Status\n{badge}\n\n**Last Step:** {step}"
    tasks = _derive_tasks(state)
    failures = state.get("failures", [])
    logs = state.get("logs", [])
    retry_counts = state.get("retry_counts", {})
    escalations = state.get("escalations", [])
    recovery_flags = state.get("recovery_flags", {})

    recovery_summary = {
        "account_creation": "Recovered after retry" if recovery_flags.get("account_creation") else "No recovery",
        "asset_assignment": "Recovered after retry" if recovery_flags.get("asset_assignment") else "No recovery",
    }

    # Make JSON display stable and readable.
    failures_json = json.loads(json.dumps(failures, default=str))
    logs_json = json.loads(json.dumps(logs, default=str))
    retries_json = json.loads(json.dumps(retry_counts, default=str))
    escalations_json = json.loads(json.dumps(escalations, default=str))
    recovery_json = json.loads(json.dumps({"flags": recovery_flags, "summary": recovery_summary}, default=str))

    return status_md, tasks, failures_json, retries_json, escalations_json, recovery_json, logs_json


async def start_onboarding(employee_name: str, employee_id: str):
    """Gradio streaming function: yields UI updates after each graph node."""

    initial_state: OnboardingState = {
        "employee_id": employee_id,
        "name": employee_name,
        "account_created": False,
        "asset_assigned": False,
        "orientation_scheduled": False,
        "status": "",
        "retry_counts": {"account_creation": 0, "asset_assignment": 0},
        "escalations": [],
        "recovery_flags": {"account_creation": False, "asset_assignment": False},
        "logs": [],
        "failures": [],
    }

    async for state in _WORKFLOW.astream(initial_state, stream_mode="values"):
        # state is the latest shared state after each node.
        yield _render(state)


def build_ui() -> gr.Blocks:
    with gr.Blocks() as demo:
        gr.Markdown("# Employee Onboarding Workflow (LangGraph)\nDeterministic multi-agent workflow with self-healing and audit trail.")

        with gr.Row():
            employee_name = gr.Textbox(label="Employee Name", placeholder="Jane Doe")
            employee_id = gr.Textbox(label="Employee ID", placeholder="E-10023")

        start_btn = gr.Button("Start Onboarding", variant="primary")

        status_out = gr.Markdown(label="Final Status")
        tasks_out = gr.Dataframe(
            label="Task Status (step-by-step)",
            headers=["Step", "Status", "Detail"],
            datatype=["str", "str", "str"],
            row_count=(5, "fixed"),
            column_count=(3, "fixed"),
        )
        failures_out = gr.JSON(label="Failure Alerts")
        retries_out = gr.JSON(label="🔁 Retry Attempts")
        escalations_out = gr.JSON(label="🚨 Escalation Alerts")
        recovery_out = gr.JSON(label="🔄 Recovery Status")
        logs_out = gr.JSON(label="Audit Logs")

        start_btn.click(
            fn=start_onboarding,
            inputs=[employee_name, employee_id],
            outputs=[status_out, tasks_out, failures_out, retries_out, escalations_out, recovery_out, logs_out],
            api_name="start_onboarding",
        )

    return demo


def launch():
    ui = build_ui()
    # queue=True enables streaming yields.
    ui.queue(default_concurrency_limit=16).launch()
