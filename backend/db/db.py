from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from models.schemas import (
    Task, Decision, AuditEvent, Escalation, PipelineRun,
    TaskStatus, AuditStatus
)
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import time
from fastapi.encoders import jsonable_encoder

# ─────────────────────────────────────────────────
# Supabase client (uses service key for full access)
# ─────────────────────────────────────────────────

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


# ─────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _short_id() -> str:
    return uuid.uuid4().hex[:4]


# ─────────────────────────────────────────────────
# MEETINGS
# ─────────────────────────────────────────────────

def insert_meeting(title: str, date: Optional[str], attendees: Optional[List[str]], transcript: str = "") -> dict:
    db = get_client()
    data = {
        "id": _new_id(),
        "title": title,
        "date": date,
        "attendees": attendees or [],
        "transcript": transcript,
        "status": "PROCESSING",
        "created_at": _now(),
        "updated_at": _now(),
    }
    res = db.table("meetings").insert(data).execute()
    return res.data[0]


def update_meeting_transcript(meeting_id: str, transcript: str):
    db = get_client()
    db.table("meetings").update({
        "transcript": transcript,
        "updated_at": _now(),
    }).eq("id", meeting_id).execute()


def update_meeting_summary(meeting_id: str, summary: str):
    db = get_client()
    try:
        db.table("meetings").update({
            "summary": summary,
            "updated_at": _now(),
        }).eq("id", meeting_id).execute()
        return True
    except Exception as e:
        # Backward compatibility for deployments where the summary column is not migrated yet.
        msg = str(e)
        if "PGRST204" in msg and "summary" in msg:
            return False
        raise


def update_meeting_status(meeting_id: str, status: str):
    db = get_client()
    db.table("meetings").update({
        "status": status,
        "updated_at": _now(),
    }).eq("id", meeting_id).execute()


def get_meeting(meeting_id: str) -> Optional[dict]:
    db = get_client()
    res = db.table("meetings").select("*").eq("id", meeting_id).execute()
    return res.data[0] if res.data else None


def insert_meeting_schedule_event(
    meeting_id: str,
    run_id: Optional[str],
    event_date: str,
    source_text: str,
    source_title: Optional[str] = None,
    decided_in_meeting_title: Optional[str] = None,
    decided_in_meeting_date: Optional[str] = None,
) -> Optional[dict]:
    db = get_client()
    base_data = {
        "id": _new_id(),
        "meeting_id": meeting_id,
        "run_id": run_id,
        "event_date": event_date,
        "source_text": source_text,
        "source_title": source_title,
        "created_at": _now(),
    }
    data = {
        **base_data,
        "decided_in_meeting_title": decided_in_meeting_title,
        "decided_in_meeting_date": decided_in_meeting_date,
    }
    try:
        res = db.table("meeting_schedule_events").insert(data).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        # Backward compatibility for deployments where recent columns are not migrated yet.
        msg = str(e)
        if "meeting_schedule_events" in msg and "decided_in_meeting_" in msg:
            try:
                res = db.table("meeting_schedule_events").insert(base_data).execute()
                return res.data[0] if res.data else None
            except Exception:
                return None
        if "meeting_schedule_events" in msg or "PGRST204" in msg:
            # If the table itself is missing or schema is older, do not break pipeline.
            return None
        raise


def get_meeting_schedule_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    meeting_id: Optional[str] = None,
    limit: int = 500,
) -> List[dict]:
    db = get_client()
    query = db.table("meeting_schedule_events").select("*").order("event_date", desc=False).limit(limit)
    if start_date:
        query = query.gte("event_date", start_date)
    if end_date:
        query = query.lte("event_date", end_date)
    if meeting_id:
        query = query.eq("meeting_id", meeting_id)

    try:
        res = query.execute()
        return res.data
    except Exception as e:
        msg = str(e)
        if "meeting_schedule_events" in msg or "PGRST204" in msg:
            return []
        raise


# ─────────────────────────────────────────────────
# PIPELINE RUNS
# ─────────────────────────────────────────────────

def insert_pipeline_run(run_id: str, meeting_id: str, meeting_title: str) -> dict:
    db = get_client()
    data = {
        "id": run_id,
        "meeting_id": meeting_id,
        "meeting_title": meeting_title,
        "status": "RUNNING",
        "tasks_created": 0,
        "started_at": _now(),
    }
    res = db.table("pipeline_runs").insert(data).execute()
    return res.data[0]


