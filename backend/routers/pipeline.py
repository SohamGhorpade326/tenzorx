"""FastAPI router — Pipeline Runs & Human Review approval."""

from fastapi import APIRouter, HTTPException
from db.db import get_pipeline_runs, get_pipeline_run
from agents.orchestrator import signal_approval

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("/runs")
def list_pipeline_runs():
    try:
        runs = get_pipeline_runs(limit=20)
        return {"runs": runs, "count": len(runs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    run = get_pipeline_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return run


@router.post("/runs/{run_id}/approve-review")
def approve_human_review(run_id: str):
    """Signal the orchestrator to proceed past the human review gate."""
    signal_approval(run_id, approved=True)
    return {"message": "Review approved — pipeline continuing", "run_id": run_id}


@router.post("/runs/{run_id}/reject-review")
def reject_human_review(run_id: str):
    """Signal the orchestrator to abort the pipeline."""
    signal_approval(run_id, approved=False)
    return {"message": "Review rejected — pipeline aborted", "run_id": run_id}
