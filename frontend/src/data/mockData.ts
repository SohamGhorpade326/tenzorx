export type TaskStatus = 'PENDING' | 'AT_RISK' | 'OVERDUE' | 'DONE' | 'BLOCKED';
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type PipelineStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'RUNNING';
export type AgentStatus = 'SUCCESS' | 'RUNNING' | 'FAILED' | 'RETRYING' | 'SKIPPED' | 'PENDING';
export type AuditStatus = 'SUCCESS' | 'FAILED' | 'RETRY' | 'SKIPPED';

export interface PipelineRun {
  id: string;
  meetingTitle: string;
  startedAt: string;
  status: PipelineStatus;
  tasksCreated: number;
  duration: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  owner: string;
  ownerInitials: string;
  sourceMeeting: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  acceptanceCriteria?: string[];
  sourceQuote?: string;
  decisionContext?: string;
  statusHistory?: { status: TaskStatus; at: string; by: string }[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  runId: string;
  agent: string;
  action: string;
  status: AuditStatus;
  duration: string;
  summary: string;
  inputPayload?: object;
  outputPayload?: object;
  errorMessage?: string;
  retryCount?: number;
}

export interface Escalation {
  id: string;
  taskId: string;
  taskTitle: string;
  owner: string;
  overdueByDays: number;
  deadline: string;
  sourceMeeting: string;
  message: string;
  status: 'PENDING_APPROVAL' | 'SENT' | 'REJECTED';
  createdAt: string;
  approvedBy?: string;
  sentAt?: string;
}
