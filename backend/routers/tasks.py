"""FastAPI router — Tasks CRUD."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from models.schemas import TaskUpdateRequest
from db.db import get_tasks, get_task, update_task, get_task_status_history

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
def list_tasks(
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
):
    """Get all tasks with optional status/owner filters."""
    try:
        tasks = get_tasks(status=status, owner=owner, limit=limit)
        return {"tasks": tasks, "count": len(tasks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}")
def get_single_task(task_id: str):
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    history = get_task_status_history(task_id)
    return {**task, "statusHistory": history}


@router.patch("/{task_id}")
def update_single_task(task_id: str, req: TaskUpdateRequest):
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = {}
    if req.status is not None:
        updates["status"] = req.status.value
    if req.owner is not None:
        updates["owner"] = req.owner
    if req.priority is not None:
        updates["priority"] = req.priority.value
    if req.deadline is not None:
        updates["deadline"] = req.deadline.isoformat()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        updated = update_task(task_id, updates)
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
