import { useEffect, useState } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, GripVertical, Wrench, Lightbulb, RotateCcw, ToggleLeft, ToggleRight, Loader2, HardHat } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useTour } from '../../contexts/TourContext';
import { TOURS_BY_PATH } from '../../components/tour/tourDefinitions';

interface TaskStatus {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

interface ProjectStatus {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

interface ServiceType {
  id: string;
  name: string;
  interval_months: number;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface WorkActivity {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

const PRESET_COLORS = [
  { value: '#64748b', label: 'Šedá' },
  { value: '#3b82f6', label: 'Modrá' },
  { value: '#10b981', label: 'Zelená' },
  { value: '#22c55e', label: 'Světle zelená' },
  { value: '#06b6d4', label: 'Tyrkysová' },
  { value: '#f59e0b', label: 'Oranžová' },
  { value: '#ef4444', label: 'Červená' },
  { value: '#8b5cf6', label: 'Fialová' },
  { value: '#ec4899', label: 'Růžová' },
];

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const { organization, refresh: refreshOrg } = useOrganization();
  const { resetTour } = useTour();
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'services' | 'activities' | 'onboarding'>('tasks');
  const [toursEnabled, setToursEnabled] = useState<boolean>(true);
  const [savingTours, setSavingTours] = useState(false);
  const [resettingTour, setResettingTour] = useState<string | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskStatus | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectStatus | null>(null);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [editingActivity, setEditingActivity] = useState<WorkActivity | null>(null);
  const [taskForm, setTaskForm] = useState({ key: '', label: '', color: '#64748b' });
  const [projectForm, setProjectForm] = useState({ key: '', label: '', color: '#64748b' });
  const [serviceForm, setServiceForm] = useState({ name: '', interval_months: 12, description: '' });
  const [activityForm, setActivityForm] = useState({ name: '', color: '#64748b' });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (organization) {
      setToursEnabled((organization as any).onboarding_tours_enabled !== false);
    }
  }, [organization?.id]);

  const handleToggleTours = async () => {
    if (!organization) return;
    setSavingTours(true);
    const newVal = !toursEnabled;
    const { error } = await supabase
      .from('organizations')
      .update({ onboarding_tours_enabled: newVal })
      .eq('id', organization.id);
    if (!error) {
      setToursEnabled(newVal);
      await refreshOrg();
      toast(newVal ? 'Průvodci jsou zapnuty.' : 'Průvodci jsou vypnuty.', 'success');
    } else {
      toast('Chyba při ukládání.', 'error');
    }
    setSavingTours(false);
  };

  const handleResetTour = async (tourId: string) => {
    setResettingTour(tourId);
    await resetTour(tourId);
    toast('Průvodce byl resetován – zobrazí se uživatelům znovu.', 'success');
    setResettingTour(null);
  };

  const loadData = async () => {
    setLoading(true);
    const [taskRes, projectRes, serviceRes, activityRes] = await Promise.all([
      supabase.from('task_statuses').select('*').order('sort_order'),
      supabase.from('project_statuses').select('*').order('sort_order'),
      supabase.from('service_types').select('*').order('sort_order'),
      supabase.from('work_activities').select('*').order('sort_order'),
    ]);
    setTaskStatuses(taskRes.data || []);
    setProjectStatuses(projectRes.data || []);
    setServiceTypes((serviceRes.data || []) as ServiceType[]);
    setWorkActivities((activityRes.data || []) as WorkActivity[]);
    setLoading(false);
  };

  const handleSaveTaskStatus = async () => {
    if (!taskForm.key || !taskForm.label) {
      toast('Vyplňte všechna pole', 'error');
      return;
    }

    if (editingTask) {
      const { error } = await supabase
        .from('task_statuses')
        .update({ label: taskForm.label, color: taskForm.color })
        .eq('id', editingTask.id);
      if (error) {
        toast('Chyba při aktualizaci', 'error');
        return;
      }
      toast('Stav aktualizován');
    } else {
      const maxOrder = Math.max(...taskStatuses.map(s => s.sort_order), 0);
      const { error } = await supabase
        .from('task_statuses')
        .insert({ key: taskForm.key, label: taskForm.label, color: taskForm.color, sort_order: maxOrder + 1 });
      if (error) {
        toast('Chyba při vytváření', 'error');
        return;
      }
      toast('Stav vytvořen');
    }

    setShowTaskModal(false);
    setEditingTask(null);
    setTaskForm({ key: '', label: '', color: '#64748b' });
    loadData();
  };

