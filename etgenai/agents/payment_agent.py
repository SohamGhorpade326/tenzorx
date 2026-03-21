"""
PaymentSchedulingAgent
Input : invoice_match dict + po dict
Output: PaymentResult
Only runs when match_result == CLEAN
"""
from datetime import datetime, timedelta

from agents.base_agent import BaseAgent, AgentException
from db.db import save_payment, get_payment_by_po, now_iso
from config import EARLY_PAYMENT_DISCOUNT_PCT, EARLY_PAYMENT_DAYS
from models.enums import PaymentStatus, InvoiceMatchResult, AuditStatus
from models.schemas import PaymentResult


# Supported payment terms → days mapping
PAYMENT_TERMS_MAP = {
    "Net-7":   7,
    "Net-14":  14,
    "Net-30":  30,
    "Net-45":  45,
    "Net-60":  60,
    "Net-90":  90,
    "Immediate": 0,
}


class PaymentSchedulingAgent(BaseAgent):
    name = "PaymentSchedulingAgent"

    def execute(self, invoice_match: dict, po: dict) -> dict:
        """
        1. Guard — only runs on CLEAN match
        2. Detect duplicate payment
        3. Parse payment terms → due date
        4. Check early payment discount
        5. Create payment record
        """

        # Guard: only CLEAN match proceeds
        if invoice_match.get("match_result") != InvoiceMatchResult.CLEAN.value:
            raise AgentException(
                f"Payment refused: invoice match result is "
                f"'{invoice_match.get('match_result')}', not CLEAN. "
                f"Resolve invoice discrepancy first."
            )

        po_id = po["po_id"]

        # Guard: duplicate payment check
        existing = get_payment_by_po(po_id)
        if existing:
            raise AgentException(
                f"Duplicate payment blocked: PO '{po_id}' already has payment "
                f"record '{existing['payment_id']}' with status '{existing['status']}'."
            )

        po_doc          = po.get("po_document", {})
        payment_terms   = po_doc.get("payment_terms", "Net-30")
        invoice_amount  = invoice_match.get("variance_amount", 0)
        # Use the PO total as the payment amount (already verified by 3-way match)
        invoice_amount  = po_doc.get("total_amount", 0)
        vendor_id       = po.get("vendor_id", "")
        vendor_bank_ref = po_doc.get("vendor_bank_ref", None)

        # Calculate due date
        days         = PAYMENT_TERMS_MAP.get(payment_terms, 30)
        due_date     = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")
        invoice_date = datetime.utcnow()

        # Early payment discount check
        early_deadline     = invoice_date + timedelta(days=EARLY_PAYMENT_DAYS)
        due_dt             = datetime.strptime(due_date, "%Y-%m-%d")
        early_possible     = EARLY_PAYMENT_DAYS < days  # only if terms allow it
        discount_amount    = 0.0
        scheduled_amount   = invoice_amount
        terms_used         = payment_terms
        early_applied      = False

        if early_possible:
            discount_amount  = round(invoice_amount * EARLY_PAYMENT_DISCOUNT_PCT, 2)
            scheduled_amount = round(invoice_amount - discount_amount, 2)
            due_date         = early_deadline.strftime("%Y-%m-%d")
            terms_used       = f"{payment_terms} with {EARLY_PAYMENT_DISCOUNT_PCT*100:.0f}% early discount"
            early_applied    = True
            self._log("EARLY_PAYMENT_DISCOUNT_APPLIED", AuditStatus.INFO, payload={
                "discount_amount": discount_amount,
                "saving": discount_amount,
            })

        payment_id = self.new_id("PAY")

        result = PaymentResult(
            payment_id=payment_id,
            po_id=po_id,
            vendor_id=vendor_id,
            invoice_amount=invoice_amount,
            scheduled_amount=scheduled_amount,
            early_discount_applied=early_applied,
            discount_amount=discount_amount,
            due_date=due_date,
            payment_terms_used=terms_used,
            vendor_bank_ref=vendor_bank_ref,
            status=PaymentStatus.SCHEDULED,
            scheduled_at=now_iso(),
        )

        save_payment(self.run_id, result.model_dump())

        self._log("PAYMENT_SCHEDULED", AuditStatus.SUCCESS, payload={
            "payment_id": payment_id,
            "po_id": po_id,
            "scheduled_amount": scheduled_amount,
            "due_date": due_date,
            "early_discount": early_applied,
        })

        return result.model_dump()