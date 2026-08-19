import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, FileText, Package, Clock,
  DollarSign, ArrowUpRight, ArrowDownRight, FileInput,
  Plus, FilePlus, Trash2, Edit2, PenLine, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/csvExport';
import { useToast } from '../ui/Toast';
import { usePermissions } from '../../hooks/usePermissions';
import ManualEntryModal, { type FinancialEntry } from '../financial/ManualEntryModal';
import InvoiceFromProjectModal from '../financial/InvoiceFromProjectModal';
import type { InvoiceItem } from '../../lib/invoiceUtils';

interface IssuedInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  tax_amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
}

interface ReceivedInv {
  id: string;
  supplier_name: string;
  invoice_number: string;
  total_amount: number;
  tax_amount: number;
  status: string;
  invoice_date: string;
}

interface ReceivedInvItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  received_invoice_id: string;
}

interface WarehouseTx {
  id: string;
  item_id: string;
  type: string;
  quantity: number;
  note: string;
  created_at: string;
}

interface WarehouseItemRef {
  id: string;
  name: string;
  price_per_unit: number;
}

interface TimeEntry {
  id: string;
  hours: number;
  description: string;
  date: string;
  user_id: string;
}

interface ProfileRef {
  id: string;
  display_name: string | null;
  email: string;
}

interface Props {
  projectId: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  sent: 'Odeslaná',
  paid: 'Zaplacena',
  overdue: 'Po splatnosti',
  pending: 'Ke schválení',
  approved: 'Schválená',
};

