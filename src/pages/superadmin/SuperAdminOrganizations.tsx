import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2, Search, ChevronDown, ChevronUp, Users, FolderOpen,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, SlidersHorizontal,
  X, Save, FileText
} from 'lucide-react';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  is_active: boolean;
  is_suspended: boolean;
  superadmin_notes: string;
  created_at: string;
  member_count?: number;
  project_count?: number;
}

interface OrgPlan {
  id: string;
  name: string;
  slug: string;
}

interface EditModal {
  org: OrgRow;
  notes: string;
  tier: string;
  is_suspended: boolean;
}

const tierColors: Record<string, string> = {
  free: 'bg-gray-700 text-gray-300',
  pro: 'bg-blue-900/60 text-blue-300',
  business: 'bg-emerald-900/60 text-emerald-300',
  enterprise: 'bg-amber-900/60 text-amber-300',
};

export default function SuperAdminOrganizations() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [, setPlans] = useState<OrgPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'created_at' | 'member_count'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterTier, setFilterTier] = useState('');
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [orgsRes, plansRes] = await Promise.all([
      supabase.from('organizations').select('id, name, slug, subscription_tier, is_active, is_suspended, superadmin_notes, created_at').order('created_at', { ascending: false }),
      supabase.from('org_plans').select('id, name, slug').order('sort_order'),
    ]);

    const orgData = orgsRes.data ?? [];

    const memberCounts = await Promise.all(
      orgData.map((o) =>
        supabase.from('organization_members').select('id', { count: 'exact' }).eq('organization_id', o.id)
      )
    );
    const projectCounts = await Promise.all(
      orgData.map((o) =>
        supabase.from('projects').select('id', { count: 'exact' }).eq('organization_id', o.id)
      )
    );

    const enriched = orgData.map((o, i) => ({
      ...o,
      member_count: memberCounts[i].count ?? 0,
      project_count: projectCounts[i].count ?? 0,
    }));

    setOrgs(enriched);
    setPlans(plansRes.data ?? []);
    setLoading(false);
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = orgs
    .filter(o => {
      const q = search.toLowerCase();
      return (o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)) &&
        (!filterTier || o.subscription_tier === filterTier);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'member_count') return ((a.member_count ?? 0) - (b.member_count ?? 0)) * dir;
      return new Date(a.created_at).getTime() > new Date(b.created_at).getTime() ? dir : -dir;
    });

  const handleSave = async () => {
    if (!editModal) return;
    setSaving(true);
    await supabase.from('organizations').update({
      subscription_tier: editModal.tier,
      is_suspended: editModal.is_suspended,
      superadmin_notes: editModal.notes,
    }).eq('id', editModal.org.id);
    setSaving(false);
    setEditModal(null);
    loadData();
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-gray-600" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Organizace</h1>
        <p className="text-gray-500 text-sm">{orgs.length} organizací na platformě</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat organizaci..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={filterTier}
            onChange={e => setFilterTier(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500 appearance-none"
          >
            <option value="">Všechny plány</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-gray-300 transition" onClick={() => toggleSort('name')}>
                    Název <SortIcon col="name" />
                  </button>
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plán</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-gray-300 transition" onClick={() => toggleSort('member_count')}>
                    Uživatelé <SortIcon col="member_count" />
                  </button>
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Projekty</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stav</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-gray-300 transition" onClick={() => toggleSort('created_at')}>
                    Vytvořeno <SortIcon col="created_at" />
                  </button>
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-600">Žádné organizace</td>
                </tr>
              ) : filtered.map(org => (
                <tr key={org.id} className="hover:bg-gray-800/40 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-200">{org.name}</div>
                        <div className="text-xs text-gray-600">{org.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tierColors[org.subscription_tier] ?? 'bg-gray-700 text-gray-300'}`}>
                      {org.subscription_tier}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <Users className="w-3.5 h-3.5 text-gray-600" />
                      {org.member_count}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <FolderOpen className="w-3.5 h-3.5 text-gray-600" />
                      {org.project_count}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {org.is_suspended ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3" /> Pozastaveno
                      </span>
                    ) : org.is_active ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> Aktivní
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Neaktivní</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {new Date(org.created_at).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setEditModal({ org, notes: org.superadmin_notes ?? '', tier: org.subscription_tier, is_suspended: org.is_suspended })}
                      className="text-gray-500 hover:text-amber-400 transition p-1.5 rounded-lg hover:bg-gray-800"
                      title="Upravit"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="font-semibold text-white">{editModal.org.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Úprava organizace</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-gray-500 hover:text-gray-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Plán</label>
                <select
                  value={editModal.tier}
                  onChange={e => setEditModal(m => m ? { ...m, tier: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Stav</label>
                <button
                  onClick={() => setEditModal(m => m ? { ...m, is_suspended: !m.is_suspended } : null)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition w-full border ${editModal.is_suspended ? 'border-red-700 bg-red-900/20 text-red-400' : 'border-emerald-700 bg-emerald-900/20 text-emerald-400'}`}
                >
                  {editModal.is_suspended ? (
                    <><ToggleLeft className="w-5 h-5" /> Organizace pozastavena — kliknutím obnovíte</>
                  ) : (
                    <><ToggleRight className="w-5 h-5" /> Organizace aktivní — kliknutím pozastavíte</>
                  )}
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Interní poznámky</div>
                </label>
                <textarea
                  value={editModal.notes}
                  onChange={e => setEditModal(m => m ? { ...m, notes: e.target.value } : null)}
                  rows={3}
                  placeholder="Poznámky viditelné pouze pro superadminy..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition">
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
