import os
from dotenv import load_dotenv

load_dotenv()

# ── Ollama LLM settings ──────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "mistral")  # mistral 7b

# ── Database ─────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "procurement.db")

# ── Business rules ───────────────────────────────────────────────
APPROVAL_THRESHOLD        = int(os.getenv("APPROVAL_THRESHOLD", 500000))      # INR
BUDGET_WARNING_PCT        = float(os.getenv("BUDGET_WARNING_PCT", 0.80))       # 80%
PO_DISPATCH_MAX_RETRIES   = int(os.getenv("PO_DISPATCH_MAX_RETRIES", 3))
PO_DISPATCH_RETRY_DELAY   = int(os.getenv("PO_DISPATCH_RETRY_DELAY", 2))       # seconds
EARLY_PAYMENT_DISCOUNT_PCT = float(os.getenv("EARLY_PAYMENT_DISCOUNT_PCT", 0.02))  # 2%
EARLY_PAYMENT_DAYS        = int(os.getenv("EARLY_PAYMENT_DAYS", 10))

RESTRICTED_CATEGORIES = ["PHARMA", "ARMS", "CLASSIFIED"]

# ── Vendor scoring weights ────────────────────────────────────────
VENDOR_WEIGHT_PRICE    = 0.40
VENDOR_WEIGHT_LEAD     = 0.30
VENDOR_WEIGHT_QUALITY  = 0.20
VENDOR_WEIGHT_PREFERRED = 0.10

# ── FastAPI ──────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))

# ── Mock data paths ──────────────────────────────────────────────
MOCK_DATA_DIR    = os.path.join(os.path.dirname(__file__), "mock_data")
VENDORS_FILE     = os.path.join(MOCK_DATA_DIR, "vendors.json")
BUDGETS_FILE     = os.path.join(MOCK_DATA_DIR, "budgets.json")
SAMPLES_FILE     = os.path.join(MOCK_DATA_DIR, "sample_requests.json")