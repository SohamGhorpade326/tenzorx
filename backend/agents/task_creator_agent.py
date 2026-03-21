"""
TaskCreatorAgent
----------------
Responsibilities:
1. Take validated decisions and create task records in Supabase.
2. Use Groq LLM to enrich each task with:
   - Priority (HIGH/MEDIUM/LOW) based on decision language
   - Acceptance criteria (what "done" looks like)
3. Export a GitHub-Issues-compatible JSON file.
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import List

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

from config import GROQ_API_KEY, GROQ_MODEL, DEMO_MODE
from models.schemas import Decision, Task, TaskPriority, TaskStatus, AuditEvent, AuditStatus
from db.db import insert_task, insert_audit_event


ENRICH_PROMPT = """You are a project management AI. For this task extracted from a meeting, provide:
1. Priority: HIGH if urgent/critical/overdue/security/blocker, LOW if nice-to-have/informational, else MEDIUM
2. Description: 1-2 sentences expanding on what needs to be done
3. Acceptance criteria: 2-3 bullet points defining what "done" looks like

Return ONLY valid JSON (no markdown):
{{
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "description": "...",
  "acceptance_criteria": ["criterion 1", "criterion 2", "criterion 3"]
}}

Task: {task_text}
Owner: {owner}
Context: From meeting discussion about: {context}"""


def run(
    decisions: List[Decision],
    meeting_title: str = "Untitled Meeting",
    run_id: str = None,
    meeting_id: str = None,
) -> List[Task]:
    start = time.time()
    tasks = []
    seen = set()

    for decision in decisions:
        if not decision.is_actionable:
            continue

        if not (decision.text or "").strip():
            continue

        task = _create_task(decision, meeting_title, run_id, meeting_id)
        if task:
            dedupe_key = (task.title or "").strip().lower(), (task.owner or "UNASSIGNED").strip().lower()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            tasks.append(task)

    # Export GitHub Issues-compatible JSON
    _export_github_json(tasks, run_id)

    elapsed_ms = int((time.time() - start) * 1000)
    _log(
        "TaskCreatorAgent", "CREATE_TASKS", AuditStatus.SUCCESS, run_id, elapsed_ms,
        f"{len(tasks)} tasks created with acceptance criteria",
        output={"tasks_created": len(tasks), "task_titles": [t.title for t in tasks]},
    )
    return tasks


def _create_task(decision: Decision, meeting_title: str, run_id: str, meeting_id: str) -> Task:
    """Create and persist a single task."""
    start = time.time()

    # Build base task
    task = Task(
        decision_id=decision.id,
        meeting_id=meeting_id,
        run_id=run_id,
        title=_generate_title(decision.text),
        owner=decision.owner or "UNASSIGNED",
        deadline=decision.deadline,
        source_meeting=meeting_title,
        source_quote=decision.text,
    )

    # Enrich with LLM
    task = _enrich_task(task, decision.text)

    # Persist to Supabase
    try:
        created = insert_task(task)
        task.id = created["id"]

        elapsed_ms = int((time.time() - start) * 1000)
        _log(
            "TaskCreatorAgent", "CREATE_TASK", AuditStatus.SUCCESS, run_id, elapsed_ms,
            f"Task created: {task.title}",
            output={"task_id": task.id, "title": task.title, "priority": task.priority},
        )
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        _log("TaskCreatorAgent", "CREATE_TASK", AuditStatus.FAILED, run_id, elapsed_ms,
             f"Failed to create task: {str(e)}", error=str(e))
        print(f"[TaskCreatorAgent] Error creating task: {e}")

    return task


def _generate_title(text: str) -> str:
    """Convert raw decision text to a clean task title (max 80 chars)."""
    title = text.strip()
    # Remove trailing punctuation
    title = re.sub(r'[.!?]+$', '', title)
    # Capitalize first letter
    if title:
        title = title[0].upper() + title[1:]
    return title[:80]


def _enrich_task(task: Task, decision_text: str) -> Task:
    """Use Groq to add priority, description, and acceptance criteria."""
    if DEMO_MODE:
        task.priority = TaskPriority.MEDIUM
        task.description = f"Complete the following: {decision_text}"
        task.acceptance_criteria = [
            "Task is completed as described",
            "Stakeholders have been notified",
            "Documentation updated if applicable",
        ]
        return task

    try:
        llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0.2)
        prompt = ENRICH_PROMPT.format(
            task_text=decision_text,
            owner=task.owner,
            context=task.source_meeting or "meeting discussion",
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Clean potential markdown fences
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)

        data = json.loads(raw)
        priority_str = data.get("priority", "MEDIUM").upper()
        task.priority = TaskPriority(priority_str) if priority_str in ("HIGH", "MEDIUM", "LOW") else TaskPriority.MEDIUM
        task.description = data.get("description", "")
        task.acceptance_criteria = data.get("acceptance_criteria", [])

    except Exception as e:
        print(f"[TaskCreatorAgent] Enrichment failed: {e}, using defaults")
        task.priority = _heuristic_priority(decision_text)
        task.description = f"{decision_text}"
        task.acceptance_criteria = ["Task completed as described"]

    return task


def _heuristic_priority(text: str) -> TaskPriority:
    """Fallback priority based on keywords."""
    text_lower = text.lower()
    high_keywords = ["critical", "urgent", "asap", "immediately", "production", "security", "bug", "fix", "blocker"]
    low_keywords = ["nice to have", "optional", "when possible", "low priority", "consider"]

    if any(k in text_lower for k in high_keywords):
        return TaskPriority.HIGH
    if any(k in text_lower for k in low_keywords):
        return TaskPriority.LOW
    return TaskPriority.MEDIUM


def _export_github_json(tasks: List[Task], run_id: str = None):
    """Write GitHub Issues-compatible JSON file."""
    try:
        os.makedirs("data/github_exports", exist_ok=True)
        filename = f"data/github_exports/issues_{run_id or 'latest'}.json"
        github_issues = []
        for task in tasks:
            body = task.description or ""
            if task.acceptance_criteria:
                body += "\n\n**Acceptance Criteria:**\n" + "\n".join(f"- {c}" for c in task.acceptance_criteria)
            if task.source_quote:
                body += f"\n\n**Source:**\n> {task.source_quote}"

            github_issues.append({
                "title": task.title,
                "body": body,
                "labels": [task.priority.value if task.priority else "MEDIUM", "meeting-action"],
                "assignees": [task.owner] if task.owner != "UNASSIGNED" else [],
                "milestone": task.deadline.isoformat() if task.deadline else None,
            })

        with open(filename, "w") as f:
            json.dump(github_issues, f, indent=2)
        print(f"[TaskCreatorAgent] GitHub export written to {filename}")
    except Exception as e:
        print(f"[TaskCreatorAgent] GitHub export failed: {e}")


def _log(agent, action, status, run_id, duration_ms, summary, output=None, error=None):
    try:
        insert_audit_event(AuditEvent(
            agent=agent, action=action, status=status,
            run_id=run_id, duration_ms=duration_ms,
            summary=summary, output_payload=output,
            error_message=error,
            created_at=datetime.now(timezone.utc),
        ))
    except Exception as e:
        print(f"[AuditLog Error] {e}")
