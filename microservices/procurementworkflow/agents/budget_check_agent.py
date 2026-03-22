"""
BudgetCheckAgent
Input : pr dict from PurchaseRequestAgent
Output: BudgetCheckResult
"""
import json

from agents.base_agent import BaseAgent, AgentException
from config import BUDGET_WARNING_PCT, BUDGETS_FILE
from db.db import now_iso
from models.enums import BudgetStatus, AuditStatus
from models.schemas import BudgetCheckResult


class BudgetCheckAgent(BaseAgent):
    name = "BudgetCheckAgent"

    def __init__(self, run_id: str):
        super().__init__(run_id)
        self._budgets = self._load_budgets()

    def execute(self, pr: dict) -> dict:
        """
        1. Look up department + category budget from mock_data/budgets.json
        2. Calculate utilisation
        3. Return APPROVED / AT_RISK / BLOCKED
        """
        department   = pr["department"]
        category_code = pr["category_code"]
        total_amount = pr["total_amount"]

        budget = self._find_budget(department, category_code)

        if budget is None:
            # No budget record found — escalate
            self._log("BUDGET_NOT_FOUND", AuditStatus.FAILURE, payload={
                "department": department, "category_code": category_code
            })
            raise AgentException(
                f"No budget record for department='{department}', category='{category_code}'. "
                f"Please create a budget entry first."
            )

        allocated   = budget["allocated"]
        spent       = budget["spent"]
        remaining   = allocated - spent
        new_utilisation = (spent + total_amount) / allocated if allocated > 0 else 1.0

        # Determine status
        if new_utilisation >= 1.0:
            status = BudgetStatus.BLOCKED
            reason = (
                f"Budget exhausted. Allocated: ₹{allocated:,.0f}, "
                f"Spent: ₹{spent:,.0f}, Requested: ₹{total_amount:,.0f}. "
                f"Would exceed budget by ₹{(spent + total_amount - allocated):,.0f}."
            )
        elif new_utilisation >= BUDGET_WARNING_PCT:
            status = BudgetStatus.AT_RISK
            reason = (
                f"Budget utilisation will reach {new_utilisation*100:.1f}% after this purchase. "
                f"Proceeding but flagging for review."
            )
        else:
            status = BudgetStatus.APPROVED
            reason = (
                f"Budget available. Post-purchase utilisation: {new_utilisation*100:.1f}%. "
                f"Remaining: ₹{(remaining - total_amount):,.0f}."
            )

        result = BudgetCheckResult(
            pr_id=pr["pr_id"],
            budget_status=status,
            allocated_budget=allocated,
            spent_so_far=spent,
            this_request=total_amount,
            remaining_after=max(0.0, remaining - total_amount),
            utilisation_pct=round(new_utilisation * 100, 2),
            reason=reason,
        )

        self._log("BUDGET_CHECK_DONE", AuditStatus.SUCCESS, payload={
            "pr_id": pr["pr_id"],
            "status": status.value,
            "utilisation_pct": result.utilisation_pct,
        })

        return result.model_dump()

    # ── Helpers ───────────────────────────────────────────────────

    def _load_budgets(self) -> list[dict]:
        try:
            with open(BUDGETS_FILE) as f:
                return json.load(f)
        except FileNotFoundError:
            self._log("BUDGET_FILE_MISSING", AuditStatus.FAILURE,
                      error=f"File not found: {BUDGETS_FILE}")
            raise AgentException("budgets.json not found. Run db/seed_data.py first.")

    def _find_budget(self, department: str, category_code: str) -> dict | None:
        # Exact match on dept + category
        for b in self._budgets:
            if (b["department"].lower() == department.lower() and
                    b["category_code"].upper() == category_code.upper()):
                return b
        # Fallback: dept-only match (use any category budget)
        for b in self._budgets:
            if b["department"].lower() == department.lower():
                return b
        return None