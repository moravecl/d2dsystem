import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Calendar, AlertTriangle, MapPin, Clock,
  ChevronRight, Filter, Search, Cpu, Shield, Ticket,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import Tabs from '../../components/ui/Tabs';
import ServiceTicketsList from './ServiceTicketsList';
import ServiceSchedulesList from './ServiceSchedulesList';
import ServiceMapView from './ServiceMapView';
import ServiceTicketDetailDrawer from './ServiceTicketDetailDrawer';

interface DashboardStats {
  totalSchedules: number;
  overdueSchedules: number;
  upcomingSchedules: number;
  openTickets: number;
  urgentTickets: number;
  expiringWarranties: number;
}

const tabs = [
  { key: 'dashboard', label: 'Přehled' },
  { key: 'tickets', label: 'Tikety' },
  { key: 'schedules', label: 'Plánované servisy' },
  { key: 'map', label: 'Mapa' },
];

export default function ServicePage() {
  const { setConfig } = useHeader();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalSchedules: 0, overdueSchedules: 0, upcomingSchedules: 0,
    openTickets: 0, urgentTickets: 0, expiringWarranties: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [upcomingServices, setUpcomingServices] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Servis' }] });
  }, [setConfig]);

  const loadDashboard = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const inMonth = new Date();
    inMonth.setDate(inMonth.getDate() + 30);
    const monthStr = inMonth.toISOString().slice(0, 10);
    const inThreeMonths = new Date();
    inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);
    const threeMonthStr = inThreeMonths.toISOString().slice(0, 10);

    const [schedRes, overdueRes, upcomingRes, ticketsRes, urgentRes, warrantyRes, recentTicketsRes, upcomingServRes] = await Promise.all([
      supabase.from('service_schedules').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('service_schedules').select('id', { count: 'exact', head: true }).eq('is_active', true).lt('next_date', today),
      supabase.from('service_schedules').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('next_date', today).lte('next_date', monthStr),
      supabase.from('service_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      supabase.from('service_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').in('status', ['open', 'in_progress']),
      supabase.from('installed_devices').select('id', { count: 'exact', head: true }).lte('warranty_end_date', threeMonthStr).gte('warranty_end_date', today),
      supabase.from('service_tickets').select('id, title, status, priority, project_id, created_at, reported_by_portal').order('created_at', { ascending: false }).limit(5),
      supabase.from('service_schedules').select('id, project_id, service_type_id, next_date, notes, client_name').eq('is_active', true).gte('next_date', today).order('next_date').limit(8),
    ]);

    setStats({
      totalSchedules: schedRes.count || 0,
      overdueSchedules: overdueRes.count || 0,
      upcomingSchedules: upcomingRes.count || 0,
      openTickets: ticketsRes.count || 0,
      urgentTickets: urgentRes.count || 0,
      expiringWarranties: warrantyRes.count || 0,
    });

    const rTickets = (recentTicketsRes.data || []) as any[];
    const uServices = (upcomingServRes.data || []) as any[];

    const allProjectIds = [...new Set([
      ...rTickets.map(t => t.project_id).filter(Boolean),
      ...uServices.map(s => s.project_id).filter(Boolean),
    ])];
    const typeIds = [...new Set(uServices.map(s => s.service_type_id))];

    let projectMap = new Map<string, string>();
    let typeMap = new Map<string, string>();

    if (allProjectIds.length > 0) {
      const { data: projects } = await supabase.from('projects').select('id, project_name').in('id', allProjectIds);
      projectMap = new Map((projects || []).map((p: any) => [p.id, p.project_name]));
    }
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from('service_types').select('id, name').in('id', typeIds);
      typeMap = new Map((types || []).map((t: any) => [t.id, t.name]));
    }

    setRecentTickets(rTickets.map(t => ({ ...t, project_name: projectMap.get(t.project_id) || '' })));
    setUpcomingServices(uServices.map(s => ({ ...s, project_name: s.project_id ? (projectMap.get(s.project_id) || '') : (s.client_name || ''), type_name: typeMap.get(s.service_type_id) || '' })));
    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    open: { label: 'Otevřený', color: 'bg-blue-500/100/15 text-blue-300 border border-blue-500/25' },
    in_progress: { label: 'Řeší se', color: 'bg-amber-500/100/15 text-amber-300 border border-amber-500/25' },
    resolved: { label: 'Vyřešeno', color: 'bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25' },
    closed: { label: 'Uzavřeno', color: 'bg-white/[0.04]0/15 text-slate-400 border border-slate-500/25' },
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div data-tour="service-tabs-nav" className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div data-tour="service-stats" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Plánované servisy', value: stats.totalSchedules, icon: Calendar, gradient: 'from-blue-500 to-blue-600' },
              { label: 'Po termínu', value: stats.overdueSchedules, icon: AlertTriangle, gradient: stats.overdueSchedules > 0 ? 'from-red-500 to-rose-600' : 'from-slate-600 to-slate-700' },
              { label: 'Blížící se (30d)', value: stats.upcomingSchedules, icon: Clock, gradient: stats.upcomingSchedules > 0 ? 'from-amber-500 to-amber-600' : 'from-slate-600 to-slate-700' },
              { label: 'Otevřené tikety', value: stats.openTickets, icon: Ticket, gradient: stats.openTickets > 0 ? 'from-cyan-500 to-cyan-600' : 'from-slate-600 to-slate-700' },
              { label: 'Urgentní tikety', value: stats.urgentTickets, icon: AlertTriangle, gradient: stats.urgentTickets > 0 ? 'from-red-500 to-rose-600' : 'from-slate-600 to-slate-700' },
              { label: 'Záruky končí', value: stats.expiringWarranties, icon: Shield, gradient: stats.expiringWarranties > 0 ? 'from-amber-500 to-amber-600' : 'from-slate-600 to-slate-700' },
            ].map((stat, idx) => (
              <div key={idx} className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300 group animate-count-up`} style={{ animationDelay: `${idx * 0.04}s` }}>
                <div className="absolute inset-0 bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />
                <svg className="absolute bottom-0 left-0 right-0 h-[50%] opacity-[0.12] pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
                  <path d="M0,160L26.7,144C53.3,128,107,96,160,90.7C213.3,85,267,107,320,117.3C373.3,128,400,128,400,128L400,160L0,160Z" fill="white" />
                </svg>
                <div className="relative flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <stat.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{stat.label}</div>
                    <div className="text-lg font-extrabold text-white">{stat.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] panel-3d">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white">Poslední tikety</h3>
                <button onClick={() => setActiveTab('tickets')} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Všechny <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {recentTickets.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádné tikety</div>
                ) : (
                  recentTickets.map(t => {
                    const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition cursor-pointer" onClick={() => setSelectedTicketId(t.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-300 truncate">{t.title}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                            {t.reported_by_portal && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/100/15 text-cyan-300 border border-cyan-500/25">Portál</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{t.project_name}</div>
                        </div>
                        <div className="text-[11px] text-slate-500 shrink-0">{new Date(t.created_at).toLocaleDateString('cs-CZ')}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] panel-3d">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white">Nadcházející servisy</h3>
                <button onClick={() => setActiveTab('schedules')} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Všechny <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {upcomingServices.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádné plánované servisy</div>
                ) : (
                  upcomingServices.map(s => {
                    const daysUntil = Math.ceil((new Date(s.next_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={s.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.06]/[0.04] transition ${s.project_id ? 'cursor-pointer' : ''}`} onClick={() => s.project_id && navigate(`/projekty/${s.project_id}`)}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${daysUntil <= 7 ? 'bg-amber-500/100/15' : 'bg-blue-500/100/15'}`}>
                          <Calendar className={`w-4 h-4 ${daysUntil <= 7 ? 'text-amber-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-300 truncate">{s.type_name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{s.project_name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-slate-400">{new Date(s.next_date).toLocaleDateString('cs-CZ')}</div>
                          <div className={`text-[10px] font-bold ${daysUntil <= 7 ? 'text-amber-400' : 'text-slate-500'}`}>
                            za {daysUntil} {daysUntil === 1 ? 'den' : daysUntil < 5 ? 'dny' : 'dní'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'tickets' && <ServiceTicketsList />}
      {activeTab === 'schedules' && <ServiceSchedulesList />}
      {activeTab === 'map' && <ServiceMapView />}

      <ServiceTicketDetailDrawer
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onUpdate={loadDashboard}
      />
    </div>
  );
}
