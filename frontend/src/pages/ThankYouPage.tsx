import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar } from 'lucide-react';

export default function ThankYouPage() {
  const navigate = useNavigate();
  const [submissionTime, setSubmissionTime] = useState('');

  useEffect(() => {
    // Get current time
    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setSubmissionTime(formattedTime);

    // Clear localStorage on completion
    localStorage.removeItem('sessionId');
    localStorage.removeItem('employee_name');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('department');
    localStorage.removeItem('role');
  }, []);

  const handleBackToDashboard = () => {
    navigate('/video/onboarding');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background blur effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-2xl"
      >
        {/* Glassmorphism Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-12 shadow-2xl text-center">
          {/* Progress Bar */}
          <div className="w-full h-1 bg-gray-700 rounded-full mb-8 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
            />
          </div>

          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 p-6 rounded-full">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Step Indicator */}
          <div className="text-sm font-semibold text-green-400 mb-2">STEP 5 OF 5</div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-black text-white mb-4"
          >
            Thank You!
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-300 text-lg mb-8 leading-relaxed"
          >
            Your onboarding interview has been successfully submitted.
            <br />
            Our HR team will review your responses and contact you soon with the next steps.
          </motion.p>

          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/30 rounded-lg p-6 mb-8"
          >
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Status:</span>
                <span className="px-4 py-1 bg-green-500/20 border border-green-400/50 rounded-full text-green-300 font-semibold text-sm">
                  ✓ Under Review
                </span>
              </div>

              {/* Submission Time */}
              <div className="flex items-center justify-between">
                <span className="text-gray-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Submitted:
                </span>
                <span className="text-gray-200 font-mono">{submissionTime}</span>
              </div>
            </div>
          </motion.div>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-6 mb-8 text-left"
          >
            <h3 className="text-blue-300 font-bold mb-3">📧 What happens next?</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2">
                <span>✓</span>
                <span>Our HR team will review your interview within 24-48 hours</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>You will receive an email with the outcome</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>If selected, we will contact you to discuss next steps</span>
              </li>
            </ul>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex gap-4"
          >
            <button
              onClick={handleBackToDashboard}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold rounded-lg transition"
            >
              Back to Dashboard
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-gray-400 mt-8"
          >
            Interview Reference ID: {localStorage.getItem('sessionId') || 'N/A'}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
