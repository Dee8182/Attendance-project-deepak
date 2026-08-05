import { useEffect, useState } from 'react';
import { Wallet, Plus, CheckCircle2, Clock, X, CreditCard, Smartphone, ChevronRight, TrendingUp, Zap, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { Employee, WalletTransaction, SalaryAdvance, PayrollPayment } from '../../types';

type FundStep = 'amount' | 'method' | 'processing' | 'success';

const QUICK_AMOUNTS = [10000, 25000, 50000, 75000, 100000];
const PF_RATE = 0.12;
const ESI_RATE = 0.0075;

function generateRef() {
  return 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PayrollPage() {
  const { session } = useApp();
  const companyId = session?.company?.id;
  const pfEsiEnabled = session?.company?.pf_esi_enabled ?? false;
  const primary = session?.company?.theme_primary ?? '#f59e0b';

  const [balance, setBalance] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [advances, setAdvances] = useState<(SalaryAdvance & { employees: { name: string; employee_id: string } })[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Fund wallet
  const [showFund, setShowFund] = useState(false);
  const [fundStep, setFundStep] = useState<FundStep>('amount');
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'netbanking'>('upi');
  const [lastTxn, setLastTxn] = useState<{ amount: number; ref: string } | null>(null);

  const month = currentMonth();

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [{ data: wallet }, { data: emps }, { data: txns }, { data: advs }, { data: pays }] = await Promise.all([
      supabase.from('company_wallet').select('balance').eq('company_id', companyId).maybeSingle(),
      supabase.from('employees').select('*').eq('company_id', companyId).eq('status', 'active').order('name'),
      supabase.from('wallet_transactions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
      supabase.from('salary_advances').select('*, employees(name, employee_id)').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('payroll_payments').select('*').eq('company_id', companyId).eq('month', month),
    ]);
    setBalance(wallet?.balance ?? 0);
    setEmployees(emps ?? []);
    setTransactions(txns ?? []);
    setAdvances((advs ?? []) as unknown as (SalaryAdvance & { employees: { name: string; employee_id: string } })[]);
    setPayments(pays ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [companyId]);

  function calcSalary(base: number, emp?: Employee) {
    const pf = (pfEsiEnabled && emp?.is_pf_enabled) ? Math.round(base * PF_RATE) : 0;
    const esi = (pfEsiEnabled && emp?.is_esi_enabled) ? Math.round(base * ESI_RATE) : 0;
    const net = base - pf - esi;
    return { pf, esi, net };
  }

  function getPaymentStatus(empId: string) {
    return payments.find(p => p.employee_id === empId);
  }

  async function handleQuickPay(emp: Employee) {
    setPayingId(emp.id);
    await new Promise(r => setTimeout(r, 1500));
    const { pf, esi, net } = calcSalary(emp.salary, emp);
    const ref = generateRef();
    await supabase.from('payroll_payments').upsert({
      company_id: companyId,
      employee_id: emp.id,
      month,
      base_salary: emp.salary,
      pf_deduction: pf,
      esi_deduction: esi,
      net_salary: net,
      status: 'paid',
      paid_at: new Date().toISOString(),
      reference_id: ref,
    }, { onConflict: 'company_id,employee_id,month' });
    setPayingId(null);
    load();
  }

  async function handleAdvance(id: string, status: 'approved' | 'rejected') {
    await supabase.from('salary_advances').update({ status }).eq('id', id);
    load();
  }

  function openFund() {
    setFundStep('amount');
    setSelectedAmount(0);
    setCustomAmount('');
    setPaymentMethod('upi');
    setShowFund(true);
  }

  async function confirmDeposit() {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount <= 0) return;
    setFundStep('processing');
    await new Promise(r => setTimeout(r, 2200));
    const ref = generateRef();
    await Promise.all([
      supabase.from('wallet_transactions').insert({
        company_id: companyId,
        amount,
        payment_method: paymentMethod,
        reference_id: ref,
        status: 'success',
        note: `Wallet funded via ${paymentMethod === 'upi' ? 'UPI' : 'Net Banking'}`,
      }),
      supabase.from('company_wallet').upsert(
        { company_id: companyId, balance: balance + amount, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      ),
    ]);
    setBalance(b => b + amount);
    setLastTxn({ amount, ref });
    setFundStep('success');
    load();
  }

  const fundAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const totalMonthlyPayroll = employees.reduce((sum, e) => {
    const { net } = calcSalary(e.salary, e);
    return sum + net;
  }, 0);
  const paidCount = payments.filter(p => p.status === 'paid').length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-black text-gray-900">Payroll & Wallet</h1>
        {pfEsiEnabled && (
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-bold text-blue-700">PF/ESI Active</span>
          </div>
        )}
      </div>

      {/* Wallet Card */}
      <div className="rounded-3xl p-6 mb-5 shadow-2xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, #1e293b 0%, ${primary}33 100%)` }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 -translate-y-12 translate-x-12" style={{ backgroundColor: primary }} />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" style={{ color: primary }} />
              <p className="text-sm font-bold" style={{ color: primary }}>Company Wallet</p>
            </div>
            <span className="text-xs text-white/40">{session?.company?.name}</span>
          </div>
          <p className="text-white/60 text-xs mb-1">Available Balance</p>
          <p className="text-4xl font-black text-white">₹{loading ? '—' : balance.toLocaleString('en-IN')}</p>
          <div className="flex gap-3 mt-4">
            <div className="bg-white/10 rounded-xl px-3 py-2">
              <p className="text-xs text-white/60">Monthly Payroll</p>
              <p className="font-bold text-white text-sm">₹{totalMonthlyPayroll.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2">
              <p className="text-xs text-white/60">Paid This Month</p>
              <p className="font-bold text-white text-sm">{paidCount}/{employees.length}</p>
            </div>
          </div>
          <button
            onClick={openFund}
            className="mt-4 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition shadow-lg"
            style={{ backgroundColor: primary, color: '#1e293b', boxShadow: `0 8px 20px ${primary}50` }}
          >
            <Plus className="w-4 h-4" /> Fund Wallet
          </button>
        </div>
      </div>

      {/* Pending Advances */}
      {advances.filter(a => a.status === 'pending').length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <h2 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            Pending Advance Requests
          </h2>
          <div className="space-y-3">
            {advances.filter(a => a.status === 'pending').map(adv => (
              <div key={adv.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{adv.employees?.name}</p>
                  <p className="text-xs text-gray-500">₹{adv.amount?.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{adv.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAdvance(adv.id, 'approved')} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition">Approve</button>
                  <button onClick={() => handleAdvance(adv.id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-bold hover:bg-red-200 transition">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee Salary Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="font-bold text-gray-900 text-sm mb-4">
          Employee Salaries — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
        </h2>

        {/* PF/ESI legend */}
        {pfEsiEnabled && (
          <div className="flex gap-3 mb-4 p-3 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-blue-700"><span className="w-2 h-2 rounded-full bg-blue-500" />PF: 12%</div>
            <div className="flex items-center gap-1.5 text-xs text-green-700"><span className="w-2 h-2 rounded-full bg-green-500" />ESI: 0.75%</div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : employees.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No active employees</p>
        ) : (
          <div className="space-y-3">
            {employees.map(emp => {
              const { pf, esi, net } = calcSalary(emp.salary, emp);
              const payment = getPaymentStatus(emp.id);
              const isPaying = payingId === emp.id;
              const isPaid = payment?.status === 'paid';
              return (
                <div key={emp.id} className={`rounded-xl p-4 border-2 transition-all ${isPaid ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0" style={{ backgroundColor: `${primary}20`, color: primary }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.employee_id} · {emp.department}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          <span className="text-xs text-gray-600">Base: <strong>₹{emp.salary?.toLocaleString('en-IN')}</strong></span>
                          {pfEsiEnabled && <>
                            <span className="text-xs text-blue-600">PF: ₹{pf.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-green-600">ESI: ₹{esi.toLocaleString('en-IN')}</span>
                          </>}
                          <span className="text-xs font-bold text-gray-900">Net: ₹{net.toLocaleString('en-IN')}</span>
                        </div>
                        {isPaid && payment?.reference_id && (
                          <p className="text-xs font-mono text-green-600 mt-1">Ref: {payment.reference_id}</p>
                        )}
                      </div>
                    </div>
                    {isPaid ? (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Paid / Credited</span>
                        </div>
                        {payment?.paid_at && (
                          <p className="text-xs text-gray-400">{new Date(payment.paid_at).toLocaleDateString('en-IN')}</p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleQuickPay(emp)}
                        disabled={isPaying || !!payingId}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition disabled:opacity-50"
                        style={{ backgroundColor: primary, color: '#1e293b' }}
                      >
                        {isPaying ? (
                          <><span className="animate-spin w-3 h-3 border-2 border-current/30 border-t-current rounded-full" />Paying...</>
                        ) : (
                          <><Zap className="w-3.5 h-3.5" />Quick Pay</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallet Transaction History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          Wallet Transaction History
        </h2>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map(txn => (
              <div key={txn.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-green-700 font-black text-base">+₹{txn.amount?.toLocaleString('en-IN')}</span>
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">SUCCESS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{txn.payment_method === 'upi' ? 'UPI Payment' : 'Net Banking'}</span>
                  <span className="text-xs text-gray-400 font-mono">{txn.reference_id}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(txn.created_at).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fund Wallet Modal */}
      {showFund && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl">
            {fundStep === 'amount' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-black text-gray-900">Fund Wallet</h2>
                  <button onClick={() => setShowFund(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-widest">Quick Select Amount</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {QUICK_AMOUNTS.map(a => (
                    <button key={a} onClick={() => { setSelectedAmount(a); setCustomAmount(''); }}
                      className="py-3 rounded-xl font-bold text-sm border-2 transition"
                      style={{ borderColor: selectedAmount === a && !customAmount ? primary : '#e5e7eb', backgroundColor: selectedAmount === a && !customAmount ? `${primary}15` : 'transparent', color: selectedAmount === a && !customAmount ? primary : '#4b5563' }}>
                      ₹{a >= 100000 ? '1L' : `${a/1000}K`}
                    </button>
                  ))}
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Custom amount</label>
                  <input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0); }} placeholder="Enter amount in ₹" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none text-sm transition" style={{ borderColor: customAmount ? primary : undefined }} />
                </div>
                <button disabled={!fundAmount || fundAmount <= 0} onClick={() => setFundStep('method')}
                  className="w-full py-4 rounded-xl font-bold text-sm disabled:opacity-40 transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: primary, color: '#1e293b' }}>
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {fundStep === 'method' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-black text-gray-900">Select Payment Method</h2>
                  <button onClick={() => setFundStep('amount')} className="text-xs text-gray-400 hover:text-gray-600">Back</button>
                </div>
                <div className="rounded-xl p-3 mb-5 text-center" style={{ backgroundColor: `${primary}15`, border: `1px solid ${primary}40` }}>
                  <p className="text-xs font-semibold" style={{ color: primary }}>Depositing</p>
                  <p className="text-2xl font-black" style={{ color: primary }}>₹{fundAmount?.toLocaleString('en-IN')}</p>
                </div>
                <div className="space-y-3 mb-5">
                  {[
                    { id: 'upi', icon: Smartphone, label: 'UPI Payment', sub: 'GPay, PhonePe, Paytm' },
                    { id: 'netbanking', icon: CreditCard, label: 'Net Banking', sub: 'HDFC, SBI, ICICI, Axis' },
                  ].map(m => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id as 'upi' | 'netbanking')}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 transition"
                      style={{ borderColor: paymentMethod === m.id ? primary : '#e5e7eb', backgroundColor: paymentMethod === m.id ? `${primary}10` : 'transparent' }}>
                      <m.icon className="w-5 h-5" style={{ color: paymentMethod === m.id ? primary : '#9ca3af' }} />
                      <div className="text-left flex-1">
                        <p className="font-bold text-gray-900 text-sm">{m.label}</p>
                        <p className="text-xs text-gray-400">{m.sub}</p>
                      </div>
                      {paymentMethod === m.id && <CheckCircle2 className="w-5 h-5" style={{ color: primary }} />}
                    </button>
                  ))}
                </div>
                <button onClick={confirmDeposit} className="w-full py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition">
                  Confirm Deposit ₹{fundAmount?.toLocaleString('en-IN')}
                </button>
              </div>
            )}

            {fundStep === 'processing' && (
              <div className="p-8 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primary}20` }}>
                  <div className="w-10 h-10 border-4 border-current/20 rounded-full animate-spin" style={{ borderTopColor: primary }} />
                </div>
                <h2 className="font-black text-gray-900 text-lg mb-2">Processing Payment</h2>
                <p className="text-gray-400 text-sm">Simulating {paymentMethod === 'upi' ? 'UPI' : 'Net Banking'} transaction...</p>
                <div className="mt-4 flex justify-center gap-1">
                  {[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primary, animationDelay: `${i*0.15}s` }}/>)}
                </div>
              </div>
            )}

            {fundStep === 'success' && lastTxn && (
              <div className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="font-black text-gray-900 text-lg mb-1">Payment Successful!</h2>
                <p className="text-3xl font-black text-green-600 my-3">+₹{lastTxn.amount.toLocaleString('en-IN')}</p>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-5">
                  <p className="text-xs text-gray-400 mb-1">Reference ID</p>
                  <p className="font-mono font-bold text-green-700">{lastTxn.ref}</p>
                  <p className="text-xs text-gray-400 mt-2">New Balance: <strong>₹{balance.toLocaleString('en-IN')}</strong></p>
                </div>
                <button onClick={() => setShowFund(false)} className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
