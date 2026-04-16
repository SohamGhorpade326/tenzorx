# Workstream AI - Workflows & Tech Stack Documentation

## 📋 Platform Overview

**Workstream AI** is a modular, distributed AI-powered platform orchestrating 4 major enterprise workflows with real-time decision extraction, validation, task creation, deadline tracking, and escalation management.

---

## 🏗️ Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (React 18 + Vite)                 │
│              Port 5173 - Dashboard & Interfaces              │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Orchestrator │  │  Task SLA    │  │  Microservices
│  Service     │  │  Service     │  │  (4 x Workflows)
│ Port 8009    │  │ Port 8010    │  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📊 Master Workflow Comparison

| Workflow | Purpose | LLM | Database | Port | Status |
|---|---|---|---|---|---|
| **Meeting Intelligence** | Transcribe meetings → extract decisions → create tracked tasks → escalate delays | Groq llama3-70b | Supabase PostgreSQL | 8000 | ✅ Complete |
| **Procurement Pipeline** | Purchase requests → vendor selection → PO creation → invoice matching → payment | Ollama Mistral 7B | SQLite | 8001 | ✅ Complete |
| **Contract Management** | Contract processing → validation → risk analysis → approval workflows | Ollama/Groq | SQLite | 8002 | ✅ Complete |
| **Employee Onboarding** | Employee data collection → document provisioning → system setup → task tracking | Local/Cloud LLM | SQLite | 8003 | ✅ Complete |
| **Orchestrator Service** | Central routing, request validation, SLA management, service coordination | — | SQLite | 8009 | ✅ Complete |
| **Task SLA Service** | Deadline tracking, escalation triggers, SLA violation reporting | — | SQLite | 8010 | ✅ Complete |
| **Frontend UI** | React dashboard with real-time updates, authentication, workflow monitoring | — | — | 5173 | ✅ Complete |

---

## 🔧 GLOBAL TECH STACK

### Frontend
- **React 18** (TypeScript)
- **Vite** (Build tool & dev server)
- **Tailwind CSS** + Shadcn/ui (Styling & components)
- **Framer Motion** (Animations)
- **Context API** (State management)
- **Playwright** (E2E testing)

### Backend Core
- **FastAPI 0.115.6** (Web framework)
- **Uvicorn 0.32.1** (ASGI server)
- **Python 3.11+**
- **LangGraph 0.2.60-0.3.0** (Agent state machines)
- **LangChain 0.2.0-0.3.14** (LLM orchestration)
- **Pydantic 2.10+** (Data validation)

### AI/LLM Layer
- **Groq API** (llama3-70b — free cloud LLM)
- **Ollama** (Mistral 7B — self-hosted local LLM)
- **OpenAI Whisper** (Audio transcription)

### Databases
- **Supabase PostgreSQL** (Meeting workflow)
- **SQLite** (All other workflows)

### Additional Services
- **APScheduler 3.10.4** (Background tasks, scheduling)
- **WebSockets 14.1** (Real-time updates)
- **HTTPX 0.27** (Async HTTP client for Ollama)
- **Python-dotenv 1.0.1** (Environment config)
- **Pytest 8.3.0 + pytest-asyncio** (Testing)

---

## 📱 WORKFLOW #1: MEETING INTELLIGENCE

### Purpose
Extract actionable intelligence from meetings: automatic transcription, decision extraction, task creation, and deadline escalation.

### Features
- Automatic meeting transcription (Whisper)
- AI-powered decision extraction
- Task creation with assignees & deadlines
- Real-time decision tracking
- Escalation alerts for overdue decisions

### Tech Stack
**Framework & API**
- FastAPI 0.115.6
- Uvicorn 0.32.1
- WebSockets (real-time decision updates)

**AI/LLM**
- LangGraph 0.2.60 (state machine orchestration)
- LangChain 0.3.14
- LangChain-Groq 0.2.3
- Groq API (llama3-70b)
- OpenAI-Whisper 20250625 (transcription)

**Database**
- Supabase 2.10.0 (PostgreSQL)

**Utilities**
- FFmpeg-Python 0.2.0 (audio processing)
- APScheduler 3.10.4 (task scheduling)
- Pydantic 2.10.4 (data validation)
- Aiofiles 24.1.0 (async file I/O)

**Port:** 8000

---

## 💼 WORKFLOW #2: PROCUREMENT PIPELINE

### Purpose
End-to-end procurement automation: purchase requests → vendor selection → PO creation → invoice matching → payment processing.

### Features
- Purchase request analysis
- Vendor evaluation & selection
- PO (Purchase Order) creation
- Budget validation & tracking
- Invoice matching against POs
- Payment approval workflows
- Goods receipt confirmation

### Tech Stack
**Framework & API**
- FastAPI 0.115.0
- Uvicorn 0.30.0

