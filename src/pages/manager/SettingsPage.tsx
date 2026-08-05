import { useState, useRef } from 'react';
import { Building2, User, Bell, Palette, Save, CheckCircle2, ImagePlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';

const PRESET_COLORS = [
  { name: 'Gold', primary: '#f59e0b', secondary: '#1e293b' },
  { name: 'Blue', primary: '#3b82f6', secondary: '#1e3a5f' },
  { name: 'Emerald', primary: '#10b981', secondary: '#064e3b' },
  { name: 'Rose', primary: '#f43f5e', secondary: '#1c1917' },
  { name: 'Violet', primary: '#8b5cf6', secondary: '#1e1b4b' },
  { name: 'Teal', primary: '#14b8a6', secondary: '#134e4a' },
];

export default function SettingsPage() {
  const { session, updateCompanyBranding } = useApp();
  const company = session?.company;
  const manager = session?.manager;

  const [companyName, setCompanyName] = useState(company?.name ?? '');
  const [themePrimary, setThemePrimary] = useState(company?.theme_primary ?? '#f59e0b');
  const [themeSecondary, setThemeSecondary] = useState(company?.theme_secondary ?? '#1e293b');
const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>(company?.logo_url ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogoFile(file);
      setLogoPreviewUrl(b64);
    };
    reader.readAsDataURL(file);
  }

  function applyPreset(preset: { primary: string; secondary: string }) {
    setThemePrimary(preset.primary);
    setThemeSecondary(preset.secondary);
    document.documentElement.style.setProperty('--color-primary', preset.primary);
    document.documentElement.style.setProperty('--color-secondary', preset.secondary);
  }

  function handlePrimaryChange(color: string) {
    setThemePrimary(color);
    document.documentElement.style.setProperty('--color-primary', color);
  }

  function handleSecondaryChange(color: string) {
    setThemeSecondary(color);
    document.documentElement.style.setProperty('--color-secondary', color);
  }

  async function handleSave() {
    if (!company?.id) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      name: companyName,
      theme_primary: themePrimary,
      theme_secondary: themeSecondary,
    };
    if (logoFile) updates.logo_url = logoPreviewUrl;
    const { error } = await supabase.from('companies').update(updates).eq('id', company.id);
    if (!error) {
      updateCompanyBranding({
        name: companyName,
        logo_url: logoPreviewUrl || undefined,
        theme_primary: themePrimary,
        theme_secondary: themeSecondary,
      });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-black text-gray-900">Settings</h1>

      {/* Company Branding */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-amber-500" />
          <h2 className="font-bold text-gray-900 text-sm">Company Branding</h2>
        </div>

        {/* Logo preview */}
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
          {logoPreviewUrl ? (
            <img src={logoPreviewUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-gray-200" onError={e => { e.currentTarget.style.display='none'; }} />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black" style={{ backgroundColor: themePrimary, color: themeSecondary }}>
              {companyName.charAt(0) || 'A'}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-800 text-sm">{companyName || 'Company Name'}</p>
            <p className="text-xs text-gray-400">Live preview</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Company Name</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Company Logo</label>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition text-left"
              style={{ borderColor: logoFile ? themePrimary : '#e5e7eb', backgroundColor: logoFile ? `${themePrimary}08` : '#f9fafb' }}
            >
              <ImagePlus className="w-5 h-5 flex-shrink-0" style={{ color: logoFile ? themePrimary : '#9ca3af' }} />
              {logoFile ? (
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: themePrimary }}>{logoFile.name}</p>
                  <p className="text-xs text-gray-400">Tap to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-600">Tap to pick from Photo Gallery</p>
                  <p className="text-xs text-gray-400">Accesses device storage directly</p>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Theme Customization */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-purple-500" />
          <h2 className="font-bold text-gray-900 text-sm">Theme Customization</h2>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium ml-auto">Live Preview</span>
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Preset Palettes</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESET_COLORS.map(preset => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition text-left ${themePrimary === preset.primary ? 'border-gray-400 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}
            >
              <div className="flex flex-col gap-1">
                <div className="w-5 h-2.5 rounded-sm" style={{ backgroundColor: preset.primary }} />
                <div className="w-5 h-2.5 rounded-sm" style={{ backgroundColor: preset.secondary }} />
              </div>
              <span className="text-xs font-semibold text-gray-700">{preset.name}</span>
              {themePrimary === preset.primary && <CheckCircle2 className="w-3 h-3 text-gray-500 ml-auto" />}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Custom Colors</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Primary Color</label>
            <div className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 bg-gray-50">
              <input type="color" value={themePrimary} onChange={e => handlePrimaryChange(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
              <span className="text-xs font-mono text-gray-600">{themePrimary}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Secondary Color</label>
            <div className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 bg-gray-50">
              <input type="color" value={themeSecondary} onChange={e => handleSecondaryChange(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
              <span className="text-xs font-mono text-gray-600">{themeSecondary}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: themeSecondary }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs" style={{ backgroundColor: themePrimary, color: themeSecondary }}>A</div>
          <span className="text-white font-bold text-xs">Attendees · Theme Preview</span>
          <div className="ml-auto px-3 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: themePrimary, color: themeSecondary }}>Button</div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-gray-900 text-sm">Account Info</h2>
        </div>
        {[
          { label: 'Manager ID', value: manager?.manager_id },
          { label: 'Name', value: manager?.name },
          { label: 'Company ID', value: `${company?.id?.slice(0, 16)}...` },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400 font-semibold">{item.label}</span>
            <span className="text-sm font-medium text-gray-700 font-mono">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Notification settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-gray-500" />
          <h2 className="font-bold text-gray-900 text-sm">Notifications</h2>
        </div>
        {[
          'Push alerts for check-ins',
          'Leave request notifications',
          'Payroll & wallet alerts',
        ].map(item => (
          <div key={item} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-700">{item}</span>
            <div className="w-9 h-5 rounded-full bg-gray-200 relative cursor-pointer">
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl font-black text-sm transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: themePrimary, color: themeSecondary, boxShadow: `0 8px 24px ${themePrimary}40` }}
      >
        {saving
          ? <span className="animate-spin w-4 h-4 border-2 border-current/30 border-t-current rounded-full" />
          : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved Successfully!' : 'Save All Settings'}
      </button>
    </div>
  );
}
