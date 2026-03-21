import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusType =
  | 'COMPLETED'
  | 'RUNNING'
  | 'FAILED'
  | 'PARTIAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_APPROVAL'
  | 'SUCCESS'
  | 'FAILURE'
  | 'RETRY'
  | 'INFO'
  | 'SKIPPED'
  | 'APPROVED'
  | 'AT_RISK'
  | 'BLOCKED'
  | 'FULL'
  | 'MISMATCH'
  | 'CLEAN';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const statusConfig: Record<StatusType, { label: string; variant: any; className: string }> = {
  COMPLETED: { label: 'Completed', variant: 'default', className: 'bg-green-900/40 text-green-200' },
  RUNNING: { label: 'Running', variant: 'secondary', className: 'bg-blue-900/40 text-blue-200' },
  FAILED: { label: 'Failed', variant: 'destructive', className: 'bg-red-900/40 text-red-200' },
  PARTIAL: { label: 'Partial', variant: 'secondary', className: 'bg-amber-900/40 text-amber-200' },
  APPROVED: { label: 'Approved', variant: 'default', className: 'bg-green-900/40 text-green-200' },
  REJECTED: { label: 'Rejected', variant: 'destructive', className: 'bg-red-900/40 text-red-200' },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    variant: 'secondary',
    className: 'bg-amber-900/40 text-amber-200',
  },
  SUCCESS: { label: 'Success', variant: 'default', className: 'bg-green-900/40 text-green-200' },
  FAILURE: { label: 'Failure', variant: 'destructive', className: 'bg-red-900/40 text-red-200' },
  RETRY: { label: 'Retrying', variant: 'secondary', className: 'bg-amber-900/40 text-amber-200' },
  INFO: { label: 'Info', variant: 'secondary', className: 'bg-blue-900/40 text-blue-200' },
  SKIPPED: { label: 'Skipped', variant: 'outline', className: 'bg-gray-900/40 text-gray-200' },
  AT_RISK: { label: 'At Risk', variant: 'secondary', className: 'bg-amber-900/40 text-amber-200' },
  BLOCKED: { label: 'Blocked', variant: 'destructive', className: 'bg-red-900/40 text-red-200' },
  FULL: { label: 'Full Match', variant: 'default', className: 'bg-green-900/40 text-green-200' },
  MISMATCH: { label: 'Mismatch', variant: 'destructive', className: 'bg-red-900/40 text-red-200' },
  CLEAN: { label: 'Clean', variant: 'default', className: 'bg-green-900/40 text-green-200' },
};

export function StatusBadge({ status, className, variant }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'secondary', className: '' };

  return (
    <Badge
      className={cn(
        'px-2 py-1 text-xs font-medium border-0',
        config.className,
        variant ? statusConfig[variant as StatusType]?.className : '',
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