  const handleSaveProjectStatus = async () => {
    if (!projectForm.key || !projectForm.label) {
      toast('Vyplňte všechna pole', 'error');
      return;
    }

    if (editingProject) {
      const { error } = await supabase
        .from('project_statuses')
        .update({ label: projectForm.label, color: projectForm.color })
        .eq('id', editingProject.id);
      if (error) {
        toast('Chyba při aktualizaci', 'error');
        return;
      }
      toast('Stav aktualizován');
    } else {
      const maxOrder = Math.max(...projectStatuses.map(s => s.sort_order), 0);
      const { error } = await supabase
        .from('project_statuses')
        .insert({ key: projectForm.key, label: projectForm.label, color: projectForm.color, sort_order: maxOrder + 1 });
      if (error) {
        toast('Chyba při vytváření', 'error');
        return;
      }
      toast('Stav vytvořen');
    }

    setShowProjectModal(false);
    setEditingProject(null);
    setProjectForm({ key: '', label: '', color: '#64748b' });
    loadData();
  };

  const handleDeleteTaskStatus = async (id: string) => {
    if (!confirm('Opravdu smazat tento stav? To může ovlivnit existující úkoly.')) return;
    const { error } = await supabase.from('task_statuses').delete().eq('id', id);
    if (error) {
      toast('Chyba při mazání', 'error');
      return;
    }
    toast('Stav smazán');
    loadData();
  };

  const handleDeleteProjectStatus = async (id: string) => {
    if (!confirm('Opravdu smazat tento stav? To může ovlivnit existující projekty.')) return;
    const { error } = await supabase.from('project_statuses').delete().eq('id', id);
    if (error) {
      toast('Chyba při mazání', 'error');
      return;
    }
    toast('Stav smazán');
    loadData();
  };

  const handleToggleTaskActive = async (status: TaskStatus) => {
    const { error } = await supabase
      .from('task_statuses')
      .update({ is_active: !status.is_active })
      .eq('id', status.id);
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    loadData();
  };

  const handleToggleProjectActive = async (status: ProjectStatus) => {
    const { error } = await supabase
      .from('project_statuses')
      .update({ is_active: !status.is_active })
      .eq('id', status.id);
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    loadData();
  };

  const handleSaveServiceType = async () => {
    if (!serviceForm.name) {
      toast('Vyplňte název', 'error');
      return;
    }
    if (editingService) {
      const { error } = await supabase
        .from('service_types')
        .update({ name: serviceForm.name, interval_months: serviceForm.interval_months, description: serviceForm.description })
        .eq('id', editingService.id);
      if (error) { toast('Chyba při aktualizaci', 'error'); return; }
      toast('Typ servisu aktualizován');
    } else {
      const maxOrder = Math.max(...serviceTypes.map(s => s.sort_order), 0);
      const { error } = await supabase
        .from('service_types')
        .insert({ name: serviceForm.name, interval_months: serviceForm.interval_months, description: serviceForm.description, sort_order: maxOrder + 1 });
      if (error) { toast('Chyba při vytváření', 'error'); return; }
      toast('Typ servisu vytvořen');
    }
    setShowServiceModal(false);
    setEditingService(null);
    setServiceForm({ name: '', interval_months: 12, description: '' });
    loadData();
  };

  const handleDeleteServiceType = async (id: string) => {
    if (!confirm('Opravdu smazat tento typ servisu?')) return;
    const { error } = await supabase.from('service_types').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Typ servisu smazán');
    loadData();
  };

