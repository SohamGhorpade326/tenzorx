# 🎥 Video Onboarding Service

**AI-Powered Video Interview-Based Employee Onboarding with Document Collection & HR Review**

---

## 📋 Overview

The Video Onboarding Service enables new employees to complete a structured HR onboarding interview via a web-based video interface. The system:

✅ Generates unique video meet links for each employee  
✅ Asks 10 predefined HR onboarding questions sequentially  
✅ Records answers with 4-minute timer per question  
✅ Captures document uploads (Aadhar, PAN, Address Proof, etc.)  
✅ Transcribes and stores all responses  
✅ Routes completed interviews to HR team for review  
✅ Maintains complete audit trail  

---

## 🏗️ Architecture

### Backend Microservice (Port 8004)
- **Framework**: FastAPI 0.115.6
- **Database**: SQLite with WAL mode for concurrent access
- **Purpose**: Manage sessions, questions, answers, document uploads, and HR routing

### Frontend Pages (React + TypeScript)
- **VideoOnboardingPage**: Employee registration & meet link generation
- **VideoOnboardingInterview**: Interactive Q&A with timer, document upload, progress tracking
- **VideoOnboardingThankYou**: Completion confirmation

---

## 📁 Project Structure

```
microservices/video_onboarding_service/
├── main.py                          # FastAPI app entry point (port 8004)
├── config.py                        # Configuration & environment variables
├── requirements.txt                 # Python dependencies
├── .env.example                     # Environment template
├── db/
│   ├── schema.sql                   # Database schema (SQLite)
│   └── db.py                        # Database helpers & ORM logic
├── models/
│   ├── schemas.py                   # Pydantic request/response models
│   └── __init__.py
├── api/
│   ├── routes.py                    # All API endpoints
│   └── __init__.py
├── services/
│   ├── video_session_service.py     # Business logic
│   └── __init__.py
└── uploads/                         # Document storage directory

frontend/
└── src/
    ├── lib/
    │   └── video-api.ts             # Video onboarding API client
    ├── pages/
    │   ├── VideoOnboardingPage.tsx          # Employee registration
    │   ├── VideoOnboardingInterview.tsx     # Interview Q&A interface
    │   └── VideoOnboardingThankYou.tsx      # Completion page
    └── App.tsx                      # Updated routes
```

---

## 🚀 Quick Start

### 1. **Setup Backend**

```bash
# Navigate to microservice
cd microservices/video_onboarding_service

# Create virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows
# or
source venv/bin/activate      # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Run the service
python main.py 8004
```

**Output:**
```
🚀 Video Onboarding API starting...
INFO:     Uvicorn running on http://0.0.0.0:8004
```

### 2. **Configure Frontend**

In your `.env` or `vite.config.ts`, ensure:
```
VITE_VIDEO_API_URL=http://localhost:8004
```

### 3. **Start Frontend**

```bash
cd frontend
npm run dev
```

Navigate to: **http://localhost:5173/video/onboarding**

---

## 📊 The 10 Onboarding Questions

| # | Question | Type | Timer | Category |
|---|----------|------|-------|----------|
| 1 | Upload Aadhar/Passport | Document Upload | 3 min | Documents |
| 2 | Selfie for liveness check | Video Liveness | 2 min | Verification |
| 3 | Upload PAN card | Document Upload | 2 min | Tax |
| 4 | Bank account details | Text Input | 4 min | Financial |
| 5 | Emergency contact | Text Input | 3 min | Personal |
| 6 | NDA & Confidentiality | Yes/No | 2 min | Compliance |
| 7 | Code of Conduct | Yes/No | 3 min | Compliance |
| 8 | Health Insurance preference | Text Input | 4 min | Benefits |
| 9 | IT Setup preferences | Text Input | 3 min | Setup |
| 10 | Any concerns/blockers | Text Input (optional) | 5 min | HR Review |

**Total Duration**: ~22-28 minutes

---

## 📡 API Endpoints

### Session Management

```http
POST /api/video-onboarding/sessions/create
Body: {
  "employee_name": "John Doe",
  "employee_id": "E-12345",
  "employee_email": "john@company.com"
}
Returns: {
  "session_id": "abc123def456",
  "meet_link": "http://localhost:5173/video/meet/abc123def456",
  "status": "created",
  ...
}
```

```http
GET /api/video-onboarding/sessions/{session_id}
Returns: Complete session details with all answers
```

### Interview Flow

```http
POST /api/video-onboarding/sessions/{session_id}/start-interview
Returns: { "first_question": {...} }
```

```http
GET /api/video-onboarding/sessions/{session_id}/next-question
Returns: { "next_question": {...} }
```

```http
POST /api/video-onboarding/sessions/{session_id}/answer
Body: {
  "question_id": 4,
  "answer_text": "Account: 123456789",
  "duration_seconds": 180
}
Returns: { "success": true, "next_question": {...} }
```

### Document Upload

```http
POST /api/video-onboarding/sessions/{session_id}/upload-document
Body: (multipart/form-data)
- file: <binary>
- question_id: 1
- document_type: "aadhar"

Returns: { "success": true, "next_question": {...} }
```

### HR Review Submission

```http
POST /api/video-onboarding/sessions/{session_id}/submit-for-hr
Returns: {
  "success": true,
  "review_queue_id": "hrq-abc123",
  "message": "Submitted for HR review"
}
```

