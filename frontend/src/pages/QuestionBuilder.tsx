import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, BookOpen, Briefcase, FileText, MessageSquare, CheckCircle2, Clock, HelpCircle, X, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id: number;
  text: string;
  type: 'audio' | 'yes_no' | 'document_upload';
  required: boolean;
  timer_seconds: number;
  document_type?: string;
}

interface QuestionSet {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  isActive: boolean;
  category: string;
  createdDate: string;
  isCustom?: boolean;
}

// Predefined question sets
const PREDEFINED_SETS: QuestionSet[] = [
  {
    id: 'video-onboarding-v2',
    name: 'Video Onboarding - Standard',
    description: 'Refactored 10-question video onboarding flow (audio only)',
    category: 'Video Onboarding',
    isActive: true,
    createdDate: '2026-04-01',
    questions: [
      { id: 1, text: 'Can you please state your full name as per your PAN or Aadhaar?', type: 'audio', required: true, timer_seconds: 60 },
      { id: 2, text: 'What is your date of birth?', type: 'audio', required: true, timer_seconds: 60 },
      { id: 3, text: 'What is your current residential address?', type: 'audio', required: true, timer_seconds: 90 },
      { id: 4, text: 'Are you salaried or self-employed?', type: 'audio', required: true, timer_seconds: 60 },
      { id: 5, text: 'What is your current monthly or annual income?', type: 'audio', required: true, timer_seconds: 90 },
      { id: 6, text: 'Where are you currently working or what is your business name?', type: 'audio', required: true, timer_seconds: 90 },
      { id: 7, text: 'What is the purpose of the loan you are applying for?', type: 'audio', required: true, timer_seconds: 90 },
      { id: 8, text: 'What loan amount are you looking for and for how long (tenure)?', type: 'audio', required: true, timer_seconds: 90 },
      { id: 9, text: 'Do you currently have any existing loans or EMIs?', type: 'audio', required: true, timer_seconds: 60 },
      { id: 10, text: 'Do you consent to this video-based onboarding and confirm that all the information provided is accurate?', type: 'audio', required: true, timer_seconds: 60 },
    ],
  },
];

const getQuestionTypeIcon = (type: string) => {
  switch (type) {
    case 'audio':
      return <MessageSquare className="w-4 h-4 text-blue-600" />;
    case 'yes_no':
      return <HelpCircle className="w-4 h-4 text-purple-600" />;
    case 'document_upload':
      return <FileText className="w-4 h-4 text-orange-600" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
};

const getQuestionTypeLabel = (type: string) => {
  switch (type) {
    case 'audio':
      return '🎙️ Audio';
    case 'yes_no':
      return '❓ Yes/No';
    case 'document_upload':
      return '📄 Document';
    default:
      return type;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Loan Origination':
      return <Briefcase className="w-5 h-5 text-blue-600" />;
    case 'HR Onboarding':
      return <BookOpen className="w-5 h-5 text-green-600" />;
    default:
      return <FileText className="w-5 h-5 text-gray-600" />;
  }
};

export default function QuestionBuilder() {
  const [sets, setSets] = useState<QuestionSet[]>(PREDEFINED_SETS);
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'create' | 'create-method'>('grid');
  const [createMethod, setCreateMethod] = useState<'predefined' | 'custom' | null>(null);
  
  // Create Form States
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Custom');
  const [formQuestions, setFormQuestions] = useState<Question[]>([]);
  const [selectedPredefinedQuestions, setSelectedPredefinedQuestions] = useState<Question[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  const handleActivate = (setId: string) => {
    setSets(sets.map(set => ({
      ...set,
      isActive: set.id === setId,
    })));
    toast.success('Question set activated successfully! 🎉');
  };

  const handleDelete = (setId: string) => {
    const set = sets.find(s => s.id === setId);
    if (set?.isActive) {
      toast.error('Cannot delete an active question set. Deactivate it first.');
      return;
    }
    setSets(sets.filter(s => s.id !== setId));
    toast.success('Question set deleted successfully.');
  };

  const handleViewDetail = (set: QuestionSet) => {
    setSelectedSet(set);
    setViewMode('detail');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedSet(null);
  };

  // Create Set Handlers
  const handleStartCreate = () => {
    setCreateMethod(null);
    setFormName('');
    setFormDescription('');
    setFormCategory('Custom');
    setFormQuestions([]);
    setSelectedPredefinedQuestions([]);
    setEditingQuestionId(null);
    setViewMode('create-method');
  };

  const handleChoosePredefined = () => {
    setCreateMethod('predefined');
    setViewMode('create');
  };

  const handleChooseCustom = () => {
    setCreateMethod('custom');
    setFormQuestions([]);
    setViewMode('create');
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: Math.max(...formQuestions.map(q => q.id), 0) + 1,
      text: '',
      type: 'audio',
      required: true,
      timer_seconds: 60,
    };
    setFormQuestions([...formQuestions, newQuestion]);
    setEditingQuestionId(newQuestion.id);
  };

  const handleUpdateQuestion = (id: number, field: string, value: any) => {
    setFormQuestions(formQuestions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const handleRemoveQuestion = (id: number) => {
    setFormQuestions(formQuestions.filter(q => q.id !== id));
    if (editingQuestionId === id) setEditingQuestionId(null);
  };

  const handleTogglePredefinedQuestion = (question: Question) => {
    setSelectedPredefinedQuestions(prev => {
      const exists = prev.find(q => q.id === question.id);
      if (exists) {
        return prev.filter(q => q.id !== question.id);
      } else {
        return [...prev, { ...question, id: Math.max(...prev.map(q => q.id), 0) + 1 }];
      }
    });
  };

  const getAllPredefinedQuestions = (): Question[] => {
    const allQuestions: Question[] = [];
    PREDEFINED_SETS.forEach((set, setIndex) => {
      set.questions.forEach((q, qIndex) => {
        allQuestions.push({
          ...q,
          id: setIndex * 100 + qIndex,
        });
      });
    });
    return allQuestions;
  };

  const handleSaveCustomSet = () => {
    if (!formName.trim()) {
      toast.error('Please enter a set name');
      return;
    }

    const questionsToUse = createMethod === 'predefined' ? selectedPredefinedQuestions : formQuestions;

    if (questionsToUse.length === 0) {
      toast.error('Please select or add at least one question');
      return;
    }

    if (questionsToUse.some(q => !q.text.trim())) {
      toast.error('All questions must have text');
      return;
    }

    const newSet: QuestionSet = {
      id: `custom-${Date.now()}`,
      name: formName,
      description: formDescription || 'Custom question set',
      category: formCategory,
      questions: questionsToUse,
      isActive: false,
      createdDate: new Date().toISOString().split('T')[0],
      isCustom: true,
    };

    setSets([...sets, newSet]);
    toast.success('✅ Custom question set created successfully!');
    setViewMode('grid');
    setFormName('');
    setFormDescription('');
    setFormQuestions([]);
    setSelectedPredefinedQuestions([]);
  };

  const handleCancelCreate = () => {
    setViewMode('grid');
    setFormName('');
    setFormDescription('');
    setFormQuestions([]);
    setSelectedPredefinedQuestions([]);
    setCreateMethod(null);
  };

  // Create View - Predefined Questions
  if (viewMode === 'create' && createMethod === 'predefined') {
    const allQuestions = getAllPredefinedQuestions();

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
        {/* Bank Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <motion.button
              whileHover={{ x: -4 }}
              onClick={() => setViewMode('create-method')}
              className="text-blue-600 hover:text-blue-700 font-semibold mb-4 flex items-center gap-2"
            >
                                placeholder="e.g., pan_aadhaar, salary_proof, other"
            </motion.button>
            <h1 className="text-3xl font-bold text-blue-900">📚 Select Questions</h1>
            <p className="text-gray-600 mt-1">Choose from our library of questions</p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Set Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">📋 Set Details</h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Set Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., My Custom Interview Set"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe this question set..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Custom</option>
                    <option>Loan Origination</option>
                    <option>HR Onboarding</option>
                    <option>Verification</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Questions Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">🎯 Available Questions ({selectedPredefinedQuestions.length} selected)</h2>
              </div>

              <div className="p-6">
                {allQuestions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No questions available</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {allQuestions.map((question, index) => (
                      <motion.div
                        key={`${question.id}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedPredefinedQuestions.some(q => q.text === question.text && q.type === question.type)}
                            onChange={() => handleTogglePredefinedQuestion(question)}
                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{question.text}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-xs px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700">
                                {getQuestionTypeLabel(question.type)}
                              </span>
                              {question.timer_seconds && (
                                <span className="text-xs px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700">
                                  ⏱️ {question.timer_seconds}s
                                </span>
                              )}
                              {!question.required && (
                                <span className="text-xs px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
                                  Optional
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancelCreate}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveCustomSet}
                disabled={!formName.trim() || selectedPredefinedQuestions.length === 0}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Create Question Set
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Create View - Custom Questions
  if (viewMode === 'create' && createMethod === 'custom') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
        {/* Bank Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <motion.button
              whileHover={{ x: -4 }}
              onClick={() => setViewMode('create-method')}
              className="text-blue-600 hover:text-blue-700 font-semibold mb-4 flex items-center gap-2"
            >
              ← Back to Method Selection
            </motion.button>
            <h1 className="text-3xl font-bold text-blue-900">✏️ Create Custom Questions</h1>
            <p className="text-gray-600 mt-1">Build your own questions from scratch</p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Form Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">📋 Set Details</h2>
              </div>

              <div className="p-6 space-y-4">
                {/* Set Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Set Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Advanced Loan Verification"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the purpose of this question set..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Custom</option>
                    <option>Loan Origination</option>
                    <option>HR Onboarding</option>
                    <option>Verification</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">🎯 Questions ({formQuestions.length})</h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddQuestion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </motion.button>
              </div>

              <div className="p-6">
                {formQuestions.length === 0 ? (
                  <div className="text-center py-12">
                    <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No questions yet. Click "Add Question" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formQuestions.map((question, index) => (
                      <motion.div
                        key={question.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="space-y-3">
                          {/* Question Number and Delete */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-600">Q{index + 1}</span>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRemoveQuestion(question.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </motion.button>
                          </div>

                          {/* Question Text */}
                          <input
                            type="text"
                            value={question.text}
                            onChange={(e) => handleUpdateQuestion(question.id, 'text', e.target.value)}
                            placeholder="Enter question text..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />

                          {/* Question Type, Timer, Required */}
                          <div className="grid md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 mb-1 block">Type</label>
                              <select
                                value={question.type}
                                onChange={(e) => handleUpdateQuestion(question.id, 'type', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="audio">🎙️ Audio</option>
                                <option value="yes_no">❓ Yes/No</option>
                                <option value="document_upload">📄 Document</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-gray-600 mb-1 block">Timer (sec)</label>
                              <input
                                type="number"
                                value={question.timer_seconds}
                                onChange={(e) => handleUpdateQuestion(question.id, 'timer_seconds', parseInt(e.target.value))}
                                min="30"
                                step="30"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-gray-600 mb-1 block">Required</label>
                              <input
                                type="checkbox"
                                checked={question.required}
                                onChange={(e) => handleUpdateQuestion(question.id, 'required', e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Document Type (if applicable) */}
                          {question.type === 'document_upload' && (
                            <div>
                              <label className="text-xs font-semibold text-gray-600 mb-1 block">Document Type</label>
                              <input
                                type="text"
                                value={question.document_type || ''}
                                onChange={(e) => handleUpdateQuestion(question.id, 'document_type', e.target.value)}
                                placeholder="e.g., aadhar, pan, salary_slip"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 sticky bottom-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancelCreate}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveCustomSet}
                disabled={!formName.trim() || formQuestions.length === 0}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Question Set
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Create Method Selection View
  if (viewMode === 'create-method') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
        {/* Bank Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <motion.button
              whileHover={{ x: -4 }}
              onClick={handleCancelCreate}
              className="text-blue-600 hover:text-blue-700 font-semibold mb-4 flex items-center gap-2"
            >
              ← Back to Sets
            </motion.button>
            <h1 className="text-3xl font-bold text-blue-900">✨ Create Question Set</h1>
            <p className="text-gray-600 mt-1">Choose how you want to create your custom question set</p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 gap-8"
          >
            {/* Option 1: Use Predefined Questions */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
              onClick={handleChoosePredefined}
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h2 className="text-2xl font-bold text-white">From Predefined</h2>
                </div>
              </div>

              <div className="p-8 space-y-4">
                <p className="text-gray-600">Select questions from our library of predefined questions</p>
                
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span>Browse all available questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span>Mix & match from any category</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span>Create in minutes</span>
                  </li>
                </ul>

                <div className="pt-4 mt-6 border-t border-gray-200">
                  <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Choose from Library
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Option 2: Create Custom Questions */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
              onClick={handleChooseCustom}
            >
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">✏️</div>
                  <h2 className="text-2xl font-bold text-white">Build Custom</h2>
                </div>
              </div>

              <div className="p-8 space-y-4">
                <p className="text-gray-600">Create your own questions from scratch</p>
                
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span>Full control over questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span>Set timers & types</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span>Fully personalized</span>
                  </li>
                </ul>

                <div className="pt-4 mt-6 border-t border-gray-200">
                  <button className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    Build Custom Questions
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Detail View
  if (viewMode === 'detail' && selectedSet) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
        {/* Bank Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <motion.button
              whileHover={{ x: -4 }}
              onClick={handleBackToGrid}
              className="text-blue-600 hover:text-blue-700 font-semibold mb-4 flex items-center gap-2"
            >
              ← Back to Sets
            </motion.button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-blue-900">{selectedSet.name}</h1>
                <p className="text-gray-600 mt-1">{selectedSet.description}</p>
              </div>
              {selectedSet.isActive && (
                <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-semibold">Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Total Questions</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{selectedSet.questions.length}</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Required Questions</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {selectedSet.questions.filter(q => q.required).length}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Total Duration</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {Math.ceil(selectedSet.questions.reduce((sum, q) => sum + q.timer_seconds, 0) / 60)}m
                </p>
              </div>
            </div>

            {/* Questions List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Questions</h2>
              </div>

              <div className="divide-y divide-gray-200">
                {selectedSet.questions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-6 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-blue-700">
                        {index + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-gray-900 font-semibold">{question.text}</p>
                          {!question.required && (
                            <span className="px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs font-semibold">
                              Optional
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-2">
                            {getQuestionTypeIcon(question.type)}
                            <span className="text-gray-600">{getQuestionTypeLabel(question.type)}</span>
                          </div>

                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{question.timer_seconds}s</span>
                          </div>

                          {question.document_type && (
                            <div className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-purple-700 text-xs font-semibold">
                              {question.document_type}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {!selectedSet.isActive && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    handleActivate(selectedSet.id);
                    setTimeout(handleBackToGrid, 1000);
                  }}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Set Active
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBackToGrid}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Bank Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-blue-900">📋 Question Builder</h1>
              <p className="text-gray-600 mt-1">Manage predefined question sets for interviews</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartCreate}
              className="flex-shrink-0 ml-6 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Create Custom Set
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Total Sets</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{sets.length}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Custom Sets</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{sets.filter(s => s.isCustom).length}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Active Set</p>
            <p className="text-lg font-semibold text-gray-900 mt-2">
              {sets.find(s => s.isActive)?.name || 'None'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm uppercase tracking-wider font-semibold">Categories</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {[...new Set(sets.map(s => s.category))].slice(0, 3).map(cat => (
                <span key={cat} className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs font-semibold">
                  {cat}
                </span>
              ))}
              {[...new Set(sets.map(s => s.category))].length > 3 && (
                <span className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs font-semibold">
                  +{[...new Set(sets.map(s => s.category))].length - 3}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Question Sets Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* CREATE CUSTOM SET CARD - FIRST CARD */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0 }}
            onClick={handleStartCreate}
            className="group bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md border-2 border-dashed border-green-300 hover:border-green-500 hover:shadow-lg transition-all overflow-hidden cursor-pointer relative min-h-64 flex items-center justify-center"
          >
            <div className="text-center p-8">
              <div className="text-6xl mb-4">✨</div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">Create Custom Set</h2>
              <p className="text-green-700 mb-4">Build your own question set</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold group-hover:bg-green-700 transition-colors">
                <Plus className="w-5 h-5" />
                Start Creating
              </div>
            </div>
          </motion.div>

          {/* EXISTING QUESTION SETS */}
          {sets.map((set, index) => (
            <motion.div
              key={set.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-4 flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getCategoryIcon(set.category)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{set.name}</h3>
                      {set.isCustom && (
                        <span className="px-2 py-1 bg-purple-100 border border-purple-300 rounded-full text-purple-700 text-xs font-bold">
                          Custom ✨
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{set.category}</p>
                  </div>
                </div>

                {set.isActive && (
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-600 line-clamp-2">{set.description}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{set.questions.length}</p>
                    <p className="text-xs text-gray-600 mt-1">Questions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{set.questions.filter(q => q.required).length}</p>
                    <p className="text-xs text-gray-600 mt-1">Required</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{Math.ceil(set.questions.reduce((sum, q) => sum + q.timer_seconds, 0) / 60)}m</p>
                    <p className="text-xs text-gray-600 mt-1">Duration</p>
                  </div>
                </div>

                {/* Question Types */}
                <div className="flex flex-wrap gap-1 pt-2">
                  {[...new Set(set.questions.map(q => q.type))].map(type => (
                    <div key={type} className="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs">
                      {getQuestionTypeIcon(type)}
                      <span className="text-gray-700">{type === 'yes_no' ? 'Yes/No' : type === 'audio' ? 'Audio' : 'Document'}</span>
                    </div>
                  ))}
                </div>

                {/* Meta */}
                <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                  Created: {new Date(set.createdDate).toLocaleDateString()}
                </p>
              </div>

              {/* Footer Actions */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleViewDetail(set)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 text-sm"
                >
                  <Eye className="w-4 h-4" />
                  View
                </motion.button>

                {!set.isActive && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleActivate(set.id)}
                    className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-1 text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Activate
                  </motion.button>
                )}

                {!set.isActive && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(set.id)}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {sets.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No question sets available</p>
            <p className="text-gray-400 text-sm mt-2">Create a new set to get started</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
