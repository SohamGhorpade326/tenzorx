# Workstream AI — Complete Multi-Workflow Platform 🧠

> AI-powered enterprise platform orchestrating 4 major workflows: Meeting Intelligence, Procurement Pipeline, Contract Management, and Employee Onboarding. Built with FastAPI, React, LangGraph state machines, and multi-agent AI coordination.

---

## 🎯 Platform Overview

**Workstream AI** is a modular, distributed system processing enterprise workflows through intelligent AI pipelines. Real-time decision extraction, validation, task creation, deadline tracking, and escalation management.

### What's Included

| Workflow | Purpose | LLM | Database | Port | Status |
|---|---|---|---|---|---|
| **Meeting Intelligence** | Transcribe meetings, extract decisions, create tracked tasks, escalate delays | Groq llama3-70b | Supabase PostgreSQL | 8000 | ✅ Complete |
| **Procurement Pipeline** | Purchase requests → vendor selection → PO creation → invoice matching → payment | Ollama Mistral 7B | SQLite | 8001 | ✅ Complete |
| **Contract Management** | Contract processing, validation, risk analysis, approval workflows | Ollama/Groq | SQLite | 8002 | ✅ Complete |
| **Onboarding Workflow** | Employee onboarding, document collection, system provisioning | Local/Cloud LLM | SQLite | 8003 | ✅ Complete |
| **Orchestrator Service** | Central routing, request validation, SLA management | — | SQLite | 8009 | ✅ Complete |
| **Task SLA Service** | Deadline tracking, escalation triggers, SLA reporting | — | SQLite | 8010 | ✅ Complete |
| **Frontend UI** | React 18 + Vite + Tailwind CSS dashboard, authenticated access | — | — | 5173 | ✅ Complete |

---

## 💻 Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** + Shadcn/ui components
- **Framer Motion** for animations
- **Context API** for state management
- **Authentication**: Demo mode (dev) + Clerk SSO ready (enterprise)

### Backend Microservices
- **FastAPI** + Uvicorn
- **Python 3.11+**
- **LangGraph** for agent state machines
- **APScheduler** for background tasks
- **WebSocket** for real-time updates
- **CORS** enabled for frontend integration

### Databases
- **Supabase PostgreSQL** (Meeting workflow — cloud hosted)
- **SQLite** (Procurement, Contract, Onboarding, Orchestrator, Task-SLA)

### AI/LLM
- **Groq API** (llama3-70b) — free cloud LLM for meeting decision extraction
- **Ollama** (Mistral 7B) — local LLM for procurement, contracts
- **Whisper** (OpenAI) — local audio transcription, no API key needed

---

## 🚀 Quick Start (All Platforms)

### Prerequisites
- Python 3.11+ installed
- Node.js 18+ installed
- 2+ GB available RAM
- All `.env.example` files in their respective directories

### One-Command Setup (Recommended)

```bash
# Clone and navigate
cd Workstream-AI

# Backend setup (all services)
cd microservices/meetingworkflow && python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../../frontend && npm install

# Run all services (8 terminals or use tmux/screen)
```

### Running All 7 Services

Open **7 terminals** from workspace root:

**Terminal 1 — Meeting Workflow (Port 8000):**
```bash
cd microservices/meetingworkflow
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
# or: uvicorn main:app --reload --port 8000
```

**Terminal 2 — Procurement Workflow (Port 8001):**
```bash
cd microservices/procurementworkflow
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Terminal 3 — Contract Workflow (Port 8002):**
```bash
cd microservices/contract-workflow
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Terminal 4 — Onboarding Workflow (Port 8003):**
```bash
cd microservices/onboardingworkflow
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Terminal 5 — Orchestrator Service (Port 8009):**
```bash
cd orchestrator-service
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Terminal 6 — Task SLA Service (Port 8010):**
```bash
cd task-sla-service
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Terminal 7 — Frontend (Port 5173):**
```bash
cd frontend
npm install  # if not already done
npm run dev
```

✅ **All services running!** Open [http://localhost:5173](http://localhost:5173)

**Demo Login:**
- Email: `demo@workstream.io`
- Password: `demo123`

---

## 📋 Workflow Details

### 1️⃣ Meeting Intelligence Workflow (Port 8000)

**Purpose:** Transform meeting recordings into actionable tracked tasks.

**Flow:**
```
1. Record Meeting (audio/video)
   ↓
