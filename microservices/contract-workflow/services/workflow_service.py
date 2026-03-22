"""
Service layer for executing contract workflows.

Wraps the existing LangGraph workflow (graph/contract_graph.py)
and persists run state + logs to SQLite.
"""
from __future__ import annotations

import asyncio
import json
import threading
import traceback
import uuid
from typing import Any

from graph.contract_graph import build_contract_workflow
from state.schema import ContractState
from db.db import create_run, update_run, append_log


# Build once, reuse across requests.
_WORKFLOW = build_contract_workflow()


def _build_initial_state(contract_id: str) -> ContractState:
    """Construct the initial state dict expected by the graph."""
    return ContractState(
        contract_id=contract_id,
        draft_created=False,
        review_completed=False,
        approved=False,
        signed=False,
        stored=False,
        status="",
        retry_counts={"approval": 0, "signing": 0},
        escalations=[],
        logs=[],
    )


async def _execute_workflow(run_id: str, state: ContractState) -> None:
    """Stream through the LangGraph workflow and persist logs + final state."""
    last_state: dict[str, Any] = dict(state)

    try:
        async for current_state in _WORKFLOW.astream(state, stream_mode="values"):
            last_state = dict(current_state)

            # Persist any new audit-log entries from the graph
            for log_entry in (current_state.get("logs") or []):
                append_log(
                    run_id,
                    step=log_entry.get("step", ""),
                    agent=log_entry.get("agent", ""),
                    decision=log_entry.get("decision", ""),
                    reason=log_entry.get("reason", ""),
                    meta=log_entry.get("meta"),
                )

        final_status = last_state.get("status", "completed") or "completed"
        update_run(run_id, status=final_status, output=last_state)

    except Exception as exc:
        update_run(
            run_id,
            status="failed",
            error_message=f"{type(exc).__name__}: {exc}",
            output=last_state,
        )
        traceback.print_exc()


def _run_in_thread(run_id: str, state: ContractState) -> None:
    """Execute the async workflow inside a new event loop on a background thread."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_execute_workflow(run_id, state))
    finally:
        loop.close()


def start_contract_run(contract_id: str) -> str:
    """
    Public API: kick off a contract workflow.

    Returns the run_id immediately. The workflow executes
    asynchronously in a background thread.
    """
    run_id = f"con-{uuid.uuid4().hex[:12]}"
    input_payload = {"contract_id": contract_id}

    # Persist the run record first.
    create_run(run_id, input_payload)

    # Build initial state and launch.
    initial_state = _build_initial_state(contract_id)
    thread = threading.Thread(target=_run_in_thread, args=(run_id, initial_state), daemon=True)
    thread.start()

    return run_id
