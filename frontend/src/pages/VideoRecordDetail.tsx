import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSessionDetails, getVerificationData, VideoSessionResponse } from "@/lib/video-api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

interface Answer {
  question_id: number;
  question_text: string;
  question_type: string;
  category: string;
  order: number;
  answer_text?: string;
  audio_path?: string;
  audio_transcript?: string;
  audio_duration_seconds?: number;
  document_path?: string;
  answered_at?: string;
  duration_seconds?: number;
}

interface VerificationData {
  session_id: string;
  photo_path?: string;
  signature_path?: string;
  uploaded_at?: string;
}

export default function VideoRecordDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<VideoSessionResponse & { answers: Answer[] } | null>(null);
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    loadSessionDetails();
  }, [sessionId]);

  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!sessionId) {
        setError("Session ID not found");
        return;
      }

      const [sessionData, verificationData] = await Promise.all([
        getSessionDetails(sessionId),
        getVerificationData(sessionId),
      ]);

      setSession(sessionData);
      setVerification(verificationData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load session details";
      setError(errorMessage);
      console.error("Error loading session details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-600">Loading interview details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/video/records")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Records
          </button>
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border border-red-200">
            <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
            <p className="text-red-600 font-semibold">Error Loading Interview</p>
            <p className="text-sm text-gray-600 mt-1">{error}</p>
            <button
              onClick={loadSessionDetails}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/video/records")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Records
          </button>
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">Session not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate("/video/records")}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Records
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Interview Details</h1>
            </div>
          </div>
        </div>

        <div className="px-6 py-8">
          {/* Session Info Card */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Applicant Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="border-l-4 border-blue-600 pl-4">
                <p className="text-xs font-semibold text-gray-600 uppercase">Full Name</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{session.employee_name}</p>
              </div>
              <div className="border-l-4 border-blue-600 pl-4">
                <p className="text-xs font-semibold text-gray-600 uppercase">Applicant ID</p>
                <p className="text-lg font-mono text-gray-900 mt-1">{session.employee_id}</p>
              </div>
              <div className="border-l-4 border-green-600 pl-4">
                <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
                <div className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                    {session.status}
                  </span>
                </div>
              </div>
              <div className="border-l-4 border-purple-600 pl-4">
                <p className="text-xs font-semibold text-gray-600 uppercase">Application Date</p>
                <p className="text-sm text-gray-700 mt-1">{formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</p>
              </div>
            </div>
          </div>

          {/* Geolocation Data */}
          {(session.geolocation_latitude || session.geolocation_longitude) && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">📍 Interview Location</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-red-600 pl-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Coordinates</p>
                  <p className="text-sm font-mono text-gray-900 mt-1">
                    {session.geolocation_latitude?.toFixed(4)}, {session.geolocation_longitude?.toFixed(4)}
                  </p>
                </div>
                <div className="border-l-4 border-red-600 pl-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Accuracy</p>
                  <p className="text-sm text-gray-700 mt-1">±{session.geolocation_accuracy?.toFixed(0)}m</p>
                </div>
                {session.geolocation_address && (
                  <div className="border-l-4 border-red-600 pl-4 md:col-span-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Location Details</p>
                    <p className="text-sm text-gray-700 mt-1">{session.geolocation_address}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification Data */}
          {verification && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Identity Verification</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {verification.photo_path && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📸</span>
                      Applicant Photo
                    </p>
                    <img
                      src={`http://localhost:8004${verification.photo_path}`}
                      alt="Applicant Photo"
                      className="w-full h-64 object-cover rounded-lg border-2 border-gray-300"
                    />
                  </div>
                )}
                {verification.signature_path && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="text-2xl">✍️</span>
                      Digital Signature
                    </p>
                    <img
                      src={`http://localhost:8004${verification.signature_path}`}
                      alt="Signature"
                      className="w-full h-64 object-contain rounded-lg border-2 border-gray-300 bg-white"
                    />
                  </div>
                )}
              </div>
              {verification.uploaded_at && (
                <p className="text-xs text-gray-600 mt-4">
                  ✓ Verification completed {formatDistanceToNow(new Date(verification.uploaded_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}

          {/* Interview Responses */}
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-bold text-gray-900">Interview Responses</h2>
            {session.answers && session.answers.length > 0 ? (
              session.answers.map((answer) => (
                <div key={answer.question_id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                          Q{answer.order}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {answer.question_type}
                        </span>
                        {answer.category && (
                          <span className="text-xs text-gray-600 italic">{answer.category}</span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-gray-900">{answer.question_text}</p>
                    </div>
                  </div>

                  {/* Text Answer */}
                  {answer.answer_text && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 mb-2">📝 Text Response</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{answer.answer_text}</p>
                    </div>
                  )}

                  {/* Audio */}
                  {answer.audio_path && (
                    <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs font-semibold text-green-700 mb-3">🎙️ Audio Recording</p>
                      <audio controls className="w-full mb-2 h-10" src={`http://localhost:8004${answer.audio_path}`} />
                      {answer.audio_duration_seconds && (
                        <p className="text-xs text-green-700">Duration: {Math.round(answer.audio_duration_seconds)}s</p>
                      )}
                    </div>
                  )}

                  {/* Transcription */}
                  {answer.audio_transcript && (
                    <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-xs font-semibold text-purple-700 mb-2">🔤 AI Transcription (Whisper)</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap italic leading-relaxed border-l-4 border-purple-400 pl-3">{answer.audio_transcript}</p>
                    </div>
                  )}

                  {/* Document */}
                  {answer.document_path && (
                    <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-xs font-semibold text-orange-700 mb-2">📄 Document Attachment</p>
                      <a
                        href={`http://localhost:8004${answer.document_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm underline flex items-center gap-1"
                      >
                        <span>View Document</span>
                        <span className="text-xs">({answer.document_path.split("/").pop()})</span>
                      </a>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-3 border-t border-gray-200">
                    {answer.answered_at && (
                      <span>Answered {formatDistanceToNow(new Date(answer.answered_at), { addSuffix: true })}</span>
                    )}
                    {answer.duration_seconds && (
                      <span className="font-medium">⏱️ {Math.round(answer.duration_seconds)}s</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No responses recorded for this interview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
