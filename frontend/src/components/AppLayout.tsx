import { useState, createContext, useContext, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Upload, CheckSquare, ScrollText, Bell, Settings,
  Brain, Menu, X, Sun, Moon, Video, Package, Clock, BarChart3, Building2, CalendarDays, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Meeting Room', icon: Video, path: '/meeting', primary: true },
  { label: 'Process Meeting', icon: Upload, path: '/process' },
  { label: 'Tasks', icon: CheckSquare, path: '/tasks' },
  { label: 'Audit Trail', icon: ScrollText, path: '/audit' },
  { label: 'Escalations', icon: Bell, path: '/escalations' },
  { label: 'Calendar', icon: CalendarDays, path: '/calendar' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  // Procurement section
  { label: 'Procurement', icon: Package, path: '/procurement', section: true },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/procurement'},
  { label: 'New Request', icon: Upload, path: '/procurement/new' },
  { label: 'Analytics', icon: BarChart3, path: '/procurement/analytics' },
  { label: 'Vendors', icon: Building2, path: '/procurement/vendors' },
  { label: 'Review Queue', icon: Clock, path: '/procurement/reviews' },
  { label: 'Audit Log', icon: ScrollText, path: '/procurement/audit' },
  // Onboarding section
  { label: 'Onboarding', icon: CheckSquare, path: '/onboarding', section: true },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/onboarding' },
  { label: 'New Hire', icon: Upload, path: '/onboarding/new' },
  { label: 'Analytics', icon: BarChart3, path: '/onboarding/analytics' },
  // Contract workflow section
  { label: 'Contract Workflow', icon: FileText, path: '/contracts', section: true },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/contracts' },
  { label: 'New Contract Run', icon: Upload, path: '/contracts/new' },
  { label: 'Analytics', icon: BarChart3, path: '/contracts/analytics' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/meeting': 'Meeting Room',
  '/process': 'Process Meeting',
  '/tasks': 'Tasks',
  '/audit': 'Audit Trail',
  '/escalations': 'Escalations',
  '/calendar': 'Calendar',
  '/settings': 'Settings',
  '/procurement': 'Procurement Dashboard',
  '/procurement/new': 'New Purchase Request',
  '/procurement/analytics': 'Analytics Dashboard',
  '/procurement/vendors': 'Vendor Intelligence',
  '/procurement/reviews': 'Review Queue',
  '/procurement/audit': 'Audit Log',
  '/onboarding': 'Onboarding Dashboard',
  '/onboarding/new': 'New Hire Onboarding',
  '/onboarding/analytics': 'Onboarding Analytics Summary',
  '/contracts': 'Contract Workflow Dashboard',
  '/contracts/new': 'New Contract Workflow Run',
  '/contracts/analytics': 'Contract Analytics Summary',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  if (pathname.startsWith('/procurement/run/')) {
    return 'Procurement Run Details';
  }

  if (pathname.startsWith('/onboarding/run/')) {
    return 'Onboarding Run Details';
  }

  if (pathname.startsWith('/contracts/run/')) {
    return 'Contract Run Details';
  }

  return 'MeetingMind';
}

export default function AppLayout() {
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <div className="min-h-screen flex bg-background">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col bg-sidebar border-r border-[#30363d] transition-all duration-300',
          sidebarOpen ? 'w-[280px] translate-x-0' : 'w-[72px] max-lg:-translate-x-full'
        )}>
          <div className="px-5 py-4 flex items-center h-16">
            <div className="w-8 h-8 shrink-0 rounded-full bg-white flex items-center justify-center">
              <Brain className="w-5 h-5 text-black" />
            </div>
            {sidebarOpen && (
              <span className="font-semibold text-[16px] tracking-tight text-white ml-3 whitespace-nowrap overflow-hidden">Workstream.Ai</span>
            )}
            <button className="ml-auto text-[#8b949e] hover:text-white transition-colors lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1 overflow-x-hidden overflow-y-auto">
            {navItems.map((item, idx) => {
              const active = location.pathname === item.path;
              
              // Section header
              if ('section' in item && item.section) {
                return (
                  <div key={`section-${item.path}`}>
                    {idx > 0 && <div className="my-2 border-t border-[#30363d]" />}
                    {sidebarOpen && (
                      <div className="px-3 py-2 text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  title={!sidebarOpen ? item.label : undefined}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-[14px] font-medium transition-colors relative overflow-hidden',
                    active
                      ? 'bg-[#161b22] text-white'
                      : 'text-[#8b949e] hover:bg-[#161b22]/50 hover:text-white',
                    !sidebarOpen ? 'justify-center' : 'gap-3'
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-[10%] bottom-[10%] w-[3px] bg-primary rounded-r-md" />
                  )}
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {sidebarOpen && (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}
                  {item.primary && !active && sidebarOpen && (
                    <span className="ml-auto text-[10px] bg-[#1a1f24] border border-[#30363d] text-[#8b949e] px-1.5 py-0.5 rounded-full font-semibold shrink-0">NEW</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className={cn("p-4 border-t border-[#30363d] flex items-center", sidebarOpen ? "gap-2" : "justify-center")}>
             <div className="w-2 h-2 shrink-0 rounded-full bg-success animate-pulse" title="System Active" />
             {sidebarOpen && (
               <span className="text-xs text-[#8b949e] whitespace-nowrap overflow-hidden">System Active</span>
             )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b px-4 lg:px-6 h-14 flex items-center gap-4">
            <button 
              className="p-1.5 rounded-md hover:bg-muted/50 text-foreground transition-colors" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-lg font-semibold">{getPageTitle(location.pathname)}</h1>

            <div className="ml-auto flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>System Active</span>
              </div>
              <span className="hidden md:block text-xs text-muted-foreground">Last run: 2 mins ago</span>
              <button
                onClick={toggle}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
