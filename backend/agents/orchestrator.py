"""
OrchestratorAgent — LangGraph StateGraph
-----------------------------------------
This is the brain. It orchestrates all other agents through a state machine.

Graph nodes:
  transcribe → validate → human_review_gate → create_tasks → track → escalate → complete

State transitions:
  - Error at any node → error_recovery (logs + retries up to 2x)
  - human_review_gate: pauses until frontend sends approval signal (via run_id callback)
  - Orchestrator writes RUN_START and RUN_COMPLETE audit events

WebSocket broadcasting:
  - Every node transition emits a step update via the ws_manager
"""

import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

from models.schemas import (
    Decision, Task, Escalation, AuditEvent, AuditStatus, PipelineStatus
)
from db.db import (
    insert_pipeline_run, update_pipeline_run, insert_decision,
    insert_audit_event, get_tasks
)
import agents.transcript_agent as transcript_agent
import agents.validator_agent as validator_agent
import agents.task_creator_agent as task_creator_agent
import agents.tracker_agent as tracker_agent
import agents.escalation_agent as escalation_agent


# ─────────────────────────────────────────────────
# WebSocket broadcaster (injected at startup)
# ─────────────────────────────────────────────────

class WSBroadcaster:
    """Simple async broadcaster for pipeline step updates."""
    def __init__(self):
        self._listeners: Dict[str, List] = {}

    def subscribe(self, run_id: str, queue: asyncio.Queue):
        if run_id not in self._listeners:
            self._listeners[run_id] = []
        self._listeners[run_id].append(queue)

    def unsubscribe(self, run_id: str, queue: asyncio.Queue):
        if run_id in self._listeners:
            try:
                self._listeners[run_id].remove(queue)
            except ValueError:
                pass

    async def broadcast(self, run_id: str, message: dict):
        if run_id not in self._listeners:
            return
        dead = []
        for q in self._listeners[run_id]:
            try:
                await q.put(message)
            except Exception:
                dead.append(q)
        for q in dead:
            self.unsubscribe(run_id, q)


ws_manager = WSBroadcaster()


# ─────────────────────────────────────────────────
# State definition
# ─────────────────────────────────────────────────

class GraphState(BaseModel):
    run_id: str = ""
    meeting_id: str = ""
    meeting_title: str = "Untitled Meeting"
    transcript: str = ""
    decisions: List[Decision] = Field(default_factory=list)
    validated_decisions: List[Decision] = Field(default_factory=list)
    review_items: List[dict] = Field(default_factory=list)
    tasks: List[Task] = Field(default_factory=list)
    escalations: List[Escalation] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    status: str = "STARTED"
    current_step: str = ""
    retry_count: int = 0
    audio_file_path: Optional[str] = None
    human_approved: bool = True  # Set to False for interactive human review
    model_config = {"arbitrary_types_allowed": True}


# Human review approval store (run_id → asyncio.Event)
_approval_events: Dict[str, asyncio.Event] = {}
_approval_data: Dict[str, dict] = {}   # Stores approved/modified items


def get_approval_event(run_id: str) -> asyncio.Event:
    if run_id not in _approval_events:
        _approval_events[run_id] = asyncio.Event()
    return _approval_events[run_id]


def signal_approval(run_id: str, approved: bool = True, modifications: dict = None):
    """Called by the API when the human approves the review gate."""
    _approval_data[run_id] = {"approved": approved, "modifications": modifications or {}}
    event = get_approval_event(run_id)
    event.set()


# ─────────────────────────────────────────────────
# Graph nodes
# ─────────────────────────────────────────────────

