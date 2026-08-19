import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, Users, Building2, Shield, User,
  SlidersHorizontal, CheckCircle, AlertTriangle
} from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_employee: boolean;
  is_portal_client: boolean;
  created_at: string;
  organization_name?: string;
  organization_id?: string;
  org_role?: string;
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);

    const [profilesRes, membersRes, orgsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('organization_members').select('user_id, organization_id, role'),
      supabase.from('organizations').select('id, name'),
    ]);

    const profiles = profilesRes.data ?? [];
    const members = membersRes.data ?? [];
    const orgs = orgsRes.data ?? [];

    const orgMap: Record<string, string> = {};
    for (const o of orgs) orgMap[o.id] = o.name;

    const memberMap: Record<string, { org_id: string; role: string }> = {};
    for (const m of members) memberMap[m.user_id] = { org_id: m.organization_id, role: m.role };

    const enriched = profiles.map(p => ({
      ...p,
      organization_name: memberMap[p.id] ? orgMap[memberMap[p.id].org_id] : undefined,
      organization_id: memberMap[p.id]?.org_id,
      org_role: memberMap[p.id]?.role,
    }));

    setUsers(enriched);
    setTotal(profiles.length);
    setLoading(false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.organization_name?.toLowerCase().includes(q);
    const matchRole = !filterRole || (filterRole === 'portal' ? u.is_portal_client : filterRole === 'admin' ? u.role === 'admin' : filterRole === 'employee' ? u.is_employee : true);
    return matchQ && matchRole;
  });

  const roleLabel = (u: UserRow) => {
    if (u.is_portal_client) return { label: 'Portál', cls: 'bg-blue-900/60 text-blue-300' };
    if (u.role === 'admin') return { label: 'Admin', cls: 'bg-amber-900/60 text-amber-300' };
    if (u.is_employee) return { label: 'Zaměstnanec', cls: 'bg-emerald-900/60 text-emerald-300' };
    return { label: 'Viewer', cls: 'bg-gray-700 text-gray-300' };
  };

  const orgRoleBadge = (role?: string) => {
    const map: Record<string, string> = {
      owner: 'text-amber-400',
      admin: 'text-blue-400',
      manager: 'text-emerald-400',
      employee: 'text-gray-400',
      viewer: 'text-gray-500',
    };
    return map[role ?? ''] ?? 'text-gray-500';
  };

  const portalCount = users.filter(u => u.is_portal_client).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const employeeCount = users.filter(u => u.is_employee && !u.is_portal_client).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Uživatelé</h1>
        <p className="text-gray-500 text-sm">{total} uživatelů na platformě</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Celkem', value: total, icon: Users, color: 'text-gray-400 bg-gray-800' },
          { label: 'Adminové', value: adminCount, icon: Shield, color: 'text-amber-400 bg-amber-900/20' },
          { label: 'Zaměstnanci', value: employeeCount, icon: User, color: 'text-emerald-400 bg-emerald-900/20' },
          { label: 'Portál klienti', value: portalCount, icon: CheckCircle, color: 'text-blue-400 bg-blue-900/20' },
        ].map(item => (
          <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{item.value}</div>
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
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat uživatele..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500 appearance-none"
          >
            <option value="">Všechny role</option>
            <option value="admin">Adminové</option>
            <option value="employee">Zaměstnanci</option>
            <option value="portal">Portál klienti</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uživatel</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizace</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Org. Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrován</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-600">Žádní uživatelé</td>
                </tr>
              ) : filtered.map(user => {
                const badge = roleLabel(user);
                return (
                  <tr key={user.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-200">{user.display_name || '—'}</div>
                          <div className="text-xs text-gray-600">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.organization_name ? (
                        <div className="flex items-center gap-1.5 text-gray-300">
                          <Building2 className="w-3.5 h-3.5 text-gray-600" />
                          {user.organization_name}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {user.org_role ? (
                        <span className={`text-xs font-medium capitalize ${orgRoleBadge(user.org_role)}`}>
                          {user.org_role}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString('cs-CZ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
