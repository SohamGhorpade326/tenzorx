import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as onboardingApi from '@/lib/onboardingApi';

interface FormData {
  employee_name: string;
  employee_id: string;
}

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

export default function NewOnboardingRequest() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    employee_name: '',
    employee_id: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};
    if (!form.employee_name.trim()) newErrors.employee_name = 'Employee name is required';
    if (!form.employee_id.trim()) newErrors.employee_id = 'Employee ID is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix form errors');
      return;
    }

    setSubmitting(true);
    try {
      const response = await onboardingApi.startRun({
        employee_name: form.employee_name,
        employee_id: form.employee_id,
      });

      toast.success('Onboarding process started successfully');
      navigate(`/onboarding/run/${response.run_id}`);
    } catch (error) {
      toast.error(String(error));
      console.error(error);
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
          onClick={() => navigate('/onboarding')}
          className="text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-100">New Hire Onboarding</h1>
          <p className="text-slate-400 mt-1">Submit details for a new employee</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="max-w-xl">
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle>Employee Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee_name" className="text-slate-300">
                  Full Name *
                </Label>
                <Input
                  id="employee_name"
                  name="employee_name"
                  value={form.employee_name}
                  onChange={handleChange}
                  placeholder="e.g., Jane Doe"
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
                {errors.employee_name && (
                  <p className="text-xs text-red-400">{errors.employee_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_id" className="text-slate-300">
                  Employee ID *
                </Label>
                <Input
                  id="employee_id"
                  name="employee_id"
                  value={form.employee_id}
                  onChange={handleChange}
                  placeholder="e.g., E-10023"
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
                {errors.employee_id && (
                  <p className="text-xs text-red-400">{errors.employee_id}</p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-700 hover:bg-blue-600"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting Setup...
                    </>
                  ) : (
                    'Begin Onboarding'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
