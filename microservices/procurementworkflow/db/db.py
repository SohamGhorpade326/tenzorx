import sqlite3
import json
import os
from datetime import datetime
from typing import Any, Optional

from config import DB_PATH
from models.enums import AuditStatus, RunStatus, ReviewStatus
from models.schemas import (
    ProcurementState, AuditEvent, ReviewItem
)


class PydanticEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Pydantic models."""
    def default(self, obj):
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()
        elif hasattr(obj, '__dict__'):
            return obj.__dict__
        return super().default(obj)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Run schema.sql to create all tables if they don't exist."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        sql = f.read()
    with _connect() as conn:
        conn.executescript(sql)
    print("[DB] Schema initialised.")


def now_iso() -> str:
    return datetime.utcnow().isoformat()


# ── Procurement Runs ──────────────────────────────────────────────

def create_run(run_id: str, state: ProcurementState) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO procurement_runs (run_id, status, current_step, state_json)
               VALUES (?, ?, ?, ?)""",
            (run_id, state.status.value, state.current_step, state.model_dump_json())
        )


def update_run(run_id: str, state: ProcurementState) -> None:
    completed_at = now_iso() if state.status in (RunStatus.COMPLETED, RunStatus.FAILED) else None
    with _connect() as conn:
        conn.execute(
            """UPDATE procurement_runs
               SET status=?, current_step=?, state_json=?, completed_at=?
               WHERE run_id=?""",
            (state.status.value, state.current_step, state.model_dump_json(), completed_at, run_id)
        )


def get_run(run_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM procurement_runs WHERE run_id=?", (run_id,)
        ).fetchone()
    return dict(row) if row else None


def list_runs(limit: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT run_id, status, current_step, created_at, completed_at "
            "FROM procurement_runs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# ── Audit Log ─────────────────────────────────────────────────────

def write_audit(event: AuditEvent) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO audit_log (run_id, agent_name, action, status, payload, error_msg)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                event.run_id,
                event.agent_name,
                event.action,
                event.status.value,
                json.dumps(event.payload, cls=PydanticEncoder) if event.payload else None,
                event.error_msg,
            )
        )


def get_audit_log(run_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE run_id=? ORDER BY created_at ASC", (run_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_all_audit_log(limit: int = 200) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# ── Human Review Queue ────────────────────────────────────────────

def create_review_item(item: ReviewItem) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO human_review_queue
               (review_id, run_id, agent_name, reason, payload, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                item.review_id,
                item.run_id,
                item.agent_name,
                item.reason,
                json.dumps(item.payload, cls=PydanticEncoder),
                item.status.value,
                item.created_at,
            )
        )


def get_pending_reviews() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM human_review_queue WHERE status='PENDING_APPROVAL' ORDER BY created_at ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_review(review_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM human_review_queue WHERE review_id=?", (review_id,)
        ).fetchone()
    return dict(row) if row else None


def resolve_review(review_id: str, status: ReviewStatus, note: Optional[str] = None) -> None:
    with _connect() as conn:
        conn.execute(
            """UPDATE human_review_queue
               SET status=?, resolved_at=?, resolution_note=?
               WHERE review_id=?""",
            (status.value, now_iso(), note, review_id)
        )


# ── Purchase Requests ─────────────────────────────────────────────

def save_purchase_request(run_id: str, pr: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO purchase_requests
               (pr_id, run_id, item_name, quantity, unit_price, total_amount,
                department, requester_id, category, category_code,
                approval_required, status, required_by, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                pr["pr_id"], run_id,
                pr["item_name"], pr["quantity"], pr["unit_price"], pr["total_amount"],
                pr["department"], pr["requester_id"], pr["category"], pr["category_code"],
                1 if pr["approval_required"] else 0,
                pr["status"], pr.get("required_by"), pr["created_at"],
            )
        )


def get_purchase_request(pr_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM purchase_requests WHERE pr_id=?", (pr_id,)
        ).fetchone()
    return dict(row) if row else None


# ── Purchase Orders ───────────────────────────────────────────────

def save_po(run_id: str, po: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO purchase_orders
               (po_id, run_id, pr_id, vendor_id, po_document, dispatch_status,
                retry_count, dispatched_at, error, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                po["po_id"], run_id, po["pr_id"], po["vendor_id"],
                json.dumps(po["po_document"], cls=PydanticEncoder),
                po["dispatch_status"], po["retry_count"],
                po.get("dispatched_at"), po.get("error"), now_iso(),
            )
        )


def get_po(po_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM purchase_orders WHERE po_id=?", (po_id,)
        ).fetchone()
    if row:
        d = dict(row)
        d["po_document"] = json.loads(d["po_document"])
        return d
    return None


# ── Goods Receipts ────────────────────────────────────────────────

def save_gr(run_id: str, gr: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO goods_receipts
               (gr_id, run_id, po_id, match_status, received_items,
                discrepancy_details, payment_block, received_at, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                gr["gr_id"], run_id, gr["po_id"], gr["match_status"],
                json.dumps(gr["received_items"], cls=PydanticEncoder),
                gr.get("discrepancy_details"),
                1 if gr["payment_block"] else 0,
                gr["received_at"], now_iso(),
            )
        )


def get_gr(gr_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM goods_receipts WHERE gr_id=?", (gr_id,)
        ).fetchone()
    if row:
        d = dict(row)
        d["received_items"] = json.loads(d["received_items"])
        return d
    return None


def get_gr_by_po(po_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM goods_receipts WHERE po_id=? ORDER BY created_at DESC LIMIT 1",
            (po_id,)
        ).fetchone()
    if row:
        d = dict(row)
        d["received_items"] = json.loads(d["received_items"])
        return d
    return None


# ── Invoice Matches ───────────────────────────────────────────────

def save_invoice_match(run_id: str, match: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO invoice_matches
               (match_id, run_id, po_id, gr_id, invoice_id, match_result,
                checks_json, variance_amount, block_reason, matched_at, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                match["match_id"], run_id, match["po_id"], match["gr_id"],
                match["invoice_id"], match["match_result"],
                json.dumps(match["checks"], cls=PydanticEncoder),
                match["variance_amount"], match.get("block_reason"),
                match["matched_at"], now_iso(),
            )
        )


# ── Payments ──────────────────────────────────────────────────────

def save_payment(run_id: str, payment: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO payments
               (payment_id, run_id, po_id, vendor_id, invoice_amount, scheduled_amount,
                early_discount_applied, discount_amount, due_date, payment_terms_used,
                vendor_bank_ref, status, scheduled_at, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                payment["payment_id"], run_id, payment["po_id"], payment["vendor_id"],
                payment["invoice_amount"], payment["scheduled_amount"],
                1 if payment["early_discount_applied"] else 0,
                payment["discount_amount"], payment["due_date"],
                payment["payment_terms_used"], payment.get("vendor_bank_ref"),
                payment["status"], payment["scheduled_at"], now_iso(),
            )
        )


def get_payment_by_po(po_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM payments WHERE po_id=? ORDER BY created_at DESC LIMIT 1",
            (po_id,)
        ).fetchone()
    return dict(row) if row else None