import { cn } from '@/lib/utils';
import type { TaskStatus, PipelineStatus, AuditStatus, TaskPriority } from '@/data/mockData';

const taskStatusStyles: Record<TaskStatus, string> = {
  PENDING: 'status-pending',
  AT_RISK: 'status-at-risk',
  OVERDUE: 'status-overdue',
  DONE: 'status-done',
  BLOCKED: 'status-blocked',
};

const pipelineStatusStyles: Record<PipelineStatus, string> = {
  COMPLETED: 'bg-success/15 text-success',
  PARTIAL: 'bg-warning/15 text-warning',
  FAILED: 'bg-destructive/15 text-destructive',
  RUNNING: 'bg-info/15 text-info',
};

const auditStatusStyles: Record<AuditStatus, string> = {
  SUCCESS: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/15 text-destructive',
  RETRY: 'bg-warning/15 text-warning',
  SKIPPED: 'bg-muted text-muted-foreground',
};

const priorityStyles: Record<TaskPriority, string> = {
  HIGH: 'priority-high',
  MEDIUM: 'priority-medium',
  LOW: 'priority-low',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', taskStatusStyles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function PipelineStatusBadge({ status }: { status: PipelineStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium', pipelineStatusStyles[status])}>
      {status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse-dot" />}
      {status}
    </span>
  );
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const icons: Record<AuditStatus, string> = { SUCCESS: '✓', FAILED: '✗', RETRY: '↻', SKIPPED: '→' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', auditStatusStyles[status])}>
      {icons[status]} {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', priorityStyles[priority])}>
      {priority}
    </span>
  );
}
