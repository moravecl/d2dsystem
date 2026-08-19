import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MapPin, FolderKanban, Calendar,
  ChevronDown, MoreHorizontal, ExternalLink, CheckSquare,
  FileText, Receipt, Wrench, X, Columns3,
} from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/auditLog';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete';
import ProjectTypeSelect, { ProjectTypeBadges } from '../../components/ui/ProjectTypeSelect';
import type { Profile, Client } from '../../types/database';

interface ProjectType {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

interface ProjectRow {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  status: string;
  address: string;
  deadline: string | null;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
  type_ids?: string[];
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  default_status: string;
}

const STATUS_OPTIONS = [
  { key: 'lead', label: 'Lead' },
  { key: 'design', label: 'Návrh' },
  { key: 'quote', label: 'Nabídka' },
  { key: 'approval', label: 'Schválení' },
  { key: 'in_progress', label: 'Realizace' },
];

const STATUS_CHIP_COLORS: Record<string, string> = {
  lead: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  design: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  quote: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  approval: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  in_progress: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

const STATUS_LEFT_BORDER: Record<string, string> = {
  lead: 'border-l-slate-500',
  design: 'border-l-sky-500',
  quote: 'border-l-cyan-500',
  approval: 'border-l-amber-500',
  in_progress: 'border-l-emerald-500',
};

const DEADLINE_OPTIONS = [
  { key: 'today', label: 'Dnes' },
  { key: '7days', label: '7 dní' },
  { key: 'month', label: 'Měsíc' },
  { key: 'none', label: 'Bez termínu' },
  { key: 'overdue', label: 'Po termínu' },
];

const SAVED_VIEWS = [
  { key: 'mine', label: 'Moje' },
  { key: 'quotes', label: 'Nabídky' },
  { key: 'overdue', label: 'Po termínu' },
  { key: 'thisweek', label: 'Tento týden' },
];

const EXPAND_QUICK_ACTIONS = [
  { label: 'Otevřít', icon: ExternalLink, tab: '' },
  { label: 'Úkoly', icon: CheckSquare, tab: 'tasks' },
  { label: 'Nabídka', icon: FileText, tab: 'quotes' },
  { label: 'Faktury', icon: Receipt, tab: 'finance' },
  { label: 'Servis', icon: Wrench, tab: 'service' },
];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Dnes';
  if (days === 1) return 'Včera';
  if (days < 7) return `před ${days} dny`;
  if (days < 30) return `před ${Math.floor(days / 7)} týd.`;
  if (days < 365) return `před ${Math.floor(days / 30)} měs.`;
  return `před ${Math.floor(days / 365)} r.`;
}

function formatShortAddress(address: string): string {
  if (!address) return '';
  const parts = address.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const pscIndex = parts.findIndex((p) => /^\d{3}\s?\d{2}/.test(p));
    const city = pscIndex > 0 ? parts[pscIndex - 1] : parts[parts.length - 1];
    return `${parts[0]}, ${city}`;
  }
  return address;
}

function getMapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function ProjectsListPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const planLimits = usePlanLimits();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [personFilters, setPersonFilters] = useState<string[]>([]);
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [savedView, setSavedView] = useState('');

  const [sortKey, setSortKey] = useState('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPersonFilter, setShowPersonFilter] = useState(false);
  const personFilterRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    project_name: '',
    client_id: '',
    address: '',
    address_lat: null as number | null,
    address_lon: null as number | null,
    status: 'lead',
    responsible_user_id: '',
    deadline: '',
    type_ids: [] as string[],
    template_id: '',
  });

  const loadData = useCallback(async () => {
    const [projectsRes, profilesRes, clientsRes, typesRes, typeAssignmentsRes, templatesRes] = await Promise.all([
      supabase.from('projects').select('id, project_name, client_name, client_id, status, address, deadline, responsible_user_id, created_at, updated_at').not('status', 'in', '("completed","cancelled")').order('updated_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('clients').select('*').eq('is_active', true).order('name'),
      supabase.from('project_types').select('id, name, color, is_active').order('sort_order'),
      supabase.from('project_project_types').select('project_id, project_type_id'),
      supabase.from('project_templates').select('id, name, description, default_status').eq('is_active', true).order('name'),
    ]);
    const assignmentMap: Record<string, string[]> = {};
    for (const a of (typeAssignmentsRes.data || [])) {
      if (!assignmentMap[a.project_id]) assignmentMap[a.project_id] = [];
      assignmentMap[a.project_id].push(a.project_type_id);
    }
    const rows = (projectsRes.data || []).map((p: ProjectRow) => ({ ...p, type_ids: assignmentMap[p.id] || [] }));
    setProjects(rows as ProjectRow[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setClients((clientsRes.data || []) as Client[]);
    setProjectTypes((typesRes.data || []) as ProjectType[]);
    setTemplates((templatesRes.data || []) as ProjectTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Projekty' }],
      primaryAction: {
        label: 'Nový projekt',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          if (!planLimits.canAddProject) {
            toast(`Dosáhli jste limitu ${planLimits.maxProjects} projektů pro váš plán. Přejděte na vyšší plán v Admin → Licence.`, 'error');
            return;
          }
          setShowModal(true);
        },
      },
    });
  }, [setConfig, planLimits.canAddProject]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (personFilterRef.current && !personFilterRef.current.contains(e.target as Node)) {
        setShowPersonFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async () => {
    if (!form.project_name || !user) {
      toast('Vyplňte název projektu', 'error');
      return;
    }
    setSaving(true);
    const selectedClient = clients.find(c => c.id === form.client_id);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: form.project_name,
        project_name: form.project_name,
        client_name: selectedClient?.name || '',
        client_id: form.client_id || null,
        status: form.status,
        address: form.address,
        address_lat: form.address_lat,
        address_lon: form.address_lon,
        responsible_user_id: form.responsible_user_id || null,
        deadline: form.deadline || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      setSaving(false);
      toast('Chyba při vytváření projektu', 'error');
      return;
    }
    if (data) {
      if (form.type_ids.length > 0) {
        await supabase.from('project_project_types').insert(
          form.type_ids.map(tid => ({ project_id: data.id, project_type_id: tid }))
        );
      }
      if (form.template_id) {
        await applyTemplate(data.id, form.template_id, user.id);
      }
      await logAudit('project', data.id, 'created', { name: form.project_name });
      toast('Projekt vytvořen');
      setShowModal(false);
      setForm({ project_name: '', client_id: '', address: '', address_lat: null, address_lon: null, status: 'lead', responsible_user_id: '', deadline: '', type_ids: [], template_id: '' });
      navigate(`/projekty/${data.id}`);
    }
    setSaving(false);
  };

  const applyTemplate = async (projectId: string, templateId: string, userId: string) => {
    const [msRes, tsRes, cfRes, fldRes] = await Promise.all([
      supabase.from('template_milestones').select('*').eq('template_id', templateId).order('sort_order'),
      supabase.from('template_tasks').select('*').eq('template_id', templateId).order('sort_order'),
      supabase.from('template_custom_fields').select('*').eq('template_id', templateId),
      supabase.from('template_folders').select('*').eq('template_id', templateId).order('sort_order'),
    ]);

    const tplMilestones = (msRes.data || []) as { name: string; offset_days: number; duration_days: number; color: string; sort_order: number }[];
    const tplTasks = (tsRes.data || []) as { milestone_index: number; title: string; description: string; priority: string; sort_order: number }[];
    const tplCf = (cfRes.data || []) as { field_id: string; default_value: string }[];
    const tplFolders = (fldRes.data || []) as { id: string; parent_id: string | null; name: string; sort_order: number }[];

    const today = new Date();
    const milestoneIdMap = new Map<number, string>();

    for (const ms of tplMilestones) {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + ms.offset_days);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + ms.duration_days);
      const { data: inserted } = await supabase.from('project_milestones').insert({
        project_id: projectId,
        name: ms.name,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        status: 'planned',
        sort_order: ms.sort_order,
        color: ms.color,
      }).select('id').maybeSingle();
      if (inserted) milestoneIdMap.set(ms.sort_order, inserted.id);
    }

    if (tplTasks.length > 0) {
      await supabase.from('tasks').insert(
        tplTasks.map((t) => ({
          project_id: projectId,
          milestone_id: t.milestone_index >= 0 ? milestoneIdMap.get(t.milestone_index) || null : null,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: 'todo',
          sort_order: t.sort_order,
          created_by: userId,
        }))
      );
    }

    if (tplCf.length > 0) {
      const { data: orgMember } = await supabase.from('organization_members').select('organization_id').eq('user_id', userId).maybeSingle();
      if (orgMember) {
        await supabase.from('custom_field_values').insert(
          tplCf.filter((cf) => cf.default_value).map((cf) => ({
            project_id: projectId,
            field_id: cf.field_id,
            value: cf.default_value,
            organization_id: orgMember.organization_id,
          }))
        );
      }
    }

    if (tplFolders.length > 0) {
      const createFoldersRecursive = async (parentTplId: string | null, parentProjectFolderId: string | null) => {
        const children = tplFolders.filter((f) => f.parent_id === parentTplId).sort((a, b) => a.sort_order - b.sort_order);
        for (const child of children) {
          const { data: newFolder } = await supabase.from('project_folders').insert({
            project_id: projectId,
            parent_id: parentProjectFolderId,
            name: child.name,
            created_by: userId,
          }).select('id').maybeSingle();
          if (newFolder) {
            await createFoldersRecursive(child.id, newFolder.id);
          }
        }
      };
      await createFoldersRecursive(null, null);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setForm((prev) => ({ ...prev, template_id: templateId, status: tpl.default_status }));
    } else {
      setForm((prev) => ({ ...prev, template_id: '' }));
    }
  };

  const applySavedView = (viewKey: string) => {
    setSavedView(viewKey === savedView ? '' : viewKey);
    setStatusFilters([]);
    setTypeFilters([]);
    setPersonFilters([]);
    setDeadlineFilter('');
    setSearch('');
  };

  const toggleStatus = (key: string) => {
    setSavedView('');
    setStatusFilters(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const toggleType = (id: string) => {
    setSavedView('');
    setTypeFilters(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const togglePerson = (id: string) => {
    setSavedView('');
    setPersonFilters(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleDeadline = (key: string) => {
    setSavedView('');
    setDeadlineFilter(prev => prev === key ? '' : key);
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilters([]);
    setTypeFilters([]);
    setPersonFilters([]);
    setDeadlineFilter('');
    setSavedView('');
  };

  const hasActiveFilters = !!(search || statusFilters.length > 0 || typeFilters.length > 0 || personFilters.length > 0 || deadlineFilter || savedView);

  const getProfileName = (userId: string | null) => {
    if (!userId) return '';
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email || '';
  };

  const getProfileInitials = (userId: string | null) => {
    const name = getProfileName(userId);
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const projectSortOptions = [
    { key: 'project_name', label: 'Název' },
    { key: 'client_name', label: 'Klient' },
    { key: 'status', label: 'Stav' },
    { key: 'deadline', label: 'Termín' },
    { key: 'updated_at', label: 'Naposledy upraveno' },
    { key: 'created_at', label: 'Datum vytvoření' },
  ];

  const now = new Date();

  const filtered = sortItems(
    projects.filter((p) => {
      if (savedView === 'mine') {
        if (p.responsible_user_id !== user?.id) return false;
      } else if (savedView === 'quotes') {
        if (p.status !== 'quote') return false;
      } else if (savedView === 'overdue') {
        if (!p.deadline || new Date(p.deadline) >= now) return false;
      } else if (savedView === 'thisweek') {
        if (!p.deadline) return false;
        const d = new Date(p.deadline);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        if (d < weekStart || d > weekEnd) return false;
      } else {
        if (statusFilters.length > 0 && !statusFilters.includes(p.status)) return false;
        if (typeFilters.length > 0 && !typeFilters.some(tid => (p.type_ids || []).includes(tid))) return false;
        if (personFilters.length > 0 && !personFilters.includes(p.responsible_user_id || '')) return false;
        if (deadlineFilter === 'today') {
          if (!p.deadline || new Date(p.deadline).toDateString() !== now.toDateString()) return false;
        } else if (deadlineFilter === '7days') {
          if (!p.deadline) return false;
          const d = new Date(p.deadline);
          if (d < now || d > new Date(now.getTime() + 7 * 86400000)) return false;
        } else if (deadlineFilter === 'month') {
          if (!p.deadline) return false;
          const d = new Date(p.deadline);
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        } else if (deadlineFilter === 'none') {
          if (p.deadline) return false;
        } else if (deadlineFilter === 'overdue') {
          if (!p.deadline || new Date(p.deadline) >= now) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          p.project_name.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q)
        );
      }
      return true;
    }),
    sortKey,
    sortDir
  );

  const activeCount = projects.filter(p => p.status === 'in_progress').length;
  const thisMonthCount = projects.filter(p => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const overdueCount = projects.filter(p => p.deadline && new Date(p.deadline) < now).length;

  const inputClasses = 'w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition';

  const uniquePersonIds = [...new Set(projects.map(p => p.responsible_user_id).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Celkem projektů" value={projects.length} />
        <StatCard label="Aktivních" value={activeCount} accent="blue" />
        <StatCard label="Nových tento měsíc" value={thisMonthCount} accent="teal" />
        <StatCard label="Po termínu" value={overdueCount} accent={overdueCount > 0 ? 'red' : undefined} />
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Hledat název / klient / adresa…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSavedView(''); }}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.04] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
            />
          </div>
          <SortControl
            options={projectSortOptions}
            sortKey={sortKey}
            sortDir={sortDir}
            onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
          />
          <button
            title="Kanban pohled"
            className="p-2.5 border border-white/10 rounded-xl bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
          >
            <Columns3 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Stav:</span>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => toggleStatus(s.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                statusFilters.includes(s.key)
                  ? STATUS_CHIP_COLORS[s.key]
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-transparent'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {projectTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Typ:</span>
            {projectTypes.map(t => (
              <button
                key={t.id}
                onClick={() => toggleType(t.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                  typeFilters.includes(t.id)
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-transparent'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Termín:</span>
          {DEADLINE_OPTIONS.map(d => (
            <button
              key={d.key}
              onClick={() => toggleDeadline(d.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                deadlineFilter === d.key
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-transparent'
              }`}
            >
              {d.label}
            </button>
          ))}

          {uniquePersonIds.length > 0 && (
            <div className="relative" ref={personFilterRef}>
              <button
                onClick={() => setShowPersonFilter(v => !v)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                  personFilters.length > 0
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-transparent'
                }`}
              >
                Osoba
                {personFilters.length > 0 && (
                  <span className="bg-blue-500/40 text-blue-200 rounded px-1 text-[10px]">{personFilters.length}</span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showPersonFilter && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-navy-800 border border-white/10 rounded-xl shadow-2xl p-1 min-w-[180px]">
                  {uniquePersonIds.map(id => (
                    <button
                      key={id}
                      onClick={() => togglePerson(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                        personFilters.includes(id) ? 'bg-blue-500/20 text-blue-300' : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center text-[9px] font-bold text-blue-300 shrink-0">
                        {getProfileInitials(id)}
                      </div>
                      <span className="truncate">{getProfileName(id)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Pohled:</span>
          {SAVED_VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => applySavedView(v.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                savedView === v.key
                  ? 'bg-slate-600/60 text-white border-slate-500/50'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-transparent'
              }`}
            >
              {v.label}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-400 hover:text-white border border-white/10 hover:border-white/20 bg-transparent transition-all"
            >
              <X className="w-3 h-3" />
              Vyčistit
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-px">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-navy-800/50 rounded-xl border border-white/[0.06] animate-skeleton" />
          ))}
        </div>
      ) : (
        <TableView
          projects={filtered}
          profiles={profiles}
          projectTypes={projectTypes}
          expandedRowId={expandedRowId}
          onToggleExpand={(id) => setExpandedRowId(prev => prev === id ? null : id)}
          getProfileName={getProfileName}
          getProfileInitials={getProfileInitials}
          navigate={navigate}
        />
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nový projekt"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.07] rounded-xl transition-colors">Zrušit</button>
            <button onClick={handleCreate} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all disabled:opacity-50">
              {saving ? 'Vytvářím...' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {templates.length > 0 && (
            <FormField label="Šablona projektu">
              <select value={form.template_id} onChange={(e) => handleTemplateChange(e.target.value)} className={inputClasses}>
                <option value="">-- Bez šablony --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.description ? ` - ${t.description}` : ''}</option>
                ))}
              </select>
              {form.template_id && (
                <p className="text-[11px] text-blue-400 font-medium mt-1">Šablona přidá milníky, úkoly a výchozí hodnoty polí do projektu</p>
              )}
            </FormField>
          )}
          <FormField label="Název projektu *">
            <input type="text" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} className={inputClasses} placeholder="Novak RD" />
          </FormField>
          <FormField label="Klient">
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={inputClasses}>
              <option value="">-- Bez klienta --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Adresa realizace">
            <AddressAutocomplete
              value={form.address}
              lat={form.address_lat}
              lon={form.address_lon}
              onChange={(address, lat, lon) => setForm({ ...form, address, address_lat: lat, address_lon: lon })}
              placeholder="Zadejte ulici a město..."
              includeClients
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Stav">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClasses}>
                <option value="lead">Lead / Poptávka</option>
                <option value="design">Návrh</option>
                <option value="quote">Nabídka</option>
                <option value="in_progress">Realizace</option>
              </select>
            </FormField>
            <FormField label="Termín">
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputClasses} />
            </FormField>
          </div>
          <FormField label="Odpovědná osoba">
            <select value={form.responsible_user_id} onChange={(e) => setForm({ ...form, responsible_user_id: e.target.value })} className={inputClasses}>
              <option value="">-- Vyberte --</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
              ))}
            </select>
          </FormField>
          {projectTypes.length > 0 && (
            <FormField label="Typ projektu">
              <ProjectTypeSelect
                selectedIds={form.type_ids}
                onChange={(ids) => setForm({ ...form, type_ids: ids })}
              />
            </FormField>
          )}
        </div>
      </Modal>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const STAT_ACCENT: Record<string, { bg: string; numColor: string; border: string }> = {
  blue: { bg: 'bg-blue-500/10', numColor: 'text-blue-300', border: 'border-blue-500/20' },
  teal: { bg: 'bg-teal-500/10', numColor: 'text-teal-300', border: 'border-teal-500/20' },
  red: { bg: 'bg-red-500/10', numColor: 'text-red-300', border: 'border-red-500/20' },
};

function StatCard({ label, value, accent }: { label: string; value: number; accent?: 'blue' | 'teal' | 'red' }) {
  const s = accent ? STAT_ACCENT[accent] : { bg: 'bg-white/[0.04]', numColor: 'text-slate-200', border: 'border-white/[0.08]' };
  return (
    <div className={`${s.bg} border ${s.border} rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-200`}>
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-2xl font-extrabold ${s.numColor} tracking-tight`}>{value}</div>
    </div>
  );
}

function TableView({
  projects,
  profiles: _profiles,
  projectTypes,
  expandedRowId,
  onToggleExpand,
  getProfileName,
  getProfileInitials,
  navigate,
}: {
  projects: ProjectRow[];
  profiles: Profile[];
  projectTypes: ProjectType[];
  expandedRowId: string | null;
  onToggleExpand: (id: string) => void;
  getProfileName: (id: string | null) => string;
  getProfileInitials: (id: string | null) => string;
  navigate: (path: string) => void;
}) {
  const now = new Date();

  if (projects.length === 0) {
    return (
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
          <FolderKanban className="w-7 h-7 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-400">Žádné projekty</p>
        <p className="text-xs text-slate-500 mt-1">Vytvořte nový projekt tlačítkem nahoře</p>
      </div>
    );
  }

  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02]">
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Projekt</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Klient</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stav</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Termín</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Odpovědná osoba</th>
              <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Poslední aktivita</th>
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const isExpanded = expandedRowId === project.id;
              const daysUntil = project.deadline
                ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const isOverdue = daysUntil !== null && daysUntil < 0 && !['completed', 'cancelled'].includes(project.status);
              const shortAddress = project.address ? formatShortAddress(project.address) : '';

              return (
                <>
                  <tr
                    key={project.id}
                    className={`border-b border-white/[0.05] last:border-0 cursor-pointer group transition-colors ${
                      isExpanded ? 'bg-white/[0.04] border-white/[0.08]' : 'hover:bg-white/[0.03]'
                    }`}
                    onClick={() => navigate(`/projekty/${project.id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleExpand(project.id); }}
                          className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${
                            isExpanded
                              ? 'bg-blue-500/20 text-blue-400 rotate-180'
                              : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.12] hover:text-white'
                          }`}
                          title="Rozbalit detail"
                        >
                          <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                        </button>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate leading-snug">
                            {project.project_name}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                            <span className={`text-[11px] truncate max-w-[200px] ${shortAddress ? 'text-slate-500' : 'text-slate-600 italic'}`}>
                              {shortAddress || 'Bez adresy'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-slate-400 truncate max-w-[140px] block">
                        {project.client_name || <span className="text-slate-600">—</span>}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusBadge status={project.status} />
                    </td>

                    <td className="px-5 py-3.5">
                      {project.deadline ? (
                        <div className={`flex items-center gap-1.5 text-sm whitespace-nowrap ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                          <Calendar className={`w-3.5 h-3.5 shrink-0 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`} />
                          <span>{new Date(project.deadline).toLocaleDateString('cs-CZ')}</span>
                          {isOverdue && (
                            <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">po termínu</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {project.responsible_user_id ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-blue-300 shrink-0 border border-blue-500/20">
                            {getProfileInitials(project.responsible_user_id)}
                          </div>
                          <span className="text-sm text-slate-400 truncate max-w-[120px]">
                            {getProfileName(project.responsible_user_id)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right hidden xl:table-cell">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{formatRelativeTime(project.updated_at)}</span>
                    </td>

                    <td className="px-3 py-3.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/projekty/${project.id}`); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.08] transition-colors opacity-0 group-hover:opacity-100"
                        title="Otevřít projekt"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${project.id}-exp`}>
                      <td colSpan={7} className="p-0">
                        <div className={`mx-1 mb-1 border border-white/[0.08] border-l-2 ${STATUS_LEFT_BORDER[project.status] || 'border-l-slate-500'} rounded-b-xl bg-navy-900/60 px-5 py-4`}>
                          <div className="flex flex-col sm:flex-row gap-5">
                            <div className="flex-1 space-y-3">
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Adresa</div>
                                {project.address ? (
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                    <span className="text-sm text-slate-300 leading-relaxed">{project.address}</span>
                                    <a
                                      href={getMapUrl(project.address)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="ml-1 text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 whitespace-nowrap shrink-0"
                                    >
                                      Otevřít v mapách
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-500 italic">Bez adresy</span>
                                )}
                              </div>

                              {(project.type_ids || []).length > 0 && (
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Typy</div>
                                  <ProjectTypeBadges typeIds={project.type_ids || []} types={projectTypes} />
                                </div>
                              )}

                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Poslední akce</div>
                                <span className="text-sm text-slate-400">Aktualizováno {formatRelativeTime(project.updated_at).toLowerCase()}</span>
                              </div>
                            </div>

                            <div className="flex flex-row sm:flex-col gap-1.5 flex-wrap">
                              {EXPAND_QUICK_ACTIONS.map(action => (
                                <button
                                  key={action.label}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const path = action.tab ? `/projekty/${project.id}?tab=${action.tab}` : `/projekty/${project.id}`;
                                    navigate(path);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all whitespace-nowrap"
                                >
                                  <action.icon className="w-3.5 h-3.5" />
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-white/[0.07] bg-navy-900/30">
        <span className="text-xs text-slate-500">{projects.length} projektů</span>
      </div>
    </div>
  );
}
