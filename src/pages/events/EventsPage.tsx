import { useEffect, useState } from 'react';
import {
  CalendarDays, Plus, MapPin, Clock, Users as UsersIcon,
  Filter, Search, Pencil, Trash2, FolderKanban, ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import EventFormModal from './EventFormModal';

interface EventType {
  id: string;
  name: string;
  color: string;
}

interface EventRow {
  id: string;
  title: string;
  description: string;
  event_type_id: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string;
  end_time: string | null;
  all_day: boolean;
  location: string;
  project_id: string | null;
  created_by: string | null;
  attendees: string[];
  reminder_minutes: number | null;
  notes: string;
  created_at: string;
}

interface ProfileRef {
  id: string;
  display_name: string | null;
  email: string;
}

interface ProjectRef {
  id: string;
  project_name: string;
}

export default function EventsPage() {
  const { setConfig } = useHeader();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [profiles, setProfiles] = useState<ProfileRef[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);

  useEffect(() => { setConfig({ breadcrumbs: [{ label: 'Události' }] }); }, [setConfig]);

  const load = async () => {
    const today = new Date().toISOString().split('T')[0];
    let q = supabase.from('events').select('*').order('start_date', { ascending: true });
    if (!showPast) q = q.gte('start_date', today);

    const [evRes, etRes, profRes, projRes] = await Promise.all([
      q,
      supabase.from('event_types').select('id, name, color').eq('is_active', true).order('sort_order'),
      supabase.from('profiles').select('id, display_name, email'),
      supabase.from('projects').select('id, project_name'),
    ]);
    setEvents((evRes.data || []) as EventRow[]);
    setEventTypes((etRes.data || []) as EventType[]);
    setProfiles((profRes.data || []) as ProfileRef[]);
    setProjects((projRes.data || []) as ProjectRef[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [showPast]);

  const getTypeName = (id: string | null) => eventTypes.find(t => t.id === id)?.name || '';
  const getTypeColor = (id: string | null) => eventTypes.find(t => t.id === id)?.color || 'bg-slate-100 text-slate-600';
  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };
  const getProjectName = (id: string | null) => projects.find(p => p.id === id)?.project_name || '';

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tuto událost?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Událost smazána');
    load();
  };

  const handleEdit = (ev: EventRow) => {
    setEditEvent({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      event_type_id: ev.event_type_id || '',
      start_date: ev.start_date,
      start_time: ev.start_time || '09:00',
      end_date: ev.end_date,
      end_time: ev.end_time || '10:00',
      all_day: ev.all_day,
      location: ev.location,
      project_id: ev.project_id || '',
      attendees: ev.attendees || [],
      reminder_minutes: ev.reminder_minutes,
      notes: ev.notes,
    });
    setShowModal(true);
  };

  const filtered = events.filter(ev => {
    if (filterType && ev.event_type_id !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return ev.title.toLowerCase().includes(s) || ev.location.toLowerCase().includes(s) || ev.description.toLowerCase().includes(s);
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, EventRow[]>>((acc, ev) => {
    const key = ev.start_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const isToday = (d: string) => d === new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-navy-700/50 rounded-2xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat události..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div className="relative">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">Všechny typy</option>
              {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-blue-600 focus:ring-blue-500/50" />
            <span className="text-sm text-slate-400">Zobrazit minulé</span>
          </label>
        </div>
        <button onClick={() => { setEditEvent(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Nová událost
        </button>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-16 text-center">
          <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">Žádné události</h3>
          <p className="text-sm text-slate-500 mb-4">Vytvořte první událost pro váš tým</p>
          <button onClick={() => { setEditEvent(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Nová událost
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${isToday(date) ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-slate-600'}`} />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isToday(date) ? 'text-blue-400' : 'text-slate-500'}`}>
                  {isToday(date) && <span className="text-blue-400 mr-2">Dnes</span>}
                  {formatDate(date)}
                </h3>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-2 ml-5">
                {grouped[date].map(ev => (
                  <div key={ev.id} className="group bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4 hover:shadow-md hover:shadow-black/20 transition-all duration-200">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-0.5">
                        {ev.all_day ? (
                          <div className="w-16 text-center">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Celý den</div>
                          </div>
                        ) : (
                          <div className="w-16 text-center">
                            <div className="text-sm font-bold text-white">{ev.start_time?.slice(0, 5)}</div>
                            {ev.end_time && <div className="text-[10px] text-slate-500">{ev.end_time.slice(0, 5)}</div>}
                          </div>
                        )}
                      </div>
                      <div className={`w-1 self-stretch rounded-full shrink-0 ${getTypeColor(ev.event_type_id).split(' ')[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-sm font-semibold text-white">{ev.title}</h4>
                          {ev.event_type_id && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getTypeColor(ev.event_type_id)}`}>
                              {getTypeName(ev.event_type_id)}
                            </span>
                          )}
                          {ev.reminder_minutes != null && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {ev.reminder_minutes >= 1440 ? `${ev.reminder_minutes / 1440}d` : `${ev.reminder_minutes}m`} předem
                            </span>
                          )}
                        </div>
                        {ev.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{ev.description}</p>}
                        <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-500">
                          {ev.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.location}</span>
                          )}
                          {ev.project_id && (
                            <Link to={`/projekty/${ev.project_id}`} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition">
                              <FolderKanban className="w-3 h-3" /> {getProjectName(ev.project_id)}
                            </Link>
                          )}
                          {ev.attendees && ev.attendees.length > 0 && (
                            <span className="flex items-center gap-1">
                              <UsersIcon className="w-3 h-3" /> {ev.attendees.map(a => getProfileName(a)).filter(Boolean).join(', ') || `${ev.attendees.length} účastníků`}
                            </span>
                          )}
                          {ev.start_date !== ev.end_date && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> do {new Date(ev.end_date + 'T00:00:00').toLocaleDateString('cs-CZ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button onClick={() => handleEdit(ev)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-slate-300 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {(ev.created_by === user?.id || isAdmin) && (
                          <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EventFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditEvent(null); }}
        onSaved={load}
        editData={editEvent}
      />
    </div>
  );
}
