import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Upload, Check, AlertCircle, Clock, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '@/lib/video-api';

// Helper: Get supported MIME type
function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

interface Question {
  question_id: number;
  question_text: string;
  question_type: 'document_upload' | 'yes_no' | 'audio';
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

  // Document upload state
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============ REFS (PREVENT STALE CLOSURES) ============
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  const currentQuestionRef = useRef<Question | null>(null);
  const timeRemainingRef = useRef(0);
  const recordingDurationRef = useRef(0);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
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

  // ============ AUDIO RECORDING ============
  const startRecording = useCallback(async () => {
    console.log('🎙️ [START RECORDING] Q' + (currentQuestionRef.current?.question_id || '?'));

    try {
      if (isRecording) {
        console.log('⚠️ Already recording, ignoring');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const supportedMimeType = getSupportedMimeType();
      console.log(`🎙️ Using MIME type: ${supportedMimeType || 'default'}`);

      const mediaRecorder = new MediaRecorder(
        stream,
        supportedMimeType ? { mimeType: supportedMimeType } : {}
      );

      mediaRecorderRef.current = mediaRecorder;

      // Event: Data available (chunks)
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`📊 Audio chunk: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length}`);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
        toast.error(`Recording error: ${event.error}`);
      };

      mediaRecorder.start(1000); // Collect audio every 1 second
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;

      // Recording timer
      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Safety timeout - auto-stop after 60 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Recording timeout - auto-stopping');
        stopRecordingAndSubmit();
      }, 60000);

