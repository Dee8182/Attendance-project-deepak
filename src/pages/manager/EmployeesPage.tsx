import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, X, User, Phone, Mail, Briefcase, DollarSign, Lock, Shield, ToggleLeft, ToggleRight, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { Employee } from '../../types';

function buildCompanyPrefix(companyName: string): string {
  const cleaned = companyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = cleaned.replace(/[^A-Z]/g, '');
  const digits = cleaned.replace(/[^0-9]/g, '');
  const alphaPart = letters.slice(0, 3) || 'EMP';
  return (alphaPart + digits).slice(0, 4);
}

interface EmpForm {
  employee_id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  salary: string;
  pin: string;
  work_location_name: string;
  work_lat: string;
  work_lng: string;
  work_radius: string;
  is_pf_enabled: boolean;
  is_esi_enabled: boolean;
}

const emptyForm: EmpForm = {
  employee_id: '', name: '', role: '', department: '', phone: '', email: '',
  salary: '', pin: '1234', work_location_name: '', work_lat: '', work_lng: '', work_radius: '200',
  is_pf_enabled: false, is_esi_enabled: false,
};

export default function EmployeesPage() {
  const { session } = useApp();
  const companyId = session?.company?.id;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmpForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').eq('company_id', companyId).order('name');
    setEmployees(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [companyId]);

  function openAdd() {
    setEditEmployee(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
    generateEmployeeId();
  }

  async function generateEmployeeId() {
    if (!companyId || !session?.company?.name) return;
    const prefix = buildCompanyPrefix(session.company.name);
    try {
      const { data } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('company_id', companyId)
        .like('employee_id', `${prefix}%`)
        .order('employee_id', { ascending: false })
        .limit(1);
      let nextNum = 1;
      if (data && data.length > 0) {
        const lastId = data[0].employee_id;
        const numPart = lastId.replace(prefix, '');
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      const newId = `${prefix}${String(nextNum).padStart(2, '0')}`;
      setForm(f => ({ ...f, employee_id: newId }));
    } catch {
      setForm(f => ({ ...f, employee_id: `${prefix}01` }));
    }
  }

  function openEdit(emp: Employee) {
    setEditEmployee(emp);
    setForm({
      employee_id: emp.employee_id,
      name: emp.name,
      role: emp.role ?? '',
      department: emp.department ?? '',
      phone: emp.phone ?? '',
      email: emp.email ?? '',
      salary: String(emp.salary),
      pin: emp.pin,
      work_location_name: emp.work_location_name ?? '',
      work_lat: String(emp.work_lat ?? ''),
      work_lng: String(emp.work_lng ?? ''),
      work_radius: String(emp.work_radius ?? 200),
      is_pf_enabled: emp.is_pf_enabled ?? false,
      is_esi_enabled: emp.is_esi_enabled ?? false,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.employee_id || !form.name || !form.pin || !form.work_location_name || !form.work_lat || !form.work_lng) {
      setError('Employee ID, Name, PIN, and Work Location are required');
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      employee_id: form.employee_id.trim(),
      name: form.name.trim(),
      role: form.role || null,
      department: form.department || null,
      phone: form.phone || null,
      email: form.email || null,
      salary: parseFloat(form.salary) || 0,
      pin: form.pin,
      work_location_name: form.work_location_name,
      work_lat: parseFloat(form.work_lat) || null,
      work_lng: parseFloat(form.work_lng) || null,
      work_radius: parseFloat(form.work_radius) || 200,
      is_pf_enabled: form.is_pf_enabled,
      is_esi_enabled: form.is_esi_enabled,
    };
    if (editEmployee) {
      const { error: err } = await supabase.from('employees').update(payload).eq('id', editEmployee.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('employees').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setShowModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from('employees').delete().eq('id', id);
    setDeleteConfirm(null);
    load();
  }

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Employees</h1>
          <p className="text-gray-400 text-xs mt-0.5">{employees.length} staff members</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm transition shadow-sm hover:shadow-amber-400/30 shadow-amber-400/20">
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ID, or department..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No employees found</p>
          <button onClick={openAdd} className="mt-3 text-amber-600 text-sm font-semibold hover:underline">Add first employee</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => (
            <div key={emp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-slate-900 font-black text-sm">{emp.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-gray-900 text-sm">{emp.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{emp.status}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{emp.employee_id} · {emp.role} · {emp.department}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {emp.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone className="w-3 h-3" />{emp.phone}</span>}
                    {emp.work_location_name && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <MapPin className="w-3 h-3" />{emp.work_location_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign className="w-3 h-3 text-amber-500" />
                    <span className="text-xs text-gray-600 font-semibold">₹{emp.salary?.toLocaleString('en-IN')}/mo</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(emp)} className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm(emp.id)} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900">{editEmployee ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Basic Info</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Hash className="w-3 h-3" />Employee ID {editEmployee ? '' : '(auto-generated)'}</label>
                  <input type="text" value={form.employee_id} disabled={!editEmployee} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} placeholder="Auto-generated" className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 ${!editEmployee ? 'bg-gray-50 text-gray-600 font-semibold cursor-not-allowed' : ''}`} />
                  {!editEmployee && <p className="text-xs text-gray-400 mt-1">Generated from company name</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Role / Designation</label>
                  <input type="text" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Security Guard" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Department</label>
                  <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Operations" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-2 mb-1 mt-2">
                <Phone className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Contact</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="emp@company.com" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
              </div>

              {/* Salary & PIN */}
              <div className="flex items-center gap-2 mb-1 mt-2">
                <Briefcase className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Employment</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Monthly Salary (₹)</label>
                  <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="25000" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" />Login PIN *</label>
                  <input type="password" value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="••••" maxLength={4} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30" />
                </div>
              </div>

              {/* PF & ESI Selection */}
              <div className="flex items-center gap-2 mb-1 mt-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">PF & ESI Selection</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Enable PF for this Employee</p>
                    <p className="text-xs text-gray-400">12% of base salary deducted monthly</p>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, is_pf_enabled: !f.is_pf_enabled }))}>
                    {form.is_pf_enabled
                      ? <ToggleRight className="w-9 h-9 text-blue-500" />
                      : <ToggleLeft className="w-9 h-9 text-gray-300" />}
                  </button>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Enable ESI for this Employee</p>
                    <p className="text-xs text-gray-400">0.75% of base salary deducted monthly</p>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, is_esi_enabled: !f.is_esi_enabled }))}>
                    {form.is_esi_enabled
                      ? <ToggleRight className="w-9 h-9 text-green-500" />
                      : <ToggleLeft className="w-9 h-9 text-gray-300" />}
                  </button>
                </div>
              </div>

              {/* Geo-fence */}
              <div className="flex items-center gap-2 mb-1 mt-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Assign Work Location *</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Location Name *</label>
                  <input type="text" value={form.work_location_name} onChange={e => setForm(f => ({ ...f, work_location_name: e.target.value }))} placeholder="Office Premises, Block A" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Latitude *</label>
                    <input type="number" step="any" value={form.work_lat} onChange={e => setForm(f => ({ ...f, work_lat: e.target.value }))} placeholder="28.6139" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Longitude *</label>
                    <input type="number" step="any" value={form.work_lng} onChange={e => setForm(f => ({ ...f, work_lng: e.target.value }))} placeholder="77.2090" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Radius (m)</label>
                    <input type="number" value={form.work_radius} onChange={e => setForm(f => ({ ...f, work_radius: e.target.value }))} placeholder="200" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30" />
                  </div>
                </div>
                <p className="text-xs text-blue-500">Geo-fence coordinates used for face-scan check-in verification</p>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <span className="animate-spin w-4 h-4 border-2 border-slate-900/20 border-t-slate-900 rounded-full" /> : null}
                  {editEmployee ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Delete Employee?</h3>
            <p className="text-gray-500 text-sm mb-5">This will permanently remove the employee and their records.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
