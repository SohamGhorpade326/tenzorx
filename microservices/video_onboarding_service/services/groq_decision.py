"""Groq (OpenAI-compatible) decision service.

Implements raw HTTP (no SDK) to Groq's /openai/v1/chat/completions endpoint.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict

import requests

from config import DEMO_MODE, GROQ_API_KEY, GROQ_MODEL, GROQ_TEMPERATURE

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"


def _infer_requested_loan_amount_range(data: Dict[str, Any]) -> str | None:
    """Infer a user-requested loan amount (or range) from captured responses.

    The UI expects a human-readable string; if Groq doesn't return a range,
    showing the applicant's stated amount is better than a dash.
    """

    responses = data.get("responses") or []
    if not isinstance(responses, list):
        return None

    for item in responses:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or "")
        answer = str(item.get("answer") or "").strip()
        if not answer:
            continue
        if "loan amount" in question.lower():
            return answer
    return None


def fallback_decision(data: Dict[str, Any]) -> Dict[str, Any]:
    age_difference = data.get("age_difference")
    try:
        age_difference = int(age_difference) if age_difference is not None else None
    except Exception:
        age_difference = None

    loan_amount_range = _infer_requested_loan_amount_range(data)

    if age_difference is not None and age_difference > 10:
        return {
            "category": "Conditionally Eligible",
            "reason": "Age mismatch detected",
            "risk_level": "High",
            "loan_amount_range": loan_amount_range,
            "confidence": 60,
        }

    return {
        "category": "Eligible",
        "reason": "Basic criteria satisfied",
        "risk_level": "Low",
        "loan_amount_range": loan_amount_range,
        "confidence": 70,
    }


def _build_prompt(user_session_data: Dict[str, Any]) -> str:
    return (
        "You are a loan risk assessment system.\n\n"
        "Classify the user into:\n"
        "- Eligible\n"
        "- Conditionally Eligible\n"
        "- Not Eligible\n\n"
        "Also return:\n"
        "- reason\n"
        "- risk_level (Low/Medium/High)\n"
        "- loan_amount_range (if applicable)\n"
        "- confidence (0-100)\n\n"
        "Rules:\n"
        "- Age mismatch > 10 years = High risk\n"
        "- Missing income or documents = Conditional\n"
        "- Low income + existing loans = Not Eligible\n"
        "- Otherwise = Eligible\n\n"
        "Return ONLY valid JSON (no markdown, no text outside JSON).\n\n"
        "DATA:\n"
        f"{json.dumps(user_session_data, ensure_ascii=False)}\n"
    )


def _extract_json(text: str) -> Dict[str, Any]:
    """Extract and parse a JSON object from a model response."""
    s = (text or "").strip()

    # Strip common markdown code fences
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
        s = s.strip()

    # Try direct parse first
    try:
        return json.loads(s)
    except Exception:
        pass

    # Fallback: find the first JSON object in the string
    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        raise ValueError("No JSON object found")

    return json.loads(m.group(0))


def _normalize_decision(raw: Dict[str, Any]) -> Dict[str, Any]:
    category = str(raw.get("category") or raw.get("status") or "").strip() or "Eligible"
    if category.lower() in {"conditional", "conditionally"}:
        category = "Conditionally Eligible"

    risk_level = str(raw.get("risk_level") or "Low").strip().title()
    if risk_level.lower() in {"low", "medium", "high"}:
        risk_level = risk_level[0].upper() + risk_level[1:].lower()

    reason = str(raw.get("reason") or "").strip() or "Basic criteria satisfied"

    loan_amount_range = raw.get("loan_amount_range")
    if loan_amount_range is not None:
        loan_amount_range = str(loan_amount_range).strip() or None

    confidence = raw.get("confidence")
    try:
        confidence_int = int(float(confidence))
    except Exception:
        confidence_int = 0
    confidence_int = max(0, min(100, confidence_int))

    return {
        "category": category,
        "reason": reason,
        "risk_level": risk_level,
        "loan_amount_range": loan_amount_range,
        "confidence": confidence_int,
    }


def get_decision_from_groq(user_session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Get a decision from Groq; always returns a dict (fallback on failure)."""

    if DEMO_MODE or not GROQ_API_KEY:
        return fallback_decision(user_session_data)

    prompt = _build_prompt(user_session_data)

    try:
        res = requests.post(
            GROQ_CHAT_COMPLETIONS_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "temperature": GROQ_TEMPERATURE,
                "max_tokens": 512,
                "messages": [
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=25,
        )

        if res.status_code >= 400:
            return fallback_decision(user_session_data)

        data = res.json()
        content = (
            (((data.get("choices") or [])[0] or {}).get("message") or {}).get("content")
            if isinstance(data, dict)
            else None
        )
        parsed = _extract_json(content or "")
        decision = _normalize_decision(parsed)

        if not decision.get("loan_amount_range"):
            inferred = _infer_requested_loan_amount_range(user_session_data)
            if inferred:
                decision["loan_amount_range"] = inferred

        return decision
    except Exception:
        return fallback_decision(user_session_data)
