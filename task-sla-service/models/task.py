from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Enum as SAEnum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    escalated = "escalated"


class SLAState(str, Enum):
    ok = "ok"
    overdue = "overdue"
    stalled = "stalled"
    escalated = "escalated"


class Task(Base):
    __tablename__ = "tasks"

    task_id: Mapped[str] = mapped_column(String(64), primary_key=True)

    workflow: Mapped[str] = mapped_column(String(64), index=True)
    step: Mapped[str] = mapped_column(String(128))

    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status"),
        default=TaskStatus.pending,
        index=True,
    )

    owner: Mapped[str] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    # SLA tracking fields (monitoring layer)
    sla_state: Mapped[SLAState] = mapped_column(
        SAEnum(SLAState, name="sla_state"),
        default=SLAState.ok,
        index=True,
    )
    sla_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sla_last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# ── API Schemas ───────────────────────────────────────────────────


class TaskCreate(BaseModel):
    workflow: str = Field(..., min_length=1)
    step: str = Field(..., min_length=1)
    owner: str = Field(..., min_length=1)
    deadline: datetime


class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    retry_count: Optional[int] = Field(default=None, ge=0)


class TaskRead(BaseModel):
    task_id: str
    workflow: str
    step: str
    status: TaskStatus
    owner: str
    created_at: datetime
    deadline: datetime
    retry_count: int
    last_updated: datetime
    sla_state: SLAState
    sla_reason: Optional[str] = None
    sla_last_checked_at: Optional[datetime] = None
    sla_last_triggered_at: Optional[datetime] = None

    class Config:
        from_attributes = True
