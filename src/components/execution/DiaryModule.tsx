import { useState, useEffect, useCallback } from 'react';
import {
  Plus, BookOpen, Calendar, Users, Camera, Loader2, Trash2,
  Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Thermometer, Droplets, CloudFog, RefreshCw,
  FileDown, Clock, Pencil,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';
import { exportDiaryPdf } from './diaryPdfExport';

interface WeatherData {
  temperature_min: number;
  temperature_max: number;
  precipitation_sum: number;
  wind_speed_max: number;
  weather_code: number;
  weather_description: string;
  location?: string;
}

interface DiaryEntry {
  id: string;
  entry_date: string;
  time_from: string | null;
  time_to: string | null;
  content: string;
  people_on_site: string[];
  weather_data: WeatherData | null;
  created_by: string | null;
  created_at: string;
  photos: DiaryPhoto[];
}

interface DiaryPhoto {
  id: string;
  url: string;
  caption: string;
}

interface WorkerEntry {
  id?: string;
  name: string;
  type: 'employee' | 'temp';
}

interface ProfileOption {
  id: string;
  display_name: string;
  email: string;
}

interface Props {
  jobId: string;
  projectName?: string;
  projectAddress?: string;
  projectLat?: number | null;
  projectLon?: number | null;
}

function getWeatherIcon(code: number) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudRain;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  return CloudLightning;
}

function WeatherBadge({ weather }: { weather: WeatherData }) {
  const Icon = getWeatherIcon(weather.weather_code);
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sky-900/30 border border-sky-500/20">
      <Icon className="w-5 h-5 text-sky-400 shrink-0" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span className="font-bold text-sky-400">{weather.weather_description}</span>
        <span className="flex items-center gap-0.5">
          <Thermometer className="w-3 h-3 text-slate-500" />
          {weather.temperature_min.toFixed(1)} / {weather.temperature_max.toFixed(1)} °C
        </span>
        {weather.precipitation_sum > 0 && (
          <span className="flex items-center gap-0.5">
            <Droplets className="w-3 h-3 text-blue-400" />
            {weather.precipitation_sum.toFixed(1)} mm
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Wind className="w-3 h-3 text-slate-500" />
          {weather.wind_speed_max.toFixed(0)} km/h
        </span>
        {weather.location && (
          <span className="text-[10px] text-slate-500">({weather.location})</span>
        )}
      </div>
    </div>
  );
}

function WeatherPreview({ weather, loading, error, onRetry }: {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-sky-900/30 border border-sky-500/20">
        <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
        <span className="text-xs text-sky-400">Načítám počasí...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-900/20 border border-amber-500/20">
        <span className="text-xs text-amber-400">{error}</span>
        <button onClick={onRetry} className="p-1 hover:bg-amber-500/10 rounded transition">
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
        </button>
      </div>
    );
  }
  if (weather) {
    return <WeatherBadge weather={weather} />;
  }
  return null;
}

