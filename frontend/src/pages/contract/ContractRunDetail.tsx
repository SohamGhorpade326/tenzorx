import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FilePenLine,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Signature,
  Archive,
  Siren,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/contract/StatusBadge';
import { StageCard, StageDetailRow } from '@/components/procurement/StageCard';
import * as contractApi from '@/lib/contractApi';

function formatTimestamp(isoString?: string): string {
  if (!isoString) return '-';
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

function boolStatus(value: unknown): string {
  return value ? 'COMPLETED' : 'PENDING';
}

export default function ContractRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [run, setRun] = useState<contractApi.RunDetail | null>(null);
  const [logs, setLogs] = useState<contractApi.LogEntry[]>([]);

  useEffect(() => {
    if (!runId) return;

    const fetchRunData = async () => {
      try {
        const [runResponse, logsResponse] = await Promise.all([
          contractApi.getRun(runId),
          contractApi.getRunLogs(runId),
        ]);

        setRun(runResponse);
        setLogs(logsResponse.logs);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load contract run details');
      } finally {
        setLoading(false);
      }
    };

    fetchRunData();

    const interval = setInterval(() => {
      if (autoRefresh && run?.status !== 'completed' && run?.status !== 'failed' && run?.status !== 'recovered') {
        fetchRunData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [runId, autoRefresh, run?.status]);

  const outputState = useMemo(() => (run?.output || {}) as Record<string, unknown>, [run]);
  const retryCounts = (outputState.retry_counts || {}) as Record<string, number>;
  const escalations = (outputState.escalations || []) as Array<Record<string, unknown>>;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3 bg-slate-900/40" />
        <Skeleton className="h-72 w-full bg-slate-900/40" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-100 font-medium mb-4">Run not found</p>
        <Button onClick={() => navigate('/contracts')} className="bg-blue-700 hover:bg-blue-600">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/contracts')}
            className="text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Run {run.run_id}</h1>
            <p className="text-slate-400 mt-1">Visibility into draft, review, approval, signing and storage stages.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`border-slate-700 ${
              autoRefresh
                ? 'bg-blue-900/30 text-blue-300'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refreshing' : 'Paused'}
          </Button>
          <StatusBadge status={run.status} />
        </div>
      </div>

      <AnimatePresence>
        {run.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert className="border-green-700 bg-green-900/20">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <AlertDescription className="text-green-300 ml-2">
                Contract workflow completed successfully.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {run.status === 'failed' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert className="border-red-700 bg-red-900/20">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <AlertDescription className="text-red-300 ml-2">
                Contract workflow failed: {run.error_message || 'Unknown error'}.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {escalations.length > 0 && (
        <Alert className="border-amber-700 bg-amber-900/20">
          <Siren className="w-4 h-4 text-amber-500" />
          <AlertDescription className="text-amber-300 ml-2">
            This run contains {escalations.length} escalation event(s). Review audit logs below.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StageCard title="Input" icon={<FilePenLine className="w-5 h-5 text-blue-400" />} color="blue">
          <StageDetailRow label="Contract ID" value={(run.input?.contract_id as string) || '-'} />
          <StageDetailRow label="Started" value={formatTimestamp(run.started_at)} />
          <StageDetailRow label="Completed" value={formatTimestamp(run.completed_at)} />
        </StageCard>

        <StageCard title="Draft & Review" icon={<PenLine className="w-5 h-5 text-indigo-400" />} color="indigo">
          <StageDetailRow label="Draft Created" value={<StatusBadge status={boolStatus(outputState.draft_created)} />} />
          <StageDetailRow label="Review Completed" value={<StatusBadge status={boolStatus(outputState.review_completed)} />} />
        </StageCard>

        <StageCard title="Approval" icon={<ShieldCheck className="w-5 h-5 text-amber-400" />} color="amber">
          <StageDetailRow label="Approved" value={<StatusBadge status={boolStatus(outputState.approved)} />} />
          <StageDetailRow label="Approval Retries" value={retryCounts.approval || 0} />
        </StageCard>

        <StageCard title="Signing" icon={<Signature className="w-5 h-5 text-cyan-400" />} color="cyan">
          <StageDetailRow label="Signed" value={<StatusBadge status={boolStatus(outputState.signed)} />} />
          <StageDetailRow label="Signing Retries" value={retryCounts.signing || 0} />
        </StageCard>

        <StageCard title="Storage" icon={<Archive className="w-5 h-5 text-emerald-400" />} color="emerald">
          <StageDetailRow label="Stored" value={<StatusBadge status={boolStatus(outputState.stored)} />} />
          <StageDetailRow label="Workflow Status" value={<StatusBadge status={run.status} />} />
        </StageCard>

        <StageCard title="Audit Summary" icon={<FileCheck2 className="w-5 h-5 text-rose-400" />} color="rose">
          <StageDetailRow label="Logs Recorded" value={run.logs_count || logs.length} />
          <StageDetailRow label="Escalations" value={escalations.length} />
          <StageDetailRow label="Last Event" value={formatTimestamp(logs[logs.length - 1]?.timestamp)} />
        </StageCard>
      </div>

      <Card className="border-slate-800 bg-slate-950">
        <CardHeader>
          <CardTitle className="text-lg">Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              No audit events captured yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-900/50">
                  <TableRow className="border-slate-800 hover:bg-slate-900/50">
                    <TableHead className="text-slate-400 text-xs font-semibold">Time</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Step</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Agent</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Decision</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-slate-800 hover:bg-slate-900/40 transition-colors">
                      <TableCell className="text-xs text-slate-400">{formatTimestamp(log.timestamp)}</TableCell>
                      <TableCell className="text-xs text-slate-200">{log.step || '-'}</TableCell>
                      <TableCell className="text-xs text-slate-200">{log.agent || '-'}</TableCell>
                      <TableCell>
                        <StatusBadge status={log.decision || 'PENDING'} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">{log.reason || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
