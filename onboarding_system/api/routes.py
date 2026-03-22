"""
FastAPI routes for the Onboarding workflow service.

Endpoints:
  POST /api/onboarding/runs              → start a new onboarding run
  GET  /api/onboarding/runs              → list all runs
  GET  /api/onboarding/runs/{run_id}     → get run detail
  GET  /api/onboarding/runs/{run_id}/logs → get run audit logs
"""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from db.db import get_run, list_runs, get_logs, count_logs
from models.schemas import (
    StartOnboardingRequest,
    RunResponse,
    RunDetailResponse,
    RunLogsResponse,
    LogEntry,
)
from services.workflow_service import start_onboarding_run

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


# ── Start a new run ───────────────────────────────────────────────

@router.post("/runs", status_code=status.HTTP_202_ACCEPTED)
async def create_run(body: StartOnboardingRequest):
    """Kick off a new employee onboarding workflow.
    Returns the run_id immediately — workflow executes asynchronously."""
    run_id = start_onboarding_run(body.employee_name, body.employee_id)
    return {
        "run_id": run_id,
        "status": "running",
        "message": f"Onboarding started for {body.employee_name} ({body.employee_id})",
    }


# ── List all runs ────────────────────────────────────────────────

@router.get("/runs")
async def get_runs(limit: int = 50):
    """List recent onboarding runs."""
    runs = list_runs(limit=limit)
    return {"runs": runs}


# ── Get run detail ───────────────────────────────────────────────

@router.get("/runs/{run_id}")
async def get_run_detail(run_id: str):
    """Get full detail for a single run including input/output."""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    input_data = None
    output_data = None
    if run.get("input_json"):
        try:
            input_data = json.loads(run["input_json"])
        except (json.JSONDecodeError, TypeError):
            input_data = run["input_json"]
    if run.get("output_json"):
        try:
            output_data = json.loads(run["output_json"])
        except (json.JSONDecodeError, TypeError):
            output_data = run["output_json"]

    return RunDetailResponse(
        run_id=run["run_id"],
        workflow_type=run["workflow_type"],
        status=run["status"],
        started_at=run.get("started_at"),
        completed_at=run.get("completed_at"),
        error_message=run.get("error_message"),
        input=input_data,
        output=output_data,
        logs_count=count_logs(run_id),
    )


# ── Get run logs ─────────────────────────────────────────────────

@router.get("/runs/{run_id}/logs")
async def get_run_logs(run_id: str):
    """Get all audit log entries for a run."""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    logs = get_logs(run_id)
    return RunLogsResponse(
        run_id=run_id,
        logs=[LogEntry(**entry) for entry in logs],
    )
