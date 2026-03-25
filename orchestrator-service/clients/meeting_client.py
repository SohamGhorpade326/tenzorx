from __future__ import annotations

from typing import Any

import httpx


class MeetingClient:
    def __init__(self, base_url: str, http: httpx.AsyncClient) -> None:
        self._base_url = base_url.rstrip("/")
        self._http = http

    async def update_task(self, task_id: str, patch: dict[str, Any]) -> httpx.Response:
        # MeetingMind: PATCH /api/tasks/{task_id}
        return await self._http.patch(f"{self._base_url}/api/tasks/{task_id}", json=patch)
