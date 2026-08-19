import { useState, useEffect } from 'react';
import { Plus, Clock, MapPin, FolderKanban, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import MeetingFormModal from '../../pages/meetings/MeetingFormModal';

interface MeetingRow {
  id: string;
  title: string;
  type: string;
  start_date: string;
  start_time: string | null;
  status: string;
  location: string;
  project_id: string | null;
}

interface Props {
  clientId: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: 'Plánováno', color: 'bg-white/[0.06] text-slate-400' },
  in_progress: { label: 'Probíhá', color: 'bg-blue-500/10 text-blue-400' },
  completed: { label: 'Dokončeno', color: 'bg-emerald-500/10 text-emerald-400' },
  cancelled: { label: 'Zrušeno', color: 'bg-red-500/10 text-red-400' },
};

export default function ClientMeetingsSection({ clientId }: Props) {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('meetings')
      .select('id, title, type, start_date, start_time, status, location, project_id')
      .eq('client_id', clientId)
      .order('start_date', { ascending: false });
    const rows = (data || []) as MeetingRow[];
    setMeetings(rows);

    const projIds = [...new Set(rows.filter(m => m.project_id).map(m => m.project_id!))];
    if (projIds.length > 0) {
      const { data: projData } = await supabase.from('projects').select('id, project_name').in('id', projIds);
      const projMap: Record<string, string> = {};
      (projData || []).forEach((p: any) => { projMap[p.id] = p.project_name; });
      setProjects(projMap);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  if (loading) {
    return <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300">Schůzky ({meetings.length})</h3>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
          <Plus className="w-3.5 h-3.5" /> Nová schůzka
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Žádné schůzky s tímto klientem</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
            return (
              <Link key={m.id} to={`/porady/${m.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover: hover:bg-white/[0.06] transition">
                <div className="w-1 self-stretch rounded-full bg-emerald-400" />
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
                    {m.project_id && projects[m.project_id] && (
                      <span className="flex items-center gap-1 text-blue-500"><FolderKanban className="w-3 h-3" /> {projects[m.project_id]}</span>
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
        prefillClientId={clientId}
      />
    </div>
  );
}
