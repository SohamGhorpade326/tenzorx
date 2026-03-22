from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import date, datetime
from enum import Enum


# ─────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    AT_RISK = "AT_RISK"
    OVERDUE = "OVERDUE"
    DONE = "DONE"
    BLOCKED = "BLOCKED"


class TaskPriority(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PipelineStatus(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class AuditStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    RETRY = "RETRY"
    SKIPPED = "SKIPPED"


class EscalationStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    SENT = "SENT"
    REJECTED = "REJECTED"


# ─────────────────────────────────────────────────
# Core Models
# ─────────────────────────────────────────────────

class Decision(BaseModel):
    id: Optional[str] = None
    meeting_id: Optional[str] = None
    run_id: Optional[str] = None
    text: str
    owner: Optional[str] = "UNASSIGNED"
    deadline: Optional[date] = None
    deadline_note: Optional[str] = None
    flagged: bool = False
    flag_reason: Optional[str] = None
    is_actionable: bool = True


class Task(BaseModel):
    id: Optional[str] = None
    decision_id: Optional[str] = None
    meeting_id: Optional[str] = None
    run_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    owner: str = "UNASSIGNED"
    deadline: Optional[date] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    acceptance_criteria: Optional[List[str]] = None
    source_quote: Optional[str] = None
    decision_context: Optional[str] = None
    source_meeting: Optional[str] = None
    last_status_change: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TaskStatusHistoryEntry(BaseModel):
    status: TaskStatus
    changed_at: datetime
    changed_by: str = "System"
    reason: Optional[str] = None


class AuditEvent(BaseModel):
    id: Optional[str] = None
    run_id: Optional[str] = None
    agent: str
    action: str
    status: AuditStatus = AuditStatus.SUCCESS
    duration_ms: Optional[int] = None
    summary: Optional[str] = None
    input_payload: Optional[Any] = None
    output_payload: Optional[Any] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: Optional[datetime] = None


class Escalation(BaseModel):
    id: Optional[str] = None
    task_id: Optional[str] = None
    task_title: str
    owner: str
    overdue_by_days: int = 0
    deadline: Optional[date] = None
    source_meeting: Optional[str] = None
    message: str
    status: EscalationStatus = EscalationStatus.PENDING_APPROVAL
    approved_by: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class PipelineRun(BaseModel):
    id: str
    meeting_id: Optional[str] = None
    meeting_title: str
    status: PipelineStatus = PipelineStatus.RUNNING
    tasks_created: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None


# ─────────────────────────────────────────────────
# LangGraph Pipeline State
# ─────────────────────────────────────────────────

class PipelineState(BaseModel):
    run_id: str
    meeting_id: Optional[str] = None
    meeting_title: str = "Untitled Meeting"
    transcript: str = ""
    decisions: List[Decision] = Field(default_factory=list)
    validated_decisions: List[Decision] = Field(default_factory=list)
    review_items: List[dict] = Field(default_factory=list)
    tasks: List[Task] = Field(default_factory=list)
    escalations: List[Escalation] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    status: str = "STARTED"
    current_step: str = ""
    retry_count: int = 0


# ─────────────────────────────────────────────────
# API Request/Response Models
# ─────────────────────────────────────────────────

class ProcessTranscriptRequest(BaseModel):
    transcript: str
    title: str = "Untitled Meeting"
    date: Optional[str] = None
    attendees: Optional[List[str]] = None


class ProcessTranscriptResponse(BaseModel):
    run_id: str
    meeting_id: str
    message: str = "Pipeline started"
    status: str = "RUNNING"


class TaskUpdateRequest(BaseModel):
    status: Optional[TaskStatus] = None
    owner: Optional[str] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[date] = None


class EscalationActionRequest(BaseModel):
    approved_by: Optional[str] = "Human Reviewer"


class DashboardResponse(BaseModel):
    total_tasks: int
    overdue_count: int
    at_risk_count: int
    done_count: int
    escalations_sent: int
    recent_pipeline_runs: List[PipelineRun]
    task_status_distribution: List[dict]
    agent_activity: List[dict]
