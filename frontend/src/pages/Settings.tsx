import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const [showKey, setShowKey] = useState(false);
  const [pollingInterval, setPollingInterval] = useState([15]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* LLM Configuration */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl border p-6 space-y-5">
        <h3 className="font-semibold text-lg">LLM Configuration</h3>

        <div className="space-y-3">
          <Label className="text-sm">Primary LLM</Label>
          <Select defaultValue="gemini">
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini 2.0 Flash</SelectItem>
              <SelectItem value="groq">Groq Llama 3.3</SelectItem>
              <SelectItem value="gpt4o">OpenAI GPT-4o</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm">API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="sk-..."
              className="rounded-xl pr-10"
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button variant="outline" className="rounded-xl">Test Connection</Button>

        <div className="flex items-center gap-3 pt-2">
          <Switch id="fallback" />
          <Label htmlFor="fallback" className="text-sm">Enable fallback LLM</Label>
        </div>
      </motion.div>

      {/* Workflow Settings */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl border p-6 space-y-5">
        <h3 className="font-semibold text-lg">Workflow Settings</h3>

        <div className="space-y-3">
          <Label className="text-sm">Tracker polling interval: {pollingInterval[0]} min</Label>
          <Slider value={pollingInterval} onValueChange={setPollingInterval} min={1} max={60} step={1} className="w-full" />
        </div>

        <div className="space-y-3">
          <Label className="text-sm">Stall detection threshold (days)</Label>
          <Input type="number" defaultValue={3} className="rounded-xl w-32" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch id="human-review" defaultChecked />
            <Label htmlFor="human-review" className="text-sm">Require human approval before creating tasks</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="auto-escalate" />
            <Label htmlFor="auto-escalate" className="text-sm">Auto-send escalations without approval</Label>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm">Escalation delay (hours)</Label>
          <Input type="number" defaultValue={24} className="rounded-xl w-32" />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl border p-6 space-y-5">
        <h3 className="font-semibold text-lg">Notifications</h3>

        <div className="flex items-center gap-3">
          <Switch id="email-notif" defaultChecked />
          <Label htmlFor="email-notif" className="text-sm">Email notifications</Label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-sm">SMTP Email</Label>
            <Input type="email" placeholder="notifications@company.com" className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-sm">SMTP Password</Label>
            <Input type="password" placeholder="••••••••" className="rounded-xl mt-1" />
          </div>
        </div>

        <Button variant="outline" className="rounded-xl">Send test email</Button>

        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Notification triggers</Label>
          <div className="space-y-2.5">
            {[
              { label: 'Task becomes AT_RISK', checked: false },
              { label: 'Task becomes OVERDUE', checked: true },
              { label: 'Pipeline run fails', checked: true },
              { label: 'Weekly summary', checked: false },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                <Checkbox defaultChecked={item.checked} />
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
