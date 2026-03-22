/**
 * Onboarding AI API Client
 * All calls go to http://localhost:8002
 */

const BASE_URL = import.meta.env.VITE_ONBOARDING_API_URL || 'http://localhost:8002';

// ── Type Definitions ────────────────────────────────────────────────

export interface StartOnboardingRequest {
  employee_name: string;
  employee_id: string;
}

export interface RunResponse {
  run_id: string;
  status: 'running' | 'completed' | 'failed' | 'recovered';
  current_step?: string;
  message?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  logs_count?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface RunListItem {
  run_id: string;
  workflow_type: string;
  status: 'running' | 'completed' | 'failed' | 'recovered';
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface RunsListResponse {
  runs: RunListItem[];
}

export interface AuditEvent {
  id: number;
  run_id: string;
  step?: string;
  agent?: string;
  decision?: string;
  reason?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface AuditResponse {
  run_id: string;
  logs: AuditEvent[];
}

// ── Helper Function ────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ── Onboarding API Functions ─────────────────────────────────────

/**
 * Start a new onboarding run
 */
export async function startRun(data: StartOnboardingRequest): Promise<RunResponse> {
  return request('/api/onboarding/runs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get a specific run by ID
 */
export async function getRun(runId: string): Promise<RunResponse> {
  return request(`/api/onboarding/runs/${runId}`);
}

/**
 * List all onboarding runs
 */
export async function listRuns(limit: number = 50): Promise<RunsListResponse> {
  return request(`/api/onboarding/runs?limit=${limit}`);
}

/**
 * Get audit log for a specific run
 */
export async function getAuditLog(runId: string): Promise<AuditResponse> {
  return request(`/api/onboarding/runs/${runId}/logs`);
}
