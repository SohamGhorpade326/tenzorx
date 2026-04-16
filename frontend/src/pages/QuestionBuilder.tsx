import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Edit, Trash2, CheckCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '@/lib/video-api';

interface QuestionSet {
  set_id: string;
  name: string;
  is_active: boolean;
  questions: any[];
}

export default function QuestionBuilder() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const loadQuestionSets = async () => {
    try {
      setLoading(true);
      const data = await api.getQuestionSets();
      setSets(data.sets || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load question sets';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (setId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      setDeletingId(setId);
      await api.deleteQuestionSet(setId);
      toast.success(`"${name}" deleted successfully`);
      setSets(sets.filter(s => s.set_id !== setId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete question set';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleActivate = async (setId: string, name: string) => {
    try {
      await api.activateQuestionSet(setId);
      // Update local state
      setSets(sets.map(s => ({
        ...s,
        is_active: s.set_id === setId
      })));
      toast.success(`"${name}" is now active`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate question set';
      toast.error(message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">📋 Question List Builder</h1>
          <p className="text-gray-600">Create and manage custom interview question sets</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate('/video/onboarding')}
            variant="outline"
            className="border-gray-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => navigate('/video/builder/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Set
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading question sets...</p>
          </div>
        </div>
      ) : sets.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Question Sets Yet</h2>
          <p className="text-gray-600 mb-6">Create your first question set to get started</p>
          <Button
            onClick={() => navigate('/video/builder/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Set
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {sets.map((set, idx) => (
              <motion.div
                key={set.set_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={`p-6 border-l-4 transition-all ${
                  set.is_active 
                    ? 'border-l-green-500 bg-green-50 border-2 border-green-200' 
                    : 'border-l-blue-500 border-2 border-gray-200'
                }`}>
                  <div className="flex items-start justify-between gap-6">
                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-gray-900">{set.name}</h3>
                        {set.is_active && (
                          <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </div>
                        )}
                      </div>
                      <p className="text-gray-300">
                        {set.questions.length} question{set.questions.length !== 1 ? 's' : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {set.questions.map((q, qIdx) => (
                          <span
                            key={qIdx}
                            className="text-xs bg-gray-700 text-gray-100 px-2 py-1 rounded"
                            title={q.question_text}
                          >
                            Q{qIdx + 1}: {q.question_type === 'document_upload' ? '📄' : q.question_type === 'audio' ? '🎙️' : '❓'} {q.question_text.substring(0, 30)}...
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 shrink-0">
                      {!set.is_active && (
                        <Button
                          onClick={() => handleActivate(set.set_id, set.name)}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold"
                        >
                          <Circle className="h-4 w-4 mr-2" />
                          Set Active
                        </Button>
                      )}
                      <Button
                        onClick={() => navigate(`/video/builder/edit/${set.set_id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(set.set_id, set.name)}
                        disabled={deletingId === set.set_id}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingId === set.set_id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
