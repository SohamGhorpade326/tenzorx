from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.database import Base
from models.task import TaskRead


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(64), index=True)
    event: Mapped[str] = mapped_column(String(64))
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class AuditLogCreate(BaseModel):
    task_id: str = Field(..., min_length=1)
    event: str = Field(..., min_length=1)
    reason: Optional[str] = None


class AuditLogRead(BaseModel):
    id: int
    task_id: str
    event: str
    reason: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class SLAStatusResponse(BaseModel):
    overdue_tasks: list[TaskRead]
    stalled_tasks: list[TaskRead]
    escalated_tasks: list[TaskRead]
