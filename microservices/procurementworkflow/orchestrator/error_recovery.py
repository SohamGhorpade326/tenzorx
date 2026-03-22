"""
ErrorRecovery
Utility functions for the orchestrator to handle agent failures gracefully.
Provides: retry with backoff, partial state recovery, error classification.
"""
import time
from typing import Callable, Any

from agents.base_agent import AgentException
from agents.audit_trail_agent import AuditTrailAgent
from models.enums import AuditStatus


class ErrorClassification:
    """Classifies errors to decide retry vs escalate vs abort."""

    # Errors that are worth retrying (transient)
    RETRYABLE_KEYWORDS = [
        "timeout", "connection", "unreachable",
        "503", "502", "504", "temporarily"
    ]

    # Errors that should go straight to human review
    HUMAN_REVIEW_KEYWORDS = [
        "budget", "no vendor", "no approved vendor",
        "blocked", "restricted", "duplicate"
    ]

    # Errors that are fatal — abort the run
    FATAL_KEYWORDS = [
        "invalid schema", "corrupt", "critical"
    ]

    @classmethod
    def classify(cls, error: str) -> str:
        """
        Returns: 'retry' | 'human_review' | 'fatal' | 'unknown'
        """
        err_lower = error.lower()
        for kw in cls.FATAL_KEYWORDS:
            if kw in err_lower:
                return "fatal"
        for kw in cls.HUMAN_REVIEW_KEYWORDS:
            if kw in err_lower:
                return "human_review"
        for kw in cls.RETRYABLE_KEYWORDS:
            if kw in err_lower:
                return "retry"
        return "human_review"   # default: send to review


def retry_with_backoff(
    fn: Callable,
    args: tuple = (),
    kwargs: dict | None = None,
    max_retries: int = 3,
    base_delay: int = 2,
    run_id: str = "",
    step_name: str = "",
) -> Any:
    """
    Retries fn(*args, **kwargs) up to max_retries with exponential backoff.
    Writes each retry attempt to the audit log.
    Raises AgentException after all retries exhausted.
    """
    if kwargs is None:
        kwargs = {}

    audit = AuditTrailAgent(run_id) if run_id else None
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_error = e
            delay = base_delay * attempt    # 2, 4, 6 seconds

            if audit:
                audit.record(
                    f"{step_name.upper()}_RETRY_{attempt}",
                    status=AuditStatus.RETRY,
                    payload={"attempt": attempt, "max": max_retries, "delay": delay},
                    error=str(e),
                    agent_name="ErrorRecovery",
                )

            if attempt < max_retries:
                time.sleep(delay)

    raise AgentException(
        f"[ErrorRecovery] '{step_name}' failed after {max_retries} retries. "
        f"Last error: {last_error}"
    )


def safe_fallback(
    primary: Callable,
    fallback: Callable,
    run_id: str = "",
    step_name: str = "",
    **kwargs,
) -> tuple[Any, bool]:
    """
    Tries primary(*kwargs). If it fails, tries fallback(**kwargs).
    Returns (result, used_fallback: bool).
    """
    audit = AuditTrailAgent(run_id) if run_id else None

    try:
        return primary(**kwargs), False
    except Exception as e:
        if audit:
            audit.record(
                f"{step_name.upper()}_PRIMARY_FAILED",
                status=AuditStatus.RETRY,
                error=str(e),
                agent_name="ErrorRecovery",
            )
        try:
            result = fallback(**kwargs)
            if audit:
                audit.record(
                    f"{step_name.upper()}_FALLBACK_USED",
                    status=AuditStatus.INFO,
                    agent_name="ErrorRecovery",
                )
            return result, True
        except Exception as e2:
            raise AgentException(
                f"[ErrorRecovery] Both primary and fallback failed for '{step_name}'. "
                f"Primary: {e} | Fallback: {e2}"
            )