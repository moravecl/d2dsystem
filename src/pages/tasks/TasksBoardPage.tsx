import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Calendar, User as UserIcon, Flag,
  MoreHorizontal, Filter, FolderKanban, LayoutGrid, List, Trash2, Edit2,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import type { Profile } from '../../types/database';

interface Task {
  id: string;
  project_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

interface ProjectRef {
  id: string;
  project_name: string;
}

interface ColumnDef {
  key: string;
  label: string;
  color: string;
  bg: string;
}

const FALLBACK_COLUMNS: ColumnDef[] = [
  { key: 'todo', label: 'K vyřízení', color: 'bg-white/[0.04]0', bg: 'bg-white/[0.06]/[0.03]' },
  { key: 'in_progress', label: 'Rozpracováno', color: 'bg-blue-500/100', bg: 'bg-blue-500/100/[0.06]' },
  { key: 'done', label: 'Hotovo', color: 'bg-emerald-500/100', bg: 'bg-emerald-500/100/[0.06]' },
  { key: 'blocked', label: 'Blokováno', color: 'bg-red-500/100', bg: 'bg-red-500/100/[0.06]' },
];

const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: 'Nízká', color: 'text-slate-400' },
  medium: { label: 'Střední', color: 'text-amber-400' },
  high: { label: 'Vysoká', color: 'text-orange-400' },
  urgent: { label: 'Urgentní', color: 'text-red-400' },
};

