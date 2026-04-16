import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as api from '@/lib/video-api';

interface Session {
  session_id: string;
  employee_name: string;
  employee_id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  progress: number;
}

export default function VideoOnboardingRecords() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const result = await api.listVideoSessions(undefined, filter === 'all' ? undefined : filter);
      setSessions(result.sessions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-8 rounded-lg border-3 border-indigo-400">
        <h1 className="text-4xl font-black text-gray-900 mb-2">📋 Interview Records</h1>
        <p className="text-lg text-gray-700 font-semibold">View all employee onboarding interview sessions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-blue-600 hover:bg-blue-700 font-bold' : 'font-semibold border-2'}
        >
          📊 All Sessions
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          onClick={() => setFilter('completed')}
          className={filter === 'completed' ? 'bg-green-600 hover:bg-green-700 font-bold' : 'font-semibold border-2'}
        >
          ✅ Completed
        </Button>
        <Button
          variant={filter === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilter('pending')}
          className={filter === 'pending' ? 'bg-orange-600 hover:bg-orange-700 font-bold' : 'font-semibold border-2'}
        >
          ⏳ In Progress
        </Button>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No interview sessions found</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session, idx) => (
            <motion.div
              key={session.session_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="p-6 hover:shadow-xl transition-all border-2 border-gray-200 hover:border-blue-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Employee Info */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-3 rounded-lg border-2 border-blue-300">
                        {getStatusIcon(session.status)}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">
                          {session.employee_name}
                        </h3>
                        <p className="text-sm font-semibold text-gray-600">ID: {session.employee_id}</p>
                      </div>
                    </div>

                    {/* Progress & Status */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-2 border-purple-300">
                        <p className="text-xs font-bold text-purple-900 mb-1">STATUS</p>
                        <span className={`inline-block px-3 py-1 text-sm font-bold rounded-full ${getStatusBadgeColor(session.status)}`}>
                          {session.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="bg-gradient-to-br from-cyan-50 to-blue-100 p-4 rounded-lg border-2 border-cyan-300">
                        <p className="text-xs font-bold text-cyan-900 mb-2">PROGRESS</p>
                        <p className="text-3xl font-black text-cyan-700 mb-2">{Math.round(session.progress)}%</p>
                        <div className="w-full bg-gray-300 rounded-full h-3 mt-1">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${session.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-4 rounded-lg border-2 border-green-300">
                        <p className="text-xs font-bold text-green-900 mb-1">CREATED</p>
                        <p className="text-lg font-bold text-green-700">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => navigate(`/video/review/${session.session_id}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      <Eye className="h-5 w-5 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
