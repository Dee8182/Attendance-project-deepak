import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';

interface DayStats { day: string; present: number; absent: number; total: number }

export default function AnalyticsPage() {
  const { session } = useApp();
  const companyId = session?.company?.id;
  const [weekData, setWeekData] = useState<DayStats[]>([]);
  const [totalEmp, setTotalEmp] = useState(0);
  const [monthRate, setMonthRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    async function load() {
      setLoading(true);
      const { data: emps } = await supabase.from('employees').select('id').eq('company_id', companyId).eq('status', 'active');
      const total = emps?.length ?? 0;
      setTotalEmp(total);

      // Last 7 days
      const days: DayStats[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const { data: att } = await supabase.from('attendance_records').select('status').eq('company_id', companyId).eq('date', dateStr);
        const present = att?.filter(a => a.status === 'present' || a.status === 'late').length ?? 0;
        days.push({ day: d.toLocaleDateString('en-IN', { weekday: 'short' }), present, absent: total - present, total });
      }
      setWeekData(days);

      // Month rate
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const { data: monthAtt } = await supabase.from('attendance_records').select('status').eq('company_id', companyId).gte('date', startOfMonth);
      const presentCount = monthAtt?.filter(a => a.status === 'present' || a.status === 'late').length ?? 0;
      const totalCount = monthAtt?.length ?? 0;
      setMonthRate(totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0);
      setLoading(false);
    }
    load();
  }, [companyId]);

  const maxPresent = Math.max(...weekData.map(d => d.total), 1);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-black text-gray-900 mb-5">Analytics & Insights</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <Users className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900">{totalEmp}</p>
          <p className="text-xs text-gray-400 font-medium">Total Staff</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-black text-green-600">{monthRate}%</p>
          <p className="text-xs text-gray-400 font-medium">Month Rate</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-black text-gray-900">{weekData.length}</p>
          <p className="text-xs text-gray-400 font-medium">Days Tracked</p>
        </div>
      </div>

      {/* Weekly Bar Chart */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <h2 className="font-bold text-gray-900 text-sm">Weekly Attendance</h2>
        </div>
        {loading ? (
          <div className="h-40 flex items-end gap-3">
            {[1,2,3,4,5,6,7].map(i=><div key={i} className="flex-1 bg-gray-100 animate-pulse rounded-t-lg" style={{height:`${30+i*10}%`}}/>)}
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-2 h-40 mb-2">
              {weekData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                    <div className="w-full flex flex-col gap-0.5" style={{ height: `${(d.total / maxPresent) * 100}%` }}>
                      <div className="flex-1 bg-emerald-500 rounded-t-lg" style={{ flex: d.present / Math.max(d.total, 1) }} />
                      <div className="bg-red-300 rounded-b-lg" style={{ flex: (d.total - d.present) / Math.max(d.total, 1), minHeight: d.total - d.present > 0 ? 2 : 0 }} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">{d.day}</p>
                  <p className="text-xs font-bold text-emerald-600">{d.present}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500"/><span className="text-xs text-gray-500">Present</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-300"/><span className="text-xs text-gray-500">Absent</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Day-by-day summary */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="font-bold text-gray-900 text-sm mb-4">Daily Breakdown</h2>
        <div className="space-y-3">
          {weekData.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 text-center">
                <p className="text-xs font-bold text-gray-500">{d.day}</p>
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: d.total > 0 ? `${(d.present / d.total) * 100}%` : '0%' }} />
                </div>
              </div>
              <div className="text-right w-16">
                <p className="text-xs font-bold text-emerald-600">{d.total > 0 ? Math.round((d.present / d.total) * 100) : 0}%</p>
                <p className="text-xs text-gray-400">{d.present}/{d.total}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
