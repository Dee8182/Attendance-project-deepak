import { useState, ReactNode } from 'react';
import { LayoutDashboard, Users, ClipboardList, DollarSign, BarChart3, Music, MessageSquare, Settings, LogOut, Bell, Moon, Menu, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';

type ManagerPage = 'dashboard' | 'employees' | 'attendance' | 'payroll' | 'analytics' | 'playlist' | 'helpdesk' | 'settings';

interface ManagerLayoutProps {
  currentPage: ManagerPage;
  onNavigate: (page: ManagerPage) => void;
  children: ReactNode;
}

const navItems: { id: ManagerPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'attendance', label: 'Records', icon: ClipboardList },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'playlist', label: 'Playlist', icon: Music },
  { id: 'helpdesk', label: 'Help Desk', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function ManagerLayout({ currentPage, onNavigate, children }: ManagerLayoutProps) {
  const { session, setSession } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const company = session?.company;
  const manager = session?.manager;
  const primary = company?.theme_primary ?? '#f59e0b';
  const secondary = company?.theme_secondary ?? '#1e293b';

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-slate-950' : 'bg-gray-50'}`}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-900'} border-r border-white/5 flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}>
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-xl object-cover" onError={e => e.currentTarget.style.display='none'} />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: primary }}>
                <span className="font-black text-lg" style={{ color: secondary }}>{(company?.name ?? 'A').charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm leading-tight line-clamp-1">{company?.name || 'Attendees'}</p>
              <p className="text-xs font-medium" style={{ color: primary }}>Manager Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                style={active ? { backgroundColor: primary, color: secondary } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Manager info */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ backgroundColor: `${primary}20`, borderColor: `${primary}40` }}>
              <span className="font-bold text-xs" style={{ color: primary }}>{manager?.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{manager?.name}</p>
              <p className="text-white/40 text-xs">{manager?.manager_id}</p>
            </div>
          </div>
          <button
            onClick={() => setSession(null)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-xs font-medium transition"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-gray-200'} border-b backdrop-blur-md px-4 py-3 flex items-center gap-4`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button onClick={() => setDarkMode(v => !v)} className={`p-2 rounded-xl ${darkMode ? 'bg-slate-800 text-amber-400' : 'bg-gray-100 text-gray-600'} hover:scale-105 transition`}>
            <Moon className="w-4 h-4" />
          </button>
          <button className={`p-2 rounded-xl ${darkMode ? 'bg-slate-800 text-white/60' : 'bg-gray-100 text-gray-600'} relative transition`}>
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <button onClick={() => setSession(null)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page content */}
        <main className={`flex-1 overflow-y-auto ${darkMode ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
