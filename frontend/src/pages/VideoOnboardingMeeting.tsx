import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '@/lib/video-api';

interface Question {
  question_id: number;
  question_text: string;
  question_type: string;
  category: string;
  required: boolean;
  timer_seconds: number;
  document_type?: string;
}

export default function VideoOnboardingMeeting() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  // Session & Questions
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Meeting & Audio
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🎙️ Voice Activity Detection (VAD) - Sound Level Analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const soundDetectedRef = useRef<boolean>(false);
  
  // Timer & Recording
  const [timeRemaining, setTimeRemaining] = useState(240);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Initialize
  useEffect(() => {
    if (!sessionId) return;
    initializeMeeting();
  }, [sessionId]);

  // � Initialize camera feed
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            height: { ideal: 720 },
            width: { ideal: 1280 }
          },
          audio: false // We'll capture audio separately with recording
        });

        if (jitsiContainerRef.current) {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';
          video.style.position = 'absolute';
          video.style.top = '0';
          video.style.left = '0';
          video.style.zIndex = '1';
          
          jitsiContainerRef.current.appendChild(video);
          console.log('🎥 Camera initialized - video element added');
        }
      } catch (err) {
        console.error('❌ Camera access failed:', err);
        toast.error('Unable to access camera. Please check permissions.');
      }
    };

    initCamera();
  }, []);

  const initializeMeeting = async () => {
    try {
      // Fetch session and questions
      const [sessionData, questionsData] = await Promise.all([
        api.getVideoSession(sessionId!),
        api.getVideoOnboardingQuestions(),
      ]);

      setSession(sessionData);
      setQuestions(questionsData.questions);
      
      // Start interview
      await api.startVideoOnboarding(sessionId!);
      
      // Auto-start questions after camera is ready
      setTimeout(() => {
        startQuestionTimer();
        speakQuestion();
      }, 1000);
      
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      navigate('/video/onboarding');
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  const startQuestionTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    const duration = currentQuestion?.timer_seconds || 240;
    setTimeRemaining(duration);

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const speakQuestion = (questionToSpeak?: Question) => {
    // Use Web Speech API for TTS
    // If question not provided, use current question
    const question = questionToSpeak || currentQuestion;
    if (!question) return;

    const utterance = new SpeechSynthesisUtterance(question.question_text);
    utterance.rate = 0.9;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Start recording after AI finishes speaking
      startRecording();
    };

    speechSynthesisRef.current = utterance;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  // 🎙️ VOICE ACTIVITY DETECTION (VAD) - Detect sound levels
  const detectSoundLevel = (): { hasSpeech: boolean; level: number } => {
    if (!analyserNodeRef.current) {
      return { hasSpeech: false, level: 0 };
    }

    const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
    analyserNodeRef.current.getByteFrequencyData(dataArray);

    // Calculate average frequency magnitude
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    // Speech threshold: if average > 20, we have speech
    const SOUND_THRESHOLD = 20;
    const hasSpeech = average > SOUND_THRESHOLD;

    return { hasSpeech, level: average };
  };

  const startRecording = async () => {
    try {
      // 🔥 PREVENT OVERLAPPING RECORDINGS
      if (isRecording || mediaRecorderRef.current?.state === 'recording') {
        console.warn('⚠️ Recording already in progress, skipping startRecording');
        return;
      }

      console.log('🎙️ [START RECORDING] Requesting microphone...');
      
      // 🔥 REQUEST MICROPHONE
      console.log('🎙️ Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('✅ Microphone accessed:', stream);
      console.log('🎤 Stream tracks:', stream.getTracks());
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 🎙️ SET UP AUDIO ANALYSIS FOR VOICE ACTIVITY DETECTION
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        analyserNodeRef.current = analyser;
        console.log('🎵 Audio analyser ready for voice detection');
      } catch (err) {
        console.warn('⚠️ Audio analysis not available (VAD disabled):', err);
      }

      // 🔥 DEBUG: Log ondataavailable events
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 ondataavailable fired!', {
          size: event.data.size,
          type: event.data.type,
          totalChunks: audioChunksRef.current.length + 1
        });
        
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`📦 Audio chunk added. Total: ${audioChunksRef.current.length}, Size: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('✅ Recording started');
        setIsRecording(true);
      };
      
      mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped');
        console.log(`📦 Total chunks collected: ${audioChunksRef.current.length}`);
        console.log(`📊 Total size: ${audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
      };

      mediaRecorder.start();
      console.log('🎬 MediaRecorder started');
      
      // 🔥 SMART CHUNK COLLECTION WITH VOICE ACTIVITY DETECTION
      // Only collect chunks when someone is speaking, stop after 3 seconds of silence
      lastSoundTimeRef.current = Date.now();
      const SILENCE_TIMEOUT = 3000; // Stop collecting after 3 seconds of silence
      
      const requestDataInterval = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          const { hasSpeech, level } = detectSoundLevel();
          
          if (hasSpeech) {
            // Sound detected: collect chunk
            lastSoundTimeRef.current = Date.now();
            if (!soundDetectedRef.current) {
              console.log(`🔊 Speech detected! Starting chunk collection (level: ${level.toFixed(1)})`);
              soundDetectedRef.current = true;
            }
            mediaRecorder.requestData();
            
            // Clear any pending silence timeout
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }
          } else if (soundDetectedRef.current) {
            // Silence detected after speech
            const timeSinceSpeech = Date.now() - lastSoundTimeRef.current;
            
            if (timeSinceSpeech > SILENCE_TIMEOUT) {
              // Extended silence: stop collecting
              console.log(`🔇 Silence timeout (${timeSinceSpeech}ms) - stopping chunk collection`);
              soundDetectedRef.current = false;
            } else {
              // Short silence: still collect (might be between words)
              mediaRecorder.requestData();
              
              // Set timeout to eventually stop
              if (!silenceTimeoutRef.current) {
                silenceTimeoutRef.current = setTimeout(() => {
                  console.log(`🔇 Extended silence detected - stopping chunk collection`);
                  soundDetectedRef.current = false;
                  silenceTimeoutRef.current = null;
                }, SILENCE_TIMEOUT - timeSinceSpeech);
              }
            }
          }
        }
      }, 100); // Check sound level 10 times per second
      
      // Store interval ref to clear later
      (mediaRecorderRef.current as any).requestDataInterval = requestDataInterval;
      
    } catch (err) {
      console.error('❌ Recording error:', err);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = (): Blob | null => {
    console.log('🛑 [STOP RECORDING] Called');
    console.log('   mediaRecorderRef.current:', !!mediaRecorderRef.current);
    console.log('   isRecording state:', isRecording);
    
    if (!mediaRecorderRef.current || !isRecording) {
      console.error('❌ NO ACTIVE RECORDING - returning null');
      console.error('   mediaRecorderRef.current:', !!mediaRecorderRef.current);
      console.error('   isRecording:', isRecording);
      return null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    console.log('✅ Have active recording, proceeding to stop...');

    // 🔥 CLEAR the requestData interval FIRST (CRITICAL!)
    if ((mediaRecorder as any).requestDataInterval) {
      clearInterval((mediaRecorder as any).requestDataInterval);
      (mediaRecorder as any).requestDataInterval = null;
      console.log('✅ Cleared and nullified requestData interval');
    }

    // 🎙️ CLEAN UP AUDIO ANALYSIS RESOURCES
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
      console.log('✅ Cleared silence timeout');
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('✅ Closed audio context');
    }

    analyserNodeRef.current = null;
    soundDetectedRef.current = false;
    lastSoundTimeRef.current = 0;

    // 🔥 REQUEST FINAL DATA BEFORE STOPPING
    console.log('📞 Final requestData call...');
    mediaRecorder.requestData();

    // Now stop
    if (mediaRecorder.state === 'recording') {
      console.log('⏹️ Stopping recorder (state: recording)');
      mediaRecorder.stop();
    } else {
      console.warn('⚠️ Recorder state is not "recording":', mediaRecorder.state);
    }

    // Stop all tracks
    console.log('🛑 Stopping audio tracks...');
    mediaRecorder.stream.getTracks().forEach((track) => {
      console.log('   Stopping track:', track.label, 'ready state:', track.readyState);
      track.stop();
    });

    // 🔥 DEBUG: Check what we collected
    const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
    console.log('📊 CHUNK COLLECTION REPORT:');
    console.log(`   Total chunks: ${audioChunksRef.current.length}`);
    console.log(`   Total size: ${totalSize} bytes`);
    if (audioChunksRef.current.length > 0) {
      console.log(`   First chunk: ${audioChunksRef.current[0].size} bytes`);
      console.log(`   Last chunk: ${audioChunksRef.current[audioChunksRef.current.length - 1].size} bytes`);
    }

    if (audioChunksRef.current.length === 0) {
      console.error('❌ CRITICAL: NO AUDIO CHUNKS COLLECTED!');
      return null;
    }

    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    console.log(`✅ BLOB CREATED: ${blob.size} bytes, type: ${blob.type}`);

    if (blob.size < 1000) {
      console.warn(`⚠️ WARNING: Blob is very small (${blob.size} bytes)`);
    }

    // 🔥 RESET REFS FOR NEXT RECORDING SESSION
    console.log('🔄 Resetting refs for next recording...');
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    console.log('✅ Refs reset: ready for next recording');

    return blob;
  };

  const handleNextQuestion = async (skipAudioRecording = false) => {
    try {
      console.log('🔴 [handleNextQuestion] CALLED');
      console.log('   skipAudioRecording:', skipAudioRecording);
      console.log('   currentQuestion:', currentQuestion?.question_id, currentQuestion?.question_type);
      console.log('   isRecording:', isRecording);
      
      // Handle document upload questions (only if not coming from file upload)
      if (!skipAudioRecording && currentQuestion.question_type === 'document_upload') {
        console.log('📄 Document upload - returning early');
        toast.info('Please use the file upload button to submit your document');
        return;
      }

      // Check if text answer or audio was provided
      let hasAnswer = false;
      
      // Stop recording and get audio blob (unless skipping for file upload)
      let audioBlob: Blob | null = null;
      if (!skipAudioRecording) {
        console.log('🎤 Calling stopRecording...');
        audioBlob = stopRecording();
        console.log('🛬 stopRecording returned:', {
          exists: !!audioBlob,
          size: audioBlob?.size || 'N/A',
          type: audioBlob?.type || 'N/A'
        });
      }

      if (audioBlob) {
        // 🔥 Upload audio answer WITH WHISPER TRANSCRIPTION
        setIsUploading(true);
        const duration = timeRemaining > 0 
          ? currentQuestion.timer_seconds - timeRemaining 
          : currentQuestion.timer_seconds;

        console.log('📦 AUDIO BLOB RECEIVED:', {
          size: audioBlob.size,
          type: audioBlob.type,
          duration: duration
        });

        try {
          console.log('🎤 [TRANSCRIBE] Starting Whisper transcription...');
          
          // Step 1: Transcribe with Whisper
          const formData = new FormData();
          formData.append('file', audioBlob, 'answer.webm');
          formData.append('question_id', currentQuestion.question_id.toString());

          console.log('📤 Posting to /transcribe-audio with blob...');
          const transcribeResponse = await fetch(
            `http://localhost:8004/api/video-onboarding/sessions/${sessionId}/transcribe-audio`,
            {
              method: 'POST',
              body: formData,
            }
          );

          console.log('📥 Transcribe response status:', transcribeResponse.status);

          if (!transcribeResponse.ok) {
            const errorText = await transcribeResponse.text();
            console.error('❌ Transcription error response:', errorText);
            throw new Error(`Transcription failed: ${transcribeResponse.statusText}`);
          }

          const transcribeData = await transcribeResponse.json();
          console.log('✅ Transcription result:', transcribeData);

          // Step 2: Upload audio (with transcription now stored in DB)
          console.log('📤 Uploading audio to /upload-audio...');
          await api.uploadVideoAudio(
            sessionId!,
            currentQuestion.question_id,
            audioBlob,
            Math.round(audioBlob.size / 16000),
            Math.max(duration, 5)
          );

          console.log('✅ Audio uploaded successfully!');
          toast.success(`✅ Answer recorded: "${transcribeData.text}"`);
          hasAnswer = true;
        } catch (err) {
          console.error('❌ Transcription or upload error:', err);
          toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else if (textAnswer.trim()) {
        // Upload text answer
        setIsUploading(true);
        const duration = timeRemaining > 0 
          ? currentQuestion.timer_seconds - timeRemaining 
          : currentQuestion.timer_seconds;

        await api.recordTextAnswer(
          sessionId!,
          currentQuestion.question_id,
          textAnswer.trim(),
          Math.max(duration, 5)
        );

        toast.success('✅ Text answer recorded!');
        hasAnswer = true;
      } else if (!skipAudioRecording && currentQuestion.required) {
        toast.warning('⚠️ Please record audio or type your answer');
        return;
      } else if (!skipAudioRecording) {
        toast.info('ℹ️ Skipping optional question');
        hasAnswer = true;
      }

      // Reset text answer for next question
      setTextAnswer('');

      console.log('📋 Answer submission complete - hasAnswer:', hasAnswer);

      // Move to next question
      if (currentQuestionIndex < questions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        const nextQuestion = questions[nextIndex];
        
        console.log('➡️ [MOVE TO NEXT] Q' + (currentQuestionIndex + 1) + ' → Q' + (nextIndex + 1));
        setCurrentQuestionIndex(nextIndex);
        setTimeRemaining(nextQuestion?.timer_seconds || 240);
        startQuestionTimer();
        
        console.log('🎙️ Speaking next question immediately (Q' + (nextIndex + 1) + ')...');
        // 🔥 PASS THE NEXT QUESTION SO IT SPEAKS IMMEDIATELY (not the old currentQuestion)
        speakQuestion(nextQuestion);
      } else {
        // Interview complete
        console.log('✅ INTERVIEW COMPLETE');
        setIsUploading(true);
        await api.submitVideoOnboardingForHR(sessionId!);
        navigate(`/video/loan-result/${sessionId}`);
      }
    } catch (err: any) {
      console.error('❌ [handleNextQuestion] CAUGHT ERROR:', err);
      toast.error(`❌ ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Only PNG, JPEG, and PDF files are allowed');
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      const formData = new FormData();
      formData.append('question_id', currentQuestion.question_id.toString());
      formData.append('document_type', currentQuestion.document_type || 'other');
      formData.append('file', file);

      await api.uploadVideoDocument(sessionId!, formData);
      toast.success(`✅ ${file.name} uploaded successfully!`);

      // Auto-advance to next question (skip audio recording check)
      setTimeout(() => {
        handleNextQuestion(true);
      }, 500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-900 text-white relative"
    >
      {/* Camera Feed - Full Screen Background */}
      <div
        ref={jitsiContainerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          zIndex: 0,
          backgroundColor: '#000',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      />

      {/* Question Overlay */}
      <AnimatePresence>
        {currentQuestion && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-900 to-purple-900 p-6 border-b-4 border-indigo-500 shadow-lg"
          >
            <div className="max-w-4xl mx-auto">
              {/* Progress */}
              <div className="mb-3 text-sm text-indigo-200">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>

              {/* Question Text */}
              <h2 className="text-3xl font-black text-white mb-4">
                {currentQuestion.question_text}
              </h2>

              {/* Category & Timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-indigo-500 px-4 py-1 rounded-full text-sm font-bold">
                    {currentQuestion.category}
                  </span>
                  {isSpeaking && (
                    <span className="flex items-center gap-2 bg-green-500 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                      <Volume2 className="h-4 w-4" /> AI Speaking...
                    </span>
                  )}
                  {isRecording && (
                    <span className="flex items-center gap-2 bg-red-500 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                      <Mic className="h-4 w-4" /> Recording...
                    </span>
                  )}
                </div>

                {/* Timer */}
                <div
                  className={`text-4xl font-black px-6 py-2 rounded-lg transition-all ${
                    timeRemaining <= 30
                      ? 'bg-red-600 text-white'
                      : timeRemaining <= 60
                      ? 'bg-orange-500 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {formatTime(timeRemaining)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 h-2 bg-indigo-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all"
                  style={{
                    width: `${((questions.length - currentQuestionIndex - 1) / questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text Answer Input - Collapsible */}
      {currentQuestion?.question_type !== 'document_upload' && !isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-32 left-4 z-30"
        >
          {!showTextInput ? (
            // 📝 Collapsed state - just an icon button
            <Button
              onClick={() => setShowTextInput(true)}
              variant="outline"
              className="bg-white border-2 border-indigo-400 hover:bg-indigo-50 rounded-full p-4 shadow-lg"
              title="Click to type your answer"
            >
              📝
            </Button>
          ) : (
            // ✍️ Expanded state - full textarea
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white bg-opacity-95 p-4 rounded-lg shadow-lg border-2 border-indigo-400 w-80 max-w-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">✍️ Type your answer:</p>
                <button
                  onClick={() => setShowTextInput(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 resize-none text-sm"
                rows={4}
                disabled={isUploading}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                {textAnswer.length} characters
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Control Buttons - Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 left-0 right-0 z-40 flex items-center justify-center gap-4 flex-wrap px-4"
      >
        <Button
          onClick={() => speakQuestion()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6"
          disabled={isSpeaking || isUploading}
        >
          <Volume2 className="h-5 w-5 mr-2" />
          Repeat Question
        </Button>

        {/* Document Upload for document_upload questions */}
        {currentQuestion?.question_type === 'document_upload' ? (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".png,.jpg,.jpeg,.pdf"
              className="hidden"
              disabled={isUploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
              disabled={isUploading}
            >
              📁 {isUploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </>
        ) : (
          <>
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
                disabled={isUploading}
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={() => stopRecording()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            )}
          </>
        )}

        <Button
          onClick={() => handleNextQuestion()}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 disabled:opacity-50"
          disabled={isUploading}
        >
          {currentQuestionIndex === questions.length - 1 ? '✅ Complete' : 'Next Question →'}
        </Button>

        <Button
          onClick={() => navigate('/video/records')}
          variant="outline"
          className="text-white border-white hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Exit
        </Button>
      </motion.div>
    </motion.div>
  );
}
