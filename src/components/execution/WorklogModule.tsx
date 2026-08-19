import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Play, Square, Clock, Loader2, Trash2, Users, Calendar, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';
import WorkerPicker, { type WorkerEntry } from './WorkerPicker';

interface Worklog {
  id: string;
  user_id: string;
  activity: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
  note: string;
  is_running: boolean;
  created_at: string;
  workers: WorkerEntry[];
}

interface ActivityOption {
  name: string;
  color: string;
}

const FALLBACK_ACTIVITIES: ActivityOption[] = [
  { name: 'Elektroinstalace', color: '#facc15' },
  { name: 'Vodoinstalace', color: '#3b82f6' },
  { name: 'Topení', color: '#ef4444' },
  { name: 'Rekuperace', color: '#22c55e' },
  { name: 'SDK práce', color: '#64748b' },
  { name: 'Bourání', color: '#f97316' },
  { name: 'Malování', color: '#ec4899' },
  { name: 'Montáž', color: '#14b8a6' },
  { name: 'Úklid', color: '#06b6d4' },
  { name: 'Příprava', color: '#0ea5e9' },
  { name: 'Jiné', color: '#94a3b8' },
];

export default function WorklogModule({ jobId, isMobile, onTimerChange }: { jobId: string; isMobile: boolean; onTimerChange?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningLog, setRunningLog] = useState<Worklog | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activities, setActivities] = useState<ActivityOption[]>([]);

  const [showStartModal, setShowStartModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [activity, setActivity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [workers, setWorkers] = useState<WorkerEntry[]>([]);
  const [manualWorkers, setManualWorkers] = useState<WorkerEntry[]>([]);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualFrom, setManualFrom] = useState('08:00');
  const [manualTo, setManualTo] = useState('16:00');
  const [manualActivity, setManualActivity] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [stopCopyToDiary, setStopCopyToDiary] = useState(false);
  const [manualCopyToDiary, setManualCopyToDiary] = useState(false);

  const activityColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of activities) {
      map[a.name] = a.color;
    }
    return map;
  }, [activities]);

  const copyWorklogToDiary = async (
    activityName: string,
    noteText: string,
    dateStr: string,
    durationMin: number,
    workersList: WorkerEntry[],
    timeFrom?: string,
    timeTo?: string,
  ) => {
    if (!user) return;
    const content = `${activityName} (${Math.floor(durationMin / 60)}h ${durationMin % 60}m)${noteText ? ` - ${noteText}` : ''}`;
    const peopleOnSite: string[] = [];
    for (const w of workersList) {
      if (w.type === 'employee' && w.id) {
        peopleOnSite.push(w.id);
      } else if (w.type === 'temp' && w.name) {
        peopleOnSite.push(`temp:${w.name}`);
      }
    }
    await supabase.from('job_diary_entries').insert({
      job_id: jobId,
      entry_date: dateStr,
      time_from: timeFrom || null,
      time_to: timeTo || null,
      content,
      people_on_site: peopleOnSite,
      weather_data: null,
      created_by: user.id,
    });
  };

  const loadWorklogs = useCallback(async () => {
    const [wlRes, actRes] = await Promise.all([
      supabase.from('job_worklogs').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
      supabase.from('work_activities').select('name, color').eq('is_active', true).order('sort_order'),
    ]);
    const logs = (wlRes.data || []) as Worklog[];
    setWorklogs(logs);
    const running = logs.find(l => l.is_running);
    setRunningLog(running || null);
    const dbActivities = (actRes.data || []) as ActivityOption[];
    const acts = dbActivities.length > 0 ? dbActivities : FALLBACK_ACTIVITIES;
    setActivities(acts);
    if (!activity && acts.length > 0) setActivity(acts[0].name);
    if (!manualActivity && acts.length > 0) setManualActivity(acts[0].name);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { loadWorklogs(); }, [loadWorklogs]);

  useEffect(() => {
    if (runningLog?.started_at) {
      const start = new Date(runningLog.started_at).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsed(0);
    }
  }, [runningLog]);

  const handleStart = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('job_worklogs').insert({
      job_id: jobId,
      user_id: user.id,
      activity,
      started_at: new Date().toISOString(),
      is_running: true,
      note,
      workers,
    });
    if (error) {
      toast('Chyba', 'error');
    } else {
      await logAudit('job_worklog', jobId, 'timer_started', { activity });
      toast('Timer spusten');
      setShowStartModal(false);
      setNote('');
      setWorkers([]);
      loadWorklogs();
      onTimerChange?.();
    }
    setSaving(false);
  };

  const handleStop = async () => {
    if (!runningLog) return;
    setSaving(true);
    const now = new Date();
    const started = new Date(runningLog.started_at!);
    const durationMin = Math.round((now.getTime() - started.getTime()) / 60000);

    const { error } = await supabase
      .from('job_worklogs')
      .update({
        ended_at: now.toISOString(),
        duration_minutes: durationMin,
        is_running: false,
        note: note || runningLog.note,
      })
      .eq('id', runningLog.id);

    if (error) {
      toast('Chyba', 'error');
    } else {
      if (stopCopyToDiary) {
        const dateStr = started.toISOString().slice(0, 10);
        const tFrom = `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`;
        const tTo = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        await copyWorklogToDiary(runningLog.activity, note || runningLog.note, dateStr, durationMin, runningLog.workers || [], tFrom, tTo);
      }
      await logAudit('job_worklog', jobId, 'timer_stopped', { duration_minutes: durationMin });
      toast(`Čas uložen: ${formatDuration(durationMin)}`);
      setShowStopModal(false);
      setNote('');
      setStopCopyToDiary(false);
      loadWorklogs();
      onTimerChange?.();
    }
    setSaving(false);
  };

  const handleManualAdd = async () => {
    if (!user) return;
    setSaving(true);
    const fromDate = new Date(`${manualDate}T${manualFrom}`);
    const toDate = new Date(`${manualDate}T${manualTo}`);
    const durationMin = Math.round((toDate.getTime() - fromDate.getTime()) / 60000);

    if (durationMin <= 0) {
      toast('Neplatný časový rozsah', 'error');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('job_worklogs').insert({
      job_id: jobId,
      user_id: user.id,
      activity: manualActivity,
      started_at: fromDate.toISOString(),
      ended_at: toDate.toISOString(),
      duration_minutes: durationMin,
      note: manualNote,
      is_running: false,
      workers: manualWorkers,
    });

    if (error) {
      toast('Chyba', 'error');
    } else {
      if (manualCopyToDiary) {
        await copyWorklogToDiary(manualActivity, manualNote, manualDate, durationMin, manualWorkers, manualFrom, manualTo);
      }
      await logAudit('job_worklog', jobId, 'manual_time_added', { duration_minutes: durationMin });
      toast('Čas uložen');
      setShowManualModal(false);
      setManualNote('');
      setManualWorkers([]);
      setManualCopyToDiary(false);
      loadWorklogs();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat záznam?')) return;
    await supabase.from('job_worklogs').delete().eq('id', id);
    toast('Smazáno');
    loadWorklogs();
    onTimerChange?.();
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const grouped = useMemo(() => {
    const finished = worklogs.filter(w => !w.is_running);
    const groups = new Map<string, { logs: Worklog[]; totalMins: number }>();
    for (const w of finished) {
      const dateKey = w.started_at
        ? new Date(w.started_at).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Bez data';
      if (!groups.has(dateKey)) groups.set(dateKey, { logs: [], totalMins: 0 });
      const g = groups.get(dateKey)!;
      g.logs.push(w);
      g.totalMins += w.duration_minutes || 0;
    }
    return [...groups.entries()];
  }, [worklogs]);

  if (loading) return <div className="h-32 bg-navy-900/50 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {runningLog ? (
          <button
            onClick={() => { setNote(runningLog.note); setShowStopModal(true); }}
            className={`flex items-center gap-3 ${isMobile ? 'w-full justify-center' : ''} bg-red-600 text-white px-6 py-3.5 rounded-xl text-sm font-extrabold hover:bg-red-700 transition-all animate-timer-glow active:scale-95`}
          >
            <Square className="w-5 h-5" />
            <span>Stop</span>
            <span className="font-mono tabular-nums text-base">{formatElapsed(elapsed)}</span>
            <span className="text-red-200 text-xs hidden sm:inline">{runningLog.activity}</span>
          </button>
        ) : (
          <button
            onClick={() => setShowStartModal(true)}
            className={`flex items-center gap-2 ${isMobile ? 'w-full justify-center py-4 text-base' : 'py-3'} bg-emerald-600 text-white px-6 rounded-xl font-extrabold hover:bg-emerald-700 transition-all text-sm hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95`}
          >
            <Play className="w-5 h-5" />
            Start
          </button>
        )}
        {!isMobile && (
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 border border-white/[0.08] text-slate-300 px-4 py-3 rounded-xl text-sm font-extrabold hover:bg-white/[0.04] transition"
          >
            <Plus className="w-4 h-4" /> Přidat čas
          </button>
        )}
      </div>

      <div className="space-y-4">
        {grouped.map(([dateLabel, group]) => (
          <div key={dateLabel}>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-400 capitalize">{dateLabel}</span>
              </div>
              <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                {formatDuration(group.totalMins)}
              </span>
            </div>
            <div className="space-y-1.5">
              {group.logs.map((w) => {
                const hexColor = activityColorMap[w.activity] || '#cbd5e1';
                return (
                  <div key={w.id} className="rounded-xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm p-3 flex items-center gap-3 border-l-4 hover:bg-white/[0.04] transition-all" style={{ borderLeftColor: hexColor }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">{w.activity}</span>
                        <span className="text-xs font-extrabold text-sky-400 tabular-nums">{formatDuration(w.duration_minutes)}</span>
                      </div>
                      {w.note && <p className="text-xs text-slate-400 truncate mt-0.5">{w.note}</p>}
                      {(w.workers || []).length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Users className="w-3 h-3 text-slate-400 shrink-0" />
                          {(w.workers as WorkerEntry[]).map((wr, i) => (
                            <span key={i} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              wr.type === 'employee' ? 'bg-sky-500/10 text-sky-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>{wr.name}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {w.started_at && w.ended_at && `${new Date(w.started_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })} - ${new Date(w.ended_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    {w.user_id === user?.id && (
                      <button onClick={() => handleDelete(w.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && !runningLog && (
          <div className="text-center py-12 border-2 border-dashed border-white/[0.08] rounded-2xl">
            <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Zatím žádné záznamy</p>
            <p className="text-xs text-slate-500 mt-1">Spusťte timer nebo přidejte čas ručně</p>
          </div>
        )}
      </div>

      <Modal open={showStartModal} onClose={() => setShowStartModal(false)} title="Spustit timer" size="sm"
        footer={
          <>
            <button onClick={() => setShowStartModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleStart} disabled={saving} className="px-5 py-2 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Spustit
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Činnost</label>
            <select value={activity} onChange={(e) => setActivity(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {activities.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <WorkerPicker value={workers} onChange={setWorkers} />
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka (volitelně)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-500" />
          </div>
        </div>
      </Modal>

      <Modal open={showStopModal} onClose={() => setShowStopModal(false)} title="Zastavit timer" size="sm"
        footer={
          <>
            <button onClick={() => setShowStopModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleStop} disabled={saving} className="px-5 py-2 text-sm font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit a ukončit
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-center py-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <div className="text-4xl font-mono font-extrabold text-red-400 tabular-nums">{formatElapsed(elapsed)}</div>
            <p className="text-xs text-red-400 mt-1.5 font-semibold">{runningLog?.activity}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka (volitelně)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-500" />
          </div>
          <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stopCopyToDiary}
              onChange={(e) => setStopCopyToDiary(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-blue-400 focus:ring-blue-500/40"
            />
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Zapsat také do stavebního deníku</span>
          </label>
        </div>
      </Modal>

      <Modal open={showManualModal} onClose={() => setShowManualModal(false)} title="Přidat čas ručně" size="sm"
        footer={
          <>
            <button onClick={() => setShowManualModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleManualAdd} disabled={saving} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Datum</label>
            <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Od</label>
              <input type="time" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Do</label>
              <input type="time" value={manualTo} onChange={(e) => setManualTo(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Činnost</label>
            <select value={manualActivity} onChange={(e) => setManualActivity(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {activities.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <WorkerPicker value={manualWorkers} onChange={setManualWorkers} />
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka</label>
            <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Popis práce..." className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-500" />
          </div>
          <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition cursor-pointer select-none">
            <input
              type="checkbox"
              checked={manualCopyToDiary}
              onChange={(e) => setManualCopyToDiary(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-blue-400 focus:ring-blue-500/40"
            />
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Zapsat také do stavebního deníku</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
