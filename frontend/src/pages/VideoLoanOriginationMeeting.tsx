import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, Mic, MicOff, CheckCircle2, MapPin, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '@/lib/video-api';
import {
  extractFinancialData,
  validateConsent,
  calculateRiskLevel,
  generateLoanOffer,
  type LoanOffer,
} from '@/lib/risk-engine';

interface Question {
  question_id: number;
  question_text: string;
  question_type: 'audio' | 'document_upload' | 'yes_no' | 'consent';
  category: string;
  required: boolean;
  timer_seconds: number;
  document_type?: string;
}

// 🏦 LOAN ORIGINATION QUESTIONS (11 Questions)
const LOAN_QUESTIONS: Question[] = [
  {
    question_id: 1,
    question_text: 'Upload your Aadhar Card (Front & Back)',
    question_type: 'document_upload',
    category: 'Identity',
    required: true,
    timer_seconds: 120,
    document_type: 'aadhar',
  },
  {
    question_id: 2,
    question_text: 'Upload your PAN Card',
    question_type: 'document_upload',
    category: 'Identity',
    required: true,
    timer_seconds: 120,
    document_type: 'pan',
  },
  {
    question_id: 3,
    question_text: 'Upload your Salary Slip (Latest 3 months)',
    question_type: 'document_upload',
    category: 'Financial',
    required: true,
    timer_seconds: 120,
    document_type: 'salary_slip',
  },
  {
    question_id: 4,
    question_text: 'Please confirm your full name and date of birth',
    question_type: 'audio',
    category: 'Personal',
    required: true,
    timer_seconds: 60,
  },
  {
    question_id: 5,
    question_text: 'What is your current occupation?',
    question_type: 'audio',
    category: 'Employment',
    required: true,
    timer_seconds: 60,
  },
  {
    question_id: 6,
    question_text: 'What is your approximate monthly income?',
    question_type: 'audio',
    category: 'Financial',
    required: true,
    timer_seconds: 90,
  },
  {
    question_id: 7,
    question_text: 'What is the primary purpose of this loan?',
    question_type: 'audio',
    category: 'Financial',
    required: true,
    timer_seconds: 90,
  },
  {
    question_id: 8,
    question_text: 'Please confirm your current address',
    question_type: 'audio',
    category: 'Personal',
    required: true,
    timer_seconds: 60,
  },
  {
    question_id: 9,
    question_text: 'Are you currently servicing any existing loans?',
    question_type: 'yes_no',
    category: 'Financial',
    required: true,
    timer_seconds: 60,
  },
  {
    question_id: 10,
    question_text: 'Do you consent to share your financial data for loan processing?',
    question_type: 'yes_no',
    category: 'Consent',
    required: true,
    timer_seconds: 60,
  },
  {
    question_id: 11,
    question_text:
      'Please read aloud: "I confirm that all information provided is accurate and complete. I consent to this loan application and authorize the processing of my personal and financial data."',
    question_type: 'consent',
    category: 'Consent',
    required: true,
    timer_seconds: 120,
  },
];

