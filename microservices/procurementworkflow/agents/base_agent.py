"""
BaseAgent — every procurement agent inherits from this.
Provides: run() wrapper, audit logging, retry logic, Ollama LLM call helper.
"""
import json
import time
import uuid
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx

from config import OLLAMA_BASE_URL, OLLAMA_MODEL
from db.db import write_audit, now_iso
from models.enums import AuditStatus
from models.schemas import AuditEvent


class AgentException(Exception):
    """Raised when an agent cannot recover and must escalate."""
    pass


class BaseAgent(ABC):
    name: str = "BaseAgent"

    def __init__(self, run_id: str):
        self.run_id = run_id

    # ── Public entry point ─────────────────────────────────────────

    def run(self, *args, **kwargs) -> Any:
        """
        Wraps execute() with audit logging and top-level error catching.
        All agents call agent.run(...) — never execute() directly.
        """
        self._log(f"{self.name.upper()}_STARTED", AuditStatus.INFO, payload=kwargs or {})
        try:
            result = self.execute(*args, **kwargs)
            self._log(f"{self.name.upper()}_COMPLETED", AuditStatus.SUCCESS,
                      payload=result if isinstance(result, dict) else {})
            return result
        except AgentException as e:
            self._log(f"{self.name.upper()}_FAILED", AuditStatus.FAILURE, error=str(e))
            raise
        except Exception as e:
            self._log(f"{self.name.upper()}_ERROR", AuditStatus.FAILURE, error=str(e))
            raise AgentException(f"{self.name} unexpected error: {e}") from e

    # ── Must implement ─────────────────────────────────────────────

    @abstractmethod
    def execute(self, *args, **kwargs) -> Any:
        pass

    # ── Retry helper ───────────────────────────────────────────────

    def run_with_retry(self, fn, max_retries: int = 3, delay: int = 2, **kwargs) -> Any:
        """
        Retries fn() up to max_retries times with exponential backoff.
        Logs each retry attempt to audit trail.
        """
        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                return fn(**kwargs)
            except Exception as e:
                last_error = e
                self._log(
                    f"RETRY_ATTEMPT_{attempt}", AuditStatus.RETRY,
                    payload={"attempt": attempt, "max": max_retries},
                    error=str(e)
                )
                if attempt < max_retries:
                    time.sleep(delay * attempt)   # exponential backoff: 2s, 4s, 6s
        raise AgentException(
            f"{self.name} failed after {max_retries} retries. Last error: {last_error}"
        )

    # ── Ollama LLM call ────────────────────────────────────────────

    def llm_call(self, prompt: str, system: Optional[str] = None,
                 expect_json: bool = False) -> str:
        """
        Calls local Ollama (mistral 7b) with the given prompt.
        Returns the model's text response.
        If expect_json=True, strips markdown fences before returning.
        """
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.1,    # low temp for deterministic structured output
                "num_predict": 1024,
            }
        }

        try:
            response = httpx.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
                timeout=60.0
            )
            response.raise_for_status()
            text = response.json()["message"]["content"]

            if expect_json:
                text = self._strip_json_fences(text)

            return text

        except httpx.TimeoutException:
            raise AgentException(f"{self.name}: Ollama timeout — is Ollama running?")
        except httpx.HTTPStatusError as e:
            raise AgentException(f"{self.name}: Ollama HTTP error {e.response.status_code}")
        except Exception as e:
            raise AgentException(f"{self.name}: LLM call failed — {e}")

    def llm_json(self, prompt: str, system: Optional[str] = None) -> dict:
        """Calls LLM and parses the response as JSON. Raises on parse failure."""
        raw = self.llm_call(prompt, system=system, expect_json=True)
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            self._log("LLM_JSON_PARSE_ERROR", AuditStatus.FAILURE,
                      error=f"Could not parse JSON: {e}\nRaw: {raw[:200]}")
            raise AgentException(f"{self.name}: LLM returned invalid JSON — {e}")

    # ── Audit helper ───────────────────────────────────────────────

    def _log(self, action: str, status: AuditStatus,
             payload: Optional[Any] = None, error: Optional[str] = None) -> None:
        # Convert Pydantic models to dicts before logging
        if payload is not None:
            if hasattr(payload, 'model_dump'):  # Pydantic model
                serializable_payload = payload.model_dump()
            elif isinstance(payload, dict):
                serializable_payload = payload
            else:
                serializable_payload = {"value": str(payload)}
        else:
            serializable_payload = None
            
        event = AuditEvent(
            run_id=self.run_id,
            agent_name=self.name,
            action=action,
            status=status,
            payload=serializable_payload,
            error_msg=error,
        )
        write_audit(event)

    # ── ID generators ──────────────────────────────────────────────

    @staticmethod
    def new_id(prefix: str) -> str:
        short = str(uuid.uuid4())[:8].upper()
        return f"{prefix}-{short}"

    # ── Internal helpers ───────────────────────────────────────────

    @staticmethod
    def _strip_json_fences(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            start = 1 if lines[0].startswith("```") else 0
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            text = "\n".join(lines[start:end])
        return text.strip()