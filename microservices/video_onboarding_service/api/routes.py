"""FastAPI routes for Video Onboarding Service."""
from __future__ import annotations

import uuid
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from typing import Optional

from models.schemas import (
    CreateVideoSessionRequest,
    VideoSessionResponse,
    StartInterviewRequest,
    RecordAnswerRequest,
    SubmitForHRReviewRequest,
    SessionListResponse,
    SessionSummary,
    GroqDecisionRequest,
    GroqDecisionResponse,
)
from services.video_session_service import (
    create_video_session,
    generate_meet_link,
    start_interview,
    record_user_answer,
    handle_document_upload,
    get_session_details,
    submit_for_hr_review,
    get_next_question_for_session,
)
from db.db import (
    list_video_sessions, 
    get_all_questions, 
    get_video_session,
    get_all_question_sets,
    get_active_question_set,
    create_question_set,
    update_question_set,
    delete_question_set,
    activate_question_set,
    save_verification_photo,
    save_verification_signature,
    get_verification_data,
    delete_video_session,
    save_cv_age_estimate,
    save_age_verification,
)

from services.age_estimation import estimate_age_from_image_bytes
from services.groq_decision import get_decision_from_groq

from starlette.concurrency import run_in_threadpool

router = APIRouter(prefix="/api/video-onboarding", tags=["video_onboarding"])


# ──────────────────────────────────────────────────────────────────
# SESSION MANAGEMENT
# ──────────────────────────────────────────────────────────────────

