"""Pydantic models for Video Onboarding Service."""
from __future__ import annotations
from typing import Any, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


# ── Interview Question Definition ──────────────────────────────────

class InterviewQuestion(BaseModel):
    question_id: int
    question_text: str
    question_type: str  # "text", "yes_no", "document_upload", "multiple_choice"
    category: str
    required: bool = True
    order: int
    document_type: Optional[str] = None  # "aadhar", "pan", "address_proof"
    timer_seconds: int = 240  # 4 minutes default


# ── Video Session Management ───────────────────────────────────────

class CreateVideoSessionRequest(BaseModel):
    employee_name: str = Field(..., min_length=1)
    employee_id: str = Field(..., min_length=1)
    employee_email: Optional[str] = None


class VideoSessionResponse(BaseModel):
    session_id: str
    employee_name: str
    employee_id: str
    meet_link: str
    jitsi_room_id: Optional[str] = None
    status: str  # "created", "in_progress", "completed", "submitted"
    created_at: str
    questions_count: int


class StartInterviewRequest(BaseModel):
    session_id: str


# ── Answer Recording ──────────────────────────────────────────────

class RecordAnswerRequest(BaseModel):
    question_id: int
    answer_text: Optional[str] = None
    video_url: Optional[str] = None  # For future video recording support
    timestamp: Optional[str] = None
    duration_seconds: Optional[int] = None  # Duration of answer in seconds


class RecordAnswerResponse(BaseModel):
    success: bool
    message: str
    next_question_id: Optional[int] = None


# ── Document Upload ───────────────────────────────────────────────

class DocumentUploadResponse(BaseModel):
    success: bool
    file_name: str
    file_path: str
    document_type: str
    timestamp: str


# ── Question Answer Pair ───────────────────────────────────────────

class QuestionAnswerPair(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    answer_text: Optional[str] = None
    document_path: Optional[str] = None
    document_type: Optional[str] = None
    answered_at: str
    duration_seconds: int


# ── Session Review ───────────────────────────────────────────────

class VideoSessionDetailResponse(BaseModel):
    session_id: str
    employee_name: str
    employee_id: str
    employee_email: Optional[str]
    meet_link: str
    status: str
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    total_duration_seconds: int
    questions_answered: int
    total_questions: int
    answers: List[QuestionAnswerPair]


class SubmitForHRReviewRequest(BaseModel):
    session_id: str


class SubmitForHRReviewResponse(BaseModel):
    success: bool
    message: str
    review_queue_id: str


# ── Session List ────────────────────────────────────────────────

class SessionSummary(BaseModel):
    session_id: str
    employee_name: str
    employee_id: str
    status: str
    created_at: str
    completed_at: Optional[str]
    progress: float  # 0-100%


class SessionListResponse(BaseModel):
    sessions: List[SessionSummary]
    total: int
