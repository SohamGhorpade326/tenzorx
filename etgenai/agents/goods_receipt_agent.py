"""
GoodsReceiptAgent
Input : DeliveryInput + po dict
Output: GoodsReceiptResult
"""
from agents.base_agent import BaseAgent, AgentException
from db.db import save_gr, get_po, now_iso
from models.enums import GRMatchStatus, AuditStatus
from models.schemas import GoodsReceiptResult, GRLineItem, DeliveryInput


class GoodsReceiptAgent(BaseAgent):
    name = "GoodsReceiptAgent"

    def execute(self, delivery: DeliveryInput, po: dict) -> dict:
        """
        1. Load PO line items
        2. Compare delivered quantities vs PO (lenient on item names)
        3. Determine FULL / PARTIAL / MISMATCH
        4. Set payment_block flag
        5. Persist and return GoodsReceiptResult
        """
        
        # Debug logging
        print(f"[GR] Delivery received: items={delivery.delivered_items}, qty={delivery.delivered_quantities}")
        print(f"[GR] Delivery qty types: {[type(q).__name__ for q in delivery.delivered_quantities]}")

        po_doc     = po.get("po_document", {})
        po_items   = po_doc.get("line_items", [])

        if not po_items:
            raise AgentException(f"PO {po['po_id']} has no line items to match against.")

        # Expected total quantity from PO
        expected_total_qty = sum(item["quantity"] for item in po_items)
        
        # Received total quantity (ignore item name matching for now)
        received_total_qty = sum(delivery.delivered_quantities) if delivery.delivered_quantities else 0
        print(f"[GR] Expected total: {expected_total_qty}, Received total: {received_total_qty}")

        gr_lines     : list[GRLineItem] = []
        discrepancies: list[str]        = []
        mismatch_found = False
        partial_found  = False

        # Create line item records for each delivered item
        for idx, (item_name, qty_received) in enumerate(zip(delivery.delivered_items, delivery.delivered_quantities)):
            if idx < len(po_items):
                po_item = po_items[idx]
                exp_qty = po_item["quantity"]
                match = abs(qty_received - exp_qty) < 0.01
                
                if qty_received == 0:
                    partial_found = True
                    discrepancies.append(f"'{item_name}' — expected {exp_qty}, received 0")
                elif not match:
                    partial_found = True
                    discrepancies.append(f"'{item_name}' — expected {exp_qty}, received {qty_received}")
            else:
                # Extra item delivered beyond PO
                discrepancies.append(f"Extra item delivered: '{item_name}' (qty: {qty_received})")
                mismatch_found = True

            gr_lines.append(GRLineItem(
                item_name=item_name,
                expected=po_items[idx]["quantity"] if idx < len(po_items) else 0,
                received=qty_received,
                match=False if discrepancies else True,
            ))

        # Check total quantity matches
        if abs(received_total_qty - expected_total_qty) > 0.01:
            if received_total_qty == 0:
                mismatch_found = True
                discrepancies.insert(0, f"No items received (expected total: {expected_total_qty})")
            else:
                partial_found = True
                if not discrepancies:
                    discrepancies.append(f"Total quantity mismatch: expected {expected_total_qty}, received {received_total_qty}")

        # Determine match status
        if mismatch_found:
            match_status  = GRMatchStatus.MISMATCH
            payment_block = True
        elif partial_found:
            match_status  = GRMatchStatus.PARTIAL
            payment_block = True
        else:
            match_status  = GRMatchStatus.FULL
            payment_block = False

        gr_id = self.new_id("GR")

        result = GoodsReceiptResult(
            gr_id=gr_id,
            po_id=delivery.po_id,
            match_status=match_status,
            received_items=[item.model_dump() for item in gr_lines],
            discrepancy_details="; ".join(discrepancies) if discrepancies else None,
            payment_block=payment_block,
            received_at=delivery.delivery_date,
        )

        save_gr(self.run_id, result.model_dump())

        self._log("GOODS_RECEIPT_PROCESSED", AuditStatus.SUCCESS, payload={
            "gr_id": gr_id,
            "po_id": delivery.po_id,
            "match_status": match_status.value,
            "payment_block": payment_block,
            "discrepancies": discrepancies,
        })

        if payment_block:
            self._log("PAYMENT_BLOCKED_GR", AuditStatus.INFO, payload={
                "reason": result.discrepancy_details
            })

        return result.model_dump()