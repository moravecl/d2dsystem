import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

interface ActionItem {
  id: string;
  meeting_id: string;
  agenda_item_id: string | null;
  task_id: string | null;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  status: string;
  note: string;
}

interface AgendaRef { id: string; title: string; }
interface ProfileRef { id: string; display_name: string | null; email: string; }

interface Props {
  meetingId: string;
  projectId: string | null;
  profiles: ProfileRef[];
  readonly?: boolean;
}

const PRIORITIES = [
  { key: 'low', label: 'Nízká' },
  { key: 'medium', label: 'Střední' },
  { key: 'high', label: 'Vysoká' },
  { key: 'urgent', label: 'Urgentní' },
];

export default function MeetingActionItemsTab({ meetingId, projectId, profiles, readonly }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaRef[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newAssigned, setNewAssigned] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newAgendaId, setNewAgendaId] = useState('');

  const load = async () => {
    const [aiRes, agRes] = await Promise.all([
      supabase.from('meeting_action_items').select('*').eq('meeting_id', meetingId).order('created_at'),
      supabase.from('meeting_agenda_items').select('id, title').eq('meeting_id', meetingId).order('sort_order'),
    ]);
    const actionItems = (aiRes.data || []) as ActionItem[];
    setItems(actionItems);
    setAgendaItems((agRes.data || []) as AgendaRef[]);

    const taskIds = actionItems.filter(a => a.task_id).map(a => a.task_id!);
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase.from('tasks').select('id, status').in('id', taskIds);
      const statusMap: Record<string, string> = {};
      (tasks || []).forEach((t: any) => { statusMap[t.id] = t.status; });
      setTaskStatuses(statusMap);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [meetingId]);

  const getName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !user) return;

    const { data: task, error: taskError } = await supabase.from('tasks').insert({
      title: newTitle.trim(),
      assigned_to: newAssigned || null,
      due_date: newDueDate || null,
      priority: newPriority,
      status: 'todo',
      project_id: projectId,
      created_by: user.id,
    }).select('id').maybeSingle();

    if (taskError || !task) { toast('Chyba při vytváření úkolu', 'error'); return; }

    const { error } = await supabase.from('meeting_action_items').insert({
      meeting_id: meetingId,
      agenda_item_id: newAgendaId || null,
      task_id: task.id,
      title: newTitle.trim(),
      assigned_to: newAssigned || null,
      due_date: newDueDate || null,
      status: 'open',
    });

    if (error) { toast('Chyba', 'error'); return; }

    setNewTitle('');
    setNewAssigned('');
    setNewDueDate('');
    setNewPriority('medium');
    setNewAgendaId('');
    toast('Úkol vytvořen');
    load();
  };

  const handleRemove = async (id: string) => {
    await supabase.from('meeting_action_items').delete().eq('id', id);
    load();
  };

  const handleToggle = async (item: ActionItem) => {
    const newStatus = item.status === 'completed' ? 'open' : 'completed';
    await supabase.from('meeting_action_items').update({ status: newStatus }).eq('id', item.id);
    if (item.task_id) {
      await supabase.from('tasks').update({ status: newStatus === 'completed' ? 'done' : 'todo' }).eq('id', item.task_id);
    }
    load();
  };

  const completedCount = items.filter(i => i.status === 'completed').length;

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-xs font-semibold text-blue-400">Úkoly z porady</span>
          <span className="ml-auto text-sm font-bold text-blue-400">{completedCount}/{items.length} splněno</span>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => {
          const isDone = item.status === 'completed';
          const realStatus = item.task_id ? taskStatuses[item.task_id] : item.status;
          const agendaTitle = item.agenda_item_id ? agendaItems.find(a => a.id === item.agenda_item_id)?.title : null;
          return (
            <div key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border group transition ${isDone ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.06] border-white/[0.06]'}`}>
              <button onClick={() => !readonly && handleToggle(item)} disabled={readonly} className="mt-0.5 shrink-0">
                {isDone
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  : <Circle className="w-5 h-5 text-slate-300" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${isDone ? 'text-slate-400 line-through' : 'text-white'}`}>{item.title}</span>
                  {agendaTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">{agendaTitle}</span>}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  {item.assigned_to && <span>{getName(item.assigned_to)}</span>}
                  {item.due_date && <span>{new Date(item.due_date + 'T00:00:00').toLocaleDateString('cs-CZ')}</span>}
                  {realStatus && realStatus !== 'done' && realStatus !== 'todo' && (
                    <span className="text-blue-500">{realStatus === 'in_progress' ? 'Rozpracováno' : realStatus}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                {item.task_id && (
                  <Link to="/ukoly" className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-blue-500">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                {!readonly && (
                  <button onClick={() => handleRemove(item.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">Zatím žádné úkoly z porady</div>
      )}

      {!readonly && (
        <div className="p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.06] space-y-2">
          <div className="text-xs font-semibold text-slate-500 mb-1">Nový úkol</div>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Název úkolu..."
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <select value={newAssigned} onChange={e => setNewAssigned(e.target.value)}
              className="w-40 px-2 py-2 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Zodpovědný</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{getName(p.id)}</option>)}
            </select>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="px-2 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
              className="w-28 px-2 py-2 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          {agendaItems.length > 0 && (
            <select value={newAgendaId} onChange={e => setNewAgendaId(e.target.value)}
              className="w-full px-2 py-2 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">-- Bod agendy (volitelné) --</option>
              {agendaItems.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          )}
          <button onClick={handleAdd} disabled={!newTitle.trim()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> Přidat úkol
          </button>
        </div>
      )}
    </div>
  );
}
