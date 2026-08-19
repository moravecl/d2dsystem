import { useState, useEffect } from 'react';
import { CheckSquare, CalendarDays, Search } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

type EntryType = 'task' | 'event';

interface SelectOption {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  initialStartHour?: number;
  initialEndHour?: number;
  onCreated: () => void;
}

export default function CalendarEventModal({ open, onClose, initialDate, initialStartHour, initialEndHour, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entryType, setEntryType] = useState<EntryType>('task');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState('todo');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [eventTypes, setEventTypes] = useState<SelectOption[]>([]);
  const [eventTypeId, setEventTypeId] = useState('');
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [profiles, setProfiles] = useState<SelectOption[]>([]);
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);

  const [projectSearch, setProjectSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    setDueDate(initialDate);
    const hasTime = initialStartHour !== undefined;
    setAllDay(!hasTime);
    if (hasTime) {
      setStartTime(`${String(initialStartHour).padStart(2, '0')}:00`);
      setEndTime(`${String(initialEndHour!).padStart(2, '0')}:00`);
    } else {
      setStartTime('');
      setEndTime('');
    }
  }, [initialDate, initialStartHour, initialEndHour]);

  useEffect(() => {
    Promise.all([
      supabase.from('event_types').select('id, name').eq('is_active', true).order('sort_order'),
      supabase.from('projects').select('id, project_name').neq('status', 'cancelled').order('project_name'),
      supabase.from('profiles').select('id, display_name, email'),
    ]).then(([etRes, projRes, profRes]) => {
      if (etRes.data) setEventTypes(etRes.data.map(e => ({ id: e.id, label: e.name })));
      if (projRes.data) setProjects(projRes.data.map(p => ({ id: p.id, label: p.project_name })));
      if (profRes.data) setProfiles(profRes.data.map(p => ({ id: p.id, label: p.display_name || p.email })));
    });
  }, []);

  const resetForm = () => {
    setTitle('');
    setStatus('todo');
    setStartTime('');
    setEndTime('');
    setAllDay(false);
    setLocation('');
    setEventTypeId('');
    setProjectId('');
    setAssignedTo('');
    setAttendees([]);
    setProjectSearch('');
    setUserSearch('');
  };

  const handleSave = async () => {
    if (!title.trim() || !dueDate || !user) return;
    setSaving(true);

    let error;

    if (entryType === 'task') {
      ({ error } = await supabase.from('tasks').insert({
        title: title.trim(),
        due_date: dueDate,
        status,
        created_by: user.id,
        assigned_to: assignedTo || null,
        project_id: projectId || null,
      }));
    } else {
      ({ error } = await supabase.from('events').insert({
        title: title.trim(),
        start_date: dueDate,
        end_date: dueDate,
        start_time: allDay ? null : startTime || null,
        end_time: allDay ? null : endTime || null,
        all_day: allDay,
        location,
        event_type_id: eventTypeId || null,
        created_by: user.id,
        project_id: projectId || null,
        attendees: attendees.length > 0 ? attendees : [],
      }));
    }

    setSaving(false);
    if (error) {
      toast(entryType === 'task' ? 'Chyba při vytváření úkolu' : 'Chyba při vytváření události', 'error');
      return;
    }
    toast(entryType === 'task' ? 'Úkol vytvořen' : 'Událost vytvořena');
    resetForm();
    onCreated();
    onClose();
  };

  const toggleAttendee = (id: string) => {
    setAttendees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const filteredProjects = projectSearch
    ? projects.filter(p => p.label.toLowerCase().includes(projectSearch.toLowerCase()))
    : projects;

  const filteredProfiles = userSearch
    ? profiles.filter(p => p.label.toLowerCase().includes(userSearch.toLowerCase()))
    : profiles;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nový záznam do kalendáře"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !dueDate || saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center bg-white/[0.06] rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setEntryType('task')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
              entryType === 'task'
                ? 'bg-white/[0.06] text-blue-400 '
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Úkol
          </button>
          <button
            type="button"
            onClick={() => setEntryType('event')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
              entryType === 'event'
                ? 'bg-white/[0.06] text-rose-600 '
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Událost
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            {entryType === 'task' ? 'Název úkolu' : 'Název události'} *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={entryType === 'task' ? 'Napište název úkolu...' : 'Napište název události...'}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum *</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          {entryType === 'task' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="todo">K vyřízení</option>
                <option value="in_progress">Rozpracováno</option>
                <option value="done">Hotovo</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ události</label>
              <select
                value={eventTypeId}
                onChange={e => setEventTypeId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">-- Bez typu --</option>
                {eventTypes.map(et => (
                  <option key={et.id} value={et.id}>{et.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={projectSearch}
              onChange={e => {
                setProjectSearch(e.target.value);
                if (!e.target.value) setProjectId('');
              }}
              placeholder="Vyhledat projekt..."
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {projectId && (
              <button
                type="button"
                onClick={() => { setProjectId(''); setProjectSearch(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-400"
              >
                &#x2715;
              </button>
            )}
          </div>
          {projectSearch && !projectId && (
            <div className="mt-1 border border-white/10 rounded-xl max-h-32 overflow-y-auto bg-white/[0.06] shadow-lg">
              {filteredProjects.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">Žádný projekt nenalezen</div>
              ) : (
                filteredProjects.slice(0, 8).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setProjectId(p.id); setProjectSearch(p.label); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-500/100/10 transition truncate"
                  >
                    {p.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {entryType === 'task' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Přiřazený uživatel</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={userSearch}
                onChange={e => {
                  setUserSearch(e.target.value);
                  if (!e.target.value) setAssignedTo('');
                }}
                placeholder="Vyhledat uživatele..."
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {assignedTo && (
                <button
                  type="button"
                  onClick={() => { setAssignedTo(''); setUserSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-400"
                >
                  &#x2715;
                </button>
              )}
            </div>
            {userSearch && !assignedTo && (
              <div className="mt-1 border border-white/10 rounded-xl max-h-32 overflow-y-auto bg-white/[0.06] shadow-lg">
                {filteredProfiles.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Žádný uživatel nenalezen</div>
                ) : (
                  filteredProfiles.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setAssignedTo(p.id); setUserSearch(p.label); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-500/100/10 transition truncate"
                    >
                      {p.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Účastníci {attendees.length > 0 && <span className="text-blue-400">({attendees.length})</span>}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Vyhledat účastníky..."
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attendees.map(aId => {
                  const p = profiles.find(pr => pr.id === aId);
                  return (
                    <span
                      key={aId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium"
                    >
                      {p?.label || aId.slice(0, 8)}
                      <button
                        type="button"
                        onClick={() => toggleAttendee(aId)}
                        className="text-blue-400 hover:text-blue-400 ml-0.5"
                      >
                        &#x2715;
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {userSearch && (
              <div className="mt-1 border border-white/10 rounded-xl max-h-32 overflow-y-auto bg-white/[0.06] shadow-lg">
                {filteredProfiles.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Žádný uživatel nenalezen</div>
                ) : (
                  filteredProfiles.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { toggleAttendee(p.id); setUserSearch(''); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-500/100/10 transition truncate flex items-center justify-between ${
                        attendees.includes(p.id) ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <span>{p.label}</span>
                      {attendees.includes(p.id) && (
                        <span className="text-blue-400 text-xs font-semibold">Vybráno</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {entryType === 'event' && (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20"
              />
              <span className="text-sm text-slate-300 font-medium">Celodenní událost</span>
            </label>
          </>
        )}

        {!allDay && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Od</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Do</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        )}

        {entryType === 'event' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Místo</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Zadejte místo..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
