import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Square, Pencil, Trash2, FileDown, MapPin, Clock,
  FolderKanban, User, Users as UsersIcon, ArrowLeft,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import Tabs from '../../components/ui/Tabs';
import MeetingAgendaTab from '../../components/meetings/MeetingAgendaTab';
import MeetingMinutesTab from '../../components/meetings/MeetingMinutesTab';
import MeetingActionItemsTab from '../../components/meetings/MeetingActionItemsTab';
import MeetingAttendeesTab from '../../components/meetings/MeetingAttendeesTab';
import MeetingFormModal from './MeetingFormModal';
import { exportMeetingPdf } from './meetingPdfExport';
import { useActiveMeeting } from '../../contexts/ActiveMeetingContext';

interface MeetingData {
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
  planned: { label: 'Plánováno', color: 'bg-white/[0.06] text-slate-300' },
  in_progress: { label: 'Probíhá', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Dokončeno', color: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Zrušeno', color: 'bg-red-500/20 text-red-400' },
};

const TABS = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'minutes', label: 'Zápis' },
  { key: 'actions', label: 'Úkoly' },
  { key: 'attendees', label: 'Účastníci' },
];

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setConfig } = useHeader();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const activeMeeting = useActiveMeeting();

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [profiles, setProfiles] = useState<ProfileRef[]>([]);
  const [project, setProject] = useState<ProjectRef | null>(null);
  const [client, setClient] = useState<ClientRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agenda');
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    const [meetRes, profRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).maybeSingle(),
      supabase.from('profiles').select('id, display_name, email'),
    ]);
    const m = meetRes.data as MeetingData | null;
    setMeeting(m);
    setProfiles((profRes.data || []) as ProfileRef[]);

    if (m?.project_id) {
      const { data: p } = await supabase.from('projects').select('id, project_name').eq('id', m.project_id).maybeSingle();
      setProject(p as ProjectRef | null);
    }
    if (m?.client_id) {
      const { data: c } = await supabase.from('clients').select('id, name').eq('id', m.client_id).maybeSingle();
      setClient(c as ClientRef | null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Porady', href: '/porady' },
        { label: meeting?.title || '...' },
      ],
    });
  }, [setConfig, meeting]);

  const getName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    const { error } = await supabase.from('meetings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast('Chyba', 'error'); return; }
    if (status === 'in_progress' && meeting) {
      activeMeeting.startMeeting(id, meeting.title);
    } else if (status === 'completed' || status === 'cancelled') {
      if (activeMeeting.meetingId === id) activeMeeting.stopMeeting();
    }
    toast(status === 'in_progress' ? 'Porada zahájena' : status === 'completed' ? 'Porada ukončena' : 'Stav změněn');
    loadData();
  };

  const handleDelete = async () => {
    if (!id || !confirm('Opravdu smazat tuto poradu?')) return;
    if (activeMeeting.meetingId === id) activeMeeting.stopMeeting();
    await supabase.from('meetings').delete().eq('id', id);
    toast('Porada smazána');
    navigate('/porady');
  };

  const handleEdit = async () => {
    if (!meeting) return;
    const { data: atts } = await supabase.from('meeting_attendees').select('user_id').eq('meeting_id', meeting.id);
    setEditData({
      id: meeting.id,
      title: meeting.title,
      type: meeting.type,
      description: meeting.description,
      location: meeting.location,
      start_date: meeting.start_date,
      start_time: meeting.start_time || '09:00',
      end_date: meeting.end_date,
      end_time: meeting.end_time || '10:00',
      project_id: meeting.project_id || '',
      client_id: meeting.client_id || '',
      attendees: (atts || []).map((a: any) => a.user_id),
    });
    setShowEdit(true);
  };

  const handleExportPdf = async () => {
    if (!meeting) return;
    const [agendaRes, minutesRes, actionRes, attendeesRes] = await Promise.all([
      supabase.from('meeting_agenda_items').select('*').eq('meeting_id', meeting.id).order('sort_order'),
      supabase.from('meeting_minutes').select('*').eq('meeting_id', meeting.id).maybeSingle(),
      supabase.from('meeting_action_items').select('*').eq('meeting_id', meeting.id).order('created_at'),
      supabase.from('meeting_attendees').select('*').eq('meeting_id', meeting.id),
    ]);
    exportMeetingPdf({
      meeting,
      agendaItems: agendaRes.data || [],
      minutes: minutesRes.data || null,
      actionItems: actionRes.data || [],
      attendees: attendeesRes.data || [],
      projectName: project?.project_name || '',
      clientName: client?.name || '',
      getProfileName: getName,
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08]/80 animate-skeleton" />
        <div className="h-72 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08]/80 animate-skeleton" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 text-slate-200">404</div>
        <p className="text-slate-400">Porada nenalezena</p>
      </div>
    );
  }

  const st = STATUS_MAP[meeting.status] || STATUS_MAP.planned;
  const isReadonly = meeting.status === 'cancelled';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <Link to="/porady" className="p-2 rounded-lg hover:bg-white/[0.06] transition mt-0.5 shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-xl font-bold text-white">{meeting.title}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meeting.type === 'schuzka' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {meeting.type === 'schuzka' ? 'Schůzka' : 'Porada'}
              </span>
            </div>

            <div className="flex items-center gap-5 flex-wrap text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                {new Date(meeting.start_date + 'T00:00:00').toLocaleDateString('cs-CZ')}
                {meeting.start_time && ` ${meeting.start_time.slice(0, 5)}`}
                {meeting.end_time && ` - ${meeting.end_time.slice(0, 5)}`}
              </span>
              {meeting.location && (
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {meeting.location}</span>
              )}
              {project && (
                <Link to={`/projekty/${project.id}`} className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400 transition">
                  <FolderKanban className="w-4 h-4" /> {project.project_name}
                </Link>
              )}
              {client && (
                <Link to={`/crm/${client.id}`} className="flex items-center gap-1.5 text-emerald-500 hover:text-emerald-400 transition">
                  <User className="w-4 h-4" /> {client.name}
                </Link>
              )}
            </div>
            {meeting.description && <p className="text-sm text-slate-500 mt-2">{meeting.description}</p>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {meeting.status === 'planned' && (
              <button onClick={() => handleStatusChange('in_progress')} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
                <Play className="w-4 h-4" /> Zahájit
              </button>
            )}
            {meeting.status === 'in_progress' && (
              <button onClick={() => handleStatusChange('completed')} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
                <Square className="w-4 h-4" /> Ukončit
              </button>
            )}
            <button onClick={handleEdit} className="p-2 rounded-xl hover:bg-white/[0.06] text-slate-500 transition" title="Upravit">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleExportPdf} className="p-2 rounded-xl hover:bg-white/[0.06] text-slate-500 transition" title="Export PDF">
              <FileDown className="w-4 h-4" />
            </button>
            {(meeting.created_by === user?.id || isAdmin) && (
              <button onClick={handleDelete} className="p-2 rounded-xl hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition" title="Smazat">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08]">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'agenda' && (
            <MeetingAgendaTab meetingId={meeting.id} profiles={profiles} readonly={isReadonly} />
          )}
          {activeTab === 'minutes' && (
            <MeetingMinutesTab
              meetingId={meeting.id}
              meetingStatus={meeting.status}
              startTime={meeting.start_time}
              endTime={meeting.end_time}
              profiles={profiles}
            />
          )}
          {activeTab === 'actions' && (
            <MeetingActionItemsTab meetingId={meeting.id} projectId={meeting.project_id} profiles={profiles} readonly={isReadonly} />
          )}
          {activeTab === 'attendees' && (
            <MeetingAttendeesTab meetingId={meeting.id} profiles={profiles} readonly={isReadonly} />
          )}
        </div>
      </div>

      <MeetingFormModal
        open={showEdit}
        onClose={() => { setShowEdit(false); setEditData(null); }}
        onSaved={loadData}
        editData={editData}
      />
    </div>
  );
}
