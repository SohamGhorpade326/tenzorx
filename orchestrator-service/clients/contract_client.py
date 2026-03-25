from __future__ import annotations

from typing import Any

import httpx


class ContractClient:
    def __init__(self, base_url: str, http: httpx.AsyncClient) -> None:
        self._base_url = base_url.rstrip("/")
        self._http = http

    async def start_contract(self, payload: dict[str, Any]) -> httpx.Response:
        # Contract: POST /api/contracts/runs
        return await self._http.post(f"{self._base_url}/api/contracts/runs", json=payload)