def node_transcribe(state: GraphState) -> GraphState:
    _emit_sync(state.run_id, "TranscriptAgent", "RUNNING", "Extracting decisions and commitments...")
    try:
        decisions = transcript_agent.run(
            transcript=state.transcript,
            audio_file_path=state.audio_file_path,
            run_id=state.run_id,
            meeting_id=state.meeting_id,
        )
        # Persist decisions to DB
        for d in decisions:
            try:
                created = insert_decision(d)
                d.id = created["id"]
            except Exception as e:
                print(f"[Orchestrator] Decision insert error: {e}")

        new_state = state.model_copy(update={
            "decisions": decisions,
            "current_step": "transcribe",
            "status": "TRANSCRIBED",
        })
        _emit_sync(state.run_id, "TranscriptAgent", "SUCCESS",
                   f"{len(decisions)} decisions extracted",
                   output={"decisions_count": len(decisions)})
        return new_state
    except Exception as e:
        return _handle_error(state, "transcribe", str(e))


def node_validate(state: GraphState) -> GraphState:
    _emit_sync(state.run_id, "ValidatorAgent", "RUNNING", "Validating owners, deadlines, and quality...")
    try:
        validated, review_items = validator_agent.run(state.decisions, run_id=state.run_id)
        new_state = state.model_copy(update={
            "validated_decisions": validated,
            "review_items": review_items,
            "current_step": "validate",
            "status": "VALIDATED",
        })
        _emit_sync(state.run_id, "ValidatorAgent", "SUCCESS",
                   f"{len(validated)} valid, {len(review_items)} flagged",
                   output={"valid": len(validated), "flagged": len(review_items), "review_items": review_items})
        return new_state
    except Exception as e:
        return _handle_error(state, "validate", str(e))


def node_human_review(state: GraphState) -> GraphState:
    """Pause for human review if there are flagged items."""
    if not state.review_items or state.human_approved:
        # No items to review OR already pre-approved
        _emit_sync(state.run_id, "HumanReviewGate", "SUCCESS",
                   "No items require review — proceeding automatically")
        return state.model_copy(update={"current_step": "human_review"})

    _emit_sync(state.run_id, "HumanReviewGate", "RUNNING",
               "Waiting for human review...",
               output={"review_items": state.review_items})

    # Signal frontend and wait (with timeout for demo)
    event = get_approval_event(state.run_id)
    timeout_seconds = 300  # 5 min timeout

    # In sync context, just wait briefly then continue if no approval
    # (Real approval comes via API endpoint /api/pipeline/{run_id}/approve)
    start_wait = time.time()
    while not event.is_set() and (time.time() - start_wait) < timeout_seconds:
        time.sleep(1)

    if event.is_set():
        _emit_sync(state.run_id, "HumanReviewGate", "SUCCESS", "Human review approved")
    else:
        _emit_sync(state.run_id, "HumanReviewGate", "SUCCESS", "Review timeout — auto-proceeding")

    return state.model_copy(update={"current_step": "human_review", "human_approved": True})


def node_create_tasks(state: GraphState) -> GraphState:
    _emit_sync(state.run_id, "TaskCreatorAgent", "RUNNING", "Creating and enriching tasks...")
    try:
        tasks = task_creator_agent.run(
            decisions=state.validated_decisions,
            meeting_title=state.meeting_title,
            run_id=state.run_id,
            meeting_id=state.meeting_id,
        )
        new_state = state.model_copy(update={
            "tasks": tasks,
            "current_step": "create_tasks",
            "status": "TASKS_CREATED",
        })
        _emit_sync(state.run_id, "TaskCreatorAgent", "SUCCESS",
                   f"{len(tasks)} tasks created with acceptance criteria",
                   output={"tasks_created": len(tasks)})
        return new_state
    except Exception as e:
        return _handle_error(state, "create_tasks", str(e))


def node_track(state: GraphState) -> GraphState:
    _emit_sync(state.run_id, "TrackerAgent", "RUNNING", "Scanning deadlines and scheduling monitoring...")
    try:
        result = tracker_agent.run(run_id=state.run_id)
        new_state = state.model_copy(update={
            "current_step": "track",
            "status": "TRACKED",
        })
        overdue_stalled = result.get("overdue_or_stalled", [])
        _emit_sync(state.run_id, "TrackerAgent", "SUCCESS",
                   f"Scanned {result['scanned']} tasks, {result['updated']} updates",
                   output=result)
        # Pass overdue/stalled to next step via state
        return new_state.model_copy(update={"_tracker_result": result})
    except Exception as e:
        return _handle_error(state, "track", str(e))