def update_pipeline_run(run_id: str, status: str, tasks_created: int = 0, error: str = None):
    db = get_client()
    now = _now()
    started = db.table("pipeline_runs").select("started_at").eq("id", run_id).execute()
    duration = None
    if started.data:
        started_at = datetime.fromisoformat(started.data[0]["started_at"].replace("Z", "+00:00"))
        duration = (datetime.now(timezone.utc) - started_at).total_seconds()

    update = {
        "status": status,
        "tasks_created": tasks_created,
        "completed_at": now,
        "duration_seconds": duration,
    }
    if error:
        update["error_message"] = error
    db.table("pipeline_runs").update(update).eq("id", run_id).execute()


def get_pipeline_runs(limit: int = 20) -> List[dict]:
    db = get_client()
    res = db.table("pipeline_runs").select("*").order("started_at", desc=True).limit(limit).execute()
    return res.data


def get_pipeline_run(run_id: str) -> Optional[dict]:
    db = get_client()
    res = db.table("pipeline_runs").select("*").eq("id", run_id).execute()
    return res.data[0] if res.data else None


# ─────────────────────────────────────────────────
# DECISIONS
# ─────────────────────────────────────────────────

def insert_decision(decision: Decision) -> dict:
    db = get_client()
    data = {
        "id": decision.id or _new_id(),
        "meeting_id": decision.meeting_id,
        "run_id": decision.run_id,
        "text": decision.text,
        "owner": decision.owner or "UNASSIGNED",
        "deadline": decision.deadline.isoformat() if decision.deadline else None,
        "deadline_note": decision.deadline_note,
        "flagged": decision.flagged,
        "flag_reason": decision.flag_reason,
        "is_actionable": decision.is_actionable,
        "created_at": _now(),
    }
    res = db.table("decisions").insert(data).execute()
    return res.data[0]


# ─────────────────────────────────────────────────
# TASKS
# ─────────────────────────────────────────────────

def insert_task(task: Task) -> dict:
    db = get_client()
    task_id = task.id or _new_id()
    now = _now()
    data = {
        "id": task_id,
        "decision_id": task.decision_id,
        "meeting_id": task.meeting_id,
        "run_id": task.run_id,
        "title": task.title,
        "description": task.description,
        "owner": task.owner or "UNASSIGNED",
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "priority": task.priority.value if task.priority else "MEDIUM",
        "status": task.status.value if task.status else "PENDING",
        "acceptance_criteria": task.acceptance_criteria or [],
        "source_quote": task.source_quote,
        "decision_context": task.decision_context,
        "source_meeting": task.source_meeting,
        "last_status_change": now,
        "created_at": now,
        "updated_at": now,
    }
    res = db.table("tasks").insert(data).execute()
    created = res.data[0]

    # Write initial status history
    db.table("task_status_history").insert({
        "id": _new_id(),
        "task_id": task_id,
        "status": data["status"],
        "changed_at": now,
        "changed_by": "System",
        "reason": "Task created",
    }).execute()

    return created


def get_tasks(status: Optional[str] = None, owner: Optional[str] = None, limit: int = 200) -> List[dict]:
    db = get_client()
    query = db.table("tasks").select("*").order("created_at", desc=True).limit(limit)
    if status and status != "ALL":
        query = query.eq("status", status)
    if owner and owner != "ALL":
        query = query.eq("owner", owner)
    res = query.execute()
    return res.data


def get_task(task_id: str) -> Optional[dict]:
    db = get_client()
    res = db.table("tasks").select("*").eq("id", task_id).execute()
    return res.data[0] if res.data else None


def update_task(task_id: str, updates: dict) -> dict:
    db = get_client()
    updates["updated_at"] = _now()
    if "status" in updates:
        updates["last_status_change"] = _now()
        # Record history
        db.table("task_status_history").insert({
            "id": _new_id(),
            "task_id": task_id,
            "status": updates["status"],
            "changed_at": updates["updated_at"],
            "changed_by": updates.pop("changed_by", "System"),
            "reason": updates.pop("reason", None),
        }).execute()
    res = db.table("tasks").update(updates).eq("id", task_id).execute()
    return res.data[0] if res.data else {}


def get_task_status_history(task_id: str) -> List[dict]:
    db = get_client()
    res = db.table("task_status_history").select("*").eq("task_id", task_id).order("changed_at").execute()
    return res.data


# ─────────────────────────────────────────────────
# AUDIT EVENTS
# ─────────────────────────────────────────────────

