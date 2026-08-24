import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import type { CalendarEvent, SpanningEvent, ViewMode } from './calendarTypes';
import { LEGEND_ITEMS, getWeekStart, addDays, dateToStr } from './calendarTypes';
import CalendarMonthView from './CalendarMonthView';
import CalendarWeekView from './CalendarWeekView';
import CalendarDayView from './CalendarDayView';
import CalendarEventModal from './CalendarEventModal';
import CalendarEventDetailPopup from './CalendarEventDetailPopup';
import UnscheduledProjectsPanel from './UnscheduledProjectsPanel';
import CalendarInstallationView from './installation/CalendarInstallationView';
import { useToast } from '../../components/ui/Toast';

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: 'month', label: 'Měsíc' },
  { key: 'week', label: 'Týden' },
  { key: 'day', label: 'Den' },
  { key: 'montaze', label: 'Montáže' },
];

interface ModalState {
  date: string;
  startHour?: number;
  endHour?: number;
}

export default function CalendarPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [spanningEvents, setSpanningEvents] = useState<SpanningEvent[]>([]);
  const [_loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Kalendář' }] });
  }, [setConfig]);

  useEffect(() => {
    (async () => {
      let firstDay: string;
      let lastDay: string;

      if (viewMode === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        firstDay = new Date(year, month, 1).toISOString().split('T')[0];
        lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
      } else if (viewMode === 'week') {
        const ws = getWeekStart(currentDate);
        firstDay = dateToStr(ws);
        lastDay = dateToStr(addDays(ws, 6));
      } else {
        firstDay = dateToStr(currentDate);
        lastDay = firstDay;
      }

      const [tasksRes, milestonesRes, projectsRes, dueItemsRes, vacationsRes, serviceRes, eventsRes, meetingsRes, quickJobsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, due_date, status, assigned_to, project_id').not('due_date', 'is', null).gte('due_date', firstDay).lte('due_date', lastDay),
        supabase.from('project_milestones').select('id, name, start_date, end_date, project_id, color').eq('show_in_calendar', true).or(`start_date.lte.${lastDay},end_date.gte.${firstDay}`),
        supabase.from('projects').select('id, project_name, deadline').not('deadline', 'is', null).gte('deadline', firstDay).lte('deadline', lastDay).neq('status', 'cancelled'),
        supabase.from('due_items').select('id, label, due_date, asset_id').not('due_date', 'is', null).gte('due_date', firstDay).lte('due_date', lastDay).neq('status', 'completed'),
        supabase.from('employee_vacations').select('id, profile_id, start_date, end_date, type').gte('start_date', firstDay).lte('end_date', lastDay),
        supabase.from('service_schedules').select('id, project_id, service_type_id, scheduled_date, scheduled_note').eq('is_active', true).not('scheduled_date', 'is', null).gte('scheduled_date', firstDay).lte('scheduled_date', lastDay),
        supabase.from('events').select('id, title, start_date, end_date, start_time, end_time, all_day, location, event_type_id, project_id, attendees').gte('start_date', firstDay).lte('start_date', lastDay),
        supabase.from('meetings').select('id, title, type, start_date, start_time, end_time, location, project_id, status').neq('status', 'cancelled').gte('start_date', firstDay).lte('start_date', lastDay),
        supabase.from('quick_jobs').select('id, title, scheduled_date, client_name, client_id, claimed_by, address, priority').not('scheduled_date', 'is', null).gte('scheduled_date', firstDay).lte('scheduled_date', lastDay).neq('status', 'done').neq('status', 'cancelled'),
      ]);

      const taskData = tasksRes.data || [];
      const eventData = eventsRes.data || [];
      const profileIdsSet = new Set<string>();
      const projectIdsSet = new Set<string>();

      taskData.forEach((t: any) => {
        if (t.assigned_to) profileIdsSet.add(t.assigned_to);
        if (t.project_id) projectIdsSet.add(t.project_id);
      });
      eventData.forEach((ev: any) => {
        if (ev.project_id) projectIdsSet.add(ev.project_id);
        (ev.attendees || []).forEach((a: string) => profileIdsSet.add(a));
      });
      const meetingData2 = meetingsRes.data || [];
      meetingData2.forEach((m: any) => {
        if (m.project_id) projectIdsSet.add(m.project_id);
      });

      const profileIds = [...profileIdsSet];
      const projectIds = [...projectIdsSet];

      const [profilesRes, allProjectsRes] = await Promise.all([
        profileIds.length > 0 ? supabase.from('profiles').select('id, display_name, email').in('id', profileIds) : Promise.resolve({ data: [] }),
        projectIds.length > 0 ? supabase.from('projects').select('id, project_name').in('id', projectIds) : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.display_name || p.email]));
      const projectMap = new Map((allProjectsRes.data || []).map((p: any) => [p.id, p.project_name]));

      const evts: CalendarEvent[] = [];

      taskData.forEach((t: any) => {
        if (t.due_date) {
          const assigneeName = t.assigned_to ? profileMap.get(t.assigned_to) : undefined;
          const taskProjectName = t.project_id ? projectMap.get(t.project_id) : undefined;
          evts.push({
            id: `task-${t.id}`, date: t.due_date, title: t.title, type: 'task',
            color: t.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700',
            link: '/ukoly',
            assignee: assigneeName,
            project: taskProjectName,
            meta: {
              Stav: t.status === 'done' ? 'Hotovo' : t.status === 'in_progress' ? 'Rozpracovano' : 'K vyrizeni',
              ...(assigneeName ? { Prirazeno: assigneeName } : {}),
              ...(taskProjectName ? { Projekt: taskProjectName } : {}),
            },
          });
        }
      });

      const milestones = milestonesRes.data || [];
      const spans: SpanningEvent[] = [];
      let msProjMap = new Map<string, string>();
      if (milestones.length > 0) {
        const msProjectIds = [...new Set(milestones.map((m: any) => m.project_id).filter(Boolean))];
        if (msProjectIds.length > 0) {
          const { data: msProjects } = await supabase.from('projects').select('id, project_name').in('id', msProjectIds);
          msProjMap = new Map((msProjects || []).map((p: any) => [p.id, p.project_name]));
        }
      }
      milestones.forEach((m: any) => {
        const projName = msProjMap.get(m.project_id) || '';
        const displayTitle = projName ? `${m.name} — ${projName}` : m.name;
        spans.push({
          id: `ms-${m.id}`,
          title: displayTitle,
          startDate: m.start_date < firstDay ? firstDay : m.start_date,
          endDate: m.end_date > lastDay ? lastDay : m.end_date,
          color: m.color || '#f59e0b',
          accentColor: m.color || '#f59e0b',
          link: `/projekty/${m.project_id}`,
          meta: {
            ...(projName ? { Projekt: projName } : {}),
            Od: new Date(m.start_date).toLocaleDateString('cs-CZ'),
            Do: new Date(m.end_date).toLocaleDateString('cs-CZ'),
          },
        });
      });

      (projectsRes.data || []).forEach((p: any) => {
        if (p.deadline) evts.push({
          id: `proj-${p.id}`, date: p.deadline, title: p.project_name, type: 'deadline',
          color: 'bg-red-100 text-red-700', link: `/projekty/${p.id}`,
          meta: { Termin: new Date(p.deadline).toLocaleDateString('cs-CZ') },
        });
      });

      (dueItemsRes.data || []).forEach((d: any) => {
        if (d.due_date) evts.push({
          id: `due-${d.id}`, date: d.due_date, title: d.label, type: 'due_item',
          color: 'bg-orange-100 text-orange-700', link: `/majetek/${d.asset_id}`,
        });
      });

      (vacationsRes.data || []).forEach((v: any) => {
        const start = new Date(v.start_date);
        const end = new Date(v.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          if (ds >= firstDay && ds <= lastDay) {
            evts.push({
              id: `vac-${v.id}-${ds}`, date: ds,
              title: v.type === 'vacation' ? 'Dovolena' : v.type === 'sick' ? 'Nemoc' : 'Osobni',
              type: 'vacation', color: 'bg-teal-100 text-teal-700',
            });
          }
        }
      });

      const serviceSchedules = serviceRes.data || [];
      if (serviceSchedules.length > 0) {
        const sProjectIds = [...new Set(serviceSchedules.map((s: any) => s.project_id))];
        const sTypeIds = [...new Set(serviceSchedules.map((s: any) => s.service_type_id))];
        const [sProjRes, sTypeRes] = await Promise.all([
          supabase.from('projects').select('id, project_name').in('id', sProjectIds),
          supabase.from('service_types').select('id, name').in('id', sTypeIds),
        ]);
        const sProjMap = new Map((sProjRes.data || []).map((p: any) => [p.id, p.project_name]));
        const sTypeMap = new Map((sTypeRes.data || []).map((t: any) => [t.id, t.name]));

        serviceSchedules.forEach((s: any) => {
          const typeName = sTypeMap.get(s.service_type_id) || 'Servis';
          const projName = sProjMap.get(s.project_id) || '';
          evts.push({
            id: `svc-${s.id}`,
            date: s.scheduled_date,
            title: `${typeName} - ${projName}`,
            type: 'service',
            color: 'bg-cyan-100 text-cyan-700',
            link: `/projekty/${s.project_id}`,
            meta: {
              Projekt: projName,
              Typ: typeName,
              ...(s.scheduled_note ? { Poznamka: s.scheduled_note } : {}),
            },
          });
        });
      }

      eventData.forEach((ev: any) => {
        const start = new Date(ev.start_date);
        const end = ev.end_date ? new Date(ev.end_date) : start;
        const timeLabel = ev.all_day ? 'Cely den' : ev.start_time ? ev.start_time.slice(0, 5) : '';
        let sHour: number | undefined;
        let eHour: number | undefined;
        if (!ev.all_day && ev.start_time) {
          const parts = ev.start_time.split(':');
          sHour = parseInt(parts[0], 10);
          eHour = ev.end_time ? parseInt(ev.end_time.split(':')[0], 10) : sHour + 1;
          if (eHour <= sHour) eHour = sHour + 1;
        }
        const evProjectName = ev.project_id ? projectMap.get(ev.project_id) : undefined;
        const attendeeNames = (ev.attendees || []).map((a: string) => profileMap.get(a)).filter(Boolean) as string[];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          if (ds >= firstDay && ds <= lastDay) {
            evts.push({
              id: `ev-${ev.id}-${ds}`,
              date: ds,
              title: ev.title,
              type: 'event',
              color: 'bg-rose-100 text-rose-700',
              link: '/udalosti',
              startHour: sHour,
              endHour: eHour,
              assignee: attendeeNames.length > 0 ? attendeeNames.join(', ') : undefined,
              project: evProjectName,
              meta: {
                ...(timeLabel ? { Cas: timeLabel } : {}),
                ...(ev.location ? { Misto: ev.location } : {}),
                ...(attendeeNames.length > 0 ? { Ucastnici: attendeeNames.join(', ') } : {}),
                ...(evProjectName ? { Projekt: evProjectName } : {}),
              },
            });
          }
        }
      });

      const meetingData = meetingsRes.data || [];
      meetingData.forEach((m: any) => {
        let sHour: number | undefined;
        let eHour: number | undefined;
        if (m.start_time) {
          sHour = parseInt(m.start_time.split(':')[0], 10);
          eHour = m.end_time ? parseInt(m.end_time.split(':')[0], 10) : sHour + 1;
          if (eHour <= sHour) eHour = sHour + 1;
        }
        const mProjectName = m.project_id ? projectMap.get(m.project_id) : undefined;
        evts.push({
          id: `mtg-${m.id}`,
          date: m.start_date,
          title: m.title,
          type: 'meeting',
          color: m.type === 'schuzka' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700',
          link: `/porady/${m.id}`,
          startHour: sHour,
          endHour: eHour,
          project: mProjectName,
          meta: {
            Typ: m.type === 'schuzka' ? 'Schuzka' : 'Porada',
            ...(m.start_time ? { Cas: `${m.start_time.slice(0, 5)}${m.end_time ? ' - ' + m.end_time.slice(0, 5) : ''}` } : {}),
            ...(m.location ? { Misto: m.location } : {}),
            ...(mProjectName ? { Projekt: mProjectName } : {}),
          },
        });
      });

      const quickJobsData = quickJobsRes.data || [];
      if (quickJobsData.length > 0) {
        const qjClientIds = [...new Set(quickJobsData.filter((q: any) => q.client_id).map((q: any) => q.client_id))];
        const qjClaimedIds = [...new Set(quickJobsData.filter((q: any) => q.claimed_by).map((q: any) => q.claimed_by))];
        const [qjClientRes, qjProfileRes] = await Promise.all([
          qjClientIds.length > 0 ? supabase.from('clients').select('id, name').in('id', qjClientIds) : Promise.resolve({ data: [] }),
          qjClaimedIds.length > 0 ? supabase.from('profiles').select('id, display_name, email').in('id', qjClaimedIds) : Promise.resolve({ data: [] }),
        ]);
        const qjClientMap = new Map((qjClientRes.data || []).map((c: any) => [c.id, c.name]));
        const qjProfileMap = new Map((qjProfileRes.data || []).map((p: any) => [p.id, p.display_name || p.email]));

        quickJobsData.forEach((q: any) => {
          const clientDisplay = q.client_id ? qjClientMap.get(q.client_id) || q.client_name : q.client_name || '';
          const assigneeName = q.claimed_by ? qjProfileMap.get(q.claimed_by) : undefined;
          evts.push({
            id: `qj-${q.id}`,
            date: q.scheduled_date,
            title: `${q.title}${clientDisplay ? ' — ' + clientDisplay : ''}`,
            type: 'quick_job',
            color: 'bg-amber-100 text-amber-700',
            link: '/rychle-zakazky',
            assignee: assigneeName,
            meta: {
              ...(clientDisplay ? { Klient: clientDisplay } : {}),
              ...(q.address ? { Adresa: q.address } : {}),
              ...(assigneeName ? { Technik: assigneeName } : {}),
            },
          });
        });
      }

      setEvents(evts);
      setSpanningEvents(spans);
      setLoading(false);
    })();
  }, [currentDate, viewMode, refreshKey]);

  const handleProjectDrop = useCallback(async (projectId: string, date: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ montaz_start_date: date, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) {
      toast('Chyba při ukládání termínu', 'error');
      return;
    }

    const { data: milestones } = await supabase
      .from('project_milestones')
      .select('id, offset_days, duration_days')
      .eq('project_id', projectId);
    if (milestones && milestones.length > 0) {
      for (const ms of milestones) {
        const start = new Date(date);
        start.setDate(start.getDate() + (ms.offset_days || 0));
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(0, (ms.duration_days || 1) - 1));
        await supabase.from('project_milestones').update({
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        }).eq('id', ms.id);
      }
    }

    toast('Termín zahájení nastaven');
    setRefreshKey(k => k + 1);
    setPanelRefreshKey(k => k + 1);
  }, [toast]);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
      else if (viewMode === 'week' || viewMode === 'montaze') d.setDate(d.getDate() + 7 * dir);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const goToday = () => setCurrentDate(new Date());

  const handleDayClick = useCallback((dateStr: string) => {
    setModal({ date: dateStr });
  }, []);

  const handleDragCreate = useCallback((dateStr: string, startHour: number, endHour: number) => {
    setModal({ date: dateStr, startHour, endHour });
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setDetailEvent(event);
  }, []);

  const headerLabel = (() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week' || viewMode === 'montaze') {
      const ws = getWeekStart(currentDate);
      const we = addDays(ws, 6);
      return `${ws.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} - ${we.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <div className="space-y-6">
      <div data-tour="calendar-main" className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden relative">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-white min-w-[220px] text-center capitalize">
              {headerLabel}
            </h2>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={goToday} className="text-xs font-semibold text-slate-300 bg-white/[0.07] border border-white/10 hover:bg-white/[0.12] px-3 py-1.5 rounded-lg ml-2 transition">Dnes</button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div data-tour="calendar-views" className="flex items-center bg-white/[0.07] rounded-lg p-0.5">
              {VIEW_OPTIONS.map(v => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === v.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 border border-white/10 hover:bg-white/[0.12]'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {viewMode !== 'montaze' && (
              <>
                <div className="h-5 w-px bg-white/10" />
                <div className="flex items-center gap-2 flex-wrap">
                  {LEGEND_ITEMS.map(l => (
                    <span key={l.type} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${l.color}`}>{l.label}</span>
                  ))}
                </div>
              </>
            )}
            {viewMode === 'montaze' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Montáže</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] text-slate-500">Servis</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-500">Revize</span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {viewMode === 'month' && (
          <CalendarMonthView currentDate={currentDate} events={events} spanningEvents={spanningEvents} onDayClick={handleDayClick} onEventClick={handleEventClick} onProjectDrop={handleProjectDrop} />
        )}
        {viewMode === 'week' && (
          <CalendarWeekView currentDate={currentDate} events={events} onDayClick={handleDayClick} onDragCreate={handleDragCreate} onEventClick={handleEventClick} />
        )}
        {viewMode === 'day' && (
          <CalendarDayView currentDate={currentDate} events={events} onDayClick={handleDayClick} onDragCreate={handleDragCreate} onEventClick={handleEventClick} />
        )}
        {viewMode === 'montaze' && (
          <CalendarInstallationView currentDate={currentDate} />
        )}

        {viewMode !== 'montaze' && (
          <UnscheduledProjectsPanel
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
            onProjectDrop={handleProjectDrop}
            refreshKey={panelRefreshKey}
          />
        )}
      </div>

      {modal && (
        <CalendarEventModal
          open={!!modal}
          onClose={() => setModal(null)}
          initialDate={modal.date}
          initialStartHour={modal.startHour}
          initialEndHour={modal.endHour}
          onCreated={() => setRefreshKey(k => k + 1)}
        />
      )}

      {detailEvent && (
        <CalendarEventDetailPopup
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </div>
  );
}
