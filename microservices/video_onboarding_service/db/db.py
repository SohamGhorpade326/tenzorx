"""Database helpers for Video Onboarding Service."""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional, List
import uuid

from config import DB_PATH, UPLOAD_DIR


# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_db_path() -> str:
    return DB_PATH


def _connect() -> sqlite3.Connection:
    """Create and return a database connection."""
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database schema."""
    conn = _connect()
    cur = conn.cursor()
    
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        schema = f.read()
    
    cur.executescript(schema)
    
    # Handle migrations: Add jitsi_room_id column if it doesn't exist
    try:
        cur.execute("ALTER TABLE video_sessions ADD COLUMN jitsi_room_id TEXT")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e).lower() and "already exists" not in str(e).lower():
            print(f"Migration info: {e}")
    
    # Handle migrations: Add audio columns to answer_records if they don't exist
    try:
        cur.execute("ALTER TABLE answer_records ADD COLUMN audio_path TEXT")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e).lower() and "already exists" not in str(e).lower():
            print(f"Migration info (audio_path): {e}")
    
    try:
        cur.execute("ALTER TABLE answer_records ADD COLUMN audio_duration_seconds INTEGER")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e).lower() and "already exists" not in str(e).lower():
            print(f"Migration info (audio_duration_seconds): {e}")
    
    # Insert predefined questions
    _insert_predefined_questions(cur)
    
    conn.commit()
    conn.close()


def _insert_predefined_questions(cur: sqlite3.Cursor):
    """Insert the 10 predefined onboarding questions.
    
    Q1-Q2: Document upload (Aadhar, PAN)
    Q3-Q10: Audio with Whisper transcription (all text-based via audio)
    """
    questions = [
        # Q1-Q2: Document Upload only
        (1, "Please upload your Aadhar Card for identity verification", "document_upload", "Identity Verification", True, 1, "aadhar", 120),
        (2, "Please upload your PAN Card for tax verification", "document_upload", "Tax Verification", True, 2, "pan", 120),
        
        # Q3-Q10: Audio with Whisper transcription (no more yes_no questions)
        (3, "Have you read and understood the company policies and code of conduct? Please respond with yes or no.", "audio", "Compliance", True, 3, None, 90),
        (4, "Do you agree to comply with all company rules, confidentiality terms, and data security policies? Please confirm.", "audio", "Compliance", True, 4, None, 90),
        (5, "Please confirm your full name, role, and department you are joining", "audio", "Onboarding", True, 5, None, 90),
        (6, "Confirm your current address and contact details for company records", "audio", "Onboarding", True, 6, None, 90),
        (7, "Are you aware of your joining date, reporting manager, and work location? Please confirm", "audio", "Onboarding", True, 7, None, 90),
        (8, "Do you have any ongoing commitments or notice period details that HR should be aware of?", "audio", "Onboarding", True, 8, None, 90),
        (9, "Do you require any special accommodations, equipment, or support from the company?", "audio", "Onboarding", True, 9, None, 90),
        (10, "Please confirm that all information and documents provided by you are accurate and genuine", "audio", "Onboarding", False, 10, None, 90),
    ]
    
    for q in questions:
        cur.execute("""
            INSERT OR IGNORE INTO interview_questions 
            (question_id, question_text, question_type, category, required, "order", document_type, timer_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, q)


# ──────────────────────────────────────────────────────────────────
# VIDEO SESSIONS
# ──────────────────────────────────────────────────────────────────

def create_video_session(employee_name: str, employee_id: str, employee_email: Optional[str] = None) -> dict:
    """Create a new video onboarding session."""
    conn = _connect()
    cur = conn.cursor()
    
    session_id = uuid.uuid4().hex[:12]
    meet_link = f"http://localhost:5173/video/meet/{session_id}"
    jitsi_room_id = f"onboarding_{session_id}"
    
    cur.execute("""
        INSERT INTO video_sessions 
        (session_id, employee_name, employee_id, employee_email, meet_link, jitsi_room_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'created')
    """, (session_id, employee_name, employee_id, employee_email, meet_link, jitsi_room_id))
    
    _log_audit(cur, session_id, "session_created", f"Session created for {employee_name} - Jitsi room: {jitsi_room_id}")
    
    conn.commit()
    conn.close()
    
    return {
        "session_id": session_id,
        "employee_name": employee_name,
        "employee_id": employee_id,
        "meet_link": meet_link,
        "jitsi_room_id": jitsi_room_id,
        "status": "created",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "questions_count": 10,
    }


