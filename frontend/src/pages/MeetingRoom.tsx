import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgentStepper, AgentStep } from '@/components/AgentStepper';
import {
  Video, VideoOff, Mic, MicOff, Square, Circle,
  Sparkles, ShieldCheck, UserCheck, PlusSquare, Activity, Bell, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/lib/api';

const AGENT_STEP_MAP: Record<string, number> = {
  TranscriptAgent: 0,
  ValidatorAgent: 1,
  HumanReviewGate: 2,
  TaskCreatorAgent: 3,
  TrackerAgent: 4,
  EscalationAgent: 5,
};

const STEP_DEFS = [
  { name: 'Transcript Agent', icon: Sparkles, description: 'Transcribing audio with Whisper...' },
  { name: 'Validator Agent', icon: ShieldCheck, description: 'Validating decisions...' },
  { name: 'Human Review Gate', icon: UserCheck, description: 'Reviewing flagged items...' },
  { name: 'Task Creator Agent', icon: PlusSquare, description: 'Creating tasks...' },
  { name: 'Tracker Agent', icon: Activity, description: 'Monitoring deadlines...' },
  { name: 'Escalation Agent', icon: Bell, description: 'Checking urgent items...' },
];

export default function MeetingRoom() {
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepStatuses, setStepStatuses] = useState<Record<number, { status: string; description: string; output?: Record<string, unknown> }>>({});
  const [tasksCreated, setTasksCreated] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [runId, setRunId] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mimeTypeRef = useRef<string>('');
  const navigate = useNavigate();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  const startMeeting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Don't echo back
      }
      setMeetingStarted(true);
      startRecording(stream);
      toast.success('Meeting started — you are now being recorded');
    } catch (err) {
      toast.error('Camera/mic access required. Please allow access and try again.');
    }
  };

  const startRecording = (stream: MediaStream) => {
    chunksRef.current = [];
    
    // Create an audio-only stream for the recorder to avoid issues with video+audio in audio/webm
    const audioTracks = stream.getAudioTracks();
    const audioStream = new MediaStream(audioTracks);

    let mimeType = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }
    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => { 
      if (e.data.size > 0) chunksRef.current.push(e.data); 
    };
    recorder.start(1000); // Collect chunks every 1s
    recorderRef.current = recorder;
    setRecording(true);

    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const endMeeting = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    setMeetingStarted(false);
    setRecording(false);

    // Stop recording and wait for the final chunk
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      const stopPromise = new Promise<void>(resolve => {
        recorderRef.current!.onstop = () => resolve();
      });
      recorderRef.current.stop();
      await stopPromise;
    }

    // Stop camera/mic tracks AFTER the recorder has finished encoding
    streamRef.current?.getTracks().forEach(t => t.stop());

    // Upload to backend
    await uploadAndProcess();
  };

  const uploadAndProcess = async () => {
    if (chunksRef.current.length === 0) {
      toast.error('No audio recorded');
      return;
    }

    setProcessing(true);
    setCurrentStep(0);
    setStepStatuses({});
    setTasksCreated(0);

    const blobType = mimeTypeRef.current || 'audio/webm'; // fallback type if mimeType was empty
    const blob = new Blob(chunksRef.current, { type: blobType });
    const formData = new FormData();
    formData.append('audio', blob, blobType.includes('mp4') ? 'meeting.m4a' : 'meeting.webm');
    formData.append('title', meetingTitle || `Meeting ${new Date().toLocaleDateString()}`);
    formData.append('attendees', attendees || '');

    try {
      const result = await api.processAudio(formData);
      setRunId(result.run_id);
      toast.success('Meeting uploaded — Whisper is transcribing your audio...');
      connectWS(result.run_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
      setProcessing(false);
    }
  };

  const connectWS = useCallback((rId: string) => {
    const ws = api.connectPipelineWS(rId, (msg) => {
      if (msg.type !== 'step_update') return;
      const stepIdx = AGENT_STEP_MAP[msg.agent];
      if (stepIdx === undefined) return;
      if (stepIdx >= 0) {
        setCurrentStep(stepIdx);
        setStepStatuses(prev => ({
          ...prev,
          [stepIdx]: { status: msg.status, description: msg.description, output: msg.output },
        }));
      }
      if (msg.agent === 'TaskCreatorAgent' && msg.status === 'SUCCESS') {
        setTasksCreated((msg.output?.tasks_created as number) || 0);
      }
      if (msg.agent === 'OrchestratorAgent' && msg.status === 'SUCCESS') {
        setProcessing(false);
        setCompleted(true);
        ws.close();
      }
    });
    wsRef.current = ws;
  }, []);

  const toggleVideo = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setVideoEnabled(v => !v); }
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicEnabled(m => !m); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const getSteps = (): AgentStep[] => STEP_DEFS.map((def, i) => {
    const override = stepStatuses[i];
    let status: AgentStep['status'] = 'PENDING';
    if (override) status = override.status as AgentStep['status'];
    else if (i === currentStep && processing) status = 'RUNNING';
    else if (i < currentStep) status = 'SUCCESS';
    return {
      ...def,
      status,
      description: override?.description || def.description,
      outputPreview: override?.output ? JSON.stringify(override.output, null, 2) : undefined,
    };
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card rounded-2xl border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Meeting Room</h2>
            <p className="text-xs text-muted-foreground">Your meeting is recorded locally and auto-processed by AI when you end it</p>
          </div>
        </div>

        {!meetingStarted && !processing && !completed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Input placeholder="Meeting title (optional)" className="rounded-xl" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} />
            <Input placeholder="Attendees (comma-separated)" className="rounded-xl" value={attendees} onChange={e => setAttendees(e.target.value)} />
          </div>
        )}
      </div>

      {/* Video + Controls */}
      {!processing && !completed && (
        <div className="bg-card rounded-2xl border overflow-hidden">
          {/* Camera preview */}
          <div className="relative bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${!videoEnabled && 'invisible'}`}
            />
            {!meetingStarted && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white/60">
                  <Video className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Camera preview will appear here</p>
                </div>
              </div>
            )}
            {recording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
                <Circle className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
                <span className="text-white text-xs font-mono">{formatTime(elapsed)}</span>
              </div>
            )}
            {meetingStarted && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full w-10 h-10 p-0 bg-white/20 hover:bg-white/30 border-0"
                  onClick={toggleVideo}
                >
                  {videoEnabled ? <Video className="w-4 h-4 text-white" /> : <VideoOff className="w-4 h-4 text-red-400" />}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full w-10 h-10 p-0 bg-white/20 hover:bg-white/30 border-0"
                  onClick={toggleMic}
                >
                  {micEnabled ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-red-400" />}
                </Button>
                <Button
                  onClick={endMeeting}
                  className="rounded-full px-6 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
                >
                  <Square className="w-3.5 h-3.5 mr-2 fill-white" />End Meeting
                </Button>
              </div>
            )}
          </div>

          {!meetingStarted && (
            <div className="p-5 flex justify-center">
              <Button
                onClick={startMeeting}
                className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Video className="w-4 h-4 mr-2" />Start Meeting
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Pipeline (appears after meeting ends) */}
      <AnimatePresence>
        {(processing || completed) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border p-6"
          >
            <h3 className="font-semibold mb-2">Processing Your Meeting</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Whisper is transcribing your audio, then all 6 agents will run automatically
              {runId && <span className="ml-2 font-mono text-muted-foreground/70">#{runId}</span>}
            </p>
            <AgentStepper steps={getSteps()} />

            {completed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-success/10 rounded-xl border border-success/20"
              >
                <p className="text-sm font-medium text-success">
                  ✓ Pipeline complete — {tasksCreated} tasks created from your meeting
                </p>
                <div className="flex gap-3 mt-3">
                  <Button size="sm" onClick={() => navigate('/tasks')} className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                    View Tasks →
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/escalations')} className="rounded-lg">
                    View Escalations →
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info card */}
      {!meetingStarted && !processing && !completed && (
        <div className="bg-muted/30 rounded-2xl border border-dashed p-5">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How it works</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click "Start Meeting" — your camera and mic activate</li>
                <li>Have your meeting normally (audio is recorded locally)</li>
                <li>Click "End Meeting" — audio uploads to the backend</li>
                <li>Whisper transcribes the audio locally (no API cost)</li>
                <li>All 6 agents run: Extract → Validate → Create Tasks → Track → Escalate</li>
                <li>Watch the live pipeline progress in real-time</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
