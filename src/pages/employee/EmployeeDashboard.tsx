import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Home, Calendar, CheckSquare, User, Bell, Moon, Sun, LogOut, Camera,
  MapPin, Music, Play, Pause, SkipForward, SkipBack, Volume2,
  MessageSquare, Clock, X, CheckCircle2, Download, FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { AttendanceRecord, LeaveRequest, HelpDeskTicket, SalaryAdvance, PlaylistSong } from '../../types';

type EmpTab = 'home' | 'attendance' | 'tasks' | 'profile';
type ScanStep = 'idle' | 'requesting' | 'scanning' | 'success' | 'error';

interface RequestCounts {
  pendingLeave: number; approvedLeave: number;
  pendingTickets: number; resolvedTickets: number;
  pendingAdvances: number; approvedAdvances: number;
}

const PF_RATE = 0.12;
const ESI_RATE = 0.0075;

export default function EmployeeDashboard() {
  const { session, setSession } = useApp();
  const emp = session?.employee;
  const company = session?.company;
  const companyId = company?.id;
  const primary = company?.theme_primary ?? '#f59e0b';
  const pfEsiEnabled = company?.pf_esi_enabled ?? false;

  const [tab, setTab] = useState<EmpTab>('home');
  const [darkMode, setDarkMode] = useState(false);
  const [geoFencing, setGeoFencing] = useState(true);

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [geoStatus, setGeoStatus] = useState<'unknown' | 'inside' | 'outside'>('unknown');
  const [geoWarn, setGeoWarn] = useState('');
  const [weekAttendance] = useState<number[]>([3, 5, 4, 5, 4, 2, 3]);

  const [requests, setRequests] = useState<RequestCounts>({
    pendingLeave: 0, approvedLeave: 0, pendingTickets: 0,
    resolvedTickets: 0, pendingAdvances: 0, approvedAdvances: 0,
  });
  const [showRequestStatus, setShowRequestStatus] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'casual', start: '', end: '', reason: '' });
  const [helpForm, setHelpForm] = useState({ subject: '', message: '' });
  const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  // --- Shift Selector ---
  const [shiftType, setShiftType] = useState<'A' | 'B'>('A');
  const [shiftHours, setShiftHours] = useState<8 | 12>(8);

  // Playlist (read-only)
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playTimer = useRef<NodeJS.Timeout | null>(null);
  const empAudioRef = useRef<HTMLAudioElement | null>(null);
  const songsLenRef = useRef(0);

  const [leaveList, setLeaveList] = useState<LeaveRequest[]>([]);
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);

  // --- WebRTC face scan ---
  const [scanStep, setScanStep] = useState<ScanStep>('idle');
  const [scanAction, setScanAction] = useState<'checkin' | 'checkout'>('checkin');
  const [camError, setCamError] = useState('');
  const [camDenied, setCamDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- GPS Camera ---
  const [showGpsCamera, setShowGpsCamera] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState('Locating...');
  const [gpsTime, setGpsTime] = useState(new Date());
  const [gpsCameraError, setGpsCameraError] = useState('');
  const gpsVideoRef = useRef<HTMLVideoElement>(null);
  const gpsStreamRef = useRef<MediaStream | null>(null);
  const gpsWatchRef = useRef<number | null>(null);
  const gpsClockRef = useRef<NodeJS.Timeout | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  async function load() {
    if (!emp?.id || !companyId) return;
    const [{ data: att }, { data: leaves }, { data: tix }, { data: advs }, { data: plist }, { data: history }] = await Promise.all([
      supabase.from('attendance_records').select('*').eq('employee_id', emp.id).eq('date', today).maybeSingle(),
      supabase.from('leave_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('help_desk_tickets').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('salary_advances').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('playlist_songs').select('*').eq('company_id', companyId).order('created_at'),
      supabase.from('attendance_records').select('*').eq('employee_id', emp.id).order('date', { ascending: false }).limit(30),
    ]);
    setTodayRecord(att ?? null);
    setLeaveList(leaves ?? []);
    setTickets(tix ?? []);
    setAdvances(advs ?? []);
    setSongs(plist ?? []);
    setAttendanceHistory(history ?? []);
    setRequests({
      pendingLeave: leaves?.filter(l => l.status === 'pending').length ?? 0,
      approvedLeave: leaves?.filter(l => l.status === 'approved').length ?? 0,
      pendingTickets: tix?.filter(t => t.status === 'pending').length ?? 0,
      resolvedTickets: tix?.filter(t => t.status === 'resolved').length ?? 0,
      pendingAdvances: advs?.filter(a => a.status === 'pending').length ?? 0,
      approvedAdvances: advs?.filter(a => a.status === 'approved').length ?? 0,
    });
  }

  useEffect(() => { load(); }, [emp?.id]);
  useEffect(() => { songsLenRef.current = songs.length; }, [songs]);

  // Init audio element — volume 1.0, muted=false, wire real events
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 1.0;
    audio.muted = false;
    audio.ontimeupdate = () => {
      if (audio.duration) setPlayProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.onended = () => {
      setPlaying(false);
      setCurrentSongIdx(i => (i + 1) % Math.max(1, songsLenRef.current));
    };
    audio.onerror = () => setAudioBlocked(true);
    empAudioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; audio.ontimeupdate = null; audio.onended = null; };
  }, []);

  // When song changes, load its audio_data as src
  useEffect(() => {
    const audio = empAudioRef.current;
    if (!audio) return;
    const song = songs[currentSongIdx];
    const wasPlaying = playing;
    audio.pause();
    setPlaying(false);
    setPlayProgress(0);
    if (song?.audio_data) {
      audio.src = song.audio_data;
      audio.volume = 1.0;
      audio.muted = false;
      audio.load();
      if (wasPlaying) audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.src = '';
    }
    if (playTimer.current) clearInterval(playTimer.current);
  }, [currentSongIdx, songs]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (playTimer.current) clearInterval(playTimer.current);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
  }

  async function openGpsCamera() {
    setShowGpsCamera(true);
    setGpsCameraError('');
    setGpsAddress('Locating...');
    setGpsCoords(null);
    setGpsTime(new Date());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      gpsStreamRef.current = stream;
      if (gpsVideoRef.current) {
        gpsVideoRef.current.srcObject = stream;
        gpsVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setGpsCameraError(err instanceof Error ? err.message : 'Camera error');
    }
    if (navigator.geolocation) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
            );
            const data = await res.json();
            setGpsAddress(data.display_name || `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
          } catch {
            setGpsAddress(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
          }
        },
        () => setGpsAddress('GPS unavailable'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
    gpsClockRef.current = setInterval(() => setGpsTime(new Date()), 1000);
  }

  function closeGpsCamera() {
    gpsStreamRef.current?.getTracks().forEach(t => t.stop());
    gpsStreamRef.current = null;
    if (gpsVideoRef.current) gpsVideoRef.current.srcObject = null;
    if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
    if (gpsClockRef.current) clearInterval(gpsClockRef.current);
    setShowGpsCamera(false);
  }

  useEffect(() => {
    return () => {
      gpsStreamRef.current?.getTracks().forEach(t => t.stop());
      if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
      if (gpsClockRef.current) clearInterval(gpsClockRef.current);
    };
  }, []);

  const startFaceScan = useCallback(async (action: 'checkin' | 'checkout') => {
    setScanAction(action);
    setScanStep('requesting');
    setCamError('');
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setScanStep('scanning');

      // Attach stream to video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Auto-complete scan after 3 seconds
      scanTimerRef.current = setTimeout(async () => {
        // Capture frame
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth || 320;
            canvasRef.current.height = videoRef.current.videoHeight || 240;
            ctx.drawImage(videoRef.current, 0, 0);
          }
        }
        stopCamera();
        setScanStep('success');
        await recordAttendance(action);
      }, 3000);
    } catch (err) {
      const isDenied = err instanceof Error && (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('denied'));
      setCamDenied(isDenied);
      setCamError(isDenied ? 'denied' : `Camera error: ${err instanceof Error ? err.message : 'Unknown'}`);
      setScanStep('error');
    }
  }, []);

  async function recordAttendance(action: 'checkin' | 'checkout') {
    if (!emp?.id || !companyId) return;
    if (geoFencing && emp.work_lat && emp.work_lng) checkGeoLocation();

    if (action === 'checkin') {
      await supabase.from('attendance_records').upsert({
        company_id: companyId,
        employee_id: emp.id,
        date: today,
        status: 'present',
        check_in_time: new Date().toISOString(),
      }, { onConflict: 'company_id,employee_id,date' });
    } else {
      await supabase.from('attendance_records').update({
        check_out_time: new Date().toISOString(),
      }).eq('employee_id', emp.id).eq('date', today);
    }
    await load();
  }

  function closeScanModal() {
    stopCamera();
    setScanStep('idle');
    setCamError('');
    setCamDenied(false);
  }

  function checkGeoLocation() {
    if (!emp?.work_lat || !emp?.work_lng) { setGeoStatus('inside'); return; }
    if (!navigator.geolocation) { setGeoStatus('inside'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      if (pos.coords.accuracy > 100) {
        setGeoStatus('unknown');
        setGeoWarn('Weak GPS signal — please step outside and try again');
        return;
      }
      setGeoWarn('');
      const dist = haversine(pos.coords.latitude, pos.coords.longitude, emp.work_lat!, emp.work_lng!);
      setGeoStatus(dist <= (emp.work_radius ?? 200) ? 'inside' : 'outside');
    }, () => setGeoStatus('unknown'), { enableHighAccuracy: true, timeout: 10000 });
  }

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // --- Payslip Download ---
  function downloadPayslip() {
    const base = emp?.salary ?? 0;
    const pf = (pfEsiEnabled && emp?.is_pf_enabled) ? Math.round(base * PF_RATE) : 0;
    const esi = (pfEsiEnabled && emp?.is_esi_enabled) ? Math.round(base * ESI_RATE) : 0;
    const net = base - pf - esi;
    const presentDays = attendanceHistory.filter(a => a.status === 'present' || a.status === 'late').length;
    const month = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const ref = 'PAY' + Date.now().toString(36).toUpperCase();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Salary Slip — ${emp?.name} — ${month}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-family: 'Segoe UI', Arial, sans-serif; }
  body { background:#f8f9fa; padding:20px; }
  .slip { max-width:700px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
  .header { background:${company?.theme_secondary ?? '#1e293b'}; color:#fff; padding:28px 32px; }
  .header .company { font-size:22px; font-weight:900; color:${primary}; }
  .header .subtitle { font-size:12px; opacity:0.6; margin-top:2px; }
  .header .title { font-size:14px; font-weight:700; margin-top:12px; opacity:0.9; }
  .body { padding:28px 32px; }
  .section { margin-bottom:24px; }
  .section-title { font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:12px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .info-item label { font-size:11px; color:#9ca3af; display:block; margin-bottom:2px; }
  .info-item span { font-size:14px; font-weight:600; color:#111827; }
  table { width:100%; border-collapse:collapse; }
  th { font-size:11px; text-align:left; color:#6b7280; padding:8px 12px; background:#f9fafb; border-bottom:1px solid #e5e7eb; }
  td { padding:12px; font-size:13px; border-bottom:1px solid #f3f4f6; }
  .amount { font-weight:700; text-align:right; }
  .net-row td { font-weight:900; font-size:15px; background:${primary}15; }
  .net-row .amount { color:${primary}; }
  .footer { background:#f9fafb; padding:16px 32px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; }
  .footer .ref { font-size:11px; color:#9ca3af; }
  .footer .ref strong { color:#374151; }
  .status { display:inline-block; background:${primary}; color:${company?.theme_secondary ?? '#1e293b'}; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; }
  @media print { body { padding:0; } .slip { box-shadow:none; border-radius:0; } }
</style>
</head>
<body>
<div class="slip">
  <div class="header">
    <div class="company">${company?.name ?? 'Attendees'}</div>
    <div class="subtitle">Attendance & Workforce Management</div>
    <div class="title">SALARY SLIP — ${month.toUpperCase()}</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Employee Information</div>
      <div class="info-grid">
        <div class="info-item"><label>Employee Name</label><span>${emp?.name}</span></div>
        <div class="info-item"><label>Employee ID</label><span>${emp?.employee_id}</span></div>
        <div class="info-item"><label>Designation</label><span>${emp?.role ?? '—'}</span></div>
        <div class="info-item"><label>Department</label><span>${emp?.department ?? '—'}</span></div>
        <div class="info-item"><label>Days Present</label><span>${presentDays} days</span></div>
        <div class="info-item"><label>Work Location</label><span>${emp?.work_location_name ?? '—'}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Earnings</div>
      <table>
        <tr><th>Component</th><th class="amount" style="text-align:right">Amount</th></tr>
        <tr><td>Basic Salary</td><td class="amount">₹${base.toLocaleString('en-IN')}</td></tr>
        <tr><td>House Rent Allowance</td><td class="amount">₹0</td></tr>
        <tr><td>Special Allowance</td><td class="amount">₹0</td></tr>
        <tr style="font-weight:700"><td>Gross Earnings</td><td class="amount">₹${base.toLocaleString('en-IN')}</td></tr>
      </table>
    </div>

    ${pfEsiEnabled && (emp?.is_pf_enabled || emp?.is_esi_enabled) ? `
    <div class="section">
      <div class="section-title">Deductions</div>
      <table>
        <tr><th>Component</th><th class="amount" style="text-align:right">Amount</th></tr>
        ${emp?.is_pf_enabled ? `<tr><td>Provident Fund (PF @ 12%)</td><td class="amount">₹${pf.toLocaleString('en-IN')}</td></tr>` : ''}
        ${emp?.is_esi_enabled ? `<tr><td>ESI (@ 0.75%)</td><td class="amount">₹${esi.toLocaleString('en-IN')}</td></tr>` : ''}
        <tr style="font-weight:700"><td>Total Deductions</td><td class="amount">₹${(pf+esi).toLocaleString('en-IN')}</td></tr>
      </table>
    </div>` : ''}

    <div class="section">
      <table>
        <tr class="net-row"><td>NET SALARY PAYABLE</td><td class="amount">₹${net.toLocaleString('en-IN')}</td></tr>
      </table>
    </div>
  </div>
  <div class="footer">
    <div class="ref">Reference: <strong>${ref}</strong><br/>Generated: ${new Date().toLocaleString('en-IN')}</div>
    <span class="status">VERIFIED</span>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Fallback: direct download
      const a = document.createElement('a');
      a.href = url;
      a.download = `Salary_Slip_${emp?.name?.replace(/\s+/g,'_')}_${month.replace(/\s/g,'_')}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Playlist controls — real audio when audio_data exists, fake timer otherwise
  function togglePlay() {
    const audio = empAudioRef.current;
    const hasSrc = !!(songs[currentSongIdx]?.audio_data);
    if (audio) {
      audio.volume = 1.0;
      audio.muted = false;
      if (hasSrc) {
        if (!playing) {
          audio.play()
            .then(() => { setPlaying(true); setAudioBlocked(false); })
            .catch(() => setAudioBlocked(true));
        } else {
          audio.pause();
          setPlaying(false);
        }
        return;
      }
    }
    // Fallback: fake timer for songs without uploaded audio
    setAudioBlocked(false);
    setPlaying(p => {
      if (!p) { playTimer.current = setInterval(() => setPlayProgress(v => v >= 100 ? (setCurrentSongIdx(i => (i+1)%Math.max(1,songs.length)), 0) : v + 0.4), 200); }
      else { if (playTimer.current) clearInterval(playTimer.current); }
      return !p;
    });
  }

  function handleUnmute() {
    const audio = empAudioRef.current;
    if (audio) {
      audio.muted = false;
      audio.volume = 1.0;
      audio.play().then(() => { setPlaying(true); setAudioBlocked(false); }).catch(() => {});
    }
  }

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!emp?.id || !companyId || !leaveForm.start || !leaveForm.end) return;
    setSubmitting(true);
    await supabase.from('leave_requests').insert({ company_id: companyId, employee_id: emp.id, leave_type: leaveForm.type, start_date: leaveForm.start, end_date: leaveForm.end, reason: leaveForm.reason });
    setSubmitting(false); setShowLeaveModal(false);
    setLeaveForm({ type: 'casual', start: '', end: '', reason: '' }); load();
  }

  async function submitHelp(e: React.FormEvent) {
    e.preventDefault();
    if (!emp?.id || !companyId || !helpForm.subject) return;
    setSubmitting(true);
    await supabase.from('help_desk_tickets').insert({ company_id: companyId, employee_id: emp.id, subject: helpForm.subject, message: helpForm.message });
    setSubmitting(false); setShowHelpModal(false);
    setHelpForm({ subject: '', message: '' }); load();
  }

  async function submitAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!emp?.id || !companyId || !advanceForm.amount) return;
    setSubmitting(true);
    await supabase.from('salary_advances').insert({ company_id: companyId, employee_id: emp.id, amount: parseFloat(advanceForm.amount), reason: advanceForm.reason });
    setSubmitting(false); setShowAdvanceModal(false);
    setAdvanceForm({ amount: '', reason: '' }); load();
  }

  const bg = darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900';
  const card = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100';
  const totalRequests = requests.pendingLeave + requests.pendingTickets + requests.pendingAdvances;
  const showScan = scanStep !== 'idle';

  return (
    <div className={`min-h-screen ${bg} flex flex-col max-w-md mx-auto relative`}>

      {/* Top Bar */}
      <header className={`sticky top-0 z-30 ${darkMode ? 'bg-gray-950/95 border-gray-800' : 'bg-white/95 border-gray-100'} border-b backdrop-blur px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0" style={{ backgroundColor: primary, color: '#fff' }}>
              {company?.name?.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-bold text-xs" style={{ color: primary }}>{company?.name}</p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Employee Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode(v => !v)} className={`p-2 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} transition`} style={{ color: darkMode ? primary : '#6b7280' }}>
            <Moon className="w-4 h-4" />
          </button>
          <button className={`p-2 rounded-xl ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'} relative transition`}>
            <Bell className="w-4 h-4" />
            {totalRequests > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
          <button onClick={() => setSession(null)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'home' && (
          <div className="p-4 space-y-4">
            {/* Greeting */}
            <div>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{greeting},</p>
              <p className="text-2xl font-black" style={{ color: primary }}>{emp?.name?.split(' ')[0]}</p>
            </div>

            {/* Today's Attendance */}
            <div className={`${card} border rounded-2xl p-4 shadow-sm`}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm">Today's Attendance</p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</p>
              </div>
              {/* Shift Selector */}
              <div className="mb-4">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Select Shift</p>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setShiftType('A')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all border-2 ${shiftType === 'A' ? 'border-amber-400 bg-amber-50 text-amber-700' : darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    <Sun className="w-4 h-4 inline mr-1" /> Shift A (Day)
                  </button>
                  <button
                    onClick={() => setShiftType('B')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all border-2 ${shiftType === 'B' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    <Moon className="w-4 h-4 inline mr-1" /> Shift B (Night)
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShiftHours(8)}
                    className={`flex-1 py-2 rounded-lg font-semibold text-xs transition ${shiftHours === 8 ? (shiftType === 'A' ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white') : darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                  >8 Hours</button>
                  <button
                    onClick={() => setShiftHours(12)}
                    className={`flex-1 py-2 rounded-lg font-semibold text-xs transition ${shiftHours === 12 ? (shiftType === 'A' ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white') : darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                  >12 Hours</button>
                </div>
              </div>

              {(() => {
                let otValue = '0m';
                let otSub = 'Overtime';
                if (todayRecord?.check_in_time && todayRecord?.check_out_time) {
                  const workedMs = new Date(todayRecord.check_out_time).getTime() - new Date(todayRecord.check_in_time).getTime();
                  const workedMin = Math.max(0, Math.floor(workedMs / 60000));
                  const shiftMin = shiftHours * 60;
                  const otMin = workedMin - shiftMin;
                  if (otMin > 0) {
                    const otH = Math.floor(otMin / 60);
                    const otM = otMin % 60;
                    otValue = otH > 0 ? `${otH}h ${otM}m` : `${otM}m`;
                    otSub = `+${otH}h ${otM}m OT`;
                  } else {
                    otValue = '0m';
                    otSub = 'No Overtime';
                  }
                }
                return (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Check In', value: todayRecord?.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '--:--', sub: todayRecord?.check_in_time ? 'On Time' : 'Pending', color: todayRecord?.check_in_time ? 'text-green-500' : 'text-orange-400' },
                  { label: 'Check Out', value: todayRecord?.check_out_time ? new Date(todayRecord.check_out_time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '--:--', sub: todayRecord?.check_out_time ? 'Done' : 'Pending', color: 'text-orange-400' },
                  { label: 'OT Ghante', value: otValue, sub: otSub, color: otValue !== '0m' ? 'text-blue-500' : 'text-gray-400' },
                ].map(item => (
                  <div key={item.label} className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-xl p-3`}>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'} mb-1`}>{item.label}</p>
                    <p className="font-black text-sm">{item.value}</p>
                    <p className={`text-xs font-medium ${item.color} flex items-center gap-1 mt-0.5`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />{item.sub}
                    </p>
                  </div>
                ))}
              </div>
                );
              })()}
              {todayRecord?.check_in_time && !todayRecord?.check_out_time && (
                <p className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-400'} mb-3`}>
                  Duty time: {Math.floor((Date.now() - new Date(todayRecord.check_in_time).getTime()) / 60000)} min
                </p>
              )}
              <button
                onClick={() => startFaceScan(todayRecord?.check_in_time ? 'checkout' : 'checkin')}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all text-white shadow-lg"
                style={{ backgroundColor: todayRecord?.check_in_time ? '#3b82f6' : primary, boxShadow: `0 8px 20px ${todayRecord?.check_in_time ? '#3b82f640' : primary + '40'}` }}
              >
                <Camera className="w-4 h-4" />
                {todayRecord?.check_in_time ? 'Face Scan & Check Out' : 'Face Scan & Check In'}
              </button>
            </div>

            {/* Activity Charts */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`${card} border rounded-2xl p-4 shadow-sm`}>
                <p className="font-bold text-xs mb-1">Attendance Activity</p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'} mb-3`}>Weekly check-ins</p>
                <div className="flex items-end gap-1 h-14">
                  {weekAttendance.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full rounded-sm overflow-hidden" style={{ height:48, background: `${primary}20` }}>
                        <div className="w-full rounded-sm transition-all" style={{ height:`${(v/6)*100}%`, backgroundColor: primary }} />
                      </div>
                      <p className="mt-1 text-gray-400" style={{ fontSize:8 }}>{'MTWTSSS'[i]}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${card} border rounded-2xl p-4 shadow-sm`}>
                <p className="font-bold text-xs mb-1">Break Usage</p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'} mb-3`}>Duration (min)</p>
                <div className="flex items-end gap-2 h-14">
                  {[{v:46,c:'#22c55e',l:'46m'},{v:15,c:'#60a5fa',l:'15m'},{v:19,c:'#fb923c',l:'19m'}].map((b,i)=>(
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <p className="text-gray-400" style={{fontSize:9}}>{b.l}</p>
                      <div className="w-full rounded-t-sm" style={{height:`${(b.v/50)*52}px`,backgroundColor:b.c}}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Geo-Fencing Card */}
            <div className={`${card} border rounded-2xl p-4 shadow-sm`}>
              <p className="font-bold text-sm mb-3">Live Location, Siren & Geo-Fencing</p>
              <div className="flex gap-4">
                <div className="w-32 h-28 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                  {[1,2,3].map(r=><div key={r} className="absolute border border-emerald-500/30 rounded-full" style={{width:r*35,height:r*35}}/>)}
                  <div className="w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-lg" style={{ backgroundColor: primary }}>
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${geoStatus==='inside'?'bg-green-500':geoStatus==='outside'?'bg-red-500':'bg-gray-400'}`}/>
                    <span className="text-xs font-bold">{geoStatus==='inside'?'Inside Geo-Fence':geoStatus==='outside'?'Outside Geo-Fence':'Geo-Fence Unknown'}</span>
                  </div>
                  <p className={`text-xs ${darkMode?'text-gray-400':'text-gray-500'} mb-1`}>{emp?.work_location_name ?? 'Office Premises'}</p>
                  {geoWarn && <p className="text-xs text-orange-500 font-semibold mb-2">{geoWarn}</p>}
                  <button onClick={checkGeoLocation} className="text-xs font-semibold hover:underline" style={{ color: primary }}>Refresh location</button>
                  <div className={`flex items-center justify-between mt-3 pt-3 border-t ${darkMode?'border-gray-700':'border-gray-100'}`}>
                    <div>
                      <p className="text-xs font-bold">Geo-Fencing Protection</p>
                      <p className={`text-xs ${darkMode?'text-gray-500':'text-gray-400'}`}>{geoFencing?'Active':'Disabled (Remote)'}</p>
                    </div>
                    <button onClick={()=>setGeoFencing(v=>!v)} className={`relative w-11 h-6 rounded-full transition-colors duration-300`} style={{ backgroundColor: geoFencing ? primary : '#d1d5db' }}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${geoFencing?'left-6':'left-1'}`}/>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Help Desk + Request Status */}
            <div className="flex gap-2">
              <button onClick={()=>setShowHelpModal(true)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition shadow-sm" style={{ backgroundColor: '#f97316' }}>
                <MessageSquare className="w-4 h-4" /> Help Desk
              </button>
              <button onClick={openGpsCamera} className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-sm transition shadow-sm" style={{ backgroundColor: '#2563eb' }}>
                <Camera className="w-4 h-4" /> GPS Camera
              </button>
              <div className="relative">
                <button onClick={()=>setShowRequestStatus(v=>!v)} className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 font-semibold text-xs transition-all ${totalRequests>0?'border-orange-400 bg-orange-50 text-orange-700':'border-green-300 bg-green-50 text-green-700'}`}>
                  <span className="text-xs font-bold uppercase tracking-wide">Request</span>
                  <span className="text-xs font-bold uppercase tracking-wide">Status</span>
                  <div className="flex items-center gap-1 mt-1">
                    {totalRequests>0?<><Clock className="w-3 h-3"/><span>{totalRequests} Pending</span></>:<><CheckCircle2 className="w-3 h-3"/><span>All Clear</span></>}
                  </div>
                </button>
                {showRequestStatus && (
                  <div className={`absolute right-0 top-full mt-2 w-64 ${darkMode?'bg-gray-900 border-gray-700':'bg-white border-gray-100'} border rounded-2xl shadow-xl p-3 z-40`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-xs">Request Status</p>
                      <button onClick={()=>setShowRequestStatus(false)}><X className="w-3 h-3 text-gray-400"/></button>
                    </div>
                    {[
                      {label:'Leave Requests',pending:requests.pendingLeave,approved:requests.approvedLeave},
                      {label:'Help Tickets',pending:requests.pendingTickets,approved:requests.resolvedTickets},
                      {label:'Salary Advances',pending:requests.pendingAdvances,approved:requests.approvedAdvances},
                    ].map(r=>(
                      <div key={r.label} className={`flex items-center justify-between py-2 border-b ${darkMode?'border-gray-800':'border-gray-100'} last:border-0`}>
                        <p className="text-xs font-medium">{r.label}</p>
                        <div className="flex gap-1">
                          {r.pending>0&&<span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">{r.pending}p</span>}
                          {r.approved>0&&<span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">{r.approved}✓</span>}
                          {r.pending===0&&r.approved===0&&<span className="text-xs text-gray-400">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Payslip Download */}
            <button onClick={downloadPayslip} className={`w-full flex items-center gap-3 p-4 ${card} border rounded-2xl shadow-sm hover:shadow-md transition-shadow`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <FileText className="w-5 h-5" style={{ color: primary }} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm">Download Salary Slip (PDF)</p>
                <p className={`text-xs ${darkMode?'text-gray-400':'text-gray-400'}`}>Attendance + salary breakdown for this month</p>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>

            {/* Read-only Music Player */}
            <div className={`${card} border rounded-2xl p-4 shadow-sm`}>
              <div className="flex items-center gap-2 mb-3">
                <Music className="w-4 h-4 text-pink-500" />
                <p className="font-bold text-sm">Playlist ({songs.length} tracks)</p>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${darkMode?'bg-gray-800 text-gray-400':'bg-gray-100 text-gray-500'}`}>Read-only</span>
              </div>
              {songs.length === 0 ? (
                <p className={`text-xs ${darkMode?'text-gray-500':'text-gray-400'} text-center py-3`}>No songs added by manager yet</p>
              ) : (
                <div>
                  <div className={`flex items-center gap-3 mb-3 p-3 ${darkMode?'bg-gray-800':'bg-gray-50'} rounded-xl`}>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <Music className={`w-5 h-5 text-white ${playing?'animate-pulse':''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{songs[currentSongIdx]?.title}</p>
                      <p className={`text-xs ${darkMode?'text-gray-400':'text-gray-400'} truncate`}>{songs[currentSongIdx]?.artist}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
                    <div className="bg-pink-500 h-1 rounded-full transition-all" style={{width:`${playProgress}%`}}/>
                  </div>
                  {audioBlocked && (
                    <button onClick={handleUnmute} className="w-full mb-3 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold flex items-center justify-center gap-2 transition">
                      <Volume2 className="w-3.5 h-3.5" /> Tap to Play / Unmute
                    </button>
                  )}
                  <div className="flex items-center justify-center gap-6">
                    <button onClick={()=>{setCurrentSongIdx(i=>(i-1+songs.length)%songs.length);setPlayProgress(0);}} className={`${darkMode?'text-gray-400 hover:text-white':'text-gray-400 hover:text-gray-700'} transition`}><SkipBack className="w-5 h-5"/></button>
                    <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-400 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 transition hover:scale-105">
                      {playing?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4 ml-0.5"/>}
                    </button>
                    <button onClick={()=>{setCurrentSongIdx(i=>(i+1)%songs.length);setPlayProgress(0);}} className={`${darkMode?'text-gray-400 hover:text-white':'text-gray-400 hover:text-gray-700'} transition`}><SkipForward className="w-5 h-5"/></button>
                  </div>
                  <div className="mt-3 space-y-1 max-h-28 overflow-y-auto">
                    {songs.map((s,i)=>(
                      <button key={s.id} onClick={()=>{setCurrentSongIdx(i);setPlayProgress(0);}} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition ${i===currentSongIdx?'bg-pink-50 text-pink-700':`${darkMode?'hover:bg-gray-800 text-gray-300':'hover:bg-gray-50 text-gray-600'}`}`}>
                        <span className="text-xs w-4 text-center font-bold">{i+1}</span>
                        <span className="flex-1 text-xs font-medium truncate">{s.title}</span>
                        <span className="text-xs text-gray-400">{s.artist}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Requests */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setShowLeaveModal(true)} className={`${card} border rounded-2xl p-4 text-left hover:shadow-md transition-shadow`}>
                <Calendar className="w-5 h-5 text-blue-500 mb-2"/>
                <p className="font-bold text-sm">Apply Leave</p>
                <p className={`text-xs ${darkMode?'text-gray-400':'text-gray-400'}`}>Submit leave request</p>
                {requests.pendingLeave>0&&<span className="mt-2 inline-block text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{requests.pendingLeave} pending</span>}
              </button>
              <button onClick={()=>setShowAdvanceModal(true)} className={`${card} border rounded-2xl p-4 text-left hover:shadow-md transition-shadow`}>
                <CheckSquare className="w-5 h-5 text-green-500 mb-2"/>
                <p className="font-bold text-sm">Salary Advance</p>
                <p className={`text-xs ${darkMode?'text-gray-400':'text-gray-400'}`}>Request advance</p>
                {requests.approvedAdvances>0&&<span className="mt-2 inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{requests.approvedAdvances} approved</span>}
              </button>
            </div>
          </div>
        )}

        {tab === 'attendance' && (
          <div className="p-4 space-y-4">
            <h2 className="font-black text-lg">My Attendance</h2>
            {/* One-click face scan */}
            <button
              onClick={() => startFaceScan(todayRecord?.check_in_time ? 'checkout' : 'checkin')}
              className="w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all text-white shadow-xl"
              style={{ backgroundColor: todayRecord?.check_in_time ? '#3b82f6' : primary, boxShadow: `0 10px 30px ${(todayRecord?.check_in_time ? '#3b82f6' : primary) + '50'}` }}
            >
              <Camera className="w-6 h-6" />
              {todayRecord?.check_in_time ? 'Click to Face Scan — Check Out' : 'Click to Face Scan — Check In'}
            </button>
            {leaveList.length === 0 ? (
              <div className={`${card} border rounded-2xl p-6 text-center shadow-sm`}>
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                <p className={`text-sm ${darkMode?'text-gray-400':'text-gray-400'}`}>No leave requests yet</p>
              </div>
            ) : leaveList.map(l=>(
              <div key={l.id} className={`${card} border rounded-2xl p-4 shadow-sm`} style={{borderLeft:`4px solid ${l.status==='approved'?'#22c55e':l.status==='rejected'?'#ef4444':'#f59e0b'}`}}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm capitalize">{l.leave_type} Leave</p>
                    <p className={`text-xs ${darkMode?'text-gray-400':'text-gray-400'}`}>{l.start_date} → {l.end_date}</p>
                    {l.reason&&<p className={`text-xs mt-1 ${darkMode?'text-gray-500':'text-gray-400'}`}>{l.reason}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${l.status==='approved'?'bg-green-100 text-green-700':l.status==='rejected'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'}`}>
                    {l.status.charAt(0).toUpperCase()+l.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="p-4 space-y-4">
            <h2 className="font-black text-lg">Help Tickets</h2>
            {tickets.length === 0 ? (
              <div className={`${card} border rounded-2xl p-6 text-center shadow-sm`}>
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                <p className={`text-sm ${darkMode?'text-gray-400':'text-gray-400'}`}>No tickets raised yet</p>
              </div>
            ) : tickets.map(t=>(
              <div key={t.id} className={`${card} border rounded-2xl p-4 shadow-sm`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{t.subject}</p>
                    {t.message&&<p className={`text-xs mt-1 ${darkMode?'text-gray-400':'text-gray-400'}`}>{t.message}</p>}
                    <p className={`text-xs mt-2 ${darkMode?'text-gray-500':'text-gray-400'}`}>{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${t.status==='resolved'?'bg-green-100 text-green-700':t.status==='rejected'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'}`}>
                    {t.status.charAt(0).toUpperCase()+t.status.slice(1)}
                  </span>
                </div>
                {t.response && (
                  <div className={`mt-3 rounded-xl px-3 py-2 ${darkMode?'bg-green-900/20 border border-green-800/40':'bg-green-50 border border-green-200'}`}>
                    <p className="text-xs font-bold text-green-600 mb-0.5">Admin Response:</p>
                    <p className={`text-xs ${darkMode?'text-green-300':'text-green-700'}`}>{t.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <div className="p-4 space-y-4">
            {/* Company branding block — proof of tenant identity */}
            <div className="rounded-2xl p-5 flex items-center gap-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}20, ${primary}08)`, border: `1.5px solid ${primary}30` }}>
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Company Logo" className="w-16 h-16 rounded-2xl object-cover shadow-md flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-md flex-shrink-0" style={{ backgroundColor: primary, color: '#fff' }}>
                  {company?.name?.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-black text-lg" style={{ color: primary }}>{company?.name}</p>
                <p className={`text-xs font-medium mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Verified Employer</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <p className="text-xs text-green-600 font-semibold">Authenticated under this company</p>
                </div>
              </div>
            </div>

            <div className={`${card} border rounded-2xl p-6 shadow-sm text-center`}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}80)` }}>
                <span className="text-white font-black text-3xl">{emp?.name?.charAt(0)}</span>
              </div>
              <p className="font-black text-xl">{emp?.name}</p>
              <p className={`text-sm ${darkMode?'text-gray-400':'text-gray-500'}`}>{emp?.role}</p>
              <p className={`text-xs ${darkMode?'text-gray-500':'text-gray-400'}`}>{emp?.department}</p>
            </div>
            <div className={`${card} border rounded-2xl p-5 shadow-sm`}>
              {[
                {label:'Employee ID',value:emp?.employee_id},
                {label:'Phone',value:emp?.phone??'—'},
                {label:'Email',value:emp?.email??'—'},
                {label:'Salary',value:`₹${emp?.salary?.toLocaleString('en-IN')}/mo`},
                {label:'Work Location',value:emp?.work_location_name??'—'},
              ].map(item=>(
                <div key={item.label} className={`flex items-center justify-between py-3 border-b ${darkMode?'border-gray-800':'border-gray-100'} last:border-0`}>
                  <span className={`text-xs ${darkMode?'text-gray-400':'text-gray-400'} font-semibold`}>{item.label}</span>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
            <button onClick={downloadPayslip} className={`w-full flex items-center gap-3 p-4 ${card} border rounded-2xl shadow-sm hover:shadow-md transition`}>
              <FileText className="w-5 h-5" style={{ color: primary }} />
              <span className="font-bold text-sm">Download Salary Slip (PDF)</span>
              <Download className="w-4 h-4 text-gray-400 ml-auto" />
            </button>
            <button onClick={()=>setSession(null)} className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4"/> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md ${darkMode?'bg-gray-900 border-gray-800':'bg-white border-gray-200'} border-t flex items-center justify-around px-2 py-2 z-20`}>
        {[{id:'home',label:'Home',icon:Home},{id:'attendance',label:'Attendance',icon:Calendar},{id:'tasks',label:'Tasks',icon:CheckSquare},{id:'profile',label:'Profile',icon:User}].map(item=>{
          const Icon=item.icon;const active=tab===item.id;
          return (
            <button key={item.id} onClick={()=>setTab(item.id as EmpTab)} className="flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all" style={{ color: active ? primary : darkMode ? '#6b7280' : '#9ca3af' }}>
              <Icon className="w-5 h-5"/>
              <span className="text-xs font-semibold">{item.label}</span>
              {active&&<div className="w-1 h-1 rounded-full" style={{ backgroundColor: primary }}/>}
            </button>
          );
        })}
      </nav>

      {/* WebRTC Face Scan Modal */}
      {showScan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="relative">
              {/* Camera view */}
              <div className="relative bg-black aspect-square overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Scanning overlay */}
                {scanStep === 'scanning' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Corner brackets */}
                    {[['top-8 left-8 border-t-4 border-l-4',''], ['top-8 right-8 border-t-4 border-r-4',''], ['bottom-8 left-8 border-b-4 border-l-4',''], ['bottom-8 right-8 border-b-4 border-r-4','']].map(([pos],i)=>(
                      <div key={i} className={`absolute w-10 h-10 ${pos} rounded-sm`} style={{ borderColor: primary }} />
                    ))}
                    {/* Scan line animation */}
                    <div className="absolute left-8 right-8 h-0.5 animate-bounce" style={{ backgroundColor: primary, top: '50%', animationDuration: '1s' }} />
                    <p className="absolute bottom-4 left-0 right-0 text-center text-sm font-bold text-white">Scanning face...</p>
                  </div>
                )}

                {/* Requesting state */}
                {scanStep === 'requesting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                    <div className="w-12 h-12 border-4 border-white/20 rounded-full animate-spin mb-3" style={{ borderTopColor: primary }} />
                    <p className="text-white text-sm font-semibold">Opening camera...</p>
                  </div>
                )}

                {/* Success overlay */}
                {scanStep === 'success' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: `${primary}CC` }}>
                    <CheckCircle2 className="w-16 h-16 text-white mb-2" />
                    <p className="text-white font-black text-lg">Face Verified!</p>
                    <p className="text-white/80 text-sm mt-1">{scanAction === 'checkin' ? 'Checked In' : 'Checked Out'} successfully</p>
                  </div>
                )}

                {/* Error overlay */}
                {scanStep === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 p-6">
                    {camDenied ? (
                      <>
                        <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center mb-3">
                          <Camera className="w-7 h-7 text-orange-400" />
                        </div>
                        <p className="text-white font-bold text-center text-sm mb-1">Camera permission needed</p>
                        <p className="text-orange-300 text-xs text-center font-mono">Click lock icon → Allow camera → Refresh</p>
                      </>
                    ) : (
                      <>
                        <X className="w-10 h-10 text-red-400 mb-2" />
                        <p className="text-white text-xs text-center">{camError}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Modal footer */}
            <div className="p-5">
              <p className="font-bold text-gray-900 text-center text-sm mb-1">
                {scanStep === 'requesting' ? 'Requesting camera access...' :
                 scanStep === 'scanning' ? `Face Scan ${scanAction === 'checkin' ? 'Check-In' : 'Check-Out'}` :
                 scanStep === 'success' ? 'Attendance Recorded!' :
                 camDenied ? 'Camera Permission Needed' : 'Camera Error'}
              </p>
              {scanStep === 'scanning' && (
                <div className="flex justify-center gap-1 mb-3">
                  {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: primary, animationDelay: `${i*0.15}s` }}/>)}
                </div>
              )}
              <button
                onClick={closeScanModal}
                className={`w-full py-3 rounded-xl font-bold text-sm transition ${scanStep === 'success' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                style={scanStep === 'success' ? { backgroundColor: primary } : {}}
              >
                {scanStep === 'success' ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900">Apply for Leave</h2>
              <button onClick={()=>setShowLeaveModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={submitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Leave Type</label>
                <select value={leaveForm.type} onChange={e=>setLeaveForm(f=>({...f,type:e.target.value}))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none">
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="annual">Annual Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label><input type="date" value={leaveForm.start} onChange={e=>setLeaveForm(f=>({...f,start:e.target.value}))} className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label><input type="date" value={leaveForm.end} onChange={e=>setLeaveForm(f=>({...f,end:e.target.value}))} className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label><textarea value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} rows={3} placeholder="Reason for leave..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none"/></div>
              <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition" style={{ backgroundColor: primary }}>
                {submitting?'Submitting...':'Submit Leave Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Help Desk Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900">Raise a Ticket</h2>
              <button onClick={()=>setShowHelpModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={submitHelp} className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Subject *</label><input type="text" value={helpForm.subject} onChange={e=>setHelpForm(f=>({...f,subject:e.target.value}))} placeholder="Brief description of the issue" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none"/></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Message</label><textarea value={helpForm.message} onChange={e=>setHelpForm(f=>({...f,message:e.target.value}))} rows={3} placeholder="Describe your issue..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none"/></div>
              <button type="submit" disabled={submitting||!helpForm.subject} className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50 transition">
                {submitting?'Submitting...':'Submit Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900">Request Salary Advance</h2>
              <button onClick={()=>setShowAdvanceModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={submitAdvance} className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Amount (₹) *</label><input type="number" value={advanceForm.amount} onChange={e=>setAdvanceForm(f=>({...f,amount:e.target.value}))} placeholder="Enter amount" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none"/></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label><textarea value={advanceForm.reason} onChange={e=>setAdvanceForm(f=>({...f,reason:e.target.value}))} rows={3} placeholder="Reason for advance..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none"/></div>
              <button type="submit" disabled={submitting||!advanceForm.amount} className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-50 transition">
                {submitting?'Submitting...':'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GPS Camera Modal */}
      {showGpsCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-white" />
              <p className="text-white font-bold text-sm">GPS Camera</p>
            </div>
            <button onClick={closeGpsCamera} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden bg-black">
            <video ref={gpsVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {/* GPS Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12">
              <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Location</p>
                    <p className="text-sm font-bold text-white break-words">{gpsAddress}</p>
                    {gpsCoords && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Date & Time</p>
                    <p className="text-sm font-bold text-white">
                      {gpsTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-sm font-bold text-emerald-400 font-mono">
                      {gpsTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {gpsCameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center px-6">
                  <Camera className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="text-white font-bold text-sm mb-1">Camera Error</p>
                  <p className="text-gray-400 text-xs">{gpsCameraError}</p>
                  <button onClick={closeGpsCamera} className="mt-4 px-6 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
