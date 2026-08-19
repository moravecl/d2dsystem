import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, CheckSquare, Flag, Calendar, Milestone, Edit2, Trash2,
  ChevronDown, ChevronRight, GripVertical, CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import type { Profile } from '../../types/database';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  milestone_id: string | null;
  due_date: string | null;
  created_at: string;
}

interface MilestoneRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  color: string;
  sort_order: number;
  offset_days: number;
  duration_days: number;
  show_in_calendar: boolean;
}

const TASK_STATUSES = [
  { key: 'todo', label: 'K vyřízení', color: 'bg-white/[0.06] text-slate-300' },
  { key: 'in_progress', label: 'Rozpracováno', color: 'bg-blue-500/10 text-blue-400' },
  { key: 'done', label: 'Hotovo', color: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'blocked', label: 'Blokováno', color: 'bg-red-500/10 text-red-400' },
];

const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: 'Nízká', color: 'text-slate-400' },
  medium: { label: 'Střední', color: 'text-amber-400' },
  high: { label: 'Vysoká', color: 'text-orange-400' },
  urgent: { label: 'Urgentní', color: 'text-red-400' },
};

const MS_STATUSES = [
  { key: 'planned', label: 'Plánováno', bg: 'bg-white/[0.06] text-slate-400' },
  { key: 'in_progress', label: 'Probíhá', bg: 'bg-blue-500/10 text-blue-400' },
  { key: 'completed', label: 'Hotovo', bg: 'bg-emerald-500/10 text-emerald-400' },
];

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#64748b'];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('cs-CZ');
}

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeMilestoneDates(montazStart: string, offsetDays: number, durationDays: number) {
  const start = addDaysToDate(montazStart, offsetDays);
  const end = addDaysToDate(start, Math.max(0, durationDays - 1));
  return { start, end };
}

