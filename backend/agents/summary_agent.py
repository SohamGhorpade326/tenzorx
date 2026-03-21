"""
SummaryAgent
------------
Creates a concise meeting summary after all pipeline steps complete.
Uses Groq LLM when available, with deterministic fallback in DEMO/offline mode.
"""

import re
import time
from datetime import datetime, timezone
from typing import List

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage

from config import GROQ_API_KEY, GROQ_MODEL, DEMO_MODE
from models.schemas import Decision, Task, Escalation, AuditEvent, AuditStatus
from db.db import insert_audit_event


SUMMARY_PROMPT = """You are an executive meeting assistant.
Create a summary of the WHOLE meeting transcript, not only task extraction.
Use ONLY facts from the provided transcript and facts blocks. Do NOT invent names, owners, deadlines, or decisions.

Return plain text with these exact sections:

Meeting Summary:
- 1 concise paragraph (4-7 sentences) covering context, what was discussed, and outcomes.

Who Said What:
- 4-10 bullets in format: Speaker - key statement/commitment
- Use Transcript Speaker Facts primarily.

Decisions & Commitments:
- 3-8 bullets with confirmed decisions/commitments.

Meeting Outcome:
- 2-5 bullets for final outcomes (what got decided, what will happen next, by when).

Action Items:
- Bullets in format: Owner - Task (Deadline or No deadline)
- Use ONLY Task Facts for this section.

Risks / Escalations:
- 1-3 bullets based on Escalation Facts.

Meeting title: {meeting_title}
Transcript:
{transcript}

Decision Facts:
{decision_facts}

Transcript Speaker Facts:
{speaker_facts}

Task Facts:
{task_facts}

Escalation Facts:
{escalation_facts}
"""


def run(
    transcript: str,
    meeting_title: str,
    decisions: List[Decision],
    tasks: List[Task],
    escalations: List[Escalation],
    run_id: str,
) -> str:
    start = time.time()
    try:
        if DEMO_MODE or not GROQ_API_KEY:
            summary = _fallback_summary(transcript, meeting_title, decisions, tasks, escalations)
        else:
            summary = _llm_summary(transcript, meeting_title, decisions, tasks, escalations)

        elapsed_ms = int((time.time() - start) * 1000)
        _log(
            "SummaryAgent",
            "GENERATE_SUMMARY",
            AuditStatus.SUCCESS,
            run_id,
            elapsed_ms,
            "Meeting summary generated",
            output={
                "chars": len(summary),
                "tasks": len(tasks),
                "escalations": len(escalations),
            },
        )
        return summary
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        _log(
            "SummaryAgent",
            "GENERATE_SUMMARY",
            AuditStatus.FAILED,
            run_id,
            elapsed_ms,
            f"Summary generation failed: {str(e)}",
            error=str(e),
        )
        return _fallback_summary(transcript, meeting_title, decisions, tasks, escalations)


