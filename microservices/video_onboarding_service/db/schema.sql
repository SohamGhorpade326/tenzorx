-- Video Onboarding Database Schema

-- Interview Questions Table
CREATE TABLE IF NOT EXISTS interview_questions (
    question_id INTEGER PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,  -- document_upload (Q1-Q2), audio (Q3-Q10)
    category TEXT NOT NULL,
    required BOOLEAN DEFAULT 1,
    "order" INTEGER NOT NULL,
    document_type TEXT,  -- aadhar, pan, address_proof (for Q1-Q2 only)
    timer_seconds INTEGER DEFAULT 240,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video Sessions Table
CREATE TABLE IF NOT EXISTS video_sessions (
    session_id TEXT PRIMARY KEY,
    employee_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_email TEXT,
    meet_link TEXT NOT NULL UNIQUE,
    jitsi_room_id TEXT UNIQUE,  -- Jitsi room identifier
    status TEXT DEFAULT 'created',  -- created, in_progress, completed, submitted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    submitted_at TIMESTAMP,
    review_queue_id TEXT,
    total_duration_seconds INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0
);

-- Answer Records Table
CREATE TABLE IF NOT EXISTS answer_records (
    answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    answer_text TEXT,
    audio_transcript TEXT,  -- Whisper-generated transcription of audio answer
    audio_path TEXT,  -- Path to audio file (.wav/.mp3/.webm)
    audio_duration_seconds INTEGER,  -- Duration of recorded audio
    document_path TEXT,
    document_type TEXT,
    video_url TEXT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,  -- Time spent on question
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id),
    FOREIGN KEY (question_id) REFERENCES interview_questions(question_id)
);

-- Document Storage Metadata
CREATE TABLE IF NOT EXISTS documents (
    document_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,  -- aadhar, pan, address_proof
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    action TEXT NOT NULL,  -- session_created, interview_started, answer_recorded, document_uploaded, session_submitted
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id)
);

-- Question Sets (for HR to create custom question lists)
CREATE TABLE IF NOT EXISTS question_sets (
    set_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Question Set Items (individual questions in a set)
CREATE TABLE IF NOT EXISTS question_set_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,  -- document_upload, yes_no, audio
    required BOOLEAN DEFAULT 1,
    timer_seconds INTEGER DEFAULT 240,
    document_type TEXT,  -- aadhar, pan, address_proof (for document_upload only)
    "order" INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES question_sets(set_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_employee_id ON video_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON video_sessions(status);
CREATE INDEX IF NOT EXISTS idx_answers_session_id ON answer_records(session_id);
CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_session_id ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_active ON question_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_question_set_items_set_id ON question_set_items(set_id);

-- Candidate Verification (Photo + Signature)
CREATE TABLE IF NOT EXISTS candidate_verification (
    verification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    photo_path TEXT,  -- Path to captured photo
    photo_uploaded_at TIMESTAMP,
    signature_path TEXT,  -- Path to uploaded signature
    signature_uploaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verification_session_id ON candidate_verification(session_id);
