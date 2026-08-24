import { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, ChevronRight, AlertTriangle, CheckCircle2, Plus, Clock, CalendarCheck, X, User, RefreshCw, ClipboardList, CheckCheck, FileText, MapPin, ChevronDown, Banknote, CreditCard as Edit3, Phone, Mail, Building2, UserSearch, FileSpreadsheet, Lock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete';
import ClientAutocomplete from '../../components/ui/ClientAutocomplete';
import ServiceProtocolModal from '../../components/projects/ServiceProtocolModal';
import ServiceProtocolDetail from '../../components/projects/ServiceProtocolDetail';
import ServiceCompletionModal from './ServiceCompletionModal';
import ServiceEditModal from './ServiceEditModal';
import ServiceReportModal from '../../components/service/ServiceReportModal';
import ServiceWorkflowStepper, { WorkflowStatus, SERVICE_CATEGORY_LABELS } from '../../components/service/ServiceWorkflowStepper';

interface ScheduleRow {
  id: string;
  project_id: string | null;
  service_type_id: string;
  next_date: string;
  last_completed_date: string | null;
  scheduled_date: string | null;
  scheduled_note: string;
  notes: string;
  is_active: boolean;
  is_one_time: boolean;
  deadline: string | null;
  client_name: string;
  client_address: string;
  project_name: string;
  project_address: string;
  type_name: string;
  interval_months: number | null;
  agreed_price: number | null;
  final_price: number | null;
  price_change_note: string | null;
  billing_status: string;
  workflow_status: WorkflowStatus;
  service_category: string | null;
  report_required: boolean;
}

interface ReportInfo {
  id: string;
  status: string;
  total_price: number;
  locked_at: string | null;
  work_description?: string;
  findings?: string;
  recommendation?: string;
}

interface ReportItem {
  item_type: 'work' | 'material' | 'travel' | 'other';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  hours?: number;
  hourly_rate?: number;
}

const BILLING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_ready: { label: 'Nezpracováno', color: 'bg-slate-500/15 text-slate-300' },
  ready_for_invoicing: { label: 'K fakturaci', color: 'bg-amber-500/15 text-amber-300' },
  invoiced: { label: 'Vyfakturováno', color: 'bg-emerald-500/15 text-emerald-300' },
};

interface ServiceType {
  id: string;
  name: string;
  interval_months: number;
}

interface ProjectOption {
  id: string;
  project_name: string;
}

interface Protocol {
  id: string;
  protocol_number: string;
  service_date: string;
  technician_name: string;
  status: string;
}

type ViewTab = 'active' | 'completed';

