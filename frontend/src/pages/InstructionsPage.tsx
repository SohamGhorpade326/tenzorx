import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';

export default function InstructionsPage() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const sessionId = localStorage.getItem('sessionId');

  const instructions = [
    { icon: '💡', title: 'Good Lighting', text: 'Ensure your face is well-lit and clearly visible' },
    { icon: '🔇', title: 'Quiet Environment', text: 'Sit in a quiet space for clear audio recording' },
    { icon: '🎤', title: 'Clear Speech', text: 'Speak clearly and naturally when answering questions' },
    { icon: '📱', title: 'Stay Focused', text: 'Do not switch tabs or minimize the browser window' },
    { icon: '⏱️', title: 'Time Limits', text: 'Complete each question within the allocated time' },
    { icon: '🎥', title: 'Camera On', text: 'Keep your camera enabled throughout the interview' }
  ];

  const handleStartInterview = () => {
    if (!agreed) {
      alert('Please agree to follow all instructions');
      return;
    }

    navigate(`/video/meet/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Bank Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-blue-900">🏦 Digital Loan Application</h1>
          <p className="text-sm text-gray-600">Step 3 of 5 - Interview Instructions</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Page Title */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Interview Instructions</h2>
            <p className="text-gray-600 mt-2">Please read the following instructions carefully before starting your video interview</p>
          </div>

          {/* Important Notice */}
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-2">Important</h3>
              <p className="text-sm text-amber-800">
                The video interview will evaluate your response quality, communication skills, and authenticity. Please ensure you meet all the technical requirements before beginning.
              </p>
            </div>
          </div>

          {/* Instructions Grid */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {instructions.map((instruction, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{instruction.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{instruction.title}</h4>
                    <p className="text-sm text-gray-600">{instruction.text}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Technical Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Technical Requirements
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-blue-900 mb-2">Browser Requirements:</p>
                <ul className="space-y-1 text-blue-800">
                  <li>✓ Chrome, Firefox, Safari, or Edge (latest versions)</li>
                  <li>✓ Stable internet connection (5+ Mbps recommended)</li>
                  <li>✓ JavaScript enabled</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Device Requirements:</p>
                <ul className="space-y-1 text-blue-800">
                  <li>✓ Webcam and microphone working</li>
                  <li>✓ Speakers enabled for instructions</li>
                  <li>✓ Minimum screen resolution 1024x768</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Interview Duration */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Interview Details</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Expected Duration</p>
                <p className="text-2xl font-bold text-blue-600">10-15 Minutes</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Number of Questions</p>
                <p className="text-2xl font-bold text-blue-600">8-10 Questions</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Time per Question</p>
                <p className="text-2xl font-bold text-blue-600">3-4 Minutes</p>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Before You Start, Please Verify:</h3>
            <div className="space-y-3">
              {[
                'Camera is working and positioned correctly',
                'Microphone is working and unmuted',
                'Internet connection is stable',
                'Lighting is good and face is visible',
                'Background is professional or neutral',
                'You are in a quiet environment',
                'No distractions or other people in background'
              ].map((item, idx) => (
                <label key={idx} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 cursor-pointer" />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Agreement */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 cursor-pointer mt-1"
              />
              <div>
                <p className="font-semibold text-gray-900 mb-1">I Understand and Agree</p>
                <p className="text-sm text-gray-600">
                  I have read and understood all the instructions above. I will follow all guidelines and meet the technical requirements. I understand that the interview will be recorded for verification purposes and may be reviewed by our assessment team.
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/video/verification')}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Go Back
            </button>

            <button
              onClick={handleStartInterview}
              disabled={!agreed}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Start Interview →
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
