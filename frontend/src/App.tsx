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
import SettingsPage from "@/pages/Settings";
import NotFound from "./pages/NotFound.tsx";

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
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
