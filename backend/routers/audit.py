"""FastAPI router — Audit Events."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from db.db import get_audit_events
import csv
import io
import json

router = APIRouter(prefix="/api/audit-events", tags=["audit"])


@router.get("")
def list_audit_events(
    agent: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    run_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
):
    try:
        events = get_audit_events(agent=agent, status=status, run_id=run_id, search=search, limit=limit)
        # Format duration for frontend (convert ms to string like "1.2s")
        for e in events:
            ms = e.get("duration_ms") or 0
            e["duration"] = f"{ms / 1000:.1f}s"
        return {"events": events, "count": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/csv")
def export_csv(run_id: Optional[str] = Query(None)):
    events = get_audit_events(run_id=run_id, limit=1000)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "created_at", "run_id", "agent", "action", "status", "duration_ms", "summary"])
    writer.writeheader()
    for e in events:
        writer.writerow({k: e.get(k, "") for k in writer.fieldnames})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_events.csv"},
    )


@router.get("/export/json")
def export_json(run_id: Optional[str] = Query(None)):
    events = get_audit_events(run_id=run_id, limit=1000)
    return StreamingResponse(
        iter([json.dumps(events, indent=2, default=str)]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=audit_events.json"},
    )
