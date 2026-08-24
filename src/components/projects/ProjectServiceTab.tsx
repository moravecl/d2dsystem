import { useState, useEffect, useCallback } from 'react';
import { Plus, Shield, Cpu, Calendar, AlertTriangle, CreditCard as Edit2, Trash2, Wrench, CheckCircle2, ArrowRight, FileText, ClipboardList, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import ServiceProtocolModal from './ServiceProtocolModal';
import ServiceProtocolDetail from './ServiceProtocolDetail';
import WarrantyClaimModal from './WarrantyClaimModal';
import WarrantyClaimDetail from './WarrantyClaimDetail';

interface ServiceType {
  id: string;
  name: string;
  interval_months: number;
  description: string;
}

interface ServiceSchedule {
  id: string;
  project_id: string;
  service_type_id: string;
  next_date: string;
  last_completed_date: string | null;
  notes: string;
  is_active: boolean;
  installation_date: string | null;
  interval_months: number;
  is_one_time: boolean;
  deadline: string | null;
}

interface InstalledDevice {
  id: string;
  project_id: string;
  device_type: string;
  name: string;
  manufacturer: string;
  serial_number: string;
  installation_date: string | null;
  warranty_years: number;
  warranty_end_date: string | null;
  notes: string;
}

interface ServiceTicket {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  reported_by_portal: boolean;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution_notes: string;
  created_at: string;
}

interface ServiceProtocol {
  id: string;
  protocol_number: string;
  service_date: string;
  technician_name: string;
  description: string;
  status: string;
  schedule_id: string | null;
  ticket_id: string | null;
  created_at: string;
  labor_total: number;
  material_total: number;
}

interface WarrantyClaim {
  id: string;
  claim_number: string;
  claim_type: string;
  claim_date: string;
  original_device_name: string;
  status: string;
  is_warranty: boolean;
  total_cost: number;
  device_id: string;
  customer_signature: string;
}

const DEVICE_TYPES: Record<string, { label: string; icon: string }> = {
  stridac: { label: 'Střídač', icon: '⚡' },
  baterie: { label: 'Baterie', icon: '🔋' },
  wallbox: { label: 'Wallbox', icon: '🔌' },
  tepelne_cerpadlo: { label: 'Tepelné čerpadlo', icon: '🌡️' },
  rekuperace: { label: 'Rekuperace', icon: '💨' },
  other: { label: 'Ostatní', icon: '📦' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'Otevřený', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Řeší se', color: 'bg-amber-500/20 text-amber-400' },
  resolved: { label: 'Vyřešeno', color: 'bg-emerald-500/20 text-emerald-400' },
  closed: { label: 'Uzavřeno', color: 'bg-white/[0.06] text-slate-400' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'Nízká', color: 'text-slate-500' },
  normal: { label: 'Normální', color: 'text-blue-400' },
  high: { label: 'Vysoká', color: 'text-amber-400' },
  urgent: { label: 'Urgentní', color: 'text-red-400' },
};

export default function ProjectServiceTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [devices, setDevices] = useState<InstalledDevice[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'schedules' | 'devices' | 'tickets' | 'protocols'>('schedules');
  const [protocols, setProtocols] = useState<ServiceProtocol[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ServiceSchedule | null>(null);
  const [editDevice, setEditDevice] = useState<InstalledDevice | null>(null);
  const [editTicket, setEditTicket] = useState<ServiceTicket | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    service_type_id: '', installation_date: '', interval_value: 12, interval_unit: 'months' as 'months' | 'years', notes: '', is_one_time: false, deadline: '',
  });
  const [deviceForm, setDeviceForm] = useState({
    device_type: 'stridac', name: '', manufacturer: '', serial_number: '',
    installation_date: '', warranty_years: 2, notes: '',
  });
  const [ticketForm, setTicketForm] = useState({
    title: '', description: '', status: 'open', priority: 'normal', assigned_to: '',
  });
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [protocolContext, setProtocolContext] = useState<{ scheduleId?: string; ticketId?: string; description?: string }>({});
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertTicket, setConvertTicket] = useState<ServiceTicket | null>(null);
  const [detailProtocolId, setDetailProtocolId] = useState<string | null>(null);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimDevice, setClaimDevice] = useState<InstalledDevice | null>(null);
  const [detailClaimId, setDetailClaimId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [typesRes, schedRes, devRes, tickRes, protoRes, claimsRes] = await Promise.all([
      supabase.from('service_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('service_schedules').select('*').eq('project_id', projectId).order('next_date'),
      supabase.from('installed_devices').select('*').eq('project_id', projectId).order('name'),
      supabase.from('service_tickets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('service_protocols').select('id, protocol_number, service_date, technician_name, description, status, schedule_id, ticket_id, created_at').eq('project_id', projectId).order('service_date', { ascending: false }),
      supabase.from('warranty_claims').select('id, claim_number, claim_type, claim_date, original_device_name, status, is_warranty, total_cost, device_id, customer_signature').eq('project_id', projectId).order('claim_date', { ascending: false }),
    ]);
    setServiceTypes((typesRes.data || []) as ServiceType[]);
    setSchedules((schedRes.data || []) as ServiceSchedule[]);
    setDevices((devRes.data || []) as InstalledDevice[]);
    setTickets((tickRes.data || []) as ServiceTicket[]);
    setClaims((claimsRes.data || []) as WarrantyClaim[]);

    const protoRows = (protoRes.data || []) as any[];
    if (protoRows.length > 0) {
      const protoIds = protoRows.map((p: any) => p.id);
      const { data: workItems } = await supabase.from('service_work_items').select('protocol_id, type, total_price').in('protocol_id', protoIds);
      const totals: Record<string, { labor: number; material: number }> = {};
      (workItems || []).forEach((wi: any) => {
        if (!totals[wi.protocol_id]) totals[wi.protocol_id] = { labor: 0, material: 0 };
        if (wi.type === 'labor') totals[wi.protocol_id].labor += Number(wi.total_price);
        else totals[wi.protocol_id].material += Number(wi.total_price);
      });
      setProtocols(protoRows.map((p: any) => ({
        ...p,
        labor_total: totals[p.id]?.labor || 0,
        material_total: totals[p.id]?.material || 0,
      })));
    } else {
      setProtocols([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getTypeName = (id: string) => serviceTypes.find(t => t.id === id)?.name || '';

  const computeNextDate = (installDate: string, value: number, unit: 'months' | 'years') => {
    if (!installDate || !value) return '';
    const d = new Date(installDate);
    d.setMonth(d.getMonth() + (unit === 'years' ? value * 12 : value));
    return d.toISOString().slice(0, 10);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.service_type_id) return;
    if (!scheduleForm.is_one_time && (!scheduleForm.installation_date || !scheduleForm.interval_value)) return;
    const intervalMonths = scheduleForm.interval_unit === 'years' ? scheduleForm.interval_value * 12 : scheduleForm.interval_value;
    const nextDate = scheduleForm.is_one_time
      ? (scheduleForm.deadline || new Date().toISOString().slice(0, 10))
      : computeNextDate(scheduleForm.installation_date, scheduleForm.interval_value, scheduleForm.interval_unit);
    if (editSchedule) {
      const { error } = await supabase.from('service_schedules').update({
        service_type_id: scheduleForm.service_type_id,
        installation_date: scheduleForm.is_one_time ? null : (scheduleForm.installation_date || null),
        interval_months: scheduleForm.is_one_time ? 0 : intervalMonths,
        next_date: nextDate,
        notes: scheduleForm.notes,
        is_one_time: scheduleForm.is_one_time,
        deadline: scheduleForm.is_one_time && scheduleForm.deadline ? scheduleForm.deadline : null,
        updated_at: new Date().toISOString(),
      }).eq('id', editSchedule.id);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Servis aktualizován');
    } else {
      const { error } = await supabase.from('service_schedules').insert({
        project_id: projectId,
        service_type_id: scheduleForm.service_type_id,
        installation_date: scheduleForm.is_one_time ? null : (scheduleForm.installation_date || null),
        interval_months: scheduleForm.is_one_time ? 0 : intervalMonths,
        next_date: nextDate,
        notes: scheduleForm.notes,
        is_one_time: scheduleForm.is_one_time,
        deadline: scheduleForm.is_one_time && scheduleForm.deadline ? scheduleForm.deadline : null,
        created_by: user!.id,
      });
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Servis naplánován');
    }
    setShowScheduleModal(false);
    loadData();
  };

  const handleCompleteSchedule = async (sched: ServiceSchedule) => {
    const today = new Date().toISOString().slice(0, 10);
    if (sched.is_one_time) {
      await supabase.from('service_schedules').update({
        last_completed_date: today,
        is_active: false,
        updated_at: new Date().toISOString(),
      }).eq('id', sched.id);
      toast('Jednorázový servis dokončen');
    } else {
      const interval = sched.interval_months || serviceTypes.find(t => t.id === sched.service_type_id)?.interval_months || 12;
      const nextDate = new Date(sched.next_date);
      nextDate.setMonth(nextDate.getMonth() + interval);
      await supabase.from('service_schedules').update({
        last_completed_date: today,
        next_date: nextDate.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }).eq('id', sched.id);
      toast('Servis dokončen, další termín naplánován');
    }
    await loadData();
    const typeName = getTypeName(sched.service_type_id);
    setProtocolContext({ scheduleId: sched.id, description: `${typeName} - ${new Date().toLocaleDateString('cs-CZ')}` });
    setShowProtocolModal(true);
  };

  const handleConvertTicketToSchedule = async () => {
    if (!convertTicket || !scheduleForm.service_type_id) return;
    if (!scheduleForm.is_one_time && (!scheduleForm.installation_date || !scheduleForm.interval_value)) return;
    const intervalMonths = scheduleForm.interval_unit === 'years' ? scheduleForm.interval_value * 12 : scheduleForm.interval_value;
    const nextDate = scheduleForm.is_one_time
      ? (scheduleForm.deadline || new Date().toISOString().slice(0, 10))
      : computeNextDate(scheduleForm.installation_date, scheduleForm.interval_value, scheduleForm.interval_unit);
    const { error } = await supabase.from('service_schedules').insert({
      project_id: projectId,
      service_type_id: scheduleForm.service_type_id,
      installation_date: scheduleForm.is_one_time ? null : (scheduleForm.installation_date || null),
      interval_months: scheduleForm.is_one_time ? 0 : intervalMonths,
      next_date: nextDate,
      notes: `Z tiketu: ${convertTicket.title}`,
      is_one_time: scheduleForm.is_one_time,
      deadline: scheduleForm.is_one_time && scheduleForm.deadline ? scheduleForm.deadline : null,
      created_by: user!.id,
    });
    if (error) { toast('Chyba při vytváření servisu', 'error'); return; }
    toast('Plánovaný servis vytvořen z tiketu');
    setShowConvertModal(false);
    setConvertTicket(null);
    loadData();
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Smazat plánovaný servis?')) return;
    await supabase.from('service_schedules').update({ is_active: false }).eq('id', id);
    toast('Servis odstraněn');
    loadData();
  };

  const handleSaveDevice = async () => {
    if (!deviceForm.name.trim()) return;
    const warrantyEnd = deviceForm.installation_date
      ? (() => {
          const d = new Date(deviceForm.installation_date);
          d.setFullYear(d.getFullYear() + deviceForm.warranty_years);
          return d.toISOString().slice(0, 10);
        })()
      : null;

    const payload = {
      device_type: deviceForm.device_type,
      name: deviceForm.name,
      manufacturer: deviceForm.manufacturer,
      serial_number: deviceForm.serial_number,
      installation_date: deviceForm.installation_date || null,
      warranty_years: deviceForm.warranty_years,
      warranty_end_date: warrantyEnd,
      notes: deviceForm.notes,
      updated_at: new Date().toISOString(),
    };

    if (editDevice) {
      const { error } = await supabase.from('installed_devices').update(payload).eq('id', editDevice.id);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Zařízení aktualizováno');
    } else {
      const { error } = await supabase.from('installed_devices').insert({
        ...payload,
        project_id: projectId,
        created_by: user!.id,
      });
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Zařízení přidáno');
    }
    setShowDeviceModal(false);
    loadData();
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Smazat zařízení?')) return;
    await supabase.from('installed_devices').delete().eq('id', id);
    toast('Zařízení smazáno');
    loadData();
  };

  const handleSaveTicket = async () => {
    if (!ticketForm.title.trim()) return;
    const payload = {
      title: ticketForm.title,
      description: ticketForm.description,
      status: ticketForm.status,
      priority: ticketForm.priority,
      assigned_to: ticketForm.assigned_to || null,
      updated_at: new Date().toISOString(),
      ...(ticketForm.status === 'resolved' && !editTicket?.resolved_at ? { resolved_at: new Date().toISOString() } : {}),
    };

    if (editTicket) {
      const { error } = await supabase.from('service_tickets').update(payload).eq('id', editTicket.id);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Tiket aktualizován');
    } else {
      const { error } = await supabase.from('service_tickets').insert({
        ...payload,
        project_id: projectId,
      });
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Tiket vytvořen');
    }
    setShowTicketModal(false);
    loadData();
  };

  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();
  const isUpcoming = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const inMonth = new Date();
    inMonth.setDate(inMonth.getDate() + 30);
    return d >= now && d <= inMonth;
  };

  const warrantyExpiring = devices.filter(d => {
    if (!d.warranty_end_date) return false;
    const end = new Date(d.warranty_end_date);
    const inThreeMonths = new Date();
    inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);
    return end <= inThreeMonths;
  });

  const overdueSchedules = schedules.filter(s => s.is_active && isOverdue(s.next_date));
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {(overdueSchedules.length > 0 || warrantyExpiring.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {overdueSchedules.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <div className="text-xs font-bold text-red-400">{overdueSchedules.length} servis{overdueSchedules.length > 1 ? 'y' : ''} po termínu</div>
                <div className="text-[11px] text-red-400">{overdueSchedules.map(s => getTypeName(s.service_type_id)).join(', ')}</div>
              </div>
            </div>
          )}
          {warrantyExpiring.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Shield className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-400">{warrantyExpiring.length} záruk{warrantyExpiring.length > 1 ? 'y' : 'a'} brzy vyprší</div>
                <div className="text-[11px] text-amber-400">{warrantyExpiring.map(d => d.name).join(', ')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {[
          { key: 'schedules' as const, label: 'Plánované servisy', count: schedules.filter(s => s.is_active).length, icon: Calendar },
          { key: 'devices' as const, label: 'Instalovaná zařízení', count: devices.length, icon: Cpu },
          { key: 'tickets' as const, label: 'Servisní tikety', count: openTickets.length, icon: Wrench },
          { key: 'protocols' as const, label: 'Protokoly', count: protocols.length, icon: ClipboardList },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
 activeSection === tab.key
 ? 'bg-slate-900 text-white '
 : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
 }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
 activeSection === tab.key ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
 }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {activeSection === 'schedules' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Plánované servisy a revize</h3>
            <button
              onClick={() => {
                setEditSchedule(null);
                const first = serviceTypes[0];
                const intM = first?.interval_months || 12;
                const unit: 'months' | 'years' = intM >= 12 && intM % 12 === 0 ? 'years' : 'months';
                const val = unit === 'years' ? intM / 12 : intM;
                setScheduleForm({ service_type_id: first?.id || '', installation_date: '', interval_value: val, interval_unit: unit, notes: '', is_one_time: false, deadline: '' });
                setShowScheduleModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Naplánovat
            </button>
          </div>

          {schedules.filter(s => s.is_active).length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádné plánované servisy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.filter(s => s.is_active).map(sched => {
                const overdue = isOverdue(sched.next_date);
                const upcoming = isUpcoming(sched.next_date);
                return (
                  <div key={sched.id} className={`flex items-center gap-4 p-4 rounded-xl border transition ${
 overdue ? 'bg-red-500/10 border-red-500/20' : upcoming ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/[0.06] border-white/[0.08]'
 }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
 overdue ? 'bg-red-500/20' : upcoming ? 'bg-amber-500/20' : 'bg-blue-500/10'
 }`}>
                      <Calendar className={`w-5 h-5 ${overdue ? 'text-red-400' : upcoming ? 'text-amber-400' : 'text-blue-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{getTypeName(sched.service_type_id)}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        {sched.is_one_time && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Jednorázový</span>
                        )}
                        {sched.is_one_time ? (
                          <>
                            {sched.deadline && <span>Termín do: {new Date(sched.deadline).toLocaleDateString('cs-CZ')}</span>}
                            {sched.next_date && <span>{sched.deadline ? '|' : ''} Naplánováno: {new Date(sched.next_date).toLocaleDateString('cs-CZ')}</span>}
                          </>
                        ) : (
                          <>
                            <span>Příští: {new Date(sched.next_date).toLocaleDateString('cs-CZ')}</span>
                            {sched.installation_date && (
                              <span className="text-slate-400">| Instalace: {new Date(sched.installation_date).toLocaleDateString('cs-CZ')}</span>
                            )}
                            {sched.interval_months > 0 && (
                              <span className="text-slate-400">| Interval: {sched.interval_months >= 12 && sched.interval_months % 12 === 0 ? `${sched.interval_months / 12} let` : `${sched.interval_months} měs.`}</span>
                            )}
                          </>
                        )}
                        {sched.last_completed_date && (
                          <span className="text-slate-400">| Naposledy: {new Date(sched.last_completed_date).toLocaleDateString('cs-CZ')}</span>
                        )}
                      </div>
                      {sched.notes && <div className="text-[11px] text-slate-400 mt-0.5">{sched.notes}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleCompleteSchedule(sched)} className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-500 transition" title="Označit jako dokončeno">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => {
                        setEditSchedule(sched);
                        const intM = sched.interval_months || serviceTypes.find(t => t.id === sched.service_type_id)?.interval_months || 12;
                        const unit: 'months' | 'years' = intM >= 12 && intM % 12 === 0 ? 'years' : 'months';
                        const val = unit === 'years' ? intM / 12 : intM;
                        setScheduleForm({ service_type_id: sched.service_type_id, installation_date: sched.installation_date || '', interval_value: val, interval_unit: unit, notes: sched.notes, is_one_time: !!sched.is_one_time, deadline: sched.deadline || '' });
                        setShowScheduleModal(true);
                      }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSchedule(sched.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'devices' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Instalovaná zařízení</h3>
            <button
              onClick={() => {
                setEditDevice(null);
                setDeviceForm({ device_type: 'stridac', name: '', manufacturer: '', serial_number: '', installation_date: '', warranty_years: 2, notes: '' });
                setShowDeviceModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Přidat zařízení
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-12">
              <Cpu className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádná instalovaná zařízení</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {devices.map(dev => {
                const dt = DEVICE_TYPES[dev.device_type] || DEVICE_TYPES.other;
                const warrantyExpired = dev.warranty_end_date && new Date(dev.warranty_end_date) < new Date();
                return (
                  <div key={dev.id} className="bg-white/[0.06] border border-white/[0.08] rounded-xl p-4 hover:border-white/[0.12] transition">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg shrink-0">{dt.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{dev.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">{dt.label}</span>
                          {warrantyExpired && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Záruka vypršela</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2">
                          {dev.manufacturer && (
                            <div><span className="text-[10px] text-slate-400 block">Výrobce</span><span className="text-xs font-medium text-slate-400">{dev.manufacturer}</span></div>
                          )}
                          {dev.serial_number && (
                            <div><span className="text-[10px] text-slate-400 block">Výrobní číslo</span><span className="text-xs font-medium text-slate-400 font-mono">{dev.serial_number}</span></div>
                          )}
                          {dev.installation_date && (
                            <div><span className="text-[10px] text-slate-400 block">Instalace</span><span className="text-xs font-medium text-slate-400">{new Date(dev.installation_date).toLocaleDateString('cs-CZ')}</span></div>
                          )}
                          {dev.warranty_end_date && (
                            <div>
                              <span className="text-[10px] text-slate-400 block">Záruka do</span>
                              <span className={`text-xs font-medium ${warrantyExpired ? 'text-red-400' : 'text-slate-400'}`}>
                                {new Date(dev.warranty_end_date).toLocaleDateString('cs-CZ')} ({dev.warranty_years} let)
                              </span>
                            </div>
                          )}
                        </div>
                        {dev.notes && <div className="text-[11px] text-slate-400 mt-1.5">{dev.notes}</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setClaimDevice(dev); setShowClaimModal(true); }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition"
                          title="Reklamace / Výměna"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Reklamace
                        </button>
                        <button onClick={() => {
                          setEditDevice(dev);
                          setDeviceForm({
                            device_type: dev.device_type, name: dev.name, manufacturer: dev.manufacturer,
                            serial_number: dev.serial_number, installation_date: dev.installation_date || '',
                            warranty_years: dev.warranty_years, notes: dev.notes,
                          });
                          setShowDeviceModal(true);
                        }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteDevice(dev.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {claims.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Reklamace a výměny ({claims.length})
              </h3>
              <div className="space-y-2">
                {claims.map(claim => (
                  <button
                    key={claim.id}
                    onClick={() => setDetailClaimId(claim.id)}
                    className="w-full text-left bg-white/[0.06] border border-white/[0.08] rounded-xl p-3 hover:border-white/[0.12] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
 claim.claim_type === 'repair' ? 'bg-blue-500/10' : 'bg-amber-500/10'
 }`}>
                        {claim.claim_type === 'repair'
                          ? <Wrench className="w-4 h-4 text-blue-400" />
                          : <RefreshCw className="w-4 h-4 text-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">{claim.claim_number}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
 claim.claim_type === 'repair' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
 }`}>
                            {claim.claim_type === 'repair' ? 'Oprava' : 'Výměna'}
                          </span>
                          {claim.is_warranty && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Záruka</span>
                          )}
                          {claim.customer_signature && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Podepsáno</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {claim.original_device_name} | {new Date(claim.claim_date).toLocaleDateString('cs-CZ')}
                          {claim.total_cost > 0 && <span className="ml-2 font-medium text-slate-400">{Number(claim.total_cost).toLocaleString('cs-CZ')} Kč</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'tickets' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Servisní tikety</h3>
            <button
              onClick={() => {
                setEditTicket(null);
                setTicketForm({ title: '', description: '', status: 'open', priority: 'normal', assigned_to: '' });
                setShowTicketModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nový tiket
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádné servisní tikety</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => {
                const st = STATUS_MAP[ticket.status] || STATUS_MAP.open;
                const pr = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
                return (
                  <div key={ticket.id} className="bg-white/[0.06] border border-white/[0.08] rounded-xl p-4 hover:border-white/[0.12] transition">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{ticket.title}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                          <span className={`text-[10px] font-bold ${pr.color}`}>{pr.label}</span>
                          {ticket.reported_by_portal && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Portál</span>
                          )}
                        </div>
                        {ticket.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ticket.description}</p>}
                        <div className="text-[11px] text-slate-400 mt-1">
                          {new Date(ticket.created_at).toLocaleDateString('cs-CZ')}
                          {ticket.resolved_at && <span className="ml-2">| Vyřešeno: {new Date(ticket.resolved_at).toLocaleDateString('cs-CZ')}</span>}
                        </div>
                        {ticket.resolution_notes && (
                          <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">{ticket.resolution_notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setConvertTicket(ticket);
                            const first = serviceTypes[0];
                            const intM = first?.interval_months || 12;
                            const unit: 'months' | 'years' = intM >= 12 && intM % 12 === 0 ? 'years' : 'months';
                            const val = unit === 'years' ? intM / 12 : intM;
                            setScheduleForm({ service_type_id: first?.id || '', installation_date: '', interval_value: val, interval_unit: unit, notes: '', is_one_time: false, deadline: '' });
                            setShowConvertModal(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition"
                          title="Převést na plánovaný servis"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                          <button
                            onClick={() => {
                              setProtocolContext({ ticketId: ticket.id, description: `${ticket.title}\n${ticket.resolution_notes || ''}`.trim() });
                              setShowProtocolModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition"
                            title="Vytvořit servisní protokol"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => {
                          setEditTicket(ticket);
                          setTicketForm({
                            title: ticket.title, description: ticket.description, status: ticket.status,
                            priority: ticket.priority, assigned_to: ticket.assigned_to || '',
                          });
                          setShowTicketModal(true);
                        }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={showScheduleModal} onClose={() => setShowScheduleModal(false)} title={editSchedule ? 'Upravit servis' : 'Naplánovat servis'} size="md" footer={
        <>
          <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSaveSchedule} disabled={!scheduleForm.service_type_id || (!scheduleForm.is_one_time && (!scheduleForm.installation_date || !scheduleForm.interval_value))} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {editSchedule ? 'Uložit' : 'Naplánovat'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ servisu *</label>
            <select
              value={scheduleForm.service_type_id}
              onChange={e => {
                const sType = serviceTypes.find(t => t.id === e.target.value);
                const intM = sType?.interval_months || 12;
                const unit: 'months' | 'years' = intM >= 12 && intM % 12 === 0 ? 'years' : 'months';
                const val = unit === 'years' ? intM / 12 : intM;
                setScheduleForm({ ...scheduleForm, service_type_id: e.target.value, interval_value: val, interval_unit: unit });
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Vyberte...</option>
              {serviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 cursor-pointer">
            <input type="checkbox" checked={scheduleForm.is_one_time} onChange={e => setScheduleForm({ ...scheduleForm, is_one_time: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <div>
              <span className="text-sm font-semibold text-white">Jednorázový servis</span>
              <span className="text-[10px] text-slate-500 block">Např. reklamace - bez opakování</span>
            </div>
          </label>
          {scheduleForm.is_one_time ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Maximální termín splnění</label>
              <input type="date" value={scheduleForm.deadline} onChange={e => setScheduleForm({ ...scheduleForm, deadline: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
              <span className="text-[10px] text-slate-500 mt-1 block">Nepovinné - pokud nezadáte, bude bez termínu</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum instalace *</label>
                <input type="date" value={scheduleForm.installation_date} onChange={e => setScheduleForm({ ...scheduleForm, installation_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Interval *</label>
                  <input type="number" min={1} value={scheduleForm.interval_value} onChange={e => setScheduleForm({ ...scheduleForm, interval_value: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="flex-1">
                  <select value={scheduleForm.interval_unit} onChange={e => setScheduleForm({ ...scheduleForm, interval_unit: e.target.value as 'months' | 'years' })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="months">měsíců</option>
                    <option value="years">let</option>
                  </select>
                </div>
              </div>
              {scheduleForm.installation_date && scheduleForm.interval_value > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-slate-400">Příští servis:</span>
                  <span className="text-sm font-semibold text-blue-400">
                    {new Date(computeNextDate(scheduleForm.installation_date, scheduleForm.interval_value, scheduleForm.interval_unit)).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky</label>
            <textarea value={scheduleForm.notes} onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
      </Modal>

      <Modal open={showDeviceModal} onClose={() => setShowDeviceModal(false)} title={editDevice ? 'Upravit zařízení' : 'Přidat zařízení'} size="lg" footer={
        <>
          <button onClick={() => setShowDeviceModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSaveDevice} disabled={!deviceForm.name.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {editDevice ? 'Uložit' : 'Přidat'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ zařízení *</label>
              <select value={deviceForm.device_type} onChange={e => setDeviceForm({ ...deviceForm, device_type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {Object.entries(DEVICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název / Model *</label>
              <input value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výrobce</label>
              <input value={deviceForm.manufacturer} onChange={e => setDeviceForm({ ...deviceForm, manufacturer: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výrobní číslo</label>
              <input value={deviceForm.serial_number} onChange={e => setDeviceForm({ ...deviceForm, serial_number: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="S/N" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum instalace</label>
              <input type="date" value={deviceForm.installation_date} onChange={e => setDeviceForm({ ...deviceForm, installation_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Záruka (roky)</label>
              <input type="number" min={0} value={deviceForm.warranty_years} onChange={e => setDeviceForm({ ...deviceForm, warranty_years: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="flex items-end">
              {deviceForm.installation_date && deviceForm.warranty_years > 0 && (
                <div className="text-xs text-slate-500 pb-2.5">
                  Konec: {(() => {
                    const d = new Date(deviceForm.installation_date);
                    d.setFullYear(d.getFullYear() + deviceForm.warranty_years);
                    return d.toLocaleDateString('cs-CZ');
                  })()}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky</label>
            <textarea value={deviceForm.notes} onChange={e => setDeviceForm({ ...deviceForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
      </Modal>

      {activeSection === 'protocols' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Servisní protokoly</h3>
            <button
              onClick={() => {
                setProtocolContext({});
                setShowProtocolModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nový protokol
            </button>
          </div>
          {protocols.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádné servisní protokoly</p>
            </div>
          ) : (
            <div className="space-y-2">
              {protocols.map(proto => (
                <button
                  key={proto.id}
                  onClick={() => setDetailProtocolId(proto.id)}
                  className="w-full text-left bg-white/[0.06] border border-white/[0.08] rounded-xl p-4 hover:border-white/[0.12] transition cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{proto.protocol_number}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          {proto.status === 'draft' ? 'Koncept' : 'Dokončeno'}
                        </span>
                        <span className="text-[10px] text-slate-400">{proto.technician_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{proto.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span>{new Date(proto.service_date).toLocaleDateString('cs-CZ')}</span>
                        {proto.labor_total > 0 && <span>Práce: {proto.labor_total.toLocaleString('cs-CZ')} Kč</span>}
                        {proto.material_total > 0 && <span>Materiál: {proto.material_total.toLocaleString('cs-CZ')} Kč</span>}
                        {(proto.labor_total + proto.material_total) > 0 && (
                          <span className="font-bold text-slate-400">Celkem: {(proto.labor_total + proto.material_total).toLocaleString('cs-CZ')} Kč</span>
                        )}
                      </div>
                    </div>
                    <FileText className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={showConvertModal} onClose={() => { setShowConvertModal(false); setConvertTicket(null); }} title="Převést tiket na plánovaný servis" size="md" footer={
        <>
          <button onClick={() => { setShowConvertModal(false); setConvertTicket(null); }} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleConvertTicketToSchedule} disabled={!scheduleForm.service_type_id || (!scheduleForm.is_one_time && (!scheduleForm.installation_date || !scheduleForm.interval_value))} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            Vytvořit servis
          </button>
        </>
      }>
        <div className="space-y-4">
          {convertTicket && (
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="text-xs font-bold text-slate-400">{convertTicket.title}</div>
              {convertTicket.description && <div className="text-[11px] text-slate-400 mt-0.5">{convertTicket.description}</div>}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ servisu *</label>
            <select
              value={scheduleForm.service_type_id}
              onChange={e => {
                const sType = serviceTypes.find(t => t.id === e.target.value);
                const intM = sType?.interval_months || 12;
                const unit: 'months' | 'years' = intM >= 12 && intM % 12 === 0 ? 'years' : 'months';
                const val = unit === 'years' ? intM / 12 : intM;
                setScheduleForm({ ...scheduleForm, service_type_id: e.target.value, interval_value: val, interval_unit: unit });
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Vyberte...</option>
              {serviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 cursor-pointer">
            <input type="checkbox" checked={scheduleForm.is_one_time} onChange={e => setScheduleForm({ ...scheduleForm, is_one_time: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <div>
              <span className="text-sm font-semibold text-white">Jednorázový servis</span>
              <span className="text-[10px] text-slate-500 block">Např. reklamace - bez opakování</span>
            </div>
          </label>
          {scheduleForm.is_one_time ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Maximální termín splnění</label>
              <input type="date" value={scheduleForm.deadline} onChange={e => setScheduleForm({ ...scheduleForm, deadline: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
              <span className="text-[10px] text-slate-500 mt-1 block">Nepovinné - pokud nezadáte, bude bez termínu</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum instalace *</label>
                <input type="date" value={scheduleForm.installation_date} onChange={e => setScheduleForm({ ...scheduleForm, installation_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Interval *</label>
                  <input type="number" min={1} value={scheduleForm.interval_value} onChange={e => setScheduleForm({ ...scheduleForm, interval_value: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="flex-1">
                  <select value={scheduleForm.interval_unit} onChange={e => setScheduleForm({ ...scheduleForm, interval_unit: e.target.value as 'months' | 'years' })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="months">měsíců</option>
                    <option value="years">let</option>
                  </select>
                </div>
              </div>
              {scheduleForm.installation_date && scheduleForm.interval_value > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-slate-400">Příští servis:</span>
                  <span className="text-sm font-semibold text-blue-400">
                    {new Date(computeNextDate(scheduleForm.installation_date, scheduleForm.interval_value, scheduleForm.interval_unit)).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal open={showTicketModal} onClose={() => setShowTicketModal(false)} title={editTicket ? 'Upravit tiket' : 'Nový tiket'} size="md" footer={
        <>
          <button onClick={() => setShowTicketModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSaveTicket} disabled={!ticketForm.title.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {editTicket ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Předmět *</label>
            <input value={ticketForm.title} onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <textarea value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
              <select value={ticketForm.status} onChange={e => setTicketForm({ ...ticketForm, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Priorita</label>
              <select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {editTicket && ticketForm.status === 'resolved' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka k řešení</label>
              <textarea
                value={editTicket.resolution_notes}
                onChange={e => setEditTicket({ ...editTicket, resolution_notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}
        </div>
      </Modal>

      <ServiceProtocolModal
        open={showProtocolModal}
        onClose={() => setShowProtocolModal(false)}
        projectId={projectId}
        scheduleId={protocolContext.scheduleId || null}
        ticketId={protocolContext.ticketId || null}
        prefillDescription={protocolContext.description}
        onSaved={loadData}
      />

      <ServiceProtocolDetail
        open={!!detailProtocolId}
        onClose={() => setDetailProtocolId(null)}
        protocolId={detailProtocolId || ''}
        projectId={projectId}
      />

      <WarrantyClaimModal
        open={showClaimModal}
        onClose={() => { setShowClaimModal(false); setClaimDevice(null); }}
        projectId={projectId}
        device={claimDevice}
        onSaved={loadData}
      />

      <WarrantyClaimDetail
        open={!!detailClaimId}
        onClose={() => setDetailClaimId(null)}
        claimId={detailClaimId || ''}
        projectId={projectId}
      />
    </div>
  );
}
