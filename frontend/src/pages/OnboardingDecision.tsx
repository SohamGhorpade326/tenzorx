import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { GroqDecisionResponse, GroqDecisionRequest } from "@/lib/video-api";

type LocationState = {
  decision?: GroqDecisionResponse;
  payload?: GroqDecisionRequest;
};

function statusStyles(category: string): { badge: string; panel: string } {
  const c = (category || "").toLowerCase();
  if (c.includes("not")) {
    return {
      badge: "bg-red-100 text-red-800 border-red-200",
      panel: "border-red-200",
    };
  }
  if (c.includes("conditional")) {
    return {
      badge: "bg-yellow-100 text-yellow-900 border-yellow-200",
      panel: "border-yellow-200",
    };
  }
  return {
    badge: "bg-green-100 text-green-800 border-green-200",
    panel: "border-green-200",
  };
}

export default function OnboardingDecision() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state || {}) as LocationState;

  const [decision, setDecision] = useState<GroqDecisionResponse | null>(state.decision || null);

  useEffect(() => {
    if (!sessionId) return;

    // Persist so refresh still shows the decision.
    if (state.decision) {
      sessionStorage.setItem(`vo:decision:${sessionId}`, JSON.stringify(state.decision));
      return;
    }

    // Restore if navigated directly.
    if (!decision) {
      const raw = sessionStorage.getItem(`vo:decision:${sessionId}`);
      if (raw) {
        try {
          setDecision(JSON.parse(raw) as GroqDecisionResponse);
        } catch {
          // ignore
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const derived = useMemo(() => {
    if (!decision) return null;
    const styles = statusStyles(decision.category);
    const message =
      decision.category === "Eligible"
        ? "You are eligible to proceed."
        : decision.category === "Conditionally Eligible"
          ? "You may proceed with additional verification."
          : "You are not eligible to proceed.";
    return { styles, message };
  }, [decision]);

  if (!decision || !derived) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="bg-white border rounded-lg p-6">
            <h1 className="text-xl font-bold text-gray-900">Decision not available</h1>
            <p className="text-sm text-gray-600 mt-2">
              This page needs a completed onboarding session. Please start a new interview from Interview Records.
            </p>
            <button
              onClick={() => navigate("/video/records")}
              className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Back to Records
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs text-gray-500">Session</div>
            <div className="font-mono text-sm text-gray-800">{sessionId}</div>
          </div>
          <button
            onClick={() => navigate("/video/records")}
            className="px-4 py-2 bg-white border rounded-lg font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
          >
            Back to Records
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: Status + message */}
          <div className={`bg-white border rounded-lg p-8 shadow-sm ${derived.styles.panel}`}>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${derived.styles.badge}`}>
              {decision.category}
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Decision</h1>
            <p className="mt-2 text-gray-700">{derived.message}</p>

            <div className="mt-6 rounded-md border bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-600 uppercase">Message</div>
              <div className="mt-1 text-sm text-gray-800">{decision.reason}</div>
            </div>
          </div>

          {/* RIGHT: Details */}
          <div className="bg-white border rounded-lg p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Details</h2>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div className="rounded-md border p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase">Loan amount range</div>
                <div className="mt-1 text-sm text-gray-900">{decision.loan_amount_range || "—"}</div>
              </div>

              <div className="rounded-md border p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase">Risk level</div>
                <div className="mt-1 text-sm text-gray-900">{decision.risk_level}</div>
              </div>

              <div className="rounded-md border p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase">Confidence</div>
                <div className="mt-1 text-sm text-gray-900">{Math.round(decision.confidence)}%</div>
              </div>

              <div className="rounded-md border p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase">Reason</div>
                <div className="mt-1 text-sm text-gray-800">{decision.reason}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
