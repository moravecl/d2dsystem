import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface Attendee {
  id: string;
  meeting_id: string;
  user_id: string;
  role: string;
  attendance_status: string;
}

interface ProfileRef { id: string; display_name: string | null; email: string; }

interface Props {
  meetingId: string;
  profiles: ProfileRef[];
  readonly?: boolean;
}

const ROLES = [
  { key: 'organizer', label: 'Organizátor' },
  { key: 'attendee', label: 'Účastník' },
  { key: 'notetaker', label: 'Zapisovatel' },
];

const ATTENDANCE = [
  { key: 'invited', label: 'Pozván', color: 'bg-white/[0.06] text-slate-400' },
  { key: 'confirmed', label: 'Potvrzeno', color: 'bg-blue-500/10 text-blue-400' },
  { key: 'present', label: 'Přítomen', color: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'absent', label: 'Nepřítomen', color: 'bg-red-500/10 text-red-400' },
];

export default function MeetingAttendeesTab({ meetingId, profiles, readonly }: Props) {
  const { toast } = useToast();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserId, setAddUserId] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('meeting_attendees')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at');
    setAttendees((data || []) as Attendee[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [meetingId]);

  const getName = (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const getEmail = (id: string) => profiles.find(pr => pr.id === id)?.email || '';

  const handleAdd = async () => {
    if (!addUserId) return;
    if (attendees.some(a => a.user_id === addUserId)) { toast('Již přidán', 'error'); return; }
    const { error } = await supabase.from('meeting_attendees').insert({
      meeting_id: meetingId,
      user_id: addUserId,
      role: 'attendee',
      attendance_status: 'invited',
    });
    if (error) { toast('Chyba', 'error'); return; }
    setAddUserId('');
    load();
  };

  const handleRemove = async (id: string) => {
    await supabase.from('meeting_attendees').delete().eq('id', id);
    load();
  };

  const handleRoleChange = async (id: string, role: string) => {
    await supabase.from('meeting_attendees').update({ role }).eq('id', id);
    setAttendees(prev => prev.map(a => a.id === id ? { ...a, role } : a));
  };

  const handleStatusChange = async (id: string, attendance_status: string) => {
    await supabase.from('meeting_attendees').update({ attendance_status }).eq('id', id);
    setAttendees(prev => prev.map(a => a.id === id ? { ...a, attendance_status } : a));
  };

  const availableProfiles = profiles.filter(p => !attendees.some(a => a.user_id === p.id));

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {attendees.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">Zatím žádní účastníci</div>
      )}

      <div className="space-y-2">
        {attendees.map(att => {
          const attSt = ATTENDANCE.find(a => a.key === att.attendance_status) || ATTENDANCE[0];
          return (
            <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {getName(att.user_id).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{getName(att.user_id)}</div>
                <div className="text-[11px] text-slate-400 truncate">{getEmail(att.user_id)}</div>
              </div>
              <select
                value={att.role}
                onChange={e => handleRoleChange(att.id, e.target.value)}
                disabled={readonly}
                className="text-xs px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              <select
                value={att.attendance_status}
                onChange={e => handleStatusChange(att.id, e.target.value)}
                disabled={readonly}
                className={`text-xs font-semibold px-2 py-1.5 rounded-lg border-0 ${attSt.color} cursor-pointer`}
              >
                {ATTENDANCE.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              {!readonly && (
                <button onClick={() => handleRemove(att.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!readonly && availableProfiles.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={addUserId}
            onChange={e => setAddUserId(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">-- Přidat účastníka --</option>
            {availableProfiles.map(p => <option key={p.id} value={p.id}>{getName(p.id)} ({getEmail(p.id)})</option>)}
          </select>
          <button onClick={handleAdd} disabled={!addUserId} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> Přidat
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-400 pt-2">
        <span>Celkem: {attendees.length}</span>
        <span>Přítomno: {attendees.filter(a => a.attendance_status === 'present').length}</span>
        <span>Potvrzeno: {attendees.filter(a => a.attendance_status === 'confirmed').length}</span>
      </div>
    </div>
  );
}
