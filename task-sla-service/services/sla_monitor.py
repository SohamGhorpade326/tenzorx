from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from config import CACHE_TTL_SECONDS, MAX_RETRIES, STALL_THRESHOLD_SECONDS
from models.sla import AuditLog
from models.task import SLAState, Task, TaskStatus
from services.event_notifier import EventNotifier
from services.task_manager import TaskManager

logger = logging.getLogger("task-sla-service.sla")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Return a timezone-aware UTC datetime.

    SQLite often returns naive datetimes; treat those as UTC.
    """

    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@dataclass(frozen=True)
class SLAEvaluation:
    sla_state: SLAState
    reason: Optional[str]
    should_escalate_status: bool = False


class SLAMonitor:
    def __init__(
        self,
        *,
        notifier: EventNotifier,
        cache_ttl_seconds: int = CACHE_TTL_SECONDS,
    ) -> None:
        self.notifier = notifier
        self.cache_ttl_seconds = cache_ttl_seconds
        self._status_cache: tuple[float, dict[str, list[dict]] | None] = (0.0, None)
        self._lock = asyncio.Lock()

    def _evaluate_task(self, task: Task, now: datetime) -> SLAEvaluation:
        if task.status == TaskStatus.completed:
            return SLAEvaluation(SLAState.ok, None)

        if task.retry_count > MAX_RETRIES:
            return SLAEvaluation(
                SLAState.escalated,
                f"retry_count {task.retry_count} exceeded max {MAX_RETRIES}",
                should_escalate_status=True,
            )

        deadline = as_utc_aware(task.deadline)
        if deadline is not None and now > deadline:
            return SLAEvaluation(SLAState.overdue, "deadline exceeded")

        last_updated = as_utc_aware(task.last_updated)
        inactivity_s = (now - last_updated).total_seconds() if last_updated else 0
        if inactivity_s > STALL_THRESHOLD_SECONDS and task.status in (TaskStatus.pending, TaskStatus.in_progress):
            return SLAEvaluation(SLAState.stalled, f"inactive for {int(inactivity_s)}s")

        return SLAEvaluation(SLAState.ok, None)

    async def check_and_handle(self, session: AsyncSession) -> None:
        now = utc_now()
        manager = TaskManager(session)
        tasks = await manager.list_candidates_for_sla_scan()

        triggered = 0
        for task in tasks:
            evaluation = self._evaluate_task(task, now)

            # If the monitor determines escalation, update task status.
            if evaluation.should_escalate_status and task.status != TaskStatus.escalated:
                task.status = TaskStatus.escalated

            # Only trigger orchestrator + audit when SLA state transitions into a non-ok state.
            state_changed = evaluation.sla_state != task.sla_state
            entering_violation = evaluation.sla_state in (SLAState.overdue, SLAState.stalled, SLAState.escalated)

            if state_changed:
                task.sla_state = evaluation.sla_state
                task.sla_reason = evaluation.reason
                task.sla_last_checked_at = now

            if state_changed and entering_violation:
                # Avoid spamming: only send once per transition.
                ok = await self.notifier.post_event(
                    event_type="task.sla_breached",
                    payload={
                        "task_id": task.task_id,
                        "workflow": task.workflow,
                        "step": task.step,
                        "reason": evaluation.reason or "sla breach",
                        "sla_state": evaluation.sla_state.value,
                        "status": task.status.value,
                        "retry_count": task.retry_count,
                        "deadline": as_utc_aware(task.deadline).isoformat() if task.deadline else None,
                        "last_updated": as_utc_aware(task.last_updated).isoformat() if task.last_updated else None,
                    },
                )

                task.sla_last_triggered_at = now
                session.add(
                    AuditLog(
                        task_id=task.task_id,
                        event="SLA Breach",
                        reason=evaluation.reason or "sla breach",
                        timestamp=now,
                    )
                )

                triggered += 1
                logger.info(
                    "SLA trigger task_id=%s sla_state=%s orchestrator_ok=%s reason=%s",
                    task.task_id,
                    evaluation.sla_state.value,
                    ok,
                    evaluation.reason,
                )

        await session.commit()

        # Invalidate cache after a run.
        self._status_cache = (0.0, None)

        if triggered:
            logger.info("SLA check completed: %s triggers", triggered)

    async def get_cached_sla_status(self, session: AsyncSession) -> dict[str, list[dict]]:
        async with self._lock:
            now_monotonic = asyncio.get_running_loop().time()
            cached_at, cached = self._status_cache
            if cached is not None and (now_monotonic - cached_at) <= self.cache_ttl_seconds:
                return cached

            manager = TaskManager(session)
            overdue = await manager.list_by_sla_state(SLAState.overdue)
            stalled = await manager.list_by_sla_state(SLAState.stalled)
            escalated = await manager.list_escalated()

            # Store as plain dicts for a tiny cache footprint.
            payload = {
                "overdue": [t.model_dump() for t in overdue],
                "stalled": [t.model_dump() for t in stalled],
                "escalated": [t.model_dump() for t in escalated],
            }
            self._status_cache = (now_monotonic, payload)
            return payload
