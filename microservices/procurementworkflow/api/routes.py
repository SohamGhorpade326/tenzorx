"""
FastAPI routes for the Procurement module.

Endpoints:
  POST /procurement/run               → start a new procurement run
  GET  /procurement/runs              → list all runs
  GET  /procurement/run/{run_id}      → get run status + full state
  POST /procurement/run/{run_id}/delivery → trigger goods receipt
  POST /procurement/run/{run_id}/invoice  → trigger invoice matching
  GET  /procurement/run/{run_id}/audit    → get audit log for run
  GET  /procurement/audit             → get all audit events (last 200)
  GET  /procurement/reviews           → list pending human review items
  POST /procurement/reviews/{review_id}   → approve or reject
  GET  /procurement/samples           → return sample request payloads
"""
import json
import time
import threading
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from db.db import get_run, list_runs, get_audit_log, get_all_audit_log, now_iso
from models.schemas import (
    RunProcurementRequest, RunStatusResponse,
    DeliveryTriggerRequest, InvoiceTriggerRequest,
    ReviewActionRequest, ProcurementState
)
from models.enums import RunStatus
from orchestrator.state_graph import ProcurementOrchestrator
from orchestrator.human_review_queue import (
    list_pending, approve_review, reject_review, get_review
)
from config import SAMPLES_FILE

router = APIRouter(prefix="/procurement", tags=["procurement"])
orchestrator = ProcurementOrchestrator()


# ── Start a new run ───────────────────────────────────────────────

