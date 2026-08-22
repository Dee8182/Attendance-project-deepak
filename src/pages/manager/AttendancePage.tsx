import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, Calendar, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { Employee, AttendanceRecord } from '../../types';

type StatusFilter = 'all' | 'present' | 'absent' | 'on_leave';

interface EmployeeWithStatus extends Employee {
  todayStatus: 'present' | 'absent' | 'on_leave' | 'late';
  checkIn?: string;
  checkOut?: string;
}

export default function AttendancePage() {
  const { session } = useApp();
  const companyId = session?.company?.id;

  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function load(showRefresh = false) {
    if (!companyId) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const [{ data: emps }, { data: att }] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', companyId).eq('status', 'active').order('name'),
      supabase.from('attendance_records').select('*').eq('company_id', companyId).eq('date', today),
    ]);

    const attMap = new Map<string, AttendanceRecord>();
    (att ?? []).forEach(a => attMap.set(a.employee_id, a));

    const enriched: EmployeeWithStatus[] = (emps ?? []).map(emp => {
      const rec = attMap.get(emp.id);
      return {
        ...emp,
        todayStatus: rec?.status ?? 'absent',
        checkIn: rec?.check_in_time,
        checkOut: rec?.check_out_time,
      };
    });

    setEmployees(enriched);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [companyId]);

  const total = employees.length;
  const present = employees.filter(e => e.todayStatus === 'present' || e.todayStatus === 'late').length;
  const onLeave = employees.filter(e => e.todayStatus === 'on_leave').length;
  const absent = total - present - onLeave;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const filtered = filter === 'all' ? employees :
    filter === 'present' ? employees.filter(e => e.todayStatus === 'present' || e.todayStatus === 'late') :
    filter === 'absent' ? employees.filter(e => e.todayStatus === 'absent') :
    employees.filter(e => e.todayStatus === 'on_leave');

  function statusColor(status: string) {
    if (status === 'present' || status === 'late') return '#22c55e';
    if (status === 'on_leave') return '#f59e0b';
    return '#ef4444';
  }

  function statusBadge(status: string) {
    if (status === 'present') return 'bg-green-100 text-green-700';
    if (status === 'late') return 'bg-orange-100 text-orange-700';
    if (status === 'on_leave') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  }

  async function markStatus(empId: string, status: 'present' | 'absent' | 'on_leave') {
    if (!companyId) return;
    await supabase.from('attendance_records').upsert({
      company_id: companyId,
      employee_id: empId,
      date: today,
      status,
      check_in_time: status === 'present' ? new Date().toISOString() : null,
    }, { onConflict: 'company_id,employee_id,date' });
    load(true);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Attendance Analytics</h1>
          <p className="text-gray-400 text-xs mt-0.5">{dateStr}</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="p-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition text-gray-500">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-5">
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total', value: total, color: 'text-slate-700', bg: 'bg-slate-100', icon: Users },
            { label: 'Present', value: present, color: 'text-green-700', bg: 'bg-green-100', icon: UserCheck },
            { label: 'Absent', value: absent, color: 'text-red-700', bg: 'bg-red-100', icon: UserX },
            { label: 'On Leave', value: onLeave, color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Calendar },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                <Icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                <p className={`text-xs font-medium ${stat.color} opacity-70`}>{stat.label}</p>
              </div>
            );
          })}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600">Attendance Rate</span>
            <span className="text-xs font-bold text-green-600">{rate}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{ width: `${rate}%`, background: `linear-gradient(90deg, #22c55e, #16a34a)` }}
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'present', 'absent', 'on_leave'] as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === f
                ? f === 'present' ? 'bg-green-500 text-white shadow-sm' :
                  f === 'absent' ? 'bg-red-500 text-white shadow-sm' :
                  f === 'on_leave' ? 'bg-yellow-500 text-white shadow-sm' :
                  'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <Filter className="w-3 h-3" />
            {f === 'all' ? 'All' : f === 'on_leave' ? 'On Leave' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Employee cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-sm">No employees found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex hover:shadow-md transition-shadow"
              style={{ borderLeft: `4px solid ${statusColor(emp.todayStatus)}` }}
            >
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{emp.name}</p>
                    <p className="text-gray-400 text-xs">{emp.employee_id} · {emp.role}</p>
                    <p className="text-gray-400 text-xs">{emp.department}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusBadge(emp.todayStatus)}`}>
                    {emp.todayStatus === 'on_leave' ? 'On Leave' : emp.todayStatus.charAt(0).toUpperCase() + emp.todayStatus.slice(1)}
                  </span>
                </div>

                {(emp.checkIn || emp.checkOut) && (
                  <div className="flex gap-4 mt-2">
                    {emp.checkIn && (
                      <div>
                        <p className="text-xs text-gray-400">Check In</p>
                        <p className="text-xs font-bold text-green-600">{new Date(emp.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    )}
                    {emp.checkOut && (
                      <div>
                        <p className="text-xs text-gray-400">Check Out</p>
                        <p className="text-xs font-bold text-blue-600">{new Date(emp.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick mark buttons */}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => markStatus(emp.id, 'present')} className="text-xs px-3 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition font-medium">Mark Present</button>
                  <button onClick={() => markStatus(emp.id, 'absent')} className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition font-medium">Mark Absent</button>
                  <button onClick={() => markStatus(emp.id, 'on_leave')} className="text-xs px-3 py-1 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition font-medium">On Leave</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