export default function VideoLoanOriginationMeeting() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Session & Questions
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>(LOAN_QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 🏦 Loan Origination Data
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [faceSnapshot, setFaceSnapshot] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [yesNoAnswers, setYesNoAnswers] = useState<{ [key: number]: boolean }>({});
  const [consentCheckbox, setConsentCheckbox] = useState(false);
  const [consentTranscript, setConsentTranscript] = useState('');
  const [documentsUploaded, setDocumentsUploaded] = useState<string[]>([]);
  const [verificationTags, setVerificationTags] = useState<string[]>([]);

  // Meeting & Audio
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
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
  const [yesNoAnswer, setYesNoAnswer] = useState<boolean | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize
  useEffect(() => {
    if (!sessionId) return;
    initializeMeeting();
  }, [sessionId]);

  // 🏦 Capture Geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(loc);
          setVerificationTags((prev) => [...prev, '📍 Location']);
          console.log('📍 Location captured:', loc);
          toast.success('📍 Location Verified');
        },
        (error) => {
          console.warn('⚠️ Geolocation not available:', error);
        }
      );
    }
  }, []);

  // 📸 Initialize camera feed & capture face snapshot
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { height: { ideal: 720 }, width: { ideal: 1280 } },
          audio: false,
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

          videoElementRef.current = video;
          jitsiContainerRef.current.appendChild(video);
          console.log('🎥 Camera initialized');

          // 📸 Capture face snapshot after 1 second
          setTimeout(() => {
            captureFaceSnapshot(video);
          }, 1000);
        }
      } catch (err) {
        console.error('❌ Camera access failed:', err);
        toast.error('Unable to access camera. Please check permissions.');
      }
    };

    initCamera();
  }, []);

  /**
   * 📸 Capture single frame from video stream
   */
  const captureFaceSnapshot = (video: HTMLVideoElement) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setFaceSnapshot(imageData);
        setVerificationTags((prev) => [...prev, '📸 Snapshot']);
        console.log('📸 Face snapshot captured');
        toast.success('📸 Identity Snapshot Captured');
      }
    } catch (err) {
      console.warn('⚠️ Could not capture face snapshot:', err);
    }
  };

  const initializeMeeting = async () => {
    try {
      const [sessionData, questionsData] = await Promise.all([
        api.getVideoSession(sessionId!),
        Promise.resolve({ questions: LOAN_QUESTIONS }),
      ]);

      setSession(sessionData);
      setQuestions(LOAN_QUESTIONS);

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
    const question = questionToSpeak || currentQuestion;
    if (!question) return;

    const utterance = new SpeechSynthesisUtterance(question.question_text);
    utterance.rate = 0.9;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start recording for audio questions
      if (question.question_type === 'audio' || question.question_type === 'consent') {
        startRecording();
      }
    };

    speechSynthesisRef.current = utterance;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const detectSoundLevel = (): { hasSpeech: boolean; level: number } => {
    if (!analyserNodeRef.current) {
      return { hasSpeech: false, level: 0 };
    }

    const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
    analyserNodeRef.current.getByteFrequencyData(dataArray);

    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    const SOUND_THRESHOLD = 20;
    const hasSpeech = average > SOUND_THRESHOLD;

    return { hasSpeech, level: average };
  };

  const startRecording = async () => {
    try {
      if (isRecording || mediaRecorderRef.current?.state === 'recording') {
        console.warn('⚠️ Recording already in progress');
        return;
      }

      console.log('🎙️ Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        analyserNodeRef.current = analyser;
        console.log('🎵 Audio analyser ready');
      } catch (err) {
        console.warn('⚠️ Audio analysis not available:', err);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('✅ Recording started');
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped');
        setIsRecording(false);
      };

      mediaRecorder.start();

      lastSoundTimeRef.current = Date.now();
      const SILENCE_TIMEOUT = 3000;

      const requestDataInterval = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          const { hasSpeech } = detectSoundLevel();

          if (hasSpeech) {
            lastSoundTimeRef.current = Date.now();
            soundDetectedRef.current = true;
            mediaRecorder.requestData();

            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }
          } else if (soundDetectedRef.current) {
            const timeSinceSpeech = Date.now() - lastSoundTimeRef.current;

            if (timeSinceSpeech > SILENCE_TIMEOUT) {
              soundDetectedRef.current = false;
            } else {
              mediaRecorder.requestData();

              if (!silenceTimeoutRef.current) {
                silenceTimeoutRef.current = setTimeout(() => {
                  soundDetectedRef.current = false;
                  silenceTimeoutRef.current = null;
                }, SILENCE_TIMEOUT - timeSinceSpeech);
              }
            }
          }
        }
      }, 100);

      (mediaRecorderRef.current as any).requestDataInterval = requestDataInterval;
    } catch (err) {
      console.error('❌ Recording error:', err);
      toast.error('Failed to access microphone.');
    }
  };

  const stopRecording = (): Blob | null => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null;
    }

    const mediaRecorder = mediaRecorderRef.current;

    if ((mediaRecorder as any).requestDataInterval) {
      clearInterval((mediaRecorder as any).requestDataInterval);
      (mediaRecorder as any).requestDataInterval = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserNodeRef.current = null;
    soundDetectedRef.current = false;
    lastSoundTimeRef.current = 0;

    mediaRecorder.requestData();

    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }

    mediaRecorder.stream.getTracks().forEach((track) => {
      track.stop();
    });

    if (audioChunksRef.current.length === 0) {
      return null;
    }

    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    return blob;
  };

  const handleNextQuestion = async (skipAudioRecording = false) => {
    try {
      console.log('🔴 [handleNextQuestion] Question:', currentQuestion?.question_id);

      // Handle yes/no questions
      if (currentQuestion.question_type === 'yes_no') {
        if (yesNoAnswer === null) {
          toast.warning('⚠️ Please select Yes or No');
          return;
        }

        const answerText = yesNoAnswer ? 'Yes' : 'No';
        
        // Record in state
        setYesNoAnswers((prev) => ({
          ...prev,
          [currentQuestion.question_id]: yesNoAnswer,
        }));

        // Record to transcripts for financial extraction
        setTranscripts((prev) => [...prev, answerText]);

        // Record in backend
        try {
          await api.recordTextAnswer(
            sessionId!,
            currentQuestion.question_id,
            answerText,
            5
          );
        } catch (err) {
          console.error('Error recording yes/no answer:', err);
        }

        setYesNoAnswer(null);
        toast.success(`✅ Answer recorded: ${answerText}`);
        proceeedToNextQuestion();
        return;
      }

      // Handle document upload questions
      if (!skipAudioRecording && currentQuestion.question_type === 'document_upload') {
        toast.info('Please use the file upload button to submit your document');
        return;
      }

      // ✅ DOCUMENT UPLOAD COMPLETED (skipAudioRecording = true)
      if (skipAudioRecording && currentQuestion.question_type === 'document_upload') {
        console.log(`📄 Document uploaded for Q${currentQuestion.question_id}`);
        
        // Add placeholder to transcripts for document uploads
        const docName = currentQuestion.document_type || 'Document';
        setTranscripts(prev => [...prev, `${docName} uploaded`]);
      }

      // Handle consent question with validation
      if (currentQuestion.question_type === 'consent') {
        let audioBlob: Blob | null = null;
        if (!skipAudioRecording) {
          audioBlob = stopRecording();
        }

        if (audioBlob) {
          setIsUploading(true);
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'answer.webm');
            formData.append('question_id', currentQuestion.question_id.toString());

            const transcribeResponse = await fetch(
              `http://localhost:8004/api/video-onboarding/sessions/${sessionId}/transcribe-audio`,
              {
                method: 'POST',
                body: formData,
              }
            );

            if (transcribeResponse.ok) {
              const transcribeData = await transcribeResponse.json();
              setConsentTranscript(transcribeData.text);

              // Validate consent
              const isValidConsent = validateConsent(transcribeData.text, consentCheckbox);

              if (isValidConsent) {
                setVerificationTags((prev) => [...prev, '✅ Consent']);
                toast.success('✅ Consent Verified & Recorded');
                setTranscripts((prev) => [...prev, transcribeData.text]);
                await api.uploadVideoAudio(
                  sessionId!,
                  currentQuestion.question_id,
                  audioBlob,
                  Math.round(audioBlob.size / 16000),
                  Math.max(240 - timeRemaining, 5)
                );
              } else {
                toast.error('❌ Consent not validated. Please confirm both audio and checkbox.');
                return;
              }
            }
          } catch (err) {
            console.error('❌ Consent processing error:', err);
            toast.error('Error processing consent');
            return;
          } finally {
            setIsUploading(false);
          }
        }

        proceeedToNextQuestion();
        return;
      }

      // Handle audio questions
      let audioBlob: Blob | null = null;
      if (!skipAudioRecording) {
        audioBlob = stopRecording();
      }

      if (audioBlob) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'answer.webm');
          formData.append('question_id', currentQuestion.question_id.toString());

          const transcribeResponse = await fetch(
            `http://localhost:8004/api/video-onboarding/sessions/${sessionId}/transcribe-audio`,
            {
              method: 'POST',
              body: formData,
            }
          );

          if (transcribeResponse.ok) {
            const transcribeData = await transcribeResponse.json();
            setTranscripts((prev) => [...prev, transcribeData.text]);

            await api.uploadVideoAudio(
              sessionId!,
              currentQuestion.question_id,
              audioBlob,
              Math.round(audioBlob.size / 16000),
              Math.max(240 - timeRemaining, 5)
            );

            toast.success(`✅ Recorded: "${transcribeData.text}"`);
          }
        } catch (err) {
          console.error('❌ Upload error:', err);
          toast.error('Error uploading answer');
        } finally {
          setIsUploading(false);
        }
      }

      proceeedToNextQuestion();
    } catch (err: any) {
      console.error('❌ Error:', err);
      toast.error(err.message);
    }
  };

  const proceeedToNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = questions[nextIndex];

      setCurrentQuestionIndex(nextIndex);
      setTimeRemaining(nextQuestion?.timer_seconds || 240);
      setTextAnswer('');
      startQuestionTimer();

      setTimeout(() => {
        speakQuestion(nextQuestion);
      }, 500);
    } else {
      // 🏦 Interview Complete - Calculate Risk & Generate Offer
      console.log('✅ LOAN APPLICATION COMPLETE');
      setIsUploading(true);

      try {
        // Extract financial data from transcripts
        const extractedData = extractFinancialData(transcripts);

        // Check consent from Q9 and Q10
        const consentFromQ9 = yesNoAnswers[9];
        const consentFromQ10 = validateConsent(consentTranscript, consentCheckbox);
        const consentGiven = consentFromQ9 && consentFromQ10;

        extractedData.consentGiven = consentGiven;

        // Calculate risk level
        const riskLevel = calculateRiskLevel(extractedData);

        // Generate loan offer
        const loanOffer = generateLoanOffer(riskLevel, consentGiven);

        // Generate audit trail
        const auditTrail = {
          sessionId,
          timestamp: new Date().toISOString(),
          location,
          documentsUploaded,
          transcripts,
          yesNoAnswers,
          consentStatus: consentGiven,
          consentTranscript,
          extractedData,
          riskLevel,
          loanOffer,
          verificationTags,
        };

        console.log('🏦 Loan Origination Result:', auditTrail);

        // Store result in localStorage for LoanResultPage
        localStorage.setItem(
          'loanApplicationResult',
          JSON.stringify({
            status: loanOffer.status,
            riskLevel: riskLevel,
            amount: loanOffer.amount,
            interestRate: loanOffer.interestRate,
            tenure: loanOffer.tenure,
            emi: loanOffer.emi,
            reason: loanOffer.reason,
            consentStatus: consentGiven,
            location,
            timestamp: new Date().toISOString(),
          })
        );

        // Also store full audit trail
        localStorage.setItem('loanAuditTrail', JSON.stringify(auditTrail));

        // Submit to HR
        await api.submitVideoOnboardingForHR(sessionId!);

        // Navigate to loan result page
        navigate(`/video/loan-result/${sessionId}`);
      } catch (err: any) {
        console.error('❌ Error:', err);
        toast.error('Error completing application');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Only PNG, JPEG, and PDF files are allowed');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      const formData = new FormData();
      formData.append('question_id', currentQuestion.question_id.toString());
      formData.append('document_type', currentQuestion.document_type || 'other');
      formData.append('file', file);

      await api.uploadVideoDocument(sessionId!, formData);

      setDocumentsUploaded((prev) => [...prev, `${currentQuestion.document_type}_${file.name}`]);
      toast.success(`✅ ${file.name} uploaded!`);

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
          <p className="text-gray-600">Loading loan application...</p>
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
          justifyContent: 'center',
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
              {/* 📊 Progress Tracker Q1→Q2→...→Q10 */}
              <div className="mb-6 p-3 bg-black/40 rounded-lg backdrop-blur-sm border border-indigo-500/30">
                <div className="flex items-center gap-1 justify-center flex-wrap">
                  {questions.map((q, idx) => (
                    <div key={q.question_id} className="flex items-center">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: idx === currentQuestionIndex ? 1.2 : 1 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          idx < currentQuestionIndex
                            ? 'bg-green-500 text-white'
                            : idx === currentQuestionIndex
                            ? 'bg-indigo-500 text-white ring-2 ring-indigo-300 animate-pulse'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {idx < currentQuestionIndex ? '✓' : idx + 1}
                      </motion.div>
                      {idx < questions.length - 1 && (
                        <div
                          className={`w-3 h-0.5 mx-1 transition-all ${
                            idx < currentQuestionIndex ? 'bg-green-500' : 'bg-gray-700'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div className="mb-3 text-sm text-indigo-200 flex items-center justify-between">
                <span>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <div className="flex gap-2 flex-wrap justify-end">
                  {verificationTags.map((tag) => (
                    <span key={tag} className="bg-green-600/30 px-2 py-1 rounded text-xs font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Question Text */}
              <h2 className="text-3xl font-black text-white mb-4">{currentQuestion.question_text}</h2>

              {/* Category & Timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-indigo-500 px-4 py-1 rounded-full text-sm font-bold">
                    {currentQuestion.category}
                  </span>
                  {isSpeaking && (
                    <span className="flex items-center gap-2 bg-green-500 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                      <Volume2 className="h-4 w-4" /> Reading...
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
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yes/No Question UI */}
      {currentQuestion?.question_type === 'yes_no' && !isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-32 left-4 right-4 z-30 max-w-xs mx-auto"
        >
          <div className="bg-white bg-opacity-95 p-4 rounded-lg shadow-lg border-2 border-indigo-400">
            <p className="text-sm font-semibold text-gray-700 mb-4">Select your answer:</p>
            <div className="flex gap-2">
              <Button
                onClick={() => setYesNoAnswer(true)}
                className={`flex-1 py-2 font-bold rounded-lg transition-all ${
                  yesNoAnswer === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                }`}
              >
                👍 Yes
              </Button>
              <Button
                onClick={() => setYesNoAnswer(false)}
                className={`flex-1 py-2 font-bold rounded-lg transition-all ${
                  yesNoAnswer === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                }`}
              >
                👎 No
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Consent Checkbox for Question 10 */}
      {currentQuestion?.question_type === 'consent' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-32 left-4 right-4 z-30 max-w-xs mx-auto"
        >
          <div className="bg-white bg-opacity-95 p-4 rounded-lg shadow-lg border-2 border-indigo-400">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentCheckbox}
                onChange={(e) => setConsentCheckbox(e.target.checked)}
                className="mt-1 w-5 h-5"
              />
              <span className="text-sm font-semibold text-gray-700">
                I agree to the above terms and consent to loan processing
              </span>
            </label>
          </div>
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
          Repeat
        </Button>

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
        ) : currentQuestion?.question_type === 'yes_no' ? (
          /* Yes/No Buttons for Q9 & Q10 */
          <>
            <Button
              onClick={() => {
                setYesNoAnswer(true);
                toast.success('✅ Answer recorded: Yes');
                setTimeout(() => handleNextQuestion(), 500);
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-2 text-lg"
              disabled={isUploading}
            >
              ✓ YES
            </Button>
            <Button
              onClick={() => {
                setYesNoAnswer(false);
                toast.success('❌ Answer recorded: No');
                setTimeout(() => handleNextQuestion(), 500);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-2 text-lg"
              disabled={isUploading}
            >
              ✗ NO
            </Button>
          </>
        ) : currentQuestion?.question_type === 'consent' ? (
          /* Consent Checkbox for Q11 */
          <>
            <div className="flex items-center gap-3 bg-white bg-opacity-10 px-6 py-3 rounded-lg border-2 border-blue-400">
              <input
                type="checkbox"
                checked={consentCheckbox}
                onChange={(e) => setConsentCheckbox(e.target.checked)}
                className="w-6 h-6 cursor-pointer"
              />
              <label className="text-white font-semibold cursor-pointer flex-1">
                I hereby consent to all terms
              </label>
            </div>
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 disabled:opacity-50"
                disabled={!consentCheckbox || isUploading}
              >
                <Mic className="h-5 w-5 mr-2" />
                Record Consent
              </Button>
            ) : (
              <Button
                onClick={() => {
                  stopRecording();
                  setTimeout(() => handleNextQuestion(), 500);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            )}
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
                onClick={() => {
                  stopRecording();
                  setTimeout(() => handleNextQuestion(), 500);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            )}
          </>
        )}
            )}
            <Button
              onClick={() => handleNextQuestion()}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 disabled:opacity-50"
              disabled={isUploading}
            >
              {currentQuestionIndex === questions.length - 1 ? '✅ Submit Application' : 'Next Question →'}
            </Button>
          </>
        )}

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
