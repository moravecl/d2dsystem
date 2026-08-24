import { useState, useEffect, useCallback } from 'react';
import { Calendar, Cpu, Wrench, Plus, Send, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import Modal from '../ui/Modal';

interface ServiceType {
  id: string;
  name: string;
  interval_months: number;
}

interface ServiceSchedule {
  id: string;
  service_type_id: string;
  next_date: string;
  last_completed_date: string | null;
  notes: string;
}

interface InstalledDevice {
  id: string;
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
  title: string;
  description: string;
  status: string;
  priority: string;
  resolution_notes: string;
  created_at: string;
  resolved_at: string | null;
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

export default function PortalServiceTab({ projectId }: { projectId: string }) {
  const { user: portalUser } = usePortalAuth();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [devices, setDevices] = useState<InstalledDevice[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'devices' | 'tickets'>('overview');

  const loadData = useCallback(async () => {
    const [typesRes, schedRes, devRes, tickRes] = await Promise.all([
      supabase.from('service_types').select('id, name, interval_months').eq('is_active', true),
      supabase.from('service_schedules').select('id, service_type_id, next_date, last_completed_date, notes').eq('project_id', projectId).eq('is_active', true).order('next_date'),
      supabase.from('installed_devices').select('id, device_type, name, manufacturer, serial_number, installation_date, warranty_years, warranty_end_date, notes').eq('project_id', projectId).order('name'),
      supabase.from('service_tickets').select('id, title, description, status, priority, resolution_notes, created_at, resolved_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    ]);
    setServiceTypes((typesRes.data || []) as ServiceType[]);
    setSchedules((schedRes.data || []) as ServiceSchedule[]);
    setDevices((devRes.data || []) as InstalledDevice[]);
    setTickets((tickRes.data || []) as ServiceTicket[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitTicket = async () => {
    if (!ticketForm.title.trim() || !portalUser) return;
    setSubmitting(true);
    const { error } = await supabase.from('service_tickets').insert({
      project_id: projectId,
      title: ticketForm.title,
      description: ticketForm.description,
      reported_by_portal: true,
      portal_user_id: portalUser.id,
    });
    setSubmitting(false);
    if (error) return;
    setShowTicketModal(false);
    setTicketForm({ title: '', description: '' });
    loadData();
  };

  const getTypeName = (id: string) => serviceTypes.find(t => t.id === id)?.name || '';

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'overview' as const, label: 'Plán servisů', icon: Calendar },
          { key: 'devices' as const, label: 'Zařízení a záruky', icon: Cpu },
          { key: 'tickets' as const, label: 'Požadavky', icon: Wrench },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeView === v.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            <v.icon className="w-4 h-4" />
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'overview' && (
        <div className="space-y-3">
          {schedules.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádné plánované servisy</p>
            </div>
          ) : (
            schedules.map(sched => {
              const overdue = new Date(sched.next_date) < new Date();
              return (
                <div key={sched.id} className={`flex items-center gap-4 p-4 rounded-xl border ${overdue ? 'bg-red-500/10 border-red-200' : 'bg-white/[0.06] border-white/10'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${overdue ? 'bg-red-500/20' : 'bg-blue-500/10'}`}>
                    <Calendar className={`w-5 h-5 ${overdue ? 'text-red-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{getTypeName(sched.service_type_id)}</div>
                    <div className="text-xs text-slate-500">
                      Příští termín: <span className={`font-semibold ${overdue ? 'text-red-400' : 'text-slate-300'}`}>{new Date(sched.next_date).toLocaleDateString('cs-CZ')}</span>
                      {sched.last_completed_date && (
                        <span className="ml-2 text-slate-400">| Naposledy: {new Date(sched.last_completed_date).toLocaleDateString('cs-CZ')}</span>
                      )}
                    </div>
                  </div>
                  {overdue && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/20 text-red-400 shrink-0">Po termínu</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeView === 'devices' && (
        <div className="space-y-3">
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <Cpu className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádná instalovaná zařízení</p>
            </div>
          ) : (
            devices.map(dev => {
              const dt = DEVICE_TYPES[dev.device_type] || DEVICE_TYPES.other;
              const expired = dev.warranty_end_date && new Date(dev.warranty_end_date) < new Date();
              return (
                <div key={dev.id} className="bg-navy-800/60 border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg shrink-0">{dt.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{dev.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">{dt.label}</span>
                        {expired && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Záruka vypršela</span>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs">
                        {dev.manufacturer && <div><span className="text-[10px] text-slate-400 block">Výrobce</span><span className="font-medium text-slate-400">{dev.manufacturer}</span></div>}
                        {dev.serial_number && <div><span className="text-[10px] text-slate-400 block">Výrobní číslo</span><span className="font-medium text-slate-400 font-mono">{dev.serial_number}</span></div>}
                        {dev.installation_date && <div><span className="text-[10px] text-slate-400 block">Instalace</span><span className="font-medium text-slate-400">{new Date(dev.installation_date).toLocaleDateString('cs-CZ')}</span></div>}
                        {dev.warranty_end_date && (
                          <div>
                            <span className="text-[10px] text-slate-400 block">Záruka do</span>
                            <span className={`font-medium ${expired ? 'text-red-400' : 'text-slate-400'}`}>
                              {new Date(dev.warranty_end_date).toLocaleDateString('cs-CZ')}
                            </span>
                          </div>
                        )}
                      </div>
                      {dev.notes && (
                        <div className="mt-2 text-[11px] text-slate-500 bg-white/[0.04] rounded-lg px-2.5 py-1.5 border border-white/[0.06]">{dev.notes}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeView === 'tickets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Vaše požadavky</h3>
            <button
              onClick={() => { setTicketForm({ title: '', description: '' }); setShowTicketModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nový požadavek
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Žádné požadavky</p>
              <button onClick={() => { setTicketForm({ title: '', description: '' }); setShowTicketModal(true); }} className="text-sm text-blue-400 font-semibold mt-2 hover:underline">
                Vytvořit požadavek
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => {
                const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                return (
                  <div key={t.id} className="bg-navy-800/60 border border-white/[0.08] rounded-xl p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{t.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </div>
                    {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(t.created_at).toLocaleDateString('cs-CZ')}
                      {t.resolved_at && <span className="ml-2">| Vyřešeno: {new Date(t.resolved_at).toLocaleDateString('cs-CZ')}</span>}
                    </div>
                    {t.resolution_notes && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">{t.resolution_notes}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nový servisní požadavek" size="md" footer={
        <>
          <button onClick={() => setShowTicketModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSubmitTicket} disabled={!ticketForm.title.trim() || submitting} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Odesílám...' : 'Odeslat'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Předmět *</label>
            <input value={ticketForm.title} onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })} placeholder="Stručný popis problému" className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Podrobný popis</label>
            <textarea value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} rows={4} placeholder="Podrobně popište problém nebo požadavek..." className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
