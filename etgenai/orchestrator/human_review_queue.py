"""
HumanReviewQueue
Manages items that require human approval before the pipeline can continue.
"""
import uuid
from typing import Any

from db.db import (
    create_review_item, get_pending_reviews,
    get_review, resolve_review, now_iso
)
from models.enums import ReviewStatus
from models.schemas import ReviewItem


def enqueue_for_review(
    run_id: str,
    agent_name: str,
    reason: str,
    payload: dict[str, Any],
) -> str:
    """
    Adds an item to the human review queue.
    Returns the review_id.
    """
    review_id = f"REV-{str(uuid.uuid4())[:8].upper()}"
    item = ReviewItem(
        review_id=review_id,
        run_id=run_id,
        agent_name=agent_name,
        reason=reason,
        payload=payload,
        status=ReviewStatus.PENDING_APPROVAL,
        created_at=now_iso(),
    )
    create_review_item(item)
    return review_id


def approve_review(review_id: str, note: str | None = None) -> dict:
    """Mark a review item as approved."""
    item = get_review(review_id)
    if not item:
        raise ValueError(f"Review '{review_id}' not found")
    if item["status"] != ReviewStatus.PENDING_APPROVAL.value:
        raise ValueError(f"Review '{review_id}' is already '{item['status']}'")
    resolve_review(review_id, ReviewStatus.APPROVED, note)
    return get_review(review_id)


def reject_review(review_id: str, note: str | None = None) -> dict:
    """Mark a review item as rejected."""
    item = get_review(review_id)
    if not item:
        raise ValueError(f"Review '{review_id}' not found")
    resolve_review(review_id, ReviewStatus.REJECTED, note)
    return get_review(review_id)


def list_pending() -> list[dict]:
    """Return all pending review items."""
    return get_pending_reviews()