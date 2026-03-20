import { useState, createContext, useContext, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Upload, CheckSquare, ScrollText, Bell, Settings,
  Brain, Menu, X, Sun, Moon, Video
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
  { label: 'Settings', icon: Settings, path: '/settings' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/meeting': 'Meeting Room',
  '/process': 'Process Meeting',
  '/tasks': 'Tasks',
  '/audit': 'Audit Trail',
  '/escalations': 'Escalations',
  '/settings': 'Settings',
};

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
              className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col bg-card border-r transition-transform duration-300',
          'w-[240px] lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="p-5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">MeetingMind</span>
            <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1">
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    item.primary && !active && 'text-primary'
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                  {item.primary && !active && (
                    <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold">NEW</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              System Active
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b px-4 lg:px-6 h-14 flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-lg font-semibold">{pageTitles[location.pathname] || 'MeetingMind'}</h1>

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
