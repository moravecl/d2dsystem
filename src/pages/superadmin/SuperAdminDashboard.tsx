import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Users, FolderOpen, Activity, CreditCard, AlertTriangle, CheckCircle, Clock, ArrowUpRight } from 'lucide-react';

interface PlatformStats {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  totalProjects: number;
  totalClients: number;
  totalInvoices: number;
  newOrgsThisMonth: number;
  newUsersThisMonth: number;
}

interface RecentOrg {
  id: string;
  name: string;
  subscription_tier: string;
  is_active: boolean;
  is_suspended: boolean;
  created_at: string;
  member_count?: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: number;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentOrgs, setRecentOrgs] = useState<RecentOrg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      orgsRes,
      usersRes,
      projectsRes,
      clientsRes,
      invoicesRes,
      newOrgsRes,
      newUsersRes,
      recentOrgsRes,
    ] = await Promise.all([
      supabase.from('organizations').select('id, is_active, is_suspended', { count: 'exact' }),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('is_portal_client', false),
      supabase.from('projects').select('id', { count: 'exact' }),
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('invoices').select('id', { count: 'exact' }),
      supabase.from('organizations').select('id', { count: 'exact' }).gte('created_at', startOfMonth),
      supabase.from('profiles').select('id', { count: 'exact' }).gte('created_at', startOfMonth).eq('is_portal_client', false),
      supabase.from('organizations').select('id, name, subscription_tier, is_active, is_suspended, created_at').order('created_at', { ascending: false }).limit(8),
    ]);

    const orgs = orgsRes.data ?? [];
    setStats({
      totalOrgs: orgsRes.count ?? 0,
      activeOrgs: orgs.filter(o => o.is_active && !o.is_suspended).length,
      suspendedOrgs: orgs.filter(o => o.is_suspended).length,
      totalUsers: usersRes.count ?? 0,
      totalProjects: projectsRes.count ?? 0,
      totalClients: clientsRes.count ?? 0,
      totalInvoices: invoicesRes.count ?? 0,
      newOrgsThisMonth: newOrgsRes.count ?? 0,
      newUsersThisMonth: newUsersRes.count ?? 0,
    });

    setRecentOrgs(recentOrgsRes.data ?? []);
    setLoading(false);
  };

  const tierBadge = (tier: string) => {
    const map: Record<string, string> = {
      free: 'bg-gray-700 text-gray-300',
      pro: 'bg-blue-900/60 text-blue-300',
      business: 'bg-emerald-900/60 text-emerald-300',
      enterprise: 'bg-amber-900/60 text-amber-300',
    };
    return map[tier] ?? 'bg-gray-700 text-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Platform Overview</h1>
        <p className="text-gray-500 text-sm">Přehled celé platformy HouseSmart</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Building2}
          label="Organizace"
          value={stats?.totalOrgs ?? 0}
          sub={`${stats?.activeOrgs} aktivních`}
          color="bg-blue-500/10 text-blue-400"
          trend={stats?.newOrgsThisMonth}
        />
        <StatCard
          icon={Users}
          label="Uživatelé"
          value={stats?.totalUsers ?? 0}
          color="bg-emerald-500/10 text-emerald-400"
          trend={stats?.newUsersThisMonth}
        />
        <StatCard
          icon={FolderOpen}
          label="Projekty"
          value={stats?.totalProjects ?? 0}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={CreditCard}
          label="Faktury"
          value={stats?.totalInvoices ?? 0}
          color="bg-rose-500/10 text-rose-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{stats?.activeOrgs}</div>
            <div className="text-sm text-gray-400">Aktivní organizace</div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{stats?.newOrgsThisMonth} / {stats?.newUsersThisMonth}</div>
            <div className="text-sm text-gray-400">Nové org. / uživatelé tento měsíc</div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${(stats?.suspendedOrgs ?? 0) > 0 ? 'bg-red-500/10' : 'bg-gray-800'}`}>
            <AlertTriangle className={`w-6 h-6 ${(stats?.suspendedOrgs ?? 0) > 0 ? 'text-red-400' : 'text-gray-600'}`} />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{stats?.suspendedOrgs}</div>
            <div className="text-sm text-gray-400">Pozastavené organizace</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Nejnovější organizace</h2>
            <Activity className="w-4 h-4 text-gray-600" />
          </div>
          <div className="divide-y divide-gray-800">
            {recentOrgs.map((org) => (
              <div key={org.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">{org.name}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(org.created_at).toLocaleDateString('cs-CZ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tierBadge(org.subscription_tier)}`}>
                    {org.subscription_tier}
                  </span>
                  {org.is_suspended && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-900/60 text-red-300">
                      Pozastaveno
                    </span>
                  )}
                </div>
              </div>
            ))}
            {recentOrgs.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-600 text-sm">
                Zatím žádné organizace
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Statistiky platformy</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: 'Celkem organizací', value: stats?.totalOrgs ?? 0, max: Math.max(stats?.totalOrgs ?? 1, 1), color: 'bg-blue-500' },
              { label: 'Celkem uživatelů', value: stats?.totalUsers ?? 0, max: Math.max(stats?.totalUsers ?? 1, 1), color: 'bg-emerald-500' },
              { label: 'Celkem projektů', value: stats?.totalProjects ?? 0, max: Math.max(stats?.totalProjects ?? 1, 1), color: 'bg-amber-500' },
              { label: 'Celkem klientů', value: stats?.totalClients ?? 0, max: Math.max(stats?.totalClients ?? 1, 1), color: 'bg-rose-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-gray-200 font-medium">{item.value.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
