/**
 * API client for Video Onboarding Service.
 * Base URL: /api/video-onboarding (through Nginx proxy)
 */

const VIDEO_API_BASE = (import.meta.env.VITE_VIDEO_API_URL || '/api/video-onboarding').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${VIDEO_API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({detail: res.statusText}));
    throw new Error(err.detail || `API Error ${res.status}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────
// Video Onboarding API
// ─────────────────────────────────────────────────

export interface VideoSessionCreateRequest {
  employee_name: string;
  employee_id: string;
  employee_email?: string;
}

export interface VideoSessionResponse {
  session_id: string;
  employee_name: string;
  employee_id: string;
  meet_link: string;
  jitsi_room_id?: string;
  status: string;
  created_at: string;
  questions_count: number;
}

export interface AnswerDetail {
  question_id: number;
  question_text: string;
  question_type: string;
  answer_text?: string;
  audio_path?: string;
  audio_transcript?: string;
  audio_duration_seconds?: number;
  document_path?: string;
  document_type?: string;
  answered_at: string;
  duration_seconds: number;
  answer_id?: number;
}

export interface SessionDetailResponse {
  session_id: string;
  employee_name: string;
  employee_id: string;
  employee_email?: string;
  meet_link: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_duration_seconds: number;
  questions_answered: number;
  total_questions: number;
  answers: AnswerDetail[];
}

export interface Question {
  question_id: number;
  question_text: string;
  question_type: string;
  category: string;
  required: boolean;
  order: number;
  document_type?: string;
  timer_seconds: number;
}

export interface QuestionsResponse {
  total: number;
  questions: Question[];
}

export interface AnswerPayload {
  session_id: string;
  question_id: number;
  answer_text?: string;
  duration_seconds?: number;
}

export interface AnswerResponse {
  success: boolean;
  message: string;
  next_question?: Question;
}

export interface DocumentUploadResponse {
  success: boolean;
  file_name: string;
  file_path: string;
  document_type: string;
  timestamp: string;
  next_question?: Question;
  message: string;
}

export interface SubmitForHRResponse {
  success: boolean;
  message: string;
  review_queue_id: string;
}

export interface DecisionQA {
  question: string;
  answer: string;
}

export interface DecisionDocuments {
  pan_uploaded: boolean;
  aadhaar_uploaded: boolean;
  salary_slip_uploaded: boolean;
}

export interface GroqDecisionRequest {
  responses: DecisionQA[];
  cv_estimated_age?: number;
  declared_age?: number;
  age_difference?: number;
  age_status?: string;
  documents: DecisionDocuments;
}

export interface GroqDecisionResponse {
  category: string;
  reason: string;
  risk_level: string;
  loan_amount_range?: string;
  confidence: number;
}

// ─────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────

/**
 * Create a new video onboarding session
 */
export function createVideoOnboardingSession(data: VideoSessionCreateRequest): Promise<VideoSessionResponse> {
  return request('/api/video-onboarding/sessions/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get session details (with answers)
 */
export function getVideoSession(sessionId: string): Promise<SessionDetailResponse> {
  return request(`/api/video-onboarding/sessions/${sessionId}`, {
    method: 'GET',
  });
}

/**
 * List all sessions
 */
export function listVideoSessions(
  employeeId?: string,
  status?: string,
  limit: number = 50
): Promise<{sessions: VideoSessionResponse[]; total: number}> {
  const params = new URLSearchParams();
  if (employeeId) params.append('employee_id', employeeId);
  if (status) params.append('status', status);
  params.append('limit', limit.toString());

  return request(`/api/video-onboarding/sessions?${params.toString()}`, {
    method: 'GET',
  });
}

/**
 * Delete a video session entirely
 */
export function deleteVideoSession(sessionId: string): Promise<{success: boolean; message: string}> {
  return request(`/api/video-onboarding/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────
// Interview Flow
// ─────────────────────────────────────────────────

/**
 * Start the interview
 */
export function startVideoOnboarding(sessionId: string): Promise<{
  success: boolean;
  message: string;
  first_question?: Question;
  total_questions: number;
}> {
  return request(`/api/video-onboarding/sessions/${sessionId}/start-interview`, {
    method: 'POST',
  });
}

/**
 * Get next question
 */
export function getNextQuestion(sessionId: string): Promise<{
  next_question?: Question;
  completed: boolean;
  message: string;
}> {
  return request(`/api/video-onboarding/sessions/${sessionId}/next-question`, {
    method: 'GET',
  });
}

/**
 * Record an answer
 */
export function recordVideoAnswer(sessionId: string, payload: AnswerPayload): Promise<AnswerResponse> {
  return request(`/api/video-onboarding/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────────
// Document Upload
// ─────────────────────────────────────────────────

/**
 * Upload a document (Aadhar, PAN, Address Proof)
 */
export async function uploadVideoDocument(sessionId: string, formData: FormData): Promise<DocumentUploadResponse> {
  const res = await fetch(`${VIDEO_API_BASE}/api/video-onboarding/sessions/${sessionId}/upload-document`, {
    method: 'POST',
    body: formData,
    // Note: do NOT set Content-Type header — browser sets it with boundary for multipart
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({detail: res.statusText}));
    throw new Error(err.detail || `API Error ${res.status}`);
  }

  return res.json();
}

/**
 * Upload an audio answer (WebM, WAV, MP3, etc.)
 */
export async function uploadVideoAudio(
  sessionId: string,
  questionId: number,
  audioBlob: Blob,
  audioDurationSeconds: number,
  durationSeconds: number
): Promise<{success: boolean; file_path: string; message: string; file_size: number; next_question?: Question}> {
  const formData = new FormData();
  formData.append('question_id', questionId.toString());
  formData.append('audio_duration_seconds', audioDurationSeconds.toString());
  formData.append('duration_seconds', durationSeconds.toString());
  
  // Determine mime type and filename
  const mimeType = audioBlob.type || 'audio/webm';
  const extension = mimeType.includes('webm') ? '.webm' : 
                    mimeType.includes('mp3') ? '.mp3' : 
                    mimeType.includes('wav') ? '.wav' : '.webm';
  
  formData.append('file', audioBlob, `answer${extension}`);

  const res = await fetch(`${VIDEO_API_BASE}/api/video-onboarding/sessions/${sessionId}/upload-audio`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({detail: res.statusText}));
    throw new Error(err.detail || `API Error ${res.status}`);
  }

  return res.json();
}

/**
 * Record a text answer
 */
export function recordTextAnswer(
  sessionId: string,
  questionId: number,
  answerText: string,
  durationSeconds: number
): Promise<{success: boolean; message: string}> {
  return request(`/api/video-onboarding/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({
      question_id: questionId,
      answer_text: answerText,
      duration_seconds: durationSeconds,
    }),
  });
}

