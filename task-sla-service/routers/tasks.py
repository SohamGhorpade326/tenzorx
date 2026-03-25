from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from models.task import TaskCreate, TaskRead, TaskStatus, TaskUpdate
from services.task_manager import TaskManager

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskRead)
async def create_task(payload: TaskCreate, session: AsyncSession = Depends(get_session)) -> TaskRead:
    manager = TaskManager(session)
    return await manager.create_task(payload)


@router.get("", response_model=list[TaskRead])
async def get_tasks(
    status: Optional[TaskStatus] = None,
    workflow: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
) -> list[TaskRead]:
    manager = TaskManager(session)
    return await manager.list_tasks(status=status, workflow=workflow)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(task_id: str, payload: TaskUpdate, session: AsyncSession = Depends(get_session)) -> TaskRead:
    manager = TaskManager(session)
    updated = await manager.update_task(task_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated
