from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from models.sla import SLAStatusResponse
from models.task import TaskRead

router = APIRouter(prefix="/sla", tags=["sla"])


@router.get("/status", response_model=SLAStatusResponse)
async def sla_status(request: Request, session: AsyncSession = Depends(get_session)) -> SLAStatusResponse:
    monitor = request.app.state.sla_monitor
    cached = await monitor.get_cached_sla_status(session)
    return SLAStatusResponse(
        overdue_tasks=[TaskRead(**t) for t in cached["overdue"]],
        stalled_tasks=[TaskRead(**t) for t in cached["stalled"]],
        escalated_tasks=[TaskRead(**t) for t in cached["escalated"]],
    )
