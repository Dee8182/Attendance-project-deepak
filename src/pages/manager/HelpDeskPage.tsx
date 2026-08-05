import { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { HelpDeskTicket, Employee } from '../../types';

type TicketFilter = 'all' | 'pending' | 'resolved' | 'rejected';

export default function HelpDeskPage() {
  const { session } = useApp();
  const companyId = session?.company?.id;

  const [tickets, setTickets] = useState<(HelpDeskTicket & { employees: Pick<Employee, 'name' | 'employee_id' | 'role'> })[]>([]);
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('help_desk_tickets')
      .select('*, employees(name, employee_id, role)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setTickets((data ?? []) as unknown as (HelpDeskTicket & { employees: Pick<Employee, 'name' | 'employee_id' | 'role'> })[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [companyId]);

  async function updateStatus(id: string, status: 'resolved' | 'rejected') {
    await supabase.from('help_desk_tickets').update({ status }).eq('id', id);
    load();
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  function statusIcon(status: string) {
    if (status === 'resolved') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-orange-500" />;
  }

  function statusBadge(status: string) {
    if (status === 'resolved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-orange-100 text-orange-700';
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Help Desk</h1>
          <p className="text-gray-400 text-xs mt-0.5">{tickets.filter(t=>t.status==='pending').length} pending requests</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'pending', 'resolved', 'rejected'] as TicketFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${filter === f ? 'bg-slate-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
            <Filter className="w-3 h-3" />
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{tickets.filter(t => t.status === f).length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-700 font-bold text-xs">{ticket.employees?.name?.charAt(0) ?? '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{ticket.employees?.name}</p>
                      <span className="text-xs text-gray-400">{ticket.employees?.employee_id}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{ticket.employees?.role}</p>
                    <p className="font-semibold text-gray-800 text-sm">{ticket.subject}</p>
                    {ticket.message && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{ticket.message}</p>}
                    <p className="text-gray-300 text-xs mt-2">{new Date(ticket.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusBadge(ticket.status)}`}>
                    {statusIcon(ticket.status)}
                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </div>
                </div>
              </div>
              {ticket.status === 'pending' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => updateStatus(ticket.id, 'resolved')} className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                  </button>
                  <button onClick={() => updateStatus(ticket.id, 'rejected')} className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
