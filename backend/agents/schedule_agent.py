"""ScheduleAgent
----------------
Extracts future meeting dates from transcript text and stores them for calendar views.
"""

import re
from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

from db.db import insert_meeting_schedule_event, get_meeting


_MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


_SCHEDULE_HINTS = (
    "next meeting",
    "follow up meeting",
    "follow-up meeting",
    "next sync",
    "next call",
    "meet again",
    "scheduled for",
    "meeting is on",
    "meeting will be held",
    "let us meet on",
    "we will meet on",
)

_WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def extract_schedule_events(transcript: str) -> List[Tuple[str, str]]:
    """Return list of (event_date_iso, source_text) from schedule-related lines."""
    if not transcript or not transcript.strip():
        return []

    chunks = [c.strip() for c in re.split(r"[\n.!?]+", transcript) if c.strip()]
    extracted: List[Tuple[str, str]] = []
    seen = set()

    for chunk in chunks:
        if not _looks_like_schedule_line(chunk):
            continue
        event_date = _extract_date(chunk)
        if not event_date:
            continue
        key = (event_date.isoformat(), chunk.lower())
        if key in seen:
            continue
        seen.add(key)
        extracted.append((event_date.isoformat(), chunk))

    return extracted


def save_schedule_events(
    meeting_id: str,
    transcript: str,
    run_id: Optional[str] = None,
    source_title: Optional[str] = None,
) -> int:
    """Extract and store schedule events; returns number of inserted rows."""
    rows = extract_schedule_events(transcript)
    meeting = get_meeting(meeting_id) or {}
    decided_date = meeting.get("date")
    if not decided_date:
        created_at = (meeting.get("created_at") or "")[:10]
        decided_date = created_at or None

    decided_title = source_title or meeting.get("title")

    saved = 0
    for event_date, source_text in rows:
        inserted = insert_meeting_schedule_event(
            meeting_id=meeting_id,
            run_id=run_id,
            event_date=event_date,
            source_text=source_text,
            source_title=source_title,
            decided_in_meeting_title=decided_title,
            decided_in_meeting_date=decided_date,
        )
        if inserted:
            saved += 1
    return saved


def _looks_like_schedule_line(text: str) -> bool:
    lower = text.lower()
    return any(hint in lower for hint in _SCHEDULE_HINTS)


def _extract_date(text: str) -> Optional[date]:
    # 2026-03-29
    m = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text)
    if m:
        return _build_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))

    # 29th March, 2026 | 29 March 2026
    m = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\s*,?\s*(\d{4})?\b",
        text,
        flags=re.IGNORECASE,
    )
    if m:
        day = int(m.group(1))
        month = _MONTHS.get(m.group(2).lower())
        year = int(m.group(3)) if m.group(3) else datetime.now().year
        if month:
            return _build_date(year, month, day)

    # March 29th, 2026 | March 29, 2026
    m = re.search(
        r"\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})?\b",
        text,
        flags=re.IGNORECASE,
    )
    if m:
        month = _MONTHS.get(m.group(1).lower())
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else datetime.now().year
        if month:
            return _build_date(year, month, day)

    # next Monday
    m = re.search(r"\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", text, flags=re.IGNORECASE)
    if m:
        target_weekday = _WEEKDAY_MAP[m.group(1).lower()]
        return _next_weekday(datetime.now().date(), target_weekday)

    return None


def _build_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _next_weekday(start_date: date, target_weekday: int) -> date:
    days_ahead = (target_weekday - start_date.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return start_date + timedelta(days=days_ahead)
