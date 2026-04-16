import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText, CheckCircle, X, Clock, Play, Download as DownloadIcon, AlertCircle, Camera, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as api from '@/lib/video-api';

interface Answer {
  question_id: number;
  question_text: string;
  question_type: string;
  answer_text?: string;
  audio_path?: string;
  audio_transcript?: string;  // 🎤 Whisper transcription
  audio_duration_seconds?: number;
  document_path?: string;
  document_type?: string;
  answered_at: string;
  duration_seconds: number;
}

interface Verification {
  verification_id?: number;
  session_id: string;
  photo_path?: string;
  photo_uploaded_at?: string;
  signature_path?: string;
  signature_uploaded_at?: string;
}

interface SessionDetail {
  session_id: string;
  employee_name: string;
  employee_id: string;
  employee_email?: string;
  meet_link: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_duration_seconds: number;
  questions_answered: number;
  total_questions: number;
  answers: Answer[];
}

export default function VideoOnboardingReview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    if (!sessionId) return;

    try {
      const [sessionData, verificationData] = await Promise.all([
        api.getVideoSession(sessionId),
        fetch(`http://localhost:8004/api/video-onboarding/sessions/${sessionId}/verification`).then(res => res.json())
      ]);
      
      setSession(sessionData);
      if (verificationData.success && verificationData.verification) {
        setVerification(verificationData.verification);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <X className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600">Session not found</p>
          <Button
            onClick={() => navigate('/video/records')}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Records
          </Button>
        </Card>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
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
      {/* Back Button */}
      <Button
        onClick={() => navigate('/video/records')}
        variant="ghost"
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Records
      </Button>

      {/* Header Card */}
      <Card className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border-3 border-indigo-400">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-black text-gray-900 mb-3">👤 {session.employee_name}</h1>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">EMPLOYEE ID</p>
                <p className="text-2xl font-bold text-gray-900">{session.employee_id}</p>
              </div>
              {session.employee_email && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-1">EMAIL</p>
                  <p className="text-lg font-semibold text-blue-600">{session.employee_email}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-lg border-2 border-emerald-400">
            <CheckCircle className="h-7 w-7 text-emerald-600" />
            <span className="font-bold text-emerald-700 text-lg">{session.status.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
      </Card>

      {/* Session Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 border-2 border-purple-300">
          <p className="text-xs font-bold text-purple-900 mb-2">📊 QUESTIONS ANSWERED</p>
          <p className="text-4xl font-black text-purple-700">{session.questions_answered}/10</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-cyan-100 to-cyan-50 border-2 border-cyan-300">
          <p className="text-xs font-bold text-cyan-900 mb-2">⏱️ TOTAL DURATION</p>
          <p className="text-2xl font-black text-cyan-700">
            {formatDuration(session.total_duration_seconds)}
          </p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-100 to-green-50 border-2 border-green-300">
          <p className="text-xs font-bold text-green-900 mb-2">📅 STARTED</p>
          <p className="text-sm font-bold text-green-700">
            {session.started_at
              ? new Date(session.started_at).toLocaleDateString()
              : 'Not started'}
          </p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-orange-100 to-orange-50 border-2 border-orange-300">
          <p className="text-xs font-bold text-orange-900 mb-2">✅ COMPLETED</p>
          <p className="text-sm font-bold text-orange-700">
            {session.completed_at
              ? new Date(session.completed_at).toLocaleDateString()
              : 'In progress'}
          </p>
        </Card>
      </div>

      {/* Meet Link */}
      <Card className="p-6 bg-gradient-to-r from-sky-100 to-blue-100 border-3 border-sky-400">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">🎥 INTERVIEW MEET LINK</h3>
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border-2 border-sky-300">
          <code className="text-blue-700 font-semibold text-lg break-all">
            {session.meet_link}
          </code>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(session.meet_link);
              toast.success('Link copied!');
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold ml-4 whitespace-nowrap"
          >
            📋 Copy
          </Button>
        </div>
      </Card>

      {/* Verification Section - Photo & Signature */}
      {verification && (verification.photo_path || verification.signature_path) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">👤 Candidate Verification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Photo */}
            {verification.photo_path && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6 border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-indigo-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-600 p-3 rounded-lg">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Candidate Photo</h3>
                      <p className="text-sm text-gray-600">
                        {verification.photo_uploaded_at 
                          ? new Date(verification.photo_uploaded_at).toLocaleString() 
                          : 'Uploaded'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-2 border-indigo-200">
                    <img
                      src={`http://localhost:8004${verification.photo_path}`}
                      alt="Candidate Photo"
                      className="w-full h-auto max-h-96 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Signature */}
            {verification.signature_path && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="p-6 border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-600 p-3 rounded-lg">
                      <PenTool className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Signature Document</h3>
                      <p className="text-sm text-gray-600">
                        {verification.signature_uploaded_at 
                          ? new Date(verification.signature_uploaded_at).toLocaleString() 
                          : 'Uploaded'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                    {(verification.signature_path.endsWith('.jpg') || 
                      verification.signature_path.endsWith('.jpeg') ||
                      verification.signature_path.endsWith('.png')) ? (
                      <img
                        src={`http://localhost:8004${verification.signature_path}`}
                        alt="Signature"
                        className="w-full h-auto max-h-96 object-contain rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.png';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-purple-400 mb-4" />
                        <p className="text-gray-700 font-semibold mb-4">
                          {verification.signature_path.split('/').pop()}
                        </p>
                        <a
                          href={`http://localhost:8004${verification.signature_path}`}
                          download={verification.signature_path.split('/').pop()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2"
                        >
                          <DownloadIcon className="h-5 w-5" />
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Q&A Answers */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Interview Answers</h2>

        <div className="space-y-4">
          {session.answers.map((answer, idx) => (
            <motion.div
              key={answer.question_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="p-6 border-l-4 border-blue-500">
                {/* Question */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900 flex-1">
                      Q{answer.question_id}: {answer.question_text}
                    </h3>
                    <span className="text-sm font-semibold text-blue-600 ml-4 whitespace-nowrap bg-blue-50 px-3 py-1 rounded">
                      {answer.duration_seconds ? formatDuration(answer.duration_seconds) : 'Unanswered'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {answer.answer_id ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-gray-600">
                          {answer.answered_at ? new Date(answer.answered_at).toLocaleString() : 'Answered'}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-600 font-semibold">Not answered</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Answer Content */}
                <div className="bg-white border-2 border-gray-200 p-4 rounded-lg">
                  {answer.answer_id ? (
                    <>
                      {/* Audio Answer */}
                      {answer.audio_path ? (
                        <div className="space-y-4">
                          {/* Audio Player */}
                          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border-2 border-indigo-300">
                            <div className="flex items-center gap-4">
                              <div className="bg-indigo-600 p-3 rounded-full">
                                <Play className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-gray-900 mb-2">Audio Answer</p>
                                <audio
                                  controls
                                  className="w-full h-10"
                                  src={`http://localhost:8004${answer.audio_path}`}
                                >
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                              <a
                                href={`http://localhost:8004${answer.audio_path}`}
                                download={`answer_q${answer.question_id}.wav`}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2"
                              >
                                <DownloadIcon className="h-4 w-4" />
                                Download
                              </a>
                            </div>
                            {answer.audio_duration_seconds && (
                              <p className="text-sm text-gray-600 mt-2">
                                Duration: {Math.round(answer.audio_duration_seconds)} seconds
                              </p>
                            )}
                          </div>
                          
                          {/* 🎤 Transcribed Text */}
                          {answer.audio_transcript && (
                            <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
                              <p className="text-xs font-bold text-amber-900 mb-2">📝 TRANSCRIPTION (Whisper)</p>
                              <p className="text-gray-900 font-medium leading-relaxed whitespace-pre-wrap">
                                {answer.audio_transcript}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : answer.question_type === 'document_upload' && answer.document_path ? (
                        <div>
                          {/* Image Preview */}
                          {(answer.document_path.endsWith('.png') || answer.document_path.endsWith('.jpg') || answer.document_path.endsWith('.jpeg')) && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                              <img
                                src={`http://localhost:8004${answer.document_path}`}
                                alt={answer.document_type}
                                className="w-full max-h-96 object-contain rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/placeholder.png';
                                }}
                              />
                            </div>
                          )}
                          {/* Document Info & Download */}
                          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <div className="flex items-center gap-4">
                              <div className="bg-blue-600 p-3 rounded-lg">
                                <FileText className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-lg">
                                  {answer.document_type?.toUpperCase()} Document
                                </p>
                                <p className="text-sm text-gray-600">
                                  {answer.document_path.split('/').pop()}
                                </p>
                              </div>
                            </div>
                            <a
                              href={`http://localhost:8004${answer.document_path}`}
                              download={answer.document_path.split('/').pop()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 whitespace-nowrap"
                            >
                              <Download className="h-5 w-5" />
                              Download
                            </a>
                          </div>
                        </div>
                      ) : answer.answer_text ? (
                        <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-green-500">
                          <p className="text-gray-900 font-medium whitespace-pre-wrap text-base leading-relaxed">
                            {answer.answer_text}
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                          <p className="text-yellow-900 font-medium">ⓘ No answer provided</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-6 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 text-center">
                      <AlertCircle className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-700 font-semibold">This question was not answered</p>
                      <p className="text-sm text-gray-600 mt-1">Employee did not provide a response</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* HR Actions */}
      <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
        <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 HR Review Actions</h3>
        <div className="flex gap-3 flex-wrap">
          <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold">
            <CheckCircle className="h-5 w-5 mr-2" />
            Approve Onboarding
          </Button>
          <Button variant="outline" className="border-2 border-orange-500 text-orange-700 hover:bg-orange-50 font-semibold">
            📝 Request Follow-up
          </Button>
          <Button variant="destructive" className="font-semibold">
            ✗ Reject
          </Button>
          <Button variant="outline" className="font-semibold">
            💾 Save & Review Later
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
