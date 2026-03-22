"""
Procurement AI — FastAPI entry point.

Start with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Swagger UI: http://localhost:8000/docs
ReDoc     : http://localhost:8000/redoc
"""
import os
import sys
import logging
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Configure logging to capture HTTP requests ────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── Make sure project root is on path ────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from config import API_HOST, API_PORT
from db.db import init_db
from db.seed_data import seed
from api.routes import router


# ── App setup ─────────────────────────────────────────────────────
app = FastAPI(
    title="Procurement AI — Agentic P2P Pipeline",
    description=(
        "Multi-agent procurement-to-payment system. "
        "Handles purchase requests, budget checks, vendor selection, "
        "PO creation, goods receipt, invoice matching, and payment scheduling — "
        "fully autonomous with human-in-the-loop exception handling."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — allow all origins for hackathon demo ───────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time()
    response = await call_next(request)
    process_time = time() - start_time
    logger.info(
        f"📍 {request.method:6s} {request.url.path:50s} → {response.status_code} "
        f"({process_time:.2f}s)"
    )
    return response


# ── Mount procurement router ──────────────────────────────────────
app.include_router(router)


# ── Startup: init DB + seed mock data ────────────────────────────
@app.on_event("startup")
async def on_startup():
    print("[Startup] Initialising database...")
    init_db()

    # Seed mock data only if files don't exist yet
    mock_dir = os.path.join(os.path.dirname(__file__), "mock_data")
    vendors_file = os.path.join(mock_dir, "vendors.json")
    if not os.path.exists(vendors_file):
        print("[Startup] Seeding mock data...")
        seed()
    else:
        print("[Startup] Mock data already present, skipping seed.")

    print("[Startup] Ready. Visit http://localhost:8000/docs")


# ── Health check ──────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "procurement-ai"}


@app.get("/", tags=["system"])
async def root():
    return {
        "service": "Procurement AI — Agentic P2P Pipeline",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "start_run":         "POST /procurement/run",
            "list_runs":         "GET  /procurement/runs",
            "run_status":        "GET  /procurement/run/{run_id}",
            "trigger_delivery":  "POST /procurement/run/{run_id}/delivery",
            "trigger_invoice":   "POST /procurement/run/{run_id}/invoice",
            "run_audit_log":     "GET  /procurement/run/{run_id}/audit",
            "full_audit_log":    "GET  /procurement/audit",
            "pending_reviews":   "GET  /procurement/reviews",
            "action_review":     "POST /procurement/reviews/{review_id}",
            "sample_payloads":   "GET  /procurement/samples",
        }
    }


# ── Dev runner ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    
    # Allow port override from command line: python main.py 8001
    port = API_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
            print(f"[Config] Using port {port} from command line argument")
        except ValueError:
            print(f"[Config] Invalid port argument '{sys.argv[1]}', using default {API_PORT}")
    
    uvicorn.run("main:app", host=API_HOST, port=port, reload=True)