2. Transcription (Whisper — local audio transcription)
   ↓
3. Decision Extraction (Groq LLM — extract decisions, owners, deadlines)
   ↓
4. Validation (Rules + LLM — check completeness, actionability)
   ↓
5. Human Review Gate (Flagged items → manual review in UI)
   ↓
6. Task Creation (Create tracked tasks in Supabase with priority)
   ↓
7. Deadline Tracking (Background job every 5 min)
   - PENDING → AT_RISK (48hr to deadline) → OVERDUE
   ↓
8. Escalation (AI-written escalation messages for overdue tasks)
   ↓
9. Audit Trail (All agent decisions logged)
```

**Agents (6 total):**
1. **TranscriptAgent** — Whisper transcription + Groq decision extraction
2. **ValidatorAgent** — Rules validation + actionability checks
3. **HumanReviewGate** — Pause pipeline, show flagged items
4. **TaskCreatorAgent** — Create task records + priority/criteria
5. **TrackerAgent** — Monitor deadlines (5-min background job)
6. **EscalationAgent** — Generate escalation messages

**Database:** Supabase PostgreSQL
- `meetings` — meeting records, transcripts
- `tasks` — extracted action items, status, owner
- `escalations` — auto-generated escalation messages
- `audit_logs` — all agent decisions

**Key APIs:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/meetings/process-transcript` | Upload text transcript |
| POST | `/api/meetings/process-audio` | Upload audio file |
| GET | `/api/dashboard` | Metrics + recent runs |
| GET | `/api/tasks` | List tasks (filter by status) |
| PATCH | `/api/tasks/{id}` | Update task status/owner |
| GET | `/api/escalations` | Pending escalations |
| POST | `/api/escalations/{id}/approve` | Send escalation message |
| WS | `/api/ws/pipeline/{run_id}` | Live agent execution updates |

---

### 2️⃣ Procurement Pipeline Workflow (Port 8001)

**Purpose:** End-to-end purchase request processing with vendor selection and payment tracking.

**Flow:**
```
1. Purchase Request Creation
   ↓
2. Procurement Analysis (Ollama LLM — analyze requirements)
   ↓
3. Vendor Selection (Score vendors on price, rating, delivery time)
   ↓
4. PO Creation (Generate Purchase Order)
   ↓
5. Order Placement (Request sent to vendor)
   ↓
6. Goods Receipt (Track shipment/delivery)
   ↓
7. Invoice Matching (Three-way match: PO ↔ GR ↔ Invoice)
   ↓
8. Invoice Validation (Check amounts, tax, compliance)
   ↓
9. Payment Processing (Create payment request)
   ↓
10. Audit Trail (All steps logged)
```

**Agents (8+ total):**
1. **PurchaseRequestAgent** — Create PR records
2. **ProcurementAgent** — Analyze requirements, estimate costs
3. **VendorSelectionAgent** — Score and rank vendors
4. **POCreationAgent** — Generate PO from PR
5. **GoodsReceiptAgent** — Track shipments
6. **InvoiceMatchingAgent** — Three-way reconciliation
7. **InvoiceValidationAgent** — Check compliance, amounts
8. **PaymentAgent** — Process payments
9. **BudgetCheckAgent** — Validate against available budget
10. **AuditTrailAgent** — Log all decisions

**Database:** SQLite (`procurement.db`)
- `purchase_requests` — PR details, status
- `vendors` — vendor database, ratings, pricing
- `purchase_orders` — PO records
- `goods_receipts` — shipment tracking
- `invoices` — invoice records
- `payments` — payment status
- `audit_logs` — all agent actions