export default function ProjectFinanceTab({ projectId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canViewFinancials = hasPermission('view_financial_reports');

  if (!canViewFinancials) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Lock className="w-8 h-8 mb-3" />
        <p className="text-sm font-medium">Nemate opravneni zobrazit financni data tohoto projektu.</p>
      </div>
    );
  }
  const [issuedInvoices, setIssuedInvoices] = useState<IssuedInvoice[]>([]);
  const [receivedInvoices, setReceivedInvoices] = useState<ReceivedInv[]>([]);
  const [receivedItems, setReceivedItems] = useState<ReceivedInvItem[]>([]);
  const [receivedInvMap, setReceivedInvMap] = useState<Map<string, ReceivedInv>>(new Map());
  const [warehouseTxs, setWarehouseTxs] = useState<WarehouseTx[]>([]);
  const [whItems, setWhItems] = useState<Map<string, WarehouseItemRef>>(new Map());
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [manualEntries, setManualEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [costView, setCostView] = useState<'summary' | 'invoices' | 'items' | 'material' | 'labor' | 'manual'>('summary');

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [defaultEntryType, setDefaultEntryType] = useState<'income' | 'expense'>('income');
  const [showInvoiceFromProject, setShowInvoiceFromProject] = useState(false);

  const loadData = useCallback(async () => {
    const [
      issuedRes,
      recInvWholeRes,
      recItemsRes,
      whTxRes,
      timeRes,
      profilesRes,
      entriesRes,
    ] = await Promise.all([
      supabase.from('invoices').select('id, invoice_number, amount, tax_amount, status, due_date, paid_at')
        .eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('received_invoices').select('id, supplier_name, invoice_number, total_amount, tax_amount, status, invoice_date')
        .eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('received_invoice_items').select('id, description, quantity, unit, unit_price, total_price, received_invoice_id')
        .eq('project_id', projectId),
      supabase.from('warehouse_transactions').select('id, item_id, type, quantity, note, created_at')
        .eq('project_id', projectId).eq('type', 'out').order('created_at', { ascending: false }),
      supabase.from('time_entries').select('id, hours, description, date, user_id')
        .eq('project_id', projectId).order('date', { ascending: false }),
      supabase.from('profiles').select('id, display_name, email'),
      supabase.from('financial_entries').select('*')
        .eq('project_id', projectId).order('entry_date', { ascending: false }),
    ]);

    const issued = (issuedRes.data || []) as IssuedInvoice[];
    const recWhole = (recInvWholeRes.data || []) as ReceivedInv[];
    const recItems = (recItemsRes.data || []) as ReceivedInvItem[];

    setIssuedInvoices(issued);
    setReceivedInvoices(recWhole);
    setReceivedItems(recItems);
    setManualEntries((entriesRes.data || []) as FinancialEntry[]);

    const parentInvIds = [...new Set(recItems.map(it => it.received_invoice_id))];
    const nonWholeIds = parentInvIds.filter(pid => !recWhole.find(r => r.id === pid));
    if (nonWholeIds.length > 0) {
      const { data: parentInvs } = await supabase
        .from('received_invoices')
        .select('id, supplier_name, invoice_number, total_amount, tax_amount, status, invoice_date')
        .in('id', nonWholeIds);
      const map = new Map<string, ReceivedInv>();
      recWhole.forEach(r => map.set(r.id, r));
      (parentInvs || []).forEach((r: ReceivedInv) => map.set(r.id, r));
      setReceivedInvMap(map);
    } else {
      const map = new Map<string, ReceivedInv>();
      recWhole.forEach(r => map.set(r.id, r));
      setReceivedInvMap(map);
    }

    const txs = (whTxRes.data || []) as WarehouseTx[];
    setWarehouseTxs(txs);

    if (txs.length > 0) {
      const itemIds = [...new Set(txs.map(t => t.item_id))];
      const { data: whItemsData } = await supabase
        .from('warehouse_items')
        .select('id, name, price_per_unit')
        .in('id', itemIds);
      const m = new Map<string, WarehouseItemRef>();
      (whItemsData || []).forEach((w: WarehouseItemRef) => m.set(w.id, w));
      setWhItems(m);
    }

    setTimeEntries((timeRes.data || []) as TimeEntry[]);

    const pMap = new Map<string, string>();
    ((profilesRes.data || []) as ProfileRef[]).forEach(p => {
      pMap.set(p.id, p.display_name || p.email);
    });
    setProfiles(pMap);

    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase.from('financial_entries').delete().eq('id', entryId);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Záznam smazán');
    loadData();
  };

  const handleInvoiceFromProject = (items: InvoiceItem[], note: string) => {
    const encoded = encodeURIComponent(JSON.stringify({ items, note }));
    navigate(`/finance/faktura/nova?project=${projectId}&prefill=${encoded}`);
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const manualIncome = manualEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const manualExpense = manualEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0);

  const totalRevenue = issuedInvoices.reduce((s, i) => s + i.amount, 0) + manualIncome;
  const totalRevenuePaid = issuedInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0) + manualIncome;

  const costWholeInvoices = receivedInvoices.reduce((s, i) => s + i.total_amount, 0);
  const costItemsOnly = receivedItems.reduce((s, it) => s + it.total_price, 0);
  const costMaterial = warehouseTxs.reduce((s, t) => {
    const item = whItems.get(t.item_id);
    return s + (item ? item.price_per_unit * t.quantity : 0);
  }, 0);
  const totalHours = timeEntries.reduce((s, e) => s + e.hours, 0);
  const costLabor = totalHours * 450;

  const totalCosts = costWholeInvoices + costItemsOnly + costMaterial + costLabor + manualExpense;
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-navy-900/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const costCategories = [
    { key: 'invoices', label: 'Přijaté faktury (celek)', amount: costWholeInvoices, icon: FileInput, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { key: 'items', label: 'Položky faktur', amount: costItemsOnly, icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { key: 'material', label: 'Materiál ze skladu', amount: costMaterial, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { key: 'labor', label: `Práce (${fmt(totalHours)} h)`, amount: costLabor, icon: Clock, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { key: 'manual', label: 'Ruční náklady', amount: manualExpense, icon: PenLine, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 justify-end flex-wrap">
        <button
          onClick={() => setShowInvoiceFromProject(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition"
        >
          <FilePlus className="w-3.5 h-3.5" />
          Fakturovat z nabidky
        </button>
        <button
          onClick={() => navigate(`/finance/faktura/nova?project=${projectId}`)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg transition"
        >
          <FilePlus className="w-3.5 h-3.5" />
          Prazdna faktura
        </button>
        <button
          onClick={() => { setEditingEntry(null); setDefaultEntryType('income'); setShowEntryModal(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Výnos
        </button>
        <button
          onClick={() => { setEditingEntry(null); setDefaultEntryType('expense'); setShowEntryModal(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Náklad
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Výnosy</div>
              <div className="text-lg font-extrabold text-emerald-400">{fmt(totalRevenue)} Kč</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Náklady</div>
              <div className="text-lg font-extrabold text-red-400">{fmt(totalCosts)} Kč</div>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border p-4 ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              <DollarSign className={`w-5 h-5 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Zisk / Ztráta</div>
              <div className={`text-lg font-extrabold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profit >= 0 ? '+' : ''}{fmt(profit)} Kč
              </div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${margin >= 20 ? 'bg-emerald-500/10' : margin >= 0 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
              {profit >= 0 ? <ArrowUpRight className={`w-5 h-5 ${margin >= 20 ? 'text-emerald-400' : 'text-amber-400'}`} /> : <ArrowDownRight className="w-5 h-5 text-red-400" />}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Marže</div>
              <div className={`text-lg font-extrabold ${margin >= 20 ? 'text-emerald-400' : margin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {margin.toFixed(1)} %
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
          <div className="px-5 pt-5 pb-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Výnosy</h3>
            {(issuedInvoices.length > 0 || manualEntries.filter(e => e.entry_type === 'income').length > 0) && (
              <button
                onClick={() => downloadCsv(
                  [
                    ...issuedInvoices.map(i => ({
                      Typ: 'Faktura',
                      Popis: i.invoice_number,
                      Částka: i.amount,
                      Stav: STATUS_LABELS[i.status] || i.status,
                      Datum: i.due_date,
                    })),
                    ...manualEntries.filter(e => e.entry_type === 'income').map(e => ({
                      Typ: 'Ruční',
                      Popis: e.description,
                      Částka: e.amount,
                      Stav: e.category || '',
                      Datum: e.entry_date,
                    })),
                  ],
                  `vynosy_projekt_${new Date().toISOString().slice(0, 10)}`
                )}
                className="text-[10px] font-bold text-slate-500 hover:text-blue-400 transition"
              >
                CSV
              </button>
            )}
          </div>
          <div className="p-5">
            {issuedInvoices.length === 0 && manualEntries.filter(e => e.entry_type === 'income').length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">Žádné výnosy</div>
            ) : (
              <div className="space-y-2">
                {issuedInvoices.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => navigate(`/finance/faktura/${inv.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${inv.status === 'paid' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                      <FileText className={`w-4 h-4 ${inv.status === 'paid' ? 'text-emerald-400' : 'text-blue-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{inv.invoice_number}</div>
                      <div className="text-xs text-slate-400">
                        {STATUS_LABELS[inv.status] || inv.status} | Splatnost: {new Date(inv.due_date).toLocaleDateString('cs-CZ')}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-400">+{fmt(inv.amount)} Kč</div>
                  </div>
                ))}
                {manualEntries.filter(e => e.entry_type === 'income').map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <PenLine className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{entry.description}</div>
                      <div className="text-xs text-slate-400">
                        {entry.category && `${entry.category} | `}{new Date(entry.entry_date).toLocaleDateString('cs-CZ')}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-400">+{fmt(Number(entry.amount))} Kč</div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => { setEditingEntry(entry); setShowEntryModal(true); }} className="p-1 rounded hover:bg-white/[0.07]">
                        <Edit2 className="w-3 h-3 text-slate-400" />
                      </button>
                      <button onClick={() => deleteEntry(entry.id)} className="p-1 rounded hover:bg-red-500/20">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-2">
                  <span className="text-xs font-semibold text-slate-400">Celkem výnosy</span>
                  <span className="text-sm font-extrabold text-white">{fmt(totalRevenue)} Kč</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Uhrazeno</span>
                  <span className="text-sm font-extrabold text-emerald-400">{fmt(totalRevenuePaid)} Kč</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
          <div className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Náklady</h3>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'summary', label: 'Přehled' },
                { key: 'invoices', label: 'Faktury' },
                { key: 'items', label: 'Položky' },
                { key: 'material', label: 'Materiál' },
                { key: 'labor', label: 'Práce' },
                { key: 'manual', label: 'Ruční' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setCostView(t.key as typeof costView)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
 costView === t.key
 ? 'bg-white/[0.06] text-navy-900'
 : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.10]'
 }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            {costView === 'summary' && (
              <div className="space-y-3">
                {costCategories.map(cat => (
                  <div key={cat.key} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
                    <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                      <cat.icon className={`w-4 h-4 ${cat.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-300">{cat.label}</div>
                    </div>
                    <div className="text-sm font-bold text-white">{fmt(cat.amount)} Kč</div>
                    {totalCosts > 0 && (
                      <div className="w-12 text-right text-[10px] font-bold text-slate-500">
                        {((cat.amount / totalCosts) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-2">
                  <span className="text-xs font-semibold text-slate-400">Celkové náklady</span>
                  <span className="text-sm font-extrabold text-red-400">{fmt(totalCosts)} Kč</span>
                </div>
                {totalCosts > 0 && (
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-white/[0.06]">
                    {costCategories.filter(c => c.amount > 0).map(cat => (
                      <div
                        key={cat.key}
                        className={`${cat.bg} transition-all`}
                        style={{ width: `${(cat.amount / totalCosts) * 100}%` }}
                        title={`${cat.label}: ${fmt(cat.amount)} Kč`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {costView === 'invoices' && (
              <div className="space-y-2">
                {receivedInvoices.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádné přijaté faktury přiřazeny k projektu</div>
                ) : (
                  receivedInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <FileInput className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">{inv.supplier_name}</div>
                        <div className="text-xs text-slate-400">
                          {inv.invoice_number} | {STATUS_LABELS[inv.status] || inv.status} | {new Date(inv.invoice_date).toLocaleDateString('cs-CZ')}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-red-400">-{fmt(inv.total_amount)} Kč</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {costView === 'items' && (
              <div className="space-y-2">
                {receivedItems.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádné položky faktur přiřazeny k projektu</div>
                ) : (
                  receivedItems.map(item => {
                    const parentInv = receivedInvMap.get(item.received_invoice_id);
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{item.description || 'Položka'}</div>
                          <div className="text-xs text-slate-400">
                            {parentInv?.supplier_name || ''} {parentInv?.invoice_number ? `(${parentInv.invoice_number})` : ''} | {item.quantity} {item.unit} x {fmt(item.unit_price)} Kč
                          </div>
                        </div>
                        <div className="text-sm font-bold text-red-400">-{fmt(item.total_price)} Kč</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {costView === 'material' && (
              <div className="space-y-2">
                {warehouseTxs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádný materiál vydán na projekt</div>
                ) : (
                  warehouseTxs.map(tx => {
                    const item = whItems.get(tx.item_id);
                    const cost = item ? item.price_per_unit * tx.quantity : 0;
                    return (
                      <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Package className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{item?.name || 'Položka'}</div>
                          <div className="text-xs text-slate-400">
                            {tx.quantity} ks x {item ? fmt(item.price_per_unit) : '?'} Kč | {new Date(tx.created_at).toLocaleDateString('cs-CZ')}
                            {tx.note ? ` | ${tx.note}` : ''}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-red-400">-{fmt(cost)} Kč</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {costView === 'labor' && (
              <div className="space-y-2">
                {timeEntries.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádné záznamy práce</div>
                ) : (
                  <>
                    {timeEntries.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-teal-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {profiles.get(entry.user_id) || 'Pracovník'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {entry.description || 'Práce'} | {new Date(entry.date).toLocaleDateString('cs-CZ')}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 font-semibold">{entry.hours} h</div>
                        <div className="text-sm font-bold text-red-400">-{fmt(entry.hours * 450)} Kč</div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-2">
                      <span className="text-xs text-slate-500">Sazba 450 Kč/h</span>
                      <span className="text-xs font-semibold text-slate-400">{fmt(totalHours)} h = {fmt(costLabor)} Kč</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {costView === 'manual' && (
              <div className="space-y-2">
                {manualEntries.filter(e => e.entry_type === 'expense').length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Žádné ruční náklady</div>
                ) : (
                  manualEntries.filter(e => e.entry_type === 'expense').map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition group">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                        <PenLine className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">{entry.description}</div>
                        <div className="text-xs text-slate-400">
                          {entry.category && `${entry.category} | `}{new Date(entry.entry_date).toLocaleDateString('cs-CZ')}
                          {entry.note && ` | ${entry.note}`}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-red-400">-{fmt(Number(entry.amount))} Kč</div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => { setEditingEntry(entry); setShowEntryModal(true); }} className="p-1 rounded hover:bg-white/[0.07]">
                          <Edit2 className="w-3 h-3 text-slate-400" />
                        </button>
                        <button onClick={() => deleteEntry(entry.id)} className="p-1 rounded hover:bg-red-500/20">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ManualEntryModal
        open={showEntryModal}
        onClose={() => { setShowEntryModal(false); setEditingEntry(null); }}
        entry={editingEntry}
        defaultProjectId={projectId}
        defaultType={defaultEntryType}
        onSaved={loadData}
      />

      <InvoiceFromProjectModal
        open={showInvoiceFromProject}
        onClose={() => setShowInvoiceFromProject(false)}
        projectId={projectId}
        defaultVatRate={21}
        onConfirm={handleInvoiceFromProject}
      />
    </div>
  );
}