def get_video_session(session_id: str) -> Optional[dict]:
    """Get session details by ID."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM video_sessions WHERE session_id = ?", (session_id,))
    row = cur.fetchone()
    conn.close()
    
    return dict(row) if row else None


def list_video_sessions(employee_id: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> List[dict]:
    """List video sessions with optional filters."""
    conn = _connect()
    cur = conn.cursor()
    
    query = "SELECT * FROM video_sessions WHERE 1=1"
    params = []
    
    if employee_id:
        query += " AND employee_id = ?"
        params.append(employee_id)
    
    if status:
        query += " AND status = ?"
        params.append(status)
    
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def start_interview(session_id: str) -> bool:
    """Mark session as in_progress."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
        UPDATE video_sessions 
        SET status = 'in_progress', started_at = ?
        WHERE session_id = ?
    """, (now, session_id))
    
    _log_audit(cur, session_id, "interview_started", "Interview started")
    
    conn.commit()
    conn.close()
    
    return cur.rowcount > 0


def complete_interview(session_id: str) -> bool:
    """Mark session as completed."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate total duration
    cur.execute("""
        SELECT SUM(duration_seconds) as total_duration
        FROM answer_records
        WHERE session_id = ?
    """, (session_id,))
    
    result = cur.fetchone()
    total_duration = result["total_duration"] or 0
    
    cur.execute("""
        UPDATE video_sessions 
        SET status = 'completed', completed_at = ?, total_duration_seconds = ?
        WHERE session_id = ?
    """, (now, total_duration, session_id))
    
    _log_audit(cur, session_id, "interview_completed", "Interview completed")
    
    conn.commit()
    conn.close()
    
    return cur.rowcount > 0


# ──────────────────────────────────────────────────────────────────
# ANSWERS
# ──────────────────────────────────────────────────────────────────

def record_answer(session_id: str, question_id: int, answer_text: Optional[str] = None, 
                 video_url: Optional[str] = None, duration_seconds: int = 0,
                 document_path: Optional[str] = None, document_type: Optional[str] = None) -> dict:
    """Record an answer to a question."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cur.execute("""
        INSERT INTO answer_records 
        (session_id, question_id, answer_text, video_url, answered_at, duration_seconds, document_path, document_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (session_id, question_id, answer_text, video_url, now, duration_seconds, document_path, document_type))
    
    # Update questions_answered count
    cur.execute("""
        UPDATE video_sessions
        SET questions_answered = (
            SELECT COUNT(*) FROM answer_records WHERE session_id = ?
        )
        WHERE session_id = ?
    """, (session_id, session_id))
    
    _log_audit(cur, session_id, "answer_recorded", f"Answer recorded for question {question_id}")
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "Answer recorded successfully"}


def update_answer_with_audio(session_id: str, question_id: int, audio_path: str, 
                            audio_duration_seconds: int = 0, duration_seconds: int = 0) -> dict:
    """Update an existing answer with audio path."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE answer_records
        SET audio_path = ?, audio_duration_seconds = ?
        WHERE session_id = ? AND question_id = ?
    """, (audio_path, audio_duration_seconds, session_id, question_id))
    
    _log_audit(cur, session_id, "audio_answer_recorded", f"Audio updated for Q{question_id}: {audio_path}")
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "Audio answer recorded successfully", "audio_path": audio_path}


