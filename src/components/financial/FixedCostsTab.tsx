import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RepeatIcon, CheckCircle2, XCircle, Calendar, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import FixedCostsModal, { type FixedCost } from './FixedCostsModal';

const INTERVAL_LABELS: Record<string, string> = {
  weekly: 'Týdně',
  monthly: 'Měsíčně',
  quarterly: 'Čtvrtletně',
  yearly: 'Ročně',
  one_time: 'Jednorázově',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Nájem': 'bg-blue-500/15 text-blue-300',
  'Mzdy': 'bg-emerald-500/15 text-emerald-300',
  'Úvěry a leasing': 'bg-amber-500/15 text-amber-300',
  'Pojištění': 'bg-sky-500/15 text-sky-300',
  'Energie a utilities': 'bg-orange-500/15 text-orange-300',
  'Telefon a internet': 'bg-teal-500/15 text-teal-300',
  'Software a licence': 'bg-violet-500/15 text-violet-300',
  'Marketing': 'bg-pink-500/15 text-pink-300',
  'Účetnictví a právní služby': 'bg-indigo-500/15 text-indigo-300',
  'Doprava': 'bg-cyan-500/15 text-cyan-300',
  'Ostatní': 'bg-slate-500/15 text-slate-300',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'bg-slate-500/15 text-slate-300';
}

function fmtCZK(n: number) {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' Kč';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('cs-CZ');
}

function getMonthlyEquivalent(cost: FixedCost): number {
  const a = Number(cost.amount);
  switch (cost.interval_type) {
    case 'weekly': return a * 4.33;
    case 'monthly': return a;
    case 'quarterly': return a / 3;
    case 'yearly': return a / 12;
    case 'one_time': return 0;
    default: return a;
  }
}

function isCurrentlyActive(cost: FixedCost): boolean {
  if (!cost.is_active) return false;
  const now = new Date();
  const start = new Date(cost.start_date);
  if (start > now) return false;
  if (cost.end_date && new Date(cost.end_date) < now) return false;
  return true;
}

export default function FixedCostsTab() {
  const { toast } = useToast();
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fixed_costs')
      .select('*')
      .order('category')
      .order('name');
    setCosts((data || []) as FixedCost[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Smazat stálý náklad "${name}"?`)) return;
    const { error } = await supabase.from('fixed_costs').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Náklad smazán');
    load();
  };

  const handleToggleActive = async (cost: FixedCost) => {
    const { error } = await supabase
      .from('fixed_costs')
      .update({ is_active: !cost.is_active })
      .eq('id', cost.id);
    if (error) { toast('Chyba', 'error'); return; }
    load();
  };

  const categories = ['all', ...Array.from(new Set(costs.map(c => c.category))).sort()];

  const filtered = costs.filter(c => {
    if (filterActive === 'active' && !isCurrentlyActive(c)) return false;
    if (filterActive === 'inactive' && isCurrentlyActive(c)) return false;
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;
    return true;
  });

  const activeCosts = costs.filter(isCurrentlyActive);
  const monthlyTotal = activeCosts.reduce((s, c) => s + getMonthlyEquivalent(c), 0);
  const yearlyTotal = monthlyTotal * 12;

  const grouped = filtered.reduce<Record<string, FixedCost[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Měsíční náklady</div>
          <div className="text-2xl font-bold text-white">{fmtCZK(Math.round(monthlyTotal))}</div>
          <div className="text-xs text-slate-500 mt-1">{activeCosts.length} aktivních položek</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Roční náklady</div>
          <div className="text-2xl font-bold text-rose-400">{fmtCZK(Math.round(yearlyTotal))}</div>
          <div className="text-xs text-slate-500 mt-1">odhad z aktivních položek</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterActive === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              {f === 'all' ? 'Vše' : f === 'active' ? 'Aktivní' : 'Neaktivní'}
            </button>
          ))}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-blue-500/40 transition"
          >
            <option value="all" className="bg-[#0f172a]">Všechny kategorie</option>
            {categories.filter(c => c !== 'all').map(c => (
              <option key={c} value={c} className="bg-[#0f172a]">{c}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Přidat náklad
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <RepeatIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Žádné stálé náklady</p>
          <p className="text-sm mt-1">Přidejte první stálý náklad tlačítkem výše</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => {
            const catMonthly = items.filter(isCurrentlyActive).reduce((s, c) => s + getMonthlyEquivalent(c), 0);
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{category}</span>
                  </div>
                  {catMonthly > 0 && (
                    <span className="text-xs text-slate-500">{fmtCZK(Math.round(catMonthly))} / měs.</span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map(cost => {
                    const active = isCurrentlyActive(cost);
                    return (
                      <div
                        key={cost.id}
                        className={`group flex items-center gap-4 p-4 rounded-2xl border transition ${
                          active
                            ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                            : 'bg-white/[0.01] border-white/[0.03] opacity-60'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-rose-500/10' : 'bg-white/[0.04]'}`}>
                            <RepeatIcon className={`w-4 h-4 ${active ? 'text-rose-400' : 'text-slate-600'}`} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">{cost.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getCategoryColor(cost.category)}`}>
                              {cost.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] text-slate-400">
                              {INTERVAL_LABELS[cost.interval_type]}
                            </span>
                            {!active && cost.end_date && new Date(cost.end_date) < new Date() && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/15 text-slate-500">Ukončeno</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            {cost.interval_day && cost.interval_type !== 'one_time' && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {cost.interval_day}. v měsíci
                              </span>
                            )}
                            <span>od {fmtDate(cost.start_date)}</span>
                            {cost.end_date ? (
                              <span>do {fmtDate(cost.end_date)}</span>
                            ) : cost.interval_type !== 'one_time' ? (
                              <span className="text-slate-600">nekonečně</span>
                            ) : null}
                            {cost.note && <span className="truncate max-w-[200px]">{cost.note}</span>}
                          </div>
                        </div>

                        <div className="flex-shrink-0 text-right">
                          <div className="text-base font-bold text-white">{fmtCZK(Number(cost.amount))}</div>
                          {cost.interval_type !== 'one_time' && cost.interval_type !== 'monthly' && (
                            <div className="text-[11px] text-slate-500">
                              ≈ {fmtCZK(Math.round(getMonthlyEquivalent(cost)))} / měs.
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleToggleActive(cost)}
                            title={active ? 'Deaktivovat' : 'Aktivovat'}
                            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition"
                          >
                            {active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setEditing(cost); setShowModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cost.id, cost.name)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FixedCostsModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={load}
        editing={editing}
      />
    </div>
  );
}