export default function ServiceSchedulesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewTab, setViewTab] = useState<ViewTab>('active');
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [completedSchedules, setCompletedSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({ project_id: '', service_type_id: '', installation_date: '', interval_value: 12, interval_unit: 'months' as 'months' | 'years', notes: '', client_name: '', client_address: '', client_phone: '', client_email: '', client_ico: '', client_dic: '', address_lat: null as number | null, address_lon: null as number | null, is_one_time: false, deadline: '', agreed_price: '' });
  const [saving, setSaving] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [detailSchedule, setDetailSchedule] = useState<ScheduleRow | null>(null);
  const [detailProtocols, setDetailProtocols] = useState<Protocol[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [viewProtocolId, setViewProtocolId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionSchedule, setCompletionSchedule] = useState<ScheduleRow | null>(null);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportScheduleId, setReportScheduleId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ScheduleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailReport, setDetailReport] = useState<ReportInfo | null>(null);
  const [detailReportItems, setDetailReportItems] = useState<ReportItem[]>([]);
  const [protocolPrefillData, setProtocolPrefillData] = useState<{
    work_description?: string;
    findings?: string;
    recommendation?: string;
    items?: ReportItem[];
  } | null>(null);

  const enrichRows = async (rows: any[]) => {
    const projectIds = [...new Set(rows.filter(r => r.project_id).map(r => r.project_id))];
    const typeIds = [...new Set(rows.map(r => r.service_type_id))];
    let projectMap = new Map<string, { name: string; address: string }>();
    let typeMap = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projs } = await supabase.from('projects').select('id, project_name, address').in('id', projectIds);
      projectMap = new Map((projs || []).map((p: any) => [p.id, { name: p.project_name, address: p.address || '' }]));
    }
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from('service_types').select('id, name').in('id', typeIds);
      typeMap = new Map((types || []).map((t: any) => [t.id, t.name]));
    }
    return rows.map(r => ({
      ...r,
      client_name: r.client_name || '',
      client_address: r.client_address || '',
      scheduled_note: r.scheduled_note || '',
      project_name: r.project_id ? (projectMap.get(r.project_id)?.name || '') : '',
      project_address: r.project_id ? (projectMap.get(r.project_id)?.address || '') : '',
      type_name: typeMap.get(r.service_type_id) || '',
      interval_months: r.interval_months || null,
      agreed_price: r.agreed_price ?? null,
      final_price: r.final_price ?? null,
      price_change_note: r.price_change_note ?? null,
      billing_status: r.billing_status || 'not_ready',
      workflow_status: (r.workflow_status || 'new') as WorkflowStatus,
      service_category: r.service_category || null,
      report_required: r.report_required !== false,
    }));
  };

  const loadSchedules = useCallback(async () => {
    const selectFields = 'id, project_id, service_type_id, next_date, last_completed_date, scheduled_date, scheduled_note, notes, is_active, is_one_time, deadline, client_name, client_address, interval_months, agreed_price, final_price, price_change_note, billing_status, workflow_status, service_category, report_required';
    const [activeRes, completedRes] = await Promise.all([
      supabase
        .from('service_schedules')
        .select(selectFields)
        .eq('is_active', true)
        .order('next_date'),
      supabase
        .from('service_schedules')
        .select(selectFields)
        .eq('is_active', false)
        .order('last_completed_date', { ascending: false }),
    ]);

    const [active, completed] = await Promise.all([
      enrichRows((activeRes.data || []) as any[]),
      enrichRows((completedRes.data || []) as any[]),
    ]);

    setSchedules(active);
    setCompletedSchedules(completed);
    setLoading(false);
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const loadDetailProtocols = async (scheduleId: string) => {
    setDetailLoading(true);
    const [protocolsRes, reportRes] = await Promise.all([
      supabase
        .from('service_protocols')
        .select('id, protocol_number, service_date, technician_name, status')
        .eq('schedule_id', scheduleId)
        .order('service_date', { ascending: false }),
      supabase
        .from('service_reports')
        .select('id, status, total_price, locked_at, work_description, findings, recommendation')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setDetailProtocols((protocolsRes.data || []) as Protocol[]);
    setDetailReport(reportRes.data);

    if (reportRes.data?.id) {
      const { data: itemsData } = await supabase
        .from('service_report_items')
        .select('item_type, description, quantity, unit, unit_price, total_price, hours, hourly_rate')
        .eq('report_id', reportRes.data.id)
        .order('sort_order');
      setDetailReportItems((itemsData || []) as ReportItem[]);
    } else {
      setDetailReportItems([]);
    }
    setDetailLoading(false);
  };

  const openDetail = (s: ScheduleRow) => {
    if (s.project_id) {
      navigate(`/projekty/${s.project_id}`);
      return;
    }
    setDetailSchedule(s);
    loadDetailProtocols(s.id);
  };

  const handleOpenCompletionModal = () => {
    if (!detailSchedule) return;
    setCompletionSchedule(detailSchedule);
    setShowCompletionModal(true);
  };

  const handleOpenCompletionForSchedule = (schedule: ScheduleRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletionSchedule(schedule);
    setShowCompletionModal(true);
  };

  const handleCompletionDone = async () => {
    setShowCompletionModal(false);
    if (detailSchedule) {
      const today = new Date().toISOString().slice(0, 10);
      setDetailSchedule(prev => prev ? { ...prev, last_completed_date: today } : prev);
      setShowProtocolModal(true);
    }
    setCompletionSchedule(null);
    await loadSchedules();
  };

  const handleOpenModal = async () => {
    const [typesRes, projectsRes] = await Promise.all([
      supabase.from('service_types').select('id, name, interval_months').eq('is_active', true).order('sort_order'),
      supabase.from('projects').select('id, project_name').order('project_name'),
    ]);
    setServiceTypes((typesRes.data || []) as ServiceType[]);
    setProjects((projectsRes.data || []) as ProjectOption[]);
    const firstType = (typesRes.data || [])[0] as ServiceType | undefined;
    const intMonths = firstType?.interval_months || 12;
    const unit: 'months' | 'years' = intMonths >= 12 && intMonths % 12 === 0 ? 'years' : 'months';
    const value = unit === 'years' ? intMonths / 12 : intMonths;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const defaultDateStr = defaultDate.toISOString().split('T')[0];
    setForm({ project_id: '', service_type_id: firstType?.id || '', installation_date: defaultDateStr, interval_value: value, interval_unit: unit, notes: '', client_name: '', client_address: '', client_phone: '', client_email: '', client_ico: '', client_dic: '', address_lat: null, address_lon: null, is_one_time: false, deadline: defaultDateStr, agreed_price: '' });
    setShowModal(true);
  };

  const computeNextDate = (installDate: string, value: number, unit: 'months' | 'years') => {
    if (!installDate || !value) return '';
    const d = new Date(installDate);
    d.setMonth(d.getMonth() + (unit === 'years' ? value * 12 : value));
    return d.toISOString().slice(0, 10);
  };

  const handleSave = async () => {
    const hasProject = !!form.project_id;
    const hasClient = !!form.client_name.trim();
    if ((!hasProject && !hasClient) || !form.service_type_id || !user) return;
    if (!form.is_one_time && (!form.installation_date || !form.interval_value)) return;
    setSaving(true);
    const intervalMonths = form.interval_unit === 'years' ? form.interval_value * 12 : form.interval_value;
    const nextDate = form.is_one_time
      ? (form.deadline || new Date().toISOString().slice(0, 10))
      : computeNextDate(form.installation_date, form.interval_value, form.interval_unit);
    const agreedPrice = form.agreed_price ? parseFloat(form.agreed_price) : null;
    const payload: Record<string, unknown> = {
      service_type_id: form.service_type_id,
      interval_months: form.is_one_time ? 0 : intervalMonths,
      next_date: nextDate,
      notes: form.notes,
      created_by: user.id,
      is_one_time: form.is_one_time,
      deadline: form.is_one_time && form.deadline ? form.deadline : null,
      installation_date: form.is_one_time ? null : (form.installation_date || null),
      agreed_price: agreedPrice,
      billing_status: 'not_ready',
    };
    if (hasProject) {
      payload.project_id = form.project_id;
    } else {
      payload.client_name = form.client_name.trim();
      payload.client_address = form.client_address.trim();
      payload.client_phone = form.client_phone.trim();
      payload.client_email = form.client_email.trim();
      payload.client_ico = form.client_ico.trim();
      payload.client_dic = form.client_dic.trim();
      payload.address_lat = form.address_lat;
      payload.address_lon = form.address_lon;
    }
    const { error } = await supabase.from('service_schedules').insert(payload);
    setSaving(false);
    if (error) { toast('Chyba při ukládání', 'error'); return; }
    toast('Servis naplánován');
    setShowModal(false);
    loadSchedules();
  };

  const openDateEdit = (s: ScheduleRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSchedule(s);
    setEditDate(s.scheduled_date || s.next_date);
    setEditNote(s.scheduled_note || '');
  };

  const handleSaveDate = async () => {
    if (!editingSchedule || !editDate) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('service_schedules')
      .update({ scheduled_date: editDate, scheduled_note: editNote })
      .eq('id', editingSchedule.id);
    setEditSaving(false);
    if (error) { toast('Chyba při ukládání termínu', 'error'); return; }
    toast('Termín servisu nastaven – zobrazí se v kalendáři');
    setEditingSchedule(null);
    loadSchedules();
  };

  const handleClearDate = async () => {
    if (!editingSchedule) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('service_schedules')
      .update({ scheduled_date: null, scheduled_note: '' })
      .eq('id', editingSchedule.id);
    setEditSaving(false);
    if (error) { toast('Chyba při mazání termínu', 'error'); return; }
    toast('Termín servisu zrušen');
    setEditingSchedule(null);
    loadSchedules();
  };

  const handleDeleteSchedule = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const id = deleteConfirm.id;
    const reportsRes = await supabase.from('service_reports').select('id').eq('schedule_id', id);
    const reportIds = (reportsRes.data || []).map((r: any) => r.id);
    if (reportIds.length > 0) {
      await supabase.from('service_report_items').delete().in('report_id', reportIds);
    }
    await Promise.all([
      supabase.from('service_work_entries').delete().eq('schedule_id', id),
      supabase.from('service_material_entries').delete().eq('schedule_id', id),
      supabase.from('service_reports').delete().eq('schedule_id', id),
      supabase.from('service_protocols').delete().eq('schedule_id', id),
    ]);
    const { error } = await supabase.from('service_schedules').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      toast('Chyba pri mazani servisu', 'error');
      return;
    }
    toast('Servis byl smazan');
    setDeleteConfirm(null);
    if (detailSchedule?.id === id) setDetailSchedule(null);
    loadSchedules();
  };

  const today = new Date().toISOString().slice(0, 10);

  const filterRows = (rows: ScheduleRow[]) => rows.filter(s => {
    if (viewTab === 'active' && showOverdueOnly && s.next_date >= today) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const displayName = s.project_id ? s.project_name : s.client_name;
    const displayAddress = s.project_id ? s.project_address : s.client_address;
    return s.type_name.toLowerCase().includes(q) || displayName.toLowerCase().includes(q) || displayAddress.toLowerCase().includes(q);
  });

  const filtered = filterRows(viewTab === 'active' ? schedules : completedSchedules);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  const overdueCount = schedules.filter(s => s.next_date < today).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-white/[0.04] rounded-xl border border-white/[0.08] p-1 gap-1">
          <button
            onClick={() => setViewTab('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              viewTab === 'active' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Aktivní
            {schedules.length > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${viewTab === 'active' ? 'bg-white/20 text-white' : 'bg-white/[0.08] text-slate-400'}`}>
                {schedules.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewTab('completed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              viewTab === 'completed' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Hotové
            {completedSchedules.length > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${viewTab === 'completed' ? 'bg-white/20 text-white' : 'bg-white/[0.08] text-slate-400'}`}>
                {completedSchedules.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat servisy..." className="w-full pl-10 pr-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        {viewTab === 'active' && overdueCount > 0 && (
          <button
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition ${
              showOverdueOnly ? 'bg-red-500/10 border-red-200 text-red-400' : 'bg-white/[0.06] border-white/10 text-slate-400 hover:bg-white/[0.04]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Po termínu ({overdueCount})
          </button>
        )}
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition ml-auto"
        >
          <Plus className="w-3.5 h-3.5" /> Naplánovat servis
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {search || showOverdueOnly
              ? 'Žádné servisy odpovídající filtru'
              : viewTab === 'completed'
                ? 'Žádné dokončené servisy'
                : 'Žádné plánované servisy'}
          </p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {filtered.map(s => {
            const overdue = viewTab === 'active' && s.next_date < today;
            const daysUntil = Math.ceil((new Date(s.next_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const isCompleted = viewTab === 'completed';
            return (
              <div
                key={s.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition cursor-pointer"
                onClick={() => openDetail(s)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isCompleted ? 'bg-emerald-500/10' : overdue ? 'bg-red-500/10' : 'bg-blue-500/10'
                }`}>
                  {isCompleted
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : <Calendar className={`w-5 h-5 ${overdue ? 'text-red-400' : 'text-blue-400'}`} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                    {s.type_name}
                    {s.is_one_time && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">Jednorázový</span>
                    )}
                    {!s.project_id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 shrink-0 flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />Bez projektu
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {s.project_id ? (
                      <span>{s.project_name}{s.project_address ? ` | ${s.project_address}` : ''}</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {s.client_name}{s.client_address ? ` | ${s.client_address}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {(s.agreed_price != null || s.final_price != null) && (
                  <div className="shrink-0 text-right px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs font-bold text-emerald-400 tabular-nums">
                      {(s.final_price ?? s.agreed_price)?.toLocaleString('cs-CZ')} Kč
                    </div>
                    <div className="text-[9px] text-emerald-500/70">
                      {s.final_price != null ? 'Konečná' : 'Dohodnutá'}
                    </div>
                  </div>
                )}

                {s.billing_status && s.billing_status !== 'not_ready' && (
                  <div className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${BILLING_STATUS_MAP[s.billing_status]?.color || ''}`}>
                    {BILLING_STATUS_MAP[s.billing_status]?.label || s.billing_status}
                  </div>
                )}

                {!isCompleted && (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditScheduleId(s.id); }}
                      className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition text-slate-400 hover:text-white"
                      title="Upravit servis"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s); }}
                      className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 transition text-slate-400 hover:text-red-400"
                      title="Smazat servis"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleOpenCompletionForSchedule(s, e)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition text-emerald-400"
                      title="Dokončit servis"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Dokončit</span>
                    </button>
                    {s.scheduled_date ? (
                      <button
                        onClick={(e) => openDateEdit(s, e)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-100 hover:bg-cyan-500/20 transition"
                        title="Naplanovaný termin - kliknete pro upravu"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-cyan-600" />
                        <span className="text-xs font-semibold text-cyan-700">
                          {new Date(s.scheduled_date).toLocaleDateString('cs-CZ')}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => openDateEdit(s, e)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition text-slate-500 hover:text-slate-300"
                        title="Naplánovat přesný termín"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Naplánovat</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="text-right shrink-0">
                  {isCompleted ? (
                    <>
                      <div className="text-xs font-semibold text-emerald-400">
                        {s.last_completed_date ? new Date(s.last_completed_date).toLocaleDateString('cs-CZ') : '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">Dokončeno</div>
                    </>
                  ) : (
                    <>
                      <div className={`text-xs font-semibold ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
                        {new Date(s.next_date).toLocaleDateString('cs-CZ')}
                      </div>
                      <div className={`text-[10px] font-bold ${overdue ? 'text-red-500' : daysUntil <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {overdue ? `${Math.abs(daysUntil)} dni po terminu` : `za ${daysUntil} dní`}
                      </div>
                    </>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {detailSchedule && !detailSchedule.project_id && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setDetailSchedule(null)}>
          <div className="flex-1" />
          <div
            className="w-full max-w-md bg-navy-900 border-l border-white/[0.08] flex flex-col h-full shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-navy-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{detailSchedule.type_name}</h3>
                  <p className="text-[11px] text-slate-400">Detail servisního záznamu</p>
                </div>
              </div>
              <button onClick={() => setDetailSchedule(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              <ServiceWorkflowStepper
                currentStatus={detailSchedule.workflow_status}
                hasScheduledDate={!!detailSchedule.scheduled_date}
                hasReport={!!detailReport}
                hasLockedReport={!!detailReport?.locked_at}
                hasProtocol={detailProtocols.length > 0}
                isBilled={detailSchedule.billing_status === 'invoiced'}
              />

              {detailSchedule.service_category && SERVICE_CATEGORY_LABELS[detailSchedule.service_category] && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${SERVICE_CATEGORY_LABELS[detailSchedule.service_category].color}`}>
                  {SERVICE_CATEGORY_LABELS[detailSchedule.service_category].label}
                </div>
              )}

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />Klient
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{detailSchedule.client_name}</div>
                  {detailSchedule.client_address && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {detailSchedule.client_address}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Další servis</div>
                  <div className={`text-sm font-semibold ${detailSchedule.next_date < today ? 'text-red-400' : 'text-white'}`}>
                    {new Date(detailSchedule.next_date).toLocaleDateString('cs-CZ')}
                  </div>
                  {detailSchedule.next_date < today && (
                    <div className="text-[10px] text-red-500 mt-0.5">Po termínu</div>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Poslední dokončení</div>
                  <div className="text-sm font-semibold text-white">
                    {detailSchedule.last_completed_date
                      ? new Date(detailSchedule.last_completed_date).toLocaleDateString('cs-CZ')
                      : <span className="text-slate-500">Nikdy</span>}
                  </div>
                </div>
              </div>

              {detailSchedule.is_one_time ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300 font-medium">Jednorázový servis{detailSchedule.deadline ? ` – termín do ${new Date(detailSchedule.deadline).toLocaleDateString('cs-CZ')}` : ''}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-300 font-medium">Opakovaný servis – interval {detailSchedule.interval_months || 12} měsíců</span>
                </div>
              )}

              {detailSchedule.notes && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Poznámky</div>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detailSchedule.notes}</div>
                </div>
              )}

              {(detailSchedule.agreed_price != null || detailSchedule.final_price != null || detailSchedule.billing_status !== 'not_ready') && (
                <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/5 to-green-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <Banknote className="w-3.5 h-3.5" />Fakturace
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {detailSchedule.agreed_price != null && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-0.5">Dohodnutá cena</div>
                        <div className="text-sm font-bold text-white">{detailSchedule.agreed_price.toLocaleString('cs-CZ')} Kč</div>
                      </div>
                    )}
                    {detailSchedule.final_price != null && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-0.5">Konečná cena</div>
                        <div className="text-sm font-bold text-emerald-400">{detailSchedule.final_price.toLocaleString('cs-CZ')} Kč</div>
                      </div>
                    )}
                  </div>
                  {detailSchedule.price_change_note && (
                    <div className="text-xs text-slate-400 italic">
                      Poznámka: {detailSchedule.price_change_note}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${BILLING_STATUS_MAP[detailSchedule.billing_status]?.color || 'bg-slate-500/15 text-slate-300'}`}>
                      {BILLING_STATUS_MAP[detailSchedule.billing_status]?.label || detailSchedule.billing_status}
                    </span>
                  </div>
                </div>
              )}

              {detailSchedule.report_required && (
                <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-orange-500/5 to-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                    <FileSpreadsheet className="w-3.5 h-3.5" />Servisní výkaz
                  </div>
                  {detailReport ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {detailReport.total_price?.toLocaleString('cs-CZ') || 0} Kč
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          {detailReport.locked_at ? (
                            <>
                              <Lock className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Uzamčen</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3" />
                              <span>Koncept</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setReportScheduleId(detailSchedule.id); setShowReportModal(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Upravit výkaz
                        </button>
                        {detailReport.locked_at && (
                          <button
                            onClick={() => {
                              setProtocolPrefillData({
                                work_description: detailReport.work_description,
                                findings: detailReport.findings,
                                recommendation: detailReport.recommendation,
                                items: detailReportItems,
                              });
                              setShowProtocolModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold hover:bg-blue-500/25 transition"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Vytvořit protokol
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReportScheduleId(detailSchedule.id); setShowReportModal(true); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition"
                    >
                      <Plus className="w-4 h-4" />
                      Vytvořit výkaz
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleOpenCompletionModal}
                  disabled={detailSchedule.report_required && !detailReport?.locked_at}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCheck className="w-4 h-4" />
                  Dokončit servis
                </button>
                <button
                  onClick={() => setDeleteConfirm(detailSchedule)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold text-sm transition"
                  title="Smazat servis"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {detailSchedule.report_required && !detailReport?.locked_at && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300 font-medium">Pro dokončení je nutné nejprve uzamknout výkaz</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Protokoly ({detailProtocols.length})
                  </div>
                  <button
                    onClick={() => setShowProtocolModal(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition"
                  >
                    <Plus className="w-3 h-3" />Nový protokol
                  </button>
                </div>
                {detailLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />)}
                  </div>
                ) : detailProtocols.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <FileText className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                    Zatím žádné protokoly
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailProtocols.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setViewProtocolId(p.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white">{p.protocol_number}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(p.service_date).toLocaleDateString('cs-CZ')} &bull; {p.technician_name}
                          </div>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 rotate-[-90deg]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editingSchedule} onClose={() => setEditingSchedule(null)} title="Naplánovat termín servisu" size="sm" footer={
        <>
          {editingSchedule?.scheduled_date && (
            <button onClick={handleClearDate} disabled={editSaving} className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition mr-auto">
              Zrušit termín
            </button>
          )}
          <button onClick={() => setEditingSchedule(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zavřít</button>
          <button
            onClick={handleSaveDate}
            disabled={editSaving || !editDate}
            className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition disabled:opacity-50"
          >
            {editSaving ? 'Ukládám...' : 'Uložit do kalendáře'}
          </button>
        </>
      }>
        {editingSchedule && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="text-sm font-semibold text-white">{editingSchedule.type_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{editingSchedule.project_id ? editingSchedule.project_name : editingSchedule.client_name}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Další servis do: {new Date(editingSchedule.next_date).toLocaleDateString('cs-CZ')}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum servisního výjezdu *</label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                rows={2}
                placeholder="Čas, technik, speciální požadavky..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </div>

            {editDate && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-100">
                <CalendarCheck className="w-4 h-4 text-cyan-600 shrink-0" />
                <span className="text-sm text-slate-400">Zobrazí se v kalendáři dne</span>
                <span className="text-sm font-semibold text-cyan-700">{new Date(editDate).toLocaleDateString('cs-CZ')}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Naplánovat servis" size="md" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button
            onClick={handleSave}
            disabled={saving || (!form.project_id && !form.client_name.trim()) || !form.service_type_id || (!form.is_one_time && (!form.installation_date || !form.interval_value))}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : 'Naplánovat'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
            <select
              value={form.project_id}
              onChange={e => setForm({ ...form, project_id: e.target.value, client_name: e.target.value ? '' : form.client_name, client_address: e.target.value ? '' : form.client_address })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">-- Bez projektu (ruční zápis) --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          {!form.project_id && (
            <div className="space-y-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3 h-3" />
                Ruční zápis - údaje klienta
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <UserSearch className="w-3 h-3" /> Vyhledat existujícího klienta
                </label>
                <ClientAutocomplete
                  onSelect={(client) => {
                    setForm(prev => ({
                      ...prev,
                      client_name: client.name || '',
                      client_email: client.email || '',
                      client_phone: client.phone || '',
                      client_address: client.address || '',
                      client_ico: client.ico || '',
                      client_dic: client.dic || '',
                      address_lat: client.address_lat,
                      address_lon: client.address_lon,
                    }));
                  }}
                  placeholder="Hledat klienta podle jména, emailu, telefonu nebo IČO..."
                />
              </div>

              {form.client_name && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {form.client_ico ? (
                        <Building2 className="w-4 h-4 text-blue-400" />
                      ) : (
                        <User className="w-4 h-4 text-blue-400" />
                      )}
                      <span className="text-sm font-bold text-white">{form.client_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        client_name: '',
                        client_email: '',
                        client_phone: '',
                        client_address: '',
                        client_ico: '',
                        client_dic: '',
                        address_lat: null,
                        address_lon: null,
                      }))}
                      className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    {form.client_phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {form.client_phone}
                      </div>
                    )}
                    {form.client_email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {form.client_email}
                      </div>
                    )}
                    {form.client_address && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{form.client_address}</span>
                      </div>
                    )}
                    {form.client_ico && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        ICO: {form.client_ico}
                      </div>
                    )}
                    {form.client_dic && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        DIC: {form.client_dic}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-2 border-t border-white/[0.06]">
                Nebo vyplňte ručně
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno klienta / objekt *</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={e => setForm({ ...form, client_name: e.target.value })}
                    placeholder="Jan Novak / Firma s.r.o."
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefon
                  </label>
                  <input
                    type="tel"
                    value={form.client_phone}
                    onChange={e => setForm({ ...form, client_phone: e.target.value })}
                    placeholder="+420 123 456 789"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Adresa (s vyhledáváním)
                </label>
                <AddressAutocomplete
                  value={form.client_address}
                  lat={form.address_lat}
                  lon={form.address_lon}
                  onChange={(address, lat, lon) => setForm({ ...form, client_address: address, address_lat: lat, address_lon: lon })}
                  placeholder="Zadejte ulici a město..."
                  includeClients
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={e => setForm({ ...form, client_email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> ICO
                  </label>
                  <input
                    type="text"
                    value={form.client_ico}
                    onChange={e => setForm({ ...form, client_ico: e.target.value })}
                    placeholder="12345678"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> DIC
                  </label>
                  <input
                    type="text"
                    value={form.client_dic}
                    onChange={e => setForm({ ...form, client_dic: e.target.value })}
                    placeholder="CZ12345678"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ servisu *</label>
            <select
              value={form.service_type_id}
              onChange={e => {
                const sType = serviceTypes.find(t => t.id === e.target.value);
                const intMonths = sType?.interval_months || 12;
                const unit: 'months' | 'years' = intMonths >= 12 && intMonths % 12 === 0 ? 'years' : 'months';
                const value = unit === 'years' ? intMonths / 12 : intMonths;
                setForm({ ...form, service_type_id: e.target.value, interval_value: value, interval_unit: unit });
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {serviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_one_time}
              onChange={e => setForm({ ...form, is_one_time: e.target.checked })}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <div>
              <span className="text-sm font-semibold text-white">Jednorázový servis</span>
              <span className="text-[10px] text-slate-500 block">Např. reklamace – bez opakování</span>
            </div>
          </label>
          {form.is_one_time ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Provést do</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Datum, do kdy ma byt servis proveden</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Další servis do *</label>
                <input
                  type="date"
                  value={form.installation_date}
                  onChange={e => setForm({ ...form, installation_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Datum prvního servisu</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Pak opakovat každých *</label>
                  <input
                    type="number"
                    min={1}
                    value={form.interval_value}
                    onChange={e => setForm({ ...form, interval_value: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex-1">
                  <select
                    value={form.interval_unit}
                    onChange={e => setForm({ ...form, interval_unit: e.target.value as 'months' | 'years' })}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="months">měsíců</option>
                    <option value="years">let</option>
                  </select>
                </div>
              </div>
              {form.installation_date && form.interval_value > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-slate-400">Následující servis po tomto:</span>
                  <span className="text-sm font-semibold text-blue-400">
                    {new Date(computeNextDate(form.installation_date, form.interval_value, form.interval_unit)).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              Dohodnutá cena
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.agreed_price}
                onChange={e => setForm({ ...form, agreed_price: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Kč</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Nepovinné – cena dohodnutá se zákazníkem</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </Modal>

      {detailSchedule && (
        <ServiceProtocolModal
          open={showProtocolModal}
          onClose={() => { setShowProtocolModal(false); setProtocolPrefillData(null); }}
          scheduleId={detailSchedule.id}
          clientName={detailSchedule.client_name}
          clientAddress={detailSchedule.client_address}
          prefillDescription={detailSchedule.type_name}
          prefillFromReport={protocolPrefillData || undefined}
          onSaved={() => {
            loadDetailProtocols(detailSchedule.id);
            setProtocolPrefillData(null);
          }}
        />
      )}

      {viewProtocolId && (
        <ServiceProtocolDetail
          open={!!viewProtocolId}
          onClose={() => setViewProtocolId(null)}
          protocolId={viewProtocolId}
        />
      )}

      {completionSchedule && (
        <ServiceCompletionModal
          open={showCompletionModal}
          schedule={{
            id: completionSchedule.id,
            type_name: completionSchedule.type_name,
            client_name: completionSchedule.client_name,
            client_address: completionSchedule.client_address,
            agreed_price: completionSchedule.agreed_price,
            is_one_time: completionSchedule.is_one_time,
            interval_months: completionSchedule.interval_months,
            next_date: completionSchedule.next_date,
            service_type_id: completionSchedule.service_type_id,
            project_id: completionSchedule.project_id,
            notes: completionSchedule.notes,
          }}
          onClose={() => { setShowCompletionModal(false); setCompletionSchedule(null); }}
          onCompleted={handleCompletionDone}
        />
      )}

      {editScheduleId && (
        <ServiceEditModal
          open={!!editScheduleId}
          scheduleId={editScheduleId}
          onClose={() => setEditScheduleId(null)}
          onSaved={() => {
            setEditScheduleId(null);
            loadSchedules();
          }}
          onDelete={() => {
            const schedule = schedules.find(s => s.id === editScheduleId) || completedSchedules.find(s => s.id === editScheduleId);
            if (schedule) {
              setEditScheduleId(null);
              setDeleteConfirm(schedule);
            }
          }}
        />
      )}

      {showReportModal && reportScheduleId && (
        <ServiceReportModal
          scheduleId={reportScheduleId}
          reportId={detailReport?.id || null}
          onClose={() => { setShowReportModal(false); setReportScheduleId(null); }}
          onSave={() => {
            if (detailSchedule) loadDetailProtocols(detailSchedule.id);
            loadSchedules();
          }}
        />
      )}

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Smazat plánovaný servis"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleDeleteSchedule}
              disabled={deleting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Mažu...' : 'Smazat'}
            </button>
          </>
        }
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div className="text-sm text-slate-300">
                Opravdu chcete smazat tento servis? Budou odstraněny i všechny související záznamy (protokoly, výkazy, materiál). Tuto akci nelze vrátit.
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="text-sm font-semibold text-white">{deleteConfirm.type_name}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {deleteConfirm.project_id ? deleteConfirm.project_name : deleteConfirm.client_name}
                {(deleteConfirm.project_id ? deleteConfirm.project_address : deleteConfirm.client_address) &&
                  ` | ${deleteConfirm.project_id ? deleteConfirm.project_address : deleteConfirm.client_address}`}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Další servis: {new Date(deleteConfirm.next_date).toLocaleDateString('cs-CZ')}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
