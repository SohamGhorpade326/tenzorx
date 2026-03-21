"""
POCreationAgent
Input : pr dict + vendor dict
Output: POCreationResult
"""
import time
from datetime import datetime, timedelta

from agents.base_agent import BaseAgent, AgentException
from config import PO_DISPATCH_MAX_RETRIES, PO_DISPATCH_RETRY_DELAY
from db.db import save_po, now_iso
from models.enums import POStatus, AuditStatus
from models.schemas import POCreationResult, PODocument, LineItem


class POCreationAgent(BaseAgent):
    name = "POCreationAgent"

    def execute(self, pr: dict, vendor: dict) -> dict:
        """
        1. Build the PO document from PR + vendor data
        2. Attempt dispatch to mock vendor endpoint (with retries)
        3. Persist and return POCreationResult
        """

        # Validate total consistency
        expected_total = round(vendor["quoted_price_per_unit"] * pr["quantity"], 2)

        # Build PO document
        po_id       = self.new_id("PO")
        issued_date = now_iso()[:10]   # YYYY-MM-DD

        # Delivery date: today + lead_time_days
        delivery_date = (
            datetime.utcnow() + timedelta(days=vendor["lead_time_days"])
        ).strftime("%Y-%m-%d")

        line_items = [
            LineItem(
                item_name=pr["item_name"],
                quantity=pr["quantity"],
                unit_price=vendor["quoted_price_per_unit"],
            )
        ]

        po_doc = PODocument(
            po_number=po_id,
            issued_date=issued_date,
            delivery_date=delivery_date,
            payment_terms="Net-30",
            vendor_name=vendor["vendor_name"],
            vendor_id=vendor["vendor_id"],
            department=pr["department"],
            line_items=line_items,
            total_amount=expected_total,
        )

        self._log("PO_DOCUMENT_BUILT", AuditStatus.INFO, payload={
            "po_id": po_id, "total_amount": expected_total,
            "delivery_date": delivery_date,
        })

        # Attempt dispatch
        retry_count    = 0
        dispatch_status = POStatus.FAILED
        error_msg      = None
        dispatched_at  = None

        for attempt in range(1, PO_DISPATCH_MAX_RETRIES + 1):
            try:
                self._mock_dispatch(po_doc)
                dispatch_status = POStatus.SENT
                dispatched_at   = now_iso()
                self._log("PO_DISPATCHED", AuditStatus.SUCCESS, payload={
                    "po_id": po_id, "attempt": attempt
                })
                break
            except Exception as e:
                retry_count += 1
                error_msg = str(e)
                self._log(f"PO_DISPATCH_ATTEMPT_{attempt}", AuditStatus.RETRY,
                          error=error_msg)
                if attempt < PO_DISPATCH_MAX_RETRIES:
                    time.sleep(PO_DISPATCH_RETRY_DELAY * attempt)

        if dispatch_status == POStatus.FAILED:
            self._log("PO_DISPATCH_FINAL_FAILURE", AuditStatus.FAILURE,
                      error=f"All {PO_DISPATCH_MAX_RETRIES} retries exhausted.")

        result = POCreationResult(
            po_id=po_id,
            pr_id=pr["pr_id"],
            vendor_id=vendor["vendor_id"],
            po_document=po_doc,
            dispatch_status=dispatch_status,
            retry_count=retry_count,
            dispatched_at=dispatched_at,
            error=error_msg if dispatch_status == POStatus.FAILED else None,
        )

        # Persist even on failure (for audit trail)
        save_po(self.run_id, {
            **result.model_dump(),
            "po_document": po_doc.model_dump(),
        })

        if dispatch_status == POStatus.FAILED:
            raise AgentException(
                f"PO dispatch failed after {PO_DISPATCH_MAX_RETRIES} attempts: {error_msg}"
            )

        return result.model_dump()

    # ── Mock vendor endpoint ──────────────────────────────────────

    def _mock_dispatch(self, po_doc: PODocument) -> None:
        """
        Simulates sending PO to a vendor's endpoint.
        In a real system this would be an HTTP POST.
        For demo: always succeeds (no random failures).
        Swap the commented block in to simulate failures.
        """
        # Simulate a slight processing delay
        time.sleep(0.1)

        # To simulate failures, uncomment:
        # import random
        # if random.random() < 0.5:
        #     raise ConnectionError("Vendor endpoint unreachable (simulated)")

        # Log the dispatched PO for demo visibility
        self._log("MOCK_VENDOR_ENDPOINT_HIT", AuditStatus.INFO, payload={
            "po_number": po_doc.po_number,
            "vendor": po_doc.vendor_name,
            "total": po_doc.total_amount,
        })