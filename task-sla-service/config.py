import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_SERVICE_DIR = Path(__file__).resolve().parent

# ── FastAPI ──────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8010"))

# ── Database ─────────────────────────────────────────────────────
# For demo/local runs, default to SQLite file in this service folder.
DB_PATH = Path(os.getenv("DB_PATH", str(_SERVICE_DIR / "task_sla.db")))


def _default_sqlite_url(db_path: Path) -> str:
    # SQLAlchemy expects forward slashes even on Windows.
    resolved = db_path.expanduser().resolve()
    return f"sqlite+aiosqlite:///{resolved.as_posix()}"


DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite_url(DB_PATH))

# ── Orchestrator integration ─────────────────────────────────────
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8009")
SOURCE_SERVICE_NAME = os.getenv("SOURCE_SERVICE_NAME", "task-sla-service")

# ── SLA rules ────────────────────────────────────────────────────
SLA_CHECK_INTERVAL = int(os.getenv("SLA_CHECK_INTERVAL", "60"))  # seconds
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))
STALL_THRESHOLD_SECONDS = int(os.getenv("STALL_THRESHOLD_SECONDS", "300"))

# ── HTTP client tuning ───────────────────────────────────────────
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "5"))

# ── Simple caching (bonus) ───────────────────────────────────────
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "5"))
