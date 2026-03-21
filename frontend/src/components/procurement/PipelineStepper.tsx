import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STAGES = [
  { id: 'purchase_request', name: 'Purchase Request', order: 0 },
  { id: 'budget_check', name: 'Budget Check', order: 1 },
  { id: 'vendor_selection', name: 'Vendor Selection', order: 2 },
  { id: 'po_creation', name: 'PO Creation', order: 3 },
  { id: 'awaiting_delivery', name: 'Goods Receipt', order: 4 },
  { id: 'awaiting_invoice', name: 'Invoice Matching', order: 5 },
  { id: 'payment_scheduling', name: 'Payment Scheduling', order: 6 },
  { id: 'completed', name: 'Complete', order: 7 },
];

type StageStatus = 'pending' | 'active' | 'completed' | 'failed' | 'waiting' | 'blocked';

function getStageStatusFromCurrentStep(
  currentStep: string,
  stageId: string,
  stageOrder: number
): StageStatus {
  // All cases of failure
  if (currentStep === 'failed') {
    return 'pending';
  }

  // All completed
  if (currentStep === 'completed') {
    return 'completed';
  }

  // Any pending review
  if (currentStep.startsWith('pending_')) {
    if (PIPELINE_STAGES.find((s) => s.id === currentStep.split('_')[1])?.id === stageId) {
      return 'blocked';
    }
  }

  // Find current step order
  const currentStageObj = PIPELINE_STAGES.find((s) => s.id === currentStep);
  if (!currentStageObj) {
    // Unknown current step, try fuzzy match
    if (currentStep.includes('awaiting')) {
      return stageOrder > 3 ? 'waiting' : 'completed';
    }
    return 'pending';
  }

  const currentOrder = currentStageObj.order;

  // Stages before current = completed
  if (stageOrder < currentOrder) {
    return 'completed';
  }

  // Current stage = active
  if (stageOrder === currentOrder) {
    return 'active';
  }

  // Waiting states
  if (currentStep.includes('awaiting') && stageOrder === currentOrder) {
    return 'waiting';
  }

  // Stages after current = pending
  return 'pending';
}

interface StageIconProps {
  status: StageStatus;
  isLast?: boolean;
}

function StageIcon({ status, isLast }: StageIconProps) {
  const iconProps = 'w-6 h-6';

  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(iconProps, 'text-green-500')} />;
    case 'active':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className={cn(iconProps, 'text-blue-500')} />
        </motion.div>
      );
    case 'waiting':
      return <Clock className={cn(iconProps, 'text-amber-500')} />;
    case 'blocked':
      return <AlertCircle className={cn(iconProps, 'text-red-500')} />;
    case 'failed':
      return <XCircle className={cn(iconProps, 'text-red-600')} />;
    case 'pending':
    default:
      return <Circle className={cn(iconProps, 'text-slate-500')} />;
  }
}

interface PipelineStepperProps {
  currentStep: string;
  className?: string;
  layout?: 'horizontal' | 'vertical';
}

export function PipelineStepper({
  currentStep,
  className,
  layout = 'vertical',
}: PipelineStepperProps) {
  const getStatusColor = (status: StageStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900/20 border-green-700';
      case 'active':
        return 'bg-blue-900/20 border-blue-700';
      case 'waiting':
        return 'bg-amber-900/20 border-amber-700';
      case 'blocked':
        return 'bg-red-900/20 border-red-700';
      case 'pending':
      default:
        return 'bg-slate-900/20 border-slate-700';
    }
  };

  if (layout === 'horizontal') {
    return (
      <div className={cn('flex gap-2 overflow-x-auto pb-4', className)}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const status = getStageStatusFromCurrentStep(currentStep, stage.id, stage.order);
          const isLast = idx === PIPELINE_STAGES.length - 1;

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex flex-col items-center min-w-fit"
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-lg border p-3 mb-2 transition-all',
                  getStatusColor(status)
                )}
              >
                <StageIcon status={status} isLast={isLast} />
              </div>
              <div className="text-xs font-medium text-slate-300 text-center max-w-[60px]">
                {stage.name}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Vertical layout
  return (
    <div className={cn('space-y-4', className)}>
      {PIPELINE_STAGES.map((stage, idx) => {
        const status = getStageStatusFromCurrentStep(currentStep, stage.id, stage.order);
        const isLast = idx === PIPELINE_STAGES.length - 1;

        return (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex gap-4 items-start"
          >
            {/* Icon */}
            <div
              className={cn(
                'flex items-center justify-center rounded-lg border p-3 mt-0.5 flex-shrink-0 transition-all',
                getStatusColor(status)
              )}
            >
              <StageIcon status={status} isLast={isLast} />
            </div>

            {/* Content */}
            <div className="flex-1 py-3">
              <div className="font-medium text-slate-100">{stage.name}</div>
              <div className="text-xs text-slate-400 mt-1">
                {status === 'completed' && 'Completed'}
                {status === 'active' && 'In Progress'}
                {status === 'waiting' && 'Awaiting Action'}
                {status === 'blocked' && 'Awaiting Approval'}
                {status === 'pending' && 'Pending'}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-[27px] top-[60px] w-0.5 h-12',
                  status === 'completed' ? 'bg-green-600' : 'bg-slate-700'
                )}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
