"""
TrackerAgent
------------
Responsibilities:
1. Read all non-DONE tasks from Supabase.
2. Apply status transition rules:
   - PENDING → AT_RISK if deadline is within 48 hours
   - PENDING/AT_RISK → OVERDUE if deadline has passed
3. Stall detection: PENDING for > 3 days with no change → flag as stalled
4. Write audit events for every status change.

Runs on a schedule (every 5 min in demo, configurable) via APScheduler.
"""

import time
from datetime import datetime, timezone, timedelta
from typing import List, Tuple

from models.schemas import Task, TaskStatus, AuditEvent, AuditStatus
from db.db import get_tasks, update_task, insert_audit_event


# Thresholds
AT_RISK_HOURS = 48
STALL_DAYS = 3


def run(run_id: str = None) -> dict:
    """Scan all non-DONE tasks and update statuses. Returns summary."""
    start = time.time()
    now = datetime.now(timezone.utc)

    tasks_data = get_tasks()
    tasks = [t for t in tasks_data if t.get("status") not in ("DONE", "BLOCKED")]

    updated = []
    stalled = []

    for t in tasks:
        task_id = t["id"]
        current_status = t.get("status", "PENDING")
        deadline_str = t.get("deadline")
        last_change_str = t.get("last_status_change") or t.get("created_at")

        if not deadline_str:
            # No deadline — check for stall only
            if _is_stalled(last_change_str, now):
                stalled.append(t)
            continue

        try:
            deadline = datetime.fromisoformat(deadline_str).replace(tzinfo=timezone.utc)
        except Exception:
            continue

        time_until = (deadline - now).total_seconds() / 3600  # hours

        new_status = _compute_new_status(current_status, time_until)

        if new_status and new_status != current_status:
            reason = _status_change_reason(current_status, new_status, time_until)
            update_task(task_id, {
                "status": new_status,
                "changed_by": "TrackerAgent",
                "reason": reason,
            })
            updated.append({
                "task_id": task_id,
                "title": t.get("title"),
                "old_status": current_status,
                "new_status": new_status,
                "reason": reason,
            })
            _log_status_change(task_id, t.get("title"), current_status, new_status, reason, run_id)

        # Stall check (separate from deadline)
        if current_status == "PENDING" and _is_stalled(last_change_str, now):
            stalled.append(t)
            _log_stall(task_id, t.get("title"), run_id)

    elapsed_ms = int((time.time() - start) * 1000)

    summary_msg = f"Scanned {len(tasks)} tasks: {len(updated)} status changes, {len(stalled)} stalled"
    _log(
        "TrackerAgent", "SCAN_DEADLINES", AuditStatus.SUCCESS, run_id, elapsed_ms, summary_msg,
        output={
            "scanned": len(tasks),
            "updated": len(updated),
            "stalled": len(stalled),
            "changes": updated,
        },
    )

    return {
        "scanned": len(tasks),
        "updated": updated,
        "stalled": stalled,
        "overdue_or_stalled": [t for t in tasks_data if t.get("status") in ("OVERDUE",)] + stalled,
    }


def _compute_new_status(current: str, hours_until_deadline: float) -> str:
    """Pure function: compute next status given current status and hours remaining."""
    if hours_until_deadline < 0:
        # Deadline passed
        if current in ("PENDING", "AT_RISK"):
            return TaskStatus.OVERDUE.value
    elif hours_until_deadline <= AT_RISK_HOURS:
        # Within 48 hours
        if current == "PENDING":
            return TaskStatus.AT_RISK.value
    return None  # No change


def _status_change_reason(old: str, new: str, hours: float) -> str:
    if new == "OVERDUE":
        return f"Deadline passed {abs(hours):.0f} hours ago"
    if new == "AT_RISK":
        return f"Deadline is within {hours:.0f} hours"
    return "Status updated by TrackerAgent"


def _is_stalled(last_change_str: str, now: datetime) -> bool:
    """Returns True if task has been in same state for > STALL_DAYS."""
    if not last_change_str:
        return False
    try:
        last_change = datetime.fromisoformat(last_change_str.replace("Z", "+00:00"))
        return (now - last_change).days >= STALL_DAYS
    except Exception:
        return False


def _log_status_change(task_id: str, title: str, old_status: str, new_status: str, reason: str, run_id: str):
    _log(
        "TrackerAgent", "STATUS_CHANGE", AuditStatus.SUCCESS, run_id, 0,
        f"Task \"{title[:40]}\": {old_status} → {new_status}",
        output={"task_id": task_id, "old": old_status, "new": new_status, "reason": reason},
    )


def _log_stall(task_id: str, title: str, run_id: str):
    _log(
        "TrackerAgent", "STALL_DETECTED", AuditStatus.SUCCESS, run_id, 0,
        f"Task \"{title[:40]}\" has been PENDING for >{STALL_DAYS} days with no change",
        output={"task_id": task_id, "stall_threshold_days": STALL_DAYS},
    )


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
