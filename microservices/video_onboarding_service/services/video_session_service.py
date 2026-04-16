"""Service logic for Video Onboarding."""
from __future__ import annotations

import os
import json
from typing import Optional
from datetime import datetime, timezone
import requests

from config import UPLOAD_DIR, ORCHESTRATOR_SERVICE_URL, MAX_FILE_SIZE
from db.db import (
    create_video_session as db_create_session,
    get_video_session,
    record_answer,
    submit_for_hr_review as db_submit_hr,
    save_document_metadata,
    get_session_answers,
    complete_interview as db_complete,
    get_next_question as db_get_next,
    start_interview as db_start,
)


def create_video_session(employee_name: str, employee_id: str, employee_email: Optional[str] = None) -> dict:
    """Create a new video onboarding session with meet link."""
    return db_create_session(employee_name, employee_id, employee_email)


def generate_meet_link(session_id: str) -> str:
    """Generate a shareable meet link for the session."""
    return f"http://localhost:5173/video/interview/{session_id}"


def start_interview(session_id: str) -> bool:
    """Start the interview for a session."""
    return db_start(session_id)


def record_user_answer(session_id: str, question_id: int, answer_text: Optional[str] = None, duration_seconds: int = 0) -> dict:
    """Record user's answer to a question."""
    result = record_answer(session_id, question_id, answer_text, None, duration_seconds)
    
    # Get next question
    next_q = db_get_next(session_id)
    
    return {
        "success": True,
        "message": "Answer recorded",
        "next_question": dict(next_q) if next_q else None,
    }


def handle_document_upload(session_id: str, question_id: int, document_type: str, file_obj, file_name: str) -> dict:
    """Handle document upload (Aadhar, PAN, Address Proof)."""
    
    # Validate file size
    file_obj.seek(0, 2)  # Seek to end
    file_size = file_obj.tell()
    file_obj.seek(0)  # Reset
    
    if file_size > MAX_FILE_SIZE:
        return {"success": False, "error": f"File too large. Max size: {MAX_FILE_SIZE / 1024 / 1024}MB"}
    
    # Validate file extension
    allowed_extensions = {"pdf", "jpg", "jpeg", "png"}
    file_ext = os.path.splitext(file_name)[1].lower().lstrip(".")
    
    if file_ext not in allowed_extensions:
        return {"success": False, "error": f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"}
    
    # Create session-specific folder
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)
    
    # Save file with unique name
    file_base = os.path.splitext(file_name)[0]
    unique_file_name = f"{question_id}_{document_type}.{file_ext}"
    file_path = os.path.join(session_upload_dir, unique_file_name)
    
    # Write file
    with open(file_path, "wb") as f:
        f.write(file_obj.read())
    
    # Store relative path for serving via StaticFiles
    relative_path = f"/uploads/{session_id}/{unique_file_name}"
    
    # Save metadata with relative path
    save_document_metadata(session_id, question_id, document_type, unique_file_name, relative_path, file_size)
    
    # Record as answer with document path
    record_answer(session_id, question_id, None, None, 0, document_path=relative_path, document_type=document_type)
    
    # Get next question
    next_q = db_get_next(session_id)
    
    return {
        "success": True,
        "file_name": unique_file_name,
        "file_path": relative_path,
        "document_type": document_type,
        "message": "Document uploaded successfully",
        "next_question": dict(next_q) if next_q else None,
    }


def get_session_details(session_id: str) -> Optional[dict]:
    """Get complete session details with all answers."""
    session = get_video_session(session_id)
    
    if not session:
        return None
    
    answers = get_session_answers(session_id)
    
    session_dict = dict(session)
    session_dict["answers"] = answers
    session_dict["progress"] = (len(answers) / 10) * 100  # 10 total questions
    
    return session_dict


def submit_for_hr_review(session_id: str) -> dict:
    """Submit interview responses to HR review queue."""
    
    session = get_video_session(session_id)
    if not session:
        return {"success": False, "error": "Session not found"}
    
    answers = get_session_answers(session_id)
    
    # Complete the interview
    db_complete(session_id)
    
    # Prepare payload for HR review queue
    review_payload = {
        "task_id": session_id,
        "workflow": "video_onboarding",
        "employee_id": session["employee_id"],
        "employee_name": session["employee_name"],
        "employee_email": session["employee_email"],
        "status": "pending_review",
        "type": "hr_review",
        "data": {
            "session_id": session_id,
            "meet_link": session["meet_link"],
            "answers": answers,
            "completed_at": session["completed_at"],
            "duration_seconds": session["total_duration_seconds"],
        },
        "priority": "high",
        "assigned_to": "hr_team",
    }
    
    # Send to orchestrator/HR review queue
    try:
        response = requests.post(
            f"{ORCHESTRATOR_SERVICE_URL}/api/queue/add",
            json=review_payload,
            timeout=5
        )
        
        if response.status_code == 200:
            review_data = response.json()
            review_queue_id = review_data.get("queue_id", f"hrq-{session_id}")
            db_submit_hr(session_id, review_queue_id)
            
            return {
                "success": True,
                "message": "Session submitted for HR review",
                "review_queue_id": review_queue_id,
            }
        else:
            # Fallback: still mark as submitted even if queue fails
            review_queue_id = f"hrq-{session_id}"
            db_submit_hr(session_id, review_queue_id)
            return {
                "success": True,
                "message": "Session submitted for HR review (local queue)",
                "review_queue_id": review_queue_id,
            }
    except Exception as e:
        # Always fallback gracefully
        review_queue_id = f"hrq-{session_id}"
        db_submit_hr(session_id, review_queue_id)
        return {
            "success": True,
            "message": f"Session submitted for HR review (fallback mode): {str(e)}",
            "review_queue_id": review_queue_id,
        }


def get_next_question_for_session(session_id: str) -> Optional[dict]:
    """Get the next question to ask the user."""
    from db.db import get_next_question
    q = get_next_question(session_id)
    return dict(q) if q else None
