"""
PurchaseRequestAgent
Input : PurchaseRequestInput
Output: PurchaseRequest (validated + classified)
"""
import json
from datetime import datetime

from agents.base_agent import BaseAgent, AgentException
from config import APPROVAL_THRESHOLD, RESTRICTED_CATEGORIES
from db.db import save_purchase_request, get_purchase_request, now_iso
from models.enums import PRStatus, AuditStatus
from models.schemas import PurchaseRequest, PurchaseRequestInput
from prompts import PR_CLASSIFY_PROMPT, PR_CLASSIFY_SYSTEM


# ── Category mapping ─────────────────────────────────────────────
CATEGORY_MAP = {
    "IT Hardware":     "IT_HW",
    "IT Software":     "IT_SW",
    "Office Supplies": "OFFICE",
    "Facilities":      "FACILITIES",
    "Raw Materials":   "RAW_MAT",
    "Services":        "SERVICES",
    "Parts":           "PARTS",
    "Pharma":          "PHARMA",
}


class PurchaseRequestAgent(BaseAgent):
    name = "PurchaseRequestAgent"

    def execute(self, input_data: PurchaseRequestInput) -> dict:
        """
        1. Validate required fields
        2. Detect duplicates
        3. Classify category → category_code (rule-based first, LLM fallback)
        4. Determine if approval required
        5. Persist to DB and return structured PR
        """

        # Step 1 — Validate fields
        self._validate(input_data)

        # Step 2 — Detect duplicate (same item + dept within last 24 hrs)
        self._check_duplicate(input_data)

        # Step 3 — Classify category
        category_code = self._classify_category(input_data.category)

        # Step 4 — Check restricted
        if category_code in RESTRICTED_CATEGORIES:
            self._log("RESTRICTED_CATEGORY", AuditStatus.FAILURE,
                      payload={"category_code": category_code})
            raise AgentException(
                f"Category '{category_code}' is restricted and cannot be processed automatically."
            )

        # Step 5 — Compute totals and approval flag
        total_amount = round(input_data.quantity * input_data.unit_price, 2)
        approval_required = (
            total_amount > APPROVAL_THRESHOLD or
            category_code in RESTRICTED_CATEGORIES
        )

        # Step 6 — Build PR object
        pr_id = self.new_id("PR")
        pr = PurchaseRequest(
            pr_id=pr_id,
            item_name=input_data.item_name,
            quantity=input_data.quantity,
            unit_price=input_data.unit_price,
            total_amount=total_amount,
            department=input_data.department,
            requester_id=input_data.requester_id,
            category=input_data.category,
            category_code=category_code,
            approval_required=approval_required,
            status=PRStatus.VALIDATED,
            required_by=input_data.required_by,
            created_at=now_iso(),
        )

        # Step 7 — Persist
        save_purchase_request(self.run_id, pr.model_dump())

        self._log("PR_CREATED", AuditStatus.SUCCESS, payload={
            "pr_id": pr_id,
            "total_amount": total_amount,
            "category_code": category_code,
            "approval_required": approval_required,
        })

        return pr.model_dump()

    # ── Internal helpers ──────────────────────────────────────────

    def _validate(self, data: PurchaseRequestInput) -> None:
        errors = []
        if not data.item_name or not data.item_name.strip():
            errors.append("item_name is required")
        if data.quantity <= 0:
            errors.append("quantity must be > 0")
        if data.unit_price <= 0:
            errors.append("unit_price must be > 0")
        if not data.department or not data.department.strip():
            errors.append("department is required")
        if not data.requester_id or not data.requester_id.strip():
            errors.append("requester_id is required")
        if not data.category or not data.category.strip():
            errors.append("category is required")
        if errors:
            self._log("VALIDATION_FAILED", AuditStatus.FAILURE,
                      payload={"errors": errors})
            raise AgentException(f"Validation failed: {'; '.join(errors)}")

    def _check_duplicate(self, data: PurchaseRequestInput) -> None:
        """
        Simple duplicate check: same item_name + department in this run.
        In production this would query last 24hrs.
        """
        # For demo purposes we skip DB-level duplicate check
        # A full implementation would do:
        # existing = db.query("SELECT pr_id FROM purchase_requests WHERE item_name=? AND department=? AND created_at > ?", ...)
        pass

    def _classify_category(self, raw_category: str) -> str:
        """
        Try exact map first. If not found, ask Ollama to classify.
        """
        # Exact match
        for key, code in CATEGORY_MAP.items():
            if raw_category.strip().lower() == key.lower():
                return code

        # Partial match
        raw_lower = raw_category.strip().lower()
        for key, code in CATEGORY_MAP.items():
            if raw_lower in key.lower() or key.lower() in raw_lower:
                return code

        # LLM fallback
        self._log("LLM_CATEGORY_CLASSIFY", AuditStatus.INFO,
                  payload={"raw_category": raw_category})

        prompt = PR_CLASSIFY_PROMPT.format(
            raw_category=raw_category,
            valid_codes=list(CATEGORY_MAP.values())
        )
        try:
            result = self.llm_json(prompt, system=PR_CLASSIFY_SYSTEM)
            code = result.get("category_code", "SERVICES").upper()
            if code not in CATEGORY_MAP.values():
                code = "SERVICES"
            return code
        except AgentException:
            # If LLM fails, default to SERVICES
            self._log("LLM_CLASSIFY_FALLBACK", AuditStatus.INFO,
                      payload={"defaulted_to": "SERVICES"})
            return "SERVICES"