def record_audio_answer(session_id: str, question_id: int, audio_path: str, 
                       audio_duration_seconds: int = 0, duration_seconds: int = 0, 
                       audio_transcript: str = "") -> dict:
    """Record an audio answer to a question with optional Whisper transcription."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cur.execute("""
        INSERT INTO answer_records 
        (session_id, question_id, audio_path, audio_duration_seconds, audio_transcript, answered_at, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (session_id, question_id, audio_path, audio_duration_seconds, audio_transcript, now, duration_seconds))
    
    # Update questions_answered count
    cur.execute("""
        UPDATE video_sessions
        SET questions_answered = (
            SELECT COUNT(*) FROM answer_records WHERE session_id = ?
        )
        WHERE session_id = ?
    """, (session_id, session_id))
    
    _log_audit(cur, session_id, "audio_answer_recorded", f"Audio answer recorded for Q{question_id}: {audio_path}")
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "Audio answer recorded successfully", "audio_path": audio_path, "transcript": audio_transcript}


def update_audio_transcript(session_id: str, question_id: int, transcript: str) -> bool:
    """Update the Whisper-generated transcript for an audio answer."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE answer_records 
        SET audio_transcript = ?
        WHERE session_id = ? AND question_id = ?
    """, (transcript, session_id, question_id))
    
    _log_audit(cur, session_id, "audio_transcribed", f"Audio transcribed for Q{question_id}: {transcript[:100]}...")
    
    conn.commit()
    conn.close()
    
    return cur.rowcount > 0


def get_session_answers(session_id: str) -> List[dict]:
    """Get all answers for a session, including unanswered questions."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            iq.question_id,
            iq.question_text,
            iq.question_type,
            iq.category,
            iq.required,
            iq."order",
            iq.document_type,
            ar.answer_id,
            ar.answer_text,
            ar.audio_path,
            ar.audio_transcript,
            ar.audio_duration_seconds,
            ar.document_path,
            ar.video_url,
            ar.answered_at,
            ar.duration_seconds
        FROM interview_questions iq
        LEFT JOIN answer_records ar ON ar.question_id = iq.question_id 
            AND ar.session_id = ?
        ORDER BY iq."order"
    """, (session_id,))
    
    rows = cur.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


# ──────────────────────────────────────────────────────────────────
# DOCUMENTS
# ──────────────────────────────────────────────────────────────────

def save_document_metadata(session_id: str, question_id: int, document_type: str, 
                          file_name: str, file_path: str, file_size: int) -> dict:
    """Save document upload metadata."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cur.execute("""
        INSERT INTO documents 
        (session_id, question_id, document_type, file_name, file_path, file_size, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (session_id, question_id, document_type, file_name, file_path, file_size, now))
    
    _log_audit(cur, session_id, "document_uploaded", f"Document uploaded: {document_type}")
    
    conn.commit()
    conn.close()
    
    return {"file_name": file_name, "file_path": file_path, "timestamp": now}


def get_session_documents(session_id: str) -> List[dict]:
    """Get all documents for a session."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT * FROM documents 
        WHERE session_id = ?
        ORDER BY uploaded_at
    """, (session_id,))
    
    rows = cur.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


# ──────────────────────────────────────────────────────────────────
# QUESTIONS
# ──────────────────────────────────────────────────────────────────

