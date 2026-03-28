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
import { StatusBadge } from '@/components/workflow/StatusBadge';
import * as contractApi from '@/lib/contractApi';

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
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="rounded-2xl border bg-card hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground font-medium">{title}</div>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                transition={{ type: 'spring', delay: 0.1 }}
                className="text-3xl font-bold mt-2"
              >
                {value}
              </motion.div>
            </div>
            <div className={`opacity-60 ${colorClasses[color]}`}>{icon}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contract Workflow Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Track contract drafting, approvals, signing and storage runs</p>
        </div>
        <Button
          onClick={() => navigate('/contracts/new')}
          className="gap-2 rounded-xl"
        >
          <Plus className="w-4 h-4" />
          New Contract Run
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Runs" value={stats.total} icon={<Activity className="w-8 h-8" />} color="blue" />
        <MetricCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="w-8 h-8" />} color="green" />
        <MetricCard title="Failed" value={stats.failed} icon={<AlertCircle className="w-8 h-8" />} color="red" />
        <MetricCard title="Running/Pending" value={stats.active} icon={<Clock className="w-8 h-8" />} color="amber" />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-card rounded-2xl border p-5">
        <h3 className="font-semibold mb-4">Recent Contract Runs</h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, idx) => (
              <Skeleton key={idx} className="h-12" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No runs found. Start a new contract workflow run.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-3 font-medium">Run ID</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Started</th>
                  <th className="pb-3 font-medium">Completed</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <motion.tr
                    key={run.run_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 font-mono text-xs text-muted-foreground">{run.run_id}</td>
                    <td className="py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">{formatTimestamp(run.started_at)}</td>
                    <td className="py-3 text-muted-foreground text-xs">{formatTimestamp(run.completed_at)}</td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/contracts/run/${run.run_id}`)}
                        className="text-xs rounded-xl text-muted-foreground"
                      >
                        View
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}