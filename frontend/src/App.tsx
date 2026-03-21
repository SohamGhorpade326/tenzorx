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
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
