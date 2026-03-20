import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, unit: string) => void;
}

export function SimulationModal({ open, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState(3);
  const [unit, setUnit] = useState('days');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <Clock className="w-5 h-5" /> Simulate Time Jump
          </DialogTitle>
          <DialogDescription>
            Fast-forward time to test deadline tracking and escalation behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 0)}
              className="w-24"
              min={1}
            />
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <span>
                Advancing <strong>{amount} {unit}</strong> will re-run the Tracker Agent and may move tasks to OVERDUE status, triggering escalations.
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-warning hover:bg-warning/90 text-warning-foreground" onClick={() => { onConfirm(amount, unit); onClose(); }}>
              Confirm Simulation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
