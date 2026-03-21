"""
InvoiceMatchingAgent — the compliance heart of the P2P pipeline.
Input : InvoiceInput + po dict + gr dict
Output: InvoiceMatchingResult (CLEAN / PARTIAL / FAILED)
"""
from agents.base_agent import BaseAgent, AgentException
from db.db import save_invoice_match, now_iso
from models.enums import InvoiceMatchResult, AuditStatus
from models.schemas import InvoiceMatchingResult, ThreeWayChecks, InvoiceInput


# Tolerance for float comparison (0.5% of invoice amount)
PRICE_TOLERANCE_PCT = 0.005


class InvoiceMatchingAgent(BaseAgent):
    name = "InvoiceMatchingAgent"

    def execute(self, invoice: InvoiceInput, po: dict, gr: dict) -> dict:
        """
        3-way match:
          Check 1 — Quantity : invoice qty == GR received qty
          Check 2 — Unit price: invoice unit price == PO unit price (within tolerance)
          Check 3 — Total     : invoice total == PO total (within tolerance)
          Check 4 — Items     : invoice item names match PO item names
        """

        # Duplicate invoice guard
        self._check_duplicate_invoice(invoice.invoice_id)

        # GR payment block guard
        if gr.get("payment_block"):
            self._log("INVOICE_BLOCKED_BY_GR", AuditStatus.FAILURE, payload={
                "invoice_id": invoice.invoice_id,
                "gr_discrepancy": gr.get("discrepancy_details")
            })
            raise AgentException(
                f"Invoice blocked: Goods receipt shows discrepancy — "
                f"{gr.get('discrepancy_details')}. Resolve GR first."
            )

        po_doc    = po.get("po_document", {})
        po_items  = po_doc.get("line_items", [])
        gr_items  = gr.get("received_items", [])
        inv_items = [item.model_dump() for item in invoice.invoice_items]

        failures : list[str] = []
        warnings : list[str] = []

        # ── Check 1: Quantity match (invoice vs GR received) ──────
        qty_match = self._check_quantities(inv_items, gr_items, failures)

        # ── Check 2: Unit price match (invoice vs PO) ─────────────
        price_match = self._check_prices(inv_items, po_items, failures)

        # ── Check 3: Total amount match (invoice vs PO) ───────────
        po_total  = po_doc.get("total_amount", 0)
        inv_total = invoice.invoice_amount
        variance  = abs(inv_total - po_total)
        tolerance = po_total * PRICE_TOLERANCE_PCT
        total_match = variance <= tolerance

        if not total_match:
            failures.append(
                f"Total mismatch: invoice ₹{inv_total:,.2f} vs PO ₹{po_total:,.2f} "
                f"(variance ₹{variance:,.2f})"
            )

        # ── Check 4: Item name match (invoice vs PO) ──────────────
        item_match = self._check_item_names(inv_items, po_items, failures)

        # ── Determine result ──────────────────────────────────────
        all_checks = [qty_match, price_match, total_match, item_match]
        pass_count = sum(all_checks)

        if pass_count == 4:
            match_result = InvoiceMatchResult.CLEAN
            block_reason = None
        elif pass_count >= 2:
            match_result = InvoiceMatchResult.PARTIAL
            block_reason = "Partial match: " + "; ".join(failures)
        else:
            match_result = InvoiceMatchResult.FAILED
            block_reason = "Match failed: " + "; ".join(failures)

        checks = ThreeWayChecks(
            quantity_match=qty_match,
            price_match=price_match,
            total_match=total_match,
            item_match=item_match,
        )

        match_id = self.new_id("MATCH")

        result = InvoiceMatchingResult(
            match_id=match_id,
            po_id=invoice.po_id,
            gr_id=invoice.gr_id,
            invoice_id=invoice.invoice_id,
            match_result=match_result,
            checks=checks,
            variance_amount=round(variance, 2),
            block_reason=block_reason,
            matched_at=now_iso(),
        )

        save_invoice_match(self.run_id, {
            **result.model_dump(),
            "checks": checks.model_dump(),
        })

        status = AuditStatus.SUCCESS if match_result == InvoiceMatchResult.CLEAN else AuditStatus.FAILURE

        self._log("3_WAY_MATCH_COMPLETED", status, payload={
            "match_id": match_id,
            "result": match_result.value,
            "variance": variance,
            "failures": failures,
        })

        if match_result != InvoiceMatchResult.CLEAN:
            raise AgentException(f"Invoice matching failed: {block_reason}")

        return result.model_dump()

    # ── Check helpers ─────────────────────────────────────────────

    def _check_quantities(self, inv_items: list, gr_items: list,
                          failures: list) -> bool:
        """Invoice qty must match GR received qty for each item."""
        gr_lookup = {
            item["item_name"].strip().lower(): item["received"]
            for item in gr_items
        }
        ok = True
        for inv in inv_items:
            name    = inv["item_name"].strip().lower()
            inv_qty = inv["quantity"]
            gr_qty  = gr_lookup.get(name, 0)
            if abs(inv_qty - gr_qty) > 0.01:
                failures.append(
                    f"Quantity mismatch for '{name}': "
                    f"invoice {inv_qty} vs received {gr_qty}"
                )
                ok = False
        return ok

    def _check_prices(self, inv_items: list, po_items: list,
                      failures: list) -> bool:
        """Invoice unit price must not exceed PO unit price beyond tolerance."""
        po_lookup = {
            item["item_name"].strip().lower(): item["unit_price"]
            for item in po_items
        }
        ok = True
        for inv in inv_items:
            name      = inv["item_name"].strip().lower()
            inv_price = inv["unit_price"]
            po_price  = po_lookup.get(name)
            if po_price is None:
                continue
            tolerance = po_price * PRICE_TOLERANCE_PCT
            if inv_price > po_price + tolerance:
                failures.append(
                    f"Price overcharge for '{name}': "
                    f"invoice ₹{inv_price:,} vs PO ₹{po_price:,}"
                )
                ok = False
        return ok

    def _check_item_names(self, inv_items: list, po_items: list,
                          failures: list) -> bool:
        """Every invoice item must correspond to a PO line item."""
        po_names = {item["item_name"].strip().lower() for item in po_items}
        ok = True
        for inv in inv_items:
            name = inv["item_name"].strip().lower()
            if name not in po_names:
                failures.append(f"Invoice item '{name}' not in original PO")
                ok = False
        return ok

    def _check_duplicate_invoice(self, invoice_id: str) -> None:
        """Guard against double-paying the same invoice."""
        import sqlite3
        from config import DB_PATH
        try:
            conn = sqlite3.connect(DB_PATH)
            row = conn.execute(
                "SELECT match_id FROM invoice_matches WHERE invoice_id=?",
                (invoice_id,)
            ).fetchone()
            conn.close()
            if row:
                raise AgentException(
                    f"Duplicate invoice detected: '{invoice_id}' has already been processed "
                    f"(match_id={row[0]}). Blocked to prevent double payment."
                )
        except AgentException:
            raise
        except Exception:
            pass   # DB not ready yet — skip check