def get_all_questions() -> List[dict]:
    """Get all interview questions.
    
    If an active question set exists, return questions from that set.
    Otherwise, return default predefined questions from interview_questions table.
    """
    # Check for active question set
    active_set = get_active_question_set()
    
    if active_set and active_set['questions']:
        # Return questions from active set, formatted to match interview_questions structure
        questions = []
        for idx, q in enumerate(active_set['questions']):
            questions.append({
                'question_id': q.get('id', idx + 1),  # Use DB id or fallback to order
                'question_text': q['question_text'],
                'question_type': q['question_type'],
                'required': q['required'],
                'timer_seconds': q['timer_seconds'],
                'document_type': q.get('document_type'),
                'category': 'custom',  # Mark as custom question set
                'order': q['order']
            })
        return questions
    
    # Fall back to default questions
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM interview_questions ORDER BY \"order\"")
    rows = cur.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def get_question(question_id: int) -> Optional[dict]:
    """Get a specific question."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM interview_questions WHERE question_id = ?", (question_id,))
    row = cur.fetchone()
    conn.close()
    
    return dict(row) if row else None


def get_next_question(session_id: str) -> Optional[dict]:
    """Get the next unanswered question for a session."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT * FROM interview_questions iq
        WHERE iq.question_id NOT IN (
            SELECT question_id FROM answer_records WHERE session_id = ?
        )
        ORDER BY iq."order"
        LIMIT 1
    """, (session_id,))
    
    row = cur.fetchone()
    conn.close()
    
    return dict(row) if row else None


# ──────────────────────────────────────────────────────────────────
# SUBMISSION & HR REVIEW
# ──────────────────────────────────────────────────────────────────

def submit_for_hr_review(session_id: str, review_queue_id: str) -> bool:
    """Mark session as submitted for HR review."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
        UPDATE video_sessions
        SET status = 'submitted', submitted_at = ?, review_queue_id = ?
        WHERE session_id = ?
    """, (now, review_queue_id, session_id))
    
    _log_audit(cur, session_id, "session_submitted", f"Session submitted for HR review. Queue ID: {review_queue_id}")
    
    conn.commit()
    conn.close()
    
    return cur.rowcount > 0


# ──────────────────────────────────────────────────────────────────
# VERIFICATION (Photo & Signature)
# ──────────────────────────────────────────────────────────────────

def save_verification_photo(session_id: str, photo_path: str) -> dict:
    """Save verification photo path to candidate_verification table."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Try to insert, or update if session already exists
    cur.execute("""
        INSERT INTO candidate_verification (session_id, photo_path, photo_uploaded_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET 
            photo_path = excluded.photo_path,
            photo_uploaded_at = excluded.photo_uploaded_at,
            updated_at = excluded.updated_at
    """, (session_id, photo_path, now, now, now))
    
    _log_audit(cur, session_id, "verification_photo_saved", f"Photo saved: {photo_path}")
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Verification photo saved successfully",
        "photo_path": photo_path,
        "uploaded_at": now
    }


def save_verification_signature(session_id: str, signature_path: str) -> dict:
    """Save verification signature path to candidate_verification table."""
    conn = _connect()
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Try to insert, or update if session already exists
    cur.execute("""
        INSERT INTO candidate_verification (session_id, signature_path, signature_uploaded_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET 
            signature_path = excluded.signature_path,
            signature_uploaded_at = excluded.signature_uploaded_at,
            updated_at = excluded.updated_at
    """, (session_id, signature_path, now, now, now))
    
    _log_audit(cur, session_id, "verification_signature_saved", f"Signature saved: {signature_path}")
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Verification signature saved successfully",
        "signature_path": signature_path,
        "uploaded_at": now
    }


def get_verification_data(session_id: str) -> Optional[dict]:
    """Get verification photo and signature data for a session."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT * FROM candidate_verification WHERE session_id = ?
    """, (session_id,))
    
    row = cur.fetchone()
    conn.close()
    
    return dict(row) if row else None


# ──────────────────────────────────────────────────────────────────
# AUDIT LOG
# ──────────────────────────────────────────────────────────────────

