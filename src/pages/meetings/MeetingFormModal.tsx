import { useState, useEffect } from 'react';
import { Users as UsersIcon } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

interface ProfileOption {
  id: string;
  display_name: string | null;
  email: string;
}

interface ProjectOption {
  id: string;
  project_name: string;
  client_id: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

export interface MeetingFormData {
  id?: string;
  title: string;
  type: 'porada' | 'schuzka';
  description: string;
  location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  project_id: string;
  client_id: string;
  attendees: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: MeetingFormData | null;
  prefillProjectId?: string;
  prefillClientId?: string;
}

const emptyForm: MeetingFormData = {
  title: '',
  type: 'porada',
  description: '',
  location: '',
  start_date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  end_date: new Date().toISOString().split('T')[0],
  end_time: '10:00',
  project_id: '',
  client_id: '',
  attendees: [],
};

export default function MeetingFormModal({ open, onClose, onSaved, editData, prefillProjectId, prefillClientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<MeetingFormData>(emptyForm);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = editData || { ...emptyForm };
    if (prefillProjectId && !editData) base.project_id = prefillProjectId;
    if (prefillClientId && !editData) {
      base.client_id = prefillClientId;
      base.type = 'schuzka';
    }
    setForm(base);
    (async () => {
      const [profRes, projRes, cliRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, email'),
        supabase.from('projects').select('id, project_name, client_id').neq('status', 'cancelled').order('project_name'),
        supabase.from('clients').select('id, name').order('name'),
      ]);
      setProfiles((profRes.data || []) as ProfileOption[]);
      setProjects((projRes.data || []) as ProjectOption[]);
      setClients((cliRes.data || []) as ClientOption[]);
    })();
  }, [open, editData, prefillProjectId, prefillClientId]);

  const filteredProjects = form.type === 'schuzka' && form.client_id
    ? projects.filter(p => p.client_id === form.client_id)
    : projects;

  const handleSave = async () => {
    if (!form.title.trim() || !user) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description,
      location: form.location,
      start_date: form.start_date,
      start_time: form.start_time || null,
      end_date: form.end_date || form.start_date,
      end_time: form.end_time || null,
      status: 'planned' as const,
      project_id: form.project_id || null,
      client_id: form.type === 'schuzka' ? (form.client_id || null) : null,
      created_by: user.id,
    };

    let meetingId = form.id;

    if (form.id) {
      const { error } = await supabase.from('meetings').update({
        ...payload,
        updated_at: new Date().toISOString(),
      }).eq('id', form.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('meetings').insert(payload).select('id').maybeSingle();
      if (error || !data) { toast('Chyba při vytváření', 'error'); setSaving(false); return; }
      meetingId = data.id;
    }

    if (meetingId) {
      await supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId);
      const attendeeRows = form.attendees.map((uid, i) => ({
        meeting_id: meetingId!,
        user_id: uid,
        role: i === 0 ? 'organizer' : 'attendee',
        attendance_status: 'invited',
      }));
      if (attendeeRows.length > 0) {
        await supabase.from('meeting_attendees').insert(attendeeRows);
      }
    }

    setSaving(false);
    toast(form.id ? 'Porada aktualizována' : 'Porada vytvořena');
    onSaved();
    onClose();
  };

  const toggleAttendee = (uid: string) => {
    setForm(prev => ({
      ...prev,
      attendees: prev.attendees.includes(uid)
        ? prev.attendees.filter(a => a !== uid)
        : [...prev.attendees, uid],
    }));
  };

  const getName = (p: ProfileOption) => p.display_name || p.email;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? 'Upravit poradu' : 'Nová porada / schůzka'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : form.id ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setForm({ ...form, type: 'porada' })}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
              form.type === 'porada'
                ? 'bg-blue-500/10 border-blue-200 text-blue-400'
                : 'bg-white/[0.06] border-white/10 text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            Porada (interní)
          </button>
          <button
            onClick={() => setForm({ ...form, type: 'schuzka' })}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
              form.type === 'schuzka'
                ? 'bg-emerald-500/10 border-emerald-200 text-emerald-400'
                : 'bg-white/[0.06] border-white/10 text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            Schůzka (s klientem)
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder={form.type === 'porada' ? 'Název porady...' : 'Název schůzky...'}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {form.type === 'schuzka' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Klient</label>
            <select
              value={form.client_id}
              onChange={e => setForm({ ...form, client_id: e.target.value, project_id: '' })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]"
            >
              <option value="">-- Vyberte klienta --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
          <select
            value={form.project_id}
            onChange={e => setForm({ ...form, project_id: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]"
          >
            <option value="">-- Bez projektu --</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum začátku</label>
            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Čas začátku</label>
            <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum konce</label>
            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} min={form.start_date}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Čas konce</label>
            <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Místo</label>
          <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Kde se porada koná..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Témá a cíle porady..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            <UsersIcon className="w-3.5 h-3.5 inline mr-1" />
            Účastníci ({form.attendees.length})
          </label>
          <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl border border-white/10 bg-white/[0.04]/50">
            {profiles.map(p => (
              <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.attendees.includes(p.id)}
                  onChange={() => toggleAttendee(p.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20"
                />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {getName(p).charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-slate-300 truncate">{getName(p)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
