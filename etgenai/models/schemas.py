from __future__ import annotations
from datetime import datetime, date
from typing import Any, Optional
from pydantic import BaseModel, Field
from models.enums import (
    PRStatus, BudgetStatus, VendorStatus, POStatus,
    GRMatchStatus, InvoiceMatchResult, PaymentStatus,
    AuditStatus, ReviewStatus, RunStatus
)


# ── Shared ────────────────────────────────────────────────────────

class LineItem(BaseModel):
    item_name : str
    quantity  : float
    unit_price: float

    @property
    def total(self) -> float:
        return self.quantity * self.unit_price


# ── Purchase Request ──────────────────────────────────────────────

class PurchaseRequestInput(BaseModel):
    item_name   : str
    quantity    : float
    unit_price  : float
    department  : str
    requester_id: str
    category    : str
    required_by : Optional[str] = None   # ISO date string YYYY-MM-DD


class PurchaseRequest(BaseModel):
    pr_id            : str
    item_name        : str
    quantity         : float
    unit_price       : float
    total_amount     : float
    department       : str
    requester_id     : str
    category         : str
    category_code    : str
    approval_required: bool
    status           : PRStatus
    required_by      : Optional[str] = None
    created_at       : str


# ── Budget ────────────────────────────────────────────────────────

class BudgetCheckResult(BaseModel):
    pr_id            : str
    budget_status    : BudgetStatus
    allocated_budget : float
    spent_so_far     : float
    this_request     : float
    remaining_after  : float
    utilisation_pct  : float
    reason           : str


# ── Vendor ────────────────────────────────────────────────────────

class VendorRecord(BaseModel):
    vendor_id      : str
    vendor_name    : str
    category_codes : list[str]
    unit_price     : float
    lead_time_days : int
    quality_rating : float
    is_preferred   : bool = False
    is_approved    : bool = True


class VendorSelectionResult(BaseModel):
    pr_id           : str
    vendor_id       : str
    vendor_name     : str
    quoted_price_per_unit: float
    total_quoted    : float
    lead_time_days  : int
    quality_rating  : float
    score           : float
    selection_reason: str
    status          : VendorStatus


# ── Purchase Order ────────────────────────────────────────────────

class PODocument(BaseModel):
    po_number    : str
    issued_date  : str
    delivery_date: str
    payment_terms: str
    vendor_name  : str
    vendor_id    : str
    department   : str
    line_items   : list[LineItem]
    total_amount : float


class POCreationResult(BaseModel):
    po_id           : str
    pr_id           : str
    vendor_id       : str
    po_document     : PODocument
    dispatch_status : POStatus
    retry_count     : int
    dispatched_at   : Optional[str] = None
    error           : Optional[str] = None


# ── Goods Receipt ─────────────────────────────────────────────────

class DeliveryInput(BaseModel):
    po_id             : str
    delivered_items   : list[str]
    delivered_quantities: list[float]
    delivery_date     : str
    delivery_note_ref : str


class GRLineItem(BaseModel):
    item_name : str
    expected  : float
    received  : float
    match     : bool


class GoodsReceiptResult(BaseModel):
    gr_id               : str
    po_id               : str
    match_status        : GRMatchStatus
    received_items      : list[GRLineItem]
    discrepancy_details : Optional[str] = None
    payment_block       : bool
    received_at         : str


# ── Invoice ───────────────────────────────────────────────────────

class InvoiceInput(BaseModel):
    po_id          : str
    gr_id          : str
    invoice_id     : str
    invoice_amount : float
    invoice_items  : list[LineItem]
    invoice_date   : str
    vendor_bank_ref: Optional[str] = None


class ThreeWayChecks(BaseModel):
    quantity_match: bool
    price_match   : bool
    total_match   : bool
    item_match    : bool


class InvoiceMatchingResult(BaseModel):
    match_id       : str
    po_id          : str
    gr_id          : str
    invoice_id     : str
    match_result   : InvoiceMatchResult
    checks         : ThreeWayChecks
    variance_amount: float
    block_reason   : Optional[str] = None
    matched_at     : str


# ── Payment ───────────────────────────────────────────────────────

class PaymentResult(BaseModel):
    payment_id            : str
    po_id                 : str
    vendor_id             : str
    invoice_amount        : float
    scheduled_amount      : float
    early_discount_applied: bool
    discount_amount       : float
    due_date              : str
    payment_terms_used    : str
    vendor_bank_ref       : Optional[str] = None
    status                : PaymentStatus
    scheduled_at          : str


# ── Audit ─────────────────────────────────────────────────────────

class AuditEvent(BaseModel):
    run_id    : str
    agent_name: str
    action    : str
    status    : AuditStatus
    payload   : Optional[dict[str, Any]] = None
    error_msg : Optional[str] = None


class AuditLogRow(AuditEvent):
    id        : int
    created_at: str


# ── Human Review ──────────────────────────────────────────────────

class ReviewItem(BaseModel):
    review_id  : str
    run_id     : str
    agent_name : str
    reason     : str
    payload    : dict[str, Any]
    status     : ReviewStatus = ReviewStatus.PENDING_APPROVAL
    created_at : str
    resolved_at: Optional[str] = None
    resolution_note: Optional[str] = None


# ── Orchestrator State ────────────────────────────────────────────

class ProcurementState(BaseModel):
    run_id          : str
    status          : RunStatus = RunStatus.RUNNING
    input           : Optional[PurchaseRequestInput] = None
    pr              : Optional[PurchaseRequest] = None
    budget          : Optional[BudgetCheckResult] = None
    vendor          : Optional[VendorSelectionResult] = None
    po              : Optional[POCreationResult] = None
    gr              : Optional[GoodsReceiptResult] = None
    invoice_match   : Optional[InvoiceMatchingResult] = None
    payment         : Optional[PaymentResult] = None
    errors          : list[str] = Field(default_factory=list)
    human_review_ids: list[str] = Field(default_factory=list)
    current_step    : str = "start"
    completed_at    : Optional[str] = None


# ── API Request/Response models ───────────────────────────────────

class RunProcurementRequest(BaseModel):
    purchase_request: PurchaseRequestInput


class RunStatusResponse(BaseModel):
    run_id      : str
    status      : RunStatus
    current_step: str
    state       : ProcurementState


class DeliveryTriggerRequest(BaseModel):
    delivery: DeliveryInput


class InvoiceTriggerRequest(BaseModel):
    invoice: InvoiceInput


class ReviewActionRequest(BaseModel):
    action : str   # "approve" or "reject"
    note   : Optional[str] = None