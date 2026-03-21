import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AuditTable } from '@/components/procurement/AuditTable';
import * as procurementApi from '@/lib/procurementApi';

export default function ProcurementAuditLog() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<procurementApi.AuditEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchAuditLog = async () => {
      try {
        const response = await procurementApi.getAllAuditLog();
        // Sort by newest first
        const sorted = [...response.events].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setEvents(sorted);
      } catch (error) {
        toast.error('Failed to load audit log');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLog();

    const interval = setInterval(fetchAuditLog, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = events.filter((event) => {
    // Status filter
    if (statusFilter !== 'all' && event.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        event.agent_name.toLowerCase().includes(term) ||
        event.action.toLowerCase().includes(term) ||
        event.run_id?.toLowerCase().includes(term) ||
        event.id.toLowerCase().includes(term)
      );
    }

    return true;
  });

  const handleExportAll = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${Date.now()}.json`;
    link.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/procurement')}
            className="text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Global Audit Log</h1>
            <p className="text-slate-400 mt-1">Complete audit trail across all procurement runs</p>
          </div>
        </div>
        <Button
          onClick={handleExportAll}
          className="gap-2 bg-blue-700 hover:bg-blue-600"
        >
          <Download className="w-4 h-4" />
          Export All
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-slate-800 bg-slate-950">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search agent, action, run ID..."
                  className="bg-slate-900 border-slate-700 pl-9 text-slate-100 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILURE">Failure</SelectItem>
                  <SelectItem value="RETRY">Retry</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="SKIPPED">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Results</label>
              <div className="flex items-center h-9 bg-slate-900 border border-slate-700 rounded px-3">
                <span className="text-sm text-slate-300">
                  {filteredEvents.length} of {events.length} events
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-slate-800 bg-slate-950">
        <CardHeader>
          <CardTitle>Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 bg-slate-900/40" />
              ))}
            </div>
          ) : (
            <AuditTable events={filteredEvents} showRunId={true} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
