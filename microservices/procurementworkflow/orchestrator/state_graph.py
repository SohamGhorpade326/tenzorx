"""
ProcurementOrchestrator
LangGraph StateGraph that wires all 8 agents into a single pipeline.

Flow:
  START
    → purchase_request
    → budget_check         (BLOCKED → human_review)
    → vendor_selection     (NO_VENDOR → human_review)
    → po_creation          (FAILED → human_review)
    → [WAIT: delivery trigger]
    → goods_receipt        (MISMATCH/PARTIAL → human_review)
    → [WAIT: invoice trigger]
    → invoice_matching     (FAILED/PARTIAL → human_review)
    → payment_scheduling
    → END
"""
import uuid
from typing import Annotated, TypedDict

from langgraph.graph import StateGraph, END

from agents.purchase_request_agent import PurchaseRequestAgent
from agents.budget_check_agent import BudgetCheckAgent
from agents.vendor_selection_agent import VendorSelectionAgent
from agents.po_creation_agent import POCreationAgent
from agents.goods_receipt_agent import GoodsReceiptAgent
from agents.invoice_matching_agent import InvoiceMatchingAgent
from agents.payment_agent import PaymentSchedulingAgent
from agents.audit_trail_agent import AuditTrailAgent
from agents.base_agent import AgentException

from db.db import create_run, update_run, now_iso
from models.enums import RunStatus, BudgetStatus, GRMatchStatus, InvoiceMatchResult
from models.schemas import (
    ProcurementState, PurchaseRequestInput, DeliveryInput, InvoiceInput
)
from orchestrator.human_review_queue import enqueue_for_review


# ── LangGraph state dict ──────────────────────────────────────────

class GraphState(TypedDict):
    run_id       : str
    proc_state   : dict          # serialized ProcurementState
    error        : str | None


# ── Node functions ────────────────────────────────────────────────

def node_purchase_request(state: GraphState) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])
    audit      = AuditTrailAgent(run_id)

    try:
        agent = PurchaseRequestAgent(run_id)
        pr    = agent.run(input_data=proc_state.input)
        proc_state.pr           = pr
        proc_state.current_step = "budget_check"
    except AgentException as e:
        proc_state.errors.append(str(e))
        proc_state.current_step = "failed"
        proc_state.status       = RunStatus.FAILED
        audit.record("NODE_PURCHASE_REQUEST_FAILED", error=str(e))

    return {**state, "proc_state": proc_state.model_dump()}


def node_budget_check(state: GraphState) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])
    audit      = AuditTrailAgent(run_id)

    try:
        agent  = BudgetCheckAgent(run_id)
        # Convert Pydantic model to dict before passing to agent
        pr_dict = proc_state.pr.model_dump() if hasattr(proc_state.pr, 'model_dump') else proc_state.pr
        budget = agent.run(pr=pr_dict)
        proc_state.budget = budget

        if budget["budget_status"] == BudgetStatus.BLOCKED.value:
            review_id = enqueue_for_review(
                run_id=run_id,
                agent_name="BudgetCheckAgent",
                reason=budget["reason"],
                payload={"pr": proc_state.pr, "budget": budget},
            )
            proc_state.human_review_ids.append(review_id)
            proc_state.current_step = "pending_budget_review"
            proc_state.status       = RunStatus.PARTIAL
        else:
            proc_state.current_step = "vendor_selection"

    except AgentException as e:
        proc_state.errors.append(str(e))
        proc_state.current_step = "failed"
        proc_state.status       = RunStatus.FAILED

    return {**state, "proc_state": proc_state.model_dump()}


def node_vendor_selection(state: GraphState) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])

    try:
        agent  = VendorSelectionAgent(run_id)
        # Convert Pydantic model to dict before passing to agent
        pr_dict = proc_state.pr.model_dump() if hasattr(proc_state.pr, 'model_dump') else proc_state.pr
        vendor = agent.run(pr=pr_dict)
        proc_state.vendor       = vendor
        proc_state.current_step = "po_creation"
    except AgentException as e:
        review_id = enqueue_for_review(
            run_id=run_id,
            agent_name="VendorSelectionAgent",
            reason=str(e),
            payload={"pr": proc_state.pr},
        )
        proc_state.human_review_ids.append(review_id)
        proc_state.errors.append(str(e))
        proc_state.current_step = "pending_vendor_review"
        proc_state.status       = RunStatus.PARTIAL

    return {**state, "proc_state": proc_state.model_dump()}


