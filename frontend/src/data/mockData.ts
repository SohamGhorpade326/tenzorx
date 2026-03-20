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

export const pipelineRuns: PipelineRun[] = [
  { id: 'a3f2', meetingTitle: 'Q3 Planning Meeting', startedAt: '2 mins ago', status: 'COMPLETED', tasksCreated: 8, duration: '12.3s' },
  { id: 'b71c', meetingTitle: 'Sprint Retrospective', startedAt: '1 hour ago', status: 'COMPLETED', tasksCreated: 5, duration: '9.1s' },
  { id: 'c890', meetingTitle: 'Budget Review', startedAt: '3 hours ago', status: 'PARTIAL', tasksCreated: 3, duration: '8.7s' },
  { id: 'd445', meetingTitle: 'Product Roadmap', startedAt: '1 day ago', status: 'COMPLETED', tasksCreated: 12, duration: '15.2s' },
  { id: 'e112', meetingTitle: 'Client Sync Call', startedAt: '2 days ago', status: 'FAILED', tasksCreated: 0, duration: '3.1s' },
];

export const tasks: Task[] = [
  { id: '1', title: 'Prepare Q3 financial report', description: 'Compile and prepare the comprehensive Q3 financial report including revenue, expenses, and projections.', owner: 'Priya Sharma', ownerInitials: 'PS', sourceMeeting: 'Q3 Planning Meeting', deadline: '2026-03-20', priority: 'HIGH', status: 'OVERDUE', acceptanceCriteria: ['All revenue data compiled', 'Expense report included', 'YoY comparison added'], sourceQuote: '"Priya, can you get the Q3 financial report ready by March 20th? We need it for the board meeting."', decisionContext: 'Board meeting preparation requires financial overview', statusHistory: [{ status: 'PENDING', at: '2026-03-15T10:00:00', by: 'System' }, { status: 'OVERDUE', at: '2026-03-20T00:00:00', by: 'TrackerAgent' }] },
  { id: '2', title: 'Update API documentation', description: 'Review and update all API endpoint documentation to reflect recent changes.', owner: 'Rahul Mehta', ownerInitials: 'RM', sourceMeeting: 'Sprint Retrospective', deadline: '2026-03-22', priority: 'MEDIUM', status: 'AT_RISK', acceptanceCriteria: ['All endpoints documented', 'Examples updated', 'Changelog added'], sourceQuote: '"The API docs are outdated. Rahul, please update them by end of next week."', statusHistory: [{ status: 'PENDING', at: '2026-03-16T10:00:00', by: 'System' }, { status: 'AT_RISK', at: '2026-03-19T00:00:00', by: 'TrackerAgent' }] },
  { id: '3', title: 'Schedule vendor review meeting', owner: 'Ananya Singh', ownerInitials: 'AS', sourceMeeting: 'Budget Review', deadline: '2026-03-25', priority: 'LOW', status: 'PENDING', statusHistory: [{ status: 'PENDING', at: '2026-03-17T10:00:00', by: 'System' }] },
  { id: '4', title: 'Fix authentication bug in prod', description: 'Critical authentication bypass vulnerability discovered in production OAuth flow.', owner: 'Karan Patel', ownerInitials: 'KP', sourceMeeting: 'Sprint Retrospective', deadline: '2026-03-18', priority: 'HIGH', status: 'OVERDUE', acceptanceCriteria: ['Bug root cause identified', 'Fix deployed to production', 'Regression tests added'], sourceQuote: '"There\'s a critical auth bug in production. Karan, this needs to be fixed ASAP, by March 18th latest."', decisionContext: 'Security vulnerability with potential data exposure', statusHistory: [{ status: 'PENDING', at: '2026-03-15T10:00:00', by: 'System' }, { status: 'OVERDUE', at: '2026-03-18T00:00:00', by: 'TrackerAgent' }] },
  { id: '5', title: 'Send client proposal draft', owner: 'Priya Sharma', ownerInitials: 'PS', sourceMeeting: 'Client Sync Call', deadline: '2026-03-24', priority: 'HIGH', status: 'PENDING', statusHistory: [{ status: 'PENDING', at: '2026-03-17T10:00:00', by: 'System' }] },
  { id: '6', title: 'Review Q4 hiring plan', owner: 'Rohit Kumar', ownerInitials: 'RK', sourceMeeting: 'Q3 Planning Meeting', deadline: '2026-03-19', priority: 'MEDIUM', status: 'OVERDUE', statusHistory: [{ status: 'PENDING', at: '2026-03-15T10:00:00', by: 'System' }, { status: 'OVERDUE', at: '2026-03-19T00:00:00', by: 'TrackerAgent' }] },
  { id: '7', title: 'Update Notion project pages', owner: 'Ananya Singh', ownerInitials: 'AS', sourceMeeting: 'Product Roadmap', deadline: '2026-03-28', priority: 'LOW', status: 'PENDING', statusHistory: [{ status: 'PENDING', at: '2026-03-17T10:00:00', by: 'System' }] },
  { id: '8', title: 'Complete security audit', owner: 'Rahul Mehta', ownerInitials: 'RM', sourceMeeting: 'Sprint Retrospective', deadline: '2026-03-15', priority: 'HIGH', status: 'DONE', statusHistory: [{ status: 'PENDING', at: '2026-03-10T10:00:00', by: 'System' }, { status: 'DONE', at: '2026-03-14T16:00:00', by: 'Rahul Mehta' }] },
];

