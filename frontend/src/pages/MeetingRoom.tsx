import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Video, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';

export default function MeetingRoom() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [runId, setRunId] = useState('');
  const [pipelineUpdates, setPipelineUpdates] = useState<string[]>([]);
  const [title, setTitle] = useState('Team Meeting');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const appendPipelineUpdate = useCallback((line: string) => {
    setPipelineUpdates((prev) => [...prev, line]);
  }, []);

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const connectPipelineSocket = useCallback((id: string) => {
    wsRef.current?.close();
    const ws = api.connectPipelineWS(
      id,
      (msg) => {
        if (msg.type !== 'step_update') return;

        const marker = msg.status === 'SUCCESS' ? '✓' : msg.status === 'FAILED' ? '✗' : '•';
        const line = msg.description || `${msg.agent} ${msg.status.toLowerCase()}`;
        appendPipelineUpdate(`${marker} ${line}`);

        if (msg.agent === 'OrchestratorAgent' && msg.status === 'SUCCESS') {
          appendPipelineUpdate('✓ Pipeline complete');
          ws.close();
        }
      },
      () => {
        appendPipelineUpdate('• Live pipeline updates disconnected');
      },
    );

    wsRef.current = ws;
  }, [appendPipelineUpdate]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopMediaTracks();
    };
  }, [stopMediaTracks]);

  const startMeeting = async () => {
    try {
      wsRef.current?.close();
      setRunId('');
      setPipelineUpdates([]);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      setRoomName(`meetingmind-${Date.now()}`);
      setIsRecording(true);
      toast.success('Meeting started and audio recording is active');
    } catch {
      toast.error('Microphone access is required to start recording');
    }
  };

  const endMeetingAndProcess = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    setIsUploading(true);
    setIsRecording(false);

    try {
      if (recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });
      }

      stopMediaTracks();
      setRoomName(null);

      if (audioChunksRef.current.length === 0) {
        toast.error('No audio captured. Please try again.');
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'meeting.webm');
      formData.append('title', title || 'Untitled Meeting');
      if (date) formData.append('date', date);
      if (attendees.trim()) formData.append('attendees', attendees.trim());

      appendPipelineUpdate('• Uploading meeting audio...');
      const result = await api.processAudio(formData);

      setRunId(result.run_id);
      appendPipelineUpdate(`✓ Audio uploaded. Run started: ${result.run_id}`);
      connectPipelineSocket(result.run_id);
      toast.success('Audio uploaded. Pipeline started.');
      navigate('/process', { state: { runId: result.run_id, fromMeeting: true } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process meeting audio';
      toast.error(message);
      appendPipelineUpdate(`✗ ${message}`);
    } finally {
      setIsUploading(false);
      mediaRecorderRef.current = null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      <div className="bg-card rounded-2xl border p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">New Meeting</h2>
            <p className="text-xs text-muted-foreground">
              Start a Jitsi room, record local audio, then process it through the AI pipeline.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!isRecording ? (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={startMeeting}
                disabled={isUploading}
                className="mt-4 h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Video className="w-4 h-4 mr-2" />
                Start Meeting
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={endMeetingAndProcess}
                disabled={isUploading}
                className="mt-4 h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white relative overflow-hidden group"
              >
                {/* Pulse recording effect */}
                <motion.div 
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-white/20 rounded-xl"
                />
                <span className="relative flex items-center">
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2 fill-white" />}
                  End Meeting & Process
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Input
            placeholder="Meeting title"
            className="rounded-xl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type="date"
            className="rounded-xl"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            placeholder="Attendees (comma-separated)"
            className="rounded-xl"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
          />
        </div>

        <AnimatePresence mode="wait">
          {!isRecording ? (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={startMeeting}
                disabled={isUploading}
                className="mt-4 h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Video className="w-4 h-4 mr-2" />
                Start Meeting
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={endMeetingAndProcess}
                disabled={isUploading}
                className="mt-4 h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white relative overflow-hidden group"
              >
                <motion.div
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-white/20 rounded-xl"
                />
                <span className="relative flex items-center">
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2 fill-white" />}
                  End Meeting & Process
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {roomName && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-2xl border overflow-hidden"
          >
            <iframe
              title="Jitsi Meeting"
              src={`https://meet.jit.si/${roomName}`}
              allow="camera; microphone; fullscreen; display-capture"
              style={{ width: '100%', height: '600px', border: 'none' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(runId || pipelineUpdates.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border p-6"
          >
            <h3 className="text-sm font-semibold">Pipeline Status</h3>
            {runId && <p className="text-xs text-muted-foreground mt-1 font-mono">Run ID: {runId}</p>}

            <div className="mt-4 rounded-xl border bg-muted/20 p-4 max-h-64 overflow-y-auto">
              {pipelineUpdates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Waiting for pipeline updates...</p>
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence>
                    {pipelineUpdates.map((line, index) => (
                      <motion.li 
                        key={`${line}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-sm text-foreground/90 font-mono tracking-tight"
                      >
                        {line}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