export default function ProjectTasksTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedMs, setCollapsedMs] = useState<Set<string>>(new Set());
  const [montazStartDate, setMontazStartDate] = useState<string>('');
  const [savingMontaz, setSavingMontaz] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', milestone_id: '' });

  const [showMsModal, setShowMsModal] = useState(false);
  const [editMs, setEditMs] = useState<MilestoneRow | null>(null);
  const [msForm, setMsForm] = useState({ name: '', offset_days: 0, duration_days: 7, status: 'planned', color: '#3b82f6', show_in_calendar: false });

  const load = useCallback(async () => {
    const [tasksRes, profRes, msRes, projRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).order('sort_order').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('project_milestones').select('*').eq('project_id', projectId).order('offset_days').order('sort_order').order('start_date'),
      supabase.from('projects').select('montaz_start_date').eq('id', projectId).maybeSingle(),
    ]);
    setTasks((tasksRes.data || []) as Task[]);
    setProfiles((profRes.data || []) as Profile[]);
    setMilestones((msRes.data || []) as MilestoneRow[]);
    setMontazStartDate(projRes.data?.montaz_start_date || '');
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const unassignedTasks = useMemo(() => tasks.filter(t => !t.milestone_id), [tasks]);

  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const handleMontazDateChange = async (date: string) => {
    setMontazStartDate(date);
    setSavingMontaz(true);

    await supabase.from('projects').update({
      montaz_start_date: date || null,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    if (date && milestones.length > 0) {
      for (const ms of milestones) {
        const { start, end } = computeMilestoneDates(date, ms.offset_days, ms.duration_days);
        await supabase.from('project_milestones').update({
          start_date: start,
          end_date: end,
          updated_at: new Date().toISOString(),
        }).eq('id', ms.id);
      }
      await load();
    }

    setSavingMontaz(false);
  };

  const openNewTask = (milestoneId?: string) => {
    setEditTask(null);
    setTaskForm({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', milestone_id: milestoneId || '' });
    setShowTaskModal(true);
  };

  const openEditTask = (task: Task) => {
    setEditTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      milestone_id: task.milestone_id || '',
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) return;
    const payload = {
      project_id: projectId,
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      assigned_to: taskForm.assigned_to || null,
      due_date: taskForm.due_date || null,
      milestone_id: taskForm.milestone_id || null,
    };
    if (editTask) {
      const { error } = await supabase.from('tasks').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editTask.id);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Úkol uložen');
    } else {
      const { error } = await supabase.from('tasks').insert({ ...payload, created_by: user!.id, status: 'todo' });
      if (error) { toast('Chyba', 'error'); return; }
      toast('Úkol vytvořen');
    }
    setShowTaskModal(false);
    load();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Smazat úkol?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast('Úkol smazán');
  };

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const openNewMs = () => {
    setEditMs(null);
    setMsForm({ name: '', offset_days: 0, duration_days: 7, status: 'planned', color: '#3b82f6', show_in_calendar: false });
    setShowMsModal(true);
  };

  const openEditMs = (ms: MilestoneRow) => {
    setEditMs(ms);
    setMsForm({
      name: ms.name,
      offset_days: ms.offset_days,
      duration_days: ms.duration_days,
      status: ms.status,
      color: ms.color,
      show_in_calendar: ms.show_in_calendar,
    });
    setShowMsModal(true);
  };

  const handleSaveMs = async () => {
    if (!msForm.name.trim()) return;

    let startDate = new Date().toISOString().slice(0, 10);
    let endDate = startDate;

    if (montazStartDate) {
      const computed = computeMilestoneDates(montazStartDate, msForm.offset_days, msForm.duration_days);
      startDate = computed.start;
      endDate = computed.end;
    } else {
      endDate = addDaysToDate(startDate, Math.max(0, msForm.duration_days - 1));
    }

    const payload = {
      project_id: projectId,
      name: msForm.name,
      start_date: startDate,
      end_date: endDate,
      status: msForm.status,
      color: msForm.color,
      offset_days: msForm.offset_days,
      duration_days: msForm.duration_days,
      show_in_calendar: msForm.show_in_calendar,
    };
    if (editMs) {
      const { error } = await supabase.from('project_milestones').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editMs.id);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Milník uložen');
    } else {
      const { error } = await supabase.from('project_milestones').insert(payload);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Milník vytvořen');
    }
    setShowMsModal(false);
    load();
  };

  const handleDeleteMs = async (id: string) => {
    if (!confirm('Smazat milník? Úkoly zůstanou, jen se odlinkují.')) return;
    await supabase.from('project_milestones').delete().eq('id', id);
    setMilestones(prev => prev.filter(m => m.id !== id));
    setTasks(prev => prev.map(t => t.milestone_id === id ? { ...t, milestone_id: null } : t));
    toast('Milník smazán');
  };

  const toggleMs = (id: string) => {
    setCollapsedMs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="animate-pulse space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-navy-900/50 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Milestone className="w-4 h-4 text-slate-400" />
          Milníky a úkoly
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={openNewMs} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 border border-white/[0.08] hover:bg-white/[0.04] rounded-xl transition">
            <Plus className="w-3.5 h-3.5" /> Milník
          </button>
          <button onClick={() => openNewTask()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500/10 rounded-xl transition">
            <Plus className="w-3.5 h-3.5" /> Úkol
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-bold text-slate-400 mb-1">Termín zahájení montáže</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={montazStartDate}
              onChange={(e) => handleMontazDateChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48"
            />
            {savingMontaz && (
              <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            )}
            {montazStartDate && (
              <span className="text-xs text-slate-400">
                {fmtDate(montazStartDate)} - dny milníků se počítají od tohoto data
              </span>
            )}
            {!montazStartDate && (
              <span className="text-xs text-slate-500">
                Nastavte datum pro automatický výpočet termínů milníků
              </span>
            )}
          </div>
        </div>
      </div>

      {milestones.length > 0 && <MilestoneTimeline milestones={milestones} montazStart={montazStartDate} />}

      {milestones.map(ms => {
        const msTasks = tasks.filter(t => t.milestone_id === ms.id);
        const isCollapsed = collapsedMs.has(ms.id);
        const stInfo = MS_STATUSES.find(s => s.key === ms.status) || MS_STATUSES[0];
        const doneCount = msTasks.filter(t => t.status === 'done').length;

        const displayStart = montazStartDate
          ? computeMilestoneDates(montazStartDate, ms.offset_days, ms.duration_days).start
          : ms.start_date;
        const displayEnd = montazStartDate
          ? computeMilestoneDates(montazStartDate, ms.offset_days, ms.duration_days).end
          : ms.end_date;

        return (
          <div key={ms.id} className="rounded-xl border border-white/[0.08] overflow-hidden bg-navy-800/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] border-b border-white/[0.06]">
              <button onClick={() => toggleMs(ms.id)} className="p-0.5 rounded hover:bg-white/[0.07] transition shrink-0">
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ms.color }} />
              <span className="text-sm font-bold text-white">{ms.name}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stInfo.bg} shrink-0`}>{stInfo.label}</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                <Calendar className="w-3 h-3" />
                {fmtDate(displayStart)} – {fmtDate(displayEnd)}
              </span>
              {montazStartDate && (
                <span className="text-[10px] font-semibold text-blue-400 shrink-0">
                  den {ms.offset_days} ({ms.duration_days}d)
                </span>
              )}
              {!montazStartDate && (
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">{ms.duration_days} dní</span>
              )}
              {msTasks.length > 0 && (
                <span className="text-[10px] text-slate-500 shrink-0">{doneCount}/{msTasks.length} hotovo</span>
              )}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <button onClick={() => openNewTask(ms.id)} className="p-1 rounded hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition" title="Přidat úkol">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openEditMs(ms)} className="p-1 rounded hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteMs(ms.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-white/[0.06]">
                {msTasks.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-slate-500">Žádné úkoly v tomto milníku</p>
                    <button onClick={() => openNewTask(ms.id)} className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition">
                      + Přidat úkol
                    </button>
                  </div>
                ) : (
                  msTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      profiles={profiles}
                      getProfileName={getProfileName}
                      onStatusChange={handleStatusChange}
                      onEdit={openEditTask}
                      onDelete={handleDeleteTask}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {unassignedTasks.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-navy-800/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] border-b border-white/[0.06]">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-300">Bez milníku</span>
            <span className="text-[10px] text-slate-500">{unassignedTasks.length} úkolů</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {unassignedTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                profiles={profiles}
                getProfileName={getProfileName}
                onStatusChange={handleStatusChange}
                onEdit={openEditTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {milestones.length === 0 && tasks.length === 0 && (
        <div className="text-center py-16">
          <CheckSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-3">Žádné milníky ani úkoly</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={openNewMs} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition">+ Vytvořit milník</button>
            <span className="text-slate-400">|</span>
            <button onClick={() => openNewTask()} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition">+ Přidat úkol</button>
          </div>
        </div>
      )}

      <TaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        form={taskForm}
        setForm={setTaskForm}
        onSave={handleSaveTask}
        isEdit={!!editTask}
        profiles={profiles}
        milestones={milestones}
      />

      <MilestoneModal
        open={showMsModal}
        onClose={() => setShowMsModal(false)}
        form={msForm}
        setForm={setMsForm}
        onSave={handleSaveMs}
        isEdit={!!editMs}
        montazStartDate={montazStartDate}
      />
    </div>
  );
}

function TaskRow({
  task, profiles: _p, getProfileName, onStatusChange, onEdit, onDelete,
}: {
  task: Task;
  profiles: Profile[];
  getProfileName: (id: string | null) => string;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
  const stInfo = TASK_STATUSES.find(s => s.key === task.status);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition group">
      <input
        type="checkbox"
        checked={task.status === 'done'}
        onChange={() => onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
        className="rounded shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</div>
        {task.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>}
      </div>
      {stInfo && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${stInfo.color} shrink-0`}>{stInfo.label}</span>
      )}
      <span className={`text-[10px] font-bold ${pri.color} shrink-0`}>
        <Flag className="w-3 h-3 inline mr-0.5" />{pri.label}
      </span>
      {task.due_date && (
        <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-0.5">
          <Calendar className="w-2.5 h-2.5" />{fmtDate(task.due_date)}
        </span>
      )}
      {task.assigned_to && <span className="text-[10px] text-slate-500 shrink-0">{getProfileName(task.assigned_to)}</span>}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition">
          <Edit2 className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function MilestoneTimeline({ milestones, montazStart }: { milestones: MilestoneRow[]; montazStart: string }) {
  const resolvedMs = milestones.map(ms => {
    if (montazStart) {
      const { start, end } = computeMilestoneDates(montazStart, ms.offset_days, ms.duration_days);
      return { ...ms, start_date: start, end_date: end };
    }
    return ms;
  });

  const earliest = resolvedMs.reduce((a, b) => a.start_date < b.start_date ? a : b);
  const latest = resolvedMs.reduce((a, b) => a.end_date > b.end_date ? a : b);
  const totalDays = daysBetween(earliest.start_date, latest.end_date);

  return (
    <div className="relative h-7 bg-white/[0.06] rounded-lg overflow-hidden">
      {resolvedMs.map((ms) => {
        const startOffset = daysBetween(earliest.start_date, ms.start_date) - 1;
        const duration = daysBetween(ms.start_date, ms.end_date);
        const left = totalDays > 1 ? (Math.max(0, startOffset) / (totalDays - 1)) * 100 : 0;
        const width = totalDays > 1 ? (duration / totalDays) * 100 : 100;
        return (
          <div
            key={ms.id}
            className="absolute top-1 h-5 rounded-md flex items-center px-2"
            style={{ left: `${left}%`, width: `${Math.max(width, 3)}%`, backgroundColor: ms.color }}
            title={`${ms.name}: ${fmtDate(ms.start_date)} – ${fmtDate(ms.end_date)}`}
          >
            <span className="text-[9px] font-bold text-white truncate">{ms.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function TaskModal({
  open, onClose, form, setForm, onSave, isEdit, profiles, milestones,
}: {
  open: boolean;
  onClose: () => void;
  form: { title: string; description: string; priority: string; assigned_to: string; due_date: string; milestone_id: string };
  setForm: (f: typeof form) => void;
  onSave: () => void;
  isEdit: boolean;
  profiles: Profile[];
  milestones: MilestoneRow[];
}) {
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Upravit úkol' : 'Nový úkol'} size="md" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
        <button onClick={onSave} disabled={!form.title.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50">
          {isEdit ? 'Uložit' : 'Vytvořit'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Milník</label>
          <select value={form.milestone_id} onChange={e => setForm({ ...form, milestone_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="">Bez milníku</option>
            {milestones.map(ms => (
              <option key={ms.id} value={ms.id}>{ms.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Priorita</label>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Přiřazeno</label>
            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="">-</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Termín</label>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MilestoneModal({
  open, onClose, form, setForm, onSave, isEdit, montazStartDate,
}: {
  open: boolean;
  onClose: () => void;
  form: { name: string; offset_days: number; duration_days: number; status: string; color: string; show_in_calendar: boolean };
  setForm: (f: typeof form) => void;
  onSave: () => void;
  isEdit: boolean;
  montazStartDate: string;
}) {
  const previewStart = montazStartDate
    ? computeMilestoneDates(montazStartDate, form.offset_days, form.duration_days).start
    : null;
  const previewEnd = montazStartDate
    ? computeMilestoneDates(montazStartDate, form.offset_days, form.duration_days).end
    : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Upravit milník' : 'Nový milník'} size="md" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
        <button onClick={onSave} disabled={!form.name.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50">
          {isEdit ? 'Uložit' : 'Vytvořit'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název milníku *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Začátek (den od montáže)</label>
            <input
              type="number"
              min={0}
              value={form.offset_days}
              onChange={e => setForm({ ...form, offset_days: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {form.offset_days === 0 ? 'Den zahájení montáže' : `${form.offset_days}. den od zahájení`}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Trvání (dní)</label>
            <input
              type="number"
              min={1}
              value={form.duration_days}
              onChange={e => setForm({ ...form, duration_days: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {montazStartDate && previewStart && previewEnd && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <CalendarClock className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs text-blue-300 font-semibold">
              {fmtDate(previewStart)} – {fmtDate(previewEnd)}
            </span>
          </div>
        )}

        {!montazStartDate && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">
              Nastavte termín zahájení montáže pro automatický výpočet dat
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            {MS_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl cursor-pointer select-none hover:bg-white/[0.07] transition">
          <input
            type="checkbox"
            checked={form.show_in_calendar}
            onChange={e => setForm({ ...form, show_in_calendar: e.target.checked })}
            className="w-4 h-4 rounded border-white/20 text-blue-400 focus:ring-blue-500/30"
          />
          <div>
            <span className="text-sm font-semibold text-white">Zobrazit v kalendáři</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Vícedenní milníky se vykreslí jako pás přes více dní</p>
          </div>
        </label>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-7 h-7 rounded-lg border-2 transition ${form.color === c ? 'border-white/40 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
