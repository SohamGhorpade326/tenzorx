import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock, PlayCircle, ShieldAlert } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase();

  const baseClass = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border';

  if (normalized === 'COMPLETED') {
    return (
      <span className={cn(baseClass, 'bg-green-500/10 text-green-400 border-green-500/20', className)}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        Completed
      </span>
    );
  }

  if (normalized === 'FAILED') {
    return (
      <span className={cn(baseClass, 'bg-red-500/10 text-red-400 border-red-500/20', className)}>
        <AlertCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }

  if (normalized === 'RUNNING') {
    return (
      <span className={cn(baseClass, 'bg-blue-500/10 text-blue-400 border-blue-500/20', className)}>
        <PlayCircle className="w-3.5 h-3.5 animate-pulse" />
        Running
      </span>
    );
  }

  if (normalized === 'RECOVERED') {
    return (
      <span className={cn(baseClass, 'bg-amber-500/10 text-amber-400 border-amber-500/20', className)}>
        <ShieldAlert className="w-3.5 h-3.5" />
        Recovered
      </span>
    );
  }

  return (
    <span className={cn(baseClass, 'bg-slate-500/10 text-slate-400 border-slate-500/20', className)}>
      <Clock className="w-3.5 h-3.5" />
      {normalized || 'PENDING'}
    </span>
  );
}
