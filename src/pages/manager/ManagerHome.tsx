import { useEffect, useState } from 'react';
import { Users, ClipboardList, DollarSign, BarChart3, Music, MessageSquare, Settings, TrendingUp, UserCheck, UserX, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { Employee, AttendanceRecord } from '../../types';

interface DashboardStats {
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  pending: number;
}

interface QuickAction {
  id: string;
  label: string;
  sub: string;
  icon: typeof Users;
  color: string;
  bg: string;
}

const quickActions: QuickAction[] = [
  { id: 'employees', label: 'Employees', sub: 'Manage workforce', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'attendance', label: 'Records', sub: 'History & reports', icon: ClipboardList, color: 'text-teal-600', bg: 'bg-teal-50' },
  { id: 'payroll', label: 'Payroll', sub: 'Disburse salaries', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'analytics', label: 'Analytics', sub: 'Charts & insights', icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'salary', label: 'Salary', sub: 'Advances & loans', icon: DollarSign, color: 'text-pink-600', bg: 'bg-pink-50' },
  { id: 'playlist', label: 'Playlist', sub: 'Music tracks', icon: Music, color: 'text-teal-500', bg: 'bg-teal-50' },
  { id: 'helpdesk', label: 'Help Desk', sub: 'Staff requests', icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'settings', label: 'Settings', sub: 'Config & branding', icon: Settings, color: 'text-orange-500', bg: 'bg-orange-50' },
];

interface Props {
  onNavigate: (page: string) => void;
}

export default function ManagerHome({ onNavigate }: Props) {
  const { session } = useApp();
  const companyId = session?.company?.id;
  const manager = session?.manager;

  const [stats, setStats] = useState<DashboardStats>({ total: 0, present: 0, absent: 0, onLeave: 0, pending: 0 });
  const [recentCheckins, setRecentCheckins] = useState<(AttendanceRecord & { employees: Employee })[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    if (!companyId) return;
    async function load() {
      setLoading(true);
      const [{ data: emps }, { data: att }, { data: pending }] = await Promise.all([
        supabase.from('employees').select('id').eq('company_id', companyId).eq('status', 'active'),
        supabase.from('attendance_records').select('status').eq('company_id', companyId).eq('date', today),
        supabase.from('help_desk_tickets').select('id').eq('company_id', companyId).eq('status', 'pending'),
      ]);
      const total = emps?.length ?? 0;
      const present = att?.filter(a => a.status === 'present' || a.status === 'late').length ?? 0;
      const onLeave = att?.filter(a => a.status === 'on_leave').length ?? 0;
      const absent = total - present - onLeave;
      setStats({ total, present, absent: Math.max(0, absent), onLeave, pending: pending?.length ?? 0 });

      const { data: rec } = await supabase
        .from('attendance_records')
        .select('*, employees(name, role, employee_id)')
        .eq('company_id', companyId)
        .eq('date', today)
        .not('check_in_time', 'is', null)
        .order('check_in_time', { ascending: false })
        .limit(5);
      setRecentCheckins((rec ?? []) as unknown as (AttendanceRecord & { employees: Employee })[]);
      setLoading(false);
    }
    load();
  }, [companyId, today]);

  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <p className="text-gray-500 text-sm">{dateStr}</p>
        <h1 className="text-2xl font-black text-gray-900 mt-1">Manager Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1">{greeting}, <span className="font-semibold text-amber-600">{manager?.name}</span></p>
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-gray-700">{attendanceRate}% Attendance Today</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all duration-700" style={{ width: `${attendanceRate}%` }} />
          </div>
          <p className="text-gray-400 text-xs mt-1">{stats.present} of {stats.total} employees present</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-emerald-500 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-medium">Present</p>
              <p className="text-4xl font-black mt-1">{loading ? '—' : stats.present}</p>
            </div>
            <UserCheck className="w-10 h-10 text-white/30" />
          </div>
        </div>
        <div className="bg-red-500 rounded-2xl p-4 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs font-medium">Absent</p>
              <p className="text-4xl font-black mt-1">{loading ? '—' : stats.absent}</p>
            </div>
            <UserX className="w-10 h-10 text-white/30" />
          </div>
        </div>
        <div className="bg-amber-500 rounded-2xl p-4 text-white shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-xs font-medium">Leave</p>
              <p className="text-4xl font-black mt-1">{loading ? '—' : stats.onLeave}</p>
            </div>
            <ClipboardList className="w-10 h-10 text-white/30" />
          </div>
        </div>
        <div className="bg-slate-700 rounded-2xl p-4 text-white shadow-lg shadow-slate-700/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-xs font-medium">Pending</p>
              <p className="text-4xl font-black mt-1">{loading ? '—' : stats.pending}</p>
            </div>
            <Clock className="w-10 h-10 text-white/30" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onNavigate(action.id === 'salary' ? 'payroll' : action.id)}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:scale-105 transition-all text-left group"
              >
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition`}>
                  <Icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <p className="font-bold text-gray-900 text-sm leading-tight">{action.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{action.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Check-ins */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-sm">Recent Check-ins</h2>
          <TrendingUp className="w-4 h-4 text-gray-400" />
        </div>
        {recentCheckins.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No check-ins today</p>
        ) : (
          <div className="space-y-3">
            {recentCheckins.map(rec => (
              <div key={rec.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-xs">{rec.employees?.name?.charAt(0) ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{rec.employees?.name}</p>
                  <p className="text-xs text-gray-400">{rec.employees?.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600">
                    {rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    rec.status === 'present' ? 'bg-green-100 text-green-700' :
                    rec.status === 'late' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{rec.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
