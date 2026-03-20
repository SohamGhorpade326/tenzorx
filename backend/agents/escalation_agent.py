"""
EscalationAgent
---------------
Responsibilities:
1. Triggered by OrchestratorAgent when TrackerAgent finds OVERDUE or STALLED tasks.
2. Uses Groq to write a contextual, personalised escalation message (not a template).
   - Message references the specific decision, the meeting it came from, and days overdue.
3. Inserts escalation into Supabase with status PENDING_APPROVAL.
4. On /approve: sends via SMTP (if configured) or logs as mock-sent.
"""

import smtplib
import time
from datetime import datetime, timezone, date
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

from config import GROQ_API_KEY, GROQ_MODEL, DEMO_MODE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
from models.schemas import Escalation, AuditEvent, AuditStatus
from db.db import insert_escalation, insert_audit_event


ESCALATION_PROMPT = """You are a professional project manager writing a follow-up email.

Write a concise, professional escalation email for an overdue task. The email should:
- Be polite but clear about urgency
- Reference the SPECIFIC task and where it came from (meeting name)
- Mention exactly how many days overdue it is
- Ask for a status update and expected completion date
- Offer help if the person is blocked
- NOT be a generic template — make it feel personal and specific

Task: {task_title}
Owner: {owner}
Days overdue: {days_overdue}
Deadline was: {deadline}
Source meeting: {source_meeting}
Reason for escalation: {reason}

Write ONLY the email body (no subject line, no "To:", just the message body starting with "Hi {owner_first},")"""


def run(
    overdue_stalled_tasks: List[dict],
    run_id: str = None,
) -> List[Escalation]:
    """Create escalation records for all OVERDUE/STALLED tasks."""
    start = time.time()
    escalations_created = []

    for task in overdue_stalled_tasks:
        esc = _draft_escalation(task, run_id)
        if esc:
            escalations_created.append(esc)

    elapsed_ms = int((time.time() - start) * 1000)
    _log(
        "EscalationAgent", "DRAFT_ESCALATIONS", AuditStatus.SUCCESS, run_id, elapsed_ms,
        f"{len(escalations_created)} escalation drafts created",
        output={"count": len(escalations_created), "tasks": [e.task_title for e in escalations_created]},
    )
    return escalations_created


def _draft_escalation(task: dict, run_id: str) -> Escalation:
    """Draft and persist a single escalation."""
    start = time.time()

    task_id = task.get("id", "")
    task_title = task.get("title", "Unknown Task")
    owner = task.get("owner", "UNASSIGNED")
    deadline_str = task.get("deadline")
    source_meeting = task.get("source_meeting", "recent meeting")
    status = task.get("status", "OVERDUE")

    # Compute days overdue
    days_overdue = 0
    deadline_date = None
    if deadline_str:
        try:
            deadline_date = date.fromisoformat(deadline_str)
            days_overdue = (date.today() - deadline_date).days
        except Exception:
            pass

    reason = f"Task is {status}" + (f" by {days_overdue} days" if days_overdue > 0 else "")

    # Draft message with LLM
    message = _draft_message(task_title, owner, days_overdue, deadline_date, source_meeting, reason)

    # Persist escalation
    try:
        esc = Escalation(
            task_id=task_id,
            task_title=task_title,
            owner=owner,
            overdue_by_days=max(0, days_overdue),
            deadline=deadline_date,
            source_meeting=source_meeting,
            message=message,
        )
        created = insert_escalation(esc)
        esc.id = created["id"]

        elapsed_ms = int((time.time() - start) * 1000)
        _log(
            "EscalationAgent", "DRAFT_ESCALATION", AuditStatus.SUCCESS, run_id, elapsed_ms,
            f"Draft created for {owner}: \"{task_title[:40]}\"",
            output={"escalation_id": esc.id, "owner": owner, "task_title": task_title},
        )
        return esc

    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        _log("EscalationAgent", "DRAFT_ESCALATION", AuditStatus.FAILED, run_id, elapsed_ms,
             f"Failed: {str(e)}", error=str(e))
        return None


def _draft_message(task_title: str, owner: str, days_overdue: int, deadline, source_meeting: str, reason: str) -> str:
    """Use Groq to write a personalised escalation email body."""
    if DEMO_MODE:
        owner_first = owner.split()[0] if " " in owner else owner
        return (
            f"Hi {owner_first},\n\n"
            f"I wanted to follow up on \"{task_title}\" which was due {f'{days_overdue} days ago' if days_overdue > 0 else 'recently'} "
            f"(from the {source_meeting}).\n\n"
            f"Could you share a status update and expected completion date? "
            f"If you're blocked on anything, please let the team know so we can help.\n\n"
            f"Best regards,\nMeetingMind"
        )

    try:
        llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0.5)
        owner_first = owner.split()[0] if " " in owner else owner
        prompt = ESCALATION_PROMPT.format(
            task_title=task_title,
            owner=owner,
            owner_first=owner_first,
            days_overdue=days_overdue,
            deadline=deadline.isoformat() if deadline else "unknown",
            source_meeting=source_meeting,
            reason=reason,
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
    except Exception as e:
        print(f"[EscalationAgent] LLM draft failed: {e}")
        owner_first = owner.split()[0] if " " in owner else owner
        return (
            f"Hi {owner_first},\n\n"
            f"This is a follow-up regarding \"{task_title}\" from {source_meeting}.\n"
            f"The task is {reason}. Please provide an update at your earliest convenience.\n\n"
            f"Best regards,\nMeetingMind"
        )


def send_escalation(escalation_id: str, owner_email: str, subject: str, message: str) -> bool:
    """Send escalation email via SMTP or log as mock-sent if SMTP not configured."""
    if not SMTP_HOST or not SMTP_USER:
        print(f"[EscalationAgent] MOCK SEND to {owner_email}: {subject}")
        _log(
            "EscalationAgent", "ESCALATION_SENT", AuditStatus.SUCCESS, None, 0,
            f"Mock-sent escalation to {owner_email}",
            output={"escalation_id": escalation_id, "to": owner_email, "mode": "mock"},
        )
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = owner_email
        msg["Subject"] = subject
        msg.attach(MIMEText(message, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        _log(
            "EscalationAgent", "ESCALATION_SENT", AuditStatus.SUCCESS, None, 0,
            f"Email sent to {owner_email}",
            output={"escalation_id": escalation_id, "to": owner_email},
        )
        return True

    except Exception as e:
        _log("EscalationAgent", "ESCALATION_SENT", AuditStatus.FAILED, None, 0,
             f"Failed to send to {owner_email}: {e}", error=str(e))
        return False


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
