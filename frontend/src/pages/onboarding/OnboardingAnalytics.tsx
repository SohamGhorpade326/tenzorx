import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle2, Clock3, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { StatusBadge } from '@/components/workflow/StatusBadge';
import * as onboardingApi from '@/lib/onboardingApi';

type RunWithLogCount = onboardingApi.RunListItem & { logs_count: number };

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

function MetricCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const toneClasses = {
    primary: 'text-primary border-primary/30 bg-primary/10',
    success: 'text-success border-success/30 bg-success/10',
    warning: 'text-warning border-warning/30 bg-warning/10',
    destructive: 'text-destructive border-destructive/30 bg-destructive/10',
  };

  return (
    <Card className="bg-card border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground font-medium">{title}</div>
            <div className="text-3xl font-bold mt-2">{value}</div>
          </div>
          <div className={`h-10 w-10 rounded-md border flex items-center justify-center ${toneClasses[tone]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OnboardingAnalytics() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunWithLogCount[]>([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const runList = await onboardingApi.listRuns(50);

      const detailed = await Promise.all(
        runList.runs.map(async (run) => {
          try {
            const detail = await onboardingApi.getRun(run.run_id);
            return { ...run, logs_count: detail.logs_count || 0 };
          } catch {
            return { ...run, logs_count: 0 };
          }
        })
      );

      setRuns(detailed);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load onboarding analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const summary = useMemo(() => {
    const totalRuns = runs.length;
    const completedRuns = runs.filter((r) => r.status.toUpperCase() === 'COMPLETED').length;
    const failedRuns = runs.filter((r) => r.status.toUpperCase() === 'FAILED').length;
    const activeRuns = runs.filter((r) => {
      const normalized = r.status.toUpperCase();
      return normalized === 'RUNNING' || normalized === 'PENDING';
    }).length;
    const recoveredRuns = runs.filter((r) => r.status.toUpperCase() === 'RECOVERED').length;
    const totalLogs = runs.reduce((acc, run) => acc + run.logs_count, 0);
    const averageLogs = totalRuns > 0 ? (totalLogs / totalRuns).toFixed(1) : '0.0';
    const completionRate = totalRuns > 0 ? ((completedRuns / totalRuns) * 100).toFixed(1) : '0.0';
    const mostActiveRun = runs.length > 0 ? [...runs].sort((a, b) => b.logs_count - a.logs_count)[0] : null;

    return {
      totalRuns,
      completedRuns,
      failedRuns,
      activeRuns,
      recoveredRuns,
      totalLogs,
      averageLogs,
      completionRate,
      mostActiveRun,
    };
  }, [runs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, idx) => (
            <Skeleton key={idx} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const statusDistribution = [
    { label: 'Completed', value: summary.completedRuns, color: 'bg-success' },
    { label: 'Failed', value: summary.failedRuns, color: 'bg-destructive' },
    { label: 'Running/Pending', value: summary.activeRuns, color: 'bg-warning' },
    { label: 'Recovered', value: summary.recoveredRuns, color: 'bg-primary' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Onboarding Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Run health and audit signal metrics for onboarding workflows.</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={fetchAnalytics}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Runs" value={summary.totalRuns} icon={<Activity className="w-5 h-5" />} tone="primary" />
        <MetricCard title="Completion Rate" value={`${summary.completionRate}%`} icon={<CheckCircle2 className="w-5 h-5" />} tone="success" />
        <MetricCard title="Failed Runs" value={summary.failedRuns} icon={<AlertCircle className="w-5 h-5" />} tone="destructive" />
        <MetricCard title="Total Audit Logs" value={summary.totalLogs} icon={<FileText className="w-5 h-5" />} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border lg:col-span-2">
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusDistribution.map((item) => {
              const percentage = summary.totalRuns > 0 ? (item.value / summary.totalRuns) * 100 : 0;
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{item.value} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardHeader>
            <CardTitle>Log Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-muted-foreground">Avg Logs per Run</span>
              <span className="font-semibold">{summary.averageLogs}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-muted-foreground">Active Runs</span>
              <span className="font-semibold">{summary.activeRuns}</span>
            </div>
            <div className="space-y-2">
              <span className="text-muted-foreground">Most Active Run</span>
              {summary.mostActiveRun ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs font-mono">{summary.mostActiveRun.run_id}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge status={summary.mostActiveRun.status} />
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {summary.mostActiveRun.logs_count} logs
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No runs available.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border">
        <CardHeader>
          <CardTitle>Runs and Log Counts</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No runs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-muted/30">
                    <TableHead className="text-muted-foreground text-xs font-semibold">Run ID</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold">Started</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold">Logs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.run_id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-xs font-mono">{run.run_id}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatTimestamp(run.started_at)}</TableCell>
                      <TableCell className="text-xs">{run.logs_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {summary.totalRuns > 0 && summary.totalLogs === 0 && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertDescription className="text-warning flex items-center gap-2 text-sm">
            <ShieldAlert className="w-4 h-4" />
            Runs are present but no logs were found yet. Workflows may still be in early execution.
          </AlertDescription>
        </Alert>
      )}
    </motion.div>
  );
}