def _llm_summary(
    transcript: str,
    meeting_title: str,
    decisions: List[Decision],
    tasks: List[Task],
    escalations: List[Escalation],
) -> str:
    llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0.2)

    trimmed_transcript = (transcript or "").strip()
    if len(trimmed_transcript) > 8000:
        trimmed_transcript = trimmed_transcript[:8000] + "\n...[truncated]"

    decision_facts = "\n".join(f"- {d.text}" for d in decisions[:10]) or "- None"
    speaker_facts = _format_speaker_facts(transcript)
    task_facts = _format_task_facts(tasks)
    escalation_facts = _format_escalation_facts(escalations)

    prompt = SUMMARY_PROMPT.format(
        meeting_title=meeting_title,
        transcript=trimmed_transcript or "No transcript available",
        decision_facts=decision_facts,
        speaker_facts=speaker_facts,
        task_facts=task_facts,
        escalation_facts=escalation_facts,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    text = (response.content or "").strip()
    text = re.sub(r"^```(?:text|markdown)?\\s*", "", text)
    text = re.sub(r"\\s*```$", "", text)

    if not text:
        return _fallback_summary(transcript, meeting_title, decisions, tasks, escalations)

    return _normalize_summary_sections(text, transcript, decisions, tasks, escalations)


def _fallback_summary(
    transcript: str,
    meeting_title: str,
    decisions: List[Decision],
    tasks: List[Task],
    escalations: List[Escalation],
) -> str:
    task_lines = _format_action_items(tasks)
    speaker_lines = _format_speaker_fallback(transcript)

    decision_lines = [f"- {d.text}" for d in decisions[:5]]
    if not decision_lines:
        decision_lines = ["- No explicit decisions captured."]

    escalation_line = f"- {len(escalations)} escalation draft(s) queued."

    outcomes = [
        f"- {len(decisions)} validated decision(s) captured from the meeting.",
        f"- {len(tasks)} action item(s) created and assigned/tracked.",
        f"- {len(escalations)} escalation draft(s) generated for urgent blockers.",
    ]

    return (
        f"Meeting Summary:\n"
        f"Meeting '{meeting_title}' has been processed. "
        f"The discussion produced {len(decisions)} validated decision(s), {len(tasks)} tracked action item(s), "
        f"and {len(escalations)} escalation draft(s) where applicable.\n\n"
        f"Who Said What:\n" + speaker_lines + "\n\n"
        f"Decisions & Commitments:\n" + "\n".join(decision_lines) + "\n\n"
        f"Meeting Outcome:\n" + "\n".join(outcomes) + "\n\n"
        f"Action Items:\n" + task_lines + "\n\n"
        f"Risks / Escalations:\n{escalation_line}"
    )


def _format_action_items(tasks: List[Task]) -> str:
    lines = []
    for t in tasks[:10]:
        owner = t.owner or "UNASSIGNED"
        deadline = t.deadline.isoformat() if t.deadline else "No deadline"
        lines.append(f"- {owner} - {t.title} ({deadline})")
    return "\n".join(lines) if lines else "- No action items created."


def _format_task_facts(tasks: List[Task]) -> str:
    if not tasks:
        return "- None"
    lines = []
    for t in tasks[:15]:
        owner = t.owner or "UNASSIGNED"
        deadline = t.deadline.isoformat() if t.deadline else "No deadline"
        lines.append(f"- Owner={owner}; Task={t.title}; Deadline={deadline}")
    return "\n".join(lines)


def _format_escalation_facts(escalations: List[Escalation]) -> str:
    if not escalations:
        return "- 0 escalations"
    lines = [f"- Count={len(escalations)}"]
    for e in escalations[:10]:
        lines.append(f"- Owner={e.owner}; Task={e.task_title}; OverdueByDays={e.overdue_by_days}")
    return "\n".join(lines)


def _format_speaker_facts(transcript: str) -> str:
    """Extract speaker-tagged lines (e.g., 'Priya: ...') from transcript for grounding."""
    if not transcript:
        return "- None"
    lines = []
    pattern = re.compile(r"^\s*([A-Za-z][A-Za-z .'-]{1,40})\s*:\s*(.+)$")
    for raw_line in transcript.splitlines():
        m = pattern.match(raw_line.strip())
        if not m:
            continue
        speaker = m.group(1).strip()
        text = m.group(2).strip()
        if text:
            lines.append(f"- {speaker}: {text[:180]}")
        if len(lines) >= 20:
            break
    return "\n".join(lines) if lines else "- None"


def _format_speaker_fallback(transcript: str) -> str:
    facts = _format_speaker_facts(transcript)
    if facts == "- None":
        return "- Speaker labels were not clearly available in the transcript."
    return facts


def _normalize_summary_sections(
    text: str,
    transcript: str,
    decisions: List[Decision],
    tasks: List[Task],
    escalations: List[Escalation],
) -> str:
    section_names = [
        "Meeting Summary",
        "Who Said What",
        "Decisions & Commitments",
        "Meeting Outcome",
        "Action Items",
        "Risks / Escalations",
    ]

    parsed = {name: "" for name in section_names}
    current = None
    for line in text.splitlines():
        stripped = line.strip()
        matched = next((name for name in section_names if stripped.lower() == f"{name.lower()}:"), None)
        if matched:
            current = matched
            continue
        if current:
            parsed[current] += (line + "\n")

    if not parsed["Meeting Summary"].strip():
        parsed["Meeting Summary"] = "Meeting processing completed with structured extraction of decisions, tasks, and risks.\n"
    if not parsed["Who Said What"].strip():
        parsed["Who Said What"] = _format_speaker_fallback(transcript) + "\n"
    if not parsed["Decisions & Commitments"].strip():
        parsed["Decisions & Commitments"] = "\n".join([f"- {d.text}" for d in decisions[:8]]) or "- No explicit decisions captured."
        parsed["Decisions & Commitments"] += "\n"
    if not parsed["Meeting Outcome"].strip():
        parsed["Meeting Outcome"] = (
            f"- {len(decisions)} decisions validated.\n"
            f"- {len(tasks)} action items created.\n"
            f"- {len(escalations)} escalations identified.\n"
        )

    # Keep action items deterministic from actual tasks so owner names cannot drift.
    parsed["Action Items"] = _format_action_items(tasks) + "\n"

    if not parsed["Risks / Escalations"].strip():
        parsed["Risks / Escalations"] = _format_escalation_facts(escalations) + "\n"

    return (
        f"Meeting Summary:\n{parsed['Meeting Summary'].strip()}\n\n"
        f"Who Said What:\n{parsed['Who Said What'].strip()}\n\n"
        f"Decisions & Commitments:\n{parsed['Decisions & Commitments'].strip()}\n\n"
        f"Meeting Outcome:\n{parsed['Meeting Outcome'].strip()}\n\n"
        f"Action Items:\n{parsed['Action Items'].strip()}\n\n"
        f"Risks / Escalations:\n{parsed['Risks / Escalations'].strip()}"
    )


def _log(agent, action, status, run_id, duration_ms, summary, output=None, error=None):
    try:
        insert_audit_event(AuditEvent(
            agent=agent,
            action=action,
            status=status,
            run_id=run_id,
            duration_ms=duration_ms,
            summary=summary,
            output_payload=output,
            error_message=error,
            created_at=datetime.now(timezone.utc),
        ))
    except Exception as e:
        print(f"[AuditLog Error] {e}")