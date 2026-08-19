import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Clock, Play, Square, Timer, TrendingUp,
  ChevronLeft, ChevronRight, Trash2, Pause,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTimer } from '../../contexts/TimerContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import type { Profile } from '../../types/database';

interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  date: string;
  duration_minutes: number;
  description: string;
  billable: boolean;
  created_at: string;
}

interface ProjectRef { id: string; project_name: string; }
interface TaskRef { id: string; title: string; project_id: string | null; }

export default function TimeTrackingPage() {
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const timer = useTimer();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [_tasks, setTasks] = useState<TaskRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({
    project_id: '', task_id: '', date: new Date().toISOString().split('T')[0],
    duration_minutes: 60, description: '', billable: true,
  });

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Čas' }],
      primaryAction: {
        label: 'Nový záznam',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          setForm({ project_id: '', task_id: '', date: new Date().toISOString().split('T')[0], duration_minutes: 60, description: '', billable: true });
          setShowModal(true);
        },
      },
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    const [entriesRes, profilesRes, projectsRes, tasksRes] = await Promise.all([
      supabase.from('time_entries').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('*'),
      supabase.from('projects').select('id, project_name').neq('status', 'cancelled'),
      supabase.from('tasks').select('id, title, project_id').neq('status', 'done'),
    ]);
    setEntries((entriesRes.data || []) as TimeEntry[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setProjects((projectsRes.data || []) as ProjectRef[]);
    setTasks((tasksRes.data || []) as TaskRef[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getWeekDates = () => {
    const now = new Date();
    now.setDate(now.getDate() + weekOffset * 7);
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const getProjectName = (id: string | null) => {
    if (!id) return 'Bez projektu';
    return projects.find(p => p.id === id)?.project_name || '';
  };

  const weekEntries = entries.filter(e => {
    const d = e.date;
    return d >= fmt(weekDates[0]) && d <= fmt(weekDates[6]);
  });

  const totalWeekMinutes = weekEntries.reduce((s, e) => s + e.duration_minutes, 0);
  const totalAllMinutes = entries.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + e.duration_minutes, 0);

  const stopTimer = async () => {
    await timer.stop();
    toast(`Čas zaznamenán`);
    loadData();
  };

  const handleSave = async () => {
    const { error } = await supabase.from('time_entries').insert({
      user_id: user!.id,
      project_id: form.project_id || null,
      task_id: form.task_id || null,
      date: form.date,
      duration_minutes: form.duration_minutes,
      description: form.description,
      billable: form.billable,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Záznam přidán');
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('time_entries').delete().eq('id', id);
    toast('Záznam smazán');
    loadData();
  };

  const fmtH = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;
  const fmtTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-navy-700/50 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tento týden</div>
              <div className="text-lg font-extrabold text-white">{fmtH(totalWeekMinutes)}</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem</div>
              <div className="text-lg font-extrabold text-white">{fmtH(totalAllMinutes)}</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Timer className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fakturovatelné</div>
              <div className="text-lg font-extrabold text-white">{fmtH(billableMinutes)}</div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 col-span-1 ${timer.running ? 'bg-emerald-500/10 border-emerald-200' : timer.paused ? 'bg-amber-500/10 border-amber-200' : 'bg-navy-800/60 border-white/[0.08]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${timer.running ? 'bg-emerald-500/20' : timer.paused ? 'bg-amber-500/20' : 'bg-white/[0.06]/[0.07]'}`}>
              <Timer className={`w-5 h-5 ${timer.running ? 'text-emerald-400 animate-pulse' : timer.paused ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-lg font-extrabold font-mono ${timer.paused ? 'text-amber-800' : timer.running ? 'text-white' : 'text-white'}`}>{fmtTimer(timer.elapsed)}</div>
              {timer.active ? (
                <input value={timer.description} onChange={e => timer.setDescription(e.target.value)} placeholder="Popis..." className="text-xs border-0 p-0 bg-transparent focus:outline-none text-slate-400 w-full truncate" />
              ) : (
                <div className="text-[10px] text-slate-500">Časovač</div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {timer.active ? (
                <>
                  {timer.paused ? (
                    <button onClick={() => timer.resume()} title="Pokračovat" className="w-9 h-9 rounded-lg bg-emerald-500/100 text-white flex items-center justify-center hover:bg-emerald-600 transition">
                      <Play className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => timer.pause()} title="Pauza" className="w-9 h-9 rounded-lg bg-amber-400 text-white flex items-center justify-center hover:bg-amber-500/100/100 transition">
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={stopTimer} title="Uložit" className="w-9 h-9 rounded-lg bg-slate-700 text-white flex items-center justify-center hover:bg-slate-800 transition">
                    <Square className="w-4 h-4" />
                  </button>
                  <button onClick={() => timer.discard()} title="Zahodit" className="w-9 h-9 rounded-lg bg-red-500/100/10 text-red-400 flex items-center justify-center hover:bg-red-500/100/100/20 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button onClick={() => timer.start()} className="w-9 h-9 rounded-lg bg-emerald-500/100 text-white flex items-center justify-center hover:bg-emerald-600 transition">
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {timer.active && (
            <select value={timer.projectId} onChange={e => timer.setProjectId(e.target.value)} className={`mt-2 w-full text-xs border rounded-lg px-2 py-1 bg-white/[0.06]/[0.06] text-white ${timer.paused ? 'border-amber-200' : 'border-emerald-200'}`}>
              <option value="">Bez projektu</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          )}
          {!timer.active && (
            <div className="mt-2 space-y-1.5">
              <input value={timer.description} onChange={e => timer.setDescription(e.target.value)} placeholder="Popis práce..." className="w-full text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
              <select value={timer.projectId} onChange={e => timer.setProjectId(e.target.value)} className="w-full text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-white/[0.06]/[0.06] text-white">
                <option value="">Bez projektu</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.04] transition"><ChevronLeft className="w-4 h-4 text-slate-400" /></button>
            <span className="text-sm font-semibold text-white">
              {weekDates[0].toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} - {weekDates[6].toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.04] transition"><ChevronRight className="w-4 h-4 text-slate-400" /></button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-400 font-semibold ml-2">Dnes</button>
            )}
          </div>
          <span className="text-xs text-slate-500 font-semibold">{fmtH(totalWeekMinutes)} celkem</span>
        </div>

        <div className="grid grid-cols-7 gap-px bg-white/[0.06]/[0.04]">
          {weekDates.map((d) => {
            const dayKey = fmt(d);
            const dayEntries = weekEntries.filter(e => e.date === dayKey);
            const dayTotal = dayEntries.reduce((s, e) => s + e.duration_minutes, 0);
            const isToday = dayKey === new Date().toISOString().split('T')[0];

            return (
              <div key={dayKey} className={`bg-navy-800/60 p-3 min-h-[120px] ${isToday ? 'ring-2 ring-inset ring-blue-500/40' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                    {d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric' })}
                  </span>
                  {dayTotal > 0 && (
                    <span className="text-[10px] font-bold text-slate-500">{fmtH(dayTotal)}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayEntries.map(e => (
                    <div key={e.id} className="group relative text-[10px] bg-blue-500/100/20 text-blue-300 rounded px-1.5 py-1 font-medium truncate cursor-pointer hover:bg-blue-500/100/100/30 transition">
                      {fmtH(e.duration_minutes)} - {getProjectName(e.project_id)}
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-red-500/100/10 text-red-400 transition"
                      >
                        <Clock className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Poslední záznamy</h3>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {entries.slice(0, 20).map(e => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.06]/[0.04] transition">
              <div className="w-8 h-8 rounded-lg bg-blue-500/100/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{e.description || 'Bez popisu'}</div>
                <div className="text-xs text-slate-400">{getProjectName(e.project_id)} &middot; {new Date(e.date).toLocaleDateString('cs-CZ')}</div>
              </div>
              <div className="text-sm font-bold text-slate-300 shrink-0">{fmtH(e.duration_minutes)}</div>
              {e.billable && <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/100/10 px-1.5 py-0.5 rounded">FAKT</span>}
            </div>
          ))}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nový časový záznam" size="md" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">Přidat</button>
        </>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Doba (minuty)</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Bez projektu</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.billable} onChange={e => setForm({ ...form, billable: e.target.checked })} className="rounded" />
            <span className="text-sm text-slate-300">Fakturovatelné</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
