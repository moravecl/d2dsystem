import { useEffect, useState } from 'react';
import {
  Plus, Search, Filter, ChevronDown, MapPin, Clock, Users as UsersIcon,
  FolderKanban, MessageSquare, CalendarDays, User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import MeetingFormModal from './MeetingFormModal';

interface MeetingRow {
  id: string;
  title: string;
  type: string;
  description: string;
  location: string;
  start_date: string;
  start_time: string | null;
  end_date: string;
  end_time: string | null;
  status: string;
  project_id: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
}

interface ProfileRef { id: string; display_name: string | null; email: string; }
interface ProjectRef { id: string; project_name: string; }
interface ClientRef { id: string; name: string; }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: 'Plánováno', color: 'bg-white/[0.06] text-slate-400' },
  in_progress: { label: 'Probíhá', color: 'bg-blue-500/10 text-blue-400' },
  completed: { label: 'Dokončeno', color: 'bg-emerald-500/10 text-emerald-400' },
  cancelled: { label: 'Zrušeno', color: 'bg-red-500/10 text-red-400' },
};

export default function MeetingsPage() {
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [actionCounts, setActionCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [profiles, setProfiles] = useState<ProfileRef[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeType, setActiveType] = useState<'porada' | 'schuzka'>('porada');
  const [showPast, setShowPast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => { setConfig({ breadcrumbs: [{ label: 'Porady a schůzky' }] }); }, [setConfig]);

  const load = async () => {
    const today = new Date().toISOString().split('T')[0];
    let q = supabase.from('meetings').select('*').order('start_date', { ascending: true });
    if (!showPast) q = q.gte('start_date', today);

    const [meetRes, profRes, projRes, cliRes] = await Promise.all([
      q,
      supabase.from('profiles').select('id, display_name, email'),
      supabase.from('projects').select('id, project_name'),
      supabase.from('clients').select('id, name'),
    ]);

    const rows = (meetRes.data || []) as MeetingRow[];
    setMeetings(rows);
    setProfiles((profRes.data || []) as ProfileRef[]);
    setProjects((projRes.data || []) as ProjectRef[]);
    setClients((cliRes.data || []) as ClientRef[]);

    if (rows.length > 0) {
      const ids = rows.map(m => m.id);
      const [attRes, actRes] = await Promise.all([
        supabase.from('meeting_attendees').select('meeting_id').in('meeting_id', ids),
        supabase.from('meeting_action_items').select('meeting_id, status').in('meeting_id', ids),
      ]);
      const attCounts: Record<string, number> = {};
      (attRes.data || []).forEach((a: any) => { attCounts[a.meeting_id] = (attCounts[a.meeting_id] || 0) + 1; });
      setAttendeeCounts(attCounts);
      const actCounts: Record<string, { total: number; done: number }> = {};
      (actRes.data || []).forEach((a: any) => {
        if (!actCounts[a.meeting_id]) actCounts[a.meeting_id] = { total: 0, done: 0 };
        actCounts[a.meeting_id].total++;
        if (a.status === 'completed') actCounts[a.meeting_id].done++;
      });
      setActionCounts(actCounts);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [showPast]);

  const getProjectName = (id: string | null) => projects.find(p => p.id === id)?.project_name || '';
  const getClientName = (id: string | null) => clients.find(c => c.id === id)?.name || '';

  const filtered = meetings.filter(m => {
    if (m.type !== activeType) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return m.title.toLowerCase().includes(s) || m.location.toLowerCase().includes(s) || m.description.toLowerCase().includes(s);
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, MeetingRow[]>>((acc, m) => {
    const key = m.start_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();
  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isToday = (d: string) => d === new Date().toISOString().split('T')[0];

  const handleEdit = async (m: MeetingRow) => {
    const { data: atts } = await supabase.from('meeting_attendees').select('user_id').eq('meeting_id', m.id);
    setEditData({
      id: m.id,
      title: m.title,
      type: m.type,
      description: m.description,
      location: m.location,
      start_date: m.start_date,
      start_time: m.start_time || '09:00',
      end_date: m.end_date,
      end_time: m.end_time || '10:00',
      project_id: m.project_id || '',
      client_id: m.client_id || '',
      attendees: (atts?.data || atts || []).map((a: any) => a.user_id),
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveType('porada')}
          className={`relative px-4 py-2.5 text-sm font-semibold transition ${
            activeType === 'porada' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Porady
          {activeType === 'porada' && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveType('schuzka')}
          className={`relative px-4 py-2.5 text-sm font-semibold transition ${
            activeType === 'schuzka' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Schůzky s klientem
          {activeType === 'schuzka' && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-full" />}
        </button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]">
              <option value="">Všechny stavy</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20" />
            <span className="text-sm text-slate-400">Minulé</span>
          </label>
        </div>
        <button onClick={() => { setEditData(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> {activeType === 'porada' ? 'Nová porada' : 'Nová schůzka'}
        </button>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-16 text-center">
          <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">
            {activeType === 'porada' ? 'Žádné porady' : 'Žádné schůzky'}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {activeType === 'porada' ? 'Vytvořte první interní poradu' : 'Naplánujte schůzku s klientem'}
          </p>
          <button onClick={() => { setEditData(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> {activeType === 'porada' ? 'Nová porada' : 'Nová schůzka'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${isToday(date) ? 'bg-blue-500/100 ring-4 ring-blue-100' : 'bg-slate-300'}`} />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isToday(date) ? 'text-blue-400' : 'text-slate-500'}`}>
                  {isToday(date) && <span className="text-blue-400 mr-2">Dnes</span>}
                  {formatDate(date)}
                </h3>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-2 ml-5">
                {grouped[date].map(m => {
                  const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
                  const ac = actionCounts[m.id];
                  return (
                    <Link
                      key={m.id}
                      to={`/porady/${m.id}`}
                      className="group block bg-navy-800/60 rounded-xl border border-white/[0.08]/60 p-4  hover:shadow-slate-100 transition-all duration-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-0.5 w-16 text-center">
                          <div className="text-sm font-bold text-white">{m.start_time?.slice(0, 5) || '--:--'}</div>
                          {m.end_time && <div className="text-[10px] text-slate-400">{m.end_time.slice(0, 5)}</div>}
                        </div>
                        <div className={`w-1 self-stretch rounded-full shrink-0 ${m.type === 'schuzka' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="text-sm font-semibold text-white">{m.title}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          </div>
                          {m.description && <p className="text-xs text-slate-500 mb-2 line-clamp-1">{m.description}</p>}
                          <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-400">
                            {m.location && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.location}</span>
                            )}
                            {m.project_id && (
                              <span className="flex items-center gap-1 text-blue-500">
                                <FolderKanban className="w-3 h-3" /> {getProjectName(m.project_id)}
                              </span>
                            )}
                            {m.client_id && (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <User className="w-3 h-3" /> {getClientName(m.client_id)}
                              </span>
                            )}
                            {(attendeeCounts[m.id] || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <UsersIcon className="w-3 h-3" /> {attendeeCounts[m.id]}
                              </span>
                            )}
                            {ac && ac.total > 0 && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" /> {ac.done}/{ac.total} úkolů
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <MeetingFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditData(null); }}
        onSaved={load}
        editData={editData}
      />
    </div>
  );
}
