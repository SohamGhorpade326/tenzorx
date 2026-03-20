import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TaskStatusBadge, PriorityBadge } from '@/components/StatusBadge';
import type { Task } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { CheckSquare, UserPlus, ScrollText } from 'lucide-react';

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDrawer({ task, open, onClose }: Props) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex gap-2 flex-wrap">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Owner</span>
              <p className="font-medium">{task.owner}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Deadline</span>
              <p className="font-medium">{task.deadline}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Source</span>
              <p className="font-medium">{task.sourceMeeting}</p>
            </div>
          </div>

          {task.acceptanceCriteria && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Acceptance Criteria</h4>
              <ul className="space-y-1.5">
                {task.acceptanceCriteria.map((c, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {task.sourceQuote && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Source Quote</h4>
              <blockquote className="border-l-2 border-primary/40 pl-4 text-sm italic text-muted-foreground">
                {task.sourceQuote}
              </blockquote>
            </div>
          )}

          {task.statusHistory && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status Timeline</h4>
              <div className="space-y-2">
                {task.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground w-32 flex-shrink-0">{new Date(h.at).toLocaleString()}</span>
                    <TaskStatusBadge status={h.status} />
                    <span className="text-muted-foreground">by {h.by}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground">
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Mark Done
            </Button>
            <Button size="sm" variant="outline">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Reassign
            </Button>
            <Button size="sm" variant="ghost">
              <ScrollText className="w-3.5 h-3.5 mr-1.5" /> Audit Trail
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