**Business Rules (Configurable in `.env`):**
```env
APPROVAL_THRESHOLD=50000      # PR amount requiring approval
DISCOUNT_RANGE_MIN=5          # Min vendor discount %
DISCOUNT_RANGE_MAX=20         # Max vendor discount %
VENDOR_RATING_WEIGHT=0.3      # Weight in vendor scoring
PRICE_WEIGHT=0.5
DELIVERY_TIME_WEIGHT=0.2
```

**Key APIs:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/purchase-requests` | Create PR |
| GET | `/api/purchase-requests` | List PRs |
| POST | `/api/procurement/analyze` | Analyze requirements |
| GET | `/api/vendors` | List vendors |
| POST | `/api/purchase-orders` | Create PO |
| POST | `/api/goods-receipts` | Record goods receipt |
| POST | `/api/invoices/match` | Three-way match |
| POST | `/api/payments` | Create payment request |

---

### 3️⃣ Contract Management Workflow (Port 8002)

**Purpose:** Contract processing, analysis, risk assessment, and approval tracking.

**Flow:**
```
1. Contract Upload
   ↓
2. Document Extraction (OCR/LLM — extract key terms)
   ↓
3. Contract Analysis (LLM — identify clauses, obligations, risks)
   ↓
4. Risk Assessment (Score contract risk level: low/medium/high)
   ↓
5. Compliance Check (Validate against company policies)
   ↓
6. Approval Workflow (Route to appropriate approver)
   ↓
7. Execution Tracking (Monitor contract lifecycle)
   ↓
8. Audit Trail (All reviews logged)
```

**Agents:**
1. **ContractExtractionAgent** — Extract terms, dates, amounts
2. **ContractAnalysisAgent** — Analyze clauses and obligations
3. **RiskAssessmentAgent** — Score contract risk
4. **ComplianceAgent** — Check policy compliance
5. **ApprovalWorkflowAgent** — Route approvals

**Database:** SQLite (`contracts.db`)
- `contracts` — contract records, status, risk level
- `contract_terms` — extracted key terms
- `approvals` — approval history
- `audit_logs` — decision audit trail

**Key APIs:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/contracts/upload` | Upload contract file |
| GET | `/api/contracts` | List contracts |
| GET | `/api/contracts/{id}` | Contract details + analysis |
| PATCH | `/api/contracts/{id}/approve` | Approve contract |
| PATCH | `/api/contracts/{id}/reject` | Reject with comment |

---

### 4️⃣ Employee Onboarding Workflow (Port 8003)

**Purpose:** Streamlined new employee onboarding with document collection and system provisioning.

**Flow:**
```
1. Onboarding Initiation (HR creates employee record)
   ↓
2. Document Collection (Automate forms: W-4, I-9, direct deposit)
   ↓
3. System Provisioning (Create email, access accounts)
   ↓
4. Manager Assignment (Link to reporting manager)
   ↓
5. Training Assignment (Route to training modules)
   ↓
6. First-Day Prep (Generate welcome package, setup schedule)
   ↓
7. Checklist Tracking (Monitor completion of setup tasks)
   ↓
8. Audit Trail (All steps logged)
```

**Agents:**
1. **OnboardingInitiationAgent** — Create employee records
2. **DocumentCollectionAgent** — Automate form requests
3. **ProvisioningAgent** — Create system accounts
4. **TrainingAssignmentAgent** — Route training modules
5. **FirstDayPrepAgent** — Generate welcome materials

**Database:** SQLite (`onboarding.db`)
- `employees` — employee records
- `onboarding_tasks` — checklist items, completion status
- `documents` — collected forms and documents
- `systems` — provisioned accounts
- `audit_logs` — action history

