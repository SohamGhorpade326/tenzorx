"""Configuration for Video Onboarding Service."""
import os
from dotenv import load_dotenv

load_dotenv()

# API Server
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8004"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")

# Database
DB_PATH = os.getenv("DB_PATH", "video_onboarding.db")

# Upload
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Question Timer
QUESTION_DURATION_SECONDS = int(os.getenv("QUESTION_DURATION_SECONDS", "240"))  # 4 minutes

# Meet Generation (using simple UUID-based links)
MEET_BASE_URL = os.getenv("MEET_BASE_URL", "http://localhost:8080/video/meet")

# HR Review Queue API
ORCHESTRATOR_SERVICE_URL = os.getenv("ORCHESTRATOR_SERVICE_URL", "http://localhost:8009")

# Whisper Configuration (from meeting workflow)
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "").strip() or None

# Demo mode — uses mock responses to avoid API calls
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"

# Groq (OpenAI-compatible) decision engine
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip() or None
GROQ_MODEL = os.getenv("GROQ_MODEL", "mixtral-8x7b-32768")
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