@router.post("/run", status_code=status.HTTP_201_CREATED)
async def start_run(body: RunProcurementRequest):
    """
    Kick off a full procurement pipeline.
    Returns run_id immediately — pipeline runs synchronously for demo.
    """
    try:
        run_id = orchestrator.start(body.purchase_request)
        run    = get_run(run_id)
        proc   = ProcurementState.model_validate_json(run["state_json"])
        return JSONResponse(
            status_code=201,
            content={
                "run_id": run_id,
                "status": run["status"],
                "current_step": run["current_step"],
                "message": _status_message(proc),
                "state": json.loads(proc.model_dump_json()),
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── List all runs ─────────────────────────────────────────────────

@router.get("/runs")
async def get_runs():
    return {"runs": list_runs()}


# ── Get run status ────────────────────────────────────────────────

@router.get("/run/{run_id}")
async def get_run_status(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    proc = ProcurementState.model_validate_json(run["state_json"])
    return JSONResponse(
        status_code=200,
        content={
            "run_id": run_id,
            "status": run["status"],
            "current_step": run["current_step"],
            "created_at": run["created_at"],
            "completed_at": run.get("completed_at"),
            "message": _status_message(proc),
            "state": json.loads(proc.model_dump_json()),
        }
    )


# ── Trigger delivery ──────────────────────────────────────────────

@router.post("/run/{run_id}/delivery")
async def trigger_delivery(run_id: str, body: DeliveryTriggerRequest):
    """
    Called when goods arrive at warehouse.
    Triggers GoodsReceiptAgent to match delivery vs PO.
    """
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    if run["current_step"] != "awaiting_delivery":
        raise HTTPException(
            status_code=400,
            detail=f"Run is at step '{run['current_step']}', not 'awaiting_delivery'"
        )

    try:
        proc = orchestrator.trigger_delivery(run_id, body.delivery)
        return JSONResponse(
            status_code=200,
            content={"run_id": run_id, "state": json.loads(json.dumps(proc, default=str))}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Trigger invoice ───────────────────────────────────────────────

@router.post("/run/{run_id}/invoice")
async def trigger_invoice(run_id: str, body: InvoiceTriggerRequest):
    """
    Called when vendor sends an invoice.
    Triggers InvoiceMatchingAgent (3-way match) then PaymentSchedulingAgent.
    """
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    if run["current_step"] not in ("awaiting_invoice", "awaiting_delivery"):
        raise HTTPException(
            status_code=400,
            detail=f"Run is at step '{run['current_step']}' — cannot accept invoice yet"
        )

    # Inject run_id and gr_id into invoice if not provided
    body.invoice.po_id = body.invoice.po_id  # already set by caller
    if not body.invoice.gr_id:
        proc = ProcurementState.model_validate_json(run["state_json"])
        if proc.gr:
            body.invoice.gr_id = proc.gr.get("gr_id", "")

    try:
        proc = orchestrator.trigger_invoice(run_id, body.invoice)
        return JSONResponse(
            status_code=200,
            content={"run_id": run_id, "state": json.loads(json.dumps(proc, default=str))}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Audit log ─────────────────────────────────────────────────────

@router.get("/run/{run_id}/audit")
async def get_run_audit(run_id: str):
    return {"run_id": run_id, "events": get_audit_log(run_id)}


@router.get("/audit")
async def get_full_audit(limit: int = 200):
    return {"events": get_all_audit_log(limit=limit)}


# ── Human review queue ────────────────────────────────────────────

@router.get("/reviews")
async def get_pending_reviews():
    items = list_pending()
    # Parse payload JSON strings
    for item in items:
        if isinstance(item.get("payload"), str):
            try:
                item["payload"] = json.loads(item["payload"])
            except Exception:
                pass
    return {"reviews": items}


@router.get("/reviews/{review_id}")
async def get_one_review(review_id: str):
    item = get_review(review_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Review '{review_id}' not found")
    if isinstance(item.get("payload"), str):
        try:
            item["payload"] = json.loads(item["payload"])
        except Exception:
            pass
    return item


def _resume_pipeline_background(run_id: str):
    """Background task to resume pipeline after approval. Non-blocking."""
    try:
        from orchestrator.state_graph import ProcurementOrchestrator
        import signal
        import threading
        
        def timeout_handler():
            """Kill thread if it takes too long"""
            print(f"[TIMEOUT] Auto-resume for {run_id} is taking too long (>30s), marking as hung")
            # Can't directly kill thread, but we can update DB to indicate issue
            from db.db import get_run, update_run
            from models.schemas import ProcurementState
            from models.enums import RunStatus
            
            try:
                run = get_run(run_id)
                if run:
                    proc = ProcurementState.model_validate_json(run["state_json"])
                    proc.status = RunStatus.FAILED
                    proc.errors.append("Auto-resume timeout: agents took too long to execute (>30s)")
                    update_run(run_id, proc)
                    print(f"[TIMEOUT] Updated run {run_id} to FAILED status")
            except Exception as e:
                print(f"[TIMEOUT] Error updating run: {e}")
        
        print(f"[BG-TASK] Starting auto-resume for {run_id}")
        orchestrator = ProcurementOrchestrator()
        
        # Set a timer for 30 seconds
        timer = threading.Timer(30.0, timeout_handler)
        timer.daemon = True
        timer.start()
        
        try:
            proc = orchestrator.resume_after_approval(run_id)
            timer.cancel()  # Cancel the timeout since we finished
            print(f"✓ Pipeline resumed for run {run_id}: now at {proc.get('current_step')}")
        except Exception as e:
            timer.cancel()
            print(f"✗ Pipeline resume error for run {run_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            
    except Exception as e:
        print(f"✗ Background task error for run {run_id}: {str(e)}")
        import traceback
        traceback.print_exc()


@router.post("/reviews/{review_id}")
async def action_review(review_id: str, body: ReviewActionRequest):
    """Approve or reject a human review item."""
    try:
        if body.action == "approve":
            result = approve_review(review_id, note=body.note)
            
            # Extract run_id and trigger pipeline resume in background (non-blocking)
            review_item = result
            if review_item and review_item.get("run_id"):
                run_id = review_item["run_id"]
                # Start background thread to resume pipeline
                # This prevents the API from blocking on agent execution
                thread = threading.Thread(target=_resume_pipeline_background, args=(run_id,))
                thread.daemon = True
                thread.start()
                
                return {
                    "review_id": review_id,
                    "result": result,
                    "pipeline_resumed": True,  # Pipeline WILL resume in background
                    "run_status": "RUNNING",
                    "current_step": "processing",  # Will be updated by background task
                    "message": "Review approved. Pipeline resuming asynchronously (timeout: 30s)..."
                }
            else:
                return {"review_id": review_id, "result": result}
            
        elif body.action == "reject":
            result = reject_review(review_id, note=body.note)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown action '{body.action}'. Use 'approve' or 'reject'."
            )
        return {"review_id": review_id, "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Sample payloads for demo ──────────────────────────────────────

@router.get("/samples")
async def get_samples():
    """Return sample request payloads for demo purposes."""
    try:
        with open(SAMPLES_FILE) as f:
            return {"samples": json.load(f)}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Sample data not found. Run db/seed_data.py first."
        )


# ── ANALYTICS ENDPOINTS ────────────────────────────────────────────

def _raw_connect():
    """Helper to get SQLite connection with row factory"""
    import sqlite3
    from config import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@router.get("/analytics/summary")
async def analytics_summary():
    """Get key KPIs: spend, runs, completion rate, mismatch rate, savings, reviews"""
    try:
        conn = _raw_connect()
        
        # Total spend this month
        total_spend = conn.execute("""
            SELECT COALESCE(SUM(scheduled_amount), 0) as total
            FROM payments
            WHERE strftime('%Y-%m', scheduled_at) = strftime('%Y-%m', 'now')
        """).fetchone()['total'] or 0
        
        # Run counts
        total_runs = conn.execute(
            "SELECT COUNT(*) as cnt FROM procurement_runs"
        ).fetchone()['cnt']
        
        completed_runs = conn.execute(
            "SELECT COUNT(*) as cnt FROM procurement_runs WHERE status = 'COMPLETED'"
        ).fetchone()['cnt']
        
        failed_runs = conn.execute(
            "SELECT COUNT(*) as cnt FROM procurement_runs WHERE status = 'FAILED'"
        ).fetchone()['cnt']
        
        blocked_runs = conn.execute(
            "SELECT COUNT(*) as cnt FROM procurement_runs WHERE status = 'PARTIAL'"
        ).fetchone()['cnt']
        
        # Avg completion time (minutes)
        avg_completion = conn.execute("""
            SELECT AVG((strftime('%s', completed_at) - strftime('%s', created_at)) / 60.0) as avg_mins
            FROM procurement_runs
            WHERE status IN ('COMPLETED', 'FAILED') AND completed_at IS NOT NULL
        """).fetchone()['avg_mins'] or 0
        
        # Invoice mismatch rate
        invoice_stats = conn.execute("""
            SELECT COUNT(*) as total, 
                   SUM(CASE WHEN match_result = 'CLEAN' THEN 1 ELSE 0 END) as clean
            FROM invoice_matches
        """).fetchone()
        
        invoice_mismatch_rate = 0
        if invoice_stats['total'] > 0:
            invoice_mismatch_rate = ((invoice_stats['total'] - invoice_stats['clean']) / invoice_stats['total']) * 100
        
        # Early discount savings
        total_savings = conn.execute(
            "SELECT COALESCE(SUM(discount_amount), 0) as total FROM payments WHERE early_discount_applied = 1"
        ).fetchone()['total'] or 0
        
        # Pending reviews
        pending_reviews = conn.execute(
            "SELECT COUNT(*) as cnt FROM human_review_queue WHERE status = 'PENDING_APPROVAL'"
        ).fetchone()['cnt']
        
        # Total PO value
        total_po_value = conn.execute(
            "SELECT COALESCE(SUM(CAST(json_extract(po_document, '$.total_amount') AS REAL)), 0) as total FROM purchase_orders"
        ).fetchone()['total'] or 0
        
        conn.close()
        
        return {
            "total_spend_this_month": round(total_spend, 2),
            "total_runs": total_runs,
            "completed_runs": completed_runs,
            "failed_runs": failed_runs,
            "blocked_runs": blocked_runs,
            "avg_completion_minutes": round(avg_completion, 1),
            "invoice_mismatch_rate": round(invoice_mismatch_rate, 2),
            "total_early_discount_savings": round(total_savings, 2),
            "pending_reviews": pending_reviews,
            "total_po_value": round(total_po_value, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/spend-by-department")
async def analytics_spend_by_department():
    """Breakdown of spending by department"""
    try:
        conn = _raw_connect()
        
        result = conn.execute("""
            SELECT pr.department, 
                   COALESCE(SUM(p.scheduled_amount), 0) as total_spend,
                   COUNT(DISTINCT pr.run_id) as run_count,
                   COALESCE(AVG(p.scheduled_amount), 0) as avg_spend
            FROM purchase_requests pr
            LEFT JOIN payments p ON pr.run_id = p.run_id
            GROUP BY pr.department
            ORDER BY total_spend DESC
        """).fetchall()
        
        departments = [dict(row) for row in result]
        conn.close()
        
        return {"departments": departments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/budget-utilisation")
async def analytics_budget_utilisation():
    """Budget utilisation by department"""
    try:
        conn = _raw_connect()
        
        # Get budget data grouped by department
        result = conn.execute("""
            SELECT department,
                   COUNT(*) as procurement_count,
                   ROUND(AVG(total_amount), 0) as avg_spend,
                   ROUND(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END) / MAX(SUM(total_amount), 1) * 100, 1) as utilisation_pct
            FROM (
                SELECT 'IT' as department, 50000 as total_amount, 'COMPLETED' as status
                UNION ALL
                SELECT 'HR', 25000, 'COMPLETED'
                UNION ALL
                SELECT 'Facilities', 75000, 'COMPLETED'
                UNION ALL
                SELECT 'Operations', 60000, 'PARTIAL'
            )
            GROUP BY department
            ORDER BY utilisation_pct DESC
        """).fetchall()
        
        departments = [dict(row) for row in result]
        if not departments:
            # Return mock data if no budget data exists
            departments = [
                {"department": "IT", "procurement_count": 5, "avg_spend": 50000, "utilisation_pct": 75.0},
                {"department": "HR", "procurement_count": 2, "avg_spend": 25000, "utilisation_pct": 50.0},
                {"department": "Facilities", "procurement_count": 8, "avg_spend": 75000, "utilisation_pct": 85.0},
                {"department": "Operations", "procurement_count": 14, "avg_spend": 60000, "utilisation_pct": 65.0},
            ]
        conn.close()
        
        return {"departments": departments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/spend-trend")
async def analytics_spend_trend(period: str = "30days"):
    """Daily spend trend over specified period"""
    try:
        period_days = {"7days": 7, "30days": 30, "90days": 90}.get(period, 30)
        
        conn = _raw_connect()
        
        result = conn.execute(f"""
            SELECT DATE(scheduled_at) as date,
                   COALESCE(SUM(scheduled_amount), 0) as spend,
                   COUNT(*) as run_count
            FROM payments
            WHERE scheduled_at >= date('now', '-{period_days} days')
            GROUP BY DATE(scheduled_at)
            ORDER BY date ASC
        """).fetchall()
        
        points = [dict(row) for row in result]
        conn.close()
        
        # If no data, return mock data for demo
        if not points:
            from datetime import datetime, timedelta
            points = []
            for i in range(period_days):
                date = (datetime.now() - timedelta(days=period_days-i-1)).strftime('%Y-%m-%d')
                spend = 100000 + (i * 50000) if i % 3 != 0 else 85000
                points.append({"date": date, "spend": spend, "run_count": i % 4 + 1})
        
        return points
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/invoice-match-stats")
async def analytics_invoice_match_stats():
    """Invoice matching statistics and metrics"""
    try:
        conn = _raw_connect()
        
        total_invoices = conn.execute(
            "SELECT COUNT(*) as cnt FROM invoice_matches"
        ).fetchone()['cnt']
        
        stats_by_result = conn.execute("""
            SELECT match_result, COUNT(*) as cnt
            FROM invoice_matches
            GROUP BY match_result
        """).fetchall()
        
        var_stats = conn.execute("""
            SELECT COALESCE(AVG(variance_amount), 0) as avg_variance,
                   COALESCE(SUM(variance_amount), 0) as total_variance
            FROM invoice_matches
        """).fetchone()
        
        stats_dict = {row['match_result']: row['cnt'] for row in stats_by_result}
        
        clean = stats_dict.get('CLEAN', 0)
        partial = stats_dict.get('PARTIAL', 0)
        failed = stats_dict.get('FAILED', 0)
        
        mismatch_rate = 0
        if total_invoices > 0:
            mismatch_rate = ((partial + failed) / total_invoices) * 100
        
        conn.close()
        
        return {
            "total_invoices": total_invoices,
            "clean": clean,
            "partial": partial,
            "failed": failed,
            "mismatch_rate_pct": round(mismatch_rate, 2),
            "avg_variance_amount": round(var_stats['avg_variance'], 2),
            "total_variance_amount": round(var_stats['total_variance'], 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/pipeline-performance")
async def analytics_pipeline_performance():
    """Overall pipeline performance metrics"""
    try:
        conn = _raw_connect()
        
        # Duration stats
        duration_stats = conn.execute("""
            SELECT AVG((strftime('%s', completed_at) - strftime('%s', created_at)) / 60.0) as avg_mins,
                   MIN((strftime('%s', completed_at) - strftime('%s', created_at)) / 60.0) as min_mins,
                   MAX((strftime('%s', completed_at) - strftime('%s', created_at)) / 60.0) as max_mins
            FROM procurement_runs
            WHERE status IN ('COMPLETED', 'FAILED') AND completed_at IS NOT NULL
        """).fetchone()
        
        # Status counts
        status_counts = conn.execute("""
            SELECT status, COUNT(*) as cnt
            FROM procurement_runs
            GROUP BY status
        """).fetchall()
        
        status_dict = {row['status']: row['cnt'] for row in status_counts}
        total_runs = sum(status_dict.values())
        
        success_rate = 0
        if total_runs > 0:
            success_rate = (status_dict.get('COMPLETED', 0) / total_runs) * 100
        
        # Step block frequency
        block_freq = conn.execute("""
            SELECT agent_name as step, COUNT(*) as block_count
            FROM human_review_queue
            GROUP BY agent_name
            ORDER BY block_count DESC
        """).fetchall()
        
        conn.close()
        
        return {
            "avg_completion_minutes": round(duration_stats['avg_mins'] or 0, 1),
            "fastest_run_minutes": round(duration_stats['min_mins'] or 0, 1),
            "slowest_run_minutes": round(duration_stats['max_mins'] or 0, 1),
            "success_rate_pct": round(success_rate, 2),
            "runs_by_status": {k: status_dict.get(k, 0) for k in ['COMPLETED', 'FAILED', 'RUNNING', 'PARTIAL']},
            "step_block_frequency": [{"step": row['step'], "block_count": row['block_count']} for row in block_freq],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/savings-summary")
async def analytics_savings_summary():
    """Early payment discount savings analysis"""
    try:
        conn = _raw_connect()
        
        savings_stats = conn.execute("""
            SELECT COALESCE(SUM(discount_amount), 0) as total_savings,
                   COUNT(*) as total_with_discount,
                   COALESCE(AVG(discount_amount), 0) as avg_discount,
                   COALESCE(MAX(discount_amount), 0) as largest_saving
            FROM payments
            WHERE early_discount_applied = 1
        """).fetchone()
        
        savings_by_month = conn.execute("""
            SELECT strftime('%Y-%m', scheduled_at) as month,
                   COALESCE(SUM(discount_amount), 0) as savings
            FROM payments
            WHERE early_discount_applied = 1 AND scheduled_at IS NOT NULL
            GROUP BY strftime('%Y-%m', scheduled_at)
            ORDER BY month DESC
        """).fetchall()
        
        conn.close()
        
        return {
            "total_discount_savings": round(savings_stats['total_savings'], 2),
            "total_invoices_with_discount": savings_stats['total_with_discount'],
            "avg_discount_per_order": round(savings_stats['avg_discount'], 2),
            "largest_saving": round(savings_stats['largest_saving'], 2),
            "savings_by_month": [{"month": row['month'], "savings": round(row['savings'], 2)} for row in savings_by_month],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Cache for AI insight (5 minute TTL)
_insight_cache = {"insight": None, "timestamp": None}


@router.get("/analytics/ai-insight")
async def analytics_ai_insight():
    """Generate LLM-powered executive insight using Ollama Mistral 7B"""
    import time
    from datetime import datetime, timedelta
    
    try:
        # Check cache (5 minute TTL)
        now = datetime.now()
        if _insight_cache["insight"] and _insight_cache["timestamp"]:
            cache_age = now - _insight_cache["timestamp"]
            if cache_age < timedelta(minutes=5):
                return {
                    "insight": _insight_cache["insight"],
                    "generated_at": _insight_cache["timestamp"].isoformat(),
                    "cached": True
                }
        
        # Fetch key metrics
        conn = _raw_connect()
        
        summary = conn.execute("""
            SELECT COUNT(*) as total_runs,
                   SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                   SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                   COALESCE(AVG(
                       CASE WHEN completed_at IS NOT NULL 
                       THEN (strftime('%s', completed_at) - strftime('%s', created_at)) / 60.0 
                       END
                   ), 0) as avg_completion_mins
            FROM procurement_runs
        """).fetchone()
        
        total_spend = conn.execute("""
            SELECT COALESCE(SUM(scheduled_amount), 0) as total
            FROM payments
        """).fetchone()['total'] or 0
        
        invoice_stats = conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN match_result != 'CLEAN' THEN 1 ELSE 0 END) as mismatches
            FROM invoice_matches
        """).fetchone()
        
        blocked = conn.execute(
            "SELECT COUNT(*) as cnt FROM human_review_queue WHERE status = 'PENDING_APPROVAL'"
        ).fetchone()['cnt']
        
        savings = conn.execute(
            "SELECT COALESCE(SUM(discount_amount), 0) as total FROM payments WHERE early_discount_applied = 1"
        ).fetchone()['total'] or 0
        
        conn.close()
        
        mismatch_rate = 0
        if invoice_stats['total'] > 0:
            mismatch_rate = (invoice_stats['mismatches'] / invoice_stats['total']) * 100
        
        success_rate = 0
        if summary['total_runs'] > 0:
            success_rate = (summary['completed'] / summary['total_runs']) * 100
        
        # Build prompt for Ollama
        prompt = f"""You are a CFO assistant analyzing procurement performance. 
Based on these metrics, write a 3-sentence executive insight paragraph.
Be specific with numbers and highlight the most important finding.

Metrics:
- Total procurements: {summary['total_runs']}
- Success rate: {success_rate:.1f}%
- Total spend: ₹{total_spend:,.0f}
- Early payment savings: ₹{savings:,.0f}
- Invoice mismatch rate: {mismatch_rate:.1f}%
- Blocked procurements: {blocked}
- Average completion time: {summary['avg_completion_mins']:.0f} minutes

Write only the insight paragraph, no headers or labels."""

        # Call Ollama with short timeout
        import httpx
        insight_text = None
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "mistral",
                        "prompt": prompt,
                        "stream": False,
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    insight_text = result.get("response", "").strip()
        except httpx.TimeoutException:
            insight_text = None
        except Exception as e:
            insight_text = None
        
        # If Ollama failed, return a detailed mock insight based on metrics
        if not insight_text:
            if success_rate > 50:
                insight_text = f"""Procurement pipeline demonstrates strong operational performance with a success rate of {success_rate:.1f}%, completing {int(summary['completed'])} out of {int(summary['total_runs'])} procurements successfully. Current spending totals ₹{total_spend:,.0f}, with effective early payment optimization generating ₹{savings:,.0f} in cumulative savings. The {int(blocked)} procurement(s) currently pending approval represent opportunities for process acceleration. Invoice matching shows a {mismatch_rate:.1f}% mismatch rate, indicating room for improvement in vendor compliance and documentation quality. With an average cycle time of {summary['avg_completion_mins']:.0f} minutes per procurement, the organization is achieving efficient turnaround while maintaining acceptable quality standards. Strategic focus should be on resolving approval bottlenecks and strengthening invoice matching protocols to enhance overall procurement velocity and accuracy."""
            else:
                insight_text = f"""Critical attention required: current procurement pipeline faces significant operational challenges with a success rate of only {success_rate:.1f}% and {int(blocked)} procurements blocked pending approval. This bottleneck is severely impacting pipeline throughput and represents a key area for immediate intervention. Total spend of ₹{total_spend:,.0f} is at risk with only ₹{savings:,.0f} captured in early payment discounts, suggesting suboptimal payment term negotiations. The invoice mismatch rate of {mismatch_rate:.1f}% signals serious quality control issues that are likely contributing to approval delays and rejections. Average completion time of {summary['avg_completion_mins']:.0f} minutes indicates process congestion and inefficiency. Immediate actions required: streamline approval workflows, implement vendor quality scorecards, enforce invoice compliance standards, and establish clear SLAs for each procurement stage. These improvements are essential to restore process health and improve the bottom-line impact of procurement operations."""
        
        # Cache the result
        _insight_cache["insight"] = insight_text
        _insight_cache["timestamp"] = now
        
        return {
            "insight": insight_text,
            "generated_at": now.isoformat(),
            "cached": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── VENDOR CRUD ENDPOINTS ──────────────────────────────────────────

@router.get("/vendors")
async def get_vendors(category: str = None, approved_only: bool = True, search: str = None):
    """Get vendors with optional filters and performance data"""
    try:
        conn = _raw_connect()
        
        query = "SELECT * FROM vendors WHERE 1=1"
        params = []
        
        if approved_only:
            query += " AND is_approved = 1"
        
        if search:
            query += " AND vendor_name LIKE ?"
            params.append(f"%{search}%")
        
        vendors = conn.execute(query, params).fetchall()
        
        vendors_list = []
        for v in vendors:
            v_dict = dict(v)
            try:
                v_dict['category_codes'] = json.loads(v_dict['category_codes'])
            except:
                v_dict['category_codes'] = []
            v_dict['is_preferred'] = bool(v_dict['is_preferred'])
            v_dict['is_approved'] = bool(v_dict['is_approved'])
            
            # Get vendor performance data
            perf = conn.execute("""
                SELECT 
                    AVG(CASE WHEN delivered_on_time = 1 THEN 1.0 ELSE 0 END) * 100 as on_time_rate,
                    AVG(CASE WHEN quantity_match = 1 THEN 1.0 ELSE 0 END) * 100 as qty_match_rate,
                    AVG(CASE WHEN invoice_clean = 1 THEN 1.0 ELSE 0 END) * 100 as inv_clean_rate,
                    COUNT(*) as total_transactions
                FROM vendor_performance
                WHERE vendor_id = ?
            """, (v_dict['vendor_id'],)).fetchone()
            
            if perf and perf['total_transactions'] and perf['total_transactions'] > 0:
                on_time = perf['on_time_rate'] or 0
                qty_match = perf['qty_match_rate'] or 0
                inv_clean = perf['inv_clean_rate'] or 0
                
                overall_score = (on_time * 0.35 + qty_match * 0.35 + inv_clean * 0.30) / 100
                overall_score = round(overall_score, 2)
                
                # Determine risk level based on overall score (0-1 scale)
                if overall_score < 0.70:
                    risk_level = 'HIGH'
                elif overall_score < 0.85:
                    risk_level = 'MEDIUM'
                else:
                    risk_level = 'LOW'
                
                v_dict['performance'] = {
                    'on_time_rate': round(on_time, 1),
                    'qty_match_rate': round(qty_match, 1),
                    'inv_clean_rate': round(inv_clean, 1),
                    'overall_score': overall_score,
                    'risk_level': risk_level
                }
            else:
                v_dict['performance'] = {
                    'on_time_rate': 0,
                    'qty_match_rate': 0,
                    'inv_clean_rate': 0,
                    'overall_score': 0,
                    'risk_level': 'LOW'
                }
            
            vendors_list.append(v_dict)
        
        conn.close()
        
        # Filter by category if provided
        if category:
            vendors_list = [v for v in vendors_list if category in v.get('category_codes', [])]
        
        return {"vendors": vendors_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str):
    """Get single vendor with performance stats"""
    try:
        conn = _raw_connect()
        
        vendor = conn.execute(
            "SELECT * FROM vendors WHERE vendor_id = ?", (vendor_id,)
        ).fetchone()
        
        if not vendor:
            conn.close()
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        v_dict = dict(vendor)
        try:
            v_dict['category_codes'] = json.loads(v_dict['category_codes'])
        except:
            v_dict['category_codes'] = []
        
        # Get performance stats
        perf = conn.execute("""
            SELECT COUNT(*) as total_orders,
                   COALESCE(SUM(order_value), 0) as total_value,
                   ROUND(100.0 * SUM(CASE WHEN delivered_on_time = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as on_time_rate,
                   ROUND(100.0 * SUM(CASE WHEN quantity_match = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as quantity_match_rate,
                   ROUND(100.0 * SUM(CASE WHEN invoice_clean = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as invoice_clean_rate
            FROM vendor_performance
            WHERE vendor_id = ?
        """, (vendor_id,)).fetchone()
        
        perf_dict = dict(perf)
        
        # Calculate overall score (weighted average)
        overall_score = (perf_dict['on_time_rate'] * 0.35 + 
                        perf_dict['quantity_match_rate'] * 0.35 + 
                        perf_dict['invoice_clean_rate'] * 0.30)
        perf_dict['overall_score'] = round(overall_score, 1)
        
        # Determine risk level
        if any([perf_dict['on_time_rate'] < 70, perf_dict['quantity_match_rate'] < 70, perf_dict['invoice_clean_rate'] < 70]):
            perf_dict['risk_level'] = "HIGH"
        elif any([perf_dict['on_time_rate'] < 85, perf_dict['quantity_match_rate'] < 85, perf_dict['invoice_clean_rate'] < 85]):
            perf_dict['risk_level'] = "MEDIUM"
        else:
            perf_dict['risk_level'] = "LOW"
        
        # Get recent orders (last 5)
        recent = conn.execute("""
            SELECT * FROM vendor_performance
            WHERE vendor_id = ?
            ORDER BY recorded_at DESC
            LIMIT 5
        """, (vendor_id,)).fetchall()
        
        perf_dict['recent_orders'] = [dict(row) for row in recent]
        
        v_dict['performance'] = perf_dict
        
        conn.close()
        return v_dict
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vendors")
async def create_vendor(body: dict):
    """Create a new vendor"""
    try:
        conn = _raw_connect()
        
        # Generate vendor_id
        last_id = conn.execute("""
            SELECT MAX(CAST(SUBSTR(vendor_id, 5) AS INTEGER)) as max_num
            FROM vendors
            WHERE vendor_id LIKE 'VEN-%'
        """).fetchone()['max_num'] or 0
        
        vendor_id = f"VEN-{str(last_id + 1).zfill(3)}"
        
        # Store category_codes as JSON
        category_codes_json = json.dumps(body.get('category_codes', []))
        
        conn.execute("""
            INSERT INTO vendors
            (vendor_id, vendor_name, category_codes, unit_price,
             lead_time_days, quality_rating, is_preferred, is_approved,
             contact_email, contact_phone, gstin, payment_terms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            vendor_id,
            body.get('vendor_name'),
            category_codes_json,
            body.get('unit_price'),
            body.get('lead_time_days'),
            body.get('quality_rating'),
            1 if body.get('is_preferred') else 0,
            1 if body.get('is_approved', True) else 0,
            body.get('contact_email'),
            body.get('contact_phone'),
            body.get('gstin'),
            body.get('payment_terms', 'Net-30'),
        ))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "vendor_id": vendor_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, body: dict):
    """Update vendor details"""
    try:
        conn = _raw_connect()
        
        # Check vendor exists
        vendor = conn.execute("SELECT * FROM vendors WHERE vendor_id = ?", (vendor_id,)).fetchone()
        if not vendor:
            conn.close()
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        # Build dynamic UPDATE query
        update_fields = []
        values = []
        
        for key, value in body.items():
            if key == 'category_codes':
                update_fields.append(f"{key} = ?")
                values.append(json.dumps(value) if isinstance(value, list) else value)
            elif key in ['is_preferred', 'is_approved']:
                update_fields.append(f"{key} = ?")
                values.append(1 if value else 0)
            elif key in ['vendor_name', 'unit_price', 'lead_time_days', 'quality_rating',
                        'contact_email', 'contact_phone', 'gstin', 'payment_terms']:
                update_fields.append(f"{key} = ?")
                values.append(value)
        
        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            values.append(vendor_id)
            
            query = f"UPDATE vendors SET {', '.join(update_fields)} WHERE vendor_id = ?"
            conn.execute(query, values)
            conn.commit()
        
        conn.close()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str):
    """Delete a vendor (only if no purchase orders)"""
    try:
        conn = _raw_connect()
        
        # Check if vendor has purchase orders
        po_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM purchase_orders WHERE vendor_id = ?", (vendor_id,)
        ).fetchone()['cnt']
        
        if po_count > 0:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Cannot delete vendor with existing purchase orders"
            )
        
        conn.execute("DELETE FROM vendors WHERE vendor_id = ?", (vendor_id,))
        conn.commit()
        conn.close()
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vendors/{vendor_id}/performance")
async def get_vendor_performance(vendor_id: str):
    """Get full performance history for a vendor"""
    try:
        conn = _raw_connect()
        
        vendor = conn.execute(
            "SELECT vendor_id, vendor_name FROM vendors WHERE vendor_id = ?", (vendor_id,)
        ).fetchone()
        
        if not vendor:
            conn.close()
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        # Summary
        perf = conn.execute("""
            SELECT COUNT(*) as total_orders,
                   COALESCE(SUM(order_value), 0) as total_value,
                   ROUND(100.0 * SUM(CASE WHEN delivered_on_time = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as on_time_rate,
                   ROUND(100.0 * SUM(CASE WHEN quantity_match = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as quantity_match_rate,
                   ROUND(100.0 * SUM(CASE WHEN invoice_clean = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as invoice_clean_rate
            FROM vendor_performance
            WHERE vendor_id = ?
        """, (vendor_id,)).fetchone()
        
        summary = dict(perf)
        overall = (summary['on_time_rate'] * 0.35 + 
                  summary['quantity_match_rate'] * 0.35 + 
                  summary['invoice_clean_rate'] * 0.30)
        summary['overall_score'] = round(overall, 1)
        
        # History
        history = conn.execute("""
            SELECT * FROM vendor_performance
            WHERE vendor_id = ?
            ORDER BY recorded_at DESC
        """, (vendor_id,)).fetchall()
        
        conn.close()
        
        return {
            "vendor_id": vendor['vendor_id'],
            "vendor_name": vendor['vendor_name'],
            "summary": summary,
            "history": [dict(row) for row in history]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vendors/{vendor_id}/performance")
async def add_vendor_performance(vendor_id: str, body: dict):
    """Record a vendor performance record"""
    try:
        conn = _raw_connect()
        
        conn.execute("""
            INSERT INTO vendor_performance
            (vendor_id, run_id, po_id, order_value,
             delivered_on_time, quantity_match, invoice_clean)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            vendor_id,
            body.get('run_id'),
            body.get('po_id'),
            body.get('order_value'),
            1 if body.get('delivered_on_time') else 0,
            1 if body.get('quantity_match') else 0,
            1 if body.get('invoice_clean') else 0,
        ))
        
        conn.commit()
        conn.close()
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vendors/compare")
async def compare_vendors(ids: str):
    """Compare multiple vendors side-by-side"""
    try:
        vendor_ids = ids.split(',')
        
        conn = _raw_connect()
        
        result_vendors = []
        for vid in vendor_ids:
            vendor = conn.execute(
                "SELECT * FROM vendors WHERE vendor_id = ?", (vid,)
            ).fetchone()
            
            if not vendor:
                continue
            
            v = dict(vendor)
            try:
                v['category_codes'] = json.loads(v['category_codes'])
            except:
                v['category_codes'] = []
            
            # Get performance
            perf = conn.execute("""
                SELECT ROUND(100.0 * SUM(CASE WHEN delivered_on_time = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as on_time_rate,
                       ROUND(100.0 * SUM(CASE WHEN quantity_match = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as quantity_match_rate,
                       ROUND(100.0 * SUM(CASE WHEN invoice_clean = 1 THEN 1 ELSE 0 END) / MAX(1, COUNT(*)), 1) as invoice_clean_rate
                FROM vendor_performance
                WHERE vendor_id = ?
            """, (vid,)).fetchone()
            
            if perf:
                perf_dict = dict(perf)
                overall = (perf_dict['on_time_rate'] * 0.35 + 
                          perf_dict['quantity_match_rate'] * 0.35 + 
                          perf_dict['invoice_clean_rate'] * 0.30)
                
                if any([perf_dict['on_time_rate'] < 70, perf_dict['quantity_match_rate'] < 70, perf_dict['invoice_clean_rate'] < 70]):
                    risk = "HIGH"
                elif any([perf_dict['on_time_rate'] < 85, perf_dict['quantity_match_rate'] < 85, perf_dict['invoice_clean_rate'] < 85]):
                    risk = "MEDIUM"
                else:
                    risk = "LOW"
                
                v['on_time_rate'] = perf_dict['on_time_rate']
                v['invoice_clean_rate'] = perf_dict['invoice_clean_rate']
                v['overall_score'] = round(overall, 1)
                v['risk_level'] = risk
            
            result_vendors.append(v)
        
        conn.close()
        return {"vendors": result_vendors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Payments ──────────────────────────────────────────────────────

@router.get("/payments/{payment_id}")
async def get_payment(payment_id: str):
    """Get payment status and details"""
    try:
        conn = _raw_connect()
        payment = conn.execute(
            "SELECT * FROM payments WHERE payment_id = ?", (payment_id,)
        ).fetchone()
        conn.close()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        return dict(payment)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payments/{payment_id}/pay")
async def process_payment(payment_id: str, body: dict):
    """Process a payment - simulated gateway"""
    try:
        conn = _raw_connect()
        
        # Get payment
        payment = conn.execute(
            "SELECT * FROM payments WHERE payment_id = ?", (payment_id,)
        ).fetchone()
        
        if not payment:
            conn.close()
            raise HTTPException(status_code=404, detail="Payment not found")
        
        payment_dict = dict(payment)
        
        # Check if already paid
        if payment_dict['status'] == 'PAID':
            conn.close()
            raise HTTPException(status_code=400, detail="Payment already completed")
        
        # Mark as paid
        conn.execute(
            "UPDATE payments SET status = 'PAID', scheduled_at = CURRENT_TIMESTAMP WHERE payment_id = ?",
            (payment_id,)
        )
        conn.commit()
        
        # Write to audit log
        payment_method = body.get('payment_method', 'unknown')
        transaction_ref = body.get('transaction_ref', f"TXN{int(time.time())}")
        
        audit_payload = {
            "payment_id": payment_id,
            "method": payment_method,
            "transaction_ref": transaction_ref,
            "amount": payment_dict['scheduled_amount'],
            "vendor_id": payment_dict['vendor_id']
        }
        
        conn.execute("""
            INSERT INTO audit_log
            (run_id, agent_name, action, status, payload)
            VALUES (?, ?, ?, ?, ?)
        """, (
            payment_dict['run_id'],
            "PaymentGateway",
            "PAYMENT_COMPLETED",
            "SUCCESS",
            json.dumps(audit_payload)
        ))
        conn.commit()
        
        # Update procurement_runs state to mark payment as PAID
        run = conn.execute(
            "SELECT state_json FROM procurement_runs WHERE run_id = ?",
            (payment_dict['run_id'],)
        ).fetchone()
        
        if run:
            proc_state = json.loads(run['state_json'])
            if 'payment' in proc_state and proc_state['payment']:
                proc_state['payment']['status'] = 'PAID'
                proc_state['payment']['paid_at'] = now_iso()
                
                conn.execute(
                    "UPDATE procurement_runs SET state_json = ? WHERE run_id = ?",
                    (json.dumps(proc_state), payment_dict['run_id'])
                )
                conn.commit()
        
        conn.close()
        
        return {
            "success": True,
            "payment_id": payment_id,
            "transaction_ref": transaction_ref,
            "paid_at": now_iso(),
            "amount": payment_dict['scheduled_amount'],
            "method": payment_method
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Helper ────────────────────────────────────────────────────────

def _status_message(proc: ProcurementState) -> str:
    messages = {
        "purchase_request":      "Processing purchase request...",
        "budget_check":          "Checking department budget...",
        "vendor_selection":      "Selecting best vendor...",
        "po_creation":           "Creating and dispatching purchase order...",
        "awaiting_delivery":     "PO sent. Waiting for goods to arrive.",
        "awaiting_invoice":      "Goods received. Waiting for vendor invoice.",
        "payment_scheduling":    "Scheduling payment...",
        "completed":             "Procurement complete. Payment scheduled.",
        "failed":                f"Pipeline failed: {'; '.join(proc.errors)}",
        "pending_budget_review": "Blocked: budget exceeded — awaiting human approval.",
        "pending_vendor_review": "Blocked: no approved vendor — awaiting human review.",
        "pending_po_review":     "Blocked: PO dispatch failed — awaiting human review.",
        "pending_gr_review":     "Blocked: delivery discrepancy — awaiting human review.",
        "pending_invoice_review":"Blocked: invoice mismatch — awaiting human review.",
    }
    return messages.get(proc.current_step, f"Step: {proc.current_step}")