**Key APIs:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/onboarding/employees` | Create employee |
| GET | `/api/onboarding/employees/{id}` | Employee status |
| GET | `/api/onboarding/tasks` | List onboarding tasks |
| PATCH | `/api/onboarding/tasks/{id}` | Mark task complete |
| POST | `/api/onboarding/documents` | Upload form |

---

### 5️⃣ Orchestrator Service (Port 8009)

**Purpose:** Central request routing, validation, and SLA management across all workflows.

**Responsibilities:**
- Route incoming requests to appropriate microservice
- Validate request schema and required fields
- Track request SLAs (response time targets)
- Manage circuit breaker for microservice health
- Coordinate cross-workflow requests

**Configuration (`.env`):**
```env
MEETING_SERVICE_URL=http://localhost:8000
PROCUREMENT_SERVICE_URL=http://localhost:8001
CONTRACT_SERVICE_URL=http://localhost:8002
ONBOARDING_SERVICE_URL=http://localhost:8003
TASK_SLA_SERVICE_URL=http://localhost:8010

# HTTP client tuning
MAX_RETRIES=3
RETRY_DELAY_MS=1000
TIMEOUT_MS=30000

# SLA thresholds (milliseconds)
MEETING_SLA_MS=5000
PROCUREMENT_SLA_MS=10000
CONTRACT_SLA_MS=8000
ONBOARDING_SLA_MS=7000
```

**Key Endpoints:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/orchestrate/route` | Route request to service |
| GET | `/api/health/services` | Service health status |
| GET | `/api/sla/status` | SLA compliance metrics |

---

### 6️⃣ Task SLA Service (Port 8010)

**Purpose:** Cross-workflow deadline tracking and SLA reporting.

**Responsibilities:**
- Monitor task/request completion deadlines
- Trigger escalation when SLA approaching
- Generate SLA compliance reports
- Track performance metrics per workflow

