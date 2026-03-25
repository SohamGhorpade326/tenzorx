from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from time import perf_counter

# Ensure this service directory is first on sys.path for local absolute imports.
# This matters when running from the monorepo root (e.g., `python orchestrator-service/main.py`).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx
import uvicorn
from fastapi import FastAPI, Request

from config import (
    ORCHESTRATOR_HOST,
    ORCHESTRATOR_PORT,
    HTTP_MAX_CONNECTIONS,
    HTTP_MAX_KEEPALIVE_CONNECTIONS,
    HTTP_TIMEOUT_SECONDS,
    MEETING_SERVICE_URL,
    ONBOARDING_SERVICE_URL,
    PROCUREMENT_SERVICE_URL,
    CONTRACT_SERVICE_URL,
    AUDIT_LOG_MAX_ENTRIES,
    STATE_MAX_EVENTS_PER_WORKFLOW,
)
from models.workflow_state import InMemoryAuditLog, InMemoryWorkflowStateStore
from routers.orchestrator import router as orchestrator_router
from services.decision_engine import DecisionEngine
from services.workflow_router import WorkflowRouter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("orchestrator")


@asynccontextmanager
async def lifespan(app: FastAPI):
    limits = httpx.Limits(
        max_connections=HTTP_MAX_CONNECTIONS,
        max_keepalive_connections=HTTP_MAX_KEEPALIVE_CONNECTIONS,
    )
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as http:
        app.state.http = http
        app.state.state_store = InMemoryWorkflowStateStore(max_events_per_workflow=STATE_MAX_EVENTS_PER_WORKFLOW)
        app.state.audit_log = InMemoryAuditLog(max_entries=AUDIT_LOG_MAX_ENTRIES)
        app.state.decision_engine = DecisionEngine()
        app.state.workflow_router = WorkflowRouter(
            http=http,
            meeting_base_url=MEETING_SERVICE_URL,
            onboarding_base_url=ONBOARDING_SERVICE_URL,
            procurement_base_url=PROCUREMENT_SERVICE_URL,
            contract_base_url=CONTRACT_SERVICE_URL,
        )
        logger.info("Global Orchestrator started")
        yield
        logger.info("Global Orchestrator stopped")


app = FastAPI(
    title="Global Orchestrator Service",
    description="Service-level orchestrator that coordinates workflow microservices via events.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = perf_counter()
    response = await call_next(request)
    elapsed_ms = (perf_counter() - start) * 1000.0
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed_ms:.1f}ms)")
    return response


app.include_router(orchestrator_router)


if __name__ == "__main__":
    uvicorn.run("main:app", host=ORCHESTRATOR_HOST, port=ORCHESTRATOR_PORT, reload=True)