export const auditEvents: AuditEvent[] = [
  { id: 'ae1', timestamp: '2026-03-17T14:32:07', runId: 'a3f2', agent: 'TranscriptAgent', action: 'EXTRACT_DECISIONS', status: 'SUCCESS', duration: '1.2s', summary: '8 decisions extracted', inputPayload: { transcript: '...meeting transcript...' }, outputPayload: { decisions: 8, items: ['Q3 report', 'API docs', 'Vendor review'] } },
  { id: 'ae2', timestamp: '2026-03-17T14:32:09', runId: 'a3f2', agent: 'ValidatorAgent', action: 'VALIDATE_ITEMS', status: 'SUCCESS', duration: '0.8s', summary: '6 valid, 2 flagged', outputPayload: { valid: 6, flagged: 2 } },
  { id: 'ae3', timestamp: '2026-03-17T14:32:18', runId: 'a3f2', agent: 'TaskCreatorAgent', action: 'CREATE_TASK', status: 'SUCCESS', duration: '2.1s', summary: 'Task created: Q3 report', outputPayload: { taskId: '1', title: 'Prepare Q3 financial report' } },
  { id: 'ae4', timestamp: '2026-03-17T14:32:19', runId: 'a3f2', agent: 'TaskCreatorAgent', action: 'ENRICH_TASK', status: 'SUCCESS', duration: '1.4s', summary: 'Acceptance criteria added', outputPayload: { taskId: '1', criteria: 3 } },
  { id: 'ae5', timestamp: '2026-03-17T14:32:31', runId: 'a3f2', agent: 'TrackerAgent', action: 'SCAN_DEADLINES', status: 'SUCCESS', duration: '0.3s', summary: '3 tasks at risk detected', outputPayload: { atRisk: 3 } },
  { id: 'ae6', timestamp: '2026-03-17T14:32:32', runId: 'a3f2', agent: 'EscalationAgent', action: 'DRAFT_ESCALATION', status: 'SUCCESS', duration: '1.8s', summary: 'Draft created for Karan', outputPayload: { recipient: 'Karan Patel', taskTitle: 'Fix auth bug' } },
  { id: 'ae7', timestamp: '2026-03-17T14:28:01', runId: 'a3f2', agent: 'OrchestratorAgent', action: 'RUN_START', status: 'SUCCESS', duration: '0s', summary: 'Pipeline run #a3f2 started' },
  { id: 'ae8', timestamp: '2026-03-17T14:28:03', runId: 'a3f2', agent: 'TranscriptAgent', action: 'EXTRACT_DECISIONS', status: 'FAILED', duration: '4.1s', summary: 'JSON parse error — retrying', errorMessage: 'SyntaxError: Unexpected token < in JSON at position 0', retryCount: 1 },
  { id: 'ae9', timestamp: '2026-03-17T14:28:07', runId: 'a3f2', agent: 'TranscriptAgent', action: 'EXTRACT_DECISIONS', status: 'RETRY', duration: '1.3s', summary: 'Retry succeeded' },
];

export const escalations: Escalation[] = [
  {
    id: 'esc1',
    taskId: '4',
    taskTitle: 'Fix authentication bug in prod',
    owner: 'Karan Patel',
    overdueByDays: 2,
    deadline: '2026-03-18',
    sourceMeeting: 'Sprint Retrospective',
    message: 'Hi Karan,\n\nI wanted to follow up on the authentication bug fix that was due on March 18th. This task has now been overdue for 2 days and is marked as high priority.\n\nCould you provide an update on the current status and expected completion date? If you\'re blocked on anything, please let the team know so we can reassign resources.\n\nThe security implications of this fix make it a time-sensitive matter.',
    status: 'PENDING_APPROVAL',
    createdAt: '2026-03-17T14:32:32',
  },
  {
    id: 'esc2',
    taskId: '1',
    taskTitle: 'Prepare Q3 financial report',
    owner: 'Priya Sharma',
    overdueByDays: 1,
    deadline: '2026-03-20',
    sourceMeeting: 'Q3 Planning Meeting',
    message: 'Hi Priya,\n\nThe Q3 financial report was due on March 20th and is now 1 day overdue. As this is needed for the upcoming board meeting, it is critical we get this completed.\n\nPlease update the team on the status and any blockers you may have.',
    status: 'PENDING_APPROVAL',
    createdAt: '2026-03-17T14:33:00',
  },
];

export const agentBarData = Array.from({ length: 12 }, (_, i) => ({
  hour: `${(i + 3).toString().padStart(2, '0')}:00`,
  calls: Math.floor(Math.random() * 20) + 2,
  successRate: Math.floor(Math.random() * 20) + 80,
}));

export const taskStatusDistribution = [
  { name: 'PENDING', value: tasks.filter(t => t.status === 'PENDING').length, fill: 'hsl(220, 9%, 46%)' },
  { name: 'AT_RISK', value: tasks.filter(t => t.status === 'AT_RISK').length, fill: 'hsl(38, 92%, 50%)' },
  { name: 'OVERDUE', value: tasks.filter(t => t.status === 'OVERDUE').length, fill: 'hsl(0, 84%, 60%)' },
  { name: 'DONE', value: tasks.filter(t => t.status === 'DONE').length, fill: 'hsl(160, 84%, 39%)' },
  { name: 'BLOCKED', value: tasks.filter(t => t.status === 'BLOCKED').length, fill: 'hsl(25, 95%, 53%)' },
];
