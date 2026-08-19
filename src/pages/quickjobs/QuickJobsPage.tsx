import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Calendar, Clock,
  ChevronRight, ArrowRight, User, Plus, Inbox, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Tabs from '../../components/ui/Tabs';
import QuickJobsList from './QuickJobsList';
import QuickJobsMapView from './QuickJobsMapView';
import QuickJobFormModal from './QuickJobFormModal';
import { STATUS_MAP, PRIORITY_MAP } from './quickJobTypes';

interface DashboardStats {
  poolCount: number;
  myCount: number;
  scheduledThisWeek: number;
  doneThisWeek: number;
  inProgressCount: number;
}

const tabs = [
  { key: 'dashboard', label: 'Přehled' },
  { key: 'jobs', label: 'Zakázky' },
  { key: 'map', label: 'Mapa' },
];

const STAT_CARDS = [
  {
    key: 'pool',
    label: 'Ve sběrníku',
    icon: Inbox,
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-white/20',
    wave: 'M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,154.7C672,149,768,171,864,176C960,181,1056,171,1152,154.7C1248,139,1344,117,1392,106.7L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z',
  },
  {
    key: 'my',
    label: 'Moje zakázky',
    icon: User,
    gradient: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-white/20',
    wave: 'M0,128L48,138.7C96,149,192,171,288,186.7C384,203,480,213,576,197.3C672,181,768,139,864,128C960,117,1056,139,1152,144C1248,149,1344,139,1392,133.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z',
  },
  {
    key: 'progress',
    label: 'Probíhá',
    icon: TrendingUp,
    gradient: 'from-teal-500 to-emerald-500',
    iconBg: 'bg-white/20',
    wave: 'M0,192L48,186.7C96,181,192,171,288,165.3C384,160,480,160,576,170.7C672,181,768,203,864,208C960,213,1056,203,1152,186.7C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z',
  },
  {
    key: 'scheduled',
    label: 'Naplánováno (7d)',
    icon: Calendar,
    gradient: 'from-sky-500 to-blue-600',
    iconBg: 'bg-white/20',
    wave: 'M0,224L48,213.3C96,203,192,181,288,176C384,171,480,181,576,192C672,203,768,213,864,202.7C960,192,1056,160,1152,154.7C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z',
  },
  {
    key: 'done',
    label: 'Hotovo (7d)',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-green-600',
    iconBg: 'bg-white/20',
    wave: 'M0,256L48,245.3C96,235,192,213,288,208C384,203,480,213,576,218.7C672,224,768,224,864,213.3C960,203,1056,181,1152,181.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z',
  },
];

