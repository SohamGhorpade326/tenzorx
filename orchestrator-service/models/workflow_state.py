from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class AuditEntry:
    event: str
    decision: str
    target_service: Optional[str]
    timestamp: str
    details: dict[str, Any]


class InMemoryAuditLog:
    def __init__(self, max_entries: int = 1000) -> None:
        self._max_entries = max_entries
        self._lock = asyncio.Lock()
        self._entries: list[AuditEntry] = []

    async def append(self, entry: AuditEntry) -> None:
        async with self._lock:
            self._entries.append(entry)
            if len(self._entries) > self._max_entries:
                self._entries = self._entries[-self._max_entries :]

    async def list_recent(self, limit: int = 200) -> list[AuditEntry]:
        async with self._lock:
            return list(self._entries[-limit:])


class InMemoryWorkflowStateStore:
    """Very simple, process-local state store for global orchestration.

    Keying strategy:
    - If payload has a `correlation_id`, use it.
    - Else if it has a `run_id`, use that.
    - Else fall back to the orchestrator-generated `event_id`.

    This keeps the orchestrator deterministic while remaining compatible with
    existing services that already use `run_id`.
    """

    def __init__(self, max_events_per_workflow: int = 200) -> None:
        self._max_events = max_events_per_workflow
        self._lock = asyncio.Lock()
        self._state: dict[str, dict[str, Any]] = {}

    @staticmethod
    def compute_key(event_payload: dict[str, Any], event_id: str) -> str:
        correlation_id = event_payload.get("correlation_id")
        if isinstance(correlation_id, str) and correlation_id:
            return correlation_id
        run_id = event_payload.get("run_id")
        if isinstance(run_id, str) and run_id:
            return run_id
        return event_id

    async def upsert_event(self, *, key: str, event: dict[str, Any]) -> None:
        async with self._lock:
            state = self._state.get(key)
            if not state:
                state = {
                    "key": key,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "events": [],
                    "last_event": None,
                    "runs": {},  # service -> {run_id, status, updated_at}
                    "flags": {},
                }
                self._state[key] = state

            state["events"].append(event)
            if len(state["events"]) > self._max_events:
                state["events"] = state["events"][-self._max_events :]

            state["last_event"] = event
            state["updated_at"] = _now_iso()

    async def update_run(self, *, key: str, service: str, run_id: str, status: str) -> None:
        async with self._lock:
            state = self._state.setdefault(
                key,
                {
                    "key": key,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "events": [],
                    "last_event": None,
                    "runs": {},
                    "flags": {},
                },
            )
            state["runs"][service] = {
                "run_id": run_id,
                "status": status,
                "updated_at": _now_iso(),
            }
            state["updated_at"] = _now_iso()

    async def set_flag(self, *, key: str, flag: str, value: Any) -> None:
        async with self._lock:
            state = self._state.setdefault(
                key,
                {
                    "key": key,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "events": [],
                    "last_event": None,
                    "runs": {},
                    "flags": {},
                },
            )
            state["flags"][flag] = value
            state["updated_at"] = _now_iso()

    async def get(self, key: str) -> Optional[dict[str, Any]]:
        async with self._lock:
            value = self._state.get(key)
            return dict(value) if value else None
