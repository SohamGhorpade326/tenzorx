"""
TranscriptAgent
---------------
Responsibilities:
1. Accept either an audio file path OR a raw transcript string.
2. If audio: transcribe using OpenAI Whisper (local, no API cost).
3. Call Groq LLM to extract structured decisions from the transcript.
4. Return a list of Decision objects.

Key rules (never hallucinate):
  - If owner not explicitly named → owner = "UNASSIGNED"
  - If deadline is vague ("soon", "next week") → deadline = null, deadline_note = original phrase
"""

import json
import re
import time
from datetime import datetime, timezone
from typing import List, Optional

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

from config import GROQ_API_KEY, GROQ_MODEL, WHISPER_MODEL_SIZE, DEMO_MODE
from models.schemas import Decision, AuditEvent, AuditStatus
from db.db import insert_audit_event, update_meeting_transcript


SYSTEM_PROMPT = """You are a meeting analysis AI. Extract all decisions, commitments, and action items from the provided meeting transcript.

Return a JSON array with this EXACT format (no other text):
[
  {
    "text": "the commitment or decision",
    "owner": "Full Name or UNASSIGNED",
    "deadline": "YYYY-MM-DD or null",
    "deadline_note": "original phrase if deadline is vague, else null"
  }
]

Critical rules:
- owner: Use the EXACT full name as mentioned. If nobody is named, use "UNASSIGNED".
- deadline: Only set if a specific date is mentioned. Convert "March 20th" → "2026-03-20".
- deadline_note: Set to the original phrase ONLY if deadline is vague ("soon", "next week", "ASAP", "will do later", etc.). Otherwise null.
- Extract EVERY commitment, not just obvious ones. Include future tense statements too.
- Do NOT hallucinate. If unsure about owner, say UNASSIGNED."""


def run(
    transcript: str = "",
    audio_file_path: Optional[str] = None,
    run_id: Optional[str] = None,
    meeting_id: Optional[str] = None,
    attendees: Optional[List[str]] = None,
    return_transcript: bool = False,
):
    start = time.time()
    agent_name = "TranscriptAgent"

    # Step 1: Transcribe audio if provided
    if audio_file_path and not transcript:
        transcript = _transcribe_audio(audio_file_path, run_id)

    if not transcript.strip():
        _log(agent_name, "EXTRACT_DECISIONS", AuditStatus.FAILED,
             run_id, 0, "Empty transcript provided", error="No transcript or audio provided")
        return ([], "") if return_transcript else []

    # Persist transcript for downstream views/summary context.
    if meeting_id:
        try:
            update_meeting_transcript(meeting_id, transcript)
        except Exception as e:
            print(f"[TranscriptAgent] Failed to persist transcript: {e}")

    # Step 2: Extract decisions via LLM
    decisions = _extract_decisions(transcript, run_id, meeting_id, attendees=attendees)

    elapsed_ms = int((time.time() - start) * 1000)
    _log(
        agent_name, "EXTRACT_DECISIONS", AuditStatus.SUCCESS,
        run_id, elapsed_ms,
        f"{len(decisions)} decisions extracted",
        output={"decisions_count": len(decisions), "decisions": [d.text for d in decisions]},
    )
    return (decisions, transcript) if return_transcript else decisions


def _transcribe_audio(audio_path: str, run_id: Optional[str]) -> str:
    """Run Whisper locally to transcribe audio file."""
    start = time.time()
    try:
        import whisper
        print(f"[TranscriptAgent] Loading Whisper model ({WHISPER_MODEL_SIZE})...")
        model = whisper.load_model(WHISPER_MODEL_SIZE)
        result = model.transcribe(audio_path)
        transcript = result["text"]
        elapsed_ms = int((time.time() - start) * 1000)
        _log(
            "TranscriptAgent", "TRANSCRIBE_AUDIO", AuditStatus.SUCCESS,
            run_id, elapsed_ms, f"Transcribed {len(transcript)} chars from audio",
            output={"char_count": len(transcript)},
        )
        return transcript
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        _log("TranscriptAgent", "TRANSCRIBE_AUDIO", AuditStatus.FAILED,
             run_id, elapsed_ms, f"Whisper failed: {str(e)}", error=str(e))
        raise


