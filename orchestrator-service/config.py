import os

# Orchestrator runtime
ORCHESTRATOR_HOST = os.getenv("ORCHESTRATOR_HOST", "0.0.0.0")
ORCHESTRATOR_PORT = int(os.getenv("ORCHESTRATOR_PORT", "8009"))

# Downstream workflow service base URLs
# NOTE: Defaults follow the values you specified in the prompt. Override via env as needed.
MEETING_SERVICE_URL = os.getenv("MEETING_SERVICE_URL", "http://localhost:8000")
# Defaults align with the frontend service clients:
# - Procurement: 8001
# - Onboarding: 8002
PROCUREMENT_SERVICE_URL = os.getenv("PROCUREMENT_SERVICE_URL", "http://localhost:8001")
ONBOARDING_SERVICE_URL = os.getenv("ONBOARDING_SERVICE_URL", "http://localhost:8002")
CONTRACT_SERVICE_URL = os.getenv("CONTRACT_SERVICE_URL", "http://localhost:8003")

# HTTP client tuning
# Downstream calls may invoke LLMs (e.g., Ollama) and can take >5s.
# Keep the default generous for local demos; override via env if needed.
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "30"))
HTTP_MAX_CONNECTIONS = int(os.getenv("HTTP_MAX_CONNECTIONS", "100"))
HTTP_MAX_KEEPALIVE_CONNECTIONS = int(os.getenv("HTTP_MAX_KEEPALIVE_CONNECTIONS", "20"))

# Decision engine tuning
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))

# SLA self-healing tuning
RETRY_BACKOFF_SECONDS = float(os.getenv("RETRY_BACKOFF_SECONDS", "0"))

# Workflow routing map (used for SLA retry routing)
# Keep defaults consistent with the existing per-service URLs above.
WORKFLOW_SERVICE_MAP: dict[str, str] = {
	"meeting": MEETING_SERVICE_URL,
	"procurement": PROCUREMENT_SERVICE_URL,
	"onboarding": ONBOARDING_SERVICE_URL,
	"contract": CONTRACT_SERVICE_URL,
}

# In-memory stores
AUDIT_LOG_MAX_ENTRIES = int(os.getenv("AUDIT_LOG_MAX_ENTRIES", "1000"))
STATE_MAX_EVENTS_PER_WORKFLOW = int(os.getenv("STATE_MAX_EVENTS_PER_WORKFLOW", "200"))