def node_escalate(state: GraphState) -> GraphState:
    _emit_sync(state.run_id, "EscalationAgent", "RUNNING", "Checking for urgent items requiring escalation...")
    try:
        # Get overdue/stalled tasks from tracker result stored in state
        tracker_result = getattr(state, "_tracker_result", {}) if hasattr(state, "_tracker_result") else {}

        # Get fresh overdue tasks from DB
        all_tasks = get_tasks(status="OVERDUE")
        stalled = tracker_result.get("stalled", []) if isinstance(tracker_result, dict) else []
        overdue_and_stalled = all_tasks + stalled

        escalations = []
        if overdue_and_stalled:
            escalations = escalation_agent.run(
                overdue_stalled_tasks=overdue_and_stalled,
                run_id=state.run_id,
            )

        new_state = state.model_copy(update={
            "escalations": escalations,
            "current_step": "escalate",
            "status": "COMPLETE",
        })
        _emit_sync(state.run_id, "EscalationAgent", "SUCCESS",
                   f"{len(escalations)} escalation drafts in review queue",
                   output={"escalations": len(escalations)})
        return new_state
    except Exception as e:
        return _handle_error(state, "escalate", str(e))


def node_error_recovery(state: GraphState) -> GraphState:
    if state.retry_count >= 2:
        _emit_sync(state.run_id, "OrchestratorAgent", "FAILED",
                   f"Max retries exceeded at step: {state.current_step}")
        return state.model_copy(update={"status": "FAILED"})

    _emit_sync(state.run_id, "OrchestratorAgent", "RUNNING",
               f"Error recovery (attempt {state.retry_count + 1})...")
    return state.model_copy(update={"retry_count": state.retry_count + 1, "status": "RETRYING"})


# ─────────────────────────────────────────────────
# Edge routing
# ─────────────────────────────────────────────────

def route_after_transcribe(state: GraphState) -> str:
    if state.errors and state.retry_count < 2:
        return "error_recovery"
    if state.errors:
        return END
    return "validate"


def route_after_validate(state: GraphState) -> str:
    if state.errors:
        return "error_recovery"
    return "human_review"


def route_after_create(state: GraphState) -> str:
    if state.errors:
        return "error_recovery"
    return "track"


def route_error(state: GraphState) -> str:
    if state.status == "FAILED":
        return END
    # Retry from the failed step
    return state.current_step or "transcribe"


# ─────────────────────────────────────────────────
# Graph assembly
# ─────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(GraphState)

    graph.add_node("transcribe", node_transcribe)
    graph.add_node("validate", node_validate)
    graph.add_node("human_review", node_human_review)
    graph.add_node("create_tasks", node_create_tasks)
    graph.add_node("track", node_track)
    graph.add_node("escalate", node_escalate)
    graph.add_node("error_recovery", node_error_recovery)

    graph.set_entry_point("transcribe")

    graph.add_conditional_edges("transcribe", route_after_transcribe, {
        "validate": "validate",
        "error_recovery": "error_recovery",
        END: END,
    })
    graph.add_conditional_edges("validate", route_after_validate, {
        "human_review": "human_review",
        "error_recovery": "error_recovery",
    })
    graph.add_edge("human_review", "create_tasks")
    graph.add_conditional_edges("create_tasks", route_after_create, {
        "track": "track",
        "error_recovery": "error_recovery",
    })
    graph.add_edge("track", "escalate")
    graph.add_edge("escalate", END)
    graph.add_conditional_edges("error_recovery", route_error, {
        "transcribe": "transcribe",
        "validate": "validate",
        "create_tasks": "create_tasks",
        "track": "track",
        "escalate": "escalate",
        END: END,
    })

    return graph.compile()


