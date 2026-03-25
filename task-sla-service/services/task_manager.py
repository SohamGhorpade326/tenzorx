from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Select, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.task import SLAState, Task, TaskCreate, TaskRead, TaskStatus, TaskUpdate


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class TaskManager:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_task(self, data: TaskCreate) -> TaskRead:
        now = utc_now()
        task = Task(
            task_id=str(uuid.uuid4()),
            workflow=data.workflow,
            step=data.step,
            status=TaskStatus.pending,
            owner=data.owner,
            created_at=now,
            deadline=as_utc_aware(data.deadline),
            retry_count=0,
            last_updated=now,
            sla_state=SLAState.ok,
            sla_reason=None,
            sla_last_checked_at=None,
            sla_last_triggered_at=None,
        )

        self.session.add(task)
        await self.session.commit()
        await self.session.refresh(task)
        return TaskRead.model_validate(task, from_attributes=True)  # type: ignore[attr-defined]

    async def list_tasks(
        self,
        *,
        status: Optional[TaskStatus] = None,
        workflow: Optional[str] = None,
    ) -> list[TaskRead]:
        stmt: Select[tuple[Task]] = select(Task)
        filters = []
        if status is not None:
            filters.append(Task.status == status)
        if workflow is not None:
            filters.append(Task.workflow == workflow)
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = stmt.order_by(Task.created_at.desc())

        rows = (await self.session.execute(stmt)).scalars().all()
        return [TaskRead.model_validate(t, from_attributes=True) for t in rows]  # type: ignore[attr-defined]

    async def get_task(self, task_id: str) -> Optional[Task]:
        return await self.session.get(Task, task_id)

    async def update_task(self, task_id: str, data: TaskUpdate) -> Optional[TaskRead]:
        task = await self.get_task(task_id)
        if task is None:
            return None

        changed = False
        if data.status is not None and data.status != task.status:
            task.status = data.status
            changed = True

        if data.retry_count is not None and data.retry_count != task.retry_count:
            task.retry_count = data.retry_count
            changed = True

        if data.status == TaskStatus.completed:
            task.sla_state = SLAState.ok
            task.sla_reason = None
            task.sla_last_triggered_at = None
            changed = True

        if changed:
            task.last_updated = utc_now()
            await self.session.commit()
            await self.session.refresh(task)

        return TaskRead.model_validate(task, from_attributes=True)  # type: ignore[attr-defined]

    async def list_candidates_for_sla_scan(self) -> list[Task]:
        # Keep scan light: only tasks that aren't completed.
        stmt = select(Task).where(Task.status != TaskStatus.completed)
        return (await self.session.execute(stmt)).scalars().all()

    async def list_by_sla_state(self, sla_state: SLAState) -> list[TaskRead]:
        stmt = select(Task).where(Task.sla_state == sla_state).order_by(Task.created_at.desc())
        rows = (await self.session.execute(stmt)).scalars().all()
        return [TaskRead.model_validate(t, from_attributes=True) for t in rows]  # type: ignore[attr-defined]

    async def list_escalated(self) -> list[TaskRead]:
        stmt = select(Task).where(Task.status == TaskStatus.escalated).order_by(Task.created_at.desc())
        rows = (await self.session.execute(stmt)).scalars().all()
        return [TaskRead.model_validate(t, from_attributes=True) for t in rows]  # type: ignore[attr-defined]
