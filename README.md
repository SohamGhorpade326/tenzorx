# 🚀 LoanPilot  
### AI-Powered Video Loan Onboarding & Risk Assessment System

---

## 📌 Overview

LoanPilot is an **agentic AI-powered video onboarding system** that transforms traditional loan applications into a **real-time conversational experience**.

Instead of filling long forms, users interact with an AI agent over a live video session, where their data is captured, validated, and processed instantly to generate **loan eligibility decisions and personalized offers**.

---

## 🎯 Problem Statement

Digital loan onboarding today suffers from:
- ❌ Long, form-based applications  
- ❌ High drop-off rates (~40%)  
- ❌ Manual KYC delays  
- ❌ Fraud due to identity misrepresentation  

---

## 💡 Solution

LoanPilot replaces static workflows with a **dynamic AI-driven pipeline**:

- 🎥 **Video-based onboarding**
- 🤖 **Agent-driven conversational flow**
- 🧠 **Real-time validation & decisioning**
- ⚡ **Instant loan eligibility & offer generation**

---

## 🏗️ System Architecture (High-Level)

**User → Video Interaction → AI Processing → Validation → Decision → Output**

### Key Layers:
1. **User Entry Layer**  
   Secure onboarding via link (SMS / WhatsApp / Email)

2. **AI Interaction Layer**  
   Conversational agent captures user data dynamically

3. **Validation Layer**  
   - Age estimation via Computer Vision  
   - Document verification  
   - Input consistency checks  

4. **Decision Layer**  
   - Risk assessment  
   - Eligibility evaluation  
   - AI + rule-based logic  

5. **Output Layer**  
   - Eligible / Conditional / Not Eligible  
   - Personalized loan offers  

---

## 🔁 Product Flow

1. User clicks onboarding link  
2. Video session starts instantly  
3. AI agent conducts onboarding conversation  
4. User uploads required documents  
5. System validates data in real time  
6. AI detects inconsistencies and asks follow-ups  
7. Risk & eligibility evaluated  
8. Final decision displayed  
9. Data stored securely for audit  

---

## 🤖 Key Features

- 🎤 **Speech-to-Text (Whisper)** for real-time transcription  
- 🧑‍💻 **Computer Vision** for age estimation  
- 🧠 **LLM-based decision engine (Groq API)**  
- 📄 **Document upload & verification**  
- 🔄 **Adaptive questioning (agentic behavior)**  
- ⚡ **Real-time onboarding & decisioning**

---

## 🧠 Why Agentic AI?

- Dynamic, conversational onboarding instead of static forms  
- Adaptive follow-ups based on user responses  
- Multi-modal orchestration (STT + CV + LLM)  
- Real-time decision-making pipeline  

---

## 🛠️ Tech Stack

**Frontend**
- React.js (or your framework)
- WebRTC for video streaming

**Backend**
- Python (FastAPI / Flask)

**AI/ML**
- Whisper (Speech-to-Text)
- OpenCV DNN Pipeline (Age Estimation)
- Groq LLM (Decisioning)

**Other**
- REST APIs
- Local/Cloud Storage

---

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/your-repo/loanpilot.git
cd loanpilot
```

### 2. Install dependencies
```
pip install -r requirements.txt
npm install
```

### 3. Set environment variables in .env
```
GROQ_API_KEY=your_api_key_here
WHISPER_MODEL_SIZE=base
```

### 4. Run Frontend
```
cd frontend
npm run dev
```

### 5. Run Video Onboarding service
```
cd microservices\video_onboarding_service
python -m uvicorn main:app --host 0.0.0.0 --port 8004 --reload
```

---

## 🧪 Demo Flow

- Go to Interview Records (this page is made only for testing purposes)
- Click “Create New Interview” 
- Video onboarding session begins
- AI agent asks questions
- User responds via voice
- Documents uploaded
- Final decision generated

👉 In production, this flow is triggered via a WhatsApp/SMS onboarding link

---

## 📊 Decision Output

The system classifies users into:

- ✅ Eligible → Loan offer generated
- ⚠️ Conditionally Eligible → Additional verification required
- ❌ Not Eligible → Reason provided

---

## 🔒 Compliance & Security

- Video + transcript logging
- Consent capture
- Audit-ready storage
- Fraud signal detection (age mismatch, data inconsistency)

---

## 🚀 Future Improvements

- Real-time streaming transcription (instead of blob-based)
- Advanced fraud detection (face match, liveness detection)
- Credit bureau integration
- Multi-language support
- Production-grade deployment
- Meeting Intelligence for Assisted Onboarding
- Orchestrator Agent to handle other worker agents.

---

# 👥 Made by Team Neural Notwork