**AI/LLM**
- LangGraph 0.3.0 (multi-agent state machine)
- LangChain 0.2.0
- Ollama (Mistral 7B via HTTP)

**Database**
- SQLite (local file-based DB)

**HTTP & Async**
- HTTPX 0.27.0 (Ollama client)
- Python-multipart 0.0.9

**Testing & Validation**
- Pydantic 2.10.0+
- Pytest 8.3.0
- Pytest-asyncio 0.23.8

**Port:** 8001

---

## 📋 WORKFLOW #3: CONTRACT MANAGEMENT

### Purpose
Intelligent contract processing: document intake → validation → risk analysis → approval workflows.

### Features
- Contract document processing
- Clause extraction & validation
- Risk assessment & scoring
- Approval routing workflows
- Contract term tracking
- Compliance monitoring
- Audit trail logging

### Tech Stack
**Framework & API**
- FastAPI (minimum 0.100.0)
- Uvicorn (standard extras)

**AI/LLM**
- LangGraph 0.2.0+
- LangChain
- Ollama or Groq (flexible LLM provider)

**Database**
- SQLite

**Configuration & Environment**
- Pydantic 2.0+
- Python-dotenv 1.0.0

**Port:** 8002

---

## 🎓 WORKFLOW #4: EMPLOYEE ONBOARDING

### Purpose
Streamlined employee onboarding: profile creation → document collection → system provisioning → task tracking.

### Features
- Employee profile creation
- Document collection workflows
- System access provisioning
- Task assignment (IT, HR, Manager)
- Onboarding progress tracking
- Checklist validation
- Completion reporting

### Tech Stack
**Framework & API**
- FastAPI (minimum 0.100.0)
- Uvicorn (standard extras)

**AI/LLM**
- LangGraph 0.2.0+
- LangChain

**Database**
- SQLite (onboarding.db)

**Configuration**
- Pydantic 2.0+
- Python-dotenv 1.0.0

**Port:** 8003

---

## 🔗 ORCHESTRATOR SERVICE

### Purpose
Central hub for service coordination: request routing, validation, SLA management, inter-service communication.

### Features
- Request routing to appropriate microservice
- Input validation & schema enforcement
- SLA tracking aggregation
- Service health monitoring
- Error handling & retry logic
- Event coordination between workflows

### Tech Stack
**Framework & API**
- FastAPI 0.110+
- Uvicorn 0.24+

**HTTP Communication**
- HTTPX 0.27+ (async HTTP for service-to-service calls)

**Validation**
- Pydantic 2.0+

**Configuration**
- Python-dotenv 1.0.0

**Port:** 8009

---

## ⏱️ TASK SLA SERVICE

### Purpose
Deadline enforcement: SLA tracking, escalation triggers, violation reporting, performance analytics.

### Features
- Deadline tracking across all workflows
- SLA rule evaluation
- Escalation triggering
- Violation alerts
- SLA reporting & analytics
- Task priority adjustment
- Historical tracking

### Tech Stack
**Framework & API**
- FastAPI 0.110+
- Uvicorn 0.24+

**HTTP Communication**
- HTTPX 0.27+

**Validation**
- Pydantic 2.0+

**Port:** 8010

---

## 🎨 FRONTEND UI

### Purpose
Unified dashboard for monitoring and managing all workflows in real-time.

### Features
- Meeting decision tracking
- Procurement pipeline visualization
- Contract approval workflows
- Onboarding progress monitoring
- Task notifications & escalations
- Real-time updates (WebSocket integration)
- User authentication
- Analytics & reporting

### Tech Stack
**Framework & Build**
- React 18 (TypeScript)
- Vite (build bundler)
- Node.js 18+

**Styling & Components**
- Tailwind CSS
- Shadcn/ui (headless component library)
- Framer Motion (animations)

**State Management**
- Context API (React built-in)

**Testing**
- Playwright (E2E testing)
- Vitest (unit testing)

**Dev Tools**
- ESLint (code quality)
- PostCSS (CSS processing)
- TypeScript (type safety)

**Port:** 5173

---

## 🔐 Authentication & Security

### Frontend
- Demo mode (development)
- Clerk SSO ready for enterprise deployment
- JWT token handling

### Backend
- CORS enabled across all services
- API validation via Pydantic
- Environment-based configuration (.env files)

---

## 📦 Dependency Versions Summary

| Package | Meeting | Procurement | Contract | Onboarding | Orchestrator |
|---|---|---|---|---|---|
| FastAPI | 0.115.6 | 0.115.0 | 0.100.0+ | 0.100.0+ | 0.110+ |
| Uvicorn | 0.32.1 | 0.30.0 | 0.23.0+ | 0.23.0+ | 0.24+ |
| LangGraph | 0.2.60 | 0.3.0 | 0.2.0+ | 0.2.0+ | — |
| LangChain | 0.3.14 | 0.2.0 | 0.2.0+ | — | — |
| Pydantic | 2.10.4 | 2.10.0+ | 2.0+ | 2.0+ | 2.0+ |
| Python | 3.11+ | 3.11+ | 3.11+ | 3.11+ | 3.11+ |

