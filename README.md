# Workstream AI 🧠

> AI-powered meeting pipeline: record a meeting → Whisper transcribes → 6 LangGraph agents extract decisions, validate, create tasks, track deadlines, and escalate overdue items.

---

## Architecture

```
Browser (React + Vite)
    ↓ REST + WebSocket
FastAPI (Python 3.11+)
    ↓ LangGraph StateGraph
6 Agents: TranscriptAgent → ValidatorAgent → TaskCreatorAgent → TrackerAgent → EscalationAgent
    ↓ Supabase (PostgreSQL)
Data persistence + audit trail
```

---

## Free API Keys You Need

| Service | What for | Where to get | Cost |
|---|---|---|---|
| **Groq** | LLM (llama3-70b) — decision extraction, validation, enrichment, escalation messages | [console.groq.com](https://console.groq.com) | ✅ Free |
| **Supabase** | PostgreSQL database + hosted backend | [supabase.com](https://supabase.com) | ✅ Free |
| Whisper | Audio transcription | Built-in via `pip install openai-whisper` | ✅ No API key |

**No paid APIs required.**

---

## Setup Instructions

### Step 1 — Get API Keys

#### Groq (LLM)
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free)
3. Go to **API Keys** → Create new key
4. Copy the key — it starts with `gsk_...`

#### Supabase (Database)
1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** → Sign up
3. Create a new project (name it `meetingmind`)
4. Go to **Settings → API**
5. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role secret** key → `SUPABASE_SERVICE_KEY`

#### Supabase Database Schema
1. In your Supabase project, go to **SQL Editor**
2. Copy and paste the contents of `microservices/meetingworkflow/db/schema.sql`
3. Click **Run** — this creates all tables

---

### Step 2 — Backend Setup

```bash
# Navigate to backend directory
cd meetingmind/microservices/meetingworkflow

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install ffmpeg (required by Whisper for audio conversion)
# On macOS:
brew install ffmpeg
# On Ubuntu/Debian:
# sudo apt-get install ffmpeg
# On Windows: download from https://ffmpeg.org/download.html

# Copy the env template and fill in your keys
cp .env.example .env
```

Now open `.env` and fill in your keys:
```env
GROQ_API_KEY=gsk_your_groq_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

```bash
# Start the backend
python main.py
# or
uvicorn main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

---

### Step 3 — Frontend Setup

```bash
# Navigate to frontend directory
cd meetingmind/frontend

# Install dependencies
npm install
# or: bun install

# The .env file is already created with:
# VITE_API_URL=http://localhost:8000

# Start the frontend dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Running Everything

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd meetingmind/microservices/meetingworkflow
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd meetingmind/frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

---

## Using the App

### Option A: Meeting Room (Recommended for demos)
1. Click **Meeting Room** in the sidebar
2. Enter meeting title and attendees
3. Click **Start Meeting** — allow camera/mic access
4. Have a conversation with clear action items (e.g., "Priya, can you submit the report by March 25th?")
5. Click **End Meeting**
6. Watch Whisper transcribe your audio, then all 6 agents run live

### Option B: Paste Transcript
1. Click **Process Meeting** in the sidebar
2. Paste or edit a transcript (sample is pre-filled)
3. Click **Process Meeting**
4. Watch the real-time agent pipeline execute via WebSocket

### Sample transcripts are at:
- `microservices/meetingworkflow/data/sample_transcript_1.txt` — Q3 Planning Meeting
- `microservices/meetingworkflow/data/sample_transcript_2.txt` — Sprint Retrospective
- `microservices/meetingworkflow/data/sample_transcript_3.txt` — Client Sync Call

---

## What Each Agent Does

| Agent | Responsibility |
|---|---|
| **TranscriptAgent** | Whisper local audio transcription + Groq LLM extracts decisions with owners and deadlines |
| **ValidatorAgent** | Rules checks (missing owner/deadline) + LLM checks if decision is actionable |
| **HumanReviewGate** | Pauses pipeline, shows flagged items to human in UI for review |
| **TaskCreatorAgent** | Creates Supabase task records + LLM writes priority and acceptance criteria |
| **TrackerAgent** | Scans deadlines every 5 min: PENDING→AT_RISK (48hr)→OVERDUE, stall detection (3 days) |
| **EscalationAgent** | Groq writes contextual escalation messages, puts them in human review queue |

---

## Project Structure

```
meetingmind/
├── microservices/
│   └── meetingworkflow/
│       ├── agents/
│       │   ├── transcript_agent.py   ← Whisper + Groq
│       │   ├── validator_agent.py    ← Rules + LLM validation
│       │   ├── orchestrator.py       ← LangGraph StateGraph
│       │   ├── task_creator_agent.py ← Task creation + enrichment
│       │   ├── tracker_agent.py      ← Deadline monitoring
│       │   └── escalation_agent.py   ← AI-written escalations
│       ├── db/
│       │   ├── schema.sql            ← Run in Supabase SQL editor
│       │   └── db.py                 ← All CRUD helpers
│       ├── models/
│       │   └── schemas.py            ← Pydantic models
│       ├── routers/
│       │   ├── meetings.py           ← POST /api/meetings/*
│       │   ├── tasks.py              ← GET/PATCH /api/tasks
│       │   ├── dashboard.py          ← GET /api/dashboard
│       │   ├── audit.py              ← GET /api/audit-events
│       │   ├── escalations.py        ← GET/POST /api/escalations
│       │   ├── pipeline.py           ← GET /api/pipeline/runs
│       │   └── websocket.py          ← WS /api/ws/pipeline/{run_id}
│       ├── data/
│       │   └── sample_transcript_*.txt
│       ├── main.py                   ← FastAPI app + CORS + startup
│       ├── scheduler.py              ← APScheduler (tracker every 5 min)
│       ├── config.py                 ← Env vars
│       ├── requirements.txt
│       └── .env.example
├── frontend/
│   ├── src/
│   │   ├── lib/api.ts            ← All API calls + WebSocket helper
│   │   ├── pages/
│   │   │   ├── MeetingRoom.tsx   ← WebRTC + MediaRecorder + pipeline
│   │   │   ├── ProcessMeeting.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Tasks.tsx
│   │   │   ├── AuditTrail.tsx
│   │   │   └── Escalations.tsx
│   │   └── ...
│   └── .env                      ← VITE_API_URL=http://localhost:8000
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/meetings/process-transcript` | Submit text transcript |
| `POST` | `/api/meetings/process-audio` | Upload audio file (Whisper transcribes) |
| `GET` | `/api/dashboard` | Metrics + pipeline runs |
| `GET` | `/api/tasks` | List tasks (filter by status/owner) |
| `PATCH` | `/api/tasks/{id}` | Update task status/owner/priority |
| `GET` | `/api/audit-events` | All agent audit events |
| `GET` | `/api/escalations` | Pending and sent escalations |
| `POST` | `/api/escalations/{id}/approve` | Approve & send escalation |
| `POST` | `/api/escalations/{id}/reject` | Reject escalation |
| `GET` | `/api/pipeline/runs` | Pipeline run history |
| `WS` | `/api/ws/pipeline/{run_id}` | Live agent step updates |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger API docs |

---

## Demo Mode (No API keys)

If you want to see the full pipeline without real API keys, set `DEMO_MODE=true` in `.env`:
```env
DEMO_MODE=true
```

In demo mode:
- LLM calls are skipped — hardcoded sample decisions are used
- Whisper still runs locally (or falls back gracefully)
- All database operations still work with Supabase

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `ffmpeg not found` | Install ffmpeg: `brew install ffmpeg` (Mac) |
| `SUPABASE_URL not set` | Copy `.env.example` to `.env` and fill in values |
| Camera access denied | Use Chrome/Firefox and allow camera/mic access |
| WebSocket not connecting | Make sure backend is running on port 8000 |
| Whisper download slow | First run downloads the model (~70MB for `base`) — wait for it |
| `groq.AuthenticationError` | Check your `GROQ_API_KEY` in `.env` |
