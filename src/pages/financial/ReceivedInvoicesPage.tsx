import { useEffect, useState, useCallback } from 'react';
import { Plus, FileText, CheckCircle2, Clock, AlertCircle, Search, CreditCard as Edit2, Trash2, Download, Repeat as RepeatIcon, TrendingUp, CheckSquare, X } from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { downloadCsv } from '../../lib/csvExport';
import Tabs from '../../components/ui/Tabs';
import ReceivedInvoiceModal, { type ReceivedInvoice } from '../../components/financial/ReceivedInvoiceModal';
import FixedCostsTab from '../../components/financial/FixedCostsTab';
import CashflowTab from '../../components/cashflow/CashflowTab';

interface ProjectRef { id: string; project_name: string; }

interface InvoiceWithItems extends ReceivedInvoice {
  item_count?: number;
}

interface PayModalState {
  invoice: ReceivedInvoice;
  paidDate: string;
  paidAmount: string;
}

function PayInvoiceModal({ state, onClose, onSaved }: { state: PayModalState; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [paidDate, setPaidDate] = useState(state.paidDate);
  const [paidAmount, setPaidAmount] = useState(state.paidAmount);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const amount = parseFloat(paidAmount.replace(/\s/g, '').replace(',', '.')) || Number(state.invoice.total_amount);
    const { error } = await supabase
      .from('received_invoices')
      .update({ status: 'paid', paid_date: paidDate, paid_amount: amount, updated_at: new Date().toISOString() })
      .eq('id', state.invoice.id);
    if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    toast('Faktura uhrazena');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-navy-900 border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Uhradit fakturu</h2>
            <p className="text-xs text-slate-400 mt-0.5">{state.invoice.supplier_name} — {state.invoice.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum úhrady</label>
            <input
              type="date"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm bg-navy-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Uhrazená částka (Kč)</label>
            <input
              type="text"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm bg-navy-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0"
            />
            <div className="text-[10px] text-slate-600 mt-1">Celková částka faktury: {Math.round(Number(state.invoice.total_amount)).toLocaleString('cs-CZ')} Kč</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-xl transition">
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !paidDate}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition disabled:opacity-50"
          >
            <CheckSquare className="w-4 h-4" />
            {saving ? 'Ukládám...' : 'Označit jako uhrazeno'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Koncept', color: 'text-slate-400', bg: 'bg-white/[0.06]' },
  pending: { label: 'Ke schválení', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  approved: { label: 'Schválená', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  paid: { label: 'Zaplacená', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const tabs = [
  { key: 'all', label: 'Vše' },
  { key: 'pending', label: 'Ke schválení' },
  { key: 'approved', label: 'Schválené' },
  { key: 'paid', label: 'Zaplacené' },
];

export default function ReceivedInvoicesPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithItems[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<ReceivedInvoice | null>(null);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [mainTab, setMainTab] = useState<'invoices' | 'fixed' | 'cashflow'>('invoices');
  const [payModal, setPayModal] = useState<PayModalState | null>(null);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Finance', href: '/finance' },
        { label: 'Přijaté faktury' },
      ],
      primaryAction: mainTab === 'invoices' ? {
        label: 'Nová faktura',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => { setEditInvoice(null); setShowModal(true); },
      } : undefined,
    });
  }, [setConfig, mainTab]);

  const loadData = useCallback(async () => {
    const [invRes, projRes] = await Promise.all([
      supabase.from('received_invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, project_name'),
    ]);

    const invoicesData = (invRes.data || []) as ReceivedInvoice[];

    if (invoicesData.length > 0) {
      const { data: itemCounts } = await supabase
        .from('received_invoice_items')
        .select('received_invoice_id');
      const countMap = new Map<string, number>();
      (itemCounts || []).forEach((row: { received_invoice_id: string }) => {
        countMap.set(row.received_invoice_id, (countMap.get(row.received_invoice_id) || 0) + 1);
      });
      const enriched = invoicesData.map(inv => ({
        ...inv,
        item_count: countMap.get(inv.id) || 0,
      }));
      setInvoices(enriched);
    } else {
      setInvoices([]);
    }

    setProjects((projRes.data || []) as ProjectRef[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getProjectName = (id: string | null) => {
    if (!id) return '';
    return projects.find(p => p.id === id)?.project_name || '';
  };

  const handleDelete = async (inv: ReceivedInvoice) => {
    if (!confirm(`Smazat fakturu ${inv.invoice_number || inv.supplier_name}?`)) return;
    const { error } = await supabase.from('received_invoices').delete().eq('id', inv.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Faktura smazána');
    loadData();
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const recInvSortOptions = [
    { key: 'supplier_name', label: 'Dodavatel' },
    { key: 'invoice_number', label: 'Číslo faktury' },
    { key: 'status', label: 'Stav' },
    { key: 'total_amount', label: 'Částka' },
    { key: 'due_date', label: 'Datum splatnosti' },
    { key: 'invoice_date', label: 'Datum faktury' },
    { key: 'created_at', label: 'Datum přidání' },
  ];

  const filtered = sortItems(
    invoices.filter(inv => {
      if (activeTab !== 'all' && inv.status !== activeTab) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          inv.supplier_name.toLowerCase().includes(q) ||
          inv.invoice_number.toLowerCase().includes(q) ||
          getProjectName(inv.project_id).toLowerCase().includes(q)
        );
      }
      return true;
    }),
    sortKey,
    sortDir
  );

  const totalAll = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total_amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0);

  const overdue = invoices.filter(i => {
    if (i.status === 'paid') return false;
    return new Date(i.due_date) < new Date();
  });
  const totalOverdue = overdue.reduce((s, i) => s + i.total_amount, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        <button
          onClick={() => setMainTab('invoices')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mainTab === 'invoices' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Přijaté faktury
        </button>
        <button
          onClick={() => setMainTab('fixed')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mainTab === 'fixed' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <RepeatIcon className="w-3.5 h-3.5" />
          Stálé náklady
        </button>
        <button
          onClick={() => setMainTab('cashflow')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mainTab === 'cashflow' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Cashflow
        </button>
      </div>

      {mainTab === 'fixed' && <FixedCostsTab />}
      {mainTab === 'cashflow' && <CashflowTab />}

      {mainTab === 'invoices' && <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem</div>
              <div className="text-lg font-extrabold text-white">{fmt(totalAll)} Kč</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ke schválení</div>
              <div className="text-lg font-extrabold text-amber-400">{fmt(totalPending)} Kč</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Zaplaceno</div>
              <div className="text-lg font-extrabold text-emerald-400">{fmt(totalPaid)} Kč</div>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border p-4 ${totalOverdue > 0 ? 'bg-red-500/10 border-red-200' : 'bg-white/[0.06] border-white/10'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalOverdue > 0 ? 'bg-red-500/20' : 'bg-white/[0.06]'}`}>
              <AlertCircle className={`w-5 h-5 ${totalOverdue > 0 ? 'text-red-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Po splatnosti</div>
              <div className={`text-lg font-extrabold ${totalOverdue > 0 ? 'text-red-400' : 'text-white'}`}>{fmt(totalOverdue)} Kč</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
        <div className="flex items-center">
          <div className="flex-1">
            <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          </div>
          <button
            onClick={() => {
              downloadCsv(
                filtered.map(i => ({
                  Dodavatel: i.supplier_name,
                  Číslo: i.invoice_number,
                  Datum: i.invoice_date,
                  Splatnost: i.due_date,
                  Částka: i.total_amount,
                  DPH: i.tax_amount,
                  Stav: STATUS_MAP[i.status]?.label || i.status,
                  Projekt: getProjectName(i.project_id),
                  Položek: i.item_count || 0,
                })),
                `prijate_faktury_${new Date().toISOString().slice(0, 10)}`
              );
            }}
            className="mr-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Hledat dodavatele, číslo faktury..."
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <SortControl
              options={recInvSortOptions}
              sortKey={sortKey}
              sortDir={sortDir}
              onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                  <th className="pb-3 pr-4">Dodavatel</th>
                  <th className="pb-3 pr-4">Číslo</th>
                  <th className="pb-3 pr-4">Projekt</th>
                  <th className="pb-3 pr-4">Stav</th>
                  <th className="pb-3 pr-4 text-right">Částka</th>
                  <th className="pb-3 pr-4">Splatnost</th>
                  <th className="pb-3 pr-4 text-center">Položek</th>
                  <th className="pb-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map(inv => {
                  const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                  const isOverdue = inv.status !== 'paid' && new Date(inv.due_date) < new Date();
                  return (
                    <tr key={inv.id} className="hover:bg-white/[0.04] transition">
                      <td className="py-3 pr-4 font-semibold text-white">{inv.supplier_name}</td>
                      <td className="py-3 pr-4 text-slate-400">{inv.invoice_number}</td>
                      <td className="py-3 pr-4 text-slate-400">{getProjectName(inv.project_id)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${st.bg} ${st.color}`}>{st.label}</span>
                          {isOverdue && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Po splatnosti</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right font-bold text-white">{fmt(inv.total_amount)} Kč</td>
                      <td className={`py-3 pr-4 ${isOverdue ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                        {new Date(inv.due_date).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {inv.item_count ? (
                          <span className="text-xs font-bold text-slate-500 bg-white/[0.06] px-2 py-0.5 rounded">
                            {inv.item_count}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => setPayModal({ invoice: inv, paidDate: new Date().toISOString().split('T')[0], paidAmount: String(Math.round(inv.total_amount)) })}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold transition"
                              title="Uhradit"
                            >
                              <CheckSquare className="w-3 h-3" /> Uhradit
                            </button>
                          )}
                          <button
                            onClick={() => { setEditInvoice(inv); setShowModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition"
                            title="Upravit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition"
                            title="Smazat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Žádné přijaté faktury</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ReceivedInvoiceModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditInvoice(null); }}
        invoice={editInvoice}
        onSaved={loadData}
      />

      {payModal && (
        <PayInvoiceModal
          state={payModal}
          onClose={() => setPayModal(null)}
          onSaved={loadData}
        />
      )}
      </>}
    </div>
  );
}
