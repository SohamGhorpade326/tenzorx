import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as api from '@/lib/video-api';
import type { GroqDecisionRequest, GroqDecisionResponse } from '@/lib/video-api';

interface Question {
  question_id: number;
  question_text: string;
  question_type: string;
  category?: string;
  required?: boolean;
  timer_seconds?: number;
  document_type?: string;
}

type AgeStatus = 'valid' | 'mismatch' | null;

type PendingDoc =
  | { kind: 'pan_aadhaar'; questionId: number }
  | { kind: 'salary_proof'; questionId: number }
  | null;

interface SessionState {
  cv_estimated_age: number | null;
  cv_age_range: string | null;
  declared_age: number | null;
  age_difference: number | null;
  age_status: AgeStatus;
  age_verification_flag: string | null;
  responses: Array<{
    question_index: number;
    question: string;
    answer: string;
    timestamp: string;
  }>;
  documents_collected: {
    pan_aadhaar: boolean;
    salary_proof: boolean;
  };
}

export default function VideoOnboardingMeeting() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  // Session & Questions
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cvReady, setCvReady] = useState(false);
  
  // Audio
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

  // Right-panel info
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [pendingDoc, setPendingDoc] = useState<PendingDoc>(null);
  const [dobAttempt, setDobAttempt] = useState<0 | 1>(0);

  const fallbackDecision = (data: GroqDecisionRequest): GroqDecisionResponse => {
    if (typeof data.age_difference === 'number' && data.age_difference > 10) {
      return {
        category: 'Conditionally Eligible',
        reason: 'Age mismatch detected',
        risk_level: 'High',
        loan_amount_range: null,
        confidence: 60,
      };
    }

    return {
      category: 'Eligible',
      reason: 'Basic criteria satisfied',
      risk_level: 'Low',
      loan_amount_range: null,
      confidence: 70,
    };
  };

  const handleOnboardingComplete = async (userSessionData: GroqDecisionRequest) => {
    try {
      // Keep existing pipeline: submit for HR review (best-effort).
      api.submitVideoOnboardingForHR(sessionId!).catch(() => undefined);

      const decision = await api.getPostOnboardingDecision(sessionId!, userSessionData);
      navigate(`/video/decision/${sessionId}`, { state: { decision, payload: userSessionData } });
    } catch {
      const decision = fallbackDecision(userSessionData);
      navigate(`/video/decision/${sessionId}`, { state: { decision, payload: userSessionData } });
    }
  };

  const [sessionState, setSessionState] = useState<SessionState>({
    cv_estimated_age: null,
    cv_age_range: null,
    declared_age: null,
    age_difference: null,
    age_status: null,
    age_verification_flag: null,
    responses: [],
    documents_collected: { pan_aadhaar: false, salary_proof: false },
  });

  const waitForVideoDimensions = async (timeoutMs: number): Promise<{ w: number; h: number } | null> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) return { w: v.videoWidth, h: v.videoHeight };
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  };

  const attachStreamToVideo = async (stream: MediaStream): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const tryPlay = async () => {
      try {
        await video.play();
        return true;
      } catch {
        return false;
      }
    };

    // Wait for metadata so dimensions are known
    if (video.readyState < 1) {
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoaded);
      });
    }

    // Attempt play a few times (autoplay policies can be flaky)
    let played = await tryPlay();
    if (!played) {
      await new Promise((r) => setTimeout(r, 150));
      played = await tryPlay();
    }

    if (!played) {
      toast.error('Camera preview blocked by the browser. Click anywhere on the page and try again.');
    }

    // We don't toast for blank feeds here because we may retry with fallback constraints.
    const dims = await waitForVideoDimensions(1500);
    return !!dims;
  };

  const getCameraStreamWithFallbacks = async (): Promise<MediaStream> => {
    const base: MediaTrackConstraints = {
      facingMode: 'user',
    };

    const candidates: MediaStreamConstraints[] = [
      { video: { ...base, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { ...base, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { ...base }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;

    for (const constraints of candidates) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // Attach and verify we actually get frames.
        const hasFrames = await attachStreamToVideo(stream);
        if (hasFrames) return stream;

        // Blank stream: stop and try next constraints.
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        lastError = e;
      }
    }

    toast.error('Camera feed is not rendering. Close other apps using the camera and refresh.');
    throw lastError instanceof Error ? lastError : new Error('Failed to initialize camera');
  };
  
  const captureFrame = async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;

    // Wait briefly for metadata so videoWidth/videoHeight are populated.
    for (let i = 0; i < 10; i++) {
      if (video.videoWidth > 0 && video.videoHeight > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    });
  };

  const initializeMeeting = async () => {
    try {
      setLoading(true);

      // 1) Camera permission prompt + stream start (no pre-video forms)
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;

      const stream = await getCameraStreamWithFallbacks();
      cameraStreamRef.current = stream;
      setCameraReady(true);

      // 2) Fetch session + questions
      const [sessionData, questionsData] = await Promise.all([
        api.getVideoSession(sessionId!),
        api.getVideoOnboardingQuestions(),
      ]);

      setSession(sessionData);
      setQuestions(questionsData.questions);
      
      // Start interview (backend state)
      await api.startVideoOnboarding(sessionId!);

      // 3) Silent CV age estimation (before any question)
      try {
        const frame = await captureFrame();
        if (frame) {
          const cv = await api.estimateCvAge(sessionId!, frame);
          setSessionState((prev) => ({
            ...prev,
            cv_estimated_age: cv.cv_estimated_age,
            cv_age_range: cv.cv_age_range,
          }));
        }
      } catch (e) {
        // Non-blocking: CV is a supporting signal only
        console.warn('CV age estimate failed:', e);
      } finally {
        setCvReady(true);
      }
      
      // 4) Begin Q1 only after CV step completes
      setTimeout(() => {
        startQuestionTimer();
        speakQuestion();
      }, 250);
      
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      navigate('/video/records');
    }
  };

  // Initialize on entry
  useEffect(() => {
    if (!sessionId) return;
    initializeMeeting();
    return () => {
      try {
        speechSynthesis.cancel();
      } catch {
        // ignore
      }
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

  const speakCustom = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      startRecording();
    };
    speechSynthesisRef.current = utterance;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const calculateAgeFromDOB = (dob: Date) => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  const tryParseDob = (raw: string): Date | null => {
    const text = raw.trim();
    // DD/MM/YYYY (or DD-MM-YYYY)
    const m1 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m1) {
      const dd = Number(m1[1]);
      const mm = Number(m1[2]);
      const yyyy = Number(m1[3]);
      const d = new Date(yyyy, mm - 1, dd);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  };

  function compareDeclaredAgeWithCV(declaredAge: number, cv_estimated_age: number) {
    const diff = Math.abs(declaredAge - cv_estimated_age);
    return diff <= 10 ? 'valid' : 'mismatch';
  }

  const statusText = useMemo(() => {
    if (!cameraReady) return 'Waiting...';
    if (!cvReady) return 'Processing...';
    if (isSpeaking) return 'Waiting...';
    if (isUploading) return 'Processing...';
    if (pendingDoc) return 'Waiting...';
    if (isRecording) return 'Listening...';
    return 'Waiting...';
  }, [cameraReady, cvReady, isSpeaking, isUploading, pendingDoc, isRecording]);

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
      
      const preferredMimeType =
        (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus'))
          ? 'audio/webm;codecs=opus'
          : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm'))
            ? 'audio/webm'
            : '';

      const mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      
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

      // Use a timeslice so the browser emits chunks reliably.
      mediaRecorder.start(250);
      console.log('🎬 MediaRecorder started');

    } catch (err) {
      console.error('❌ Recording error:', err);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    console.log('🛑 [STOP RECORDING] Called');
    console.log('   mediaRecorderRef.current:', !!mediaRecorderRef.current);
    console.log('   isRecording state:', isRecording);

    if (!mediaRecorderRef.current) {
      console.error('❌ NO ACTIVE RECORDING - returning null');
      console.error('   mediaRecorderRef.current:', !!mediaRecorderRef.current);
      console.error('   isRecording:', isRecording);
      return null;
    }

    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder.state !== 'recording') {
      console.warn('⚠️ Recorder is not recording:', mediaRecorder.state);
      return null;
    }

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

    const stopped = new Promise<void>((resolve) => {
      const onStop = () => {
        mediaRecorder.removeEventListener('stop', onStop);
        resolve();
      };
      mediaRecorder.addEventListener('stop', onStop);
    });

    // 🔥 REQUEST FINAL DATA BEFORE STOPPING
    try {
      console.log('📞 Final requestData call...');
      mediaRecorder.requestData();
    } catch {
      // ignore
    }

    console.log('⏹️ Stopping recorder (state: recording)');
    mediaRecorder.stop();

    // Stop all tracks (after stop() is invoked)
    console.log('🛑 Stopping audio tracks...');
    mediaRecorder.stream.getTracks().forEach((track) => {
      console.log('   Stopping track:', track.label, 'ready state:', track.readyState);
      track.stop();
    });

    await stopped;
    // Allow any final ondataavailable to flush.
    await new Promise((r) => setTimeout(r, 0));

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
      let nextResponses = sessionState.responses;
      
      // Stop recording and get audio blob (unless skipping for file upload)
      let audioBlob: Blob | null = null;
      if (!skipAudioRecording) {
        console.log('🎤 Calling stopRecording...');
        audioBlob = await stopRecording();
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

          const transcriptText = String(transcribeData.text || '').trim();
          if (!transcriptText) {
            speakCustom("Sorry, I didn't catch that. Could you please repeat?");
            return;
          }

          setTranscripts((prev) => [...prev, transcriptText]);
          const newEntry = {
            question_index: currentQuestionIndex + 1,
            question: currentQuestion.question_text,
            answer: transcriptText,
            timestamp: new Date().toISOString(),
          };
          nextResponses = [...sessionState.responses, newEntry];
          setSessionState((prev) => ({
            ...prev,
            responses: [
              ...prev.responses,
              newEntry,
            ],
          }));

          // DOB validation hook after Question 2
          if (currentQuestionIndex === 1) {
            const dob = tryParseDob(transcriptText);
            if (!dob) {
              speakCustom('Could you provide your date of birth in DD/MM/YYYY format?');
              return;
            }

            const declaredAge = calculateAgeFromDOB(dob);
            const cvAge = sessionState.cv_estimated_age;

            if (typeof cvAge === 'number') {
              const ageStatus = compareDeclaredAgeWithCV(declaredAge, cvAge);
              const diff = Math.abs(declaredAge - cvAge);

              if (ageStatus === 'mismatch' && dobAttempt === 0) {
                setDobAttempt(1);
                setSessionState((prev) => ({
                  ...prev,
                  declared_age: declaredAge,
                  age_difference: diff,
                  age_status: 'mismatch',
                }));
                speakCustom(
                  'We detected a difference between your estimated age and the date of birth provided. Could you please confirm your date of birth again?',
                );
                return;
              }

              const flag = ageStatus === 'mismatch' && dobAttempt === 1 ? 'high_risk' : null;
              setSessionState((prev) => ({
                ...prev,
                declared_age: declaredAge,
                age_difference: diff,
                age_status: ageStatus,
                age_verification_flag: flag,
              }));

              // Persist for downstream risk engines (non-blocking)
              api
                .persistAgeVerification(sessionId!, {
                  declared_age: declaredAge,
                  age_difference: diff,
                  age_status: ageStatus,
                  age_verification_flag: flag,
                })
                .catch(() => undefined);
            }
          }

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
        const newEntry = {
          question_index: currentQuestionIndex + 1,
          question: currentQuestion.question_text,
          answer: textAnswer.trim(),
          timestamp: new Date().toISOString(),
        };
        nextResponses = [...sessionState.responses, newEntry];
        setSessionState((prev) => ({
          ...prev,
          responses: [...prev.responses, newEntry],
        }));
        hasAnswer = true;
      } else if (!skipAudioRecording && currentQuestion.required) {
        toast.warning('⚠️ Please record audio or type your answer');
        speakCustom("Sorry, I didn't catch that. Could you please repeat?");
        return;
      } else if (!skipAudioRecording) {
        toast.info('ℹ️ Skipping optional question');
        hasAnswer = true;
      }

      // Reset text answer for next question
      setTextAnswer('');

      console.log('📋 Answer submission complete - hasAnswer:', hasAnswer);

      // Document upload triggers (do not modify upload logic; just trigger at the right steps)
      if (hasAnswer && !pendingDoc) {
        if (currentQuestionIndex === 2 && !sessionState.documents_collected.pan_aadhaar) {
          setPendingDoc({ kind: 'pan_aadhaar', questionId: currentQuestion.question_id });
          toast.info('Please upload your PAN/Aadhaar document.');
          return;
        }
        if (currentQuestionIndex === 5 && !sessionState.documents_collected.salary_proof) {
          setPendingDoc({ kind: 'salary_proof', questionId: currentQuestion.question_id });
          toast.info('Please upload your salary slip / bank statement.');
          return;
        }
      }

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

        const userSessionData: GroqDecisionRequest = {
          responses: nextResponses.map((r) => ({ question: r.question, answer: r.answer })),
          cv_estimated_age: sessionState.cv_estimated_age,
          declared_age: sessionState.declared_age,
          age_difference: sessionState.age_difference,
          age_status: sessionState.age_status,
          documents: {
            pan_uploaded: !!sessionState.documents_collected.pan_aadhaar,
            aadhaar_uploaded: !!sessionState.documents_collected.pan_aadhaar,
            salary_slip_uploaded: !!sessionState.documents_collected.salary_proof,
          },
        };

        await handleOnboardingComplete(userSessionData);
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
      const qid = pendingDoc?.questionId ?? currentQuestion.question_id;
      const docType = pendingDoc?.kind ?? (currentQuestion.document_type || 'other');
      formData.append('question_id', qid.toString());
      formData.append('document_type', docType);
      formData.append('file', file);

      await api.uploadVideoDocument(sessionId!, formData);
      toast.success(`✅ ${file.name} uploaded successfully!`);

      if (pendingDoc?.kind === 'pan_aadhaar') {
        setSessionState((prev) => ({
          ...prev,
          documents_collected: { ...prev.documents_collected, pan_aadhaar: true },
        }));
      }
      if (pendingDoc?.kind === 'salary_proof') {
        setSessionState((prev) => ({
          ...prev,
          documents_collected: { ...prev.documents_collected, salary_proof: true },
        }));
      }

      // Clear pending doc and advance
      if (pendingDoc) {
        setPendingDoc(null);
        setTimeout(() => {
          handleNextQuestion(true);
        }, 250);
        return;
      }

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
    // Keep UI minimal, but keep the <video> mounted so the camera stream can attach.
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-900">
        <div className="flex h-screen flex-col md:flex-row">
          <div className="relative h-1/2 w-full bg-black md:h-full md:w-1/2">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          </div>
          <div className="h-1/2 w-full overflow-y-auto bg-white p-4 text-gray-900 md:h-full md:w-1/2">
            <div className="text-sm font-semibold">Starting interview…</div>
            <div className="mt-2 text-sm text-gray-500">Waiting for camera and questions.</div>
          </div>
        </div>
      </motion.div>
    );
  }

  const currentQuestionTitle = pendingDoc
    ? pendingDoc.kind === 'pan_aadhaar'
      ? 'Upload PAN/Aadhaar'
      : 'Upload Salary Proof'
    : currentQuestion?.question_text;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-900">
      <div className="flex h-screen flex-col md:flex-row">
        {/* Left: Video */}
        <div className="relative h-1/2 w-full bg-black md:h-full md:w-1/2">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
        </div>

        {/* Right: Info */}
        <div className="h-1/2 w-full overflow-y-auto bg-white p-4 text-gray-900 md:h-full md:w-1/2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500">Question {Math.min(currentQuestionIndex + 1, questions.length)} of {questions.length}</div>
              <h1 className="mt-1 text-lg font-semibold">{currentQuestionTitle || 'Starting...'}</h1>
            </div>
            <div className="rounded-md border px-3 py-1 text-sm">
              <span className="font-medium">{statusText}</span>
            </div>
          </div>

          {/* Optional age status (after Q2) */}
          {sessionState.age_status && (
            <div className="mt-3 rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Age check</div>
                  <div className="font-medium">{sessionState.age_status === 'valid' ? 'Valid' : 'Mismatch'}</div>
                </div>
                {sessionState.age_verification_flag && (
                  <div className="rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-900">
                    {sessionState.age_verification_flag}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="mt-4">
            <div className="text-sm font-semibold">Live transcript</div>
            <div className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto rounded-md border p-3">
              {transcripts.length === 0 ? (
                <div className="text-sm text-gray-500">No transcript yet.</div>
              ) : (
                transcripts.map((t, idx) => (
                  <div key={idx} className="rounded bg-gray-50 p-2 text-sm">
                    {t}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => speakQuestion()} disabled={isSpeaking || isUploading || !!pendingDoc}>
              <Volume2 className="mr-2 h-4 w-4" /> Repeat
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".png,.jpg,.jpeg,.pdf"
              className="hidden"
              disabled={isUploading}
            />

            {pendingDoc ? (
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload document'}
              </Button>
            ) : !isRecording ? (
              <Button onClick={startRecording} disabled={isUploading || isSpeaking}>
                <Mic className="mr-2 h-4 w-4" /> Record
              </Button>
            ) : (
              <Button onClick={() => stopRecording()} disabled={isUploading}>
                <MicOff className="mr-2 h-4 w-4" /> Stop
              </Button>
            )}

            <Button onClick={() => handleNextQuestion()} disabled={isUploading || !!pendingDoc}>
              {currentQuestionIndex === questions.length - 1 ? 'Complete' : 'Next'}
            </Button>

            <Button variant="outline" onClick={() => navigate('/video/records')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Exit
            </Button>
          </div>

          {/* Text fallback */}
          {!pendingDoc && !isRecording && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Type answer (fallback)</div>
                <Button variant="ghost" onClick={() => setShowTextInput((v) => !v)}>
                  {showTextInput ? <VolumeX className="h-4 w-4" /> : 'Show'}
                </Button>
              </div>
              {showTextInput && (
                <div className="mt-2">
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full rounded-md border p-2 text-sm"
                    rows={3}
                    disabled={isUploading}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
