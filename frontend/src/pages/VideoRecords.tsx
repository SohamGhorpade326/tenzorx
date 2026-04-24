import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createVideoOnboardingSession, deleteVideoSession, listVideoSessions, startVideoOnboarding, VideoSessionResponse } from "@/lib/video-api";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, ChevronRight, FileText, CheckCircle, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function VideoRecords() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<VideoSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listVideoSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load sessions";
      setError(errorMessage);
      console.error("Error loading sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndStart = async () => {
    if (creating) return;

    const employee_name = window.prompt("Applicant full name:");
    if (!employee_name) return;

    const employee_id = window.prompt("Applicant ID:");
    if (!employee_id) return;

    const employee_email = window.prompt("Applicant email (optional):") || undefined;

    try {
      setCreating(true);
      const session = await createVideoOnboardingSession({ employee_name, employee_id, employee_email });
      await startVideoOnboarding(session.session_id);
      toast.success("Interview started");
      navigate(`/video/meet/${session.session_id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start interview";
      toast.error(errorMessage);
      console.error("Error creating/starting interview:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionName: string) => {
    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to delete the entire interview record for "${sessionName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteVideoSession(sessionId);
      
      // Remove from frontend
      setSessions(sessions.filter(s => s.session_id !== sessionId));
      
      toast.success(`Interview record for "${sessionName}" deleted successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete session";
      toast.error(`Failed to delete: ${errorMessage}`);
      console.error("Error deleting session:", err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "submitted":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "pending":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "submitted":
        return "bg-green-50 border-green-200 text-green-700";
      case "in-progress":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "pending":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "failed":
        return "bg-red-50 border-red-200 text-red-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-12 h-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading your records...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg border border-red-200 p-8 max-w-md w-full text-center"
        >
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Records</h2>
          <p className="text-red-700 text-sm mb-6">{error}</p>
          <button
            onClick={loadSessions}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Bank Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-blue-900">🏦 Interview Records</h1>
                <p className="text-gray-600 mt-1">View all video onboarding sessions and application status</p>
              </div>

              <button
                onClick={handleCreateAndStart}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>Create New Interview</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-blue-600">{sessions.length}</div>
            <p className="text-gray-600 text-sm mt-1">Total Sessions</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-green-600">
              {sessions.filter(s => s.status?.toLowerCase() === 'submitted').length}
            </div>
            <p className="text-gray-600 text-sm mt-1">Completed</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-blue-600">
              {sessions.filter(s => s.status?.toLowerCase() === 'in-progress').length}
            </div>
            <p className="text-gray-600 text-sm mt-1">In Progress</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-yellow-600">
              {sessions.filter(s => s.status?.toLowerCase() === 'pending').length}
            </div>
            <p className="text-gray-600 text-sm mt-1">Pending</p>
          </div>
        </motion.div>

        {/* Records Grid */}
        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No records found yet</p>
            <p className="text-gray-400 text-sm mt-2">Start a new video interview to see records here</p>
            <button
              onClick={handleCreateAndStart}
              disabled={creating}
              className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>Create New Interview</>
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid gap-4"
          >
            {sessions.map((session, index) => (
              <motion.div
                key={session.session_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/video/records/${session.session_id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                          <p className="font-mono text-sm text-blue-700 font-semibold">
                            ID: {session.session_id.slice(0, 12)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(session.status)}
                          <Badge className={`${getStatusColor(session.status)} border capitalize font-semibold`}>
                            {session.status}
                          </Badge>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {session.employee_name}
                      </h3>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>

                  <div className="grid md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Employee ID</p>
                      <p className="text-gray-900 font-medium mt-1">{session.employee_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Questions</p>
                      <p className="text-gray-900 font-medium mt-1">{session.questions_count || 0} Questions</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Created</p>
                      <p className="text-gray-900 font-medium mt-1">
                        {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Duration</p>
                      <p className="text-gray-900 font-medium mt-1">
                        {session.total_duration_seconds 
                          ? `${Math.floor(session.total_duration_seconds / 60)}m` 
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {session.created_at && new Date(session.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => navigate(`/video/records/${session.session_id}`)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-semibold hover:bg-blue-100 transition-colors group-hover:bg-blue-600 group-hover:text-white"
                      >
                        View Details →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.session_id, session.employee_name);
                        }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 font-semibold group-hover:bg-red-600 group-hover:text-white"
                        title="Delete this record"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
