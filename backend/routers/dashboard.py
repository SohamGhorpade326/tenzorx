"""FastAPI router — Dashboard metrics."""

from fastapi import APIRouter, HTTPException
from db.db import get_dashboard_metrics

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard():
    """Return aggregated dashboard metrics."""
    try:
        return get_dashboard_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
