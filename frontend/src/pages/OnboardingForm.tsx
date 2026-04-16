import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as api from '@/lib/video-api';

export default function OnboardingForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employee_name: '',
    employee_id: '',
    employee_email: '',
    department: '',
    role: ''
  });

  const departments = [
    'Engineering',
    'Sales',
    'Marketing',
    'HR',
    'Finance',
    'Operations',
    'Product',
    'Design'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!formData.employee_id.trim()) {
      toast.error('Employee ID is required');
      return;
    }
    if (!formData.employee_email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!formData.department) {
      toast.error('Department is required');
      return;
    }

    setLoading(true);
    try {
      const response = await api.createVideoOnboardingSession({
        employee_name: formData.employee_name,
        employee_id: formData.employee_id,
        employee_email: formData.employee_email
      });

      // Save to localStorage
      localStorage.setItem('sessionId', response.session_id);
      localStorage.setItem('employee_name', formData.employee_name);
      localStorage.setItem('employee_id', formData.employee_id);
      localStorage.setItem('department', formData.department);
      localStorage.setItem('role', formData.role);

      toast.success('✅ Details saved! Moving to verification...');
      navigate('/video/verification');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background blur effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        {/* Glassmorphism Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="mb-8">
            <div className="text-center mb-2">
              <div className="text-sm font-semibold text-indigo-400 mb-2">STEP 1 OF 5</div>
              <h1 className="text-3xl font-black text-white mb-2">Welcome</h1>
              <p className="text-gray-300">Please provide your details to begin</p>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-gray-700 rounded-full mt-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '20%' }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                name="employee_name"
                value={formData.employee_name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition"
              />
            </div>

            {/* Employee ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Employee ID *
              </label>
              <input
                type="text"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                placeholder="EMP-12345"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="employee_email"
                value={formData.employee_email}
                onChange={handleChange}
                placeholder="john@company.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Department *
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition"
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept} className="bg-slate-900">
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Role (Optional)
              </label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                placeholder="e.g., Senior Developer"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition"
              />
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full mt-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Loading...
                </>
              ) : (
                <>
                  Continue
                  <span>→</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center mt-6">
            * Required fields
          </p>
        </div>
      </motion.div>
    </div>
  );
}
