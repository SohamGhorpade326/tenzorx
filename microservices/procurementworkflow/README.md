# Procurement AI — Agentic P2P Pipeline

Multi-agent procurement-to-payment system built for the **Economic Times Agentic AI Hackathon**.  
Uses **Ollama (Mistral 7B)** locally + **FastAPI** + **LangGraph** + **SQLite**.

---

## Architecture

```
Purchase Request → Budget Check → Vendor Selection → PO Creation
                                                         ↓
                                               [awaiting delivery]
                                                         ↓
                                               Goods Receipt Agent
                                                         ↓
                                               [awaiting invoice]
                                                         ↓
                                         Invoice Matching (3-way match)
                                                         ↓
                                             Payment Scheduling
                                                         ↓
                                                  COMPLETE
```

Every step writes to the **Audit Trail**. Failures route to the **Human Review Queue**.

---

## Setup

### 1. Prerequisites

- Python 3.11+
- [Ollama](https://ollama.ai) installed and running
- Mistral model pulled:

```bash
ollama pull mistral
ollama serve          # keep this running in a separate terminal
```

### 2. Install dependencies

```bash
cd procurement
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work out of the box)
```

### 4. Start the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On startup, the server will:
- Create `procurement.db` (SQLite) with all tables
- Seed `mock_data/` with vendors, budgets, and 3 sample scenarios

Visit **http://localhost:8000/docs** for interactive Swagger UI.

---

## Demo: 3 Scenarios

### Scenario 1 — Clean run (end-to-end success)

```bash
# Step 1: Start run
curl -X POST http://localhost:8000/procurement/run \
  -H "Content-Type: application/json" \
  -d '{
    "purchase_request": {
      "item_name": "Dell Laptop 15 Pro",
      "quantity": 5,
      "unit_price": 82000,
      "department": "Engineering",
      "requester_id": "EMP-204",
      "category": "IT Hardware",
      "required_by": "2024-04-15"
    }
  }'

# Note the run_id from the response, e.g. "RUN-ABC12345"

# Step 2: Trigger delivery
curl -X POST http://localhost:8000/procurement/run/RUN-ABC12345/delivery \
  -H "Content-Type: application/json" \
  -d '{
    "delivery": {
      "po_id": "<po_id from state>",
      "delivered_items": ["Dell Laptop 15 Pro"],
      "delivered_quantities": [5],
      "delivery_date": "2024-04-10",
      "delivery_note_ref": "DN-9001"
    }
  }'

# Step 3: Trigger invoice (clean — matches PO exactly)
curl -X POST http://localhost:8000/procurement/run/RUN-ABC12345/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoice": {
      "po_id": "<po_id>",
      "gr_id": "<gr_id from state>",
      "invoice_id": "INV-VEN001-201",
      "invoice_amount": 410000,
      "invoice_items": [
        {"item_name": "Dell Laptop 15 Pro", "quantity": 5, "unit_price": 82000}
      ],
      "invoice_date": "2024-04-11",
      "vendor_bank_ref": "HDFC-VEN001-ACC"
    }
  }'
```

### Scenario 2 — Budget blocked

Use `"department": "HR"` with `"category": "Office Supplies"` — HR office budget is 97.5% used.  
Run will pause at `pending_budget_review`. Approve via:

```bash
curl -X POST http://localhost:8000/procurement/reviews/<review_id> \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "note": "CFO override approved"}'
```

### Scenario 3 — Invoice mismatch

Send invoice with `unit_price: 105000` instead of PO price `95000`.  
3-way match will **FAIL**, payment blocked, item added to human review queue.

---

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/procurement/run` | Start a new procurement run |
| GET | `/procurement/runs` | List all runs |
| GET | `/procurement/run/{run_id}` | Get run status + full state |
| POST | `/procurement/run/{run_id}/delivery` | Trigger goods receipt |
| POST | `/procurement/run/{run_id}/invoice` | Trigger invoice matching + payment |
| GET | `/procurement/run/{run_id}/audit` | Get audit log for a run |
| GET | `/procurement/audit` | Full audit log (all runs) |
| GET | `/procurement/reviews` | Pending human review items |
| POST | `/procurement/reviews/{review_id}` | Approve or reject a review item |
| GET | `/procurement/samples` | Sample request payloads |
| GET | `/health` | Health check |

---

## File Structure

```
procurement/
├── agents/               ← one file per agent
├── orchestrator/         ← LangGraph pipeline + error recovery + review queue
├── db/                   ← schema, CRUD helpers, seed data
├── models/               ← Pydantic schemas + enums
├── mock_data/            ← vendors.json, budgets.json, sample_requests.json
├── api/                  ← FastAPI routes
├── main.py               ← app entry point
├── config.py             ← all settings
├── prompts.py            ← all LLM prompts
└── requirements.txt
```

---

## Judging Criteria Mapping

| Criterion | Where it's demonstrated |
|-----------|------------------------|
| Depth of autonomy | 7 agents run without human input on clean path |
| Error recovery | Retry logic in `base_agent.py` + `error_recovery.py` |
| Auditability | Every agent action → `audit_log` table, queryable via API |
| Real-world applicability | Full P2P cycle: PR → Budget → Vendor → PO → GR → Invoice → Payment |
| Human-in-the-loop | Review queue for budget blocks, mismatch flags, vendor exceptions |