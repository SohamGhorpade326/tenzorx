/**
 * Contract Workflow API Client
 * All calls go to http://localhost:8003
 */

const BASE_URL = import.meta.env.VITE_CONTRACT_API_URL || 'http://localhost:8003';

export interface StartContractRequest {
  contract_id: string;
}

export interface RunSummary {
  run_id: string;
  workflow_type: string;
  status: 'pending' | 'running' | 'completed' | 'recovered' | 'failed';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface RunListResponse {
  runs: RunSummary[];
}

export interface RunDetail extends RunSummary {
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  logs_count: number;
}

export interface LogEntry {
  id: number;
  run_id: string;
  step?: string;
  agent?: string;
  decision?: string;
  reason?: string;
  meta?: Record<string, unknown> | null;
  timestamp?: string;
}

export interface RunLogsResponse {
  run_id: string;
  logs: LogEntry[];
}

interface StartRunResponse {
  run_id: string;
  status: string;
  message: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function startRun(payload: StartContractRequest): Promise<StartRunResponse> {
  return request('/api/contracts/runs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listRuns(limit: number = 50): Promise<RunListResponse> {
  return request(`/api/contracts/runs?limit=${limit}`);
}

export async function getRun(runId: string): Promise<RunDetail> {
  return request(`/api/contracts/runs/${runId}`);
}

export async function getRunLogs(runId: string): Promise<RunLogsResponse> {
  return request(`/api/contracts/runs/${runId}/logs`);
}
