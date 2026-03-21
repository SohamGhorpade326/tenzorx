# Workstream AI - Complete System 🧠

A unified platform combining **AI-powered meeting management** and **intelligent procurement pipeline**.

---

## 📦 Project Structure

```
Workstream-AI/
├── frontend/              # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── procurement/  # ✨ NEW: Payment, vendors, analytics
│   │   │   └── ...
│   │   └── components/
│   └── package.json
│
├── backend/               # FastAPI - Meeting Management System
│   ├── main.py
│   ├── requirements.txt
│   ├── agents/            # LangGraph agents
│   ├── routers/
│   └── db/
│
├── etgenai/               # FastAPI - Procurement System (✨ NEW)
│   ├── main.py
│   ├── requirements.txt
│   ├── agents/            # Budget, Vendor, Invoice agents...
│   ├── api/routes.py      # Payment endpoints, Analytics
│   ├── db/procurement.db
│   └── orchestrator/
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 16+** (frontend)
- **Python 3.10+** (backends)
- **npm** or **yarn**

### 1️⃣ Backend Setup (Meeting Management)

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Runs on:** `http://localhost:8000`

### 2️⃣ Procurement Backend Setup (etgenai)

```bash
cd etgenai
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

**Runs on:** `http://localhost:8001`

### 3️⃣ Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```

**Runs on:** `http://localhost:5173` (or next available port)

---

## 📊 System Overview

### Workstream-AI (Meeting Management)
- **Frontend:** React dashboard with meeting room, tasks, audit trail
- **Backend:** FastAPI with 6 LangGraph agents
  - TranscriptAgent (Whisper transcription)
  - ValidatorAgent (Validation)
  - TaskCreatorAgent (Extract tasks)
  - TrackerAgent (Track deadlines)
  - EscalationAgent (Escalate overdue)
  - SummaryAgent (Executive summary)

### Procurement System (etgenai)
- **Frontend:** Vendor Intelligence, Analytics Dashboard, Payment Gateway
- **Backend:** Intelligent procurement pipeline
  - Purchase Request → Budget Check → Vendor Selection → PO Creation
  - Goods Receipt → Invoice Matching → Payment Processing
  - 7 Agent-based stages with human review queues
  - Professional UI with color-coded stages
  - Simulated payment gateway (UPI, Card, Net Banking)

---

## 🔧 Configuration

### Meeting System (.env - backend/)
```
GROQ_API_KEY=your_groq_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Procurement System (.env - etgenai/)
```
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_URL=sqlite:///procurement.db
```

---

## 🎯 Key Features

### ✅ Meeting Management
- Real-time transcription with Whisper
- Multi-agent decision extraction
- Task tracking and escalation
- WebSocket for live updates
- Audit trail logging

### ✅ Procurement System
- 7-stage intelligent pipeline
- Budget validation
- Vendor intelligence with AI assessment
- Invoice matching with variance detection
- Simulated payment gateway
- Real-time analytics dashboard
- Professional UI with smooth animations
- Color-coded data cards (blue, amber, purple, cyan, rose, indigo, emerald)

---

## 📡 APIs

### Meeting System
- Base URL: `http://localhost:8000`
- Endpoints: `/meetings`, `/tasks`, `/escalations`, `/audit`

### Procurement System
- Base URL: `http://localhost:8001`
- Endpoints:
  - `/procurement/runs` - Pipeline execution
  - `/procurement/analytics/*` - KPIs, spend trends, budget
  - `/procurement/vendors/*` - Vendor CRUD + intelligence
  - `/procurement/payments/*` - Payment processing
  - `/procurement/audit-log` - Event tracking

---

## 🧪 Testing

### Frontend
```bash
cd frontend
npm run test
```

### Procurement Backend
```bash
cd etgenai
python test_full_workflow.py  # End-to-end workflow test
```

---

## 🛠️ Development

### Adding New Procurement Agent
1. Create `agents/your_agent.py`
2. Inherit from `base_agent.BaseAgent`
3. Implement `execute()` method
4. Register in `orchestrator/state_graph.py`

### Adding Payment Method
1. Extend `PaymentGatewayModal.tsx`
2. Add new form tab
3. Update backend payment processing

---

## 📚 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| API | FastAPI, Pydantic |
| Backend (AI) | LangGraph, Groq, Whisper |
| Backend (Procure.) | FastAPI, Ollama Mistral, SQLite |
| Database | Supabase (meetings), SQLite (procurement) |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |

---

## 🔐 Security

- ✅ API authentication via Groq/Supabase
- ✅ Request validation (Pydantic)
- ✅ Audit logging for all operations
- ✅ Human review queues for high-value transactions
- ✅ Environment variable protection (.env)

---

## 📈 Performance

- **Frontend:** Vite fast refresh, optimized chunks
- **Backends:** Uvicorn async processing
- **Database:** SQLite with proper indexing
- **Caching:** 5-minute cache for AI insights

---

## 🚢 Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
```

### Backend (Docker/Heroku)
```dockerfile
FROM python:3.10
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
```

---

## 📝 License

MIT

---

## 👨‍💻 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "feat: your feature"`
3. Push: `git push origin feature/your-feature`
4. Create Pull Request

---

## 📞 Support

- 📧 Email: support@workstream.ai
- 💬 Discord: [Community Server](https://discord.gg/workstream)
- 🐛 Issues: [GitHub Issues](https://github.com/SwainDias/Workstream-AI/issues)

---

**Built with ❤️ | Last Updated: March 21, 2026**
