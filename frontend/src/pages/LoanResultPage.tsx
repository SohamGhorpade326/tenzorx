import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, XCircle, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LoanResult {
  status: 'approved' | 'rejected' | 'pending';
  riskLevel: string;
  amount?: number;
  interestRate?: number;
  tenure?: number;
  emi?: number;
  reason: string;
  consentStatus: boolean;
  location?: { latitude: number; longitude: number };
  timestamp: string;
}

export default function LoanResultPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loanResult, setLoanResult] = useState<LoanResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Retrieve loan result from localStorage (set by VideoOnboardingMeeting)
    const storedResult = localStorage.getItem('loanApplicationResult');
    if (storedResult) {
      try {
        setLoanResult(JSON.parse(storedResult));
      } catch (err) {
        console.error('Error parsing loan result:', err);
        toast.error('Failed to load loan result');
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your application...</p>
        </div>
      </div>
    );
  }

  if (!loanResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">No Results Found</h1>
          <Button onClick={() => navigate('/video/onboarding')} className="mt-4">
            Start New Application
          </Button>
        </div>
      </div>
    );
  }

  const isApproved = loanResult.status === 'approved';
  const isRejected = loanResult.status === 'rejected';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="max-w-4xl mx-auto mb-8"
      >
        <h1 className="text-5xl font-black mb-2">Loan Application Result</h1>
        <p className="text-indigo-200">Your digital loan assessment is complete</p>
      </motion.div>

      {/* Main Result Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`max-w-4xl mx-auto mb-8 rounded-2xl p-8 backdrop-blur-xl border-2 ${
          isApproved
            ? 'bg-green-900/20 border-green-500'
            : isRejected
            ? 'bg-red-900/20 border-red-500'
            : 'bg-amber-900/20 border-amber-500'
        }`}
      >
        {/* Status Icon & Title */}
        <div className="flex items-center gap-4 mb-8">
          {isApproved ? (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <CheckCircle className="h-16 w-16 text-green-400" />
            </motion.div>
          ) : isRejected ? (
            <XCircle className="h-16 w-16 text-red-400" />
          ) : (
            <AlertCircle className="h-16 w-16 text-amber-400" />
          )}
          <div>
            <h2 className="text-4xl font-black">
              {isApproved
                ? '✅ Application Approved'
                : isRejected
                ? '❌ Application Declined'
                : '⏳ Under Review'}
            </h2>
            <p className="text-lg text-gray-300 mt-2">{loanResult.reason}</p>
          </div>
        </div>

        {/* 🧠 AI Summary Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8 p-6 rounded-xl bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">🧠</span>
            <div className="flex-1">
              <h3 className="font-bold text-indigo-200 mb-2">AI Risk Assessment Summary</h3>
              <p className="text-gray-300 leading-relaxed">
                Based on your responses, our system classified you as{' '}
                <span className={`font-bold ${
                  loanResult.riskLevel === 'LOW' ? 'text-green-400' :
                  loanResult.riskLevel === 'MEDIUM' ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {loanResult.riskLevel} risk
                </span>
                {isRejected && ' due to missing consent and income criteria'}.
                {!isRejected && !loanResult.consentStatus && ' due to missing consent verification'}.
                {loanResult.riskLevel === 'HIGH' && loanResult.consentStatus && ' due to income falling below minimum thresholds'}.
                {loanResult.riskLevel === 'MEDIUM' && ' as your income or existing loan obligations require additional evaluation'}.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Risk & Consent Status Tags */}
        <div className="flex flex-wrap gap-3 mb-8">
          <span
            className={`px-4 py-2 rounded-full font-bold text-sm ${
              loanResult.riskLevel === 'LOW'
                ? 'bg-green-500/30 text-green-200 border border-green-500'
                : loanResult.riskLevel === 'MEDIUM'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500'
                : 'bg-red-500/30 text-red-200 border border-red-500'
            }`}
          >
            Risk Level: {loanResult.riskLevel}
          </span>
          <span
            className={`px-4 py-2 rounded-full font-bold text-sm ${
              loanResult.consentStatus
                ? 'bg-green-500/30 text-green-200 border border-green-500'
                : 'bg-red-500/30 text-red-200 border border-red-500'
            }`}
          >
            {loanResult.consentStatus ? '✅ Consent Verified' : '❌ No Consent'}
          </span>
          {loanResult.location && (
            <span className="px-4 py-2 rounded-full font-bold text-sm bg-blue-500/30 text-blue-200 border border-blue-500 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              📍 Location Verified
            </span>
          )}
        </div>

        {/* Loan Details Grid */}
        {isApproved && loanResult.amount && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-green-500/30"
          >
            <div className="bg-green-900/30 rounded-lg p-4">
              <p className="text-sm text-green-200 uppercase tracking-wide">Loan Amount</p>
              <p className="text-3xl font-black text-green-300 mt-2">
                ₹{(loanResult.amount / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-4">
              <p className="text-sm text-blue-200 uppercase tracking-wide">Interest Rate</p>
              <p className="text-3xl font-black text-blue-300 mt-2">{loanResult.interestRate}%</p>
            </div>
            <div className="bg-purple-900/30 rounded-lg p-4">
              <p className="text-sm text-purple-200 uppercase tracking-wide">Tenure</p>
              <p className="text-3xl font-black text-purple-300 mt-2">
                {loanResult.tenure && (loanResult.tenure / 12).toFixed(1)}Y
              </p>
            </div>
            <div className="bg-indigo-900/30 rounded-lg p-4">
              <p className="text-sm text-indigo-200 uppercase tracking-wide">Monthly EMI</p>
              <p className="text-3xl font-black text-indigo-300 mt-2">₹{loanResult.emi?.toLocaleString()}</p>
            </div>
          </motion.div>
        )}

        {/* For Rejected Applications */}
        {isRejected && (
          <div className="mt-8 pt-8 border-t border-red-500/30">
            <p className="text-red-200">
              We appreciate your interest in our loan services. Our team will review your application and may
              contact you with alternative options that better suit your profile.
            </p>
          </div>
        )}
      </motion.div>

      {/* Verification Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6 mb-8"
      >
        {/* Compliance & Verification */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            Verification Status
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
              <span>Identity Documents Verified</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
              <span>Financial Information Validated</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
              <span>Consent Documentation Collected</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
              <span>Risk Assessment Completed</span>
            </li>
          </ul>
        </div>

        {/* Next Steps */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold mb-4">📋 Next Steps</h3>
          <ul className="space-y-3 text-sm">
            <li>
              <span className="font-bold">1. Review:</span> Our lending team will review your application
            </li>
            <li>
              <span className="font-bold">2. Verification:</span> We may request additional documents
            </li>
            <li>
              <span className="font-bold">3. Approval:</span> Final decision within 24-48 hours
            </li>
            <li>
              <span className="font-bold">4. Disbursal:</span> Funds transferred to your account
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Contact & Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-6 mb-8"
      >
        <h3 className="text-lg font-bold mb-4">📞 Stay Updated</h3>
        <p className="text-gray-300 mb-4">
          We'll notify you via email and SMS regarding your application status. Typically, we complete our
          assessment within 24-48 hours.
        </p>
        <p className="text-sm text-gray-400">
          <strong>Application ID:</strong> {sessionId}
        </p>
        <p className="text-sm text-gray-400">
          <strong>Submitted:</strong> {loanResult.timestamp}
        </p>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="max-w-4xl mx-auto flex gap-4 justify-center flex-wrap"
      >
        <Button
          onClick={() => {
            localStorage.clear();
            navigate('/video/onboarding');
          }}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold px-8"
        >
          New Application
        </Button>
        <Button
          onClick={() => navigate('/video/records')}
          variant="outline"
          className="text-white border-white hover:bg-white/10"
        >
          View All Applications
        </Button>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="max-w-4xl mx-auto mt-12 text-center text-xs text-gray-500"
      >
        <p>
          This is a digital loan origination system for demonstration purposes. Please read the full terms and
          conditions before proceeding. For support, contact our lending team.
        </p>
      </motion.div>
    </motion.div>
  );
}