export default function QuickJobsPage() {
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats>({ poolCount: 0, myCount: 0, scheduledThisWeek: 0, doneThisWeek: 0, inProgressCount: 0 });
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Rychlé zakázky' }] });
  }, [setConfig]);

  const loadDashboard = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekStr = weekEnd.toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const [poolRes, myRes, schedRes, doneRes, progressRes, recentRes, upcomingRes] = await Promise.all([
      supabase.from('quick_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pool'),
      supabase.from('quick_jobs').select('id', { count: 'exact', head: true }).eq('claimed_by', user?.id || '').in('status', ['claimed', 'scheduled', 'in_progress']),
      supabase.from('quick_jobs').select('id', { count: 'exact', head: true }).gte('scheduled_date', today).lte('scheduled_date', weekStr).neq('status', 'done').neq('status', 'cancelled'),
      supabase.from('quick_jobs').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('completed_at', weekStartStr),
      supabase.from('quick_jobs').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('quick_jobs').select('id, title, status, priority, client_name, client_id, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('quick_jobs').select('id, title, scheduled_date, priority, client_name, client_id, claimed_by, address').not('scheduled_date', 'is', null).gte('scheduled_date', today).neq('status', 'done').neq('status', 'cancelled').order('scheduled_date').limit(8),
    ]);

    setStats({
      poolCount: poolRes.count || 0,
      myCount: myRes.count || 0,
      scheduledThisWeek: schedRes.count || 0,
      doneThisWeek: doneRes.count || 0,
      inProgressCount: progressRes.count || 0,
    });

    const recent = (recentRes.data || []) as any[];
    const upcoming = (upcomingRes.data || []) as any[];

    const clientIds = [...new Set([...recent, ...upcoming].filter(j => j.client_id).map(j => j.client_id))];
    const claimedIds = [...new Set(upcoming.filter(j => j.claimed_by).map(j => j.claimed_by))];

    const [clientRes, profileRes] = await Promise.all([
      clientIds.length > 0 ? supabase.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] }),
      claimedIds.length > 0 ? supabase.from('profiles').select('id, display_name, email').in('id', claimedIds) : Promise.resolve({ data: [] }),
    ]);

    const clientMap = new Map((clientRes.data || []).map((c: any) => [c.id, c.name]));
    const profileMap = new Map((profileRes.data || []).map((p: any) => [p.id, p.display_name || p.email]));

    setRecentJobs(recent.map(j => ({ ...j, display_client: j.client_id ? clientMap.get(j.client_id) || j.client_name : j.client_name })));
    setUpcomingJobs(upcoming.map(j => ({
      ...j,
      display_client: j.client_id ? clientMap.get(j.client_id) || j.client_name : j.client_name,
      claimed_by_name: j.claimed_by ? profileMap.get(j.claimed_by) || '' : '',
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard, refreshKey]);

  const claimJob = async (jobId: string) => {
    await supabase.from('quick_jobs').update({
      claimed_by: user?.id,
      claimed_at: new Date().toISOString(),
      status: 'claimed',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    toast('Zakázka převzata');
    setRefreshKey(k => k + 1);
  };

  const statValues: Record<string, number> = {
    pool: stats.poolCount,
    my: stats.myCount,
    progress: stats.inProgressCount,
    scheduled: stats.scheduledThisWeek,
    done: stats.doneThisWeek,
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STAT_CARDS.map((card) => {
              const val = statValues[card.key];
              return (
                <div
                  key={card.key}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} shadow-lg shadow-black/20 group transition-transform hover:scale-[1.02]`}
                >
                  <svg
                    className="absolute bottom-0 left-0 w-full opacity-20"
                    viewBox="0 0 1440 320"
                    preserveAspectRatio="none"
                    style={{ height: '60%' }}
                  >
                    <path fill="white" d={card.wave} />
                  </svg>
                  <div className="relative z-10 p-4">
                    <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-3xl font-extrabold text-white drop-shadow-sm">{val}</div>
                    <div className="text-xs font-semibold text-white/80 mt-0.5">{card.label}</div>
                  </div>
                  <div className="absolute top-2 right-2 w-16 h-16 rounded-full bg-white/[0.08] blur-xl" />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02]">
              <Plus className="w-4 h-4" /> Nová zakázka
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="relative overflow-hidden bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-xl shadow-black/10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Poslední zakázky
                </h3>
                <button onClick={() => setActiveTab('jobs')} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  Všechny <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative divide-y divide-white/[0.06]">
                {recentJobs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-slate-500">
                    <Zap className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    Žádné zakázky
                  </div>
                ) : (
                  recentJobs.map(j => {
                    const st = STATUS_MAP[j.status] || STATUS_MAP.pool;
                    const pr = PRIORITY_MAP[j.priority] || PRIORITY_MAP.normal;
                    return (
                      <div key={j.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition group/row">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${pr.dot} shadow-sm`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate group-hover/row:text-blue-300 transition-colors">{j.title}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${st.color}`}>{st.label}</span>
                          </div>
                          {j.display_client && <div className="text-[11px] text-slate-500 truncate mt-0.5">{j.display_client}</div>}
                        </div>
                        {j.status === 'pool' && (
                          <button onClick={() => claimJob(j.id)} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg shadow-sm shadow-blue-500/20 transition-all">
                            <ArrowRight className="w-3 h-3" /> Vzít si
                          </button>
                        )}
                        <div className="text-[11px] text-slate-500 shrink-0">{new Date(j.created_at).toLocaleDateString('cs-CZ')}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="relative overflow-hidden bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-xl shadow-black/10">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Nadcházející výjezdy
                </h3>
                <button onClick={() => setActiveTab('map')} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  Mapa <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative divide-y divide-white/[0.06]">
                {upcomingJobs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-slate-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    Žádné naplánované výjezdy
                  </div>
                ) : (
                  upcomingJobs.map(j => {
                    const daysUntil = Math.ceil((new Date(j.scheduled_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysUntil <= 2;
                    return (
                      <div key={j.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition group/row">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10' : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/10'}`}>
                          <Calendar className={`w-4.5 h-4.5 ${isUrgent ? 'text-amber-400' : 'text-cyan-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate group-hover/row:text-blue-300 transition-colors">{j.title}</div>
                          <div className="text-[11px] text-slate-500 truncate">{j.display_client || j.address}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-slate-400">{new Date(j.scheduled_date).toLocaleDateString('cs-CZ')}</div>
                          <div className={`text-[10px] font-bold ${isUrgent ? 'text-amber-400' : 'text-slate-500'}`}>
                            {daysUntil === 0 ? 'dnes' : daysUntil === 1 ? 'zítra' : `za ${daysUntil} ${daysUntil < 5 ? 'dny' : 'dní'}`}
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

      {activeTab === 'jobs' && <QuickJobsList onAdd={() => setShowForm(true)} refreshKey={refreshKey} />}
      {activeTab === 'map' && <QuickJobsMapView refreshKey={refreshKey} />}

      <QuickJobFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={() => setRefreshKey(k => k + 1)} />
    </div>
  );
}
