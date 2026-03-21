"""FastAPI router — calendar events extracted from transcripts."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from db.db import get_meeting_schedule_events

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events")
def list_calendar_events(
    start_date: Optional[str] = Query(None, description="Inclusive start date in YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Inclusive end date in YYYY-MM-DD"),
    meeting_id: Optional[str] = Query(None),
    limit: int = Query(500, le=1000),
):
    try:
        events = get_meeting_schedule_events(
            start_date=start_date,
            end_date=end_date,
            meeting_id=meeting_id,
            limit=limit,
        )
        return {"events": events, "count": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