  const handleToggleServiceActive = async (st: ServiceType) => {
    const { error } = await supabase.from('service_types').update({ is_active: !st.is_active }).eq('id', st.id);
    if (error) { toast('Chyba', 'error'); return; }
    loadData();
  };

  const openEditService = (st: ServiceType) => {
    setEditingService(st);
    setServiceForm({ name: st.name, interval_months: st.interval_months, description: st.description });
    setShowServiceModal(true);
  };

  const handleSaveActivity = async () => {
    if (!activityForm.name) {
      toast('Vyplňte název', 'error');
      return;
    }
    if (editingActivity) {
      const { error } = await supabase
        .from('work_activities')
        .update({ name: activityForm.name, color: activityForm.color })
        .eq('id', editingActivity.id);
      if (error) { toast('Chyba při aktualizaci', 'error'); return; }
      toast('Činnost aktualizována');
    } else {
      const maxOrder = Math.max(...workActivities.map(a => a.sort_order), 0);
      const { error } = await supabase
        .from('work_activities')
        .insert({ name: activityForm.name, color: activityForm.color, sort_order: maxOrder + 1 });
      if (error) { toast('Chyba při vytváření', 'error'); return; }
      toast('Činnost vytvořena');
    }
    setShowActivityModal(false);
    setEditingActivity(null);
    setActivityForm({ name: '', color: '#64748b' });
    loadData();
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Opravdu smazat tuto činnost?')) return;
    const { error } = await supabase.from('work_activities').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Činnost smazána');
    loadData();
  };

  const handleToggleActivityActive = async (act: WorkActivity) => {
    const { error } = await supabase.from('work_activities').update({ is_active: !act.is_active }).eq('id', act.id);
    if (error) { toast('Chyba', 'error'); return; }
    loadData();
  };

  const openEditActivity = (act: WorkActivity) => {
    setEditingActivity(act);
    setActivityForm({ name: act.name, color: act.color });
    setShowActivityModal(true);
  };

  const openEditTask = (status: TaskStatus) => {
    setEditingTask(status);
    setTaskForm({ key: status.key, label: status.label, color: status.color });
    setShowTaskModal(true);
  };