def _log_audit(cur: sqlite3.Cursor, session_id: str, action: str, details: str = ""):
    """Log an audit event."""
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
        INSERT INTO audit_log (session_id, action, details, timestamp)
        VALUES (?, ?, ?, ?)
    """, (session_id, action, details, now))


def get_audit_log(session_id: str) -> List[dict]:
    """Get audit log for a session."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT * FROM audit_log
        WHERE session_id = ?
        ORDER BY timestamp
    """, (session_id,))
    
    rows = cur.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


# QUESTION SETS (HR Custom Question Lists)
# ──────────────────────────────────────────────────────────────────

def get_all_question_sets() -> List[dict]:
    """Get all question sets with their questions."""
    conn = _connect()
    cur = conn.cursor()
    
    # Get all sets
    cur.execute("""
        SELECT set_id, name, is_active 
        FROM question_sets 
        ORDER BY name
    """)
    
    sets = cur.fetchall()
    result = []
    
    for set_row in sets:
        set_id = set_row['set_id']
        
        # Get questions in this set
        cur.execute("""
            SELECT id, set_id, question_text, question_type, required, 
                   timer_seconds, document_type, "order"
            FROM question_set_items
            WHERE set_id = ?
            ORDER BY "order"
        """, (set_id,))
        
        questions = [dict(q) for q in cur.fetchall()]
        
        result.append({
            'set_id': set_row['set_id'],
            'name': set_row['name'],
            'is_active': bool(set_row['is_active']),
            'questions': questions
        })
    
    conn.close()
    return result


def get_active_question_set() -> Optional[dict]:
    """Get the currently active question set."""
    conn = _connect()
    cur = conn.cursor()
    
    cur.execute("SELECT set_id, name FROM question_sets WHERE is_active = 1 LIMIT 1")
    active_set = cur.fetchone()
    
    if not active_set:
        conn.close()
        return None
    
    set_id = active_set['set_id']
    
    # Get questions in this set
    cur.execute("""
        SELECT id, set_id, question_text, question_type, required, 
               timer_seconds, document_type, "order"
        FROM question_set_items
        WHERE set_id = ?
        ORDER BY "order"
    """, (set_id,))
    
    questions = [dict(q) for q in cur.fetchall()]
    conn.close()
    
    return {
        'set_id': active_set['set_id'],
        'name': active_set['name'],
        'is_active': True,
        'questions': questions
    }


def create_question_set(name: str, questions: List[dict]) -> str:
    """Create a new question set."""
    conn = _connect()
    cur = conn.cursor()
    
    set_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Insert set
    cur.execute("""
        INSERT INTO question_sets (set_id, name, is_active, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
    """, (set_id, name, now, now))
    
    # Insert questions
    for idx, q in enumerate(questions):
        cur.execute("""
            INSERT INTO question_set_items 
            (set_id, question_text, question_type, required, timer_seconds, 
             document_type, "order", created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            set_id,
            q['question_text'],
            q['question_type'],
            q.get('required', True),
            q.get('timer_seconds', 240),
            q.get('document_type'),
            idx,
            now
        ))
    
    conn.commit()
    conn.close()
    
    return set_id


def update_question_set(set_id: str, name: str, questions: List[dict]) -> bool:
    """Update an existing question set."""
    conn = _connect()
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        # Update set name
        cur.execute("""
            UPDATE question_sets 
            SET name = ?, updated_at = ?
            WHERE set_id = ?
        """, (name, now, set_id))
        
        # Delete old questions
        cur.execute("DELETE FROM question_set_items WHERE set_id = ?", (set_id,))
        
        # Insert new questions
        for idx, q in enumerate(questions):
            cur.execute("""
                INSERT INTO question_set_items 
                (set_id, question_text, question_type, required, timer_seconds, 
                 document_type, "order", created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                set_id,
                q['question_text'],
                q['question_type'],
                q.get('required', True),
                q.get('timer_seconds', 240),
                q.get('document_type'),
                idx,
                now
            ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating question set: {e}")
        conn.close()
        return False


def delete_question_set(set_id: str) -> bool:
    """Delete a question set."""
    conn = _connect()
    cur = conn.cursor()
    
    try:
        cur.execute("DELETE FROM question_set_items WHERE set_id = ?", (set_id,))
        cur.execute("DELETE FROM question_sets WHERE set_id = ?", (set_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error deleting question set: {e}")
        conn.close()
        return False


def activate_question_set(set_id: str) -> bool:
    """Activate a question set (deactivate others)."""
    conn = _connect()
    cur = conn.cursor()
    
    try:
        # Deactivate all sets
        cur.execute("UPDATE question_sets SET is_active = 0")
        # Activate the selected set
        cur.execute("UPDATE question_sets SET is_active = 1 WHERE set_id = ?", (set_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error activating question set: {e}")
        conn.close()
        return False
