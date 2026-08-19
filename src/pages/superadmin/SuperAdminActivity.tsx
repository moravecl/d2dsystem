import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, LogIn, LogOut, Monitor, Clock, Users, Activity,
  Building2, ChevronDown, ChevronUp, RefreshCw, Trash2, Filter,
  Calendar, ArrowUpRight, User
} from 'lucide-react';

interface ActivityRow {
  id: string;
  user_id: string;
  org_id: string | null;
  event_type: 'login' | 'logout' | 'page_view';
  page_path: string | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
  profile?: {
    display_name: string;
    email: string;
    role: string;
    is_portal_client: boolean;
  };
  org_name?: string;
}

interface UserSummary {
  user_id: string;
  display_name: string;
  email: string;
  org_name: string;
  is_portal_client: boolean;
  last_login: string | null;
  last_seen: string | null;
  login_count: number;
  page_views: number;
  sessions: number;
}

type View = 'timeline' | 'users';

const eventIcon = (type: string) => {
  if (type === 'login') return <LogIn className="w-3.5 h-3.5 text-emerald-400" />;
  if (type === 'logout') return <LogOut className="w-3.5 h-3.5 text-red-400" />;
  return <Monitor className="w-3.5 h-3.5 text-blue-400" />;
};

const eventLabel = (type: string) => {
  if (type === 'login') return 'Přihlášení';
  if (type === 'logout') return 'Odhlášení';
  return 'Zobrazení stránky';
};

const eventBg = (type: string) => {
  if (type === 'login') return 'bg-emerald-500/10 border-emerald-500/20';
  if (type === 'logout') return 'bg-red-500/10 border-red-500/20';
  return 'bg-blue-500/10 border-blue-500/20';
};

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Právě teď';
  if (m < 60) return `Před ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Před ${h} hod`;
  const d = Math.floor(h / 24);
  return `Před ${d} dny`;
}

function parseUserAgent(ua: string | null) {
  if (!ua) return null;
  let browser = 'Neznámý';
  let os = '';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  return os ? `${browser} / ${os}` : browser;
}