---

## 💾 Database Schema

### `interview_questions`
- question_id, question_text, question_type, category
- required, order, document_type, timer_seconds

### `video_sessions`
- session_id, employee_name, employee_id, meet_link
- status (created → in_progress → completed → submitted)
- created_at, started_at, completed_at, submitted_at
- review_queue_id, total_duration_seconds, questions_answered

### `answer_records`
- answer_id, session_id, question_id
- answer_text, document_path, video_url
- answered_at, duration_seconds

### `documents`
- document_id, session_id, question_id
- document_type (aadhar, pan, address_proof)
- file_name, file_path, file_size, uploaded_at

### `audit_log`
- log_id, session_id, action, details, timestamp

---

## 🎮 User Flow

### **Step 1: Create Session (Employee Registration Page)**
```
Employee enters: Name, ID, Email
↓
System generates unique meet_link & session_id
↓
"Start Interview" button appears
```

### **Step 2: Interview (Interactive Q&A Page)**
```
Employee clicks "Start Interview"
↓
Question 1 appears with 4-min timer
↓
Employee answers (text or uploads document)
↓
Next question appears automatically (or timer expires)
↓
Repeat for all 10 questions
```

### **Step 3: HR Review**
```
All answers collected
↓
System routed to HR review queue
↓
HR opens video onboarding dashboard
↓
HR reviews each answer, approves/requests follow-up
```

---

## 🔧 Configuration

Edit `.env` in `microservices/video_onboarding_service/`:

```ini
# API Server
API_HOST=0.0.0.0
API_PORT=8004
FRONTEND_URL=http://localhost:5173

# Database
DB_PATH=./video_onboarding.db

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# Question Timer (seconds)
QUESTION_DURATION_SECONDS=240  # 4 minutes

# Meet Link Base
MEET_BASE_URL=http://localhost:5173/video/meet

# Orchestrator Service (for HR routing)
ORCHESTRATOR_SERVICE_URL=http://localhost:8009
```

---

## 📂 Document Storage

Uploaded documents are stored with this structure:

```
uploads/
├── {session_id}/
│   ├── 1_aadhar.pdf          # Question 1: Aadhar
│   ├── 3_pan.pdf             # Question 3: PAN
│   └── 5_address_proof.jpg   # Custom: Address proof
```

Access via: `http://localhost:8004/uploads/{session_id}/...`

---

## 🔌 Integration with HR Review Queue

When interview completes, system sends to orchestrator:

```json
{
  "task_id": "session_id",
  "workflow": "video_onboarding",
  "employee_id": "E-12345",
  "type": "hr_review",
  "status": "pending_review",
  "data": {
    "session_id": "abc123",
    "meet_link": "...",
    "answers": [...],
    "duration_seconds": 1350
  },
  "assigned_to": "hr_team"
}
```

HR team can then:
- View all Q&A with timestamps
- Download documents
- Mark approved/rejected
- Request follow-up

---

## 🧪 Testing

### Test API Health

```bash
curl http://localhost:8004/health
```

### Create Test Session

```bash
curl -X POST http://localhost:8004/api/video-onboarding/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "employee_name": "Test Employee",
    "employee_id": "TEST-001",
    "employee_email": "test@example.com"
  }'
```

### List Questions

```bash
curl http://localhost:8004/api/video-onboarding/questions
```

---

## 📋 Checklist for Deployment

- [ ] Backend `.env` configured
- [ ] Frontend `.env` has `VITE_VIDEO_API_URL=http://localhost:8004`
- [ ] Database initialized (`video_onboarding.db` created with schema)
- [ ] `/uploads` directory exists with write permissions
- [ ] Frontend routes added to `App.tsx` ✅
- [ ] API client imported (`video-api.ts`) ✅
- [ ] Components created and styled ✅
- [ ] Orchestrator service running (for HR queue routing)

---

## 🚨 Troubleshooting

### Port 8004 Already in Use
```bash
# Windows
netstat -ano | findstr :8004
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :8004
kill -9 <pid>
```

### Database Lock Error
Ensure `PRAGMA WAL` is applied. Check `db.py` initialization.

### Document Upload Fails
- Check `/uploads` directory permissions
- Verify `MAX_FILE_SIZE` in config
- Check file extension is allowed (pdf, jpg, jpeg, png)

### API Not Responding
```bash
# Check backend running
curl http://localhost:8004/health

# Check logs
python main.py 8004  # Run in foreground for debug logs
```

---

## 📝 Notes

- Liveness detection (Question 2) currently is placeholder - integrate with face verification API (AWS Rekognition, Google ML Kit, etc.) for production
- All videos/audio are optional for hackathon - can be enhanced with actual recording
- HR review dashboard UI can be enhanced with video playback, annotation tools, etc.
- Document verification (OCR for Aadhar/PAN) can be added via AWS Textract or similar

---

## 📞 Support

For questions or issues, check:
1. Backend logs: `python main.py 8004` (foreground)
2. Browser console (F12) for frontend errors  
3. Database contents: `sqlite3 video_onboarding.db`

---

**Version**: 1.0.0  
**Last Updated**: April 2026  
**Status**: Ready for Hackathon Demo ✅