@router.post("/sessions/create", response_model=VideoSessionResponse)
async def create_session(body: CreateVideoSessionRequest):
    """Create a new video onboarding session with meet link."""
    try:
        session = create_video_session(
            body.employee_name,
            body.employee_id,
            body.employee_email
        )
        
        return VideoSessionResponse(
            session_id=session["session_id"],
            employee_name=session["employee_name"],
            employee_id=session["employee_id"],
            meet_link=session["meet_link"],
            jitsi_room_id=session.get("jitsi_room_id"),
            status=session["status"],
            created_at=session["created_at"],
            questions_count=session["questions_count"],
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str):
    """Get complete session details with answers."""
    session = get_session_details(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    return session


@router.get("/sessions")
async def list_sessions(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """List video onboarding sessions."""
    from db.db import get_total_questions
    total_questions = get_total_questions() or 10
    sessions = list_video_sessions(employee_id, status, limit)
    
    return SessionListResponse(
        sessions=[
            SessionSummary(
                session_id=s["session_id"],
                employee_name=s["employee_name"],
                employee_id=s["employee_id"],
                status=s["status"],
                created_at=s["created_at"],
                completed_at=s["completed_at"],
                progress=(s["questions_answered"] / total_questions) * 100 if s["questions_answered"] else 0,
            )
            for s in sessions
        ],
        total=len(sessions),
    )


# ──────────────────────────────────────────────────────────────────
# INTERVIEW FLOW
# ──────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/start-interview")
async def start_interview_session(session_id: str):
    """Start the interview for a session."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    success = start_interview(session_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to start interview")
    
    # Get first question
    from db.db import get_all_questions
    questions = get_all_questions()
    first_question = questions[0] if questions else None
    
    return {
        "success": True,
        "message": "Interview started",
        "first_question": dict(first_question) if first_question else None,
        "total_questions": len(questions),
    }


@router.post("/sessions/{session_id}/decision", response_model=GroqDecisionResponse)
async def decision_for_session(session_id: str, body: GroqDecisionRequest):
    """Post-onboarding decision stage (calls Groq via raw HTTP)."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    payload = body.model_dump()
    decision = await run_in_threadpool(get_decision_from_groq, payload)
    return decision


@router.get("/sessions/{session_id}/next-question")
async def get_next_question(session_id: str):
    """Get the next question for the user."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    next_q = get_next_question_for_session(session_id)
    
    if not next_q:
        return {
            "next_question": None,
            "message": "All questions answered",
            "completed": True,
        }
    
    return {
        "next_question": dict(next_q),
        "completed": False,
    }


@router.post("/sessions/{session_id}/answer")
async def record_answer(session_id: str, body: RecordAnswerRequest):
    """Record user's answer to a question."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        result = record_user_answer(
            session_id,
            body.question_id,
            body.answer_text,
            body.duration_seconds or 0
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record answer: {str(e)}")


@router.post("/sessions/{session_id}/transcribe-audio")
async def transcribe_audio(
    session_id: str,
    question_id: int = Form(...),
    file: UploadFile = File(...),
):
    """Transcribe audio blob using Whisper and store transcript."""
    print(f"📝 Transcribe audio started: Q{question_id}")
    
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        audio_bytes = await file.read()
        print(f"📦 Audio received: {len(audio_bytes)} bytes")
        
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(status_code=400, detail="Audio file is empty or too small")
        
        # Import transcription service
        from services.transcription import transcribe_audio_blob
        from db.db import update_audio_transcript
        
        # Infer format from filename or default to webm
        audio_format = "webm"
        if file.filename:
            ext = os.path.splitext(file.filename.lower())[1]
            if ext and ext.startswith('.'):
                audio_format = ext[1:]
        
        # Transcribe using Whisper
        print(f"🎤 Transcribing with Whisper...")
        transcript = transcribe_audio_blob(audio_bytes, audio_format, run_id=session_id)
        print(f"✅ Transcription complete: {transcript[:100]}...")
        
        # Store transcript in database
        success = update_audio_transcript(session_id, question_id, transcript)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to store transcript in database")
        
        return {
            "success": True,
            "text": transcript,
            "char_count": len(transcript),
            "message": "Audio transcribed successfully",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# CV AGE ESTIMATION (Silent pre-question step)
# ──────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/cv-age-estimate")
async def cv_age_estimate(
    session_id: str,
    file: UploadFile = File(...),
):
    """Run CV age estimation on a single frame image (JPEG/PNG) and persist it."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        image_bytes = await file.read()
        if not image_bytes or len(image_bytes) < 100:
            raise HTTPException(status_code=400, detail="Image file is empty or too small")

        estimate = estimate_age_from_image_bytes(image_bytes)
        if not estimate:
            return {
                "success": True,
                "cv_estimated_age": None,
                "cv_age_range": None,
                "message": "No face detected",
            }

        save_cv_age_estimate(session_id, estimate.midpoint_age, estimate.age_range)

        return {
            "success": True,
            "cv_estimated_age": estimate.midpoint_age,
            "cv_age_range": estimate.age_range,
            "confidence_pct": estimate.confidence_pct,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"CV age estimation failed: {str(e)}")


@router.post("/sessions/{session_id}/age-verification")
async def persist_age_verification(
    session_id: str,
    body: dict,
):
    """Persist DOB-based age verification results for downstream risk engines."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    declared_age = body.get("declared_age")
    age_difference = body.get("age_difference")
    age_status = body.get("age_status")
    age_verification_flag = body.get("age_verification_flag")

    if declared_age is None or age_difference is None or not age_status:
        raise HTTPException(status_code=400, detail="declared_age, age_difference, and age_status are required")

    try:
        save_age_verification(
            session_id,
            int(declared_age),
            int(age_difference),
            str(age_status),
            str(age_verification_flag) if age_verification_flag is not None else None,
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to persist age verification: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# DOCUMENT UPLOAD
# ──────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/upload-document")
async def upload_document(
    session_id: str,
    question_id: int = Form(...),
    document_type: str = Form(...),  # "aadhar", "pan", "address_proof"
    file: UploadFile = File(...),
):
    """Upload a document (Aadhar, PAN, Address Proof, etc.)."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        file_content = await file.read()
        
        # Create a file-like object from bytes
        import io
        file_obj = io.BytesIO(file_content)
        
        result = handle_document_upload(
            session_id,
            question_id,
            document_type,
            file_obj,
            file.filename or "document"
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document upload failed: {str(e)}")


@router.post("/sessions/{session_id}/upload-audio")
async def upload_audio(
    session_id: str,
    question_id: int = Form(...),
    audio_duration_seconds: int = Form(...),
    duration_seconds: int = Form(...),
    file: UploadFile = File(...),
):
    """Upload an audio answer (WAV, MP3, WebM, or M4A) and transcribe with Whisper."""
    print(f"📤 Audio upload started: Q{question_id}, {audio_duration_seconds}s, duration={duration_seconds}s")
    
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        file_content = await file.read()
        print(f"📦 File received: {len(file_content)} bytes, MIME: {file.content_type}, Name: {file.filename}")
        
        if not file_content or len(file_content) < 100:
            raise HTTPException(status_code=400, detail="Audio file is empty or too small")
        
        # Accept multiple audio formats
        allowed_extensions = {'.wav', '.mp3', '.webm', '.m4a', '.ogg', '.flac'}
        file_ext = os.path.splitext(file.filename.lower())[1] if file.filename else ''
        
        if file_ext not in allowed_extensions:
            # Try to infer from mime type
            content_type = file.content_type or ''
            if 'audio' not in content_type:
                raise HTTPException(status_code=400, detail=f"Invalid file type: {file_ext or 'unknown'}. Allowed: {', '.join(allowed_extensions)}")
            # Default to webm if no extension
            file_ext = '.webm'
        
        from db.db import record_audio_answer, get_latest_audio_transcript
        
        # Create session-specific folder
        session_upload_dir = os.path.join("./uploads", session_id)
        os.makedirs(session_upload_dir, exist_ok=True)
        
        # Save file with unique name
        unique_file_name = f"q{question_id}_audio{file_ext}"
        file_path = os.path.join(session_upload_dir, unique_file_name)
        
        # Write file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        print(f"💾 File saved: {file_path}")
        
        # Prefer any transcript already generated by /transcribe-audio to avoid
        # double-transcription and accidental overwrites.
        existing_transcript = (get_latest_audio_transcript(session_id, question_id) or "").strip()

        audio_transcript = existing_transcript

        if not audio_transcript:
            # 🎤 TRANSCRIBE WITH WHISPER (shared service, cached model)
            print(f"🎤 Transcribing audio with Whisper...")
            try:
                from services.transcription import transcribe_audio_blob

                audio_format = (file_ext[1:] if file_ext.startswith(".") else file_ext) or "webm"
                audio_transcript = (transcribe_audio_blob(file_content, audio_format=audio_format, run_id=session_id) or "").strip()
                print(f"✅ Whisper transcription: {audio_transcript}")
            except Exception as e:
                print(f"⚠️ Whisper transcription failed: {str(e)}")
                audio_transcript = ""

        # If we had an existing transcript, never overwrite it with empty text.
        if not audio_transcript and existing_transcript:
            audio_transcript = existing_transcript
        
        # Store relative path for serving via StaticFiles
        relative_path = f"/uploads/{session_id}/{unique_file_name}"
        
        # Record in database WITH TRANSCRIPTION
        result = record_audio_answer(
            session_id,
            question_id,
            relative_path,
            audio_duration_seconds,
            duration_seconds,
            audio_transcript  # 🎤 Pass the transcript
        )
        
        print(f"✅ Audio answer recorded in DB: {relative_path}")
        
        # Get next question
        next_q = get_next_question_for_session(session_id)
        print(f"➡️ Next question: {next_q.get('question_id') if next_q else None}")
        
        return {
            "success": True,
            "file_name": unique_file_name,
            "file_path": relative_path,
            "file_size": len(file_content),
            "audio_duration_seconds": audio_duration_seconds,
            "audio_transcript": audio_transcript,  # 🎤 Return transcript to frontend
            "message": "Audio answer recorded and transcribed successfully",
            "next_question": dict(next_q) if next_q else None,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Audio upload failed: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# VERIFICATION UPLOADS (Photo & Signature)
# ──────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/upload-verification-photo")
async def upload_verification_photo(
    session_id: str,
    file: UploadFile = File(...),
):
    """Upload verification photo (JPEG/PNG from camera canvas)."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        file_content = await file.read()
        
        if not file_content or len(file_content) < 100:
            raise HTTPException(status_code=400, detail="Photo file is empty or too small")
        
        # Validate file type
        allowed_extensions = {'.jpg', '.jpeg', '.png'}
        file_ext = os.path.splitext(file.filename.lower())[1] if file.filename else '.jpg'
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: JPEG, PNG")
        
        # Create verification folder
        verification_dir = os.path.join("./uploads", session_id, "verification")
        os.makedirs(verification_dir, exist_ok=True)
        
        # Save file
        file_name = f"photo{file_ext}"
        file_path = os.path.join(verification_dir, file_name)
        
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Store relative path for serving
        relative_path = f"/uploads/{session_id}/verification/{file_name}"
        
        # Save to database
        result = save_verification_photo(session_id, relative_path)
        
        return {
            "success": True,
            "photo_path": relative_path,
            "file_size": len(file_content),
            "message": "Verification photo uploaded successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Photo upload failed: {str(e)}")


@router.post("/sessions/{session_id}/upload-verification-signature")
async def upload_verification_signature(
    session_id: str,
    file: UploadFile = File(...),
):
    """Upload verification signature (PDF/JPEG/PNG)."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        file_content = await file.read()
        
        if not file_content or len(file_content) < 100:
            raise HTTPException(status_code=400, detail="Signature file is empty or too small")
        
        # Validate file type
        allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png'}
        file_ext = os.path.splitext(file.filename.lower())[1] if file.filename else '.pdf'
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: PDF, JPEG, PNG")
        
        # Check file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
        
        # Create verification folder
        verification_dir = os.path.join("./uploads", session_id, "verification")
        os.makedirs(verification_dir, exist_ok=True)
        
        # Save file
        file_name = f"signature{file_ext}"
        file_path = os.path.join(verification_dir, file_name)
        
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Store relative path for serving
        relative_path = f"/uploads/{session_id}/verification/{file_name}"
        
        # Save to database
        result = save_verification_signature(session_id, relative_path)
        
        return {
            "success": True,
            "signature_path": relative_path,
            "file_size": len(file_content),
            "message": "Verification signature uploaded successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Signature upload failed: {str(e)}")


@router.get("/sessions/{session_id}/verification")
async def get_verification(session_id: str):
    """Get verification photo and signature for a session."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        verification = get_verification_data(session_id)
        
        if not verification:
            return {
                "success": True,
                "verification": None,
                "message": "No verification data found"
            }
        
        return {
            "success": True,
            "verification": dict(verification)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch verification data: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# SUBMISSION & HR REVIEW
# ──────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/submit-for-hr")
async def submit_for_hr(session_id: str, background_tasks: BackgroundTasks):
    """Submit interview session for HR review."""
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    try:
        result = submit_for_hr_review(session_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")


@router.get("/sessions/{session_id}/review-ready")
async def check_review_ready(session_id: str):
    """Check if session is ready for HR review."""
    session = get_session_details(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    return {
        "session_id": session_id,
        "ready": session["progress"] >= 100,
        "progress": session["progress"],
        "total_answers": session["questions_answered"],
        "total_questions": len(session["answers"]),
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a video session and all associated data."""
    # Check if session exists first
    session = get_video_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    # Delete the session
    success = delete_video_session(session_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete session")
    
    return {
        "success": True,
        "message": f"Session {session_id} deleted successfully"
    }


# ──────────────────────────────────────────────────────────────────
# QUESTIONS
# ──────────────────────────────────────────────────────────────────

@router.get("/questions")
async def get_all_interview_questions():
    """Get all interview questions."""
    try:
        questions = get_all_questions()
        return {
            "total": len(questions),
            "questions": [dict(q) for q in questions],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# QUESTION SETS (HR Question Builder)
# ──────────────────────────────────────────────────────────────────

@router.get("/question-sets")
async def get_question_sets():
    """Get all question sets."""
    try:
        sets = get_all_question_sets()
        return {
            "total": len(sets),
            "sets": sets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch question sets: {str(e)}")


@router.post("/question-sets/create")
async def create_new_question_set(body: dict):
    """Create a new question set."""
    try:
        name = body.get("name", "").strip()
        questions = body.get("questions", [])
        
        if not name:
            raise HTTPException(status_code=400, detail="Set name is required")
        if len(questions) == 0:
            raise HTTPException(status_code=400, detail="At least 1 question is required")
        if len(questions) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 questions allowed")
        
        # Validate questions
        for q in questions:
            if not q.get("question_text", "").strip():
                raise HTTPException(status_code=400, detail="All questions must have text")
            if q.get("question_type") not in ["document_upload", "yes_no", "audio"]:
                raise HTTPException(status_code=400, detail="Invalid question type")
        
        set_id = create_question_set(name, questions)
        
        return {
            "success": True,
            "set_id": set_id,
            "message": f"Question set '{name}' created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create question set: {str(e)}")


@router.put("/question-sets/{set_id}")
async def update_question_set_route(set_id: str, body: dict):
    """Update an existing question set."""
    try:
        name = body.get("name", "").strip()
        questions = body.get("questions", [])
        
        if not name:
            raise HTTPException(status_code=400, detail="Set name is required")
        if len(questions) == 0:
            raise HTTPException(status_code=400, detail="At least 1 question is required")
        if len(questions) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 questions allowed")
        
        # Validate questions
        for q in questions:
            if not q.get("question_text", "").strip():
                raise HTTPException(status_code=400, detail="All questions must have text")
            if q.get("question_type") not in ["document_upload", "yes_no", "audio"]:
                raise HTTPException(status_code=400, detail="Invalid question type")
        
        success = update_question_set(set_id, name, questions)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update question set")
        
        return {
            "success": True,
            "message": f"Question set '{name}' updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update question set: {str(e)}")


@router.delete("/question-sets/{set_id}")
async def delete_question_set_route(set_id: str):
    """Delete a question set."""
    try:
        success = delete_question_set(set_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete question set")
        
        return {
            "success": True,
            "message": "Question set deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete question set: {str(e)}")


@router.post("/question-sets/{set_id}/activate")
async def activate_question_set_route(set_id: str):
    """Activate a question set."""
    try:
        success = activate_question_set(set_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to activate question set")
        
        return {
            "success": True,
            "message": "Question set activated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to activate question set: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "Video Onboarding API", "version": "1.0.0"}
