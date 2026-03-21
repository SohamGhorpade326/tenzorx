/**
 * Procurement AI API Client
 * All calls go to http://localhost:8001
 */

const BASE_URL = import.meta.env.VITE_PROCUREMENT_API_URL || 'http://localhost:8001';

// ── Type Definitions ────────────────────────────────────────────────

export interface PurchaseRequest {
  item_name: string;
  quantity: number;
  unit_price: number;
  department: string;
  requester_id: string;
  category: string;
  required_by: string;
}

export interface DeliveryPayload {
  po_id: string;
  delivered_items: string[];
  delivered_quantities: number[];
  delivery_date: string;
  delivery_note_ref: string;
}

export interface InvoiceItem {
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface InvoicePayload {
  po_id: string;
  gr_id: string;
  invoice_id: string;
  invoice_amount: number;
  invoice_items: InvoiceItem[];
  invoice_date: string;
  vendor_bank_ref?: string;
}

export interface RunResponse {
  run_id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  current_step: string;
  message: string;
  state: Record<string, unknown>;
}

export interface RunListItem {
  run_id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  current_step: string;
  created_at: string;
  completed_at?: string;
}

export interface RunsListResponse {
  runs: RunListItem[];
}

export interface AuditEvent {
  id: string;
  run_id: string;
  agent_name: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'RETRY' | 'INFO' | 'SKIPPED';
  payload: Record<string, unknown>;
  error_msg?: string;
  created_at: string;
}

export interface AuditResponse {
  run_id?: string;
  events: AuditEvent[];
}

export interface ReviewItem {
  review_id: string;
  run_id: string;
  agent_name: string;
  reason: string;
  payload: Record<string, unknown>;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  created_at: string;
  resolved_at?: string;
  resolution_note?: string;
}

export interface ReviewsResponse {
  reviews: ReviewItem[];
}

export interface SampleScenario {
  scenario: string;
  description: string;
  purchase_request: PurchaseRequest;
  delivery?: DeliveryPayload;
  invoice?: InvoicePayload;
}

export interface SamplesResponse {
  samples: SampleScenario[];
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

// ── Procurement API Functions ─────────────────────────────────────

/**
 * Start a new procurement run
 */
export async function startRun(purchaseRequest: PurchaseRequest): Promise<RunResponse> {
  return request('/procurement/run', {
    method: 'POST',
    body: JSON.stringify({ purchase_request: purchaseRequest }),
  });
}

/**
 * Get a specific run by ID
 */
export async function getRun(runId: string): Promise<RunResponse> {
  return request(`/procurement/run/${runId}`);
}

/**
 * List all procurement runs
 */
export async function listRuns(): Promise<RunsListResponse> {
  return request('/procurement/runs');
}

/**
 * Trigger goods receipt for a run
 */
export async function triggerDelivery(
  runId: string,
  delivery: DeliveryPayload
): Promise<RunResponse> {
  return request(`/procurement/run/${runId}/delivery`, {
    method: 'POST',
    body: JSON.stringify({ delivery }),
  });
}

/**
 * Submit vendor invoice for a run
 */
export async function triggerInvoice(
  runId: string,
  invoice: InvoicePayload
): Promise<RunResponse> {
  return request(`/procurement/run/${runId}/invoice`, {
    method: 'POST',
    body: JSON.stringify({ invoice }),
  });
}

/**
 * Get audit log for a specific run
 */
export async function getAuditLog(runId: string): Promise<AuditResponse> {
  return request(`/procurement/run/${runId}/audit`);
}

/**
 * Get global audit log for all runs
 */
export async function getAllAuditLog(): Promise<AuditResponse> {
  return request('/procurement/audit');
}

/**
 * Get all pending reviews
 */
export async function getPendingReviews(): Promise<ReviewsResponse> {
  return request('/procurement/reviews');
}

/**
 * Action on a review item (approve/reject)
 */
export async function actionReview(
  reviewId: string,
  action: 'approve' | 'reject',
  note?: string
): Promise<Record<string, unknown>> {
  return request(`/procurement/reviews/${reviewId}`, {
    method: 'POST',
    body: JSON.stringify({ action, note: note || '' }),
  });
}

/**
 * Get sample procurement scenarios
 */
export async function getSamples(): Promise<SamplesResponse> {
  return request('/procurement/samples');
}

// ── Analytics API Functions ──────────────────────────────────────

export const analyticsApi = {
  getSummary: () =>
    request('/procurement/analytics/summary'),

  getSpendByDepartment: () =>
    request('/procurement/analytics/spend-by-department'),

  getBudgetUtilisation: () =>
    request('/procurement/analytics/budget-utilisation'),

  getSpendTrend: (period: '7days' | '30days' | '90days') =>
    request(`/procurement/analytics/spend-trend?period=${period}`),

  getInvoiceMatchStats: () =>
    request('/procurement/analytics/invoice-match-stats'),

  getPipelinePerformance: () =>
    request('/procurement/analytics/pipeline-performance'),

  getSavingsSummary: () =>
    request('/procurement/analytics/savings-summary'),

  getAIInsight: () =>
    request('/procurement/analytics/ai-insight'),
};

// ── Vendor API Functions ─────────────────────────────────────────

export const vendorApi = {
  getAll: (params?: { category?: string; approved_only?: boolean; search?: string }) => {
    // Filter out undefined values to avoid sending "undefined" as literal string
    const cleanedParams = params ? Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ) : {};
    const q = new URLSearchParams(cleanedParams as any).toString();
    return request(`/procurement/vendors${q ? '?' + q : ''}`);
  },

  getOne: (vendorId: string) =>
    request(`/procurement/vendors/${vendorId}`),

  create: (data: Record<string, any>) =>
    request('/procurement/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (vendorId: string, data: Record<string, any>) =>
    request(`/procurement/vendors/${vendorId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (vendorId: string) =>
    request(`/procurement/vendors/${vendorId}`, {
      method: 'DELETE',
    }),

  getPerformance: (vendorId: string) =>
    request(`/procurement/vendors/${vendorId}/performance`),

  addPerformanceRecord: (vendorId: string, data: Record<string, any>) =>
    request(`/procurement/vendors/${vendorId}/performance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  compare: (ids: string[]) =>
    request(`/procurement/vendors/compare?ids=${ids.join(',')}`),
};

// ── Payment API Functions ────────────────────────────────────────

export const paymentApi = {
  getPayment: (paymentId: string) =>
    request(`/procurement/payments/${paymentId}`),

  processPayment: (paymentId: string, data: {
    payment_method: 'upi' | 'card' | 'netbanking';
    payment_details: Record<string, any>;
    transaction_ref: string;
  }) =>
    request(`/procurement/payments/${paymentId}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
