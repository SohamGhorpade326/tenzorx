"""FastAPI router — Escalations."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from models.schemas import EscalationActionRequest
from db.db import get_escalations, update_escalation_status, get_task

router = APIRouter(prefix="/api/escalations", tags=["escalations"])


@router.get("")
def list_escalations(status: Optional[str] = Query(None)):
    try:
        escalations = get_escalations(status=status)
        return {"escalations": escalations, "count": len(escalations)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{escalation_id}/approve")
def approve_escalation(escalation_id: str, req: EscalationActionRequest = None):
    """Approve and mock-send an escalation."""
    try:
        approved_by = (req.approved_by if req else None) or "Human Reviewer"
        updated = update_escalation_status(escalation_id, "SENT", approved_by=approved_by)
        if not updated:
            raise HTTPException(status_code=404, detail="Escalation not found")
        return {"message": "Escalation approved and sent", "escalation": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{escalation_id}/reject")
def reject_escalation(escalation_id: str):
    """Reject an escalation (will not be sent)."""
    try:
        updated = update_escalation_status(escalation_id, "REJECTED")
        if not updated:
            raise HTTPException(status_code=404, detail="Escalation not found")
        return {"message": "Escalation rejected", "escalation": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
