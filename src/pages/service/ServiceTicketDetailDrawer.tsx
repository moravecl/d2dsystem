import { useState, useEffect } from 'react';
import { X, Calendar, User, Clock, Phone, Mail, ExternalLink, CheckCircle2, Building2, Ticket, Wrench, CircleUser as UserCircle, FileText, Archive, RotateCcw, CalendarPlus, MapPin, AlertTriangle, Link2, Search, Banknote, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useKanbanColumns } from '../../hooks/useKanbanColumns';
import { getColorConfig } from '../../components/ui/KanbanBoard';
import Modal from '../../components/ui/Modal';
import { SERVICE_CATEGORY_LABELS } from '../../components/service/ServiceWorkflowStepper';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete';
import ClientAutocomplete from '../../components/ui/ClientAutocomplete';

interface ServiceTicketDetailDrawerProps {
  ticketId: string | null;
  onClose: () => void;
  onUpdate?: () => void;
}

interface TicketDetail {
  id: string;
  project_id: string | null;
  service_schedule_id: string | null;
  inquiry_form_id: string | null;
  linked_service_id: string | null;
  title: string;
  description: string;
  status: string;
  ticket_status: string | null;
  priority: string;
  reported_by_portal: boolean;
  portal_user_id: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
  form_data: Record<string, any> | null;
}

interface ServiceType {
  id: string;
  name: string;
  interval_months: number;
}

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Nízká', color: 'text-slate-400', bg: 'bg-slate-500/15' },
  normal: { label: 'Normální', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  high: { label: 'Vysoká', color: 'text-amber-400', bg: 'bg-amber-500/15' },
  urgent: { label: 'Urgentní', color: 'text-red-400', bg: 'bg-red-500/15' },
};

