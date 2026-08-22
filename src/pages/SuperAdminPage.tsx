import { useEffect, useState } from 'react';
import { Shield, Building2, Users, MessageSquare, AlertTriangle, LogOut, ChevronDown, ChevronUp, Send, X, RefreshCw, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Company, HelpDeskTicket, SuperAdminLog } from '../types';

interface CompanyStats extends Company {
  employee_count: number;
  manager_count: number;
}

type AdminTab = 'overview' | 'tickets' | 'logs';

export default function SuperAdminPage() {
  const { setSession } = useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [tickets, setTickets] = useState<(HelpDeskTicket & { company_name?: string; employee_name?: string })[]>([]);
  const [logs, setLogs] = useState<SuperAdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [respondTicket, setRespondTicket] = useState<HelpDeskTicket | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);

  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function deleteCompany(id: string) {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    setConfirmDelete(null);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    load();
  }

  async function toggleHold(id: string, currentStatus: string) {
    setTogglingId(id);
    const newStatus = currentStatus === 'held' ? 'active' : 'held';
    await supabase.from('companies').update({ status: newStatus }).eq('id', id);
    setTogglingId(null);
    load();
  }

  async function load() {
    setLoading(true);
    try {
    const [companiesRes, employeesRes, managersRes, ticketsRes, logsRes] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('company_id'),
      supabase.from('managers').select('company_id'),
      supabase.from('help_desk_tickets').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('super_admin_logs').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    const empMap = new Map<string, number>();
    (employeesRes.data ?? []).forEach(e => empMap.set(e.company_id, (empMap.get(e.company_id) ?? 0) + 1));
    const mgrMap = new Map<string, number>();
    (managersRes.data ?? []).forEach(m => mgrMap.set(m.company_id, (mgrMap.get(m.company_id) ?? 0) + 1));

    setCompanies((companiesRes.data ?? []).map(c => ({
      ...c,
      employee_count: empMap.get(c.id) ?? 0,
      manager_count: mgrMap.get(c.id) ?? 0,
    })));

    // Enrich tickets with company name
    const companyNameMap = new Map<string, string>((companiesRes.data ?? []).map(c => [c.id, c.name]));
    setTickets((ticketsRes.data ?? []).map(t => ({
      ...t,
      company_name: companyNameMap.get(t.company_id) ?? '—',
    })));

    setLogs(logsRes.data ?? []);
    } catch (e) {
      console.error('SuperAdmin load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!respondTicket || !responseText.trim()) return;
    setResponding(true);
    await supabase.from('help_desk_tickets').update({
      response: responseText.trim(),
      status: 'resolved',
      responded_at: new Date().toISOString(),
    }).eq('id', respondTicket.id);
    setResponding(false);
    setRespondTicket(null);
    setResponseText('');
    load();
  }

  const totalEmployees = companies.reduce((s, c) => s + c.employee_count, 0);
  const pendingTickets = tickets.filter(t => t.status === 'pending').length;
  const errorLogs = logs.filter(l => l.type === 'error').length;

  const statCards = [
    { label: 'Companies', value: companies.length, icon: Building2, color: '#3b82f6' },
    { label: 'Total Employees', value: totalEmployees, icon: Users, color: '#10b981' },
    { label: 'Open Tickets', value: pendingTickets, icon: MessageSquare, color: pendingTickets > 0 ? '#f59e0b' : '#6b7280' },
    { label: 'Error Logs', value: errorLogs, icon: AlertTriangle, color: errorLogs > 0 ? '#ef4444' : '#6b7280' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <p className="font-black text-sm text-amber-400 tracking-widest">SUPER ADMIN</p>
            <p className="text-xs text-gray-500">Platform Owner Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setSession(null)} className="p-2 rounded-xl bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-red-300 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div className="flex border-b border-gray-800 bg-gray-900 px-4">
        {([['overview', 'Overview'], ['tickets', 'Help Tickets'], ['logs', 'Error Logs']] as [AdminTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === key ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
            {key === 'tickets' && pendingTickets > 0 && (
              <span className="ml-1.5 bg-amber-400 text-slate-900 text-xs font-black rounded-full px-1.5 py-0.5">{pendingTickets}</span>
            )}
            {key === 'logs' && errorLogs > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs font-black rounded-full px-1.5 py-0.5">{errorLogs}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="space-y-3 mt-4">{[1,2,3,4].map(i=><div key={i} className="bg-gray-800 rounded-2xl h-16 animate-pulse"/>)}</div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {statCards.map(s => (
                    <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <s.icon className="w-4 h-4" style={{ color: s.color }} />
                        <p className="text-xs text-gray-400 font-semibold">{s.label}</p>
                      </div>
                      <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Companies list */}
                <div>
                  <h2 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Registered Companies</h2>
                  <div className="space-y-2">
                    {companies.map(c => {
                      const isHeld = c.status === 'held';
                      const isConfirming = confirmDelete === c.id;
                      return (
                        <div key={c.id} className={`bg-gray-900 border rounded-2xl overflow-hidden transition ${isHeld ? 'border-red-800/60' : 'border-gray-800'}`}>
                          <div className="flex items-center gap-3 p-4">
                            <button className="flex items-center gap-3 flex-1 min-w-0 text-left"
                              onClick={() => setExpandedCompany(expandedCompany === c.id ? null : c.id)}>
                              {c.logo_url ? (
                                <img src={c.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-amber-400 font-black">{c.name.charAt(0)}</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm text-white truncate">{c.name}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${isHeld ? 'bg-red-900/60 text-red-400' : 'bg-green-900/60 text-green-400'}`}>
                                    {isHeld ? 'On Hold' : 'Active'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">{c.employee_count} employees · {c.manager_count} manager(s)</p>
                              </div>
                              {expandedCompany === c.id ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                            </button>

                            {/* Hold/Active toggle */}
                            <button
                              onClick={() => toggleHold(c.id, c.status ?? 'active')}
                              disabled={togglingId === c.id}
                              title={isHeld ? 'Activate' : 'Put on Hold'}
                              className="p-2 rounded-xl transition flex-shrink-0 disabled:opacity-40"
                              style={{ backgroundColor: isHeld ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
                              {isHeld
                                ? <ToggleLeft className="w-5 h-5 text-green-400" />
                                : <ToggleRight className="w-5 h-5 text-red-400" />}
                            </button>

                            {/* Delete button */}
                            {isConfirming ? (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => deleteCompany(c.id)} className="px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition">Yes</button>
                                <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs font-semibold transition">No</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(c.id)}
                                title="Delete company"
                                className="p-2 rounded-xl bg-red-900/30 hover:bg-red-800/50 text-red-400 hover:text-red-300 transition flex-shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {expandedCompany === c.id && (
                            <div className="px-4 pb-4 pt-0 border-t border-gray-800 space-y-1.5 text-xs">
                              <div className="flex justify-between text-gray-400 pt-3">
                                <span>Company ID</span><span className="text-gray-300 font-mono truncate max-w-[55%]">{c.id}</span>
                              </div>
                              <div className="flex justify-between text-gray-400">
                                <span>Theme Primary</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block border border-gray-600" style={{ backgroundColor: c.theme_primary ?? '#f59e0b' }}/>{c.theme_primary ?? '#f59e0b'}</span>
                              </div>
                              <div className="flex justify-between text-gray-400">
                                <span>Status</span><span className={isHeld ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{isHeld ? 'On Hold' : 'Active'}</span>
                              </div>
                              <div className="flex justify-between text-gray-400">
                                <span>Registered</span><span className="text-gray-300">{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {companies.length === 0 && <p className="text-gray-600 text-sm text-center py-8">No companies registered yet</p>}
                  </div>
                </div>
              </div>
            )}

            {/* TICKETS TAB */}
            {tab === 'tickets' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">{tickets.length} total tickets across all companies</p>
                {tickets.map(t => (
                  <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.status === 'resolved' ? 'bg-green-900 text-green-400' : t.status === 'rejected' ? 'bg-red-900 text-red-400' : 'bg-amber-900 text-amber-400'}`}>
                            {t.status}
                          </span>
                          <span className="text-xs text-gray-500">{t.company_name}</span>
                        </div>
                        <p className="text-sm font-bold text-white">{t.subject}</p>
                        {t.message && <p className="text-xs text-gray-400 mt-0.5">{t.message}</p>}
                      </div>
                      <p className="text-xs text-gray-600 flex-shrink-0">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    {t.response && (
                      <div className="bg-green-900/20 border border-green-800/40 rounded-xl px-3 py-2 mt-2">
                        <p className="text-xs text-green-400 font-semibold mb-0.5">Admin Response:</p>
                        <p className="text-xs text-green-300">{t.response}</p>
                      </div>
                    )}
                    {t.status === 'pending' && (
                      <button onClick={() => { setRespondTicket(t); setResponseText(''); }}
                        className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition">
                        <Send className="w-3 h-3" /> Respond
                      </button>
                    )}
                  </div>
                ))}
                {tickets.length === 0 && <p className="text-gray-600 text-sm text-center py-10">No tickets yet</p>}
              </div>
            )}

            {/* LOGS TAB */}
            {tab === 'logs' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{logs.length} log entries (last 200)</p>
                {logs.map(l => (
                  <div key={l.id} className={`rounded-xl px-4 py-3 border text-xs ${l.type === 'error' ? 'bg-red-950/40 border-red-900/50' : 'bg-gray-900 border-gray-800'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold uppercase ${l.type === 'error' ? 'text-red-400' : 'text-gray-400'}`}>{l.type}</span>
                      <span className="text-gray-600">{new Date(l.created_at).toLocaleString('en-IN')}</span>
                    </div>
                    <p className={l.type === 'error' ? 'text-red-300' : 'text-gray-300'}>{l.message}</p>
                    {l.details && <p className="text-gray-500 mt-0.5 font-mono text-xs break-all">{l.details.slice(0, 300)}</p>}
                    {l.context && <p className="text-gray-600 mt-0.5">Context: {l.context}</p>}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-gray-600 text-sm text-center py-10">No logs yet — clean system!</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Respond Modal */}
      {respondTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-gray-900 border border-gray-700 w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-white">Respond to Ticket</h3>
              <button onClick={() => setRespondTicket(null)} className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-gray-800 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-gray-400 mb-0.5">{respondTicket.company_name}</p>
              <p className="text-sm font-bold text-white">{respondTicket.subject}</p>
              {respondTicket.message && <p className="text-xs text-gray-400 mt-1">{respondTicket.message}</p>}
            </div>
            <form onSubmit={handleRespond} className="space-y-3">
              <textarea
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                placeholder="Type your response..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-400 resize-none"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setRespondTicket(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-semibold text-sm hover:text-white transition">Cancel</button>
                <button type="submit" disabled={responding || !responseText.trim()}
                  className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm transition disabled:opacity-40 flex items-center justify-center gap-2">
                  {responding ? <span className="animate-spin w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" /> : <Send className="w-4 h-4" />}
                  Send Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
