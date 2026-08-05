import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Shield, Users, Building2, ChevronRight, Star, ImagePlus, Zap } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Company, Manager, Employee } from '../types';
import { FounderSupportCard } from '../components/FounderSupportCard';

type LoginView = 'login' | 'register';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LoginPage() {
  const { setSession } = useApp();
  const [view, setView] = useState<LoginView>('login');

  // Manager login state
  const [companyCode, setCompanyCode] = useState('');
  const [managerId, setManagerId] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [managerError, setManagerError] = useState('');
  const [managerLoading, setManagerLoading] = useState(false);

  // Employee login state
  const [employeeId, setEmployeeId] = useState('');
  const [employeePin, setEmployeePin] = useState('');
  const [showEmpPin, setShowEmpPin] = useState(false);
  const [empError, setEmpError] = useState('');
  const [empLoading, setEmpLoading] = useState(false);
  const [savedEmployeeId, setSavedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('attendees_saved_employee_id');
    if (saved) {
      setEmployeeId(saved);
      setSavedEmployeeId(saved);
    }
  }, []);

  // Registration state
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regManagerId, setRegManagerId] = useState('');
  const [regManagerName, setRegManagerName] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regLogoFile, setRegLogoFile] = useState<File | null>(null);
  const [regLogoBase64, setRegLogoBase64] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const regLogoRef = useRef<HTMLInputElement>(null);

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setRegLogoFile(file);
    setRegLogoBase64(b64);
  }

  async function handleManagerLogin(e: React.FormEvent) {
    e.preventDefault();
    setManagerError('');
    setManagerLoading(true);
    if (!isSupabaseConfigured) { setManagerError('Database not configured. Deployment setup required.'); setManagerLoading(false); return; }
    try {
      // Super admin bypass — OWNER001 / 9999
      if (managerId.trim() === 'OWNER001' && managerPin.trim() === '9999') {
        setSession({ role: 'superadmin' });
        return;
      }

      // First resolve company by name/code
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, status')
        .ilike('name', companyCode.trim())
        .limit(1);
      if (compErr) throw compErr;
      const resolvedCompany = companies?.[0];
      if (!resolvedCompany) { setManagerError('Company not found. Check your Company Code.'); return; }
      if (resolvedCompany.status === 'held') { setManagerError('Account ON HOLD. Please contact administrator.'); return; }

      // Then find manager within that company
      const { data, error } = await supabase
        .from('managers')
        .select('*, companies(*)')
        .eq('company_id', resolvedCompany.id)
        .eq('manager_id', managerId.trim())
        .eq('pin', managerPin.trim())
        .limit(1);
      if (error) throw error;
      const mgr = (data?.[0]) as (Manager & { companies: Company }) | undefined;
      if (!mgr) { setManagerError('Invalid Manager ID or PIN'); return; }

      setSession({
        role: 'manager',
        company: mgr.companies,
        manager: { ...mgr, companies: undefined } as unknown as Manager,
      });
    } catch {
      setManagerError('Login failed. Please try again.');
    } finally {
      setManagerLoading(false);
    }
  }

  async function handleEmployeeLogin(e: React.FormEvent) {
    e.preventDefault();
    setEmpError('');
    setEmpLoading(true);
    if (!isSupabaseConfigured) { setEmpError('Database not configured. Deployment setup required.'); setEmpLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, companies(*)')
        .eq('employee_id', employeeId.trim())
        .eq('pin', employeePin.trim())
        .eq('status', 'active')
        .limit(1);
      if (error) throw error;
      const emp = (data?.[0]) as (Employee & { companies: Company }) | undefined;
      if (!emp) { setEmpError('Invalid Employee ID or PIN'); return; }
      if (emp.companies?.status === 'held') { setEmpError('Account ON HOLD. Please contact administrator.'); return; }

      setSession({
        role: 'employee',
        company: emp.companies,
        employee: { ...emp, companies: undefined } as unknown as Employee,
      });
      localStorage.setItem('attendees_saved_employee_id', employeeId.trim());
      setSavedEmployeeId(employeeId.trim());
    } catch {
      setEmpError('Login failed. Please try again.');
    } finally {
      setEmpLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    if (!isSupabaseConfigured) { setRegError('Database not configured. Deployment setup required.'); return; }
    if (!regCompanyName.trim() || !regManagerId.trim() || !regManagerName.trim() || !regPin.trim()) {
      setRegError('All fields are required');
      return;
    }
    setRegLoading(true);
    try {
      const { data: company, error: compErr } = await supabase
        .from('companies')
        .insert({ name: regCompanyName.trim(), logo_url: regLogoBase64 || null })
        .select()
        .single();
      if (compErr) throw compErr;

      const { error: mgrErr } = await supabase
        .from('managers')
        .insert({ company_id: company.id, manager_id: regManagerId.trim(), pin: regPin.trim(), name: regManagerName.trim() });
      if (mgrErr) throw mgrErr;

      await supabase.from('company_wallet').insert({ company_id: company.id, balance: 0 });

      setRegSuccess(`Company "${regCompanyName}" registered! Login with Company Code: ${regCompanyName} / ID: ${regManagerId} / PIN: ${regPin}`);
      setRegCompanyName(''); setRegManagerId(''); setRegManagerName(''); setRegPin('');
      setRegLogoFile(null); setRegLogoBase64('');
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  }

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400 mb-4 shadow-lg">
              <Building2 className="w-8 h-8 text-slate-900" />
            </div>
            <h1 className="text-3xl font-bold text-white">Attendees</h1>
            <p className="text-amber-300 text-sm mt-1">Register Your Company</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">New Company Registration</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-amber-300 text-xs font-semibold uppercase tracking-widest mb-2">Company Name</label>
                <input type="text" value={regCompanyName} onChange={e => setRegCompanyName(e.target.value)} placeholder="e.g. Acme Corp"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition" />
              </div>

              {/* Logo file picker */}
              <div>
                <label className="block text-amber-300 text-xs font-semibold uppercase tracking-widest mb-2">Company Logo <span className="text-white/40 normal-case text-xs">(optional)</span></label>
                <input ref={regLogoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                <button type="button" onClick={() => regLogoRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition text-left"
                  style={{ borderColor: regLogoFile ? '#f59e0b' : 'rgba(255,255,255,0.2)', backgroundColor: regLogoFile ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)' }}>
                  {regLogoBase64 ? (
                    <img src={regLogoBase64} alt="Preview" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <ImagePlus className="w-5 h-5 text-white/40 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: regLogoFile ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                      {regLogoFile ? regLogoFile.name : 'Tap to pick from Photo Gallery'}
                    </p>
                    <p className="text-xs text-white/30">{regLogoFile ? 'Tap to change' : 'Accesses device storage directly'}</p>
                  </div>
                </button>
              </div>

              <div>
                <label className="block text-amber-300 text-xs font-semibold uppercase tracking-widest mb-2">Manager Name</label>
                <input type="text" value={regManagerName} onChange={e => setRegManagerName(e.target.value)} placeholder="Full name"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-amber-300 text-xs font-semibold uppercase tracking-widest mb-2">Manager ID</label>
                  <input type="text" value={regManagerId} onChange={e => setRegManagerId(e.target.value)} placeholder="e.g. MGR001"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition" />
                </div>
                <div>
                  <label className="block text-amber-300 text-xs font-semibold uppercase tracking-widest mb-2">4-Digit PIN</label>
                  <input type="password" value={regPin} onChange={e => setRegPin(e.target.value)} placeholder="••••" maxLength={4}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition" />
                </div>
              </div>

              {regError && <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm">{regError}</div>}
              {regSuccess && <div className="bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-3 text-green-300 text-sm">{regSuccess}</div>}

              <button type="submit" disabled={regLoading}
                className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-amber-400/30 disabled:opacity-50 flex items-center justify-center gap-2">
                {regLoading ? <span className="animate-spin w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" /> : <Building2 className="w-4 h-4" />}
                Register Company
              </button>
              <button type="button" onClick={() => setView('login')}
                className="w-full py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 font-medium text-sm transition">
                Back to Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Manager Panel */}
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow">
              <Shield className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <p className="text-amber-400 font-bold text-sm tracking-widest">ATTENDEES</p>
              <p className="text-white/40 text-xs">Manager Portal</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-300 text-xs font-medium">Manager Access</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">
            Manager <span className="text-amber-400">(MGR)</span><br />Login
          </h1>
          <p className="text-white/50 text-sm mt-2">Secure access to your management dashboard</p>
        </div>

        <div className="flex-1 px-8 pb-8 flex flex-col justify-center">
          <form onSubmit={handleManagerLogin} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Company Code</label>
              <input type="text" value={companyCode} onChange={e => setCompanyCode(e.target.value)} placeholder="e.g. Acme Corp"
                className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition text-sm" />
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Manager ID</label>
              <input type="text" value={managerId} onChange={e => setManagerId(e.target.value)} placeholder="e.g. MGR001"
                className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition text-sm" />
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">PIN</label>
              <div className="relative">
                <input type={showManagerPin ? 'text' : 'password'} value={managerPin} onChange={e => setManagerPin(e.target.value)}
                  placeholder="Enter PIN" maxLength={4}
                  className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition text-sm pr-12" />
                <button type="button" onClick={() => setShowManagerPin(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition">
                  {showManagerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {managerError && <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">{managerError}</div>}

            <button type="submit" disabled={managerLoading}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
              {managerLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Shield className="w-4 h-4" />}
              Sign In as Manager
            </button>
            <div className="text-center">
              <p className="text-white/30 text-xs">Enter Company Name + Manager ID + PIN</p>
            </div>
          </form>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden md:flex items-center justify-center w-px bg-white/10 relative">
        <div className="absolute bg-amber-400 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">OR</div>
      </div>
      <div className="md:hidden h-px bg-white/10 relative flex items-center justify-center">
        <div className="absolute bg-amber-400 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">OR</div>
      </div>

      {/* Employee Panel */}
      <div className="flex-1 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 flex flex-col">
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-emerald-400 font-bold text-sm tracking-widest">ATTENDEES</p>
              <p className="text-white/40 text-xs">Employee Portal</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-xs font-medium">Employee Access</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">
            Employee <span className="text-emerald-400">(EMP)</span><br />Login
          </h1>
          <p className="text-white/50 text-sm mt-2">Quick, secure shift check-in access</p>
        </div>

        <div className="flex-1 px-8 pb-8 flex flex-col justify-center">
          <form onSubmit={handleEmployeeLogin} className="space-y-5">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Employee ID</label>
              <div className="relative">
                <input type="text" value={employeeId} onChange={e => { setEmployeeId(e.target.value); setSavedEmployeeId(null); }} placeholder="e.g. EMP001"
                  className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/30 transition text-sm pr-12" />
                {savedEmployeeId && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                    <Zap className="w-3 h-3" /> Saved
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">4-Digit PIN</label>
              <div className="relative">
                <input type={showEmpPin ? 'text' : 'password'} value={employeePin} onChange={e => setEmployeePin(e.target.value)}
                  placeholder="Enter PIN" maxLength={4}
                  className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/30 transition text-sm pr-12" />
                <button type="button" onClick={() => setShowEmpPin(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition">
                  {showEmpPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {empError && <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">{empError}</div>}

            <button type="submit" disabled={empLoading}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
              {empLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Users className="w-4 h-4" />}
              Sign In as Employee
            </button>
            <div className="text-center">
              <p className="text-white/30 text-xs">{savedEmployeeId ? 'Your ID is saved — just enter your PIN' : 'Enter your Employee ID + PIN'}</p>
            </div>
          </form>
        </div>
      </div>

      {/* New Company Registration Banner */}
      <button onClick={() => setView('register')}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-slate-900 px-6 py-3 rounded-2xl shadow-2xl shadow-amber-400/40 transition-all hover:scale-105 z-50">
        <Star className="w-4 h-4" />
        <span className="font-bold text-sm">New Company Registration</span>
        <ChevronRight className="w-4 h-4" />
      </button>
      <FounderSupportCard />
    </div>
  );
}
