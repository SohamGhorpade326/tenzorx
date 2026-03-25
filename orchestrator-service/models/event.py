from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class Event(BaseModel):
    """Inbound event sent by workflow services (or other ERP components)."""

    event_type: str = Field(..., min_length=1)
    source_service: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
