from __future__ import annotations

from typing import Any

import httpx


class ProcurementClient:
    def __init__(self, base_url: str, http: httpx.AsyncClient) -> None:
        self._base_url = base_url.rstrip("/")
        self._http = http

    async def start_procurement(self, payload: dict[str, Any]) -> httpx.Response:
        # Procurement: POST /procurement/run
        return await self._http.post(f"{self._base_url}/procurement/run", json=payload)