export default function TasksBoardPage() {
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>(FALLBACK_COLUMNS);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [viewLoaded, setViewLoaded] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', assigned_to: '',
    project_id: '', due_date: '',
  });

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Úkoly' }],
      primaryAction: {
        label: 'Nový úkol',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          setEditingTask(null);
          setForm({ title: '', description: '', priority: 'medium', assigned_to: '', project_id: '', due_date: '' });
          setShowModal(true);
        },
      },
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    const [tasksRes, profilesRes, projectsRes, statusesRes] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('projects').select('id, project_name').neq('status', 'cancelled'),
      supabase.from('task_statuses').select('*').eq('is_active', true).order('sort_order'),
    ]);
    setTasks((tasksRes.data || []) as Task[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setProjects((projectsRes.data || []) as ProjectRef[]);

    const dbStatuses = statusesRes.data || [];
    if (dbStatuses.length > 0) {
      setColumns(dbStatuses.map((s: any) => ({
        key: s.key,
        label: s.label,
        color: `bg-[${s.color}]`,
        bg: `bg-[${s.color}]/10`,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('dashboard_layouts')
        .select('tasks_view_preference')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.tasks_view_preference) {
        setViewMode(data.tasks_view_preference as 'kanban' | 'list');
      }
      setViewLoaded(true);
    })();
  }, [user]);

  const handleViewModeChange = async (mode: 'kanban' | 'list') => {
    setViewMode(mode);
    if (!user) return;
    await supabase.from('dashboard_layouts').upsert(
      { user_id: user.id, tasks_view_preference: mode, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  };

  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const getProjectName = (id: string | null) => {
    if (!id) return '';
    return projects.find(p => p.id === id)?.project_name || '';
  };

  const filtered = tasks.filter(t => {
    if (filterProject && t.project_id !== filterProject) return false;
    if (filterAssignee && t.assigned_to !== filterAssignee) return false;
    return true;
  });

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      project_id: form.project_id || null,
      due_date: form.due_date || null,
    };

    if (editingTask) {
      const { error } = await supabase.from('tasks').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingTask.id);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Úkol aktualizován');
    } else {
      const defaultStatus = columns.length > 0 ? columns[0].key : 'todo';
      const { error } = await supabase.from('tasks').insert({ ...payload, status: defaultStatus, created_by: user!.id });
      if (error) { toast('Chyba', 'error'); return; }
      toast('Úkol vytvořen');
    }
    setShowModal(false);
    loadData();
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Smazat úkol?')) return;
    await supabase.from('tasks').delete().eq('id', taskId);
    toast('Úkol smazán');
    loadData();
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      project_id: task.project_id || '',
      due_date: task.due_date || '',
    });
    setShowModal(true);
  };

  const handleDragStart = (taskId: string) => { setDraggedTask(taskId); };
  const handleDragEnd = () => { setDraggedTask(null); setDragOverColumn(null); };
  const handleDragOver = (e: React.DragEvent, columnKey: string) => { e.preventDefault(); setDragOverColumn(columnKey); };
  const handleDragLeave = () => { setDragOverColumn(null); };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedTask) return;
    const task = tasks.find(t => t.id === draggedTask);
    if (!task || task.status === newStatus) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', draggedTask);
    setTasks(prev => prev.map(t => t.id === draggedTask ? { ...t, status: newStatus } : t));
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  if (loading || !viewLoaded) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div data-tour="tasks-filters" className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="text-sm border border-white/10 rounded-lg px-3 py-1.5 bg-white/[0.06] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
            <option value="" className="bg-navy-800">Všechny projekty</option>
            {projects.map(p => <option key={p.id} value={p.id} className="bg-navy-800">{p.project_name}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="text-sm border border-white/10 rounded-lg px-3 py-1.5 bg-white/[0.06] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
            <option value="" className="bg-navy-800">Všichni</option>
            {profiles.map(p => <option key={p.id} value={p.id} className="bg-navy-800">{p.display_name || p.email}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">{filtered.length} ukolu</span>
          <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => handleViewModeChange('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-3.5 h-3.5" /> Seznam
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div data-tour="tasks-kanban" className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${columns.length >= 3 ? 'xl:grid-cols-' + Math.min(columns.length, 5) : ''}`} style={{ gridTemplateColumns: columns.length > 2 ? `repeat(${Math.min(columns.length, 5)}, minmax(0, 1fr))` : undefined }}>
          {columns.map((col) => {
            const colTasks = filtered.filter(t => t.status === col.key);
            const isDropTarget = dragOverColumn === col.key;
            return (
              <div
                key={col.key}
                className={`rounded-xl border transition-all min-h-[300px] ${isDropTarget ? 'bg-blue-500/10 ring-2 ring-blue-500/30 border-white/[0.06]' : `border-white/[0.06] ${col.bg}`}`}
                onDragOver={e => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.key)}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color.startsWith('bg-[') ? col.color.slice(4, -1) : undefined }} />
                  <span className="text-sm font-bold text-slate-300">{col.label}</span>
                  <span className="ml-auto text-xs font-semibold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-md">{colTasks.length}</span>
                </div>
                <div className="p-2 space-y-2">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      getProfileName={getProfileName}
                      getProjectName={getProjectName}
                      onEdit={() => openEdit(task)}
                      onStatusChange={handleStatusChange}
                      onDelete={() => handleDelete(task.id)}
                      columns={columns}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedTask === task.id}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className={`text-center py-8 text-xs border border-dashed rounded-lg mx-1 ${isDropTarget ? 'border-blue-500/40 text-blue-400' : 'border-white/10 text-slate-400'}`}>
                      {isDropTarget ? 'Pretahnete sem' : 'Zadne ukoly'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/[0.04] border-b border-white/[0.08]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nazev</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Stav</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">Priorita</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Prirazeno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Termin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Projekt</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Zadne ukoly</td>
                </tr>
              ) : (
                filtered.map(task => {
                  const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                  return (
                    <tr key={task.id} className="hover:bg-white/[0.04] transition group">
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(task)} className="text-sm font-semibold text-white hover:text-blue-400 transition text-left">
                          {task.title}
                        </button>
                        {task.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          onChange={e => handleStatusChange(task.id, e.target.value)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          {columns.map(c => <option key={c.key} value={c.key} className="bg-navy-800">{c.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold flex items-center gap-1 ${pri.color}`}>
                          <Flag className="w-3 h-3" />{pri.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {task.assigned_to ? (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />{getProfileName(task.assigned_to)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {task.due_date ? (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />{new Date(task.due_date).toLocaleDateString('cs-CZ')}
                          </span>
                        ) : <span className="text-xs text-slate-500">-</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {task.project_id ? (
                          <span className="flex items-center gap-1">
                            <FolderKanban className="w-3 h-3" />{getProjectName(task.project_id)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingTask ? 'Upravit úkol' : 'Nový úkol'} size="lg" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-lg transition">Zrušit</button>
          <button onClick={handleSave} disabled={!form.title.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {editingTask ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Priorita</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k} className="bg-navy-800">{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Termín</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Přiřazeno</label>
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
                <option value="" className="bg-navy-800">Nepřiřazeno</option>
                {profiles.map(p => <option key={p.id} value={p.id} className="bg-navy-800">{p.display_name || p.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
              <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
                <option value="" className="bg-navy-800">Bez projektu</option>
                {projects.map(p => <option key={p.id} value={p.id} className="bg-navy-800">{p.project_name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskCard({
  task, getProfileName, getProjectName, onEdit, onStatusChange, onDelete, columns,
  onDragStart, onDragEnd, isDragging,
}: {
  task: Task;
  getProfileName: (id: string | null) => string;
  getProjectName: (id: string | null) => string;
  onEdit: () => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: () => void;
  columns: ColumnDef[];
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      className={`bg-navy-700/60 rounded-lg border border-white/[0.08] p-3 hover:bg-white/[0.06]/[0.04] transition-all group cursor-move ${isDragging ? 'opacity-50 rotate-2 scale-105' : ''}`}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-white line-clamp-2">{task.title}</h4>
        <div className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded hover:bg-white/[0.06]/[0.07] opacity-0 group-hover:opacity-100 transition"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-40 bg-navy-800 rounded-lg border border-white/10 shadow-xl py-1" onClick={e => e.stopPropagation()}>
              {columns.filter(c => c.key !== task.status).map(c => (
                <button key={c.key} onClick={() => { onStatusChange(task.id, c.key); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06]/[0.07] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color.startsWith('bg-[') ? c.color.slice(4, -1) : undefined }} /> {c.label}
                </button>
              ))}
              <div className="border-t border-white/[0.06] my-1" />
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/[0.06]/[0.07]">Smazat</button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`text-[10px] font-bold ${pri.color}`}>
          <Flag className="w-3 h-3 inline mr-0.5" />{pri.label}
        </span>
        {task.project_id && (
          <span className="text-[10px] text-slate-400 bg-white/[0.06]/[0.06] px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <FolderKanban className="w-2.5 h-2.5" />{getProjectName(task.project_id)}
          </span>
        )}
        {task.due_date && (
          <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
            <Calendar className="w-2.5 h-2.5" />{new Date(task.due_date).toLocaleDateString('cs-CZ')}
          </span>
        )}
        {task.assigned_to && (
          <span className="ml-auto text-[10px] text-slate-400 flex items-center gap-0.5">
            <UserIcon className="w-2.5 h-2.5" />{getProfileName(task.assigned_to)}
          </span>
        )}
      </div>
    </div>
  );
}
