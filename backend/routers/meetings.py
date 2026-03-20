"""FastAPI router — Meeting processing (transcript + audio upload)."""

import asyncio
import os
import tempfile
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile, HTTPException
import aiofiles

from models.schemas import ProcessTranscriptRequest, ProcessTranscriptResponse
from db.db import insert_meeting, update_meeting_status
from agents.orchestrator import run_pipeline

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.post("/process-transcript", response_model=ProcessTranscriptResponse)
async def process_transcript(
    req: ProcessTranscriptRequest,
    background_tasks: BackgroundTasks,
):
    """Process a meeting from a raw transcript string."""
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")

    run_id = uuid.uuid4().hex[:8]

    # Create meeting record
    try:
        meeting = insert_meeting(
            title=req.title,
            date=req.date,
            attendees=req.attendees,
            transcript=req.transcript,
        )
        meeting_id = meeting["id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # Run pipeline in background so API returns immediately
    background_tasks.add_task(
        _run_pipeline_bg,
        transcript=req.transcript,
        meeting_title=req.title,
        meeting_id=meeting_id,
        run_id=run_id,
    )

    return ProcessTranscriptResponse(
        run_id=run_id,
        meeting_id=meeting_id,
        message="Pipeline started — connect to WebSocket for live updates",
        status="RUNNING",
    )


@router.post("/process-audio", response_model=ProcessTranscriptResponse)
async def process_audio(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    title: str = Form("Untitled Meeting"),
    date: Optional[str] = Form(None),
    attendees: Optional[str] = Form(None),
):
    """Process a meeting from an uploaded audio file. Whisper will transcribe it."""
    run_id = uuid.uuid4().hex[:8]

    # Save audio file temporarily
    suffix = os.path.splitext(audio.filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    # Parse attendees from comma-separated string
    attendees_list = [a.strip() for a in attendees.split(",")] if attendees else []

    # Create meeting record
    try:
        meeting = insert_meeting(
            title=title,
            date=date,
            attendees=attendees_list,
            transcript="",  # Will be filled after transcription
        )
        meeting_id = meeting["id"]
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # Run pipeline in background
    background_tasks.add_task(
        _run_pipeline_bg,
        transcript="",
        meeting_title=title,
        meeting_id=meeting_id,
        run_id=run_id,
        audio_file_path=tmp_path,
    )

    return ProcessTranscriptResponse(
        run_id=run_id,
        meeting_id=meeting_id,
        message="Audio received — transcribing with Whisper, then running pipeline",
        status="RUNNING",
    )


def _run_pipeline_bg(
    transcript: str,
    meeting_title: str,
    meeting_id: str,
    run_id: str,
    audio_file_path: Optional[str] = None,
):
    """Background task wrapper for the pipeline."""
    try:
        result = run_pipeline(
            transcript=transcript,
            meeting_title=meeting_title,
            meeting_id=meeting_id,
            run_id=run_id,
            audio_file_path=audio_file_path,
        )
        update_meeting_status(meeting_id, "COMPLETED" if result.get("status") == "COMPLETED" else "FAILED")
    except Exception as e:
        print(f"[Pipeline BG] Error: {e}")
        update_meeting_status(meeting_id, "FAILED")
    finally:
        # Clean up temp audio file
        if audio_file_path and os.path.exists(audio_file_path):
            os.unlink(audio_file_path)
