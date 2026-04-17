import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FormData {
  // Personal Information
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  
  // Contact Information
  email: string;
  phone: string;
  secondaryPhone: string;
  
  // Address Information
  address: string;
  city: string;
  state: string;
  postalCode: string;
  
  // Loan Details
  loanAmount: string;
  loanPurpose: string;
  employmentStatus: string;
  
  // Employment Information
  companyName: string;
  designation: string;
  yearsOfExperience: string;
  monthlyIncome: string;
}

const steps = [
  { id: 1, name: 'Personal Information' },
  { id: 2, name: 'Contact Information' },
  { id: 3, name: 'Address Information' },
  { id: 4, name: 'Loan Details' },
  { id: 5, name: 'Employment Information' }
];

export default function InterviewStartPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    dateOfBirth: '',
    nationality: 'Indian',
    email: '',
    phone: '',
    secondaryPhone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    loanAmount: '',
    loanPurpose: 'Personal',
    employmentStatus: 'Employed',
    companyName: '',
    designation: '',
    yearsOfExperience: '',
    monthlyIncome: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateEmail = (email: string): boolean => {
    const emailPattern = new RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    return emailPattern.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phonePattern = new RegExp(/^[\d\s\-+()\[\]]{10,}$/);
    return phonePattern.test(phone.replace(/\s/g, ''));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.fullName || !formData.dateOfBirth || !formData.nationality) {
          toast.error('Please fill in all personal information fields');
          return false;
        }
        break;
      case 2:
        if (!formData.email || !formData.phone) {
          toast.error('Please fill in email and phone number');
          return false;
        }
        if (!validateEmail(formData.email)) {
          toast.error('Please enter a valid email address');
          return false;
        }
        if (!validatePhone(formData.phone)) {
          toast.error('Please enter a valid phone number');
          return false;
        }
        break;
      case 3:
        if (!formData.address || !formData.city || !formData.state || !formData.postalCode) {
          toast.error('Please fill in all address fields');
          return false;
        }
        break;
      case 4:
        if (!formData.loanAmount || !formData.loanPurpose || !formData.employmentStatus) {
          toast.error('Please fill in all loan details');
          return false;
        }
        break;
      case 5:
        if (!formData.companyName || !formData.designation || !formData.yearsOfExperience || !formData.monthlyIncome) {
          toast.error('Please fill in all employment information');
          return false;
        }
        break;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    try {
      setLoading(true);

      // Capture geolocation with timeout
      let geoLocation = {
        latitude: undefined as number | undefined,
        longitude: undefined as number | undefined,
        accuracy: undefined as number | undefined,
        address: undefined as string | undefined
      };

      if (navigator.geolocation) {
        // Create a promise that resolves with geolocation or timeout after 4 seconds
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⚠️ Geolocation timeout - proceeding without location');
            resolve();
          }, 4000);

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeout);
              geoLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
              };
              console.log('✅ Geolocation captured:', geoLocation);
              toast.success('📍 Location captured successfully');
              resolve();
            },
            (error) => {
              clearTimeout(timeout);
              console.warn('⚠️ Geolocation error:', error.message);
              toast.warning('Location access denied. Proceeding without location data.');
              resolve();
            },
            {
              timeout: 3500,
              enableHighAccuracy: true,
              maximumAge: 0
            }
          );
        });
      }

      // Create session with all form data including geolocation
      const response = await fetch('http://localhost:8004/api/video-onboarding/sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_name: formData.fullName,
          employee_id: `user_${Date.now()}`,
          employee_email: formData.email,
          geolocation_latitude: geoLocation.latitude,
          geolocation_longitude: geoLocation.longitude,
          geolocation_accuracy: geoLocation.accuracy,
          geolocation_address: geoLocation.address,
          applicant_data: {
            dateOfBirth: formData.dateOfBirth,
            nationality: formData.nationality,
            phone: formData.phone,
            secondaryPhone: formData.secondaryPhone,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            loanAmount: formData.loanAmount,
            loanPurpose: formData.loanPurpose,
            employmentStatus: formData.employmentStatus,
            companyName: formData.companyName,
            designation: formData.designation,
            yearsOfExperience: formData.yearsOfExperience,
            monthlyIncome: formData.monthlyIncome,
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Failed to create session: ${response.statusText}`);
      }

      const sessionData = await response.json();
      const sessionId = sessionData.session_id;

      // Store all data in localStorage
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('applicantName', formData.fullName);
      localStorage.setItem('applicantEmail', formData.email);
      localStorage.setItem('applicantPhone', formData.phone);
      localStorage.setItem('applicantData', JSON.stringify(formData));

      toast.success('Application submitted successfully');

      // Navigate to verification (Step 2)
      navigate('/video/verification');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Bank Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">🏦 Digital Loan Application</h1>
            <p className="text-sm text-gray-600">Complete your loan application online</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-700">Step {currentStep} of {steps.length}</p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex justify-between">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    currentStep >= step.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > step.id ? <CheckCircle className="w-5 h-5" /> : step.id}
                </div>
                <p className={`text-xs font-medium mt-2 text-center ${
                  currentStep >= step.id ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {step.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{steps[currentStep - 1].name}</h2>

            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth *</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nationality *</label>
                    <select
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Indian">Indian</option>
                      <option value="NRI">NRI</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Contact Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Secondary Phone</label>
                    <input
                      type="tel"
                      name="secondaryPhone"
                      value={formData.secondaryPhone}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43211"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Address Information */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address *</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Street address"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Mumbai"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">State *</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="Maharashtra"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Postal Code *</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    placeholder="400001"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Loan Details */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Amount (₹) *</label>
                  <input
                    type="number"
                    name="loanAmount"
                    value={formData.loanAmount}
                    onChange={handleInputChange}
                    placeholder="500000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Purpose *</label>
                    <select
                      name="loanPurpose"
                      value={formData.loanPurpose}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Personal">Personal Loan</option>
                      <option value="Home">Home Loan</option>
                      <option value="Vehicle">Vehicle Loan</option>
                      <option value="Education">Education Loan</option>
                      <option value="Business">Business Loan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Employment Status *</label>
                    <select
                      name="employmentStatus"
                      value={formData.employmentStatus}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Employed">Employed</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Retired">Retired</option>
                      <option value="Unemployed">Unemployed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Employment Information */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name *</label>
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder="ABC Corporation"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Designation *</label>
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      placeholder="Software Engineer"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Years of Experience *</label>
                    <input
                      type="number"
                      name="yearsOfExperience"
                      value={formData.yearsOfExperience}
                      onChange={handleInputChange}
                      placeholder="5"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Income (₹) *</label>
                    <input
                      type="number"
                      name="monthlyIncome"
                      value={formData.monthlyIncome}
                      onChange={handleInputChange}
                      placeholder="50000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Form Info Box */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold text-gray-900 mb-1">Video Interview Required</p>
                <p>After completing this form, you will need to complete a video interview where you'll be asked verification questions. Please ensure you're in a well-lit environment.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={handlePreviousStep}
            disabled={currentStep === 1}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>

          {currentStep === steps.length ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : 'Continue to Video Interview →'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          ) : (
            <button
              onClick={handleNextStep}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Next Step →
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Info Text */}
        <p className="text-center text-sm text-gray-600 mt-6">
          This process will take approximately 10-15 minutes. Make sure you have your identity documents ready.
        </p>
      </div>
    </div>
  );
}
