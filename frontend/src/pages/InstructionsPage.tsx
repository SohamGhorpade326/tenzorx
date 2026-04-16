import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export default function InstructionsPage() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const sessionId = localStorage.getItem('sessionId');

  const instructions = [
    { icon: '💡', text: 'Ensure good lighting in your room' },
    { icon: '🔇', text: 'Sit in a quiet environment' },
    { icon: '🎤', text: 'Speak clearly and confidently' },
    { icon: '📱', text: 'Do not switch tabs or minimize the browser' },
    { icon: '⏱️', text: 'Complete all questions within the time limit' },
    { icon: '🎥', text: 'Keep your camera and microphone enabled' }
  ];

  const handleStartInterview = () => {
    if (!agreed) {
      alert('Please agree to follow all instructions');
      return;
    }

    navigate(`/video/meet/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background blur effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-2xl"
      >
        {/* Glassmorphism Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="mb-8">
            <div className="text-center mb-2">
              <div className="text-sm font-semibold text-indigo-400 mb-2">STEP 3 OF 5</div>
              <h1 className="text-3xl font-black text-white mb-2">Before You Begin</h1>
              <p className="text-gray-300">Important instructions for your interview</p>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-gray-700 rounded-full mt-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '60%' }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              />
            </div>
          </div>

          {/* Instructions Grid */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-6">📋 Interview Checklist</h2>
            
            <div className="space-y-4">
              {instructions.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
                >
                  <div className="text-2xl flex-shrink-0 mt-1">{item.icon}</div>
                  <p className="text-gray-200 font-medium">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className="mb-8 p-6 bg-indigo-500/10 border border-indigo-400/30 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-400 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-gray-200">
                I have read and agree to follow all the instructions above. I understand that not following these guidelines may impact the quality of my interview.
              </span>
            </label>
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: agreed ? 1.02 : 1 }}
            whileTap={{ scale: agreed ? 0.98 : 1 }}
            disabled={!agreed}
            onClick={handleStartInterview}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" />
            Start Interview
          </motion.button>

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center mt-6">
            Duration: Approximately 10-15 minutes
          </p>
        </div>
      </motion.div>
    </div>
  );
}