export default function ServiceTicketDetailDrawer({ ticketId, onClose, onUpdate }: ServiceTicketDetailDrawerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { columns } = useKanbanColumns('service_tickets');

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [portalUserName, setPortalUserName] = useState('');
  const [resolvedByName, setResolvedByName] = useState('');
  const [scheduleInfo, setScheduleInfo] = useState<{ type: string; nextDate: string } | null>(null);
  const [formFieldLabels, setFormFieldLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [linkedServiceInfo, setLinkedServiceInfo] = useState<{ id: string; type_name: string; next_date: string; workflow_status: string } | null>(null);

  const [convertForm, setConvertForm] = useState({
    service_type_id: '',
    service_category: 'out_of_warranty',
    next_date: '',
    technician_ids: [] as string[],
    notes: '',
    is_one_time: true,
    interval_months: 12,
    deadline: '',
    agreed_price: null as number | null,
    client_name: '',
    client_address: '',
    client_phone: '',
    client_email: '',
    client_ico: '',
    client_dic: '',
    address_lat: null as number | null,
    address_lon: null as number | null,
  });

  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editResolutionNotes, setEditResolutionNotes] = useState('');

  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!ticketId) return;
    loadTicket();
    loadEmployees();
    loadServiceTypes();
  }, [ticketId]);

  const loadServiceTypes = async () => {
    const { data } = await supabase
      .from('service_types')
      .select('id, name, interval_months')
      .eq('is_active', true)
      .order('sort_order');
    setServiceTypes((data || []) as ServiceType[]);
    if (data && data.length > 0) {
      setConvertForm(prev => ({ ...prev, service_type_id: data[0].id }));
    }
  };

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);

    const { data } = await supabase
      .from('service_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (data) {
      setTicket(data);
      setEditStatus(data.status);
      setEditPriority(data.priority);
      setEditAssignedTo(data.assigned_to || '');
      setEditResolutionNotes(data.resolution_notes || '');

      if (data.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('project_name, address, client_id')
          .eq('id', data.project_id)
          .maybeSingle();
        setProjectName(project?.project_name || '');
        setProjectAddress(project?.address || '');

        if (project?.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, contact_person, email, phone')
            .eq('id', project.client_id)
            .maybeSingle();
          setClientName(client?.company_name || client?.contact_person || '');
          setClientEmail(client?.email || '');
          setClientPhone(client?.phone || '');
        } else {
          setClientName('');
          setClientEmail('');
          setClientPhone('');
        }
      } else {
        setProjectName('');
        setProjectAddress('');
        setClientName('');
        setClientEmail('');
        setClientPhone('');
      }

      if (data.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', data.assigned_to)
          .maybeSingle();
        setAssigneeName(profile?.display_name || '');
      } else {
        setAssigneeName('');
      }

      if (data.portal_user_id) {
        const { data: portalUser } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', data.portal_user_id)
          .maybeSingle();
        setPortalUserName(portalUser?.display_name || '');
      } else {
        setPortalUserName('');
      }

      if (data.resolved_by) {
        const { data: resolver } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', data.resolved_by)
          .maybeSingle();
        setResolvedByName(resolver?.display_name || '');
      } else {
        setResolvedByName('');
      }

      if (data.service_schedule_id) {
        const { data: schedule } = await supabase
          .from('service_schedules')
          .select('service_type_id, next_date')
          .eq('id', data.service_schedule_id)
          .maybeSingle();
        if (schedule) {
          const { data: serviceType } = await supabase
            .from('service_types')
            .select('name')
            .eq('id', schedule.service_type_id)
            .maybeSingle();
          setScheduleInfo({
            type: serviceType?.name || '',
            nextDate: schedule.next_date || '',
          });
        } else {
          setScheduleInfo(null);
        }
      } else {
        setScheduleInfo(null);
      }

      if (data.inquiry_form_id) {
        const { data: form } = await supabase
          .from('inquiry_forms')
          .select('fields')
          .eq('id', data.inquiry_form_id)
          .maybeSingle();
        if (form?.fields && Array.isArray(form.fields)) {
          const labels: Record<string, string> = {};
          form.fields.forEach((f: { key: string; label: string }) => {
            if (f.key && f.label) labels[f.key] = f.label;
          });
          setFormFieldLabels(labels);
        } else {
          setFormFieldLabels({});
        }
      } else {
        setFormFieldLabels({});
      }

      if (data.linked_service_id) {
        const { data: linkedSvc } = await supabase
          .from('service_schedules')
          .select('id, service_type_id, next_date, workflow_status')
          .eq('id', data.linked_service_id)
          .maybeSingle();
        if (linkedSvc) {
          const { data: svcType } = await supabase
            .from('service_types')
            .select('name')
            .eq('id', linkedSvc.service_type_id)
            .maybeSingle();
          setLinkedServiceInfo({
            id: linkedSvc.id,
            type_name: svcType?.name || '',
            next_date: linkedSvc.next_date,
            workflow_status: linkedSvc.workflow_status || 'new',
          });
        } else {
          setLinkedServiceInfo(null);
        }
      } else {
        setLinkedServiceInfo(null);
      }
    }

    setLoading(false);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('is_portal_client', false)
      .order('display_name');
    setEmployees((data || []).map((p: any) => ({ id: p.id, name: p.display_name })));
  };

  const handleComplete = async () => {
    if (!ticket || !user) return;
    setCompleting(true);

    const { error } = await supabase
      .from('service_tickets')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: editResolutionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (error) {
      toast('Nepodařilo se dokončit tiket', 'error');
    } else {
      toast('Tiket byl dokončen a přesunut do archivu', 'success');
      setShowCompleteModal(false);
      onUpdate?.();
      onClose();
    }

    setCompleting(false);
  };

  const handleReopen = async () => {
    if (!ticket) return;
    setSaving(true);

    const { error } = await supabase
      .from('service_tickets')
      .update({
        resolved_at: null,
        resolved_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (error) {
      toast('Nepodařilo se obnovit tiket', 'error');
    } else {
      toast('Tiket byl obnoven', 'success');
      onUpdate?.();
      loadTicket();
    }

    setSaving(false);
  };

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);

    const updates: Record<string, any> = {
      status: editStatus,
      priority: editPriority,
      assigned_to: editAssignedTo || null,
      resolution_notes: editResolutionNotes,
      updated_at: new Date().toISOString(),
    };

    if (editStatus === 'resolved' && ticket.status !== 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('service_tickets')
      .update(updates)
      .eq('id', ticket.id);

    if (error) {
      toast('Nepodařilo se uložit změny', 'error');
    } else {
      toast('Tiket aktualizován', 'success');
      onUpdate?.();
      loadTicket();
    }

    setSaving(false);
  };

  const handleOpenConvertModal = async () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const defaultDateStr = defaultDate.toISOString().split('T')[0];

    const formData = {
      service_type_id: serviceTypes[0]?.id || '',
      service_category: 'out_of_warranty',
      next_date: defaultDateStr,
      technician_ids: editAssignedTo ? [editAssignedTo] : [],
      notes: `Tiket: ${ticket?.title}\n\n${ticket?.description || ''}`,
      is_one_time: true,
      interval_months: 12,
      deadline: defaultDateStr,
      agreed_price: null as number | null,
      client_name: clientName || '',
      client_address: projectAddress || '',
      client_phone: clientPhone || '',
      client_email: clientEmail || '',
      client_ico: '',
      client_dic: '',
      address_lat: null as number | null,
      address_lon: null as number | null,
    };

    if (ticket?.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('project_name, address, address_lat, address_lon, client_id')
        .eq('id', ticket.project_id)
        .maybeSingle();

      if (project) {
        formData.client_name = project.project_name || '';
        formData.client_address = project.address || '';
        formData.address_lat = project.address_lat;
        formData.address_lon = project.address_lon;

        if (project.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('name, phone, email, ico, dic, address, address_lat, address_lon')
            .eq('id', project.client_id)
            .maybeSingle();

          if (client) {
            formData.client_name = client.name || formData.client_name;
            formData.client_phone = client.phone || '';
            formData.client_email = client.email || '';
            formData.client_ico = client.ico || '';
            formData.client_dic = client.dic || '';
            if (!formData.client_address && client.address) {
              formData.client_address = client.address;
              formData.address_lat = client.address_lat;
              formData.address_lon = client.address_lon;
            }
          }
        }
      }
    }

    setConvertForm(formData);
    setShowConvertModal(true);
  };

  const handleConvertToService = async () => {
    if (!ticket || !user || !convertForm.service_type_id) return;
    setConverting(true);

    try {
      const payload: Record<string, any> = {
        service_type_id: convertForm.service_type_id,
        next_date: convertForm.next_date || null,
        notes: convertForm.notes,
        created_by: user.id,
        source_ticket_id: ticket.id,
        workflow_status: 'new',
        service_category: convertForm.service_category,
        problem_description: ticket.description,
        technician_ids: convertForm.technician_ids.length > 0 ? convertForm.technician_ids : null,
        report_required: true,
        is_active: true,
        is_one_time: convertForm.is_one_time,
        interval_months: convertForm.is_one_time ? 0 : (convertForm.interval_months || 12),
        deadline: convertForm.is_one_time && convertForm.deadline ? convertForm.deadline : null,
        agreed_price: convertForm.agreed_price,
        client_name: convertForm.client_name,
        client_address: convertForm.client_address,
        client_phone: convertForm.client_phone,
        client_email: convertForm.client_email,
        client_ico: convertForm.client_ico,
        client_dic: convertForm.client_dic,
        address_lat: convertForm.address_lat,
        address_lon: convertForm.address_lon,
      };

      if (ticket.project_id) {
        payload.project_id = ticket.project_id;
      }

      const { data: newService, error: insertErr } = await supabase
        .from('service_schedules')
        .insert(payload)
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      await supabase
        .from('service_tickets')
        .update({
          linked_service_id: newService.id,
          ticket_status: 'converted_to_service',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      toast('Servisní výjezd vytvořen', 'success');
      setShowConvertModal(false);
      onUpdate?.();
      loadTicket();
    } catch (err: any) {
      toast(err.message || 'Chyba při vytváření servisu', 'error');
    }

    setConverting(false);
  };

  const handleConvertAddressChange = (address: string, lat: number | null, lon: number | null) => {
    setConvertForm(prev => ({ ...prev, client_address: address, address_lat: lat, address_lon: lon }));
  };

  if (!ticketId) return null;

  const pr = PRIORITY_MAP[ticket?.priority || 'normal'] || PRIORITY_MAP.normal;
  const statusCol = columns.find((c) => c.key === ticket?.status);
  const statusColor = statusCol ? getColorConfig(statusCol.color) : getColorConfig('slate');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-navy-900 border-l border-white/10 overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-navy-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Detail tiketu</h2>
              <p className="text-xs text-slate-400">#{ticket?.id.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : ticket ? (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{ticket.title}</h3>
              {ticket.description && (
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{ticket.description}</p>
              )}
            </div>

            {ticket.form_data && Object.keys(ticket.form_data).length > 0 && (
              <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400">Data z formuláře</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(ticket.form_data).map(([key, value]) => {
                    if (!value || key.endsWith('_url')) return null;

                    const displayLabel = formFieldLabels[key] || {
                      name: 'Jmeno a prijmeni',
                      email: 'E-mail',
                      phone: 'Telefon',
                      message: 'Zpráva',
                    }[key] || key.replace(/^field_\d+/, '').replace(/_/g, ' ') || key;

                    const isUrl = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));

                    return (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="text-xs text-blue-400/70 sm:min-w-[140px] shrink-0">{displayLabel}:</span>
                        {isUrl ? (
                          <a
                            href={value as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-300 hover:text-blue-200 underline break-all"
                          >
                            Zobrazit přílohu
                          </a>
                        ) : (
                          <span className="text-sm text-white break-all">{String(value)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${statusColor.bg} ${statusColor.text}`}>
                {statusCol?.label || ticket.status}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${pr.bg} ${pr.color}`}>
                {pr.label}
              </span>
              {ticket.reported_by_portal && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-400">
                  Z portálu
                </span>
              )}
            </div>

            {assigneeName && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Přiřazeno</p>
                    <p className="text-sm font-semibold text-white">{assigneeName}</p>
                  </div>
                </div>
              </div>
            )}

            {ticket.reported_by_portal && portalUserName && (
              <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                    <User className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-cyan-400/70">Nahlásil (z portálu)</p>
                    <p className="text-sm font-semibold text-cyan-300">{portalUserName}</p>
                  </div>
                </div>
              </div>
            )}

            {scheduleInfo && (
              <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-400/70">Plánovaný servis</p>
                    <p className="text-sm font-semibold text-amber-300">{scheduleInfo.type}</p>
                    {scheduleInfo.nextDate && (
                      <p className="text-xs text-amber-400/60 mt-0.5">
                        Příští termín: {new Date(scheduleInfo.nextDate).toLocaleDateString('cs-CZ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {linkedServiceInfo ? (
              <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-400/70">Propojeny servisní výjezd</p>
                      <p className="text-sm font-semibold text-emerald-300">{linkedServiceInfo.type_name}</p>
                      <p className="text-xs text-emerald-400/60 mt-0.5">
                        Termín: {new Date(linkedServiceInfo.next_date).toLocaleDateString('cs-CZ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/servis?tab=schedules')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition"
                  >
                    Zobrazit
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : !ticket.resolved_at && (
              <button
                onClick={handleOpenConvertModal}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm transition shadow-lg shadow-orange-500/20"
              >
                <CalendarPlus className="w-4 h-4" />
                Naplánovat servisní výjezd
              </button>
            )}

            {ticket.project_id && projectName && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Projekt</p>
                      <p className="text-sm font-semibold text-white">{projectName}</p>
                      {projectAddress && (
                        <p className="text-xs text-slate-500 mt-0.5">{projectAddress}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/projekty/${ticket.project_id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold hover:bg-blue-500/25 transition"
                  >
                    Otevřít
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {clientName && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs text-slate-500">Klient</p>
                    <p className="text-sm font-semibold text-white">{clientName}</p>
                    {(clientEmail || clientPhone) && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {clientEmail && (
                          <a
                            href={`mailto:${clientEmail}`}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {clientEmail}
                          </a>
                        )}
                        {clientPhone && (
                          <a
                            href={`tel:${clientPhone}`}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {clientPhone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Vytvořeno</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {new Date(ticket.created_at).toLocaleString('cs-CZ')}
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Poslední úprava</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {new Date(ticket.updated_at).toLocaleString('cs-CZ')}
                </p>
              </div>

              {ticket.resolved_at && (
                <div className="col-span-2 bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-emerald-400 mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs">Dokončeno</span>
                      </div>
                      <p className="text-sm font-semibold text-emerald-300">
                        {new Date(ticket.resolved_at).toLocaleString('cs-CZ')}
                      </p>
                      {resolvedByName && (
                        <p className="text-xs text-emerald-400/70 mt-1">
                          Dokončil: {resolvedByName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleReopen}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Obnovit
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Upravit tiket</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {columns.map((col) => (
                      <option key={col.key} value={col.key}>{col.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Priorita</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Přiřazeno</label>
                <select
                  value={editAssignedTo}
                  onChange={(e) => setEditAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Nepřiřazeno</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Poznámky k řešení</label>
                <textarea
                  value={editResolutionNotes}
                  onChange={(e) => setEditResolutionNotes(e.target.value)}
                  rows={4}
                  placeholder="Popis řešení nebo poznámky..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {saving ? 'Ukládám...' : 'Uložit změny'}
                </button>

                {!ticket.resolved_at && (
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
                  >
                    <Archive className="w-4 h-4" />
                    Dokončit
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400">
            Tiket nenalezen
          </div>
        )}
      </div>

      <Modal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Dokončit tiket"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Opravdu chcete dokončit tento tiket?</p>
              <p className="text-xs text-slate-400 mt-0.5">Tiket bude přesunut do archivu</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Poznámky k řešení (volitelné)</label>
            <textarea
              value={editResolutionNotes}
              onChange={(e) => setEditResolutionNotes(e.target.value)}
              rows={3}
              placeholder="Popis řešení nebo závěrečné poznámky..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCompleteModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {completing ? 'Ukládám...' : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Potvrdit dokončení
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        title="Naplánovat servisní výjezd"
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowConvertModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleConvertToService}
              disabled={converting || !convertForm.service_type_id}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {converting ? 'Vytvářím...' : 'Naplánovat servis'}
            </button>
          </>
        }
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          <div className="flex items-center gap-3 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Vytvořit servisní záznam z tiketu</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Informace budou předvyplněny z tiketu
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ servisu *</label>
              <select
                value={convertForm.service_type_id}
                onChange={(e) => setConvertForm({ ...convertForm, service_type_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                {serviceTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie servisu</label>
              <select
                value={convertForm.service_category}
                onChange={(e) => setConvertForm({ ...convertForm, service_category: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 cursor-pointer">
            <input
              type="checkbox"
              checked={convertForm.is_one_time}
              onChange={(e) => setConvertForm({ ...convertForm, is_one_time: e.target.checked })}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <span className="text-sm font-semibold text-white">Jednorázový servis</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Termín výjezdu {!convertForm.is_one_time && '*'}
              </label>
              <input
                type="date"
                value={convertForm.next_date}
                onChange={(e) => setConvertForm({ ...convertForm, next_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <p className="text-[10px] text-slate-500 mt-1">Ponechte prázdné pro pozdější naplánování</p>
            </div>

            {convertForm.is_one_time ? (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Provést do</label>
                <input
                  type="date"
                  value={convertForm.deadline}
                  onChange={(e) => setConvertForm({ ...convertForm, deadline: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Interval (měsíce)</label>
                <input
                  type="number"
                  min={1}
                  value={convertForm.interval_months}
                  onChange={(e) => setConvertForm({ ...convertForm, interval_months: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Technik</label>
              <select
                value={convertForm.technician_ids[0] || ''}
                onChange={(e) => setConvertForm({ ...convertForm, technician_ids: e.target.value ? [e.target.value] : [] })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">Nepřiřazeno</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                Dohodnutá cena
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={convertForm.agreed_price ?? ''}
                  onChange={(e) => setConvertForm({ ...convertForm, agreed_price: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Kč</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-500/5 border border-slate-500/15 space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <User className="w-3.5 h-3.5" />
              Kontaktní údaje zákazníka
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3 h-3" /> Vyhledat existujícího klienta
              </label>
              <ClientAutocomplete
                onSelect={(client) => {
                  setConvertForm(prev => ({
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

            {convertForm.client_name && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {convertForm.client_ico ? (
                      <Building2 className="w-4 h-4 text-blue-400" />
                    ) : (
                      <User className="w-4 h-4 text-blue-400" />
                    )}
                    <span className="text-sm font-bold text-white">{convertForm.client_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConvertForm(prev => ({
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
                  {convertForm.client_phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {convertForm.client_phone}
                    </div>
                  )}
                  {convertForm.client_email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {convertForm.client_email}
                    </div>
                  )}
                  {convertForm.client_address && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{convertForm.client_address}</span>
                    </div>
                  )}
                  {convertForm.client_ico && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      IČO: {convertForm.client_ico}
                    </div>
                  )}
                  {convertForm.client_dic && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      DIČ: {convertForm.client_dic}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-2 border-t border-white/[0.06]">
              Nebo vyplňte ručně
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno / Název firmy</label>
                <input
                  type="text"
                  value={convertForm.client_name}
                  onChange={(e) => setConvertForm({ ...convertForm, client_name: e.target.value })}
                  placeholder="Jan Novák / Firma s.r.o."
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> Telefon
                </label>
                <input
                  type="tel"
                  value={convertForm.client_phone}
                  onChange={(e) => setConvertForm({ ...convertForm, client_phone: e.target.value })}
                  placeholder="+420 123 456 789"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Adresa (s vyhledáváním)
              </label>
              <AddressAutocomplete
                value={convertForm.client_address}
                lat={convertForm.address_lat}
                lon={convertForm.address_lon}
                onChange={handleConvertAddressChange}
                placeholder="Zadejte ulici a město..."
                includeClients
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <input
                  type="email"
                  value={convertForm.client_email}
                  onChange={(e) => setConvertForm({ ...convertForm, client_email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> IČO
                </label>
                <input
                  type="text"
                  value={convertForm.client_ico}
                  onChange={(e) => setConvertForm({ ...convertForm, client_ico: e.target.value })}
                  placeholder="12345678"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> DIČ
                </label>
                <input
                  type="text"
                  value={convertForm.client_dic}
                  onChange={(e) => setConvertForm({ ...convertForm, client_dic: e.target.value })}
                  placeholder="CZ12345678"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky</label>
            <textarea
              value={convertForm.notes}
              onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
              rows={3}
              placeholder="Popis problému, požadavky..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300">
              Po vytvoření bude tiket označen jako "Převeden na servis" a propojen se servisním záznamem.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