def node_po_creation(state: GraphState) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])

    try:
        print(f"[PO-CREATION] Starting PO creation for PR {proc_state.pr.pr_id if proc_state.pr else 'unknown'}")

        # Guardrails: PO creation requires both PR and vendor selection.
        if not proc_state.pr:
            raise AgentException("Missing purchase request state; cannot create PO")

        if not proc_state.vendor:
            # Route back to human review instead of crashing with NoneType.
            review_id = enqueue_for_review(
                run_id=run_id,
                agent_name="VendorSelectionAgent",
                reason="Vendor selection missing; cannot proceed to PO creation",
                payload={"pr": proc_state.pr},
            )
            proc_state.human_review_ids.append(review_id)
            proc_state.errors.append("Vendor selection missing for PO creation")
            proc_state.current_step = "pending_vendor_review"
            proc_state.status = RunStatus.PARTIAL
            return {**state, "proc_state": proc_state.model_dump()}
        
        agent = POCreationAgent(run_id)
        # Convert Pydantic models to dicts before passing to agent
        pr_dict = proc_state.pr.model_dump() if hasattr(proc_state.pr, 'model_dump') else proc_state.pr
        vendor_dict = proc_state.vendor.model_dump() if hasattr(proc_state.vendor, 'model_dump') else proc_state.vendor
        
        print(
            f"[PO-CREATION] Calling agent.run() with pr_id={pr_dict.get('pr_id')}, "
            f"vendor={vendor_dict.get('vendor_name')}"
        )
        po = agent.run(pr=pr_dict, vendor=vendor_dict)
        
        print(f"[PO-CREATION] Agent completed, PO ID={po.get('po_id') if isinstance(po, dict) else 'unknown'}")
        proc_state.po           = po
        proc_state.current_step = "awaiting_delivery"
    except AgentException as e:
        print(f"[PO-CREATION] AgentException: {str(e)}")
        review_id = enqueue_for_review(
            run_id=run_id,
            agent_name="POCreationAgent",
            reason=str(e),
            payload={"pr": proc_state.pr, "vendor": proc_state.vendor},
        )
        proc_state.human_review_ids.append(review_id)
        proc_state.errors.append(str(e))
        proc_state.current_step = "pending_po_review"
        proc_state.status       = RunStatus.PARTIAL
    except Exception as e:
        print(f"[PO-CREATION] Unexpected exception: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

    return {**state, "proc_state": proc_state.model_dump()}


def node_goods_receipt(state: GraphState, delivery: DeliveryInput) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])

    try:
        agent = GoodsReceiptAgent(run_id)
        # Convert Pydantic model to dict before passing to agent
        po_dict = proc_state.po.model_dump() if hasattr(proc_state.po, 'model_dump') else proc_state.po
        gr    = agent.run(delivery=delivery, po=po_dict)
        proc_state.gr = gr

        if gr["payment_block"]:
            review_id = enqueue_for_review(
                run_id=run_id,
                agent_name="GoodsReceiptAgent",
                reason=f"Delivery discrepancy: {gr.get('discrepancy_details')}",
                payload={"gr": gr, "po": proc_state.po},
            )
            proc_state.human_review_ids.append(review_id)
            proc_state.current_step = "pending_gr_review"
            proc_state.status       = RunStatus.PARTIAL
        else:
            proc_state.current_step = "awaiting_invoice"

    except AgentException as e:
        proc_state.errors.append(str(e))
        proc_state.current_step = "failed"
        proc_state.status       = RunStatus.FAILED

    return {**state, "proc_state": proc_state.model_dump()}


