import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/workflow/StatusBadge';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: string;
  run_id?: string;
  agent_name: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'RETRY' | 'INFO' | 'SKIPPED';
  payload: Record<string, unknown>;
  error_msg?: string;
  created_at: string;
}

interface AuditTableProps {
  events: AuditEvent[];
  isLoading?: boolean;
  showRunId?: boolean;
  className?: string;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

function PayloadCell({ payload, error }: { payload: Record<string, unknown>; error?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
        <span>View Details</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-muted/20 rounded border p-2"
          >
            <pre className="text-xs text-foreground/90 overflow-x-auto whitespace-pre-wrap">
              {error && (
                <div className="text-destructive mb-2">
                  <strong>Error:</strong> {error}
                </div>
              )}
              {JSON.stringify(payload, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AuditTable({
  events,
  isLoading = false,
  showRunId = false,
  className,
}: AuditTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No audit events found</p>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <Table>
        <TableHeader className="bg-muted/30 border-b">
          <TableRow className="hover:bg-muted/30">
            <TableHead className="text-muted-foreground text-xs font-semibold">Time</TableHead>
            {showRunId && <TableHead className="text-muted-foreground text-xs font-semibold">Run ID</TableHead>}
            <TableHead className="text-muted-foreground text-xs font-semibold">Agent</TableHead>
            <TableHead className="text-muted-foreground text-xs font-semibold">Action</TableHead>
            <TableHead className="text-muted-foreground text-xs font-semibold">Status</TableHead>
            <TableHead className="text-muted-foreground text-xs font-semibold">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow
              key={event.id}
              className={cn(
                'border-b hover:bg-muted/20 transition-colors',
                event.status === 'SUCCESS' && 'bg-success/5',
                event.status === 'FAILURE' && 'bg-destructive/5',
                event.status === 'RETRY' && 'bg-warning/5'
              )}
            >
              <TableCell className="text-xs text-muted-foreground font-mono">
                {formatTimestamp(event.created_at)}
              </TableCell>
              {showRunId && (
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {event.run_id?.substring(0, 12)}
                </TableCell>
              )}
              <TableCell className="text-xs font-medium">
                {event.agent_name}
              </TableCell>
              <TableCell className="text-xs text-foreground/90">{event.action}</TableCell>
              <TableCell>
                <StatusBadge status={event.status} />
              </TableCell>
              <TableCell className="text-xs">
                <PayloadCell payload={event.payload} error={event.error_msg} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
