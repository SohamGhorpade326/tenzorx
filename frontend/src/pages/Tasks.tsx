import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { type TaskStatus } from '@/data/mockData';
import { TaskStatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { TaskDrawer } from '@/components/TaskDrawer';
import { SimulationModal } from '@/components/SimulationModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, MoreHorizontal, CheckSquare, UserPlus, Download, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as api from '@/lib/api';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  description?: string;
  owner: string;
  source_meeting?: string;
  deadline?: string;
  priority: string;
  status: string;
  acceptance_criteria?: string[];
  source_quote?: string;
}

function toFrontendTask(t: Task) {
  const initials = t.owner
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    ...t,
    ownerInitials: initials,
    sourceMeeting: t.source_meeting || 'Unknown Meeting',
    acceptanceCriteria: t.acceptance_criteria,
    sourceQuote: t.source_quote,
    statusHistory: [],
    decisionContext: '',
  };
}

export default function Tasks() {
  const [tasks, setTasks] = useState<ReturnType<typeof toFrontendTask>[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [selectedTask, setSelectedTask] = useState<ReturnType<typeof toFrontendTask> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      setLoading(true);
      const result = await api.getTasks();
      setTasks((result.tasks as Task[]).map(toFrontendTask));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tasks';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const owners = [...new Set(tasks.map(t => t.owner))];

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (ownerFilter !== 'ALL' && t.owner !== ownerFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, ownerFilter]);

  const getDeadlineText = (deadline?: string) => {
    if (!deadline) return { text: 'No deadline', overdue: false };
    const d = new Date(deadline);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diff < 0) return { text: `${dateStr} · ${Math.abs(diff)} days overdue`, overdue: true };
    if (diff <= 2) return { text: `${dateStr} · ${diff} days left`, overdue: false };
    return { text: `${dateStr} · ${diff} days left`, overdue: false };
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const markDone = async (id: string) => {
    try {
      await api.updateTask(id, { status: 'DONE' });
      toast.success('Task marked as done');
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      toast.error(msg);
    }
  };

  const markSelectedDone = async () => {
    for (const id of selected) {
      await api.updateTask(id, { status: 'DONE' }).catch(() => {});
    }
    toast.success(`${selected.size} task(s) marked as done`);
    setSelected(new Set());
    load();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm animate-pulse">Loading tasks...</div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-4">
      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex flex-wrap items-center gap-3"
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {(['PENDING', 'AT_RISK', 'OVERDUE', 'DONE', 'BLOCKED'] as TaskStatus[]).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" className="rounded-xl" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>

        <Button variant="outline" className="ml-auto rounded-xl text-warning border-warning/30 hover:bg-warning/10" onClick={() => setSimOpen(true)}>
          <Clock className="w-4 h-4 mr-1.5" /> Simulate Time Jump
        </Button>
      </motion.div>

      {/* Tasks Table */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-card rounded-2xl border overflow-hidden"
      >
        {tasks.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">No tasks yet — process a meeting to create tasks</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                  <th className="p-3 w-10"></th>
                  <th className="p-3 font-medium">Task</th>
                  <th className="p-3 font-medium">Owner</th>
                  <th className="p-3 font-medium hidden md:table-cell">Meeting</th>
                  <th className="p-3 font-medium">Deadline</th>
                  <th className="p-3 font-medium">Priority</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                <AnimatePresence>
                  {filtered.map(task => {
                    const dl = getDeadlineText(task.deadline);
                    return (
                      <motion.tr
                        layout
                        variants={rowVariants}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        key={task.id}
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => { setSelectedTask(task as unknown as ReturnType<typeof toFrontendTask>); setDrawerOpen(true); }}
                      >
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(task.id)} onCheckedChange={() => toggleSelect(task.id)} />
                      </td>
                      <td className="p-3 font-medium max-w-[200px] truncate">{task.title}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                            {task.ownerInitials}
                          </div>
                          <span className="hidden lg:inline text-xs">{task.owner}</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{task.sourceMeeting}</td>
                      <td className="p-3">
                        <span className={dl.overdue ? 'text-destructive text-xs font-medium' : 'text-xs'}>{dl.text}</span>
                      </td>
                      <td className="p-3"><PriorityBadge priority={task.priority as 'HIGH' | 'MEDIUM' | 'LOW'} /></td>
                      <td className="p-3"><TaskStatusBadge status={task.status as TaskStatus} /></td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => markDone(task.id)}>
                              <CheckSquare className="w-3.5 h-3.5 mr-2" /> Mark Done
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  );
                })}
                </AnimatePresence>
              </motion.tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing 1-{filtered.length} of {filtered.length} tasks</span>
          {selected.size > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2"
              >
                <span className="font-medium">{selected.size} selected</span>
                <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={markSelectedDone}>
                  <CheckSquare className="w-3 h-3 mr-1" /> Mark Done
                </Button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <TaskDrawer task={selectedTask as Parameters<typeof TaskDrawer>[0]['task']} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <SimulationModal open={simOpen} onClose={() => setSimOpen(false)} onConfirm={() => { load(); }} />
    </motion.div>
  );
}