def node_invoice_matching(state: GraphState, invoice: InvoiceInput) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])

    try:
        agent         = InvoiceMatchingAgent(run_id)
        # Convert Pydantic models to dicts before passing to agent
        po_dict = proc_state.po.model_dump() if hasattr(proc_state.po, 'model_dump') else proc_state.po
        gr_dict = proc_state.gr.model_dump() if hasattr(proc_state.gr, 'model_dump') else proc_state.gr
        invoice_match = agent.run(invoice=invoice, po=po_dict, gr=gr_dict)
        proc_state.invoice_match = invoice_match
        proc_state.current_step  = "payment_scheduling"
    except AgentException as e:
        review_id = enqueue_for_review(
            run_id=run_id,
            agent_name="InvoiceMatchingAgent",
            reason=str(e),
            payload={"invoice_id": invoice.invoice_id, "po": proc_state.po},
        )
        proc_state.human_review_ids.append(review_id)
        proc_state.errors.append(str(e))
        proc_state.current_step = "pending_invoice_review"
        proc_state.status       = RunStatus.PARTIAL

    return {**state, "proc_state": proc_state.model_dump()}


def node_payment_scheduling(state: GraphState) -> GraphState:
    run_id     = state["run_id"]
    proc_state = ProcurementState(**state["proc_state"])

    try:
        agent   = PaymentSchedulingAgent(run_id)
        # Convert Pydantic models to dicts before passing to agent
        invoice_match_dict = proc_state.invoice_match.model_dump() if hasattr(proc_state.invoice_match, 'model_dump') else proc_state.invoice_match
        po_dict = proc_state.po.model_dump() if hasattr(proc_state.po, 'model_dump') else proc_state.po
        payment = agent.run(invoice_match=invoice_match_dict, po=po_dict)
        proc_state.payment      = payment
        proc_state.current_step = "completed"
        proc_state.status       = RunStatus.COMPLETED
        proc_state.completed_at = now_iso()
    except AgentException as e:
        proc_state.errors.append(str(e))
        proc_state.current_step = "failed"
        proc_state.status       = RunStatus.FAILED

    return {**state, "proc_state": proc_state.model_dump()}


# ── Edge conditions ───────────────────────────────────────────────

def route_after_budget(state: GraphState) -> str:
    proc_state = ProcurementState(**state["proc_state"])
    if proc_state.status == RunStatus.FAILED:
        return "failed"
    if "pending" in proc_state.current_step:
        return "wait"
    return "vendor_selection"


def route_after_vendor(state: GraphState) -> str:
    proc_state = ProcurementState(**state["proc_state"])
    if "pending" in proc_state.current_step or proc_state.status == RunStatus.FAILED:
        return "wait"
    return "po_creation"


def route_after_po(state: GraphState) -> str:
    proc_state = ProcurementState(**state["proc_state"])
    if "pending" in proc_state.current_step or proc_state.status == RunStatus.FAILED:
        return "wait"
    return "awaiting_delivery"


# ── Orchestrator class ────────────────────────────────────────────

