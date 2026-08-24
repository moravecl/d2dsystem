import { useEffect, useState, useCallback } from 'react';
import { Plus, Wallet, TrendingUp, TrendingDown, Search, Download, CreditCard as Edit2, Trash2, ArrowUpCircle, ArrowDownCircle, FileText, Receipt, Banknote, AlertTriangle } from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/csvExport';
import { formatCZK, formatDate } from '../../lib/invoiceUtils';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import CashTransactionModal, { type CashTransaction } from '../../components/financial/CashTransactionModal';

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Banknote }> = {
  manual: { label: 'Ruční', icon: Banknote },
  invoice_payment: { label: 'Faktura (vydaná)', icon: FileText },
  received_invoice_payment: { label: 'Faktura (přijatá)', icon: Receipt },
};

export default function CashRegisterPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [sortKey, setSortKey] = useState('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('income');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Finance', href: '/finance' },
        { label: 'Pokladna' },
      ],
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .order('transaction_date', { ascending: false });
    if (error) {
      toast('Chyba při načítání', 'error');
    }
    setTransactions((data || []) as CashTransaction[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const deleteTx = async (id: string, source: string) => {
    if (source !== 'manual' && !isAdmin) {
      toast('Automatické záznamy může mazat pouze administrátor', 'error');
      return;
    }
    const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Záznam smazán');
    setConfirmDeleteId(null);
    loadData();
  };

  const sortOptions = [
    { key: 'transaction_date', label: 'Datum' },
    { key: 'amount', label: 'Částka' },
    { key: 'description', label: 'Popis' },
    { key: 'performed_by_name', label: 'Provedl' },
    { key: 'created_at', label: 'Datum přidání' },
  ];

  const filtered = sortItems(
    transactions.filter(tx => {
      if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return tx.description.toLowerCase().includes(s) ||
          tx.note.toLowerCase().includes(s) ||
          tx.performed_by_name.toLowerCase().includes(s);
      }
      return true;
    }),
    sortKey,
    sortDir
  );

  const totalIncome = transactions
    .filter(t => t.transaction_type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const sortedForBalance = [...filtered].sort((a, b) => {
    const dCmp = b.transaction_date.localeCompare(a.transaction_date);
    if (dCmp !== 0) return dCmp;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const balanceMap = new Map<string, number>();
  const allSorted = [...transactions].sort((a, b) => {
    const dCmp = b.transaction_date.localeCompare(a.transaction_date);
    if (dCmp !== 0) return dCmp;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  let running = totalIncome - totalExpense;
  for (const tx of allSorted) {
    balanceMap.set(tx.id, running);
    if (tx.transaction_type === 'income') {
      running -= Number(tx.amount);
    } else {
      running += Number(tx.amount);
    }
  }

  const handleExport = () => {
    downloadCsv(filtered.map(tx => ({
      Datum: tx.transaction_date,
      Typ: tx.transaction_type === 'income' ? 'Příjem' : 'Výdej',
      Popis: tx.description,
      Částka: tx.amount,
      Zdroj: SOURCE_LABELS[tx.source]?.label || tx.source,
      Provedl: tx.performed_by_name,
      Poznámka: tx.note,
    })), `pokladna_${new Date().toISOString().slice(0, 10)}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-5 ${balance >= 0 ? 'bg-white/[0.06] border-white/10' : 'bg-red-500/10 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-blue-500/10' : 'bg-red-500/20'}`}>
              <Wallet className={`w-6 h-6 ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stav pokladny</div>
              <div className={`text-2xl font-extrabold ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                {formatCZK(balance)} Kč
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem příjmy</div>
              <div className="text-2xl font-extrabold text-emerald-400">{formatCZK(totalIncome)} Kč</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-500/10 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem výdeje</div>
              <div className="text-2xl font-extrabold text-red-400">{formatCZK(totalExpense)} Kč</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            {([
              { key: 'all', label: 'Vše' },
              { key: 'income', label: 'Příjmy' },
              { key: 'expense', label: 'Výdeje' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  typeFilter === t.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingTx(null); setDefaultType('income'); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition"
            >
              <Plus className="w-3 h-3" /> Příjem
            </button>
            <button
              onClick={() => { setEditingTx(null); setDefaultType('expense'); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition"
            >
              <Plus className="w-3 h-3" /> Výdej
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Hledat..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
              />
            </div>
            <SortControl
              options={sortOptions}
              sortKey={sortKey}
              sortDir={sortDir}
              onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
            />
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg transition">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="p-5">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Pokladna je prázdná</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  onClick={() => { setEditingTx(null); setDefaultType('income'); setShowModal(true); }}
                  className="text-xs font-semibold text-emerald-400 hover:underline"
                >
                  Přidat příjem
                </button>
                <span className="text-xs text-slate-300">|</span>
                <button
                  onClick={() => { setEditingTx(null); setDefaultType('expense'); setShowModal(true); }}
                  className="text-xs font-semibold text-red-400 hover:underline"
                >
                  Přidat výdej
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="pb-3 pr-4">Datum</th>
                    <th className="pb-3 pr-4">Typ</th>
                    <th className="pb-3 pr-4">Popis</th>
                    <th className="pb-3 pr-4">Zdroj</th>
                    <th className="pb-3 pr-4">Provedl</th>
                    <th className="pb-3 pr-4 text-right">Částka</th>
                    <th className="pb-3 pr-4 text-right">Zůstatek</th>
                    <th className="pb-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {sortedForBalance.map(tx => {
                    const isIncome = tx.transaction_type === 'income';
                    const src = SOURCE_LABELS[tx.source] || SOURCE_LABELS.manual;
                    const txBalance = balanceMap.get(tx.id) ?? 0;
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.04] transition group">
                        <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
                          {formatDate(tx.transaction_date)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
                            isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {isIncome
                              ? <ArrowUpCircle className="w-3 h-3" />
                              : <ArrowDownCircle className="w-3 h-3" />
                            }
                            {isIncome ? 'Příjem' : 'Výdej'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-white">{tx.description}</div>
                          {tx.note && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{tx.note}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <src.icon className="w-3 h-3" />
                            {src.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-400 text-xs">
                          {tx.performed_by_name || '-'}
                        </td>
                        <td className={`py-3 pr-4 text-right font-bold tabular-nums whitespace-nowrap ${
                          isIncome ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCZK(Number(tx.amount))} Kč
                        </td>
                        <td className="py-3 pr-4 text-right font-bold tabular-nums whitespace-nowrap text-slate-300">
                          {formatCZK(txBalance)} Kč
                        </td>
                        <td className="py-3">
                          {(tx.source === 'manual' || isAdmin) ? (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              {tx.source === 'manual' && (
                                <button
                                  onClick={() => { setEditingTx(tx); setShowModal(true); }}
                                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">auto</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CashTransactionModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingTx(null); }}
        transaction={editingTx}
        defaultType={defaultType}
        onSaved={loadData}
      />

      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Smazat záznam"
        size="sm"
        footer={
          <>
            <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button
              onClick={() => {
                const tx = transactions.find(t => t.id === confirmDeleteId);
                if (tx) deleteTx(tx.id, tx.source);
              }}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" /> Smazat trvale
            </button>
          </>
        }
      >
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <AlertTriangle className="w-4 h-4" />
            Tato akce je nevratná
          </div>
          {confirmDeleteId && transactions.find(t => t.id === confirmDeleteId)?.source !== 'manual' && (
            <p className="text-xs text-amber-400">Upozornění: Mazáte automatický záznam vytvořený systémem. Platba na faktuře zůstane nezměněna.</p>
          )}
          <p className="text-xs text-slate-400">Záznam bude trvale odstraněn z pokladny.</p>
        </div>
      </Modal>
    </div>
  );
}
