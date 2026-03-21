"""
ValidatorAgent
--------------
Responsibilities:
1. Rule-based checks: no owner, no deadline, duplicate detection.
2. LLM check: is this a real actionable task or just an observation?
3. Returns validated_decisions (clean list) + review_items (flagged for human review).

This is the compliance gate — every item that fails rules OR LLM check goes into review.
"""

import json
import re
import time
from datetime import datetime, timezone
from typing import List, Tuple

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

from config import GROQ_API_KEY, GROQ_MODEL, DEMO_MODE
from models.schemas import Decision, AuditEvent, AuditStatus
from db.db import insert_audit_event


ACTIONABILITY_PROMPT = """You are a meeting analyst. For each item below, determine if it is a genuine actionable task (someone must DO something) or just an observation / statement of fact.

Return a JSON array with the same length, where each item is:
{{"index": 0, "is_actionable": true/false, "reason": "brief explanation"}}

Items:
{items}

Be strict: vague aspirations without a clear owner/action = not actionable."""


def run(
    decisions: List[Decision],
    run_id: str = None,
) -> Tuple[List[Decision], List[dict]]:
    """
    Returns:
        validated_decisions: list of clean, actionable decisions
        review_items: list of dicts describing flagged items for human review
    """
    start = time.time()
    if not decisions:
        return [], []

    # Step 1: Rule-based checks
    flagged, clean = _rule_check(decisions)

    # Step 2: Duplicate detection on clean items
    clean, merged = _deduplicate(clean)

    # Step 3: LLM actionability check
    validated, non_actionable = _llm_check(clean, run_id)

    # Collect all review items
    review_items = flagged + merged + non_actionable

    elapsed_ms = int((time.time() - start) * 1000)
    _log(
        "ValidatorAgent", "VALIDATE_ITEMS", AuditStatus.SUCCESS, run_id, elapsed_ms,
        f"{len(validated)} valid, {len(review_items)} flagged for review",
        output={
            "valid": len(validated),
            "flagged": len(review_items),
            "review_items": review_items,
        },
    )

    return validated, review_items


def _rule_check(decisions: List[Decision]) -> Tuple[List[dict], List[Decision]]:
    """Rule-based validation: flag missing owner / missing deadline."""
    flagged = []
    clean = []

    for dec in decisions:
        issues = []

        if not dec.owner or dec.owner == "UNASSIGNED":
            issues.append("no_owner")

        if dec.deadline is None and not dec.deadline_note:
            issues.append("no_deadline")

        if issues:
            dec.flagged = True
            flag_parts = []
            if "no_owner" in issues:
                flag_parts.append("Missing owner")
            if "no_deadline" in issues:
                flag_parts.append("Missing deadline")
            dec.flag_reason = " | ".join(flag_parts)

            flagged.append({
                "issue": dec.flag_reason,
                "text": dec.text,
                "suggestedFix": _suggest_fix(dec, issues),
                "decision": dec.model_dump(mode="json"),
            })

        clean.append(dec)  # Keep all — flagged items still go to task creation

    return flagged, clean


def _suggest_fix(dec: Decision, issues: List[str]) -> str:
    suggestions = []
    if "no_owner" in issues:
        suggestions.append("Assign an owner")
    if "no_deadline" in issues:
        suggestions.append("Set a specific deadline date")
    return " | ".join(suggestions)


def _deduplicate(decisions: List[Decision]) -> Tuple[List[Decision], List[dict]]:
    """Simple fuzzy deduplication based on text similarity."""
    merged = []
    seen_texts = []
    unique = []

    for dec in decisions:
        is_dup = False
        for seen in seen_texts:
            if _similarity(dec.text, seen) > 0.75:
                merged.append({
                    "issue": "Possible duplicate",
                    "text": dec.text,
                    "suggestedFix": f"Merge with: \"{seen}\"",
                })
                is_dup = True
                break
        if not is_dup:
            seen_texts.append(dec.text)
            unique.append(dec)

    return unique, merged


def _similarity(a: str, b: str) -> float:
    """Word-overlap based similarity."""
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / max(len(words_a), len(words_b))


def _llm_check(decisions: List[Decision], run_id: str = None) -> Tuple[List[Decision], List[dict]]:
    """Use Groq to check if each decision is genuinely actionable."""
    if DEMO_MODE or not decisions:
        return decisions, []

    try:
        llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0)
        items_str = json.dumps([{"index": i, "text": d.text} for i, d in enumerate(decisions)], indent=2)

        response = llm.invoke([
            SystemMessage(content=ACTIONABILITY_PROMPT.format(items=items_str)),
            HumanMessage(content="Classify these items."),
        ])
        raw = response.content.strip()
        match = re.search(r'\[.*\]', raw, re.DOTALL)

        if match:
            results = json.loads(match.group())
            # Be defensive: model output may miss "index" or return non-int values.
            index_map = {}
            non_actionable_indices = set()
            for pos, item in enumerate(results):
                if not isinstance(item, dict):
                    continue
                raw_index = item.get("index", pos)
                try:
                    idx = int(raw_index)
                except (TypeError, ValueError):
                    continue
                index_map[idx] = item
                if not item.get("is_actionable", True):
                    non_actionable_indices.add(idx)

            validated = []
            non_actionable = []
            for i, dec in enumerate(decisions):
                if i in non_actionable_indices:
                    reason = index_map.get(i, {}).get("reason", "")
                    non_actionable.append({
                        "issue": "Not actionable (observation)",
                        "text": dec.text,
                        "suggestedFix": f"Consider removing: {reason}",
                    })
                else:
                    validated.append(dec)
            return validated, non_actionable

    except Exception as e:
        print(f"[ValidatorAgent] LLM check failed: {e}, skipping actionability check")

    return decisions, []


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
