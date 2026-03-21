import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Home, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as procurementApi from '@/lib/procurementApi';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (transactionRef: string, method: string) => void;
  payment: {
    payment_id: string;
    scheduled_amount: number;
    invoice_amount: number;
    discount_amount: number;
    due_date: string;
  };
  vendor?: { vendor_name: string; vendor_id: string };
  poId?: string;
}

type PaymentMethod = 'upi' | 'card' | 'netbanking';
type ProcessingStep = 0 | 1 | 2 | 3 | 4;

export default function PaymentGatewayModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  payment,
  vendor,
  poId,
}: PaymentGatewayModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi');
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(0);

  // UPI Form
  const [upiId, setUpiId] = useState('');
  const isValidUPI = (id: string) => /^[\w.-]+@[\w.-]+$/.test(id);

  // Card Form
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [showCVV, setShowCVV] = useState(false);

  const formatCard = (val: string) =>
    val
      .replace(/\s/g, '')
      .replace(/(.{4})/g, '$1 ')
      .trim();

  const formatExpiry = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + ' / ' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const getCardNetwork = () => {
    const firstDigit = cardNumber.charAt(0);
    if (firstDigit === '4') return { name: 'Visa', color: '#1434CB' };
    if (firstDigit === '5') return { name: 'Mastercard', color: '#EB001B' };
    if (firstDigit === '6') return { name: 'RuPay', color: '#156534' };
    if (firstDigit === '3') return { name: 'Amex', color: '#006FCF' };
    return null;
  };

  // Net Banking
  const [selectedBank, setSelectedBank] = useState('');
  const popularBanks = [
    { code: 'SBI', name: 'SBI', color: '#0052CC' },
    { code: 'HDFC', name: 'HDFC Bank', color: '#EC1C24' },
    { code: 'ICICI', name: 'ICICI Bank', color: '#F47B20' },
    { code: 'Axis', name: 'Axis Bank', color: '#A61E4D' },
    { code: 'Kotak', name: 'Kotak Bank', color: '#DC143C' },
    { code: 'PNB', name: 'PNB', color: '#003DA5' },
  ];

  // Confetti animation elements
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1,
        color: ['#10b981', '#3b82f6', '#fbbf24'][Math.floor(Math.random() * 3)],
      })),
    []
  );

  const handlePaymentClick = async () => {
    // Validate
    if (selectedMethod === 'upi' && !isValidUPI(upiId)) {
      alert('Please enter a valid UPI ID');
      return;
    }
    if (selectedMethod === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 15) {
        alert('Please enter a valid card number');
        return;
      }
      if (!expiryDate.includes('/')) {
        alert('Please enter expiry date in MM/YY format');
        return;
      }
      if (cvv.length < 3) {
        alert('Please enter a valid CVV');
        return;
      }
      if (!cardHolder.trim()) {
        alert('Please enter cardholder name');
        return;
      }
    }
    if (selectedMethod === 'netbanking' && !selectedBank) {
      alert('Please select a bank');
      return;
    }

    // Start processing
    setProcessing(true);
    setProcessingStep(1);

    const steps = [
      { step: 2, delay: 1500 },
      { step: 3, delay: 3000 },
      { step: 4, delay: 4500 },
    ];

    for (const { step, delay } of steps) {
      await new Promise((resolve) => setTimeout(resolve, delay - (step === 2 ? 0 : 1500)));
      setProcessingStep(step as ProcessingStep);
    }

    // Call API
    try {
      const transactionRef = `TXN${Date.now()}`;
      const paymentDetails =
        selectedMethod === 'upi'
          ? { upi_id: upiId }
          : selectedMethod === 'card'
            ? {
                card_last4: cardNumber.slice(-4),
                card_network: getCardNetwork()?.name || 'Unknown',
              }
            : { bank_name: selectedBank };

      await procurementApi.paymentApi.processPayment(payment.payment_id, {
        payment_method: selectedMethod,
        payment_details: paymentDetails,
        transaction_ref: transactionRef,
      });

      // Wait a bit then close and reset
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onPaymentSuccess(transactionRef, selectedMethod);
      onClose();
    } catch (error) {
      console.error('Payment failed:', error);
      setProcessing(false);
      setProcessingStep(0);
      alert('Payment failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden md:max-h-[90vh] md:overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-800 p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 font-semibold">SECURE PAYMENT</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 flex-1 text-center ">Workstream Pay</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="p-1">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {!processing ? (
            <>
              {/* Order Summary */}
              <div className="p-6 space-y-4 border-b border-slate-800">
                <div className="space-y-3 bg-slate-900/50 rounded-lg p-4 border border-slate-800/50">
                  <div>
                    <p className="text-xs text-slate-400">Paying to</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {vendor?.vendor_name || 'Vendor'}
                    </p>
                  </div>
                  {poId && (
                    <div>
                      <p className="text-xs text-slate-400">PO Reference</p>
                      <p className="text-sm font-mono text-slate-100">{poId}</p>
                    </div>
                  )}
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-xs text-slate-400 mb-1">Amount</p>
                    <p className="text-2xl font-bold text-slate-100">
                      ₹{payment.scheduled_amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">
                      ₹{payment.discount_amount.toLocaleString('en-IN')} early payment discount applied
                    </p>
                    <p className="text-xs text-slate-500">Due: {payment.due_date}</p>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  {(['upi', 'card', 'netbanking'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setSelectedMethod(method)}
                      className={`flex-1 py-2 px-3 rounded text-sm font-semibold capitalize transition-colors ${
                        selectedMethod === method
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {method === 'netbanking' ? 'Net Banking' : method.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* UPI Form */}
                {selectedMethod === 'upi' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">UPI ID</Label>
                      <Input
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                        className="bg-slate-900 border-slate-700 text-slate-100 mt-2"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        e.g. mobile@paytm, name@ybl, number@gpay
                      </p>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-slate-950 text-slate-500">OR pay using</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { name: 'GPay', id: 'merchant@okaxis', color: '#5B9FEB' },
                        { name: 'PhonePe', id: 'merchant@ybl', color: '#551A8B' },
                        { name: 'Paytm', id: 'merchant@paytm', color: '#0087FF' },
                        { name: 'BHIM', id: 'merchant@upi', color: '#FF9500' },
                      ].map((app) => (
                        <button
                          key={app.name}
                          onClick={() => setUpiId(app.id)}
                          className="py-2 px-2 rounded text-sm font-bold text-white transition-transform hover:scale-105"
                          style={{ backgroundColor: app.color }}
                        >
                          {app.name}
                        </button>
                      ))}
                    </div>

                    {upiId && isValidUPI(upiId) && (
                      <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/50 rounded">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <p className="text-xs text-green-400">{upiId}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Form */}
                {selectedMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Card Number</Label>
                      <div className="relative mt-2">
                        <Input
                          value={formatCard(cardNumber)}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, ''))}
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                          className="bg-slate-900 border-slate-700 text-slate-100"
                        />
                        {getCardNetwork() && (
                          <span className="absolute right-3 top-3 text-xs font-bold" 
                            style={{ color: getCardNetwork()?.color }}>
                            {getCardNetwork()?.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-slate-300 text-xs">Expiry</Label>
                        <Input
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(formatExpiry(e.target.value))}
                          placeholder="MM / YY"
                          maxLength={7}
                          className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300 text-xs">CVV</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showCVV ? 'text' : 'password'}
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="CVV"
                            className="bg-slate-900 border-slate-700 text-slate-100 pr-8"
                          />
                          <button
                            onClick={() => setShowCVV(!showCVV)}
                            className="absolute right-2 top-3 text-slate-400 hover:text-slate-300"
                          >
                            {showCVV ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-slate-300 text-xs">Cardholder Name</Label>
                      <Input
                        value={cardHolder.toUpperCase()}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="Name as on card"
                        className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Net Banking Form */}
                {selectedMethod === 'netbanking' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300 text-sm">Select Your Bank</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {popularBanks.map((bank) => (
                          <button
                            key={bank.code}
                            onClick={() => setSelectedBank(bank.code)}
                            className={`py-3 px-2 rounded text-xs font-semibold transition-all ${
                              selectedBank === bank.code
                                ? 'border-2 bg-slate-900/50'
                                : 'border border-slate-800 hover:border-slate-600'
                            }`}
                            style={{
                              borderColor:
                                selectedBank === bank.code ? bank.color : undefined,
                            }}
                          >
                            {bank.code}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedBank && (
                      <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded text-sm text-blue-300">
                        You will be redirected to{' '}
                        {popularBanks.find((b) => b.code === selectedBank)?.name} portal
                      </div>
                    )}
                  </div>
                )}

                {/* Security Badges */}
                <div className="flex justify-center gap-4 text-xs text-slate-500 py-4 border-t border-slate-800">
                  <span>🔒 256-bit SSL</span>
                  <span>✓ PCI DSS</span>
                  <span>✓ RBI Compliant</span>
                </div>

                {/* Pay Button */}
                <Button
                  onClick={handlePaymentClick}
                  disabled={
                    selectedMethod === 'upi'
                      ? !isValidUPI(upiId)
                      : selectedMethod === 'card'
                        ? cardNumber.replace(/\s/g, '').length < 15 ||
                          !expiryDate.includes('/') ||
                          cvv.length < 3 ||
                          !cardHolder.trim()
                        : !selectedBank
                  }
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold rounded-lg transition-all"
                >
                  Pay ₹{payment.scheduled_amount.toLocaleString('en-IN')} Securely
                </Button>

                <button
                  onClick={onClose}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-300 py-2"
                >
                  Cancel payment
                </button>
              </div>
            </>
          ) : (
            /* Processing State */
            <div className="p-12 space-y-6 flex flex-col items-center justify-center min-h-96">
              {processingStep === 1 && (
                <>
                  <div className="animate-spin">
                    <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-100 font-semibold">Initiating secure connection...</p>
                    <p className="text-xs text-slate-400 mt-1">Connecting to payment network</p>
                  </div>
                </>
              )}

              {processingStep === 2 && (
                <>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-100 font-semibold">Verifying payment details...</p>
                    <p className="text-xs text-slate-400 mt-1">Please do not close this window</p>
                  </div>
                </>
              )}

              {processingStep === 3 && (
                <>
                  <div className="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      animate={{ width: '100%' }} transition={{ duration: 1.5 }} />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-100 font-semibold">Processing payment...</p>
                    <p className="text-xs text-slate-400 mt-1">Communicating with bank</p>
                  </div>
                </>
              )}

              {processingStep === 4 && (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    <CheckCircle2 className="w-16 h-16 text-green-400" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-green-400 font-semibold text-lg">Payment Successful!</p>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* Confetti */}
        {processingStep === 4 && !processing && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{ y: -10, opacity: 1 }}
                animate={{ y: window.innerHeight + 10, opacity: 0 }}
                transition={{
                  duration: piece.duration,
                  delay: piece.delay,
                  ease: 'easeIn',
                }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${piece.left}%`,
                  backgroundColor: piece.color,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
