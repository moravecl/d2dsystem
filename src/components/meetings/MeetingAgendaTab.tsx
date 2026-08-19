import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface AgendaItem {
  id: string;
  meeting_id: string;
  title: string;
  description: string;
  duration_minutes: number;
  responsible_user_id: string | null;
  status: string;
  sort_order: number;
}

interface ProfileRef { id: string; display_name: string | null; email: string; }

interface Props {
  meetingId: string;
  profiles: ProfileRef[];
  readonly?: boolean;
}

const STATUSES: { key: string; label: string; color: string }[] = [
  { key: 'pending', label: 'Čeká', color: 'bg-white/[0.06] text-slate-400' },
  { key: 'discussed', label: 'Projednáno', color: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'skipped', label: 'Přeskočeno', color: 'bg-amber-500/10 text-amber-400' },
  { key: 'deferred', label: 'Odloženo', color: 'bg-blue-500/10 text-blue-400' },
];

export default function MeetingAgendaTab({ meetingId, profiles, readonly }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState(10);
  const [newResponsible, setNewResponsible] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('meeting_agenda_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('sort_order');
    setItems((data || []) as AgendaItem[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [meetingId]);

  const getName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : -1;
    const { error } = await supabase.from('meeting_agenda_items').insert({
      meeting_id: meetingId,
      title: newTitle.trim(),
      duration_minutes: newDuration,
      responsible_user_id: newResponsible || null,
      sort_order: maxOrder + 1,
    });
    if (error) { toast('Chyba', 'error'); return; }
    setNewTitle('');
    setNewDuration(10);
    setNewResponsible('');
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('meeting_agenda_items').delete().eq('id', id);
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('meeting_agenda_items').update({ status }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    updated.forEach((item, i) => item.sort_order = i);
    setItems(updated);
    await Promise.all(updated.map(item =>
      supabase.from('meeting_agenda_items').update({ sort_order: item.sort_order }).eq('id', item.id)
    ));
  };

  const totalMinutes = items.reduce((s, i) => s + i.duration_minutes, 0);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">Zatím žádné body agendy</div>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => {
          const st = STATUSES.find(s => s.key === item.status) || STATUSES[0];
          return (
            <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] group">
              <div className="text-sm font-bold text-slate-300 w-6 text-right pt-1">{idx + 1}.</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-white">{item.title}</span>
                  <select
                    value={item.status}
                    onChange={e => handleStatusChange(item.id, e.target.value)}
                    disabled={readonly}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${st.color} cursor-pointer`}
                  >
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                {item.description && <p className="text-xs text-slate-500 mb-1">{item.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.duration_minutes} min</span>
                  {item.responsible_user_id && <span>{getName(item.responsible_user_id)}</span>}
                </div>
              </div>
              {!readonly && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-white/[0.08] text-slate-400 disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleMove(idx, 1)} disabled={idx === items.length - 1} className="p-1 rounded hover:bg-white/[0.08] text-slate-400 disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readonly && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.06]">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nový bod agendy..."
            className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="number"
            min={1}
            value={newDuration}
            onChange={e => setNewDuration(parseInt(e.target.value) || 10)}
            className="w-16 px-2 py-2 rounded-lg border border-white/10 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-xs text-slate-400 shrink-0">min</span>
          <select
            value={newResponsible}
            onChange={e => setNewResponsible(e.target.value)}
            className="w-36 px-2 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]"
          >
            <option value="">Zodpovědný</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{getName(p.id)}</option>)}
          </select>
          <button onClick={handleAdd} disabled={!newTitle.trim()} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <span className="text-xs font-semibold text-blue-400">Celkový čas agendy</span>
        <span className="text-sm font-bold text-blue-400">{totalMinutes} min ({Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m)</span>
      </div>
    </div>
  );
}
