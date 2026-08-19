import { useState, useEffect } from 'react';
import { Plus, Clock, MapPin, Users as UsersIcon, MessageSquare, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import MeetingFormModal from '../../pages/meetings/MeetingFormModal';

interface MeetingRow {
  id: string;
  title: string;
  type: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  location: string;
  client_id: string | null;
}

interface Props {
  projectId: string;
  clientId?: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: 'Plánováno', color: 'bg-white/[0.06] text-slate-400' },
  in_progress: { label: 'Probíhá', color: 'bg-blue-500/10 text-blue-400' },
  completed: { label: 'Dokončeno', color: 'bg-emerald-500/10 text-emerald-400' },
  cancelled: { label: 'Zrušeno', color: 'bg-red-500/10 text-red-400' },
};

export default function ProjectMeetingsTab({ projectId, clientId }: Props) {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('meetings')
      .select('id, title, type, start_date, start_time, end_time, status, location, client_id')
      .eq('project_id', projectId)
      .order('start_date', { ascending: false });
    const rows = (data || []) as MeetingRow[];
    setMeetings(rows);

    if (rows.length > 0) {
      const ids = rows.map(m => m.id);
      const { data: atts } = await supabase.from('meeting_attendees').select('meeting_id').in('meeting_id', ids);
      const counts: Record<string, number> = {};
      (atts || []).forEach((a: any) => { counts[a.meeting_id] = (counts[a.meeting_id] || 0) + 1; });
      setAttendeeCounts(counts);

      const clientIds = [...new Set(rows.filter(m => m.client_id).map(m => m.client_id!))];
      if (clientIds.length > 0) {
        const { data: cliData } = await supabase.from('clients').select('id, name').in('id', clientIds);
        const cliMap: Record<string, string> = {};
        (cliData || []).forEach((c: any) => { cliMap[c.id] = c.name; });
        setClients(cliMap);
      }
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300">Schůzky a porady ({meetings.length})</h3>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
          <Plus className="w-3.5 h-3.5" /> Nová schůzka
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-3">Žádné schůzky ani porady</p>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            <Plus className="w-3.5 h-3.5" /> Naplánovat
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
            return (
              <Link key={m.id} to={`/porady/${m.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition group">
                <div className={`w-1 self-stretch rounded-full ${m.type === 'schuzka' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-white truncate">{m.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(m.start_date + 'T00:00:00').toLocaleDateString('cs-CZ')}
                      {m.start_time && ` ${m.start_time.slice(0, 5)}`}
                    </span>
                    {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.location}</span>}
                    {m.client_id && clients[m.client_id] && (
                      <span className="flex items-center gap-1 text-emerald-500"><User className="w-3 h-3" /> {clients[m.client_id]}</span>
                    )}
                    {(attendeeCounts[m.id] || 0) > 0 && (
                      <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {attendeeCounts[m.id]}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <MeetingFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={load}
        prefillProjectId={projectId}
        prefillClientId={clientId || undefined}
      />
    </div>
  );
}
