import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Video, Mail, User, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as api from '@/lib/video-api';

export default function VideoOnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeName: '',
    employeeId: '',
    employeeEmail: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleStartOnboarding = async () => {
    if (!formData.employeeName.trim() || !formData.employeeId.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const result = await api.createVideoOnboardingSession({
        employee_name: formData.employeeName,
        employee_id: formData.employeeId,
        employee_email: formData.employeeEmail || undefined,
      });

      toast.success('Onboarding session created!');
      navigate(`/video/meet/${result.session_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-full">
              <Video className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Video Onboarding</h1>
          <p className="text-gray-600 mt-2">Start your AI-powered onboarding interview</p>
        </div>

        {/* Form Card */}
        <Card className="p-8 shadow-lg space-y-6">
          {/* Employee Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <User className="inline h-4 w-4 mr-2 text-blue-600" />
              Full Name *
            </label>
            <Input
              name="employeeName"
              placeholder="John Doe"
              value={formData.employeeName}
              onChange={handleInputChange}
              className="h-11"
            />
          </div>

          {/* Employee ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Employee ID *
            </label>
            <Input
              name="employeeId"
              placeholder="E-12345"
              value={formData.employeeId}
              onChange={handleInputChange}
              className="h-11"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Mail className="inline h-4 w-4 mr-2 text-blue-600" />
              Email (Optional)
            </label>
            <Input
              name="employeeEmail"
              type="email"
              placeholder="john@example.com"
              value={formData.employeeEmail}
              onChange={handleInputChange}
              className="h-11"
            />
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStartOnboarding}
            disabled={loading}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 h-11"
          >
            <Video className="mr-2 h-5 w-5" />
            {loading ? 'Creating Session...' : 'Start Onboarding Interview'}
          </Button>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-900 leading-relaxed">
              💡 <strong>What to expect:</strong> You'll answer 10 structured questions, upload documents, and your responses will be reviewed by our HR team.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
