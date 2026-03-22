import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle2, Clock, Plus } from 'lucide-react';
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
import * as contractApi from '@/lib/contractApi';

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'amber';
}

function MetricCard({ title, value, icon, color }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-900/20 border-green-700 text-green-500',
    blue: 'bg-blue-900/20 border-blue-700 text-blue-500',
    red: 'bg-red-900/20 border-red-700 text-red-500',
    amber: 'bg-amber-900/20 border-amber-700 text-amber-500',
  };

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400 font-medium">{title}</div>
            <div className="text-3xl font-bold text-slate-100 mt-2">{value}</div>
          </div>
          <div className="opacity-60">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

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

export default function ContractDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<contractApi.RunSummary[]>([]);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const response = await contractApi.listRuns();
        setRuns(response.runs);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load contract runs');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();

    const interval = setInterval(fetchRuns, 10000);
    return () => clearInterval(interval);
  }, []);

  const stats = {
    total: runs.length,
    completed: runs.filter((run) => run.status === 'completed').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    active: runs.filter((run) => run.status === 'running' || run.status === 'pending').length,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Contract Workflow Dashboard</h1>
          <p className="text-slate-400 mt-1">Track contract drafting, approvals, signing and storage runs</p>
        </div>
        <Button
          onClick={() => navigate('/contracts/new')}
          className="gap-2 bg-blue-700 hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          New Contract Run
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Runs" value={stats.total} icon={<Activity className="w-8 h-8" />} color="blue" />
        <MetricCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="w-8 h-8" />} color="green" />
        <MetricCard title="Failed" value={stats.failed} icon={<AlertCircle className="w-8 h-8" />} color="red" />
        <MetricCard title="Running/Pending" value={stats.active} icon={<Clock className="w-8 h-8" />} color="amber" />
      </div>

      <Card className="border-slate-800 bg-slate-950">
        <CardHeader>
          <CardTitle className="text-lg">Recent Contract Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, idx) => (
                <Skeleton key={idx} className="h-12 bg-slate-900/40" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No runs found. Start a new contract workflow run.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-900/50">
                  <TableRow className="border-slate-800 hover:bg-slate-900/50">
                    <TableHead className="text-slate-400 text-xs font-semibold">Run ID</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Started</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Completed</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow
                      key={run.run_id}
                      className="border-slate-800 hover:bg-slate-900/40 transition-colors"
                    >
                      <TableCell className="text-xs text-slate-100 font-mono">{run.run_id}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">{formatTimestamp(run.started_at)}</TableCell>
                      <TableCell className="text-xs text-slate-400">{formatTimestamp(run.completed_at)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/contracts/run/${run.run_id}`)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          View
                        </Button>
                      </TableCell>
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
