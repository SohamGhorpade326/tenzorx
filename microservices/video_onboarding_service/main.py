"""Main FastAPI application for Video Onboarding Service."""
import sys
import os
from contextlib import asynccontextmanager

# Ensure this service directory is first on sys.path for local absolute imports.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from config import API_HOST, API_PORT, FRONTEND_URL, UPLOAD_DIR
from db.db import init_db
from api.routes import router

# Initialize database
init_db()

# ── Lifespan Events ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[STARTUP] Video Onboarding API starting...")
    yield
    # Shutdown
    print("[SHUTDOWN] Video Onboarding API shutting down...")

# ── App Setup ──────────────────────────────────────────────────
app = FastAPI(
    title="Video Onboarding API",
    description="AI-powered video onboarding interview workflow",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────
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

# ── Mount router ────────────────────────────────────────────────
app.include_router(router)

# ── Static files for uploads ────────────────────────────────────
if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ── Health Check ────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "Video Onboarding API", "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "message": "Video Onboarding API",
        "docs": "/docs",
        "health": "/health",
        "base_url": f"http://{API_HOST}:{API_PORT}",
    }


if __name__ == "__main__":
    import sys
    
    # Allow port override from command line: python main.py 8004
    port = API_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    
    uvicorn.run(app, host=API_HOST, port=port)