export default function SuperAdminActivity() {
  const [view, setView] = useState<View>('users');
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [dateRange, setDateRange] = useState('7');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState({ logins: 0, pageViews: 0, activeUsers: 0, todayLogins: 0 });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString();

    const [actRes, profilesRes, membersRes, orgsRes] = await Promise.all([
      supabase
        .from('user_activity_log')
        .select('id, user_id, organization_id, org_id, event_type, page_path, event_data, ip_address, user_agent, session_id, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('profiles').select('id, display_name, email, role, is_portal_client'),
      supabase.from('organization_members').select('user_id, organization_id'),
      supabase.from('organizations').select('id, name'),
    ]);

    const profiles = profilesRes.data ?? [];
    const members = membersRes.data ?? [];
    const orgs = orgsRes.data ?? [];

    const profileMap: Record<string, ActivityRow['profile']> = {};
    for (const p of profiles) profileMap[p.id] = p;

    const orgMap: Record<string, string> = {};
    for (const o of orgs) orgMap[o.id] = o.name;

    const memberMap: Record<string, string> = {};
    for (const m of members) memberMap[m.user_id] = m.organization_id;

    const enriched: ActivityRow[] = (actRes.data ?? []).map((a: Record<string, unknown>) => {
      const resolvedOrgId = (a.org_id as string | null) ?? (a.organization_id as string | null);
      const pagePath = (a.page_path as string | null) ?? ((a.event_data as Record<string, unknown>)?.page as string | null) ?? null;
      return {
        id: a.id as string,
        user_id: a.user_id as string,
        org_id: resolvedOrgId,
        event_type: a.event_type as ActivityRow['event_type'],
        page_path: pagePath,
        ip_address: (a.ip_address as string | null) ?? null,
        user_agent: (a.user_agent as string | null) ?? null,
        session_id: (a.session_id as string | null) ?? null,
        created_at: a.created_at as string,
        profile: profileMap[a.user_id as string],
        org_name: resolvedOrgId ? orgMap[resolvedOrgId] : (memberMap[a.user_id as string] ? orgMap[memberMap[a.user_id as string]] : undefined),
      };
    });

    setActivities(enriched);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const loginEvents = enriched.filter(a => a.event_type === 'login');
    const uniqueActiveUsers = new Set(enriched.map(a => a.user_id)).size;

    setStats({
      logins: loginEvents.length,
      pageViews: enriched.filter(a => a.event_type === 'page_view').length,
      activeUsers: uniqueActiveUsers,
      todayLogins: loginEvents.filter(a => new Date(a.created_at) >= todayStart).length,
    });

    const userMap = new Map<string, UserSummary>();
    for (const a of enriched) {
      if (!userMap.has(a.user_id)) {
        const p = profileMap[a.user_id];
        const orgId = a.org_id ?? memberMap[a.user_id];
        userMap.set(a.user_id, {
          user_id: a.user_id,
          display_name: p?.display_name ?? 'Neznámý',
          email: p?.email ?? '',
          org_name: orgId ? orgMap[orgId] ?? '' : '',
          is_portal_client: p?.is_portal_client ?? false,
          last_login: null,
          last_seen: null,
          login_count: 0,
          page_views: 0,
          sessions: 0,
        });
      }
      const u = userMap.get(a.user_id)!;
      if (a.event_type === 'login') {
        u.login_count++;
        if (!u.last_login || a.created_at > u.last_login) u.last_login = a.created_at;
      }
      if (a.event_type === 'page_view') u.page_views++;
      if (!u.last_seen || a.created_at > u.last_seen) u.last_seen = a.created_at;
    }

    const summaries = Array.from(userMap.values()).sort((a, b) => {
      const ta = a.last_seen ?? '';
      const tb = b.last_seen ?? '';
      return tb.localeCompare(ta);
    });
    setUserSummaries(summaries);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredActivities = activities.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.profile?.email?.toLowerCase().includes(q) || a.profile?.display_name?.toLowerCase().includes(q) || a.page_path?.toLowerCase().includes(q) || a.org_name?.toLowerCase().includes(q);
    const matchEvent = !filterEvent || a.event_type === filterEvent;
    const matchUser = !selectedUser || a.user_id === selectedUser;
    return matchQ && matchEvent && matchUser;
  });

  const filteredUsers = userSummaries.filter(u => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q) || u.org_name.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Aktivita uživatelů</h1>
          <p className="text-gray-500 text-sm">Sledování přihlášení a aktivity na platformě</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition"
        >
          <RefreshCw className="w-4 h-4" />
          Obnovit
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users, label: 'Aktivní uživatelé', value: stats.activeUsers, color: 'text-blue-400 bg-blue-500/10' },
          { icon: LogIn, label: 'Přihlášení celkem', value: stats.logins, color: 'text-emerald-400 bg-emerald-500/10' },
          { icon: Clock, label: 'Přihlášení dnes', value: stats.todayLogins, color: 'text-amber-400 bg-amber-500/10' },
          { icon: Monitor, label: 'Zobrazení stránek', value: stats.pageViews, color: 'text-gray-400 bg-gray-700' },
        ].map(item => (
          <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedUser(null); }}
            placeholder="Hledat uživatele, email, cestu..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500 appearance-none"
          >
            <option value="1">Dnes</option>
            <option value="7">Posledních 7 dní</option>
            <option value="30">Posledních 30 dní</option>
            <option value="90">Posledních 90 dní</option>
          </select>
        </div>
        {view === 'timeline' && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterEvent}
              onChange={e => setFilterEvent(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500 appearance-none"
            >
              <option value="">Všechny události</option>
              <option value="login">Přihlášení</option>
              <option value="logout">Odhlášení</option>
              <option value="page_view">Zobrazení stránek</option>
            </select>
          </div>
        )}
        <div className="flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setView('users')}
            className={`px-4 py-2.5 text-sm font-medium transition ${view === 'users' ? 'bg-amber-500/15 text-amber-300' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Uživatelé
          </button>
          <button
            onClick={() => setView('timeline')}
            className={`px-4 py-2.5 text-sm font-medium transition ${view === 'timeline' ? 'bg-amber-500/15 text-amber-300' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Timeline
          </button>
        </div>
      </div>

      {selectedUser && view === 'timeline' && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
          <User className="w-4 h-4" />
          Filtrováno pro: {activities.find(a => a.user_id === selectedUser)?.profile?.display_name ?? selectedUser}
          <button onClick={() => setSelectedUser(null)} className="ml-auto text-amber-400 hover:text-amber-200 text-xs underline">
            Zrušit filtr
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'users' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uživatel</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizace</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <button className="flex items-center gap-1 hover:text-gray-300" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                      Poslední přihlášení
                      {sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poslední aktivita</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Přihlášení</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stránky</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-600">Žádná data</td>
                  </tr>
                ) : filteredUsers
                  .sort((a, b) => {
                    const ta = a.last_login ?? '';
                    const tb = b.last_login ?? '';
                    return sortDir === 'desc' ? tb.localeCompare(ta) : ta.localeCompare(tb);
                  })
                  .map(u => (
                    <tr key={u.user_id} className="hover:bg-gray-800/40 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-200">{u.display_name}</div>
                            <div className="text-xs text-gray-600">{u.email}</div>
                          </div>
                          {u.is_portal_client && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300">portál</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {u.org_name ? (
                          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                            <Building2 className="w-3.5 h-3.5 text-gray-600" />
                            {u.org_name}
                          </div>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {u.last_login ? (
                          <div>
                            <div className="text-gray-300 text-sm">{relativeTime(u.last_login)}</div>
                            <div className="text-xs text-gray-600">{new Date(u.last_login).toLocaleString('cs-CZ')}</div>
                          </div>
                        ) : <span className="text-gray-600 text-xs">Nikdy</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {u.last_seen ? (
                          <div className="text-gray-400 text-sm">{relativeTime(u.last_seen)}</div>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-gray-300 font-medium">{u.login_count}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-gray-300 font-medium">{u.page_views}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => { setSelectedUser(u.user_id); setView('timeline'); }}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-400 transition"
                          title="Zobrazit timeline"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Čas</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Událost</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uživatel</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizace</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stránka / Detail</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prohlížeč</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-600">
                      Žádné záznamy — aktivita se začne zobrazovat po přihlášení uživatelů
                    </td>
                  </tr>
                ) : filteredActivities.map(a => (
                  <tr key={a.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="text-gray-300 text-xs font-medium">{relativeTime(a.created_at)}</div>
                      <div className="text-gray-600 text-xs">{new Date(a.created_at).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${eventBg(a.event_type)}`}>
                        {eventIcon(a.event_type)}
                        {eventLabel(a.event_type)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedUser(a.user_id)}
                        className="flex items-center gap-2 hover:text-amber-300 transition text-left"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-gray-200 text-xs font-medium">{a.profile?.display_name ?? '—'}</div>
                          <div className="text-gray-600 text-[10px]">{a.profile?.email}</div>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {a.org_name ? (
                        <span className="text-gray-400 text-xs">{a.org_name}</span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 max-w-[200px]">
                      {a.page_path ? (
                        <span className="text-blue-400 text-xs font-mono truncate block">{a.page_path}</span>
                      ) : a.ip_address ? (
                        <span className="text-gray-500 text-xs">{a.ip_address}</span>
                      ) : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-500 text-xs">{parseUserAgent(a.user_agent) ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredActivities.length >= 500 && (
            <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600 text-center">
              Zobrazeno max. 500 záznamů — upřesněte filtr pro starší data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
