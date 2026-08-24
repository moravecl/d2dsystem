import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Edit2, Save, X, Check, Users, FolderOpen, HardDrive } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  max_users: number;
  max_projects: number;
  max_storage_mb: number;
  price_monthly: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface EditState extends Omit<Plan, 'features'> {
  features_text: string;
}

const tierColors: Record<string, string> = {
  free: 'border-gray-700 bg-gray-800/30',
  pro: 'border-blue-700/50 bg-blue-900/10',
  business: 'border-emerald-700/50 bg-emerald-900/10',
  enterprise: 'border-amber-700/50 bg-amber-900/10',
};

const tierBadge: Record<string, string> = {
  free: 'bg-gray-700 text-gray-300',
  pro: 'bg-blue-900/60 text-blue-300',
  business: 'bg-emerald-900/60 text-emerald-300',
  enterprise: 'bg-amber-900/60 text-amber-300',
};

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgCounts, setOrgCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    const { data } = await supabase.from('org_plans').select('*').order('sort_order');
    const planList = (data ?? []) as Plan[];
    setPlans(planList);

    const counts: Record<string, number> = {};
    for (const slug of ['free', 'pro', 'business', 'enterprise']) {
      const { count } = await supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('subscription_tier', slug);
      counts[slug] = count ?? 0;
    }
    setOrgCounts(counts);
    setLoading(false);
  };

  const startEdit = (plan: Plan) => {
    setEditId(plan.id);
    setEditState({ ...plan, features_text: plan.features.join('\n') });
  };

  const cancelEdit = () => { setEditId(null); setEditState(null); };

  const saveEdit = async () => {
    if (!editState) return;
    setSaving(true);
    const { features_text, ...rest } = editState;
    await supabase.from('org_plans').update({
      ...rest,
      features: features_text.split('\n').map(f => f.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    }).eq('id', editState.id);
    setSaving(false);
    cancelEdit();
    loadPlans();
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Plány & Limity</h1>
        <p className="text-gray-500 text-sm">Správa předplatných plánů platformy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {plans.map(plan => (
          <div key={plan.id} className={`bg-gray-900 border rounded-xl overflow-hidden ${tierColors[plan.slug] ?? 'border-gray-700'}`}>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tierBadge[plan.slug] ?? 'bg-gray-700 text-gray-300'}`}>
                      {plan.slug}
                    </span>
                    {!plan.is_active && (
                      <span className="text-[10px] text-gray-600">(neaktivní)</span>
                    )}
                  </div>
                  <div className="text-lg font-bold text-white">{plan.name}</div>
                </div>
                <button
                  onClick={() => startEdit(plan)}
                  className="text-gray-600 hover:text-amber-400 transition p-1 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="text-2xl font-bold text-white mb-1">
                {plan.price_monthly > 0 ? (
                  <>{plan.price_monthly.toLocaleString()} Kč<span className="text-sm font-normal text-gray-500">/měs</span></>
                ) : (
                  <span className="text-emerald-400">Zdarma</span>
                )}
              </div>

              <div className="text-xs text-gray-500 mb-4">
                {orgCounts[plan.slug] ?? 0} organizací na tomto plánu
              </div>

              <div className="space-y-2 text-sm border-t border-gray-700/50 pt-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <Users className="w-3.5 h-3.5 text-gray-600" />
                  {plan.max_users >= 999 ? 'Neomezeno' : `Max ${plan.max_users}`} uživatelů
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <FolderOpen className="w-3.5 h-3.5 text-gray-600" />
                  {plan.max_projects >= 9999 ? 'Neomezeno' : `Max ${plan.max_projects}`} projektů
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <HardDrive className="w-3.5 h-3.5 text-gray-600" />
                  {plan.max_storage_mb >= 102400 ? 'Neomezeno' : `${(plan.max_storage_mb / 1024).toFixed(0)} GB`} úložiště
                </div>
              </div>

              {plan.features.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editId && editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="font-semibold text-white">Upravit plán: {editState.name}</h3>
              <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Název</label>
                  <input
                    value={editState.name}
                    onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Cena / měsíc (Kč)</label>
                  <input
                    type="number"
                    value={editState.price_monthly}
                    onChange={e => setEditState(s => s ? { ...s, price_monthly: parseFloat(e.target.value) || 0 } : null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Max uživatelů</label>
                  <input
                    type="number"
                    value={editState.max_users}
                    onChange={e => setEditState(s => s ? { ...s, max_users: parseInt(e.target.value) || 0 } : null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Max projektů</label>
                  <input
                    type="number"
                    value={editState.max_projects}
                    onChange={e => setEditState(s => s ? { ...s, max_projects: parseInt(e.target.value) || 0 } : null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Úložiště (MB)</label>
                  <input
                    type="number"
                    value={editState.max_storage_mb}
                    onChange={e => setEditState(s => s ? { ...s, max_storage_mb: parseInt(e.target.value) || 0 } : null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Features (jeden řádek = jedna položka)
                </label>
                <textarea
                  value={editState.features_text}
                  onChange={e => setEditState(s => s ? { ...s, features_text: e.target.value } : null)}
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditState(s => s ? { ...s, is_active: !s.is_active } : null)}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition ${editState.is_active ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600 bg-gray-800'}`}
                >
                  {editState.is_active && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className="text-sm text-gray-300">Plán je aktivní</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition">
                Zrušit
              </button>
              <button
                onClick={saveEdit}
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
