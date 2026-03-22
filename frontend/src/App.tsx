import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ProcessMeeting from "@/pages/ProcessMeeting";
import MeetingRoom from "@/pages/MeetingRoom";
import Tasks from "@/pages/Tasks";
import AuditTrail from "@/pages/AuditTrail";
import Escalations from "@/pages/Escalations";
import CalendarPage from "@/pages/CalendarPage";
import SettingsPage from "@/pages/Settings";
import NotFound from "./pages/NotFound.tsx";
import ProcurementDashboard from "@/pages/procurement/ProcurementDashboard";
import NewProcurementRequest from "@/pages/procurement/NewProcurementRequest";
import ProcurementRunDetail from "@/pages/procurement/ProcurementRunDetail";
import ProcurementReviews from "@/pages/procurement/ProcurementReviews";
import ProcurementAuditLog from "@/pages/procurement/ProcurementAuditLog";
import AnalyticsDashboard from "@/pages/procurement/AnalyticsDashboard";
import VendorIntelligence from "@/pages/procurement/VendorIntelligence";
import OnboardingDashboard from "@/pages/onboarding/OnboardingDashboard";
import NewOnboardingRequest from "@/pages/onboarding/NewOnboardingRequest";
import OnboardingRunDetail from "@/pages/onboarding/OnboardingRunDetail";
import OnboardingAnalytics from "@/pages/onboarding/OnboardingAnalytics";
import ContractDashboard from "@/pages/contract/ContractDashboard";
import NewContractRequest from "@/pages/contract/NewContractRequest";
import ContractRunDetail from "@/pages/contract/ContractRunDetail";
import ContractAnalytics from "@/pages/contract/ContractAnalytics";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/meeting" element={<MeetingRoom />} />
            <Route path="/process" element={<ProcessMeeting />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/audit" element={<AuditTrail />} />
            <Route path="/escalations" element={<Escalations />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Procurement Routes */}
            <Route path="/procurement" element={<ProcurementDashboard />} />
            <Route path="/procurement/new" element={<NewProcurementRequest />} />
            <Route path="/procurement/run/:runId" element={<ProcurementRunDetail />} />
            <Route path="/procurement/reviews" element={<ProcurementReviews />} />
            <Route path="/procurement/audit" element={<ProcurementAuditLog />} />
            <Route path="/procurement/analytics" element={<AnalyticsDashboard />} />
            <Route path="/procurement/vendors" element={<VendorIntelligence />} />
            {/* Onboarding Routes */}
            <Route path="/onboarding" element={<OnboardingDashboard />} />
            <Route path="/onboarding/new" element={<NewOnboardingRequest />} />
            <Route path="/onboarding/run/:runId" element={<OnboardingRunDetail />} />
            <Route path="/onboarding/analytics" element={<OnboardingAnalytics />} />
            {/* Contract Workflow Routes */}
            <Route path="/contracts" element={<ContractDashboard />} />
            <Route path="/contracts/new" element={<NewContractRequest />} />
            <Route path="/contracts/run/:runId" element={<ContractRunDetail />} />
            <Route path="/contracts/analytics" element={<ContractAnalytics />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
