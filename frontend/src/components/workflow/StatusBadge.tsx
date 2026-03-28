import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'Completed', className: 'text-success border-success/40 bg-success/10' },
  RUNNING: { label: 'Running', className: 'text-primary border-primary/40 bg-primary/10' },
  FAILED: { label: 'Failed', className: 'text-destructive border-destructive/40 bg-destructive/10' },
  PARTIAL: { label: 'Partial', className: 'text-warning border-warning/40 bg-warning/10' },
  APPROVED: { label: 'Approved', className: 'text-success border-success/40 bg-success/10' },
  REJECTED: { label: 'Rejected', className: 'text-destructive border-destructive/40 bg-destructive/10' },
  PENDING_APPROVAL: { label: 'Pending Approval', className: 'text-warning border-warning/40 bg-warning/10' },
  SUCCESS: { label: 'Success', className: 'text-success border-success/40 bg-success/10' },
  FAILURE: { label: 'Failure', className: 'text-destructive border-destructive/40 bg-destructive/10' },
  RETRY: { label: 'Retrying', className: 'text-warning border-warning/40 bg-warning/10' },
  INFO: { label: 'Info', className: 'text-primary border-primary/40 bg-primary/10' },
  SKIPPED: { label: 'Skipped', className: 'text-muted-foreground border-border bg-muted/30' },
  AT_RISK: { label: 'At Risk', className: 'text-warning border-warning/40 bg-warning/10' },
  BLOCKED: { label: 'Blocked', className: 'text-destructive border-destructive/40 bg-destructive/10' },
  FULL: { label: 'Full Match', className: 'text-success border-success/40 bg-success/10' },
  MISMATCH: { label: 'Mismatch', className: 'text-destructive border-destructive/40 bg-destructive/10' },
  CLEAN: { label: 'Clean', className: 'text-success border-success/40 bg-success/10' },
  RECOVERED: { label: 'Recovered', className: 'text-warning border-warning/40 bg-warning/10' },
  PENDING: { label: 'Pending', className: 'text-muted-foreground border-border bg-muted/30' },
};

export function StatusBadge({ status, className, variant }: StatusBadgeProps) {
  const normalizedStatus = (status || 'PENDING').toUpperCase();
  const config = STATUS_CONFIG[normalizedStatus] || {
    label: normalizedStatus,
    className: 'text-muted-foreground border-border bg-muted/30',
  };

  return (
    <Badge
      variant={variant}
      className={cn('px-2 py-0.5 text-[11px] font-medium border rounded-sm', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}