  const openEditProject = (status: ProjectStatus) => {
    setEditingProject(status);
    setProjectForm({ key: status.key, label: status.label, color: status.color });
    setShowProjectModal(true);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-64 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6 text-slate-400" />
          <h1 className="text-2xl font-extrabold text-white">Systémová nastavení</h1>
        </div>
        <p className="text-sm text-slate-400">Správa stavů úkolů, projektů, činností, typů servisů a obecných nastavení</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/[0.08]">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'tasks'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Stavy úkolů
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'projects'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Stavy projektů
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'services'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Typy servisů
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={`px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'activities'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Činnosti
        </button>
        <button
          onClick={() => setActiveTab('onboarding')}
          className={`px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'onboarding'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Průvodci
        </button>
      </div>

      {activeTab === 'tasks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Stavy úkolů</h2>
            <button
              onClick={() => {
                setEditingTask(null);
                setTaskForm({ key: '', label: '', color: '#64748b' });
                setShowTaskModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500/100/100 transition text-sm"
            >
              <Plus className="w-4 h-4" />
              Nový stav
            </button>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-900/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pořadí</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Klíč</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Název</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Barva</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Aktivní</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {taskStatuses.map((status) => (
                  <tr key={status.id} className="hover:bg-white/[0.06]/[0.04] transition">
                    <td className="px-4 py-3">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-300">{status.key}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{status.label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded border border-white/[0.08]" style={{ backgroundColor: status.color }} />
                        <span className="text-xs text-slate-500">{status.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleTaskActive(status)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          status.is_active
                            ? 'bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-white/[0.06]/[0.07] text-slate-400 border border-white/[0.06]'
                        }`}
                      >
                        {status.is_active ? 'Aktivní' : 'Neaktivní'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditTask(status)}
                          className="p-1.5 rounded-lg hover:bg-blue-500/100/100/10 text-slate-500 hover:text-blue-400 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTaskStatus(status.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Stavy projektů</h2>
            <button
              onClick={() => {
                setEditingProject(null);
                setProjectForm({ key: '', label: '', color: '#64748b' });
                setShowProjectModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500/100/100 transition text-sm"
            >
              <Plus className="w-4 h-4" />
              Nový stav
            </button>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-900/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pořadí</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Klíč</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Název</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Barva</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Aktivní</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {projectStatuses.map((status) => (
                  <tr key={status.id} className="hover:bg-white/[0.06]/[0.04] transition">
                    <td className="px-4 py-3">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-300">{status.key}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{status.label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded border border-white/[0.08]" style={{ backgroundColor: status.color }} />
                        <span className="text-xs text-slate-500">{status.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleProjectActive(status)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          status.is_active
                            ? 'bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-white/[0.06]/[0.07] text-slate-400 border border-white/[0.06]'
                        }`}
                      >
                        {status.is_active ? 'Aktivní' : 'Neaktivní'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditProject(status)}
                          className="p-1.5 rounded-lg hover:bg-blue-500/100/100/10 text-slate-500 hover:text-blue-400 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProjectStatus(status.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Typy servisů</h2>
            <button
              onClick={() => {
                setEditingService(null);
                setServiceForm({ name: '', interval_months: 12, description: '' });
                setShowServiceModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500/100/100 transition text-sm"
            >
              <Plus className="w-4 h-4" />
              Nový typ
            </button>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-900/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pořadí</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Název</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Interval</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Popis</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Aktivní</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {serviceTypes.map((st) => (
                  <tr key={st.id} className="hover:bg-white/[0.06]/[0.04] transition">
                    <td className="px-4 py-3">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-semibold text-white">{st.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {st.interval_months >= 12 && st.interval_months % 12 === 0
                        ? `${st.interval_months / 12} ${st.interval_months / 12 === 1 ? 'rok' : st.interval_months / 12 < 5 ? 'roky' : 'let'}`
                        : `${st.interval_months} ${st.interval_months === 1 ? 'měsíc' : st.interval_months < 5 ? 'měsíce' : 'měsíců'}`
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{st.description || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleServiceActive(st)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          st.is_active
                            ? 'bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-white/[0.06]/[0.07] text-slate-400 border border-white/[0.06]'
                        }`}
                      >
                        {st.is_active ? 'Aktivní' : 'Neaktivní'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditService(st)}
                          className="p-1.5 rounded-lg hover:bg-blue-500/100/100/10 text-slate-500 hover:text-blue-400 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteServiceType(st.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {serviceTypes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Žádné typy servisů</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'activities' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Činnosti (výkazy práce)</h2>
            <button
              onClick={() => {
                setEditingActivity(null);
                setActivityForm({ name: '', color: '#64748b' });
                setShowActivityModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500/100/100 transition text-sm"
            >
              <Plus className="w-4 h-4" />
              Nová činnost
            </button>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-900/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pořadí</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Název</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Barva</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Aktivní</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {workActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-white/[0.06]/[0.04] transition">
                    <td className="px-4 py-3">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: act.color }} />
                        <span className="text-sm font-semibold text-white">{act.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg border border-white/[0.08] " style={{ backgroundColor: act.color }} />
                        <span className="text-xs font-mono text-slate-500">{act.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActivityActive(act)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          act.is_active
                            ? 'bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-white/[0.06]/[0.07] text-slate-400 border border-white/[0.06]'
                        }`}
                      >
                        {act.is_active ? 'Aktivní' : 'Neaktivní'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditActivity(act)}
                          className="p-1.5 rounded-lg hover:bg-blue-500/100/100/10 text-slate-500 hover:text-blue-400 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(act.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {workActivities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Žádné činnosti</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Tyto činnosti se nabízejí při zadávání výkazů práce. Barva se zobrazuje u každého výkazu.
          </p>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500/100/15 rounded-xl flex items-center justify-center shrink-0">
                <Lightbulb className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">Nápovědové průvodce (Onboarding tours)</h2>
                <p className="text-sm text-slate-400 mt-0.5 mb-4">
                  Po první návštěvě klíčových stránek se uživatelům zobrazí interaktivní průvodce s popisky
                  jednotlivých prvků. Lze je kdykoliv deaktivovat nebo resetovat pro celý tým.
                </p>

                <div className="flex items-center justify-between p-4 bg-navy-900/50 rounded-xl border border-white/[0.08]">
                  <div>
                    <div className="text-sm font-semibold text-white">Průvodci aktivní</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {toursEnabled
                        ? 'Průvodci se zobrazují novým uživatelům a po resetu.'
                        : 'Průvodci jsou deaktivovány pro celou organizaci.'}
                    </div>
                  </div>
                  <button
                    onClick={handleToggleTours}
                    disabled={savingTours}
                    className="flex items-center gap-2 text-sm font-bold transition"
                  >
                    {savingTours ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                    ) : toursEnabled ? (
                      <ToggleRight className="w-8 h-8 text-blue-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                    <span className={toursEnabled ? 'text-blue-400' : 'text-slate-500'}>
                      {toursEnabled ? 'Zapnuto' : 'Vypnuto'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-6">
            <h3 className="text-sm font-bold text-white mb-1">Resetovat průvodce</h3>
            <p className="text-sm text-slate-400 mb-4">
              Po resetu se průvodce znovu zobrazí všem uživatelům při příští návštěvě dané stránky.
            </p>
            <div className="space-y-2">
              {Object.entries({
                dashboard: 'Dashboard – Úvod do systému',
                projects: 'Projekty – Správa projektů',
                'project-detail': 'Detail projektu – Záložky projektu',
                crm: 'CRM – Správa klientů',
                finance: 'Finance – Fakturace',
                catalog: 'Katalog – Produkty a položky',
                tasks: 'Úkoly – Kanban nástěnka',
                calendar: 'Kalendář – Plánování událostí',
                warehouse: 'Sklad – Evidence materiálu',
                employees: 'Zaměstnanci – Tým a certifikace',
                service: 'Servis – Tikety a plánování',
                gantt: 'Gantt – Časová osa projektů',
                reports: 'Reporty – Přehledy a statistiky',
                emailing: 'Emailing – Odesílání emailů',
                admin: 'Admin – Administrace systému',
              }).map(([id, label]) => (
                <div
                  key={id}
                  className="flex items-center justify-between px-4 py-3 bg-navy-900/50 rounded-xl border border-white/[0.08]"
                >
                  <span className="text-sm text-slate-300 font-medium">{label}</span>
                  <button
                    onClick={() => handleResetTour(id)}
                    disabled={resettingTour === id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 border border-white/[0.08] hover:bg-white/[0.06]/[0.07] rounded-lg transition disabled:opacity-50"
                  >
                    {resettingTour === id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Resetovat pro mě
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Poznámka: Reset průvodce je individuální – ovlivňuje pouze váš účet.
              Pro reset pro všechny uživatele je třeba, aby si každý resetoval průvodce sám,
              nebo kontaktujte podporu.
            </p>
          </div>
        </div>
      )}

      {/* Task Status Modal */}
      <Modal
        open={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
          setTaskForm({ key: '', label: '', color: '#64748b' });
        }}
        title={editingTask ? 'Upravit stav úkolu' : 'Nový stav úkolu'}
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowTaskModal(false);
                setEditingTask(null);
                setTaskForm({ key: '', label: '', color: '#64748b' });
              }}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveTaskStatus}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/100/100 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Klíč *</label>
            <input
              value={taskForm.key}
              onChange={(e) => setTaskForm({ ...taskForm, key: e.target.value })}
              disabled={!!editingTask}
              placeholder="např. todo, in_progress"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Klíč nelze změnit po vytvoření</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input
              value={taskForm.label}
              onChange={(e) => setTaskForm({ ...taskForm, label: e.target.value })}
              placeholder="např. K vyřízení"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setTaskForm({ ...taskForm, color: color.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                    taskForm.color === color.value
                      ? 'border-blue-500 bg-blue-500/100/10'
                      : 'border-white/[0.08] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="w-5 h-5 rounded border border-white/[0.08]" style={{ backgroundColor: color.value }} />
                  <span className="text-xs font-medium text-slate-300">{color.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Project Status Modal */}
      <Modal
        open={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setEditingProject(null);
          setProjectForm({ key: '', label: '', color: '#64748b' });
        }}
        title={editingProject ? 'Upravit stav projektu' : 'Nový stav projektu'}
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowProjectModal(false);
                setEditingProject(null);
                setProjectForm({ key: '', label: '', color: '#64748b' });
              }}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveProjectStatus}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/100/100 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Klíč *</label>
            <input
              value={projectForm.key}
              onChange={(e) => setProjectForm({ ...projectForm, key: e.target.value })}
              disabled={!!editingProject}
              placeholder="např. draft, execution"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Klíč nelze změnit po vytvoření</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input
              value={projectForm.label}
              onChange={(e) => setProjectForm({ ...projectForm, label: e.target.value })}
              placeholder="např. Realizace"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setProjectForm({ ...projectForm, color: color.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                    projectForm.color === color.value
                      ? 'border-blue-500 bg-blue-500/100/10'
                      : 'border-white/[0.08] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="w-5 h-5 rounded border border-white/[0.08]" style={{ backgroundColor: color.value }} />
                  <span className="text-xs font-medium text-slate-300">{color.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showServiceModal}
        onClose={() => {
          setShowServiceModal(false);
          setEditingService(null);
          setServiceForm({ name: '', interval_months: 12, description: '' });
        }}
        title={editingService ? 'Upravit typ servisu' : 'Nový typ servisu'}
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowServiceModal(false);
                setEditingService(null);
                setServiceForm({ name: '', interval_months: 12, description: '' });
              }}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveServiceType}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/100/100 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input
              value={serviceForm.name}
              onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              placeholder="např. Roční revize FVE"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výchozí interval (měsíce)</label>
            <input
              type="number"
              min={1}
              value={serviceForm.interval_months}
              onChange={(e) => setServiceForm({ ...serviceForm, interval_months: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">
              {serviceForm.interval_months >= 12 && serviceForm.interval_months % 12 === 0
                ? `= ${serviceForm.interval_months / 12} ${serviceForm.interval_months / 12 === 1 ? 'rok' : serviceForm.interval_months / 12 < 5 ? 'roky' : 'let'}`
                : `= ${serviceForm.interval_months} ${serviceForm.interval_months === 1 ? 'měsíc' : serviceForm.interval_months < 5 ? 'měsíce' : 'měsíců'}`
              }
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <textarea
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              rows={3}
              placeholder="Popis co servis zahrnuje..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          setEditingActivity(null);
          setActivityForm({ name: '', color: '#64748b' });
        }}
        title={editingActivity ? 'Upravit činnost' : 'Nová činnost'}
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowActivityModal(false);
                setEditingActivity(null);
                setActivityForm({ name: '', color: '#64748b' });
              }}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveActivity}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/100/100 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input
              value={activityForm.name}
              onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
              placeholder="např. Elektroinstalace"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setActivityForm({ ...activityForm, color: color.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                    activityForm.color === color.value
                      ? 'border-blue-500 bg-blue-500/100/10'
                      : 'border-white/[0.08] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="w-5 h-5 rounded border border-white/[0.08]" style={{ backgroundColor: color.value }} />
                  <span className="text-xs font-medium text-slate-300">{color.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nebo vlastní barva</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activityForm.color}
                  onChange={(e) => setActivityForm({ ...activityForm, color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                />
                <input
                  value={activityForm.color}
                  onChange={(e) => setActivityForm({ ...activityForm, color: e.target.value })}
                  className="w-28 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