// ─────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────

/**
 * Get all interview questions
 */
export function getVideoOnboardingQuestions(): Promise<QuestionsResponse> {
  return request('/api/video-onboarding/questions', {
    method: 'GET',
  });
}

// ─────────────────────────────────────────────────
// Submission & HR Review
// ─────────────────────────────────────────────────

/**
 * Check if session is ready for HR review
 */
export function checkReviewReady(sessionId: string): Promise<{
  session_id: string;
  ready: boolean;
  progress: number;
  total_answers: number;
  total_questions: number;
}> {
  return request(`/api/video-onboarding/sessions/${sessionId}/review-ready`, {
    method: 'GET',
  });
}

/**
 * Submit for HR review
 */
export function submitVideoOnboardingForHR(sessionId: string): Promise<SubmitForHRResponse> {
  return request(`/api/video-onboarding/sessions/${sessionId}/submit-for-hr`, {
    method: 'POST',
  });
}

/**
 * Generate the final post-onboarding decision for a session.
 */
export function getPostOnboardingDecision(
  sessionId: string,
  payload: GroqDecisionRequest
): Promise<GroqDecisionResponse> {
  return request(`/api/video-onboarding/sessions/${sessionId}/decision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────────
// Question Sets (HR Question Builder)
// ─────────────────────────────────────────────────

export interface QuestionSetQuestion {
  question_id?: number;
  id?: number;
  question_text: string;
  question_type: 'document_upload' | 'yes_no' | 'audio';
  required: boolean;
  timer_seconds: number;
  document_type?: string;
  order?: number;
}

export interface QuestionSet {
  set_id: string;
  name: string;
  is_active: boolean;
  questions: QuestionSetQuestion[];
}

/**
 * Get all question sets
 */
export function getQuestionSets(): Promise<{total: number; sets: QuestionSet[]}> {
  return request('/api/video-onboarding/question-sets', {
    method: 'GET',
  });
}

/**
 * Create a new question set
 */
export function createQuestionSet(name: string, questions: QuestionSetQuestion[]): Promise<{success: boolean; set_id: string; message: string}> {
  return request('/api/video-onboarding/question-sets/create', {
    method: 'POST',
    body: JSON.stringify({name, questions}),
  });
}

/**
 * Update a question set
 */
export function updateQuestionSet(setId: string, name: string, questions: QuestionSetQuestion[]): Promise<{success: boolean; message: string}> {
  return request(`/api/video-onboarding/question-sets/${setId}`, {
    method: 'PUT',
    body: JSON.stringify({name, questions}),
  });
}

/**
 * Delete a question set
 */
export function deleteQuestionSet(setId: string): Promise<{success: boolean; message: string}> {
  return request(`/api/video-onboarding/question-sets/${setId}`, {
    method: 'DELETE',
  });
}

/**
 * Activate a question set
 */
export function activateQuestionSet(setId: string): Promise<{success: boolean; message: string}> {
  return request(`/api/video-onboarding/question-sets/${setId}/activate`, {
    method: 'POST',
  });
}

// ─────────────────────────────────────────────────
// Verification & Records
// ─────────────────────────────────────────────────

/**
 * Get session details with all answers (alias for getVideoSession)
 */
export function getSessionDetails(sessionId: string): Promise<SessionDetailResponse> {
  return getVideoSession(sessionId);
}

export interface VerificationResponse {
  success: boolean;
  verification?: {
    session_id: string;
    photo_path?: string;
    signature_path?: string;
    uploaded_at?: string;
  };
  message?: string;
}

/**
 * Get verification data (photo and signature) for a session
 */
export function getVerificationData(sessionId: string): Promise<VerificationResponse["verification"]> {
  return request(`/api/video-onboarding/sessions/${sessionId}/verification`, {
    method: 'GET',
  }).then((res: VerificationResponse) => res.verification);
}

// ─────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────

/**
 * Health check
 */
export function videoHealthCheck(): Promise<{status: string; service: string; version: string}> {
  return request('/health', {
    method: 'GET',
  });
}
