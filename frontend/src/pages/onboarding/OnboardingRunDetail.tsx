import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clipboard,
  PackageCheck,
  CalendarCheck,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/workflow/StatusBadge';
import { StageCard, StageDetailRow } from '@/components/procurement/StageCard';
import * as onboardingApi from '@/lib/onboardingApi';

export default function OnboardingRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [run, setRun] = useState<onboardingApi.RunResponse | null>(null);

  useEffect(() => {
    if (!runId) return;

    const fetchData = async () => {
      try {
        const runData = await onboardingApi.getRun(runId);
        setRun(runData);
        setLoading(false);
      } catch (error) {
        toast.error('Failed to load run details');
        console.error(error);
        setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(() => {
      if (autoRefresh && run?.status !== 'completed' && run?.status !== 'failed') {
        fetchData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [runId, autoRefresh, run?.status]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3 bg-slate-900/40" />
        <Skeleton className="h-80 w-full bg-slate-900/40" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-100 font-medium mb-4">Run not found</p>
        <Button onClick={() => navigate('/onboarding')} className="bg-blue-700 hover:bg-blue-600">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const output = run.output || {};

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/onboarding')}
            className="text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              Run {runId}
            </h1>
            <p className="text-slate-400 mt-1">State visibility of the automated onboarding pipeline.</p>
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
                Onboarding pipeline completed successfully!
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
                Pipeline failed: {run.error_message}.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StageCard title="Employee Details" icon={<Clipboard className="w-5 h-5 text-blue-400" />} color="blue">
          <StageDetailRow label="Name" value={run.input?.employee_name as string || output.name as string} />
          <StageDetailRow label="Employee ID" value={run.input?.employee_id as string || output.employee_id as string} />
        </StageCard>

        <StageCard title="Account Setup" icon={<ShieldAlert className="w-5 h-5 text-indigo-400" />} color="indigo">
          <StageDetailRow label="Status" value={output.account_created ? <StatusBadge status="COMPLETED" /> : <StatusBadge status="PENDING" />} />
          {output.retry_counts && (output.retry_counts as any).account_creation > 0 && <StageDetailRow label="Retries" value={(output.retry_counts as any).account_creation} />}
        </StageCard>

        <StageCard title="Asset Assignment" icon={<PackageCheck className="w-5 h-5 text-amber-400" />} color="amber">
          <StageDetailRow label="Status" value={output.asset_assigned ? <StatusBadge status="COMPLETED" /> : <StatusBadge status="PENDING" />} />
          {output.retry_counts && (output.retry_counts as any).asset_assignment > 0 && <StageDetailRow label="Retries" value={(output.retry_counts as any).asset_assignment} />}
        </StageCard>

        <StageCard title="Orientation" icon={<CalendarCheck className="w-5 h-5 text-green-400" />} color="emerald">
          <StageDetailRow label="Status" value={output.orientation_scheduled ? <StatusBadge status="COMPLETED" /> : <StatusBadge status="PENDING" />} />
        </StageCard>
      </div>

    </motion.div>
  );
}
