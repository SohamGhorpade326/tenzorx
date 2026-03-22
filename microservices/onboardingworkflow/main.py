import os
import sys

# Ensure this service directory is first on sys.path for local absolute imports.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import API_HOST, API_PORT, FRONTEND_URL
from db.db import init_db
from api.routes import router

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
