import { useState, useEffect, useCallback } from 'react';
import { Plus, Phone, Mail, Users, FileText, CheckCircle2, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface Activity {
  id: string;
  client_id: string;
  type: string;
  title: string;
  description: string;
  user_id: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Reminder {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
}

const TYPES: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  call: { label: 'Hovor', icon: Phone, color: 'bg-blue-500/20 text-blue-400' },
  email: { label: 'Email', icon: Mail, color: 'bg-cyan-100 text-cyan-600' },
  meeting: { label: 'Schůzka', icon: Users, color: 'bg-emerald-500/20 text-emerald-400' },
  note: { label: 'Poznámka', icon: FileText, color: 'bg-amber-500/20 text-amber-400' },
};

export default function CrmActivitiesTab({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActModal, setShowActModal] = useState(false);
  const [showRemModal, setShowRemModal] = useState(false);
  const [actForm, setActForm] = useState({ type: 'note', title: '', description: '', scheduled_at: '' });
  const [remForm, setRemForm] = useState({ title: '', due_date: '' });

  const load = useCallback(async () => {
    const [actRes, remRes] = await Promise.all([
      supabase.from('crm_activities').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('crm_reminders').select('*').eq('client_id', clientId).order('due_date'),
    ]);
    setActivities((actRes.data || []) as Activity[]);
    setReminders((remRes.data || []) as Reminder[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleAddActivity = async () => {
    if (!actForm.title.trim()) return;
    const { error } = await supabase.from('crm_activities').insert({
      client_id: clientId, type: actForm.type, title: actForm.title,
      description: actForm.description, user_id: user!.id,
      scheduled_at: actForm.scheduled_at || null,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Aktivita přidána');
    setShowActModal(false);
    setActForm({ type: 'note', title: '', description: '', scheduled_at: '' });
    load();
  };

  const handleAddReminder = async () => {
    if (!remForm.title.trim() || !remForm.due_date) return;
    const { error } = await supabase.from('crm_reminders').insert({
      client_id: clientId, user_id: user!.id, title: remForm.title, due_date: remForm.due_date,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Připomínka přidána');
    setShowRemModal(false);
    load();
  };

  const toggleReminder = async (id: string, current: boolean) => {
    await supabase.from('crm_reminders').update({ is_completed: !current, updated_at: new Date().toISOString() }).eq('id', id);
    setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: !current } : r));
  };

  const completeActivity = async (id: string) => {
    await supabase.from('crm_activities').update({ completed_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  if (loading) return <div className="animate-pulse h-32 bg-white/[0.06] rounded-lg" />;

  const activeReminders = reminders.filter(r => !r.is_completed);

  return (
    <div className="space-y-6">
      {activeReminders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-amber-500" /> Připomínky
            </h3>
            <button onClick={() => { setRemForm({ title: '', due_date: '' }); setShowRemModal(true); }} className="text-xs text-blue-400 font-semibold hover:text-blue-400">+ Nová</button>
          </div>
          {activeReminders.map(r => {
            const overdue = new Date(r.due_date) < new Date();
            return (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${overdue ? 'border-red-200 bg-red-500/10' : 'border-amber-200 bg-amber-500/10'}`}>
                <input type="checkbox" checked={r.is_completed} onChange={() => toggleReminder(r.id, r.is_completed)} className="rounded" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">{r.title}</span>
                </div>
                <span className={`text-[10px] font-bold ${overdue ? 'text-red-400' : 'text-amber-400'}`}>
                  {new Date(r.due_date).toLocaleDateString('cs-CZ')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Časová osa</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setRemForm({ title: '', due_date: '' }); setShowRemModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-navy-800/60 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition"><Bell className="w-3 h-3" /> Připomínka</button>
          <button onClick={() => { setActForm({ type: 'note', title: '', description: '', scheduled_at: '' }); setShowActModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"><Plus className="w-3 h-3" /> Aktivita</button>
        </div>
      </div>

      <div className="relative pl-6 space-y-4">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/[0.08]" />
        {activities.map(a => {
          const typeInfo = TYPES[a.type] || TYPES.note;
          const Icon = typeInfo.icon;
          return (
            <div key={a.id} className="relative flex items-start gap-3">
              <div className={`absolute left-[-16px] w-5 h-5 rounded-full flex items-center justify-center ${typeInfo.color} ring-4 ring-white`}>
                <Icon className="w-2.5 h-2.5" />
              </div>
              <div className="flex-1 ml-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{a.title}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                  {a.completed_at && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </div>
                {a.description && <p className="text-xs text-slate-500 mt-1">{a.description}</p>}
                <div className="text-[10px] text-slate-400 mt-1">
                  {new Date(a.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {a.scheduled_at && !a.completed_at && (
                    <button onClick={() => completeActivity(a.id)} className="ml-3 text-blue-400 hover:text-blue-400 font-semibold">Dokončit</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400 ml-4">Žádná aktivita</div>
        )}
      </div>

      <Modal open={showActModal} onClose={() => setShowActModal(false)} title="Nová aktivita" size="md" footer={
        <>
          <button onClick={() => setShowActModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleAddActivity} disabled={!actForm.title.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Přidat</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ</label>
            <div className="flex items-center gap-2">
              {Object.entries(TYPES).map(([k, v]) => {
                const I = v.icon;
                return (
                  <button key={k} onClick={() => setActForm({ ...actForm, type: k })} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${actForm.type === k ? 'border-blue-300 bg-blue-500/10 text-blue-400' : 'border-white/10 text-slate-400 hover:bg-white/[0.04]'}`}>
                    <I className="w-3.5 h-3.5" /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label><input value={actForm.title} onChange={e => setActForm({ ...actForm, title: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label><textarea value={actForm.description} onChange={e => setActForm({ ...actForm, description: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum naplánování</label><input type="datetime-local" value={actForm.scheduled_at} onChange={e => setActForm({ ...actForm, scheduled_at: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
        </div>
      </Modal>

      <Modal open={showRemModal} onClose={() => setShowRemModal(false)} title="Nová připomínka" size="sm" footer={
        <>
          <button onClick={() => setShowRemModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleAddReminder} disabled={!remForm.title.trim() || !remForm.due_date} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Přidat</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label><input value={remForm.title} onChange={e => setRemForm({ ...remForm, title: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum *</label><input type="date" value={remForm.due_date} onChange={e => setRemForm({ ...remForm, due_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
        </div>
      </Modal>
    </div>
  );
}
