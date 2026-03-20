import { useEffect, useState } from 'react';
import { MetricCard } from '@/components/MetricCard';
import { PipelineStatusBadge } from '@/components/StatusBadge';
import { CheckSquare, AlertTriangle, Clock, Bell, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import * as api from '@/lib/api';
import { toast } from 'sonner';

interface DashboardData {
  total_tasks: number;
  overdue_count: number;
  at_risk_count: number;
  done_count: number;
  escalations_sent: number;
  recent_pipeline_runs: {
    id: string;
    meeting_title: string;
    started_at: string;
    status: string;
    tasks_created: number;
    duration_seconds?: number;
  }[];
  task_status_distribution: { name: string; value: number; fill: string }[];
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  return `${seconds.toFixed(1)}s`;
}

function formatStartedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const agentBarMock = Array.from({ length: 12 }, (_, i) => ({
  hour: `${(i + 9).toString().padStart(2, '0')}:00`,
  calls: Math.floor(Math.random() * 20) + 2,
  successRate: Math.floor(Math.random() * 20) + 80,
}));

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getDashboard();
      setData(result as DashboardData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) return null;

  const totalTasks = data.total_tasks;
  const distribution = data.task_status_distribution.filter(s => s.value > 0);

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div />
        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Tasks" value={data.total_tasks} subtitle="across all meetings" icon={CheckSquare} />
        <MetricCard title="Overdue" value={data.overdue_count} subtitle="need immediate attention" color="destructive" icon={AlertTriangle} />
        <MetricCard title="At Risk" value={data.at_risk_count} subtitle="deadline within 48hrs" color="warning" icon={Clock} />
        <MetricCard title="Escalations Sent" value={data.escalations_sent} subtitle="total sent" color="primary" icon={Bell} />
      </div>

      {/* Pipeline Runs + Task Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Pipeline Runs */}
        <div className="lg:col-span-3 bg-card rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Recent Pipeline Runs</h3>
          <div className="overflow-x-auto">
            {data.recent_pipeline_runs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No runs yet — go to <strong>Process Meeting</strong> to start one
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-3 font-medium">Run ID</th>
                    <th className="pb-3 font-medium">Meeting</th>
                    <th className="pb-3 font-medium">Started</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Tasks</th>
                    <th className="pb-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_pipeline_runs.map(run => (
                    <tr key={run.id} className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors">
                      <td className="py-3 font-mono text-xs text-muted-foreground">#{run.id}</td>
                      <td className="py-3 font-medium text-sm max-w-[150px] truncate">{run.meeting_title}</td>
                      <td className="py-3 text-muted-foreground text-xs">{formatStartedAt(run.started_at)}</td>
                      <td className="py-3"><PipelineStatusBadge status={run.status as 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'RUNNING'} /></td>
                      <td className="py-3 text-sm">{run.tasks_created}</td>
                      <td className="py-3 text-muted-foreground text-xs">{formatDuration(run.duration_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Task Status Donut */}
        <div className="lg:col-span-2 bg-card rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Task Status Overview</h3>
          {totalTasks === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-muted-foreground">No tasks yet</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {distribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center -mt-[140px] mb-[90px]">
                <span className="text-2xl font-bold">{totalTasks}</span>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {distribution.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-semibold ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Agent Activity */}
      <div className="bg-card rounded-2xl border p-5">
        <h3 className="font-semibold mb-4">Agent Activity (Last 24hrs)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={agentBarMock}>
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220 13% 91%)', fontSize: '12px' }}
              formatter={(value: number, _: string, props: { payload: { successRate: number } }) => [
                `${value} calls (${props.payload.successRate}% success)`,
                'Agent Activity'
              ]}
            />
            <Bar dataKey="calls" fill="hsl(239 84% 67%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
