import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Activity, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/workflow/StatusBadge';
import * as procurementApi from '@/lib/procurementApi';

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'amber';
}

function MetricCard({ title, value, icon, color }: MetricCardProps) {
  const colorClasses = {
    green: 'text-green-500',
    blue: 'text-primary',
    red: 'text-destructive',
    amber: 'text-warning',
  };

  return (
    <Card className="rounded-2xl border bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground font-medium">{title}</div>
            <div className="text-3xl font-bold mt-2">{value}</div>
          </div>
          <div className={`opacity-60 ${colorClasses[color]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
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


const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

export default function ProcurementDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<procurementApi.RunListItem[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await procurementApi.listRuns();
        setRuns(response.runs);
      } catch (error) {
        console.error('Failed to fetch runs:', error);
      } finally {
        setLoading(false);
      }
    }, 10000); // Refresh every 10 seconds

    // Initial load
    (async () => {
      try {
        const response = await procurementApi.listRuns();
        setRuns(response.runs);
      } catch (error) {
        toast.error('Failed to load procurement runs');
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();

    return () => clearInterval(interval);
  }, []);

  const stats = {
    total: runs.length,
    completed: runs.filter((r) => r.status === 'COMPLETED').length,
    failed: runs.filter((r) => r.status === 'FAILED').length,
    pending: runs.filter((r) => r.status === 'RUNNING' || r.status === 'PARTIAL').length,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Procurement Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of all purchase-to-payment runs</p>
        </div>
        <Button
          onClick={() => navigate('/procurement/new')}
          className="gap-2 rounded-xl"
        >
          <Plus className="w-4 h-4" />
          New Purchase Request
        </Button>
      </motion.div>

      {/* Metrics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Runs" value={stats.total} icon={<Activity className="w-8 h-8" />} color="blue" />
        <MetricCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="w-8 h-8" />} color="green" />
        <MetricCard title="Failed" value={stats.failed} icon={<AlertCircle className="w-8 h-8" />} color="red" />
        <MetricCard title="Pending/Running" value={stats.pending} icon={<Clock className="w-8 h-8" />} color="amber" />
      </motion.div>

      {/* Runs Table */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl border p-5">
        <h3 className="font-semibold mb-4">Recent Runs</h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No runs found. Start a new purchase request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-3 font-medium">Run ID</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Current Step</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Completed</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants}>
                {runs.map((run) => (
                  <motion.tr
                    variants={itemVariants}
                    key={run.run_id}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {run.run_id.substring(0, 12)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-3 text-xs">
                      {run.current_step.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">
                      {formatTimestamp(run.created_at)}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">
                      {run.completed_at ? formatTimestamp(run.completed_at) : '—'}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/procurement/run/${run.run_id}`)}
                        className="text-xs rounded-xl text-muted-foreground"
                      >
                        View
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}