def _extract_decisions(
    transcript: str,
    run_id: Optional[str],
    meeting_id: Optional[str],
    attendees: Optional[List[str]] = None,
) -> List[Decision]:
    """Call Groq LLM to extract structured decisions."""
    if DEMO_MODE:
        return _demo_decisions(meeting_id, run_id)

    known_names = _known_participants(transcript, attendees)
    participants_hint = "\n".join(f"- {n}" for n in known_names) if known_names else "- Unknown"

    llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT + "\n\nParticipant candidates:\n" + participants_hint),
        HumanMessage(content=f"TRANSCRIPT:\n\n{transcript}"),
    ]

    retry_count = 0
    max_retries = 2
    while retry_count <= max_retries:
        try:
            response = llm.invoke(messages)
            raw = response.content.strip()

            # Extract JSON array from response
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            if not match:
                raise ValueError("No JSON array found in response")

            items = json.loads(match.group())
            decisions = []
            for item in items:
                text = (item.get("text") or "").strip()
                if len(text) < 8:
                    continue

                owner = (item.get("owner") or "UNASSIGNED").strip()
                owner = _normalize_owner(owner, known_names)

                d = Decision(
                    meeting_id=meeting_id,
                    run_id=run_id,
                    text=text,
                    owner=owner,
                    deadline_note=item.get("deadline_note"),
                )
                raw_deadline = item.get("deadline")
                if raw_deadline and raw_deadline != "null":
                    try:
                        from datetime import date
                        d.deadline = date.fromisoformat(raw_deadline)
                    except ValueError:
                        d.deadline_note = raw_deadline
                decisions.append(d)
            return decisions

        except Exception as e:
            retry_count += 1
            if retry_count > max_retries:
                _log("TranscriptAgent", "EXTRACT_DECISIONS", AuditStatus.FAILED,
                     run_id, 0, f"LLM extraction failed after {max_retries} retries", error=str(e))
                return []
            _log("TranscriptAgent", "EXTRACT_DECISIONS", AuditStatus.RETRY,
                 run_id, 0, f"Retry {retry_count}: {str(e)}", retry_count=retry_count)
            time.sleep(1)


def _demo_decisions(meeting_id: Optional[str], run_id: Optional[str]) -> List[Decision]:
    """Return hardcoded decisions for demo/testing mode."""
    from datetime import date
    return [
        Decision(meeting_id=meeting_id, run_id=run_id,
                 text="Prepare Q3 financial report", owner="Priya Sharma",
                 deadline=date(2026, 3, 20)),
        Decision(meeting_id=meeting_id, run_id=run_id,
                 text="Update API documentation", owner="Rahul Mehta",
                 deadline=date(2026, 3, 22)),
        Decision(meeting_id=meeting_id, run_id=run_id,
                 text="Schedule vendor review meeting", owner="Ananya Singh",
                 deadline_note="next Thursday"),
        Decision(meeting_id=meeting_id, run_id=run_id,
                 text="Fix critical authentication bug in production", owner="Karan Patel",
                 deadline=date(2026, 3, 18)),
    ]


def _known_participants(transcript: str, attendees: Optional[List[str]]) -> List[str]:
    names = set()

    if attendees:
        for name in attendees:
            cleaned = (name or "").strip()
            if cleaned:
                names.add(cleaned)

    speaker_pattern = re.compile(r"^\s*([A-Za-z][A-Za-z .'-]{1,40})\s*:", re.MULTILINE)
    for match in speaker_pattern.finditer(transcript or ""):
        candidate = match.group(1).strip()
        if len(candidate.split()) <= 5:
            names.add(candidate)

    return sorted(names)


def _normalize_owner(owner: str, known_names: List[str]) -> str:
    if not owner:
        return "UNASSIGNED"

    if owner.upper() == "UNASSIGNED":
        return "UNASSIGNED"

    if not known_names:
        return owner

    lower = owner.lower()
    for name in known_names:
        if lower == name.lower():
            return name

    owner_tokens = set(lower.split())
    best_name = None
    best_overlap = 0
    for name in known_names:
        name_tokens = set(name.lower().split())
        overlap = len(owner_tokens & name_tokens)
        if overlap > best_overlap:
            best_overlap = overlap
            best_name = name

    if best_name and best_overlap > 0:
        return best_name

    return "UNASSIGNED"


def _log(agent: str, action: str, status: AuditStatus, run_id, duration_ms: int,
         summary: str, output: dict = None, error: str = None, retry_count: int = 0):
    try:
        insert_audit_event(AuditEvent(
            agent=agent, action=action, status=status,
            run_id=run_id, duration_ms=duration_ms,
            summary=summary, output_payload=output,
            error_message=error, retry_count=retry_count,
            created_at=datetime.now(timezone.utc),
        ))
    except Exception as e:
        print(f"[AuditLog Error] {e}")