**Key Endpoints:**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sla/tasks` | List tracked tasks + SLA status |
| GET | `/api/sla/reports` | SLA compliance reports |
| POST | `/api/sla/escalations` | Create SLA escalation |

---

## 🔐 Authentication

### Development Mode
Pre-filled login credentials (set in [frontend/src/pages/Login.tsx](frontend/src/pages/Login.tsx)):
- **Email:** `demo@workstream.io`
- **Password:** `demo123`

### Enterprise Mode (Clerk SSO)
The login page is pre-configured with Clerk authentication integration:
- Add Clerk API key to `.env`
- Uncomment Clerk provider code in [frontend/src/pages/Login.tsx](frontend/src/pages/Login.tsx)
- Users can sign in with Google, GitHub, Email

---

## 📁 Project Structure

```
Workstream-AI/
├── microservices/
│   ├── meetingworkflow/          (Port 8000 — Groq llama3)
│   │   ├── agents/               (6 agents)
│   │   ├── db/                   (Supabase schema)
│   │   ├── models/
│   │   ├── routers/              (FastAPI routes)
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── .env.example
│   │
│   ├── procurementworkflow/      (Port 8001 — Ollama Mistral)
│   │   ├── agents/               (8+ agents)
│   │   ├── db/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── .env.example
│   │
│   ├── contract-workflow/        (Port 8002)
│   │   ├── agents/
│   │   ├── db/
│   │   ├── models/
│   │   ├── routers/
│   │   └── ...
│   │
│   ├── onboardingworkflow/       (Port 8003)
│   │   ├── agents/
│   │   ├── db/
│   │   ├── models/
│   │   ├── routers/
│   │   └── ...
│   │
├── orchestrator-service/         (Port 8009)
│   ├── clients/
│   ├── models/
│   ├── routers/
│   ├── services/
│   ├── config.py
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── task-sla-service/            (Port 8010)
│   ├── db/
│   ├── models/
│   ├── routers/
│   ├── services/
│   ├── config.py
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                     (Port 5173 — React + Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx         (Auth + demo credentials)
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MeetingRoom.tsx
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AuthContext.tsx   (Global auth state)
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx (Route guard)
│   │   │   ├── AppLayout.tsx     (Main layout + logout)
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api.ts           (API client)
│   │   │   ├── onboardingApi.ts
│   │   │   ├── contractApi.ts
│   │   │   └── ...
│   │   └── App.tsx              (Routes + auth provider)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── README.md                     (This file)
```

---

## ⚙️ Environment Variables

Each microservice has a `.env.example` file. Copy and customize:

```bash
# Copy templates
cp microservices/meetingworkflow/.env.example microservices/meetingworkflow/.env
cp microservices/procurementworkflow/.env.example microservices/procurementworkflow/.env
cp microservices/contract-workflow/.env.example microservices/contract-workflow/.env
cp microservices/onboardingworkflow/.env.example microservices/onboardingworkflow/.env
cp orchestrator-service/.env.example orchestrator-service/.env
cp task-sla-service/.env.example task-sla-service/.env
```

### Key Variables

**Meeting Workflow:**
```env
GROQ_API_KEY=gsk_your_key_here          # From console.groq.com (free)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
API_PORT=8000
```

**Procurement Workflow:**
```env
OLLAMA_BASE_URL=http://localhost:11434  # Local Ollama (or cloud URL)
APPROVAL_THRESHOLD=50000                # PR amount requiring approval
VENDOR_RATING_WEIGHT=0.3                # Vendor scoring weights
PRICE_WEIGHT=0.5
DELIVERY_TIME_WEIGHT=0.2
API_PORT=8001
```

**Orchestrator Service:**
```env
MEETING_SERVICE_URL=http://localhost:8000
PROCUREMENT_SERVICE_URL=http://localhost:8001
CONTRACT_SERVICE_URL=http://localhost:8002
ONBOARDING_SERVICE_URL=http://localhost:8003
TASK_SLA_SERVICE_URL=http://localhost:8010
API_PORT=8009
```

See each `.env.example` file for complete configuration options.

---

## 🧪 Testing

### Health Checks
Verify all services are running:

```bash
# Meeting
curl http://localhost:8000/health

# Procurement
curl http://localhost:8001/health

# Contracts
curl http://localhost:8002/health

# Onboarding
curl http://localhost:8003/health

# Orchestrator
curl http://localhost:8009/health

# Task SLA
curl http://localhost:8010/health
```

### Meeting Workflow Demo
1. Open [http://localhost:5173](http://localhost:5173)
2. Login with `demo@workstream.io` / `demo123`
3. Navigate to **Meeting Room**
4. Click **Start Meeting** and speak clearly
5. Say: "Sarah, please prepare the Q4 budget report by March 15th"
6. Click **End Meeting**
7. Watch the 6-agent pipeline process your audio in real-time

### Procurement Demo
1. Navigate to **Purchase Requests**
2. Click **Create Request**
3. Fill in requirement details
4. Submit → Watch vendor selection, PO creation, and approval pipeline

### Contract Demo
1. Navigate to **Contracts**
2. Upload a contract file
3. View extracted terms, risk assessment, and approval status

### Onboarding Demo
1. Navigate to **Onboarding**
2. Click **New Employee**
3. Auto-generated checklist and document requests populate

---

## 🐛 Troubleshooting

| Issue | Solution |
|---|---|
| **Port already in use** | Kill existing process: `lsof -i :8000` (Mac) / `netstat -ano \| findstr :8000` (Windows) |
| **Groq API key invalid** | Verify key at [console.groq.com](https://console.groq.com) → API Keys |
| **Supabase connection refused** | Check `.env` has valid `SUPABASE_URL` and keys |
| **Ollama not found** | Install: `brew install ollama` (Mac) / Win installer / `curl` Linux |
| **Frontend 404 on API calls** | Verify backend service running on correct port (8000, 8001, etc.) |
| **WebSocket connection fails** | Ensure backend running with CORS enabled |
| **Module not found (Python)** | Activate venv: `source venv/bin/activate` (Mac/Linux) or `venv\Scripts\activate` (Windows) |
| **Pip install errors** | Upgrade: `pip install --upgrade pip setuptools` → Clear cache: `pip cache purge` |
| **Frontend login redirect loop** | Clear localStorage: DevTools → Application → Storage → Clear All |
| **Database locked (SQLite)** | Ensure only one process accessing database; close conflicting services |

---

## 📊 Monitoring & Logging

### Meeting Workflow Metrics
```
GET http://localhost:8000/api/dashboard
Returns: Active runs, completed tasks, pending escalations, SLA metrics
```

### Audit Trails
```
GET http://localhost:8000/api/audit-events
GET http://localhost:8001/api/audit
GET http://localhost:8002/api/audit
```

### Real-Time Pipeline Updates
```
WS http://localhost:8000/api/ws/pipeline/{run_id}
Listen for live agent execution events
```

---

## 🎬 Demo Scenarios

### Scenario 1: Meeting Decision Extraction
**Time:** ~2 min
1. Record meeting with action item: "John to submit report by March 20th"
2. Watch TranscriptAgent transcribe audio
3. Watch ValidatorAgent check completeness
4. Task auto-created with deadline
5. Monitor TrackerAgent scan deadline

### Scenario 2: Procurement Full Cycle
**Time:** ~5 min
1. Create Purchase Request for office equipment
2. Watch ProcurementAgent analyze requirements
3. VendorSelectionAgent scores vendors
4. POCreationAgent generates PO
5. Mock goods receipt
6. Invoice matching pipeline

### Scenario 3: Contract Review
**Time:** ~3 min
1. Upload sample contract (PDF/image)
2. ContractAnalysisAgent extracts terms
3. RiskAssessmentAgent evaluates risk
4. ComplianceAgent checks policies
5. Route to approval

### Scenario 4: Employee Onboarding
**Time:** ~2 min
1. Create new employee record
2. Auto-generate onboarding checklist
3. Document collection forms sent
4. View provisioning status
5. Monitor first-day prep

---

## 📝 API Documentation

Interactive API docs available at each service:

- **Meeting:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Procurement:** [http://localhost:8001/docs](http://localhost:8001/docs)
- **Contracts:** [http://localhost:8002/docs](http://localhost:8002/docs)
- **Onboarding:** [http://localhost:8003/docs](http://localhost:8003/docs)
- **Orchestrator:** [http://localhost:8009/docs](http://localhost:8009/docs)
- **Task SLA:** [http://localhost:8010/docs](http://localhost:8010/docs)

---

## 🚀 Deployment

### Docker Deployment (Coming Soon)
```bash
docker-compose up -d
```

### Kubernetes Deployment
See individual microservice directories for K8s manifests.

### Cloud Deployment
- **Frontend:** Vercel, Netlify, AWS S3 + CloudFront
- **Backend:** AWS ECS, Google Cloud Run, Azure Container Instances
- **Database:** Managed PostgreSQL (Supabase, RDS, Cloud SQL)

---

## 💡 Tips & Best Practices

1. **Always activate venv before installing packages:**
   ```bash
   source venv/bin/activate  # Mac/Linux
   venv\Scripts\activate     # Windows
   ```

2. **Keep `.env` files secure — never commit them:**
   ```bash
   echo .env >> .gitignore
   ```

3. **Use `.env.example` for documentation** — other developers copy and fill it

4. **Monitor service health regularly:**
   ```bash
   for port in 8000 8001 8002 8003 8009 8010; do
     echo "Port $port:" && curl -s http://localhost:$port/health
   done
   ```

5. **Check logs for agent decisions:**
   ```
   All agent steps logged to:
   - Supabase audit tables (Meeting)
   - SQLite audit_logs tables (Procurement, Contracts, Onboarding)
   ```

6. **WebSocket debugging:**
   - Browser DevTools → Network → WS (WebSocket) filter
   - Watch message flow in real-time during pipeline execution

---

## 📞 Support & Questions

- **Configuration Issues:** Check `.env` files and `.env.example` templates
- **API Errors:** Review `/docs` Swagger UI at each service
- **Database Issues:** Check database connection strings in `.env`
- **LLM Issues:** Verify API keys (Groq) and Ollama running locally
- **Frontend Issues:** Check browser console for auth/routing errors

---

## 📜 License

Workstream AI — Enterprise Workflow Automation Platform

**Built with ❤️ for teams that demand intelligent automation.**
