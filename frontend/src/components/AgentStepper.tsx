import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentStatus } from '@/data/mockData';
import { useState } from 'react';

export interface AgentStep {
  name: string;
  icon: React.ElementType;
  status: AgentStatus;
  description: string;
  duration?: string;
  outputPreview?: string;
  reviewItems?: { issue: string; text: string; suggestedFix: string }[];
}

interface Props {
  steps: AgentStep[];
  onApproveAll?: () => void;
}

export function AgentStepper({ steps, onApproveAll }: Props) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <div className="relative">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isLast = i === steps.length - 1;

        return (
          <motion.div
            key={step.name}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative flex gap-4"
          >
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 z-10',
                step.status === 'SUCCESS' && 'bg-success/15 border-success text-success',
                step.status === 'RUNNING' && 'bg-info/15 border-info text-info',
                step.status === 'FAILED' && 'bg-destructive/15 border-destructive text-destructive',
                step.status === 'RETRYING' && 'bg-warning/15 border-warning text-warning',
                step.status === 'PENDING' && 'bg-muted border-border text-muted-foreground',
                step.status === 'SKIPPED' && 'bg-muted border-border text-muted-foreground',
              )}>
                {step.status === 'SUCCESS' && <Check className="w-4 h-4" />}
                {step.status === 'RUNNING' && <Loader2 className="w-4 h-4 animate-spin" />}
                {step.status === 'FAILED' && <X className="w-4 h-4" />}
                {step.status === 'RETRYING' && <Loader2 className="w-4 h-4 animate-spin" />}
                {(step.status === 'PENDING' || step.status === 'SKIPPED') && <Icon className="w-4 h-4" />}
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 flex-1 min-h-[2rem]',
                  step.status === 'SUCCESS' ? 'bg-success/30' : 'bg-border'
                )} />
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <div
                className="bg-card rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setExpandedStep(expandedStep === i ? null : i)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{step.name}</span>
                  </div>
                  {step.duration && (
                    <span className="text-xs text-muted-foreground">{step.duration}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>

                <AnimatePresence>
                  {expandedStep === i && step.outputPreview && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <pre className="mt-3 p-3 bg-muted rounded-lg text-xs font-mono overflow-auto max-h-40">
                        {step.outputPreview}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Human review gate */}
                {step.status === 'RUNNING' && step.reviewItems && (
                  <div className="mt-4 space-y-3">
                    <div className="text-xs font-medium text-warning">⚠ Items requiring review:</div>
                    {step.reviewItems.map((item, j) => (
                      <div key={j} className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                        <div className="text-xs font-medium">{item.issue}</div>
                        <div className="text-xs text-muted-foreground mt-1">"{item.text}"</div>
                        <input
                          className="mt-2 w-full text-xs p-2 bg-background rounded-md border"
                          defaultValue={item.suggestedFix}
                          placeholder="Suggested fix..."
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); onApproveAll?.(); }}
                        className="px-4 py-2 bg-success text-success-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        Approve All & Continue
                      </button>
                      <button className="px-4 py-2 border rounded-lg text-xs font-medium hover:bg-muted transition-colors">
                        Review Individually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
