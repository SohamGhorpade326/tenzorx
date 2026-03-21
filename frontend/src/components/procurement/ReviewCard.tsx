import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

interface ReviewCardProps {
  reviewId: string;
  runId: string;
  agentName: string;
  reason: string;
  payload: Record<string, unknown>;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
  isLoading?: boolean;
  onRunClick?: (runId: string) => void;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

export function ReviewCard({
  reviewId,
  runId,
  agentName,
  reason,
  payload,
  status,
  createdAt,
  onApprove,
  onReject,
  isLoading = false,
  onRunClick,
}: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setActionInProgress('approve');
    try {
      onApprove(reviewId);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async () => {
    setActionInProgress('reject');
    try {
      onReject(reviewId);
    } finally {
      setActionInProgress(null);
    }
  };

  const isPending = status === 'PENDING_APPROVAL';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'border-slate-800 bg-slate-950 overflow-hidden',
          status === 'APPROVED' && 'border-green-700/30 bg-green-900/10',
          status === 'REJECTED' && 'border-red-700/30 bg-red-900/10'
        )}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={agentName.toUpperCase() as any} />
                <span className="text-xs text-slate-500">{reviewId.substring(0, 12)}</span>
              </div>
              <p className="text-sm font-medium text-slate-100">{reason}</p>
              <p className="text-xs text-slate-400">
                Run:{' '}
                <button
                  onClick={() => onRunClick?.(runId)}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
                >
                  {runId.substring(0, 12)}
                </button>
              </p>
              <p className="text-xs text-slate-500">{formatTimestamp(createdAt)}</p>
            </div>

            {/* Status Badge */}
            <div>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Expandable Payload */}
          <div className="border-t border-slate-800 pt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
              <span>Details</span>
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 bg-slate-900/50 rounded border border-slate-800 p-2"
                >
                  <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          {isPending && (
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="default"
                size="sm"
                onClick={handleApprove}
                disabled={isLoading || actionInProgress !== null}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs"
              >
                {actionInProgress === 'approve' ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={isLoading || actionInProgress !== null}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs"
              >
                {actionInProgress === 'reject' ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