      toast.success('🎙️ Recording started. Speak now!');
      console.log('✅ Recording started');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      console.error('❌ Recording start error:', err);
      toast.error(`🔴 ${message}`);
    }
  }, [isRecording]);

  const stopRecordingAndSubmit = useCallback(async () => {
    console.log('⏹️ [STOP RECORDING] Called');
    console.log('📋 State:', {
      hasRecorder: !!mediaRecorderRef.current,
      mediaRecorderState: mediaRecorderRef.current?.state,
      hasSessionId: !!sessionId,
      hasQuestion: !!currentQuestionRef.current,
      audioChunks: audioChunksRef.current.length,
    });

    if (!mediaRecorderRef.current || !sessionId || !currentQuestionRef.current) {
      console.error('❌ Missing state for upload');
      return;
    }

    try {
      const mediaRecorder = mediaRecorderRef.current;

      // Wait for onstop event
      const stopPromise = new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => {
          console.log('✅ MediaRecorder onstop fired');
          resolve();
        };
      });

      mediaRecorder.stop();
      setIsRecording(false);
      console.log('⏹️ MediaRecorder.stop() called, waiting for onstop...');

      // Clear timers
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

      // Stop audio tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      // Wait for onstop + buffer
      await stopPromise;
      await new Promise((resolve) => setTimeout(resolve, 200));

      console.log(`📊 Total chunks: ${audioChunksRef.current.length}`);

      if (audioChunksRef.current.length === 0) {
        console.error('❌ No audio chunks!');
        toast.error('❌ No audio recorded. Try again.');
        return;
      }

      // Create blob
      const blobMimeType = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: blobMimeType });
      console.log(`📦 Blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

      if (audioBlob.size === 0) {
        console.error('❌ Blob is empty!');
        toast.error('❌ Audio blob is empty. Try again.');
        return;
      }

      // Upload
      const currentQ = currentQuestionRef.current;
      const duration = recordingDurationRef.current;
      const timeLeft = timeRemainingRef.current;

      console.log(`📤 Uploading Q${currentQ.question_id}...`);

      const result = await api.uploadVideoAudio(
        sessionId,
        currentQ.question_id,
        audioBlob,
        duration,
        currentQ.timer_seconds - timeLeft
      );

      console.log('✅ Upload response:', result);

      if (result.success) {
        console.log('✅ Audio uploaded!');
        toast.success('✅ Audio answer saved!');

        if (result.next_question) {
          console.log(`➡️ Moving to Q${result.next_question.question_id}`);
          setCurrentQuestion(result.next_question);
          setQuestionIndex((prev) => prev + 1);
          setRecordingDuration(0);
          startTimer(result.next_question.timer_seconds);
        } else {
          console.log('✅ Interview complete!');
          setInterviewStarted(false);
          toast.success('🎉 Interview complete!');
          await submitForHRReview();
        }
      } else {
        console.error('❌ Upload failed:', result.message);
        toast.error(`Upload failed: ${result.message}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error:', err);
      toast.error(`Error: ${message}`);
    } finally {
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      recordingDurationRef.current = 0;
      console.log('🧹 Cleanup complete');
    }
  }, [sessionId, startTimer]);

  const cancelRecording = useCallback(() => {
    console.log('❌ Recording cancelled');

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  }, []);

  // ============ YES/NO SUBMISSION ============
  const handleYesNoSubmit = useCallback(
    async (answer: 'yes' | 'no') => {
      if (!sessionId || !currentQuestion) return;

      console.log(`✅ [YES_NO] Q${currentQuestion.question_id}: ${answer.toUpperCase()}`);

      try {
        const payload = {
          question_id: currentQuestion.question_id,
          answer_text: answer.toUpperCase(),
          duration_seconds: currentQuestion.timer_seconds - timeRemainingRef.current,
        };

        const result = await api.recordVideoAnswer(sessionId, payload);
        console.log('✅ Answer recorded:', result);

        await new Promise((resolve) => setTimeout(resolve, 300));

        if (result.next_question) {
          console.log(`➡️ Moving to Q${result.next_question.question_id}`);
          toast.success('✅ Answer recorded!');
          setCurrentQuestion(result.next_question);
          setQuestionIndex((prev) => prev + 1);
          startTimer(result.next_question.timer_seconds);
        } else {
          console.log('✅ Interview complete!');
          setInterviewStarted(false);
          toast.success('🎉 Interview complete!');
          await submitForHRReview();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to record answer';
        console.error('❌ Error:', err);
        toast.error(`Error: ${message}`);
      }
    },
    [sessionId, currentQuestion, startTimer]
  );

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
        className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6"
      >
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-white">Video Onboarding</h1>
            <p className="text-gray-400">Welcome to your onboarding interview</p>
          </div>

          <Card className="p-8 bg-gray-900 border-gray-800 space-y-6">
            <div className="text-center space-y-4">
              <Video className="h-16 w-16 text-blue-600 mx-auto" />
              <div>
                <p className="text-lg font-semibold text-white">
                  {session.employee_name}
                </p>
                <p className="text-sm text-gray-400">{session.employee_id}</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-400">
                📋 You will answer <span className="font-bold text-blue-400">{totalQuestions} questions</span>
              </p>
              <p className="text-sm text-gray-400">
                ⏱️ Each question has a time limit
              </p>
              <p className="text-sm text-gray-400">
                🎙️ Some questions require audio recording
              </p>
            </div>

            <Button
              onClick={handleStartInterview}
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Video className="mr-2 h-5 w-5" />
              Start Interview
            </Button>
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
      className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Question Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Question {questionIndex + 1} of {totalQuestions}
          </h2>
          <div className="flex items-center gap-2 bg-blue-600/20 px-4 py-2 rounded-lg">
            <Clock className="h-5 w-5 text-blue-400" />
            <span className={`font-bold ${timeRemaining <= 30 ? 'text-red-400' : 'text-blue-400'}`}>
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <Card key={currentQuestion.question_id} className="p-6 bg-gradient-to-br from-indigo-900/50 to-blue-900/50 border-indigo-700/50">
            <div className="space-y-4">
              <div className="inline-block px-3 py-1 bg-indigo-900/50 text-indigo-300 text-xs font-semibold rounded-full">
                {currentQuestion.category}
              </div>
              <p className="text-2xl font-bold text-white">
                {currentQuestion.question_text}
              </p>
            </div>
          </Card>
        )}

        {/* Question Type: Document Upload */}
        {currentQuestion?.question_type === 'document_upload' && (
          <Card className="border-2 border-dashed border-blue-500/50 p-8 text-center cursor-pointer hover:bg-blue-900/10 transition bg-gray-900">
            <div onClick={() => fileInputRef.current?.click()} className="space-y-4">
              <Upload className="h-12 w-12 text-blue-400 mx-auto" />
              <div>
                <p className="font-semibold text-white">📄 Upload {currentQuestion.document_type}</p>
                <p className="text-sm text-gray-400 mt-1">Click to select file (PDF, JPG, PNG)</p>
              </div>
              {isUploadingDoc && <p className="text-xs text-blue-400">Uploading...</p>}
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

        {/* Question Type: Yes/No */}
        {currentQuestion?.question_type === 'yes_no' && (
          <Card className="p-6 bg-gray-800 border-gray-700 space-y-4">
            <p className="text-center text-sm font-semibold text-gray-300 mb-6">
              Please select your answer:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleYesNoSubmit('yes')}
                className="h-16 bg-green-600 hover:bg-green-700 text-white font-bold text-lg flex flex-col items-center justify-center gap-2"
              >
                <Check className="h-6 w-6" />
                Yes
              </Button>
              <Button
                onClick={() => handleYesNoSubmit('no')}
                className="h-16 bg-red-600 hover:bg-red-700 text-white font-bold text-lg flex flex-col items-center justify-center gap-2"
              >
                <AlertCircle className="h-6 w-6" />
                No
              </Button>
            </div>
          </Card>
        )}

        {/* Question Type: Audio */}
        {currentQuestion?.question_type === 'audio' && (
          <Card className="p-6 bg-gray-800 border-gray-700 space-y-4">
            {isRecording ? (
              <>
                <div className="flex items-center justify-center gap-3 bg-red-900/30 border-2 border-red-600/50 rounded-lg p-4">
                  <div className="animate-pulse">
                    <Mic className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-300">🎙️ Recording...</p>
                    <p className="text-sm text-red-400">
                      {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={cancelRecording}
                    variant="outline"
                    className="h-16 border-red-600 text-red-400 hover:bg-red-600 hover:text-white font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={stopRecordingAndSubmit}
                    className="h-16 bg-green-600 hover:bg-green-700 text-white font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Square className="h-6 w-6" />
                    Stop & Submit
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={startRecording}
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg flex flex-col items-center justify-center gap-2"
              >
                <Mic className="h-8 w-8" />
                🎙️ Start Recording
              </Button>
            )}
            <p className="text-xs text-center text-gray-400">
              Speak clearly. Max {currentQuestion.timer_seconds} seconds.
            </p>
          </Card>
        )}

        {/* Progress Bar */}
        <Card className="p-4 bg-gray-800 border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Progress</p>
            <p className="text-sm font-semibold text-gray-300">{questionIndex + 1} / {totalQuestions}</p>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
