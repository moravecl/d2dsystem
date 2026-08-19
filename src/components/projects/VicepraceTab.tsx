import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, CheckCircle2, Clock, XCircle, AlertTriangle, CreditCard as Edit2, Trash2, ThumbsUp, ThumbsDown, FileText, ChevronDown, ChevronUp, Download, Search, Package, Lock, User, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { downloadCsv } from '../../lib/csvExport';
import { useCatalogData } from '../../hooks/useCatalogData';
import type { Profile, Product, Category } from '../../types/database';

interface VicepraceItem {
  id: string;
  viceprace_id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

interface Viceprace {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  requested_by: string;
  amount: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items?: VicepraceItem[];
}

interface Props {
  projectId: string;
  profiles?: Profile[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: 'Koncept', color: 'text-slate-400', bg: 'bg-white/[0.06]', icon: FileText },
  pending: { label: 'Ke schválení', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  approved: { label: 'Schváleno', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  rejected: { label: 'Zamítnuto', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  completed: { label: 'Dokončeno', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
};

const UNITS = ['ks', 'm', 'm2', 'm3', 'hod', 'kpl', 'kg'];

interface LineItem {
  id?: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export default function VicepraceTab({ projectId, profiles = [] }: Props) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { products: catalogProducts, categories } = useCatalogData();
  const [items, setItems] = useState<Viceprace[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Viceprace | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', requested_by: '', status: 'draft',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ name: '', unit: 'ks', quantity: 1, unit_price: 0 }]);
  const [pickerLineIdx, setPickerLineIdx] = useState<number | null>(null);
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('viceprace')
      .select('*, viceprace_items(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    const mapped = (data || []).map((v: any) => ({
      ...v,
      items: (v.viceprace_items || []).sort((a: VicepraceItem, b: VicepraceItem) => a.sort_order - b.sort_order),
    }));
    setItems(mapped as Viceprace[]);
    setLoading(false);

    const approverIds = [...new Set(
      (mapped as Viceprace[]).map(v => v.approved_by).filter(Boolean) as string[]
    )];
    if (approverIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', approverIds);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { nameMap[p.id] = p.display_name || p.email || ''; });
      setApproverNames(nameMap);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const totalApproved = items
    .filter(i => i.status === 'approved' || i.status === 'completed')
    .reduce((s, i) => s + i.amount, 0);
  const totalPending = items
    .filter(i => i.status === 'pending')
    .reduce((s, i) => s + i.amount, 0);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const lineTotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);

  const addLine = () => setLineItems([...lineItems, { name: '', unit: 'ks', quantity: 1, unit_price: 0 }]);
  const removeLine = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
    if (pickerLineIdx === idx) setPickerLineIdx(null);
  };
  const updateLine = (idx: number, updates: Partial<LineItem>) => {
    setLineItems(lineItems.map((li, i) => i === idx ? { ...li, ...updates } : li));
  };

  const handlePickProduct = (idx: number, product: Product) => {
    updateLine(idx, {
      name: product.name,
      unit_price: product.price,
      unit: 'ks',
    });
    setPickerLineIdx(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const validLines = lineItems.filter(li => li.name.trim());
    const amount = validLines.reduce((s, li) => s + li.quantity * li.unit_price, 0);

    if (editing) {
      const { error } = await supabase
        .from('viceprace')
        .update({
          title: form.title, description: form.description,
          requested_by: form.requested_by, status: form.status,
          amount, updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
      if (error) { toast('Chyba', 'error'); return; }

      await supabase.from('viceprace_items').delete().eq('viceprace_id', editing.id);
      if (validLines.length > 0) {
        await supabase.from('viceprace_items').insert(
          validLines.map((li, idx) => ({
            viceprace_id: editing.id,
            name: li.name, unit: li.unit,
            quantity: li.quantity, unit_price: li.unit_price,
            sort_order: idx,
          }))
        );
      }
      toast('Vícepráce aktualizována');
    } else {
      const { data: newVp, error } = await supabase
        .from('viceprace')
        .insert({
          project_id: projectId, title: form.title,
          description: form.description, requested_by: form.requested_by,
          amount, status: form.status, created_by: user!.id,
        })
        .select('id')
        .maybeSingle();
      if (error || !newVp) { toast('Chyba', 'error'); return; }

      if (validLines.length > 0) {
        await supabase.from('viceprace_items').insert(
          validLines.map((li, idx) => ({
            viceprace_id: newVp.id,
            name: li.name, unit: li.unit,
            quantity: li.quantity, unit_price: li.unit_price,
            sort_order: idx,
          }))
        );
      }
      toast('Vícepráce vytvořena');
    }
    setView('list');
    setEditing(null);
    loadData();
  };

  const handleApprove = async (item: Viceprace) => {
    await supabase.from('viceprace').update({
      status: 'approved', approved_by: user!.id,
      approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    toast('Schváleno');
    loadData();
  };

  const handleReject = async (item: Viceprace) => {
    await supabase.from('viceprace').update({
      status: 'rejected', approved_by: user!.id,
      approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    toast('Zamítnuto');
    loadData();
  };

  const handleComplete = async (item: Viceprace) => {
    await supabase.from('viceprace').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', item.id);
    toast('Dokončeno');
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat vícepráce včetně položek?')) return;
    await supabase.from('viceprace').delete().eq('id', id);
    toast('Smazáno');
    loadData();
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '', requested_by: '', status: 'draft' });
    setLineItems([{ name: '', unit: 'ks', quantity: 1, unit_price: 0 }]);
    setView('form');
  };

  const openEdit = (item: Viceprace) => {
    setEditing(item);
    setForm({ title: item.title, description: item.description, requested_by: item.requested_by, status: item.status });
    setLineItems(
      item.items && item.items.length > 0
        ? item.items.map(li => ({ id: li.id, name: li.name, unit: li.unit, quantity: li.quantity, unit_price: li.unit_price }))
        : [{ name: '', unit: 'ks', quantity: 1, unit_price: 0 }]
    );
    setView('form');
  };

  const exportItem = (item: Viceprace) => {
    if (!item.items || item.items.length === 0) return;
    downloadCsv(
      item.items.map(li => ({ Polozka: li.name, Jednotka: li.unit, Mnozstvi: li.quantity, Jednotkova_cena: li.unit_price, Celkem: li.total_price })),
      `viceprace_${item.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`
    );
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  if (view === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setView('list'); setEditing(null); }}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na přehled
          </button>
          <h2 className="text-lg font-bold text-white">
            {editing ? 'Upravit vícepráce' : 'Nová vícepráce'}
          </h2>
        </div>

        <div className="bg-white/[0.06] rounded-xl border border-white/[0.08] p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název vícepráce *</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Např. Přídavné elektro práce"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Zadal (klient/stavbyvedoucí)</label>
              <input
                value={form.requested_by}
                onChange={e => setForm({ ...form, requested_by: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>

          {editing && (
            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Položky nabídky</label>
              <button onClick={addLine} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition">
                <Plus className="w-3.5 h-3.5" /> Přidat položku
              </button>
            </div>

            <div className="border border-white/[0.08] rounded-xl overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.04] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-3 py-2">Položka</th>
                    <th className="text-left px-2 py-2 w-20">Jedn.</th>
                    <th className="text-right px-2 py-2 w-20">Množ.</th>
                    <th className="text-right px-2 py-2 w-28">Cena/j.</th>
                    <th className="text-right px-2 py-2 w-24">Celkem</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {lineItems.map((li, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-1.5 relative">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={li.name}
                            onChange={e => updateLine(idx, { name: e.target.value })}
                            placeholder="Název položky..."
                            className="flex-1 text-sm text-white bg-transparent border-0 focus:outline-none placeholder-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => setPickerLineIdx(pickerLineIdx === idx ? null : idx)}
                            className={`p-1 rounded-lg shrink-0 transition ${pickerLineIdx === idx ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/[0.06] text-slate-400 hover:text-slate-300'}`}
                            title="Vybrat z katalogu"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {pickerLineIdx === idx && (
                          <VicepraceProductPicker
                            products={catalogProducts}
                            categories={categories}
                            onPick={(p) => handlePickProduct(idx, p)}
                            onClose={() => setPickerLineIdx(null)}
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={li.unit}
                          onChange={e => updateLine(idx, { unit: e.target.value })}
                          className="text-xs text-white bg-transparent border-0 focus:outline-none"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={li.quantity}
                          onChange={e => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm text-white text-right bg-transparent border-0 focus:outline-none"
                          min={0}
                          step={0.5}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={li.unit_price}
                          onChange={e => updateLine(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm text-white text-right bg-transparent border-0 focus:outline-none"
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-sm font-bold text-slate-300">
                        {fmt(li.quantity * li.unit_price)}
                      </td>
                      <td className="px-1 py-1.5">
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLine(idx)}
                            className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.04] border-t border-white/[0.08]">
                    <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-bold text-slate-400 uppercase">
                      Celkem bez DPH:
                    </td>
                    <td className="px-2 py-2.5 text-right text-sm font-extrabold text-white">
                      {fmt(lineTotal)} Kc
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            <div className="text-sm font-extrabold text-white">
              Celkem: {fmt(lineTotal)} Kc
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('list'); setEditing(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
              >
                {editing ? 'Uložit' : 'Vytvořit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/[0.06] rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem schváleno</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{fmt(totalApproved)} Kc</div>
          <div className="text-xs text-slate-400 mt-0.5">{items.filter(i => i.status === 'approved' || i.status === 'completed').length} položek</div>
        </div>
        <div className="bg-white/[0.06] rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Čeká na schválení</div>
          <div className="text-xl font-extrabold text-amber-400 mt-1">{fmt(totalPending)} Kc</div>
          <div className="text-xs text-slate-400 mt-0.5">{items.filter(i => i.status === 'pending').length} položek</div>
        </div>
        <div className="flex items-center justify-center">
          <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-sm">
            <Plus className="w-4 h-4" /> Nová vícepráce
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Žádné vícepráce</p>
          <p className="text-xs text-slate-500 mt-1">Přidejte první vícepráce kliknutím na tlačítko výše</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const st = STATUS_MAP[item.status] || STATUS_MAP.draft;
            const StIcon = st.icon;
            const isExpanded = expandedId === item.id;
            const isLocked = ['approved', 'rejected', 'completed'].includes(item.status);
            return (
              <div key={item.id} className="bg-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden transition">
                <div className="flex items-start gap-4 p-4">
                  <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <StIcon className={`w-5 h-5 ${st.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${st.bg} ${st.color}`}>{st.label}</span>
                      {isLocked && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{item.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {item.requested_by && <span>Zadal: {item.requested_by}</span>}
                      <span>{new Date(item.created_at).toLocaleDateString('cs-CZ')}</span>
                      {item.items && <span>{item.items.length} položek</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-extrabold text-white">{fmt(item.amount)} Kc</div>
                    <div className="flex items-center gap-1 mt-2 justify-end">
                      {item.status === 'pending' && isAdmin && (
                        <>
                          <button onClick={() => handleApprove(item)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition" title="Schválit"><ThumbsUp className="w-4 h-4" /></button>
                          <button onClick={() => handleReject(item)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition" title="Zamítnout"><ThumbsDown className="w-4 h-4" /></button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <button onClick={() => handleComplete(item)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition" title="Dokončit"><CheckCircle2 className="w-4 h-4" /></button>
                      )}
                      {item.items && item.items.length > 0 && (
                        <button onClick={() => exportItem(item)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-300 transition" title="Export CSV"><Download className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-300 transition">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {!isLocked && (
                        <>
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-300 transition"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && item.items && item.items.length > 0 && (
                  <div className="border-t border-white/[0.06] px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">
                          <th className="pb-2 pr-3">Položka</th>
                          <th className="pb-2 pr-3 w-16">Jedn.</th>
                          <th className="pb-2 pr-3 w-20 text-right">Množství</th>
                          <th className="pb-2 pr-3 w-24 text-right">Jedn. cena</th>
                          <th className="pb-2 w-24 text-right">Celkem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {item.items.map(li => (
                          <tr key={li.id} className="hover:bg-white/[0.02]">
                            <td className="py-2 pr-3 font-medium text-slate-300">{li.name}</td>
                            <td className="py-2 pr-3 text-slate-500">{li.unit}</td>
                            <td className="py-2 pr-3 text-right text-slate-300">{li.quantity}</td>
                            <td className="py-2 pr-3 text-right text-slate-300">{fmt(li.unit_price)} Kc</td>
                            <td className="py-2 text-right font-bold text-white">{fmt(li.total_price)} Kc</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/[0.08]">
                          <td colSpan={4} className="pt-2 text-right font-bold text-slate-300 pr-3">Celkem:</td>
                          <td className="pt-2 text-right font-extrabold text-white">{fmt(item.amount)} Kc</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {item.approved_by && item.approved_at && (
                  <div className={`border-t px-4 py-2.5 flex items-center gap-3 ${
                    item.status === 'rejected'
                      ? 'border-red-500/20 bg-red-500/10'
                      : 'border-emerald-500/20 bg-emerald-500/10'
                  }`}>
                    <User className={`w-3.5 h-3.5 shrink-0 ${
                      item.status === 'rejected' ? 'text-red-400' : 'text-emerald-400'
                    }`} />
                    <span className={`text-xs font-medium ${
                      item.status === 'rejected' ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {item.status === 'rejected' ? 'Zamítnuto' : 'Schváleno'}
                      {approverNames[item.approved_by]
                        ? ` - ${approverNames[item.approved_by]}`
                        : ` - ${getProfileName(item.approved_by)}`
                      }
                    </span>
                    <span className={`text-[10px] ${
                      item.status === 'rejected' ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {new Date(item.approved_at).toLocaleDateString('cs-CZ', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VicepraceProductPicker({
  products,
  categories,
  onPick,
  onClose,
}: {
  products: Product[];
  categories: Category[];
  onPick: (product: Product) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const q = search.toLowerCase();
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
  );

  const grouped = categories
    .map((cat) => ({
      cat,
      items: filtered.filter((p) => p.category_id === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div
      ref={ref}
      className="absolute left-0 z-50 mt-1 w-80 bg-[#0f1f3f] border border-white/[0.12] rounded-xl shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b border-white/[0.08]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat produkt..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-64 overflow-auto">
        {grouped.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">Žádný produkt nenalezen</div>
        ) : (
          grouped.map(({ cat, items }) => (
            <div key={cat.id}>
              <div className="px-3 py-1.5 bg-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0">
                {cat.name}
              </div>
              {items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 hover:bg-blue-500/10 transition"
                >
                  <div className="w-7 h-7 rounded-md overflow-hidden bg-white/[0.06] shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-slate-400">
                        {p.code}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.brand} {p.code}</div>
                  </div>
                  {p.price > 0 && (
                    <span className="text-xs font-bold text-blue-400 shrink-0">
                      {Math.round(p.price).toLocaleString('cs-CZ')} Kc
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