export default function DiaryModule({ jobId, projectName, projectAddress, projectLat, projectLon }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryTimeFrom, setEntryTimeFrom] = useState('07:00');
  const [entryTimeTo, setEntryTimeTo] = useState('16:00');
  const [entryContent, setEntryContent] = useState('');
  const [entryPeople, setEntryPeople] = useState<string[]>([]);
  const [entryPhotos, setEntryPhotos] = useState<File[]>([]);
  const [entryTempWorkers, setEntryTempWorkers] = useState<string[]>([]);
  const [entryWeather, setEntryWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [entriesRes, photosRes, profilesRes] = await Promise.all([
      supabase.from('job_diary_entries').select('*').eq('job_id', jobId).order('entry_date', { ascending: false }),
      supabase.from('job_diary_photos').select('*'),
      supabase.from('profiles').select('id, display_name, email'),
    ]);

    const allEntries = (entriesRes.data || []) as DiaryEntry[];
    const allPhotos = (photosRes.data || []) as (DiaryPhoto & { diary_entry_id: string })[];

    for (const entry of allEntries) {
      entry.photos = allPhotos.filter((p: any) => p.diary_entry_id === entry.id);
    }

    setEntries(allEntries);
    setProfiles((profilesRes.data || []) as ProfileOption[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  const fetchWeather = useCallback(async (date: string) => {
    if (!projectAddress && !projectLat) {
      setWeatherError('Projekt nemá vyplněnou adresu');
      return;
    }
    setWeatherLoading(true);
    setWeatherError(null);
    setEntryWeather(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-lookup`;

      const body: Record<string, unknown> = { date, address: projectAddress };
      if (projectLat && projectLon) {
        body.lat = projectLat;
        body.lon = projectLon;
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setWeatherError(err.error || err.msg || `Chyba serveru (${res.status})`);
      } else {
        const data = await res.json();
        setEntryWeather(data as WeatherData);
      }
    } catch {
      setWeatherError('Chyba připojení');
    } finally {
      setWeatherLoading(false);
    }
  }, [projectAddress, projectLat, projectLon]);

  const hasLocation = !!(projectAddress || projectLat);

  const prefillWorkersFromWorklogs = useCallback(async (date: string) => {
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const { data } = await supabase
      .from('job_worklogs')
      .select('workers')
      .eq('job_id', jobId)
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd);

    if (!data || data.length === 0) return;

    const profileIds = new Set<string>();
    const tempNames = new Set<string>();

    for (const row of data) {
      const workers = (row.workers || []) as WorkerEntry[];
      for (const w of workers) {
        if (w.type === 'employee' && w.id) {
          profileIds.add(w.id);
        } else if (w.type === 'temp' && w.name) {
          tempNames.add(w.name);
        }
      }
    }

    if (profileIds.size > 0) {
      setEntryPeople(prev => {
        const merged = new Set([...prev, ...profileIds]);
        return Array.from(merged);
      });
    }
    setEntryTempWorkers(Array.from(tempNames));
  }, [jobId]);

  useEffect(() => {
    if (showAddModal) {
      prefillWorkersFromWorklogs(entryDate);
      if (hasLocation) fetchWeather(entryDate);
    }
  }, [showAddModal, entryDate, hasLocation, fetchWeather, prefillWorkersFromWorklogs]);

  const handleAdd = async () => {
    if (!user || !entryContent.trim()) return;
    setSaving(true);

    const allPeople = [...entryPeople, ...entryTempWorkers.map(n => `temp:${n}`)];
    const { data: entryData, error } = await supabase.from('job_diary_entries').insert({
      job_id: jobId,
      entry_date: entryDate,
      time_from: entryTimeFrom || null,
      time_to: entryTimeTo || null,
      content: entryContent,
      people_on_site: allPeople,
      weather_data: entryWeather,
      created_by: user.id,
    }).select().maybeSingle();

    if (error || !entryData) {
      toast('Chyba při ukládání', 'error');
      setSaving(false);
      return;
    }

    if (entryPhotos.length > 0) {
      for (const photo of entryPhotos) {
        const ext = photo.name.split('.').pop() || 'jpg';
        const path = `diary/${jobId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, photo);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
          await supabase.from('job_diary_photos').insert({
            diary_entry_id: (entryData as any).id,
            url: urlData.publicUrl,
            caption: photo.name,
          });
        }
      }
    }

    await logAudit('job_diary', jobId, 'diary_entry_added', { date: entryDate });
    toast('Zápis uložen');
    setShowAddModal(false);
    setEntryContent('');
    setEntryTimeFrom('07:00');
    setEntryTimeTo('16:00');
    setEntryPeople([]);
    setEntryPhotos([]);
    setEntryTempWorkers([]);
    setEntryWeather(null);
    loadData();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat zápis?')) return;
    await supabase.from('job_diary_entries').delete().eq('id', id);
    toast('Smazáno');
    loadData();
  };

  const openEditModal = (entry: DiaryEntry) => {
    setEditEntry(entry);
    setEntryDate(entry.entry_date);
    setEntryTimeFrom(entry.time_from?.slice(0, 5) || '');
    setEntryTimeTo(entry.time_to?.slice(0, 5) || '');
    setEntryContent(entry.content);
    const temps: string[] = [];
    const people: string[] = [];
    for (const pid of entry.people_on_site) {
      if (pid.startsWith('temp:')) temps.push(pid.slice(5));
      else people.push(pid);
    }
    setEntryPeople(people);
    setEntryTempWorkers(temps);
    setEntryWeather(entry.weather_data);
    setEntryPhotos([]);
    setWeatherError(null);
  };

  const handleUpdate = async () => {
    if (!editEntry || !entryContent.trim()) return;
    setSaving(true);
    const allPeople = [...entryPeople, ...entryTempWorkers.map(n => `temp:${n}`)];
    const { error } = await supabase.from('job_diary_entries').update({
      entry_date: entryDate,
      time_from: entryTimeFrom || null,
      time_to: entryTimeTo || null,
      content: entryContent,
      people_on_site: allPeople,
      weather_data: entryWeather,
    }).eq('id', editEntry.id);

    if (error) {
      toast('Chyba při ukládání', 'error');
      setSaving(false);
      return;
    }

    if (entryPhotos.length > 0) {
      for (const photo of entryPhotos) {
        const ext = photo.name.split('.').pop() || 'jpg';
        const path = `diary/${jobId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, photo);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
          await supabase.from('job_diary_photos').insert({
            diary_entry_id: editEntry.id,
            url: urlData.publicUrl,
            caption: photo.name,
          });
        }
      }
    }

    await logAudit('job_diary', jobId, 'diary_entry_updated', { date: entryDate });
    toast('Zápis upraven');
    setEditEntry(null);
    setEntryContent('');
    setEntryPeople([]);
    setEntryPhotos([]);
    setEntryTempWorkers([]);
    setEntryWeather(null);
    loadData();
    setSaving(false);
  };

  const handleFetchWeatherForEntry = async (entryId: string, date: string) => {
    if (!projectAddress && !projectLat) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-lookup`;

      const body: Record<string, unknown> = { date, address: projectAddress };
      if (projectLat && projectLon) {
        body.lat = projectLat;
        body.lon = projectLon;
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const weather = await res.json();
        await supabase.from('job_diary_entries').update({ weather_data: weather }).eq('id', entryId);
        toast('Počasí doplněno');
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || err.msg || `Chyba serveru (${res.status})`, 'error');
      }
    } catch {
      toast('Chyba připojení', 'error');
    }
  };

  const getProfileName = (id: string) => {
    if (id.startsWith('temp:')) return id.slice(5);
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || id.slice(0, 8);
  };

  const isTemp = (id: string) => id.startsWith('temp:');

  const togglePerson = (id: string) => {
    setEntryPeople(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="h-32 bg-navy-900/50 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Stavební deník
        </h3>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={() => exportDiaryPdf({
                entries,
                projectName: projectName || 'Projekt',
                projectAddress,
                getProfileName,
              })}
              className="flex items-center gap-2 border border-white/[0.08] text-slate-300 px-4 py-2 rounded-xl text-sm font-extrabold hover:bg-white/[0.04] transition"
            >
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-extrabold hover:bg-blue-500 transition"
          >
            <Plus className="w-4 h-4" /> Nový zápis
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/[0.08] rounded-xl">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Zatím žádné zápisy</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/[0.08]" />
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="relative pl-12">
                <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full bg-blue-500 border-2 border-navy-800 " />
                <div className="rounded-xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-extrabold text-slate-300">
                          {new Date(entry.entry_date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      {(entry.time_from || entry.time_to) && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3" />
                          {entry.time_from?.slice(0, 5) || '?'} – {entry.time_to?.slice(0, 5) || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!entry.weather_data && hasLocation && (
                        <button
                          onClick={() => handleFetchWeatherForEntry(entry.id, entry.entry_date)}
                          className="p-1 rounded hover:bg-sky-500/10 text-slate-400 hover:text-sky-400 transition"
                          title="Doplnit počasí"
                        >
                          <Cloud className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {entry.created_by === user?.id && (
                        <>
                          <button onClick={() => openEditModal(entry)} className="p-1 rounded hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition" title="Upravit zápis">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {entry.weather_data && (
                    <div className="mb-3">
                      <WeatherBadge weather={entry.weather_data} />
                    </div>
                  )}

                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{entry.content}</p>

                  {entry.people_on_site.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <Users className="w-3 h-3 text-slate-400" />
                      {entry.people_on_site.map((pid) => (
                        <span key={pid} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isTemp(pid) ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-slate-300 bg-white/[0.07] border border-white/[0.08]'
                        }`}>
                          {getProfileName(pid)}
                        </span>
                      ))}
                    </div>
                  )}

                  {entry.photos.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto">
                      {entry.photos.map((photo) => (
                        <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img src={photo.url} alt={photo.caption} className="w-20 h-20 object-cover rounded-lg border border-white/[0.08]" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Nový zápis" size="md"
        footer={
          <>
            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleAdd} disabled={saving || !entryContent.trim()} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit
            </button>
          </>
        }
      >
        <DiaryEntryForm
          entryDate={entryDate}
          setEntryDate={setEntryDate}
          entryTimeFrom={entryTimeFrom}
          setEntryTimeFrom={setEntryTimeFrom}
          entryTimeTo={entryTimeTo}
          setEntryTimeTo={setEntryTimeTo}
          entryContent={entryContent}
          setEntryContent={setEntryContent}
          entryPeople={entryPeople}
          togglePerson={togglePerson}
          entryTempWorkers={entryTempWorkers}
          entryPhotos={entryPhotos}
          setEntryPhotos={setEntryPhotos}
          entryWeather={entryWeather}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          onRetryWeather={() => fetchWeather(entryDate)}
          hasLocation={hasLocation}
          profiles={profiles}
        />
      </Modal>

      <Modal open={!!editEntry} onClose={() => { setEditEntry(null); setEntryContent(''); setEntryPeople([]); setEntryTempWorkers([]); setEntryWeather(null); }} title="Upravit zápis" size="md"
        footer={
          <>
            <button onClick={() => { setEditEntry(null); setEntryContent(''); setEntryPeople([]); setEntryTempWorkers([]); setEntryWeather(null); }} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleUpdate} disabled={saving || !entryContent.trim()} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit změny
            </button>
          </>
        }
      >
        <DiaryEntryForm
          entryDate={entryDate}
          setEntryDate={setEntryDate}
          entryTimeFrom={entryTimeFrom}
          setEntryTimeFrom={setEntryTimeFrom}
          entryTimeTo={entryTimeTo}
          setEntryTimeTo={setEntryTimeTo}
          entryContent={entryContent}
          setEntryContent={setEntryContent}
          entryPeople={entryPeople}
          togglePerson={togglePerson}
          entryTempWorkers={entryTempWorkers}
          entryPhotos={entryPhotos}
          setEntryPhotos={setEntryPhotos}
          entryWeather={entryWeather}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          onRetryWeather={() => { if (editEntry) fetchWeather(entryDate); }}
          hasLocation={hasLocation}
          profiles={profiles}
          existingPhotoCount={editEntry?.photos.length}
        />
      </Modal>
    </div>
  );
}

interface DiaryEntryFormProps {
  entryDate: string;
  setEntryDate: (v: string) => void;
  entryTimeFrom: string;
  setEntryTimeFrom: (v: string) => void;
  entryTimeTo: string;
  setEntryTimeTo: (v: string) => void;
  entryContent: string;
  setEntryContent: (v: string) => void;
  entryPeople: string[];
  togglePerson: (id: string) => void;
  entryTempWorkers: string[];
  entryPhotos: File[];
  setEntryPhotos: (files: File[]) => void;
  entryWeather: WeatherData | null;
  weatherLoading: boolean;
  weatherError: string | null;
  onRetryWeather: () => void;
  hasLocation: boolean;
  profiles: ProfileOption[];
  existingPhotoCount?: number;
}

function DiaryEntryForm({
  entryDate, setEntryDate,
  entryTimeFrom, setEntryTimeFrom,
  entryTimeTo, setEntryTimeTo,
  entryContent, setEntryContent,
  entryPeople, togglePerson,
  entryTempWorkers,
  entryPhotos, setEntryPhotos,
  entryWeather, weatherLoading, weatherError, onRetryWeather,
  hasLocation, profiles,
  existingPhotoCount,
}: DiaryEntryFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Datum</label>
        <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Od</label>
          <input type="time" value={entryTimeFrom} onChange={(e) => setEntryTimeFrom(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Do</label>
          <input type="time" value={entryTimeTo} onChange={(e) => setEntryTimeTo(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
      </div>

      {hasLocation && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Počasí na stavbě</label>
          <WeatherPreview
            weather={entryWeather}
            loading={weatherLoading}
            error={weatherError}
            onRetry={onRetryWeather}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Text *</label>
        <textarea
          value={entryContent}
          onChange={(e) => setEntryContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none placeholder:text-slate-500"
          placeholder="Co se dělalo, jaké práce proběhly..."
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Lidé na stavbě</label>
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePerson(p.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                entryPeople.includes(p.id)
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/[0.06] border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              {p.display_name || p.email}
            </button>
          ))}
          {entryTempWorkers.map((name) => (
            <span
              key={`temp-${name}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-400"
            >
              {name}
            </span>
          ))}
        </div>
        {entryTempWorkers.length > 0 && (
          <p className="text-[10px] text-slate-500 mt-1">Brigádníci z výkazu jsou automaticky zahrnuti</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">
          Fotky{existingPhotoCount !== undefined && existingPhotoCount > 0 ? ` (${existingPhotoCount} existujících)` : ''}
        </label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setEntryPhotos(Array.from(e.target.files || []))}
          className="w-full text-sm text-slate-400"
        />
        {entryPhotos.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Camera className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500">{entryPhotos.length} nových fotek</span>
          </div>
        )}
      </div>
    </div>
  );
}
