"""Pydantic request / response schemas for the onboarding API."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Requests ──────────────────────────────────────────────────────

class StartOnboardingRequest(BaseModel):
    employee_name: str = Field(..., min_length=1, description="Full name of the new hire")
    employee_id: str = Field(..., min_length=1, description="Employee ID, e.g. E-10023")


# ── Responses ─────────────────────────────────────────────────────

class RunSummary(BaseModel):
    run_id: str
    workflow_type: str = "onboarding"
    status: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class RunResponse(RunSummary):
    logs_count: int = 0


class RunDetailResponse(RunSummary):
    input: Optional[dict[str, Any]] = None
    output: Optional[dict[str, Any]] = None
    logs_count: int = 0


class LogEntry(BaseModel):
    id: int
    run_id: str
    step: Optional[str] = None
    agent: Optional[str] = None
    decision: Optional[str] = None
    reason: Optional[str] = None
    meta: Optional[dict[str, Any]] = None
    timestamp: Optional[str] = None


class RunLogsResponse(BaseModel):
    run_id: str
    logs: list[LogEntry]
