from __future__ import annotations

import json
from typing import List, Tuple

import gradio as gr

from contract_workflow.graph.contract_graph import build_contract_workflow
from contract_workflow.state.schema import ContractState


_WORKFLOW = build_contract_workflow()


def _status_badge(status: str) -> str:
    normalized = (status or "").lower()
    if normalized == "completed":
        color = "#16a34a"  # green
    elif normalized == "recovered":
        color = "#ca8a04"  # yellow
    elif normalized == "failed":
        color = "#dc2626"  # red
    else:
        color = "#64748b"  # gray
    label = status or "(not started)"
    return f"<span style='display:inline-block;padding:2px 10px;border-radius:999px;background:{color};color:white;font-weight:600;'> {label} </span>"


def _derive_steps(state: ContractState) -> List[List[str]]:
    def row(name: str, ok: bool, detail_ok: str, detail_pending: str) -> List[str]:
        return [name, "completed" if ok else "pending", detail_ok if ok else detail_pending]

    rows: List[List[str]] = []
    rows.append(row("Draft", bool(state.get("draft_created")), "Draft created", "Waiting"))
    rows.append(row("Review", bool(state.get("review_completed")), "Reviewed", "Waiting"))
    rows.append(row("Approval", bool(state.get("approved")), "Approved", "Waiting"))
    rows.append(row("Signing", bool(state.get("signed")), "Signed", "Waiting"))
    rows.append(row("Storage", bool(state.get("stored")), "Stored", "Waiting"))
    return rows


def _last_step(state: ContractState) -> str:
    logs = state.get("logs") or []
    return str(logs[-1].get("step")) if logs else "(starting)"


def _render(state: ContractState):
    status = state.get("status") or "(not started)"
    badge = _status_badge(status)
    status_md = f"## ✅ Workflow Status\n{badge}\n\n**Last Step:** {_last_step(state)}"

    table = _derive_steps(state)
    retries = state.get("retry_counts", {})
    escalations = state.get("escalations", [])
    logs = state.get("logs", [])

    retries_json = json.loads(json.dumps(retries, default=str))
    escalations_json = json.loads(json.dumps(escalations, default=str))
    logs_json = json.loads(json.dumps(logs, default=str))

    return status_md, table, retries_json, escalations_json, logs_json


async def start_contract_workflow(contract_id: str):
    initial_state: ContractState = {
        "contract_id": contract_id,
        "draft_created": False,
        "review_completed": False,
        "approved": False,
        "signed": False,
        "stored": False,
        "status": "",
        "retry_counts": {"approval": 0, "signing": 0},
        "escalations": [],
        "logs": [],
    }

    async for state in _WORKFLOW.astream(initial_state, stream_mode="values"):
        yield _render(state)


def build_ui() -> gr.Blocks:
    with gr.Blocks() as demo:
        gr.Markdown("# Contract / Approval Workflow (LangGraph)\nDeterministic workflow orchestration with retries, escalation, and audit logs.")

        contract_id = gr.Textbox(label="Contract ID", placeholder="C-10001")
        start_btn = gr.Button("Start Contract Workflow", variant="primary")

        status_out = gr.Markdown(label="Workflow Status")
        steps_out = gr.Dataframe(
            label="Step-by-step Status",
            headers=["Step", "Status", "Detail"],
            datatype=["str", "str", "str"],
            row_count=(5, "fixed"),
            column_count=(3, "fixed"),
        )
        retries_out = gr.JSON(label="Retry Counts")
        escalations_out = gr.JSON(label="Escalation Alerts")
        logs_out = gr.JSON(label="Audit Logs")

        start_btn.click(
            fn=start_contract_workflow,
            inputs=[contract_id],
            outputs=[status_out, steps_out, retries_out, escalations_out, logs_out],
            api_name="start_contract_workflow",
        )

    return demo


def launch():
    ui = build_ui()
    ui.queue(default_concurrency_limit=16).launch()
