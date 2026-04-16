import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Camera, Upload, RotateCcw } from 'lucide-react';

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

    // Initialize camera
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        toast.error('Unable to access camera. Please check permissions.');
        console.error('Camera error:', err);
      }
    };

    initCamera();

    return () => {
      // Cleanup: stop all streams
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId, navigate]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    
    context.drawImage(videoRef.current, 0, 0);
    const photoDataUrl = canvasRef.current.toDataURL('image/jpeg');
    
    setCapturedPhoto(photoDataUrl);
    toast.success('✅ Photo captured!');
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
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

      // Upload photo
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
        throw new Error('Failed to upload photo');
      }

      // Upload signature
      const signatureFormData = new FormData();
      // Preserve the original file extension
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
        throw new Error('Failed to upload signature');
      }

      toast.success('✅ Photo and signature uploaded!');
      navigate('/video/instructions');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
      console.error('Upload error:', err);
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
        className="relative w-full max-w-4xl"
      >
        {/* Glassmorphism Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="mb-8">
            <div className="text-center mb-2">
              <div className="text-sm font-semibold text-indigo-400 mb-2">STEP 2 OF 5</div>
              <h1 className="text-3xl font-black text-white mb-2">Verification</h1>
              <p className="text-gray-300">Capture your photo and upload signature</p>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-gray-700 rounded-full mt-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '40%' }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              />
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Photo Capture */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">📷 Capture Photo</h2>
              
              {!capturedPhoto ? (
                <div className="space-y-4">
                  {/* Video Stream */}
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Capture Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={capturePhoto}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Camera className="h-5 w-5" />
                    Capture Photo
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Captured Photo Preview */}
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    className="w-full h-auto rounded-lg border-2 border-indigo-400 aspect-video object-cover"
                  />

                  {/* Retake Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={retakePhoto}
                    className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Retake Photo
                  </motion.button>
                </div>
              )}
            </div>

            {/* Signature Upload */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">✍️ Upload Signature</h2>
              
              <div className="space-y-4">
                {/* File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />

                {/* Upload Area */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-400 rounded-lg p-8 text-center cursor-pointer hover:bg-white/5 transition bg-white/5"
                >
                  {signatureFile ? (
                    <div className="text-center">
                      <div className="text-3xl mb-2">✓</div>
                      <p className="text-sm font-semibold text-green-400">
                        {signatureFile.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {(signatureFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white mb-1">
                        Click to upload signature
                      </p>
                      <p className="text-xs text-gray-400">
                        PNG, JPEG, or PDF (Max 5MB)
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* Info Text */}
                <p className="text-xs text-gray-400 text-center">
                  Please upload a clear image or PDF of your signature
                </p>
              </div>
            </div>
          </div>

          {/* Canvas for Photo Capture (hidden) */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Continue Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading || !capturedPhoto || !signatureFile}
            onClick={handleContinue}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Uploading...
              </>
            ) : (
              <>
                Continue
                <span>→</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
