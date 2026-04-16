import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Upload, Check, AlertCircle, Clock, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '@/lib/video-api';

interface Question {
  question_id: number;
  question_text: string;
  question_type: 'document_upload' | 'audio';
  category: string;
  required: boolean;
  order: number;
  document_type?: string;
  timer_seconds: number;
}

interface SessionDetails {
  session_id: string;
  employee_name: string;
  meet_link: string;
  status: string;
  questions_count: number;
}

export default function VideoOnboardingRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // ============ STATE MANAGEMENT ============
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [interviewStarted, setInterviewStarted] = useState(false);

  // Question flow
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Timers
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Recording state - CRITICAL
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Document upload state
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============ REFS (PREVENT STALE CLOSURES) ============
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  const currentQuestionRef = useRef<Question | null>(null);
  const timeRemainingRef = useRef(0);
  const recordingDurationRef = useRef(0);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    if (currentQuestion) {
      console.log(`📌 Current Question: Q${currentQuestion.question_id} - Type: ${currentQuestion.question_type}`);
    }
  }, [currentQuestion]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    recordingDurationRef.current = recordingDuration;
  }, [recordingDuration]);

  // ============ SESSION INITIALIZATION ============
  useEffect(() => {
    const initSession = async () => {
      if (!sessionId) return;

      try {
        const sessionData = await api.getVideoSession(sessionId);
        setSession(sessionData);

        const questionsData = await api.getVideoOnboardingQuestions();
        setTotalQuestions(questionsData.total);
        console.log('✅ Questions loaded:', questionsData.total);
        console.log('📋 Question types:', questionsData.questions?.map((q: any) => ({ id: q.question_id, type: q.question_type, text: q.question_text })));
      } catch (err) {
        console.error('❌ Failed to load session:', err);
        toast.error('Failed to load session');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [sessionId, navigate]);

  // ============ INTERVIEW START ============
  const handleStartInterview = useCallback(async () => {
    if (!session?.session_id) return;

    try {
      const result = await api.startVideoOnboarding(session.session_id);
      setInterviewStarted(true);
      setCurrentQuestion(result.first_question);
      setQuestionIndex(0);

      if (result.first_question?.timer_seconds) {
        startTimer(result.first_question.timer_seconds);
      }

      toast.success('Interview started!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start interview';
      toast.error(message);
    }
  }, [session]);

  // ============ TIMER LOGIC ============
  const startTimer = useCallback((seconds: number) => {
    setTimeRemaining(seconds);

    if (timerInterval.current) clearInterval(timerInterval.current);

    timerInterval.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleAutoSubmit = useCallback(async () => {
    if (!currentQuestion) return;

    console.log('⏰ [AUTO SUBMIT] Time expired for Q' + currentQuestion.question_id);

    // If recording, stop it
    if (isRecording) {
      console.log('⏰ Forcing stop for auto-submit');
      await stopRecordingAndSubmit();
    }

    toast.warning('Time expired! Moving to next question...');
  }, [currentQuestion, isRecording]);

  // ============ AUTO-START RECORDING FOR AUDIO QUESTIONS ============
  useEffect(() => {
    if (currentQuestion?.question_type === 'audio' && !isRecording) {
      console.log(`🎬 AUTO-STARTING RECORDING FOR Q${currentQuestion.question_id}`);
      alert(`🎬 Auto-starting recording for Q${currentQuestion.question_id}...`);
      
      // Small delay to ensure question is rendered
      const timer = setTimeout(() => {
        startRecording();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentQuestion?.question_id, currentQuestion?.question_type, isRecording]);

  // ============ STOP RECORDING FOR DOCUMENT UPLOAD QUESTIONS ============
  useEffect(() => {
    if (currentQuestion?.question_type === 'document_upload' && isRecording) {
      console.log('📄 Document upload question - canceling recording');
      cancelRecording();
    }
  }, [currentQuestion?.question_id, currentQuestion?.question_type, isRecording]);

  // ============ AUDIO RECORDING - SIMPLE MEDIARECORDER (PROVEN METHOD) ============
  const startRecording = async () => {
    console.log('🎙️ [START RECORDING] Q' + (currentQuestionRef.current?.question_id || '?'));

    try {
      if (isRecording) {
        console.log('⚠️ Already recording, ignoring');
        return;
      }

      // SIMPLE AUDIO CONSTRAINTS - PROVEN TO WORK
      console.log('🎙️ Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone accessed:', stream);
      console.log('📊 Audio tracks:', stream.getAudioTracks().length);
      
      streamRef.current = stream;

      // MEDIARECORDER - PROVEN SIMPLE METHOD
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('✅ Recording started');
        setIsRecording(true);
        setRecordingDuration(0);
        recordingDurationRef.current = 0;
        setTranscript('');
      };

      mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped');
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // Recording timer
      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration((prev) => prev + 1);
        
        if ((recordingDurationRef.current) % 5 === 0) {
          console.log(`⏱️ Recording: ${recordingDurationRef.current}s`);
        }
      }, 1000);

      // Safety timeout - auto-stop after 120 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Recording timeout - auto-stopping');
        stopRecordingAndSubmit();
      }, 120000);

      toast.success('🎙️ Recording started. Speak now!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      console.error('❌ Recording start error:', err);
      toast.error(`🔴 ${message}`);
      setIsRecording(false);
    }
  };

  const stopRecordingAndSubmit = useCallback(async () => {
    console.log('⏹️ [STOP RECORDING] Called');
    
    const recorder = mediaRecorderRef.current;
    if (!recorder || !sessionId || !currentQuestionRef.current) {
      console.error('❌ Missing state for upload');
      return;
    }

    try {
      // Stop recording and wait for onstop event
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }

      // Wait for recorder to finish processing
      await new Promise<void>((resolve) => {
        const checkState = setInterval(() => {
          if (recorder.state === 'inactive') {
            clearInterval(checkState);
            resolve();
          }
        }, 50);
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkState);
          resolve();
        }, 5000);
      });

      // Create blob from chunks
      if (audioChunksRef.current.length === 0) {
        console.error('❌ No audio chunks recorded!');
        toast.error('No audio was recorded. Please try again.');
        setIsRecording(false);
        return;
      }

      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('📦 BLOB CREATED:');
      console.log('   Size:', blob.size, 'bytes');
      console.log('   Type:', blob.type);

      if (blob.size < 1000) {
        console.warn('⚠️ WARNING: Blob is very small - audio may not have been captured properly');
        toast.warning('⚠️ Very small audio blob detected');
      }

      // Stop stream
      if (streamRef.current) {
        console.log('🛑 Stopping audio stream and tracks');
        streamRef.current.getTracks().forEach((track) => {
          console.log('   Stopping track:', track.label);
          track.stop();
        });
        streamRef.current = null;
      }

      // Clear timers
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

      const currentQ = currentQuestionRef.current;
      const duration = recordingDurationRef.current;
      const timeLeft = timeRemainingRef.current;

      try {
        // ============ STEP 1: TRANSCRIBE AUDIO WITH WHISPER ============
        console.log('🎤 [TRANSCRIBE] Starting Whisper transcription...');
        setIsTranscribing(true);

        const formData = new FormData();
        formData.append('file', blob, 'answer.webm');
        formData.append('question_id', currentQ.question_id.toString());

        console.log('📤 Sending to transcribe endpoint:', {
          blobSize: blob.size,
          questionId: currentQ.question_id,
          sessionId: sessionId,
        });

        const transcribeResponse = await fetch(
          `http://localhost:8004/api/video-onboarding/sessions/${sessionId}/transcribe-audio`,
          {
            method: 'POST',
            body: formData,
          }
        );

        console.log('📥 Transcribe response status:', transcribeResponse.status);

        if (!transcribeResponse.ok) {
          throw new Error(`Transcription failed: ${transcribeResponse.statusText}`);
        }

        const transcribeData = await transcribeResponse.json();
        console.log('✅ Transcription result:', transcribeData);
        setTranscript(transcribeData.text);
        setIsTranscribing(false);

        // ============ STEP 2: UPLOAD AUDIO ============
        console.log('📤 Uploading audio...');

        const uploadResult = await api.uploadVideoAudio(
          sessionId,
          currentQ.question_id,
          blob,
          duration,
          currentQ.timer_seconds - timeLeft
        );

        console.log('✅ Upload response:', uploadResult);

        if (uploadResult.success) {
          console.log('✅ Audio uploaded with transcription!');
          toast.success(`✅ Answer saved: "${transcribeData.text}"`);

          if (uploadResult.next_question) {
            console.log(`➡️ Moving to Q${uploadResult.next_question.question_id}`);
            setCurrentQuestion(uploadResult.next_question);
            setQuestionIndex((prev) => prev + 1);
            setRecordingDuration(0);
            setTranscript('');
            startTimer(uploadResult.next_question.timer_seconds);
          } else {
            console.log('✅ Interview complete!');
            setInterviewStarted(false);
            toast.success('🎉 Interview complete!');
            await submitForHRReview();
          }
        } else {
          console.error('❌ Upload failed:', uploadResult.message);
          toast.error(`Upload failed: ${uploadResult.message}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error';
        console.error('❌ Transcription or upload error:', err);
        toast.error(`Error: ${message}`);
      } finally {
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        recordingDurationRef.current = 0;
        setIsRecording(false);
        setIsTranscribing(false);
        console.log('🧹 Cleanup complete');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error:', err);
      toast.error(`Error: ${message}`);
      setIsRecording(false);
      setIsTranscribing(false);
    }
  }, [sessionId, startTimer]);

  const cancelRecording = useCallback(() => {
    console.log('❌ Recording cancelled');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

    setIsRecording(false);
    setRecordingDuration(0);
    setTranscript('');
  }, []);

  // ============ DOCUMENT UPLOAD ============
  const handleDocumentUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!sessionId || !currentQuestion || !e.target.files?.[0]) return;

      const file = e.target.files[0];
      console.log(`📄 Uploading ${currentQuestion.document_type}: ${file.name}`);

      setIsUploadingDoc(true);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('question_id', currentQuestion.question_id.toString());
        formData.append('document_type', currentQuestion.document_type || '');

        const result = await api.uploadVideoDocument(sessionId, formData);
        console.log('✅ Document uploaded:', result);

        if (result.success) {
          toast.success(`${currentQuestion.document_type} uploaded successfully`);

          await new Promise((resolve) => setTimeout(resolve, 500));

          if (result.next_question) {
            console.log(`➡️ Moving to Q${result.next_question.question_id}`);
            setCurrentQuestion(result.next_question);
            setQuestionIndex((prev) => prev + 1);
            startTimer(result.next_question.timer_seconds);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        console.error('❌ Upload error:', err);
        toast.error(message);
      } finally {
        setIsUploadingDoc(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [sessionId, currentQuestion, startTimer]
  );

  // ============ HR REVIEW SUBMISSION ============
  const submitForHRReview = useCallback(async () => {
    if (!sessionId) return;

    try {
      const result = await api.submitVideoOnboardingForHR(sessionId);

      if (result.success) {
        console.log('✅ Submitted for HR review');
        toast.success('Submitted for HR review! Thank you.');
        setTimeout(() => navigate('/video/thank-you'), 2000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      console.error('❌ Submission error:', err);
      toast.error(message);
    }
  }, [sessionId, navigate]);

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="p-8 max-w-md bg-gray-900 border-gray-800">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-300">Loading session...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="p-8 max-w-md bg-gray-900 border-gray-800">
          <p className="text-red-500">Failed to load session</p>
        </Card>
      </div>
    );
  }

  // ============ UI: NOT STARTED ============
  if (!interviewStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 relative overflow-hidden p-6"
      >
        {/* Professional Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-600/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-600/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-purple-600/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-3 pb-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Professional Onboarding
            </h1>
            <p className="text-gray-300 text-lg">Welcome to your interactive interview experience</p>
          </div>

          <Card className="p-8 bg-gradient-to-br from-slate-800/60 to-blue-900/40 border border-blue-400/30 backdrop-blur-sm shadow-2xl space-y-6">
            <div className="text-center space-y-4 pb-4 border-b border-blue-500/20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <Video className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {session.employee_name}
                </p>
                <p className="text-sm text-gray-400 font-mono">{session.employee_id}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm uppercase tracking-wider text-blue-300 font-semibold">Interview Details</h3>
              <div className="bg-gradient-to-r from-slate-900/50 to-blue-900/30 rounded-lg p-4 space-y-3 border border-blue-500/10">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📋</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Questions</p>
                    <p className="text-lg font-bold text-white">{totalQuestions} comprehensive questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl">⏱️</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Time Limit</p>
                    <p className="text-lg font-bold text-white">Each question is time-limited</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl">🎙️</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">AI Transcription</p>
                    <p className="text-lg font-bold text-white">Powered by Whisper</p>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartInterview}
              size="lg"
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl"
            >
              <Video className="mr-2 h-5 w-5" />
              Start Interview
            </Button>

            <p className="text-xs text-center text-gray-400 bg-gray-900/30 rounded px-3 py-2">
              💡 Make sure your microphone is enabled and you're in a quiet environment. Your audio will be transcribed using AI.
            </p>
          </Card>
        </div>
      </motion.div>
    );
  }

  // ============ UI: INTERVIEW FLOW ============
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 relative overflow-hidden p-6"
    >
      {/* Professional Interview Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-600/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-600/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-purple-600/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto space-y-6">
        {/* DEBUG: Show current state */}
        <div className="bg-yellow-900/40 border border-yellow-600/50 rounded p-3 text-xs text-yellow-200 font-mono">
          Q{currentQuestion?.question_id} | Type: <span className="font-bold">{currentQuestion?.question_type}</span> | Recording: <span className="font-bold">{String(isRecording)}</span> | Transcribing: <span className="font-bold">{String(isTranscribing)}</span>
        </div>

        {/* Professional Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-900/60 to-blue-900/40 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4">
          <div className="space-y-1">
            <h2 className="text-sm uppercase tracking-wider text-blue-300 font-semibold">
              Onboarding Interview
            </h2>
            <p className="text-lg font-bold text-white">
              Question {questionIndex + 1} of {totalQuestions}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border ${timeRemaining <= 30 ? 'bg-red-600/20 border-red-500/50' : 'bg-blue-600/20 border-blue-500/30'}`}>
              <Clock className="h-5 w-5" />
              <span className={`font-bold text-lg ${timeRemaining <= 30 ? 'text-red-300' : 'text-blue-300'}`}>
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-gray-400">Time Remaining</p>
          </div>
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <Card key={currentQuestion.question_id} className="p-8 bg-gradient-to-br from-slate-800/80 to-blue-900/50 border border-blue-400/30 backdrop-blur-sm shadow-2xl">
            <div className="space-y-6">
              <div className="inline-block px-4 py-2 bg-gradient-to-r from-blue-600/30 to-indigo-600/20 text-blue-200 text-xs font-semibold rounded-full border border-blue-500/30">
                {currentQuestion.category}
              </div>
              <p className="text-3xl font-bold text-white leading-relaxed">
                {currentQuestion.question_text}
              </p>
            </div>
          </Card>
        )}

        {/* Question Type: Document Upload */}
        {currentQuestion?.question_type === 'document_upload' && (
          <Card className="border-2 border-dashed border-blue-400/40 p-10 text-center cursor-pointer hover:bg-blue-900/10 hover:border-blue-400/60 transition bg-gradient-to-br from-slate-800/40 to-blue-900/20 backdrop-blur-sm">
            <div onClick={() => fileInputRef.current?.click()} className="space-y-4">
              <Upload className="h-14 w-14 text-blue-400 mx-auto" />
              <div>
                <p className="font-bold text-white text-lg">📄 Upload {currentQuestion.document_type}</p>
                <p className="text-sm text-gray-400 mt-2">Click to select file (PDF, JPG, PNG)</p>
              </div>
              {isUploadingDoc && (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                  <p className="text-xs text-blue-400">Uploading...</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleDocumentUpload}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={isUploadingDoc}
            />
          </Card>
        )}

        {/* Question Type: Audio with Whisper Transcription */}
        {currentQuestion?.question_type === 'audio' && (
          <Card className="p-8 bg-gradient-to-br from-slate-800/80 to-blue-900/50 border border-blue-400/30 backdrop-blur-sm shadow-xl space-y-6">
            {isRecording ? (
              <>
                <div className="flex items-center justify-center gap-4 bg-gradient-to-r from-red-900/30 to-orange-900/20 border-2 border-red-600/40 rounded-lg p-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-pulse">
                      <Mic className="h-8 w-8 text-red-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-red-300 text-lg">🎙️ Recording Active</p>
                      <p className="text-sm text-red-400 font-mono">
                        {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={cancelRecording}
                    variant="outline"
                    className="h-14 border-red-600/50 text-red-400 hover:bg-red-600/20 hover:border-red-500 font-bold transition-all disabled:opacity-50"
                    disabled={isTranscribing}
                  >
                    ✕ Cancel
                  </Button>
                  <Button
                    onClick={stopRecordingAndSubmit}
                    disabled={isTranscribing}
                    className="h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold flex flex-col items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50"
                  >
                    <Square className="h-5 w-5" />
                    {isTranscribing ? 'Transcribing...' : 'Submit Answer'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-3">
                  <p className="text-gray-300">Ready to answer?</p>
                </div>
                <Button
                  onClick={startRecording}
                  className="w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-lg flex flex-col items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl"
                >
                  <Mic className="h-7 w-7" />
                  🎙️ Start Recording
                </Button>
              </>
            )}

            {/* Transcription Display */}
            {transcript && (
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/20 border border-green-600/40 rounded-lg p-4">
                <p className="text-xs text-green-300 uppercase font-semibold mb-2">✅ Your Answer (Transcribed)</p>
                <p className="text-white italic">"{transcript}"</p>
              </div>
            )}

            <p className="text-xs text-center text-gray-400 bg-gray-900/30 rounded px-3 py-2">
              📝 Speak clearly and concisely. Maximum {currentQuestion.timer_seconds} seconds. Your audio will be transcribed with AI.
            </p>
          </Card>
        )}

        {/* Progress Bar */}
        <Card className="p-6 bg-gradient-to-r from-slate-900/60 to-blue-900/30 border border-blue-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Interview Progress</p>
            <p className="text-sm font-bold text-blue-300">{questionIndex + 1} / {totalQuestions}</p>
          </div>
          <div className="w-full bg-gray-800/50 rounded-full h-3 overflow-hidden border border-blue-500/20">
            <div
              className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500 shadow-lg shadow-blue-600/20"
              style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
