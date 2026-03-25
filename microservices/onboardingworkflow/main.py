import os
import sys

# Ensure this service directory is first on sys.path for local absolute imports.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from config import API_HOST, API_PORT, FRONTEND_URL
from db.db import init_db
from api.routes import router
from db.db import get_run, append_log
from services.workflow_service import start_onboarding_run

# ── App setup ─────────────────────────────────────────────────────
app = FastAPI(
    title="Employee Onboarding API",
    description="Agentic onboarding workflow built with LangGraph.",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",  # Allow all for hackathon
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount router ──────────────────────────────────────────────────
app.include_router(router)


# ── Orchestrator integration: retry-step ──────────────────────────

class RetryStepRequest(BaseModel):
    task_id: str = Field(..., min_length=1, description="Task ID (recommended: onboarding run_id)")
    workflow: str = Field(..., min_length=1, description="Workflow name, e.g. 'onboarding'")
    step: str = Field(..., min_length=1, description="Step label to retry")
    retry_count: int | None = Field(None, ge=0, description="Current retry count")
    reason: str | None = Field(None, description="Reason for the retry request")


@app.post("/retry-step", tags=["orchestrator"])
async def retry_step(body: RetryStepRequest):
    """Accept a retry request from the Global Orchestrator.

    Minimal behavior:
    - Always returns 200 so orchestrator retries are non-blocking.
    - If `task_id` matches an existing onboarding `run_id`, restarts a new run
      using the saved input payload and returns the new run_id.
    """
    run = get_run(body.task_id)
    # Record that orchestrator requested a retry (only if the run exists).
    if run:
        try:
            append_log(
                body.task_id,
                step=body.step,
                agent="orchestrator",
                decision="retry_requested",
                reason=body.reason or "SLA retry requested",
                meta={"workflow": body.workflow, "retry_count": body.retry_count},
            )
        except Exception:
            # Best-effort logging; do not fail the retry endpoint.
            pass
    if not run or not run.get("input_json"):
        return {
            "ok": True,
            "action": "accepted_noop",
            "task_id": body.task_id,
            "message": "No onboarding run found for task_id; nothing restarted.",
        }

    # Best-effort: restart the workflow from stored input.
    try:
        import json

        input_payload = json.loads(run["input_json"]) if run.get("input_json") else {}
        employee_name = input_payload.get("employee_name")
        employee_id = input_payload.get("employee_id")
        if not employee_name or not employee_id:
            return {
                "ok": True,
                "action": "accepted_noop",
                "task_id": body.task_id,
                "message": "Run input is missing employee_name/employee_id; nothing restarted.",
            }

        new_run_id = start_onboarding_run(employee_name, employee_id)
        append_log(
            new_run_id,
            step=body.step,
            agent="orchestrator",
            decision="restarted_from_retry",
            reason=body.reason or "SLA retry requested",
            meta={"original_task_id": body.task_id, "workflow": body.workflow, "retry_count": body.retry_count},
        )
        return {
            "ok": True,
            "action": "restarted",
            "task_id": body.task_id,
            "new_run_id": new_run_id,
        }
    except Exception as exc:
        # Never fail the orchestrator call; return ok with details.
        return {
            "ok": True,
            "action": "accepted_noop",
            "task_id": body.task_id,
            "message": f"Retry accepted but restart failed: {type(exc).__name__}: {exc}",
        }


# ── Startup: init DB ──────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    print("[Startup] Initialising database...")
    init_db()
    print("[Startup] Ready. Visit http://localhost:8002/docs")


# ── Health check ──────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "onboarding-api"}


@app.get("/", tags=["system"])
async def root():
    return {
        "service": "Employee Onboarding API",
        "docs": "/docs",
        "health": "/health",
    }


# ── Dev runner ────────────────────────────────────────────────────
if __name__ == "__main__":
    port = API_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
            print(f"[Config] Using port {port} from command line argument")
        except ValueError:
            print(f"[Config] Invalid port argument '{sys.argv[1]}', using default {API_PORT}")
    
    uvicorn.run("main:app", host=API_HOST, port=port, reload=True)
