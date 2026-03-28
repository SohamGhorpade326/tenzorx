import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as contractApi from '@/lib/contractApi';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function NewContractRequest() {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contractId.trim()) {
      toast.error('Contract ID is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await contractApi.startRun({ contract_id: contractId.trim() });
      toast.success('Contract workflow started');
      navigate(`/contracts/run/${response.run_id}`);
    } catch (error) {
      console.error(error);
      toast.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/contracts')}
          className="text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Start Contract Workflow</h1>
          <p className="text-slate-400 mt-1">Kick off a new contract run by contract identifier</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="max-w-xl">
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Contract Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contract_id" className="text-slate-300">Contract ID</Label>
                <Input
                  id="contract_id"
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  placeholder="e.g., C-10001"
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-blue-700 hover:bg-blue-600">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Run...
                  </>
                ) : (
                  'Start Contract Workflow'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
