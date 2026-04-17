import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Camera, Upload, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function VerificationPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const sessionId = localStorage.getItem('sessionId');

  useEffect(() => {
    if (!sessionId) {
      toast.error('No session found. Please start from the beginning.');
      navigate('/video/onboarding');
      return;
    }

    let mediaStream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        setStream(mediaStream);
        
        // Attach stream to video element
        if (videoRef.current && mediaStream) {
          videoRef.current.srcObject = mediaStream;
          
          // Ensure video plays
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              console.error('Play error:', err);
            });
          };
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        const errorMsg = err.name === 'NotAllowedError' 
          ? 'Camera access denied. Please allow camera access in browser settings.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Unable to access camera. Please check permissions.';
        toast.error(errorMsg);
      }
    };

    initCamera();

    // Cleanup on unmount
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [sessionId, navigate]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      toast.error('Camera setup failed.');
      return;
    }

    try {
      const context = canvas.getContext('2d');
      if (!context) {
        toast.error('Canvas context failed.');
        return;
      }

      // Get video dimensions
      const width = video.videoWidth;
      const height = video.videoHeight;

      // If dimensions aren't available, wait a bit
      if (width === 0 || height === 0) {
        toast.error('Camera is loading. Please wait a moment and try again.');
        return;
      }

      // Set canvas to match video size
      canvas.width = width;
      canvas.height = height;

      // Draw the current video frame
      context.drawImage(video, 0, 0, width, height);

      // Convert to image
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedPhoto(imageData);
      toast.success('Photo captured! ✅');
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture. Please try again.');
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
      toast.error('Only PNG, JPEG, or PDF files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSignatureFile(file);
    toast.success(`✅ ${file.name} selected!`);
  };

  const handleContinue = async () => {
    if (!capturedPhoto) {
      toast.error('Please capture a photo');
      return;
    }

    if (!signatureFile) {
      toast.error('Please upload your signature');
      return;
    }

    setLoading(true);
    try {
      // Convert photo to blob and upload
      const photoResponse = await fetch(capturedPhoto);
      const photoBlob = await photoResponse.blob();

      const photoFormData = new FormData();
      photoFormData.append('file', photoBlob, 'photo.jpg');

      const photoUploadResponse = await fetch(
        `http://localhost:8004/api/video-onboarding/sessions/${sessionId}/upload-verification-photo`,
        {
          method: 'POST',
          body: photoFormData
        }
      );

      if (!photoUploadResponse.ok) {
        const errorData = await photoUploadResponse.json();
        throw new Error(errorData.detail || 'Failed to upload photo');
      }

      // Upload signature
      const signatureFormData = new FormData();
      const signatureExt = signatureFile.name.substring(signatureFile.name.lastIndexOf('.')) || '.pdf';
      signatureFormData.append('file', signatureFile, `signature${signatureExt}`);

      const signatureUploadResponse = await fetch(
        `http://localhost:8004/api/video-onboarding/sessions/${sessionId}/upload-verification-signature`,
        {
          method: 'POST',
          body: signatureFormData
        }
      );

      if (!signatureUploadResponse.ok) {
        const errorData = await signatureUploadResponse.json();
        throw new Error(errorData.detail || 'Failed to upload signature');
      }

      toast.success('✅ Verification complete!');
      navigate('/video/instructions');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Bank Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-blue-900">🏦 Digital Loan Application</h1>
          <p className="text-sm text-gray-600">Step 2 of 5 - Verification</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500"
              style={{ width: '40%' }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Page Title */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Verification</h2>
            <p className="text-gray-600 mt-2">Capture your photo and upload your signature for verification purposes</p>
          </div>

          {/* Content Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Photo Capture Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Capture Photo
                </h3>
              </div>

              <div className="p-6">
                {!capturedPhoto ? (
                  <>
                    <div className="mb-6 bg-black rounded-lg overflow-hidden aspect-video">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Position your face in the center of the frame with good lighting. Your photo will be used for identity verification.
                    </p>
                    <button
                      onClick={capturePhoto}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Photo
                    </button>
                  </>
                ) : (
                  <>
                    <img
                      src={capturedPhoto}
                      alt="Captured"
                      className="w-full h-auto rounded-lg mb-4 border border-gray-200"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCapturedPhoto(null)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retake
                      </button>
                      <div className="flex-1 px-4 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-2 text-green-700 font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Done
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Signature Upload Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Signature
                </h3>
              </div>

              <div className="p-6">
                {!signatureFile ? (
                  <>
                    <div className="mb-6 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-700">Click to upload your signature</p>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPEG, or PDF • Max 5MB</p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Choose File
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm font-semibold text-purple-900 mb-2">Selected File:</p>
                      <p className="text-sm text-purple-700 break-all">{signatureFile.name}</p>
                      <p className="text-xs text-purple-600 mt-1">{(signatureFile.size / 1024).toFixed(2)} KB</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setSignatureFile(null)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Change
                      </button>
                      <div className="flex-1 px-4 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-2 text-green-700 font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Uploaded
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Info Boxes */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold text-blue-900 mb-1">📸 Photo Requirements</p>
                <ul className="text-xs space-y-1 text-blue-800">
                  <li>• Clear face visible</li>
                  <li>• Good lighting</li>
                  <li>• Plain background preferred</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold text-purple-900 mb-1">✍️ Signature Requirements</p>
                <ul className="text-xs space-y-1 text-purple-800">
                  <li>• Scanned or uploaded image/PDF</li>
                  <li>• Must be legible</li>
                  <li>• Must match ID</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Verification Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {capturedPhoto ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                  <span className="font-medium text-gray-700">Photo Capture</span>
                </div>
                <span className={`text-sm font-semibold ${capturedPhoto ? 'text-green-600' : 'text-gray-500'}`}>
                  {capturedPhoto ? '✓ Complete' : 'Pending'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {signatureFile ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                  <span className="font-medium text-gray-700">Signature Upload</span>
                </div>
                <span className={`text-sm font-semibold ${signatureFile ? 'text-green-600' : 'text-gray-500'}`}>
                  {signatureFile ? '✓ Complete' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/video/onboarding')}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Go Back
            </button>

            <button
              onClick={handleContinue}
              disabled={loading || !capturedPhoto || !signatureFile}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Instructions →
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Hidden Canvas for Photo Capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