---

## 🚀 Service Communication Flow

```
User → Frontend (React, Port 5173)
        ↓
    Orchestrator Service (Port 8009)
    ↙      ↓      ↖      ↘
Meeting  Proc.  Contract  Onboarding
(8000)   (8001)  (8002)    (8003)
    ↘     ↓      ↙      ↖
    Task SLA Service (Port 8010)
        ↓
    Databases (Supabase PostgreSQL / SQLite)
```

---

## 📝 Database Schema Breakdown

### Meeting Workflow (Supabase PostgreSQL)
- Meetings table
- Decisions table
- Tasks table
- Escalations table

### Procurement Workflow (SQLite)
- Purchase Requests
- Vendors
- Purchase Orders
- Invoices
- Payments
- Goods Receipts

### Contract Workflow (SQLite)
- Contracts
- Clauses
- Risk Assessments
- Approvals
- Audit Trail

### Onboarding Workflow (SQLite)
- Employees
- Documents
- Tasks
- Checklists
- Access Provisioning

### Orchestrator & SLA (SQLite)
- Request logs
- SLA rules
- Task escalations
- Service health

---

## ⚙️ Deployment Architecture

Each microservice:
- Runs independently with own venv
- Configurable via .env file
- Listens on dedicated port
- Can be scaled horizontally
- Reports to central Orchestrator

**Recommended Deployment:**
- Docker containerization (per service)
- Container orchestration (Kubernetes/Docker Compose)
- Reverse proxy (Nginx) for port management
- Load balancer for horizontal scaling

---

## 🔄 Data Flow Examples

### Meeting Intelligence Flow
```
Audio Input → Whisper Transcription → LangGraph State Machine 
→ Groq LLM Decision Extraction → Task Creation → Database Storage 
→ WebSocket Broadcast to Frontend → Escalation Check via SLA Service
```

### Procurement Flow
```
Purchase Request → Ollama Vendor Analysis → PO Generation 
→ Procurement DB → Invoice Matching → Payment Processing 
→ SLA Tracking → Escalation Alerts
```

---

## 🛠️ Development Environment Setup

### Requirements
- Python 3.11+
- Node.js 18+
- 2+ GB RAM
- Git

### Quick Setup
```bash
# Clone repo
git clone https://github.com/SwainDias/Workstream-AI.git
cd Workstream-AI

# Setup each microservice
for service in meetingworkflow procurementworkflow contract-workflow onboardingworkflow; do
    cd microservices/$service
    python -m venv venv
    # Windows: venv\Scripts\activate
    # Linux/Mac: source venv/bin/activate
    pip install -r requirements.txt
done

# Frontend setup
cd frontend
npm install

# Run all services (7 terminals)
```

---

## 📊 Performance Characteristics

| Service | Expected Latency | Throughput | Scaling |
|---|---|---|---|
| Meeting (transcription) | 1-5 min per meeting | 1 meeting/service | Limited by Whisper |
| Procurement (vendor selection) | 500ms-2s | 10-20 req/sec | Horizontal (LLM throughput) |
| Contract (risk analysis) | 1-3s per contract | 5-10 req/sec | Horizontal |
| Onboarding (task creation) | 200-500ms | 20-50 req/sec | Horizontal |
| Orchestrator (routing) | <50ms | 100+ req/sec | Horizontal |
| SLA (escalation check) | 50-200ms | 50-100 req/sec | Horizontal |

---

## 🔗 Key Dependencies & Why

| Dependency | Why Used |
|---|---|
| **FastAPI** | Type-safe, auto-documentation, async-first, validation |
| **LangGraph** | Complex agentic state machines for multi-step workflows |
| **Groq/Ollama** | Free/self-hosted LLM access without OpenAI costs |
| **Supabase** | Managed PostgreSQL with real-time subscriptions for meetings |
| **SQLite** | Zero-config, file-based for rapid prototyping |
| **Whisper** | Free, offline audio transcription for privacy |
| **WebSockets** | Real-time decision/status updates to frontend |
| **APScheduler** | Background task scheduling (retries, escalations) |
| **Pydantic** | Data validation, serialization, documentation |

---

## 📈 Monitoring & Health Checks

Each service exposes:
- `GET /health` - Service status
- `GET /docs` - Swagger UI API documentation
- Structured logging for debugging
- Error tracking & reporting to central service

---

## 🔮 Future Enhancements

- GraphQL API layer
- WebSocket pub/sub for real-time notifications
- Multi-tenant SLA management
- Advanced analytics dashboard
- ML-based escalation prediction
- Webhook integrations for external systems
- API rate limiting & quotas
