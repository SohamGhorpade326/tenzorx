import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as api from '@/lib/video-api';

interface Question {
  question_text: string;
  question_type: 'document_upload' | 'yes_no' | 'audio';
  required: boolean;
  timer_seconds: number;
  document_type?: string;
}

export default function QuestionSetEditor() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!setId;

  const [setName, setSetName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: 'Why are you interested in this role?',
      question_type: 'audio',
      required: true,
      timer_seconds: 240,
    }
  ]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && setId) {
      loadQuestionSet();
    }
  }, [setId, isEdit]);

  const loadQuestionSet = async () => {
    try {
      setLoading(true);
      const data = await api.getQuestionSets();
      const set = data.sets.find(s => s.set_id === setId);
      
      if (!set) {
        toast.error('Question set not found');
        navigate('/video/builder');
        return;
      }
      
      setSetName(set.name);
      setQuestions(set.questions.map(q => ({
        question_text: q.question_text,
        question_type: q.question_type,
        required: q.required,
        timer_seconds: q.timer_seconds,
        document_type: q.document_type,
      })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load question set';
      toast.error(message);
      navigate('/video/builder');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    if (questions.length >= 20) {
      toast.error('Maximum 20 questions allowed');
      return;
    }
    
    setQuestions([
      ...questions,
      {
        question_text: '',
        question_type: 'audio',
        required: true,
        timer_seconds: 240,
      }
    ]);
  };

  const handleUpdateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error('At least 1 question is required');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleDuplicateQuestion = (index: number) => {
    if (questions.length >= 20) {
      toast.error('Maximum 20 questions allowed');
      return;
    }
    
    const newQuestion = { ...questions[index] };
    const updated = [...questions];
    updated.splice(index + 1, 0, newQuestion);
    setQuestions(updated);
  };

  const handleSave = async () => {
    try {
      // Validation
      if (!setName.trim()) {
        toast.error('Set name is required');
        return;
      }
      
      if (questions.length === 0) {
        toast.error('At least 1 question is required');
        return;
      }
      
      if (questions.length > 20) {
        toast.error('Maximum 20 questions allowed');
        return;
      }
      
      for (let q of questions) {
        if (!q.question_text.trim()) {
          toast.error('All questions must have text');
          return;
        }
        if (!['document_upload', 'yes_no', 'audio'].includes(q.question_type)) {
          toast.error('Invalid question type');
          return;
        }
      }
      
      setSaving(true);
      
      if (isEdit && setId) {
        await api.updateQuestionSet(setId, setName, questions);
        toast.success('Question set updated successfully');
      } else {
        await api.createQuestionSet(setName, questions);
        toast.success('Question set created successfully');
      }
      
      navigate('/video/builder');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save question set';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading question set...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6 max-w-4xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            {isEdit ? '✏️ Edit Question Set' : '➕ Create Question Set'}
          </h1>
          <p className="text-gray-600">
            {questions.length} question{questions.length !== 1 ? 's' : ''} • {questions.filter(q => q.required).length} required
          </p>
        </div>
        <Button
          onClick={() => navigate('/video/builder')}
          variant="outline"
          className="border-gray-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Set Name */}
      <Card className="p-6 border-2 border-gray-200">
        <label className="block text-sm font-bold text-gray-700 mb-2">Set Name</label>
        <input
          type="text"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          placeholder="e.g., Senior Hiring Questions"
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
        />
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Questions</h2>
          <span className="text-sm text-gray-600">{questions.length}/20</span>
        </div>

        {questions.map((q, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="p-6 border-2 border-gray-200 hover:border-blue-300 transition-colors">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl font-black text-blue-600 min-w-fit">Q{idx + 1}</div>
                
                <div className="flex-1 space-y-4">
                  {/* Question Text */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Question Text
                    </label>
                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) => handleUpdateQuestion(idx, { question_text: e.target.value })}
                      placeholder="Enter question text..."
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Row 1: Type, Required, Timer */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Type */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Type</label>
                      <select
                        value={q.question_type}
                        onChange={(e) => handleUpdateQuestion(idx, { question_type: e.target.value as any })}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                      >
                        <option value="audio">🎙️ Audio</option>
                        <option value="yes_no">❓ Yes/No</option>
                        <option value="document_upload">📄 Document</option>
                      </select>
                    </div>

                    {/* Required */}
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleUpdateQuestion(idx, { required: e.target.checked })}
                          className="w-4 h-4 rounded border-2 border-gray-300"
                        />
                        <span className="font-bold text-gray-700">Required</span>
                      </label>
                    </div>

                    {/* Timer */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Timer (seconds)
                      </label>
                      <input
                        type="number"
                        value={q.timer_seconds}
                        onChange={(e) => handleUpdateQuestion(idx, { timer_seconds: Math.max(1, parseInt(e.target.value) || 60) })}
                        min="1"
                        max="600"
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Document Type (if document_upload) */}
                  {q.question_type === 'document_upload' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Document Type</label>
                      <select
                        value={q.document_type || ''}
                        onChange={(e) => handleUpdateQuestion(idx, { document_type: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                      >
                        <option value="">None</option>
                        <option value="aadhar">Aadhar</option>
                        <option value="pan">PAN</option>
                        <option value="address_proof">Address Proof</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t-2 border-gray-200">
                <Button
                  onClick={() => handleDuplicateQuestion(idx)}
                  disabled={questions.length >= 20}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  onClick={() => handleDeleteQuestion(idx)}
                  disabled={questions.length === 1}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Add Question Button */}
      {questions.length < 20 && (
        <Button
          onClick={handleAddQuestion}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Question ({questions.length}/20)
        </Button>
      )}

      {/* Bottom Actions */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 flex gap-3 justify-end">
        <Button
          onClick={() => navigate('/video/builder')}
          variant="outline"
          className="border-gray-300"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Set'}
        </Button>
      </Card>
    </motion.div>
  );
}
