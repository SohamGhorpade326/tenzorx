import { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AgentStepper, AgentStep } from '@/components/AgentStepper';
import {
  Sparkles, Upload, ShieldCheck, UserCheck, PlusSquare, Activity,
  Bell, FileText, Mic, MicOff, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { toast } from 'sonner';

const sampleTranscript = `Meeting: Q3 Planning Meeting
Date: March 20, 2026
Attendees: Priya Sharma, Rahul Mehta, Ananya Singh, Karan Patel

Priya: Let's discuss the Q3 financial report. I'll have it ready by March 25th.
Rahul: The API documentation needs updating. I can do it by March 22nd.
Ananya: I'll schedule the vendor review meeting for next Thursday.
Karan: There's a critical auth bug in production. I'll fix it by March 22nd.`;

// Maps backend agent names to stepper step indices
const AGENT_STEP_MAP: Record<string, number> = {
  TranscriptAgent: 0,
  ValidatorAgent: 1,
  HumanReviewGate: 2,
  TaskCreatorAgent: 3,
  TrackerAgent: 4,
  EscalationAgent: 5,
  SummaryAgent: 6,
  OrchestratorAgent: -1, // meta — no UI step
};

export default function ProcessMeeting() {
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepStatuses, setStepStatuses] = useState<Record<number, { status: string; description: string; output?: Record<string, unknown> }>>({});
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [attendees, setAttendees] = useState('');
  const [runId, setRunId] = useState('');
  const [tasksCreated, setTasksCreated] = useState(0);
  const [meetingSummary, setMeetingSummary] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const getSteps = (): AgentStep[] => {
    const defs = [
      { name: 'Transcript Agent', icon: Sparkles, description: 'Extracting decisions and commitments...' },
      { name: 'Validator Agent', icon: ShieldCheck, description: 'Validating owners, deadlines, and quality...' },
      { name: 'Human Review Gate', icon: UserCheck, description: 'Reviewing flagged items...' },
      { name: 'Task Creator Agent', icon: PlusSquare, description: 'Creating and enriching tasks...' },
      { name: 'Tracker Agent', icon: Activity, description: 'Scheduling deadline monitoring...' },
      { name: 'Escalation Agent', icon: Bell, description: 'Checking for urgent items...' },
      { name: 'Summary Agent', icon: FileText, description: 'Generating meeting summary with Groq...' },
    ];

    return defs.map((def, i) => {
      const override = stepStatuses[i];
      let status: AgentStep['status'] = 'PENDING';
      if (override) {
        status = override.status as AgentStep['status'];
      } else if (i === currentStep && processing) {
        status = 'RUNNING';
      } else if (i < currentStep) {
        status = 'SUCCESS';
      }

      const reviewItems = i === 2 && override?.output?.review_items
        ? (override.output.review_items as { issue: string; text: string; suggestedFix: string }[])
        : undefined;

      return {
        ...def,
        status,
        description: override?.description || def.description,
        outputPreview: override?.output ? JSON.stringify(override.output, null, 2) : undefined,
        reviewItems,
      };
    });
  };

  const connectWebSocket = useCallback((rId: string) => {
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

      // Count tasks created
      if (msg.agent === 'TaskCreatorAgent' && msg.status === 'SUCCESS') {
        const count = (msg.output?.tasks_created as number) || 0;
        setTasksCreated(count);
      }

      if (msg.agent === 'SummaryAgent' && msg.status === 'SUCCESS') {
        setMeetingSummary((msg.output?.summary as string) || '');
      }

      // Pipeline done
      if (msg.agent === 'OrchestratorAgent' && msg.status === 'SUCCESS') {
        setProcessing(false);
        setCompleted(true);
        ws.close();
      }
    }, () => {
      // WebSocket closed — if still processing, mark as done
      if (processing) {
        setProcessing(false);
        setCompleted(true);
      }
    });

    wsRef.current = ws;
  }, [processing]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  const handleProcess = async () => {
    if (!transcript.trim()) {
      toast.error('Please enter a transcript');
      return;
    }
    setProcessing(true);
    setCompleted(false);
    setCurrentStep(0);
    setStepStatuses({});
    setTasksCreated(0);
    setMeetingSummary('');

    try {
      const result = await api.processTranscript({
        transcript,
        title: title || 'Untitled Meeting',
        date: date || undefined,
        attendees: attendees ? attendees.split(',').map(a => a.trim()) : [],
      });

      setRunId(result.run_id);
      connectWebSocket(result.run_id);
      toast.success('Pipeline started! Watch the live agent updates below.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start pipeline';
      toast.error(msg);
      setProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    if (runId) {
      try {
        await api.approveHumanReview(runId);
        toast.success('Review approved — pipeline continuing');
      } catch {
        toast.error('Failed to approve review');
      }
    }
    // Optimistically advance
    setStepStatuses(prev => ({ ...prev, 2: { status: 'SUCCESS', description: 'Review approved' } }));
    setCurrentStep(3);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Input Card */}
      <div className="bg-card rounded-2xl border p-6">
        <h2 className="text-lg font-semibold">Process a meeting transcript</h2>
        <p className="text-sm text-muted-foreground mt-1">Paste your transcript or upload a file — AI agents will extract tasks automatically</p>

        <Tabs defaultValue="paste" className="mt-5">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="paste" className="rounded-lg">Paste Text</TabsTrigger>
            <TabsTrigger value="upload" className="rounded-lg">Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-4">
            <Textarea
              className="min-h-[250px] rounded-xl font-mono text-xs resize-none"
              placeholder={sampleTranscript}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div
              className="border-2 border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-sm">Drop your transcript here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">.txt, .docx, .pdf accepted</p>
              <input
                id="file-upload"
                type="file"
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const text = await file.text();
                    setTranscript(text);
                    toast.success(`Loaded: ${file.name}`);
                  }
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <Input placeholder="Meeting title" className="rounded-xl" value={title} onChange={e => setTitle(e.target.value)} />
          <Input type="date" className="rounded-xl" value={date} onChange={e => setDate(e.target.value)} />
          <Input placeholder="Attendees (comma-separated)" className="rounded-xl" value={attendees} onChange={e => setAttendees(e.target.value)} />
        </div>

        <Button
          className="w-full mt-5 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm"
          onClick={handleProcess}
          disabled={processing}
        >
          {processing ? (
            <><Sparkles className="w-4 h-4 mr-2 animate-pulse" />Processing...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Process Meeting</>
          )}
        </Button>
      </div>

      {/* Agent Pipeline */}
      <AnimatePresence>
        {(processing || completed) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border p-6"
          >
            <h3 className="font-semibold mb-5">
              Live Agent Pipeline
              {runId && <span className="ml-2 text-xs text-muted-foreground font-mono">#{runId}</span>}
            </h3>
            <AgentStepper steps={getSteps()} onApproveAll={handleApproveAll} />

            {meetingSummary && (
              <div className="mt-5 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold">Meeting Summary</h4>
                </div>
                <pre className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground font-sans">
                  {meetingSummary}
                </pre>
              </div>
            )}

            {completed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-success/10 rounded-xl border border-success/20"
              >
                <p className="text-sm font-medium text-success">
                  ✓ Pipeline complete — {tasksCreated} tasks created
                </p>
                <div className="flex gap-3 mt-3">
                  <Button size="sm" onClick={() => navigate('/tasks')} className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                    View Tasks →
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/audit')} className="rounded-lg">
                    View Audit Trail →
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