def insert_audit_event(event: AuditEvent) -> dict:
    db = get_client()
    data = {
        "id": event.id or _new_id(),
        "run_id": event.run_id,
        "agent": event.agent,
        "action": event.action,
        "status": event.status.value if event.status else "SUCCESS",
        "duration_ms": event.duration_ms,
        "summary": event.summary,
        "input_payload": jsonable_encoder(event.input_payload) if event.input_payload is not None else None,
        "output_payload": jsonable_encoder(event.output_payload) if event.output_payload is not None else None,
        "error_message": event.error_message,
        "retry_count": event.retry_count,
        "created_at": event.created_at.isoformat() if event.created_at else _now(),
    }
    res = db.table("audit_events").insert(data).execute()
    return res.data[0]


def get_audit_events(
    agent: Optional[str] = None,
    status: Optional[str] = None,
    run_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
) -> List[dict]:
    db = get_client()
    query = db.table("audit_events").select("*").order("created_at", desc=True).limit(limit)
    if agent and agent != "ALL":
        query = query.eq("agent", agent)
    if status and status != "ALL":
        query = query.eq("status", status)
    if run_id:
        query = query.eq("run_id", run_id)
    res = query.execute()
    data = res.data
    if search:
        sl = search.lower()
        data = [e for e in data if sl in (e.get("action") or "").lower() or sl in (e.get("summary") or "").lower()]
    return data


# ─────────────────────────────────────────────────
# ESCALATIONS
# ─────────────────────────────────────────────────

def insert_escalation(escalation: Escalation) -> dict:
    db = get_client()
    data = {
        "id": escalation.id or _new_id(),
        "task_id": escalation.task_id,
        "task_title": escalation.task_title,
        "owner": escalation.owner,
        "overdue_by_days": escalation.overdue_by_days,
        "deadline": escalation.deadline.isoformat() if escalation.deadline else None,
        "source_meeting": escalation.source_meeting,
        "message": escalation.message,
        "status": "PENDING_APPROVAL",
        "created_at": _now(),
    }
    res = db.table("escalations").insert(data).execute()
    return res.data[0]


def get_escalations(status: Optional[str] = None) -> List[dict]:
    db = get_client()
    query = db.table("escalations").select("*").order("created_at", desc=True)
    if status and status != "ALL":
        query = query.eq("status", status)
    res = query.execute()
    return res.data


def update_escalation_status(escalation_id: str, status: str, approved_by: str = None) -> dict:
    db = get_client()
    update = {"status": status}
    if status == "SENT":
        update["sent_at"] = _now()
    if approved_by:
        update["approved_by"] = approved_by
    res = db.table("escalations").update(update).eq("id", escalation_id).execute()
    return res.data[0] if res.data else {}


# ─────────────────────────────────────────────────
# DASHBOARD AGGREGATES
# ─────────────────────────────────────────────────

def get_dashboard_metrics() -> dict:
    db = get_client()

    tasks_res = db.table("tasks").select("status, priority, created_at").execute()
    tasks = tasks_res.data

    total = len(tasks)
    overdue = sum(1 for t in tasks if t["status"] == "OVERDUE")
    at_risk = sum(1 for t in tasks if t["status"] == "AT_RISK")
    done = sum(1 for t in tasks if t["status"] == "DONE")
    pending = sum(1 for t in tasks if t["status"] == "PENDING")
    blocked = sum(1 for t in tasks if t["status"] == "BLOCKED")

    esc_res = db.table("escalations").select("status").eq("status", "SENT").execute()
    escalations_sent = len(esc_res.data)

    pipeline_runs = get_pipeline_runs(limit=10)

    task_distribution = [
        {"name": "PENDING", "value": pending, "fill": "hsl(220, 9%, 46%)"},
        {"name": "AT_RISK", "value": at_risk, "fill": "hsl(38, 92%, 50%)"},
        {"name": "OVERDUE", "value": overdue, "fill": "hsl(0, 84%, 60%)"},
        {"name": "DONE", "value": done, "fill": "hsl(160, 84%, 39%)"},
        {"name": "BLOCKED", "value": blocked, "fill": "hsl(25, 95%, 53%)"},
    ]

    return {
        "total_tasks": total,
        "overdue_count": overdue,
        "at_risk_count": at_risk,
        "done_count": done,
        "escalations_sent": escalations_sent,
        "recent_pipeline_runs": pipeline_runs,
        "task_status_distribution": task_distribution,
        "agent_activity": [],
    }