class ProcurementOrchestrator:
    """
    Main entry point. The frontend calls:
        run_id = orchestrator.start(purchase_request_input)
        orchestrator.trigger_delivery(run_id, delivery_input)
        orchestrator.trigger_invoice(run_id, invoice_input)
    """

    def start(self, input_data: PurchaseRequestInput) -> str:
        run_id = f"RUN-{str(uuid.uuid4())[:8].upper()}"

        initial_state = ProcurementState(
            run_id=run_id,
            status=RunStatus.RUNNING,
            input=input_data,
            current_step="purchase_request",
        )
        create_run(run_id, initial_state)

        audit = AuditTrailAgent(run_id)
        audit.record("RUN_STARTED", payload={"input": input_data.model_dump()})

        # Run the initial pipeline: PR → Budget → Vendor → PO
        graph_state: GraphState = {
            "run_id": run_id,
            "proc_state": initial_state.model_dump(),
            "error": None,
        }

        graph_state = node_purchase_request(graph_state)
        proc        = ProcurementState(**graph_state["proc_state"])
        if proc.status == RunStatus.FAILED:
            update_run(run_id, proc)
            return run_id

        graph_state = node_budget_check(graph_state)
        proc        = ProcurementState(**graph_state["proc_state"])
        update_run(run_id, proc)
        if proc.status in (RunStatus.FAILED, RunStatus.PARTIAL):
            return run_id

        graph_state = node_vendor_selection(graph_state)
        proc        = ProcurementState(**graph_state["proc_state"])
        update_run(run_id, proc)
        if proc.status in (RunStatus.FAILED, RunStatus.PARTIAL):
            return run_id

        graph_state = node_po_creation(graph_state)
        proc        = ProcurementState(**graph_state["proc_state"])
        update_run(run_id, proc)

        return run_id

    def trigger_delivery(self, run_id: str, delivery: DeliveryInput) -> dict:
        """Called by frontend when delivery arrives."""
        from db.db import get_run
        run = get_run(run_id)
        if not run:
            raise ValueError(f"Run '{run_id}' not found")

        proc_state = ProcurementState.model_validate_json(run["state_json"])

        graph_state: GraphState = {
            "run_id": run_id,
            "proc_state": proc_state.model_dump(),
            "error": None,
        }

        graph_state = node_goods_receipt(graph_state, delivery=delivery)
        proc        = ProcurementState(**graph_state["proc_state"])
        update_run(run_id, proc)
        return proc.model_dump()

    def trigger_invoice(self, run_id: str, invoice: InvoiceInput) -> dict:
        """Called by frontend when invoice arrives from vendor."""
        from db.db import get_run
        run = get_run(run_id)
        if not run:
            raise ValueError(f"Run '{run_id}' not found")

        proc_state = ProcurementState.model_validate_json(run["state_json"])

        graph_state: GraphState = {
            "run_id": run_id,
            "proc_state": proc_state.model_dump(),
            "error": None,
        }

        graph_state = node_invoice_matching(graph_state, invoice=invoice)
        proc        = ProcurementState(**graph_state["proc_state"])
        update_run(run_id, proc)

        if "payment" in proc.current_step:
            graph_state = node_payment_scheduling(graph_state)
            proc        = ProcurementState(**graph_state["proc_state"])
            update_run(run_id, proc)

        return proc.model_dump()

    def resume_after_approval(self, run_id: str) -> dict:
        """
        Called after a human review approval to automatically resume the pipeline.
        Continues from the pending stage to the next stage.
        """
        from db.db import get_run
        import signal
        import sys
        
        print(f"[AUTO-RESUME] Starting for run_id={run_id}")
        
        run = get_run(run_id)
        if not run:
            raise ValueError(f"Run '{run_id}' not found")

        proc_state = ProcurementState.model_validate_json(run["state_json"])
        print(f"[AUTO-RESUME] Current step: {proc_state.current_step}")
        print(f"[AUTO-RESUME] Vendor data exists: {proc_state.vendor is not None}")
        print(f"[AUTO-RESUME] PR data exists: {proc_state.pr is not None}")
        
        # If run is not in a pending review state, don't resume
        if not proc_state.current_step.startswith("pending_"):
            print(f"[AUTO-RESUME] Not in pending state, skipping")
            return proc_state.model_dump()

        graph_state: GraphState = {
            "run_id": run_id,
            "proc_state": proc_state.model_dump(),
            "error": None,
        }

        # Resume from the appropriate stage based on the pending review
        try:
            if proc_state.current_step == "pending_budget_review":
                print(f"[AUTO-RESUME] Resuming from budget review → vendor selection")
                # Budget was approved, continue to vendor selection
                proc_state.current_step = "vendor_selection"
                proc_state.status = RunStatus.RUNNING  # ← RESET STATUS!
                graph_state["proc_state"] = proc_state.model_dump()
                
                print(f"[AUTO-RESUME] Calling node_vendor_selection...")
                graph_state = node_vendor_selection(graph_state)
                proc = ProcurementState.model_validate(graph_state["proc_state"])
                print(f"[AUTO-RESUME] After vendor selection: status={proc.status}, step={proc.current_step}")
                update_run(run_id, proc)
                
                # If vendor selection FAILS and needs review, stop here
                if proc.current_step == "pending_vendor_review":
                    print(f"[AUTO-RESUME] ⚠️  Vendor review needed - STOPPING")
                    return proc.model_dump()
                
                print(f"[AUTO-RESUME] Vendor selected successfully, moving to PO creation")
                # Otherwise continue to PO creation
                if proc.vendor:
                    print(f"[AUTO-RESUME] Calling node_po_creation with vendor: {proc.vendor.get('vendor_name') if isinstance(proc.vendor, dict) else 'exists'}")
                    graph_state = node_po_creation(graph_state)
                    proc = ProcurementState.model_validate(graph_state["proc_state"])
                    print(f"[AUTO-RESUME] After PO creation: status={proc.status}, step={proc.current_step}")
                    update_run(run_id, proc)
                else:
                    print(f"[AUTO-RESUME] ❌ ERROR: No vendor data available for PO creation!")
                    proc_state.current_step = "failed"
                    proc_state.status = RunStatus.FAILED
                    proc_state.errors.append("Vendor data missing for PO creation")
                    update_run(run_id, proc_state)
                    return proc_state.model_dump()

            elif proc_state.current_step == "pending_vendor_review":
                print(f"[AUTO-RESUME] Resuming from vendor review → vendor selection")
                # Approval doesn't inject vendor data; re-run vendor selection.
                proc_state.current_step = "vendor_selection"
                proc_state.status = RunStatus.RUNNING  # ← RESET STATUS!
                graph_state["proc_state"] = proc_state.model_dump()

                print(f"[AUTO-RESUME] Calling node_vendor_selection...")
                graph_state = node_vendor_selection(graph_state)
                proc = ProcurementState.model_validate(graph_state["proc_state"])
                print(f"[AUTO-RESUME] After vendor selection: status={proc.status}, step={proc.current_step}")
                update_run(run_id, proc)

                # If still pending vendor review (e.g., no vendors), stop here.
                if proc.current_step == "pending_vendor_review":
                    print(f"[AUTO-RESUME] ⚠️  Vendor review still needed - STOPPING")
                    return proc.model_dump()

                print(f"[AUTO-RESUME] Vendor selected successfully, moving to PO creation")
                graph_state = node_po_creation(graph_state)
                proc = ProcurementState.model_validate(graph_state["proc_state"])
                print(f"[AUTO-RESUME] After PO creation: status={proc.status}, step={proc.current_step}")
                update_run(run_id, proc)

            elif proc_state.current_step == "pending_po_review":
                print(f"[AUTO-RESUME] Resuming from PO review → awaiting delivery")
                # PO creation was approved, move to awaiting delivery
                proc_state.current_step = "awaiting_delivery"
                proc_state.status = RunStatus.RUNNING
                update_run(run_id, proc_state)
                proc = proc_state

            elif proc_state.current_step == "pending_gr_review":
                print(f"[AUTO-RESUME] Resuming from GR review → awaiting invoice")
                # Goods receipt was approved, move to awaiting invoice
                proc_state.current_step = "awaiting_invoice"
                proc_state.status = RunStatus.RUNNING
                update_run(run_id, proc_state)
                proc = proc_state

            elif proc_state.current_step == "pending_invoice_review":
                print(f"[AUTO-RESUME] Resuming from invoice review → payment scheduling")
                # Invoice was approved, continue to payment scheduling
                proc_state.current_step = "payment_scheduling"
                proc_state.status = RunStatus.RUNNING  # ← RESET STATUS!
                graph_state["proc_state"] = proc_state.model_dump()
                
                print(f"[AUTO-RESUME] Calling node_payment_scheduling...")
                graph_state = node_payment_scheduling(graph_state)
                proc = ProcurementState.model_validate(graph_state["proc_state"])
                print(f"[AUTO-RESUME] After payment: status={proc.status}, step={proc.current_step}")
                update_run(run_id, proc)

            else:
                # Unknown pending state, just update status
                print(f"[AUTO-RESUME] Unknown pending state, resuming generic RUNNING")
                proc_state.status = RunStatus.RUNNING
                update_run(run_id, proc_state)
                proc = proc_state

            print(f"[AUTO-RESUME] ✅ Success! Now at: {proc.current_step}")
            return proc.model_dump()
            
        except Exception as e:
            print(f"[AUTO-RESUME] ❌ CRITICAL ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            # Don't re-raise - mark run as failed and continue
            try:
                proc_state.current_step = "failed"
                proc_state.status = RunStatus.FAILED
                proc_state.errors.append(f"Auto-resume error: {str(e)}")
                update_run(run_id, proc_state)
            except:
                pass
            return proc_state.model_dump()