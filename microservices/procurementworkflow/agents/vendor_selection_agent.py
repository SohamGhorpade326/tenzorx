"""
VendorSelectionAgent
Input : pr dict (needs category_code, quantity, required_by)
Output: VendorSelectionResult
"""
import json
from datetime import datetime, date

from agents.base_agent import BaseAgent, AgentException
from config import (
    VENDOR_WEIGHT_PRICE, VENDOR_WEIGHT_LEAD,
    VENDOR_WEIGHT_QUALITY, VENDOR_WEIGHT_PREFERRED
)
from models.enums import VendorStatus, AuditStatus
from models.schemas import VendorSelectionResult
from prompts import VENDOR_REASON_PROMPT, VENDOR_REASON_SYSTEM


class VendorSelectionAgent(BaseAgent):
    name = "VendorSelectionAgent"

    def __init__(self, run_id: str):
        super().__init__(run_id)
        self._vendors = self._load_vendors()

    def execute(self, pr: dict) -> dict:
        """
        1. Filter approved vendors for this category
        2. Score each on price, lead time, quality, preferred status
        3. Pick highest score
        4. LLM writes selection_reason
        5. Return VendorSelectionResult
        """
        category_code = pr["category_code"]
        quantity      = pr["quantity"]
        required_by   = pr.get("required_by")

        # Filter eligible vendors
        eligible = [
            v for v in self._vendors
            if v["is_approved"] and category_code in v["category_codes"]
        ]

        if not eligible:
            self._log("NO_VENDOR_FOUND", AuditStatus.FAILURE,
                      payload={"category_code": category_code})
            raise AgentException(
                f"No approved vendor found for category '{category_code}'. "
                f"Please add a vendor or route to human review."
            )

        # Score vendors
        scored = self._score_vendors(eligible, quantity, required_by)
        best   = scored[0]  # highest score first

        status = VendorStatus.SINGLE_SOURCE if len(eligible) == 1 else VendorStatus.SELECTED

        if status == VendorStatus.SINGLE_SOURCE:
            self._log("SINGLE_SOURCE_WARNING", AuditStatus.INFO, payload={
                "vendor_id": best["vendor_id"],
                "category_code": category_code,
            })

        # LLM selection reason
        reason = self._get_selection_reason(best, scored, pr)

        total_quoted = round(best["unit_price"] * quantity, 2)

        result = VendorSelectionResult(
            pr_id=pr["pr_id"],
            vendor_id=best["vendor_id"],
            vendor_name=best["vendor_name"],
            quoted_price_per_unit=best["unit_price"],
            total_quoted=total_quoted,
            lead_time_days=best["lead_time_days"],
            quality_rating=best["quality_rating"],
            score=round(best["_score"], 2),
            selection_reason=reason,
            status=status,
        )

        self._log("VENDOR_SELECTED", AuditStatus.SUCCESS, payload={
            "pr_id": pr["pr_id"],
            "vendor_id": best["vendor_id"],
            "vendor_name": best["vendor_name"],
            "score": result.score,
            "total_quoted": total_quoted,
        })

        return result.model_dump()

    # ── Scoring ───────────────────────────────────────────────────

    def _score_vendors(self, vendors: list[dict], quantity: float,
                       required_by: str | None) -> list[dict]:
        """
        Score each vendor 0–100 on 4 dimensions, return sorted desc.
        """
        prices       = [v["unit_price"] for v in vendors]
        lead_times   = [v["lead_time_days"] for v in vendors]
        min_price    = min(prices)
        max_price    = max(prices) if max(prices) != min_price else min_price + 1
        max_lead     = max(lead_times)
        min_lead     = min(lead_times) if min(lead_times) != max_lead else 0

        # Days until required_by
        days_available = None
        if required_by:
            try:
                req_date = datetime.strptime(required_by, "%Y-%m-%d").date()
                days_available = (req_date - date.today()).days
            except ValueError:
                pass

        scored = []
        for v in vendors:
            v = dict(v)  # copy

            # Price score: lower = better
            price_score = 1 - (v["unit_price"] - min_price) / (max_price - min_price)

            # Lead time score: faster = better
            if max_lead == min_lead:
                lead_score = 1.0
            else:
                lead_score = 1 - (v["lead_time_days"] - min_lead) / (max_lead - min_lead)

            # Penalty if lead time exceeds required_by window
            if days_available is not None and v["lead_time_days"] > days_available:
                lead_score *= 0.3   # heavy penalty, doesn't block

            # Quality score: higher = better (rating is 0–5)
            quality_score = v["quality_rating"] / 5.0

            # Preferred bonus
            preferred_score = 1.0 if v.get("is_preferred") else 0.0

            total = (
                VENDOR_WEIGHT_PRICE    * price_score    * 100 +
                VENDOR_WEIGHT_LEAD     * lead_score     * 100 +
                VENDOR_WEIGHT_QUALITY  * quality_score  * 100 +
                VENDOR_WEIGHT_PREFERRED * preferred_score * 100
            )

            v["_score"]         = total
            v["_price_score"]   = round(price_score * 100, 1)
            v["_lead_score"]    = round(lead_score * 100, 1)
            v["_quality_score"] = round(quality_score * 100, 1)
            scored.append(v)

        return sorted(scored, key=lambda x: x["_score"], reverse=True)

    def _get_selection_reason(self, best: dict, all_scored: list[dict],
                              pr: dict) -> str:
        """Ask Ollama for a plain-English explanation of the selection."""
        prompt = VENDOR_REASON_PROMPT.format(
            selected_vendor=best["vendor_name"],
            unit_price=best["unit_price"],
            lead_time=best["lead_time_days"],
            quality_rating=best["quality_rating"],
            score=round(best["_score"], 1),
            total_candidates=len(all_scored),
            item_name=pr["item_name"],
            quantity=pr["quantity"],
        )
        try:
            return self.llm_call(prompt, system=VENDOR_REASON_SYSTEM).strip()
        except AgentException:
            # Graceful fallback — no LLM required for selection logic
            return (
                f"{best['vendor_name']} selected with score {best['_score']:.1f}/100. "
                f"Unit price ₹{best['unit_price']:,}, lead time {best['lead_time_days']} days, "
                f"quality rating {best['quality_rating']}/5."
            )

    def _load_vendors(self) -> list[dict]:
        """Load approved vendors from SQLite database"""
        import sqlite3
        from config import DB_PATH
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM vendors WHERE is_approved = 1"
            ).fetchall()
            conn.close()
            
            vendors = []
            for row in rows:
                v = dict(row)
                # Parse category_codes from JSON string back to list
                try:
                    v["category_codes"] = json.loads(v["category_codes"])
                except Exception:
                    v["category_codes"] = []
                # Convert SQLite integers to booleans
                v["is_preferred"] = bool(v["is_preferred"])
                v["is_approved"] = bool(v["is_approved"])
                vendors.append(v)
            
            if not vendors:
                raise AgentException("No approved vendors in database. Run db/seed_data.py first.")
            return vendors
        except AgentException:
            raise
        except Exception as e:
            raise AgentException(f"Failed to load vendors from DB: {e}")