/**
 * API client for MeetingMind backend.
 * Base URL defaults to VITE_API_URL env var or http://localhost:8000
 */

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error ${res.status}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export interface PipelineRunResponse {
  run_id: string;
  meeting_id: string;
  message: string;
  status: string;
}

export interface WSStepUpdate {
  type: 'step_update' | 'connected' | 'heartbeat';
  run_id: string;
  agent: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PENDING';
  description: string;
  output?: Record<string, unknown>;
  timestamp: string;
}

export interface MeetingScheduleEvent {
  id: string;
  meeting_id: string;
  run_id?: string | null;
  event_date: string;
  source_text?: string | null;
  source_title?: string | null;
  decided_in_meeting_title?: string | null;
  decided_in_meeting_date?: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────
// Meetings
// ─────────────────────────────────────────────────

export function processTranscript(params: {
  transcript: string;
  title?: string;
  date?: string;
  attendees?: string[];
}): Promise<PipelineRunResponse> {
  return request('/api/meetings/process-transcript', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function processAudio(formData: FormData): Promise<PipelineRunResponse> {
  return fetch(`${BASE_URL}/api/meetings/process-audio`, {
    method: 'POST',
    body: formData,
    // Note: do NOT set Content-Type header — browser sets it with boundary for multipart
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `API Error ${res.status}`);
    }
    return res.json();
  });
}

// ─────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────

export function getDashboard() {
  return request<{
    total_tasks: number;
    overdue_count: number;
    at_risk_count: number;
    done_count: number;
    escalations_sent: number;
    recent_pipeline_runs: unknown[];
    task_status_distribution: unknown[];
    agent_activity: unknown[];
  }>('/api/dashboard');
}

// ─────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────

export function getTasks(params: { status?: string; owner?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.owner && params.owner !== 'ALL') qs.set('owner', params.owner);
  const query = qs.toString() ? `?${qs}` : '';
  return request<{ tasks: unknown[]; count: number }>(`/api/tasks${query}`);
}

export function getTask(id: string) {
  return request<unknown>(`/api/tasks/${id}`);
}

export function updateTask(id: string, updates: {
  status?: string;
  owner?: string;
  priority?: string;
  deadline?: string;
}) {
  return request<unknown>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ─────────────────────────────────────────────────
// Audit Events
// ─────────────────────────────────────────────────

export function getAuditEvents(params: {
  agent?: string;
  status?: string;
  run_id?: string;
  search?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.agent && params.agent !== 'ALL') qs.set('agent', params.agent);
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.run_id) qs.set('run_id', params.run_id);
  if (params.search) qs.set('search', params.search);
  const query = qs.toString() ? `?${qs}` : '';
  return request<{ events: unknown[]; count: number }>(`/api/audit-events${query}`);
}

// ─────────────────────────────────────────────────
// Escalations
// ─────────────────────────────────────────────────

export function getEscalations(status?: string) {
  const query = status && status !== 'ALL' ? `?status=${status}` : '';
  return request<{ escalations: unknown[]; count: number }>(`/api/escalations${query}`);
}

export function approveEscalation(id: string) {
  return request<unknown>(`/api/escalations/${id}/approve`, { method: 'POST' });
}

export function rejectEscalation(id: string) {
  return request<unknown>(`/api/escalations/${id}/reject`, { method: 'POST' });
}

// ─────────────────────────────────────────────────
// Pipeline Runs
// ─────────────────────────────────────────────────

export function getPipelineRuns() {
  return request<{ runs: unknown[]; count: number }>('/api/pipeline/runs');
}

export function approveHumanReview(runId: string) {
  return request<unknown>(`/api/pipeline/runs/${runId}/approve-review`, { method: 'POST' });
}

// ─────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────

export function getCalendarEvents(params: {
  start_date?: string;
  end_date?: string;
  meeting_id?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  if (params.meeting_id) qs.set('meeting_id', params.meeting_id);
  const query = qs.toString() ? `?${qs}` : '';
  return request<{ events: MeetingScheduleEvent[]; count: number }>(`/api/calendar/events${query}`);
}

// ─────────────────────────────────────────────────
// WebSocket helper
// ─────────────────────────────────────────────────

export function connectPipelineWS(
  runId: string,
  onMessage: (msg: WSStepUpdate) => void,
  onClose?: () => void,
): WebSocket {
  const wsUrl = BASE_URL.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsUrl}/api/ws/pipeline/${runId}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WSStepUpdate;
      onMessage(msg);
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => onClose?.();
  ws.onerror = (e) => console.error('[WS] Error:', e);

  return ws;
}
