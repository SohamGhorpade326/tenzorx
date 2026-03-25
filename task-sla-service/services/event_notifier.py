from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from config import HTTP_TIMEOUT_SECONDS, ORCHESTRATOR_URL, SOURCE_SERVICE_NAME

logger = logging.getLogger("task-sla-service.notifier")


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventNotifier:
    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        orchestrator_url: str = ORCHESTRATOR_URL,
        source_service: str = SOURCE_SERVICE_NAME,
    ) -> None:
        self.http = http
        self.orchestrator_url = orchestrator_url.rstrip("/")
        self.source_service = source_service

    async def post_event(self, *, event_type: str, payload: dict[str, Any], timestamp: Optional[str] = None) -> bool:
        url = f"{self.orchestrator_url}/events"
        body = {
            "event_type": event_type,
            "source_service": self.source_service,
            "payload": payload,
            "timestamp": timestamp or utc_iso(),
        }

        try:
            resp = await self.http.post(url, json=body, timeout=httpx.Timeout(HTTP_TIMEOUT_SECONDS))
            if 200 <= resp.status_code < 300:
                return True

            logger.warning("Orchestrator /events returned %s: %s", resp.status_code, resp.text)
            return False
        except Exception as e:  # noqa: BLE001
            logger.exception("Failed to notify orchestrator: %s", e)
            return False
