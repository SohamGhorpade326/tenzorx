"""
MeetingMind FastAPI Application
--------------------------------
Entry point. Mounts all routers, configures CORS, starts APScheduler.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import APP_HOST, APP_PORT, FRONTEND_URL
from routers import meetings, tasks, dashboard, audit, escalations, pipeline, websocket
from scheduler import start_scheduler

# ─────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────

app = FastAPI(
    title="MeetingMind API",
    description="AI-powered meeting pipeline with 6 LangGraph agents",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────

app.include_router(meetings.router)
app.include_router(tasks.router)
app.include_router(dashboard.router)
app.include_router(audit.router)
app.include_router(escalations.router)
app.include_router(pipeline.router)
app.include_router(websocket.router)

# ─────────────────────────────────────────────────
# Lifecycle
# ─────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    print("🚀 MeetingMind API starting...")
    try:
        start_scheduler()
        print("✅ APScheduler started")
    except Exception as e:
        print(f"⚠️  Scheduler failed to start: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 MeetingMind API shutting down...")


# ─────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "MeetingMind API", "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "message": "MeetingMind API",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host=APP_HOST, port=APP_PORT, reload=True)
