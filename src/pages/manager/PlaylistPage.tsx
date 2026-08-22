import { useEffect, useState, useRef, useCallback } from 'react';
import { Music, Plus, Trash2, Play, Pause, SkipForward, SkipBack, Volume2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { PlaylistSong } from '../../types';

interface LocalTrack extends PlaylistSong {
  objectUrl?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PlaylistPage() {
  const { session } = useApp();
  const companyId = session?.company?.id;
  const managerId = session?.manager?.id;
  const primary = session?.company?.theme_primary ?? '#f59e0b';

  const [songs, setSongs] = useState<LocalTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addArtist, setAddArtist] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Object URL cache: song id → object URL (for locally-selected files in this session)
  const objectUrls = useRef<Map<string, string>>(new Map());

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase.from('playlist_songs').select('*').eq('company_id', companyId).order('created_at');
    setSongs((data ?? []).map(s => ({ ...s, objectUrl: objectUrls.current.get(s.id) })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      // Revoke all object URLs on unmount
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
      audioRef.current?.pause();
    };
  }, [companyId]);

  // Sync audio element volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Load audio when song or objectUrl changes
  const currentSong = songs[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = currentSong?.objectUrl;
    if (src) {
      audio.src = src;
      audio.load();
      if (isPlaying) audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    setProgress(0);
    setDuration(0);
  }, [currentIndex, currentSong?.objectUrl]);

  const setupAudioListeners = useCallback((audio: HTMLAudioElement) => {
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentIndex(i => (i + 1) % Math.max(1, songs.length));
    };
  }, [songs.length]);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audioRef.current = audio;
    setupAudioListeners(audio);
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  useEffect(() => {
    if (audioRef.current) setupAudioListeners(audioRef.current);
  }, [setupAudioListeners]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous preview URL
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setSelectedFileUrl(url);
    if (!addTitle) setAddTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
  }

  async function handleAddSong(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle || !selectedFile || !companyId) return;
    setSaving(true);

    // Get audio duration from the file
    let fileDuration = 0;
    try {
      const tempAudio = new Audio(selectedFileUrl ?? '');
      await new Promise<void>(res => {
        tempAudio.onloadedmetadata = () => { fileDuration = Math.round(tempAudio.duration); res(); };
        tempAudio.onerror = () => res();
        setTimeout(res, 3000);
      });
    } catch {}

    // Convert audio to base64 for persistent cross-session playback on employee devices
    let audioData: string | null = null;
    try { audioData = await fileToBase64(selectedFile); } catch {}

    const { data: newSong, error } = await supabase.from('playlist_songs').insert({
      company_id: companyId,
      title: addTitle,
      artist: addArtist || 'Unknown Artist',
      file_name: selectedFile.name,
      file_size: selectedFile.size,
      duration: fileDuration,
      audio_data: audioData,
      added_by: managerId ?? null,
    }).select().single();

    if (!error && newSong && selectedFileUrl) {
      // Store object URL for this session
      objectUrls.current.set(newSong.id, selectedFileUrl);
      setSongs(prev => [...prev, { ...newSong, objectUrl: selectedFileUrl }]);
      setCurrentIndex(songs.length); // switch to new song
    }

    setSaving(false);
    setShowAddModal(false);
    setAddTitle(''); setAddArtist(''); setSelectedFile(null); setSelectedFileUrl(null);
    if (fileRef.current) fileRef.current.value = '';
    load();
  }

  async function deleteSong(id: string) {
    await supabase.from('playlist_songs').delete().eq('id', id);
    const url = objectUrls.current.get(id);
    if (url) { URL.revokeObjectURL(url); objectUrls.current.delete(id); }
    setSongs(prev => prev.filter(s => s.id !== id));
    setCurrentIndex(0);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentSong?.objectUrl) {
      // No local file — just simulate
      setIsPlaying(p => !p);
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
  }

  function nextSong() {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentIndex(i => (i + 1) % Math.max(1, songs.length));
  }

  function prevSong() {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentIndex(i => (i - 1 + songs.length) % Math.max(1, songs.length));
  }

  function selectSong(idx: number) {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentIndex(idx);
  }

  function formatTime(secs: number) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const playbackTime = audioRef.current?.currentTime ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Manager Playlist</h1>
          <p className="text-gray-400 text-xs mt-0.5">{songs.length} tracks · Manager-exclusive controls</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm"
          style={{ backgroundColor: primary, color: '#1e293b', boxShadow: `0 4px 12px ${primary}40` }}
        >
          <Plus className="w-4 h-4" /> Add New Song
        </button>
      </div>

      {/* Player Card */}
      {songs.length > 0 && (
        <div className="rounded-3xl p-6 mb-5 shadow-2xl" style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)` }}>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}80)` }}>
              <Music className={`w-8 h-8 text-white ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-lg leading-tight truncate">{currentSong?.title}</p>
              <p className="text-white/60 text-sm">{currentSong?.artist}</p>
              {currentSong?.file_name && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <p className="text-white/40 text-xs truncate">{currentSong.file_name}</p>
                </div>
              )}
              {!currentSong?.objectUrl && currentSong?.file_name && (
                <p className="text-xs text-orange-400 mt-0.5">File not loaded — re-add to play</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="w-full bg-white/10 rounded-full h-2 cursor-pointer mb-1" onClick={seek}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: primary }} />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>{formatTime(playbackTime)}</span>
              <span>{formatTime(duration || (currentSong?.duration ?? 0))}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mb-4">
            <button onClick={prevSong} className="p-2 text-white/50 hover:text-white transition"><SkipBack className="w-5 h-5" /></button>
            <button onClick={togglePlay} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition" style={{ backgroundColor: primary }}>
              {isPlaying ? <Pause className="w-6 h-6 text-slate-900" /> : <Play className="w-6 h-6 text-slate-900 ml-0.5" />}
            </button>
            <button onClick={nextSong} className="p-2 text-white/50 hover:text-white transition"><SkipForward className="w-5 h-5" /></button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-white/40" />
            <input
              type="range" min="0" max="100" value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none bg-white/20 cursor-pointer"
              style={{ accentColor: primary }}
            />
            <span className="text-white/40 text-xs w-8">{volume}%</span>
          </div>
        </div>
      )}

      {/* Song List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="bg-white rounded-2xl h-16 animate-pulse border border-gray-100"/>)}</div>
      ) : songs.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <Music className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No songs in playlist</p>
          <p className="text-gray-300 text-xs mt-1">Click "Add New Song" to upload from device storage</p>
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((song, idx) => (
            <div
              key={song.id}
              onClick={() => selectSong(idx)}
              className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                idx === currentIndex ? 'border-2 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
              }`}
              style={idx === currentIndex ? { borderColor: primary, backgroundColor: `${primary}08` } : {}}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={idx === currentIndex ? { backgroundColor: primary } : { backgroundColor: '#f3f4f6' }}>
                {idx === currentIndex && isPlaying ? (
                  <div className="flex gap-0.5 items-end h-5">
                    {[1,2,3].map(b=><div key={b} className="w-1 bg-white rounded-full animate-bounce" style={{ height: `${8+b*4}px`, animationDelay: `${b*0.1}s` }}/>)}
                  </div>
                ) : (
                  <span className="text-xs font-bold" style={{ color: idx === currentIndex ? '#fff' : '#9ca3af' }}>{idx+1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: idx === currentIndex ? primary : '#111827' }}>{song.title}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                  {song.objectUrl && <span className="text-xs text-green-500 font-medium">● Local</span>}
                  {song.duration > 0 && <span className="text-xs text-gray-300">{formatTime(song.duration)}</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteSong(song.id); }} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-6">
            <h2 className="font-black text-gray-900 mb-5">Add New Song</h2>
            <form onSubmit={handleAddSong} className="space-y-4">
              {/* File Picker — direct device storage access */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.aac,.flac,.ogg,.m4a"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition"
                  style={{ borderColor: selectedFile ? primary : '#e9d5ff', backgroundColor: selectedFile ? `${primary}08` : '#faf5ff' }}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: selectedFile ? primary : '#a855f7' }} />
                  {selectedFile ? (
                    <>
                      <p className="font-semibold text-sm" style={{ color: primary }}>{selectedFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Tap to change</p>
                    </>
                  ) : (
                    <>
                      <p className="text-purple-700 font-semibold text-sm">Tap to select audio file</p>
                      <p className="text-purple-400 text-xs mt-1">Accesses your device storage directly</p>
                      <p className="text-gray-400 text-xs mt-0.5">MP3, WAV, AAC, FLAC, OGG supported</p>
                    </>
                  )}
                </div>
              </div>

              {/* Preview audio if file selected */}
              {selectedFileUrl && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Preview</p>
                  <audio controls src={selectedFileUrl} className="w-full h-8" style={{ height: 32 }} />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Song Title *</label>
                <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Enter song title" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none transition" style={{ '--tw-ring-color': primary } as React.CSSProperties} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Artist Name</label>
                <input type="text" value={addArtist} onChange={e => setAddArtist(e.target.value)} placeholder="Unknown Artist" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none transition" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddModal(false); setSelectedFile(null); if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl); setSelectedFileUrl(null); setAddTitle(''); setAddArtist(''); }} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={saving || !addTitle || !selectedFile} className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: primary, color: '#1e293b' }}>
                  {saving ? <span className="animate-spin w-4 h-4 border-2 border-current/30 border-t-current rounded-full" /> : <Music className="w-4 h-4" />}
                  Add to Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