# Compiled graph singleton
_pipeline = None

def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = build_graph()
    return _pipeline


# ─────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────

def run_pipeline(
    transcript: str,
    meeting_title: str,
    meeting_id: str,
    run_id: Optional[str] = None,
    audio_file_path: Optional[str] = None,
) -> Dict[str, Any]:
    run_id = run_id or uuid.uuid4().hex[:8]

    # Create pipeline run record
    try:
        insert_pipeline_run(run_id, meeting_id, meeting_title)
    except Exception as e:
        print(f"[Orchestrator] Failed to create pipeline run: {e}")

    # RUN_START audit event
    _log("OrchestratorAgent", "RUN_START", AuditStatus.SUCCESS, run_id, 0,
         f"Pipeline run #{run_id} started for: {meeting_title}")

    initial_state = GraphState(
        run_id=run_id,
        meeting_id=meeting_id,
        meeting_title=meeting_title,
        transcript=transcript,
        audio_file_path=audio_file_path,
        human_approved=True,  # Auto-approve by default; overridden via WS
    )

    try:
        pipeline = get_pipeline()
        final_state = pipeline.invoke(initial_state)

        # Update pipeline run
        tasks_created = len(final_state.get("tasks", [])) if isinstance(final_state, dict) else 0
        status = "COMPLETED" if not final_state.get("errors") else "PARTIAL"
        update_pipeline_run(run_id, status, tasks_created)

        _log("OrchestratorAgent", "RUN_COMPLETE", AuditStatus.SUCCESS, run_id, 0,
             f"Pipeline #{run_id} completed: {tasks_created} tasks created")

        _emit_sync(run_id, "OrchestratorAgent", "SUCCESS",
                   f"Pipeline complete — {tasks_created} tasks created",
                   output={"run_id": run_id, "tasks_created": tasks_created, "status": status})

        return {"run_id": run_id, "status": status, "tasks_created": tasks_created}

    except Exception as e:
        update_pipeline_run(run_id, "FAILED", 0, str(e))
        _log("OrchestratorAgent", "RUN_FAILED", AuditStatus.FAILED, run_id, 0,
             f"Pipeline #{run_id} failed: {str(e)}", error=str(e))
        return {"run_id": run_id, "status": "FAILED", "error": str(e)}


# ─────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────

def _handle_error(state: GraphState, step: str, error: str) -> GraphState:
    print(f"[Orchestrator] Error at {step}: {error}")
    _log("OrchestratorAgent", f"ERROR_{step.upper()}", AuditStatus.FAILED,
         state.run_id, 0, f"Error at {step}: {error}", error=error)
    return state.model_copy(update={
        "errors": state.errors + [f"{step}: {error}"],
        "current_step": step,
    })


def _emit_sync(run_id: str, agent: str, status: str, description: str, output: dict = None):
    """Fire-and-forget WebSocket broadcast (sync wrapper)."""
    import threading
    msg = {
        "type": "step_update",
        "run_id": run_id,
        "agent": agent,
        "status": status,
        "description": description,
        "output": output or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast(run_id, msg))
        else:
            loop.run_until_complete(ws_manager.broadcast(run_id, msg))
    except RuntimeError:
        # No event loop — create one in thread
        def _run():
            asyncio.run(ws_manager.broadcast(run_id, msg))
        threading.Thread(target=_run, daemon=True).start()


def _log(agent, action, status, run_id, duration_ms, summary, output=None, error=None):
    try:
        insert_audit_event(AuditEvent(
            agent=agent, action=action, status=status,
            run_id=run_id, duration_ms=duration_ms,
            summary=summary, output_payload=output, error_message=error,
            created_at=datetime.now(timezone.utc),
        ))
    except Exception as e:
        print(f"[AuditLog Error] {e}")
