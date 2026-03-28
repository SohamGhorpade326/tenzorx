import { useState, useEffect } from 'react';
import { AuditStatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ChevronDown, ChevronRight, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import * as api from '@/lib/api';

const agentColors: Record<string, string> = {
  TranscriptAgent: 'bg-primary/15 text-primary',
  ValidatorAgent: 'bg-success/15 text-success',
  TaskCreatorAgent: 'bg-info/15 text-info',
  TrackerAgent: 'bg-warning/15 text-warning',
  EscalationAgent: 'bg-destructive/15 text-destructive',
  OrchestratorAgent: 'bg-muted text-muted-foreground',
  HumanReviewGate: 'bg-purple-500/15 text-purple-500',
};

interface AuditEvent {
  id: string;
  created_at: string;
  run_id: string;
  agent: string;
  action: string;
  status: string;
  duration: string;
  summary: string;
  input_payload?: object;
  output_payload?: object;
  error_message?: string;
  retry_count?: number;
}

export default function AuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const params: Parameters<typeof api.getAuditEvents>[0] = {};
      if (agentFilter !== 'ALL') params.agent = agentFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;
      const result = await api.getAuditEvents(params);
      setEvents(result.events as AuditEvent[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit events';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [agentFilter, statusFilter]);

  const agents = [...new Set(events.map(e => e.agent))];
  const successCount = events.filter(e => e.status === 'SUCCESS').length;
  const successRate = events.length ? Math.round((successCount / events.length) * 100) : 0;

  const filtered = events.filter(e => {
    if (search && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const copyJson = (id: string, data: object) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000');

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: events.length },
          { label: 'Agents Active', value: agents.length },
          { label: 'Success Rate', value: `${successRate}%` },
          { label: 'Filtered', value: filtered.length },
        ].map(s => (
          <motion.div whileHover={{ y: -2 }} key={s.label} className="bg-card rounded-2xl border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search events..."
          className="w-56 rounded-xl"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Agents</SelectItem>
            {['TranscriptAgent', 'ValidatorAgent', 'TaskCreatorAgent', 'TrackerAgent', 'EscalationAgent', 'OrchestratorAgent'].map(a =>
              <SelectItem key={a} value={a}>{a}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="RETRY">Retry</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <a href={`${BASE_URL}/api/audit-events/export/csv`} download><Download className="w-3.5 h-3.5 mr-1.5" />CSV</a>
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <a href={`${BASE_URL}/api/audit-events/export/json`} download><Download className="w-3.5 h-3.5 mr-1.5" />JSON</a>
          </Button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm animate-pulse">Loading audit events...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">No audit events yet — run a pipeline to see agent activity here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                  <th className="p-3 w-8"></th>
                  <th className="p-3 font-medium font-mono">Timestamp</th>
                  <th className="p-3 font-medium font-mono">Run ID</th>
                  <th className="p-3 font-medium">Agent</th>
                  <th className="p-3 font-medium">Action</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Duration</th>
                  <th className="p-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(event => (
                  <>
                    <tr
                      key={event.id}
                      className={cn(
                        'border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors',
                        event.status === 'FAILED' && 'bg-destructive/5',
                        event.status === 'RETRY' && 'bg-warning/5',
                      )}
                      onClick={() => toggleExpand(event.id)}
                    >
                      <td className="p-3">
                        {expanded.has(event.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">#{event.run_id || '—'}</td>
                      <td className="p-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', agentColors[event.agent] || 'bg-muted text-muted-foreground')}>
                          {event.agent}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-xs">{event.action}</td>
                      <td className="p-3"><AuditStatusBadge status={event.status as 'SUCCESS' | 'FAILED' | 'RETRY' | 'SKIPPED'} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{event.duration || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{event.summary}</td>
                    </tr>
                    <AnimatePresence>
                      {expanded.has(event.id) && (
                        <tr key={`${event.id}-expanded`}>
                          <td colSpan={8} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 bg-muted/30 space-y-3">
                                {event.output_payload && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-muted-foreground">Output Payload</span>
                                      <button
                                        className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                        onClick={e => { e.stopPropagation(); copyJson(event.id, event.output_payload!); }}
                                      >
                                        {copied === event.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copied === event.id ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <pre className="bg-background p-3 rounded-xl text-xs font-mono overflow-auto max-h-40 border">
                                      {JSON.stringify(event.output_payload, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {event.error_message && (
                                  <div className="p-3 bg-destructive/10 rounded-xl text-xs text-destructive">
                                    <strong>Error:</strong> {event.error_message}
                                  </div>
                                )}
                                {event.retry_count != null && event.retry_count > 0 && (
                                  <p className="text-xs text-muted-foreground">Retry attempts: {event.retry_count}</p>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
