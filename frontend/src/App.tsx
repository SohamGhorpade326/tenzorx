import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "@/pages/Dashboard";
import MeetingRoom from "@/pages/MeetingRoom";
import Tasks from "@/pages/Tasks";
import AuditTrail from "@/pages/AuditTrail";
import Escalations from "@/pages/Escalations";
import CalendarPage from "@/pages/CalendarPage";
import SettingsPage from "@/pages/Settings";
import NotFound from "./pages/NotFound.tsx";
import VideoOnboardingMeeting from "@/pages/VideoOnboardingMeeting";
import VideoRecords from "@/pages/VideoRecords";
import VideoRecordDetail from "@/pages/VideoRecordDetail";
import QuestionBuilder from "@/pages/QuestionBuilder";
import OnboardingDecision from "@/pages/OnboardingDecision";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            
            {/* Video Onboarding Routes (Public - Interview Only) */}
            <Route path="/video/meet/:sessionId" element={<VideoOnboardingMeeting />} />
            <Route path="/video/decision/:sessionId" element={<OnboardingDecision />} />
            
            {/* Video Onboarding HR/Records Routes */}
            <Route path="/video/records" element={<VideoRecords />} />
            <Route path="/video/records/:sessionId" element={<VideoRecordDetail />} />
            
            {/* Question Builder Routes */}
            <Route path="/video/builder" element={<QuestionBuilder />} />
            
            {/* Protected Routes - Authenticated Users */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/meeting" element={<MeetingRoom />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/audit" element={<AuditTrail />} />
              <Route path="/escalations" element={<Escalations />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
