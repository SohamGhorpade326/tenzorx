from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

# Ensure this service directory is first on sys.path for local absolute imports.
# This matters when running from the monorepo root (e.g., `python task-sla-service/main.py`).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from config import API_HOST, API_PORT, HTTP_TIMEOUT_SECONDS, SLA_CHECK_INTERVAL
from db.database import SessionLocal, init_db
from routers.sla import router as sla_router
from routers.tasks import router as tasks_router
from services.event_notifier import EventNotifier
from services.sla_monitor import SLAMonitor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("task-sla-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # Capture the running loop so scheduler jobs (which may run in a worker thread)
    # can safely submit coroutines to the app's event loop.
    loop = asyncio.get_running_loop()
    app.state.loop = loop

    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as http:
        notifier = EventNotifier(http)
        app.state.sla_monitor = SLAMonitor(notifier=notifier)

        scheduler = AsyncIOScheduler(timezone="UTC", event_loop=loop)
        app.state.scheduler = scheduler

        async def _run_sla_scan() -> None:
            async with SessionLocal() as session:
                await app.state.sla_monitor.check_and_handle(session)

        def _job_wrapper() -> None:
            # Job may execute off the loop thread; submit to captured loop.
            fut = asyncio.run_coroutine_threadsafe(_run_sla_scan(), loop)

            def _done_callback(f):  # type: ignore[no-untyped-def]
                try:
                    f.result()
                except Exception:  # noqa: BLE001
                    logger.exception("SLA scan job failed")

            fut.add_done_callback(_done_callback)

        scheduler.add_job(
            _job_wrapper,
            trigger="interval",
            seconds=SLA_CHECK_INTERVAL,
            id="sla_check",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Task & SLA Service started (interval=%ss)", SLA_CHECK_INTERVAL)

        try:
            yield
        finally:
            scheduler.shutdown(wait=False)
            logger.info("Task & SLA Service stopped")


app = FastAPI(
    title="Task & SLA Monitoring Service",
    description="Monitoring + failure detection layer: task tracking, SLA checks, and orchestrator notifications.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(tasks_router)
app.include_router(sla_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "task-sla-service"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
