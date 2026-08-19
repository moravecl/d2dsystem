import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Calendar, Flag, FolderKanban, ArrowRight, Loader2, X, Check, Edit2, AlignLeft } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface MyTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
}

interface ColumnDef {
  key: string;
  label: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgentní', color: 'text-red-400', dot: 'bg-red-400' },
  high: { label: 'Vysoká', color: 'text-orange-400', dot: 'bg-orange-400' },
  medium: { label: 'Střední', color: 'text-amber-400', dot: 'bg-amber-400' },
  low: { label: 'Nízká', color: 'text-slate-400', dot: 'bg-slate-400' },
};

const STATUS_DONE = ['done', 'completed', 'resolved', 'closed'];

interface Props {
  editMode: boolean;
}

function TaskDetailModal({
  task,
  columns,
  onClose,
  onMarkDone,
  onStatusChange,
  onFieldUpdate,
}: {
  task: MyTask;
  columns: ColumnDef[];
  onClose: () => void;
  onMarkDone: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onFieldUpdate: (taskId: string, priority: string, due_date: string | null) => void;
}) {
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? '');
  const [saving, setSaving] = useState(false);

  const pCfg = PRIORITY_CONFIG[editPriority] ?? PRIORITY_CONFIG.medium;
  const isDone = STATUS_DONE.includes(task.status);
  const isOverdue = editDueDate && new Date(editDueDate) < new Date(new Date().toDateString());

  const hasChanges = editPriority !== task.priority || (editDueDate || null) !== task.due_date;

  const handleSave = async () => {
    setSaving(true);
    const due = editDueDate || null;
    await supabase
      .from('tasks')
      .update({ priority: editPriority, due_date: due, updated_at: new Date().toISOString() })
      .eq('id', task.id);
    onFieldUpdate(task.id, editPriority, due);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(8 12 28)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Detail úkolu</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <h2 className={`text-lg font-bold leading-snug ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
              {task.title}
            </h2>
            {task.description && (
              <div className="flex items-start gap-2 mt-3">
                <AlignLeft className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-400 leading-relaxed">{task.description}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
              <p className="text-xs text-slate-500 mb-2">Priorita</p>
              <select
                value={editPriority}
                onChange={e => setEditPriority(e.target.value)}
                className={`w-full bg-transparent text-sm font-semibold focus:outline-none cursor-pointer ${pCfg.color}`}
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k} className="bg-slate-900 text-white">{v.label}</option>
                ))}
              </select>
              <div className={`flex items-center gap-1.5 mt-1 text-xs font-semibold ${pCfg.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                {pCfg.label}
              </div>
            </div>

            <div className="bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
              <p className="text-xs text-slate-500 mb-2">Termín</p>
              <input
                type="date"
                value={editDueDate}
                onChange={e => setEditDueDate(e.target.value)}
                className={`w-full bg-transparent text-sm font-semibold focus:outline-none cursor-pointer ${isOverdue && !isDone ? 'text-red-400' : 'text-slate-200'}`}
              />
            </div>

            {task.project_name && (
              <div className="col-span-2 bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
                <p className="text-xs text-slate-500 mb-1">Projekt</p>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                  <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                  {task.project_name}
                </div>
              </div>
            )}
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Uložit změny
            </button>
          )}

          {columns.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Stav</p>
              <div className="flex flex-wrap gap-2">
                {columns.map(col => (
                  <button
                    key={col.key}
                    onClick={() => onStatusChange(task.id, col.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      task.status === col.key
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
          <Link
            to="/ukoly"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Otevřít v Úkolech
          </Link>

          {!isDone ? (
            <button
              onClick={() => onMarkDone(task.id)}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition"
            >
              <Check className="w-4 h-4" />
              Označit jako splněný
            </button>
          ) : (
            <button
              onClick={() => onStatusChange(task.id, columns.find(c => !STATUS_DONE.includes(c.key))?.key ?? 'todo')}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-slate-300 bg-white/[0.07] hover:bg-white/[0.1] rounded-xl transition"
            >
              Znovu otevřít
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyTasksWidget({ editMode }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);

  const loadTasks = async (uid: string) => {
    const [tasksRes, statusesRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, description, status, priority, due_date, project_id, projects(project_name)')
        .eq('assigned_to', uid)
        .not('status', 'in', `(${STATUS_DONE.join(',')})`)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('task_statuses')
        .select('key, label')
        .eq('is_active', true)
        .order('sort_order'),
    ]);

    const mapped: MyTask[] = (tasksRes.data ?? []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      title: t.title as string,
      description: (t.description as string) ?? '',
      status: t.status as string,
      priority: t.priority as string,
      due_date: t.due_date as string | null,
      project_id: t.project_id as string | null,
      project_name: (t.projects as { project_name?: string } | null)?.project_name ?? null,
    }));

    const withDate = mapped.filter(t => t.due_date != null);
    const withoutDate = mapped.filter(t => t.due_date == null);
    withoutDate.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));

    setTasks([...withDate, ...withoutDate]);

    const dbCols = (statusesRes.data ?? []) as ColumnDef[];
    if (dbCols.length > 0) setColumns(dbCols);
    else setColumns([
      { key: 'todo', label: 'K vyřízení' },
      { key: 'in_progress', label: 'Rozpracováno' },
      { key: 'done', label: 'Hotovo' },
      { key: 'blocked', label: 'Blokováno' },
    ]);

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!cancelled) await loadTasks(user.id);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleMarkDone = async (taskId: string) => {
    const doneKey = columns.find(c => STATUS_DONE.includes(c.key))?.key ?? 'done';
    await supabase.from('tasks').update({ status: doneKey, updated_at: new Date().toISOString() }).eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (STATUS_DONE.includes(newStatus)) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTask(null);
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setSelectedTask(prev => prev?.id === taskId ? { ...prev, status: newStatus } : prev);
    }
  };

  const handleFieldUpdate = (taskId: string, priority: string, due_date: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority, due_date } : t));
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, priority, due_date } : prev);
  };

  const isOverdue = (due: string) => new Date(due) < new Date(new Date().toDateString());
  const fmtDate = (due: string) => new Date(due).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });

  return (
    <>
      <div className={`glass-card overflow-hidden ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950' : ''}`}>
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            Moje úkoly
          </h2>
          <Link
            to="/ukoly"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors group"
          >
            Všechny úkoly
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Žádné přiřazené úkoly
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {tasks.slice(0, 8).map(task => {
              const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
              const overdue = task.due_date ? isOverdue(task.due_date) : false;

              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors group text-left"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${pCfg.dot}`} />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                      {task.title}
                    </div>
                    {task.project_name && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <FolderKanban className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-xs text-slate-500 truncate">{task.project_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`flex items-center gap-1 text-xs ${pCfg.color}`}>
                      <Flag className="w-3 h-3" />
                      <span className="hidden sm:inline">{pCfg.label}</span>
                    </div>

                    {task.due_date && (
                      <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{fmtDate(task.due_date)}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {tasks.length > 8 && (
              <div className="px-5 py-3 text-center">
                <Link to="/ukoly" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  + {tasks.length - 8} dalších úkolů
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={columns}
          onClose={() => setSelectedTask(null)}
          onMarkDone={handleMarkDone}
          onStatusChange={handleStatusChange}
          onFieldUpdate={handleFieldUpdate}
        />
      )}
    </>
  );
}
