import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, UserPlus, Edit, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import * as api from '@/lib/api';

interface Escalation {
  id: string;
  task_id: string;
  task_title: string;
  owner: string;
  overdue_by_days: number;
  deadline?: string;
  source_meeting?: string;
  message: string;
  status: 'PENDING_APPROVAL' | 'SENT' | 'REJECTED';
  created_at: string;
  approved_by?: string;
  sent_at?: string;
}

export default function Escalations() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const result = await api.getEscalations();
      setEscalations(result.escalations as Escalation[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load escalations';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pending = escalations.filter(e => e.status === 'PENDING_APPROVAL');
  const history = escalations.filter(e => e.status !== 'PENDING_APPROVAL');

  const handleApprove = async (id: string) => {
    try {
      await api.approveEscalation(id);
      toast.success('Escalation approved and sent');
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve';
      toast.error(msg);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectEscalation(id);
      toast.success('Escalation rejected');
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm animate-pulse">Loading escalations...</div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg">
            Pending Review {pending.length > 0 && (
              <span className="ml-2 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          <AnimatePresence>
            {pending.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card rounded-2xl border p-12 text-center"
              >
                <p className="text-muted-foreground text-sm">No pending escalations — all clear! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">Escalations appear here when tasks become overdue</p>
              </motion.div>
            ) : (
              pending.map(esc => (
                <EscalationCard
                  key={esc.id}
                  escalation={esc}
                  editing={editingId === esc.id}
                  onEdit={() => setEditingId(editingId === esc.id ? null : esc.id)}
                  onApprove={() => handleApprove(esc.id)}
                  onReject={() => handleReject(esc.id)}
                />
              ))
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border overflow-hidden"
          >
            {history.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No escalation history yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="p-3 font-medium">Task</th>
                    <th className="p-3 font-medium">Recipient</th>
                    <th className="p-3 font-medium">Sent At</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(esc => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={esc.id} 
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3 font-medium">{esc.task_title}</td>
                      <td className="p-3">{esc.owner}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {esc.sent_at ? new Date(esc.sent_at).toLocaleString() : '—'}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${esc.status === 'SENT' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                          {esc.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function EscalationCard({ escalation, editing, onEdit, onApprove, onReject }: {
  escalation: Escalation;
  editing: boolean;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [message, setMessage] = useState(escalation.message);

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0, overflow: 'hidden' }}
      className="bg-card rounded-2xl border p-5 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{escalation.task_title}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {escalation.deadline && <span>Deadline: {escalation.deadline}</span>}
            <span>Owner: {escalation.owner}</span>
            {escalation.source_meeting && <span>Source: {escalation.source_meeting}</span>}
          </div>
        </div>
        {escalation.overdue_by_days > 0 && (
          <span className="bg-destructive/15 text-destructive text-xs font-medium px-2.5 py-1 rounded-full">
            OVERDUE by {escalation.overdue_by_days} days
          </span>
        )}
      </div>

      <div className="border-t" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">AI-drafted escalation message</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={onEdit}>
            <Edit className="w-3 h-3 mr-1" /> {editing ? 'Preview' : 'Edit message'}
          </Button>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-1">
          <p className="text-xs text-muted-foreground"><strong>To:</strong> {escalation.owner}</p>
          <p className="text-xs text-muted-foreground"><strong>Subject:</strong> {escalation.task_title} — Action Required</p>
          <div className="mt-3">
            {editing ? (
              <Textarea value={message} onChange={e => setMessage(e.target.value)} className="min-h-[120px] rounded-xl" />
            ) : (
              <p className="whitespace-pre-line text-sm">{message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-lg bg-success hover:bg-success/90 text-success-foreground" onClick={onApprove}>
          <Check className="w-3.5 h-3.5 mr-1.5" /> Approve & Send
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg text-destructive" onClick={onReject}>
          <X className="w-3.5 h-3.5 mr-1.5" /> Reject
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg">
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Reassign Task Instead
        </Button>
      </div>
    </motion.div>
  );
}
