import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

interface EventType {
  id: string;
  name: string;
  color: string;
}

interface ProjectOption {
  id: string;
  project_name: string;
}

interface ProfileOption {
  id: string;
  display_name: string | null;
  email: string;
}

interface EventData {
  id?: string;
  title: string;
  description: string;
  event_type_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  all_day: boolean;
  location: string;
  project_id: string;
  attendees: string[];
  reminder_minutes: number | null;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: EventData | null;
}

const REMINDER_OPTIONS = [
  { value: null, label: 'Bez připomínky' },
  { value: 15, label: '15 minut předem' },
  { value: 30, label: '30 minut předem' },
  { value: 60, label: '1 hodina předem' },
  { value: 120, label: '2 hodiny předem' },
  { value: 1440, label: '1 den předem' },
];

const emptyForm: EventData = {
  title: '',
  description: '',
  event_type_id: '',
  start_date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  end_date: new Date().toISOString().split('T')[0],
  end_time: '10:00',
  all_day: false,
  location: '',
  project_id: '',
  attendees: [],
  reminder_minutes: 60,
  notes: '',
};

export default function EventFormModal({ open, onClose, onSaved, editData }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<EventData>(emptyForm);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editData || emptyForm);
    (async () => {
      const [etRes, projRes, profRes] = await Promise.all([
        supabase.from('event_types').select('id, name, color').eq('is_active', true).order('sort_order'),
        supabase.from('projects').select('id, project_name').neq('status', 'cancelled').order('project_name'),
        supabase.from('profiles').select('id, display_name, email').eq('is_portal_client', false),
      ]);
      setEventTypes((etRes.data || []) as EventType[]);
      setProjects((projRes.data || []) as ProjectOption[]);
      setProfiles((profRes.data || []) as ProfileOption[]);
      if (!editData && etRes.data && etRes.data.length > 0 && !form.event_type_id) {
        setForm(f => ({ ...f, event_type_id: etRes.data![0].id }));
      }
    })();
  }, [open]);

  const update = (key: keyof EventData, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const toggleAttendee = (id: string) => {
    setForm(f => ({
      ...f,
      attendees: f.attendees.includes(id) ? f.attendees.filter(a => a !== id) : [...f.attendees, id],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description,
      event_type_id: form.event_type_id || null,
      start_date: form.start_date,
      start_time: form.all_day ? null : form.start_time || null,
      end_date: form.end_date || form.start_date,
      end_time: form.all_day ? null : form.end_time || null,
      all_day: form.all_day,
      location: form.location,
      project_id: form.project_id || null,
      attendees: form.attendees,
      reminder_minutes: form.reminder_minutes,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editData?.id) {
      ({ error } = await supabase.from('events').update(payload).eq('id', editData.id));
    } else {
      ({ error } = await supabase.from('events').insert({ ...payload, created_by: user?.id }));
    }

    setSaving(false);
    if (error) {
      toast('Chyba při ukládání události', 'error');
      return;
    }
    toast(editData?.id ? 'Událost aktualizována' : 'Událost vytvořena');
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editData?.id ? 'Upravit událost' : 'Nová událost'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSave} disabled={!form.title.trim() || !form.start_date || saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {saving ? 'Ukládám...' : editData?.id ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název události *</label>
          <input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Např. Schůzka s klientem..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ události</label>
            <select value={form.event_type_id} onChange={e => update('event_type_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">-- Vyberte --</option>
              {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt (nepovinné)</label>
            <select value={form.project_id} onChange={e => update('project_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">-- Žádný --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.all_day} onChange={e => update('all_day', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20" />
            <span className="text-sm text-slate-300">Celodenní</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum začátku *</label>
            <input type="date" value={form.start_date} onChange={e => {
              update('start_date', e.target.value);
              if (!form.end_date || form.end_date < e.target.value) update('end_date', e.target.value);
            }} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          {!form.all_day && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Čas začátku</label>
              <input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum konce</label>
            <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)}
              min={form.start_date}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          {!form.all_day && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Čas konce</label>
              <input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Místo</label>
          <input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Adresa, kancelář, online..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Připomínka</label>
          <select value={form.reminder_minutes ?? ''} onChange={e => update('reminder_minutes', e.target.value === '' ? null : Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            {REMINDER_OPTIONS.map(o => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Účastníci</label>
          <div className="max-h-40 overflow-y-auto border border-white/10 rounded-xl p-2 space-y-1">
            {profiles.length === 0 ? (
              <div className="text-xs text-slate-400 p-2">Žádní uživatelé</div>
            ) : profiles.map(p => (
              <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                <input type="checkbox" checked={form.attendees.includes(p.id)} onChange={() => toggleAttendee(p.id)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20" />
                <span className="text-sm text-slate-300">{p.display_name || p.email}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} placeholder="Podrobnosti o události..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>
      </div>
    </Modal>
  );
}
