import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Upload, Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Link2, MoreHorizontal, Trash2, Eye, Building2, ChevronDown, RefreshCw,
  CheckCircle2, Clock, EyeOff, Settings2,
} from 'lucide-react';
import { useHeader } from '../../../contexts/HeaderContext';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/Toast';
import type { BankAccount, BankTransaction } from '../../../types/bank';
import BankTransactionModal from './BankTransactionModal';
import BankImportModal from './BankImportModal';
import BankMatchModal from './BankMatchModal';
import BankAccountModal from './BankAccountModal';

const STATUS_CONFIG = {
  new: { label: 'Nový', color: 'text-slate-400', bg: 'bg-slate-500/15', icon: Clock },
  matched: { label: 'Spárován', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: CheckCircle2 },
  ignored: { label: 'Ignorován', color: 'text-slate-500', bg: 'bg-slate-500/10', icon: EyeOff },
};

function fmtCZK(v: number) {
  return Math.abs(v).toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
}

export default function BankPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'matched' | 'ignored'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Partial<BankTransaction> | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [matchingTx, setMatchingTx] = useState<BankTransaction | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<BankAccount> | null>(null);
  const [showAccounts, setShowAccounts] = useState(false);

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Finance', href: '/finance' }, { label: 'Banka' }],
      primaryAction: {
        label: 'Přidat pohyb',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => { setEditingTx(null); setShowTxModal(true); },
      },
      secondaryAction: {
        label: 'Import výpisu',
        icon: <Upload className="w-4 h-4" />,
        onClick: () => setShowImport(true),
      },
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [accRes, txRes] = await Promise.all([
      supabase.from('bank_accounts').select('*').order('is_default', { ascending: false }).order('name'),
      supabase.from('bank_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    setAccounts((accRes.data || []) as BankAccount[]);
    setTransactions((txRes.data || []) as BankTransaction[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const deleteTx = async (id: string) => {
    if (!confirm('Smazat tento pohyb?')) return;
    await supabase.from('bank_transaction_matches').delete().eq('transaction_id', id);
    await supabase.from('bank_transactions').delete().eq('id', id);
    setTransactions(t => t.filter(x => x.id !== id));
    toast('Pohyb smazán', 'success');
  };

  const markIgnored = async (id: string) => {
    await supabase.from('bank_transactions').update({ status: 'ignored' }).eq('id', id);
    setTransactions(t => t.map(x => x.id === id ? { ...x, status: 'ignored' } : x));
    setOpenMenu(null);
  };

  const markNew = async (id: string) => {
    await supabase.from('bank_transactions').update({ status: 'new' }).eq('id', id);
    setTransactions(t => t.map(x => x.id === id ? { ...x, status: 'new' } : x));
    setOpenMenu(null);
  };

  const filtered = transactions.filter(tx => {
    if (selectedAccountId !== 'all' && tx.account_id !== selectedAccountId) return false;
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !tx.description.toLowerCase().includes(q) &&
        !tx.counterparty_name.toLowerCase().includes(q) &&
        !tx.vs.includes(q) &&
        !tx.reference.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalCredit = filtered.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
  const totalDebit = filtered.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
  const countNew = transactions.filter(t => t.status === 'new').length;
  const countMatched = transactions.filter(t => t.status === 'matched').length;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const computedBalance = selectedAccountId === 'all'
    ? accounts.reduce((s, a) => s + Number(a.current_balance), 0)
    : Number(selectedAccount?.current_balance ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
            <Building2 className="w-3.5 h-3.5" />
            Zůstatek na účtu
          </div>
          <div className={`text-2xl font-bold ${computedBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
            {computedBalance.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč
          </div>
          <div className="text-xs text-slate-500 mt-1">{selectedAccountId === 'all' ? `${accounts.length} účtů` : selectedAccount?.bank_name || ''}</div>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Příjmy (filtr)
          </div>
          <div className="text-2xl font-bold text-emerald-400">+{fmtCZK(totalCredit)}</div>
          <div className="text-xs text-slate-500 mt-1">{filtered.filter(t => t.type === 'credit').length} pohybů</div>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
            <TrendingDown className="w-3.5 h-3.5" />
            Výdaje (filtr)
          </div>
          <div className="text-2xl font-bold text-red-400">-{fmtCZK(totalDebit)}</div>
          <div className="text-xs text-slate-500 mt-1">{filtered.filter(t => t.type === 'debit').length} pohybů</div>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
            <Clock className="w-3.5 h-3.5" />
            Ke zpracování
          </div>
          <div className="text-2xl font-bold text-amber-400">{countNew}</div>
          <div className="text-xs text-slate-500 mt-1">{countMatched} spárováno</div>
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <button
            onClick={() => setShowAccounts(s => !s)}
            className="flex items-center gap-2 text-sm font-medium text-white hover:text-blue-300 transition-colors">
            <Building2 className="w-4 h-4" />
            Bankovní účty ({accounts.length})
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAccounts ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => { setEditingAccount(null); setShowAccountModal(true); }}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Přidat účet
          </button>
        </div>
        {showAccounts && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.length === 0 && (
              <div className="col-span-full text-center py-6 text-slate-500 text-sm">
                Žádné bankovní účty. Přidejte první účet.
              </div>
            )}
            {accounts.map(acc => (
              <div key={acc.id}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedAccountId === acc.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                onClick={() => setSelectedAccountId(a => a === acc.id ? 'all' : acc.id)}>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    {acc.name}
                    {acc.is_default && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Výchozí</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{acc.bank_name} · {acc.account_number}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-bold ${Number(acc.current_balance) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {Number(acc.current_balance).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingAccount(acc); setShowAccountModal(true); }}
                    className="text-slate-500 hover:text-white transition-colors p-1">
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-white/10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Hledat pohyb, protistranu, VS..."
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50">
              <option value="all">Všechny účty</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {(['all', 'new', 'matched', 'ignored'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300' : 'bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white'}`}>
                {s === 'all' ? 'Vše' : STATUS_CONFIG[s].label}
              </button>
            ))}
            {(['all', 'credit', 'debit'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${typeFilter === t ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300' : 'bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white'}`}>
                {t === 'all' ? 'Příjem+Výdaj' : t === 'credit' ? 'Příjmy' : 'Výdaje'}
              </button>
            ))}
            <button onClick={loadData} className="p-2 text-slate-400 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Žádné pohyby nenalezeny</p>
            {transactions.length === 0 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button onClick={() => { setEditingTx(null); setShowTxModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm rounded-lg hover:bg-blue-600/30 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  Přidat ručně
                </button>
                <button onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/10 text-slate-300 text-sm rounded-lg hover:bg-white/[0.08] transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Importovat výpis
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filtered.map(tx => {
              const statusCfg = STATUS_CONFIG[tx.status];
              const StatusIcon = statusCfg.icon;
              const acc = accounts.find(a => a.id === tx.account_id);
              return (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] group transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'credit' ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                    {tx.type === 'credit'
                      ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {tx.description || tx.counterparty_name || '—'}
                      </span>
                      {tx.vs && <span className="text-[10px] text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">VS: {tx.vs}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span>{tx.date}</span>
                      {tx.counterparty_name && tx.counterparty_name !== tx.description && (
                        <span className="truncate max-w-[180px]">{tx.counterparty_name}</span>
                      )}
                      {acc && <span className="text-slate-600">{acc.name}</span>}
                    </div>
                  </div>

                  <div className={`text-sm font-bold shrink-0 ${tx.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{fmtCZK(tx.amount)}
                  </div>

                  <div className="shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setOpenMenu(m => m === tx.id ? null : tx.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === tx.id && (
                      <div className="absolute right-0 top-full mt-1 bg-[#2C2C2E] border border-white/15 rounded-xl shadow-xl z-20 w-44 py-1"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setMatchingTx(tx); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                          <Link2 className="w-3.5 h-3.5" />
                          Párovat s fakturou
                        </button>
                        <button onClick={() => { setEditingTx(tx); setShowTxModal(true); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                          Upravit
                        </button>
                        {tx.status !== 'ignored'
                          ? <button onClick={() => markIgnored(tx.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                            <EyeOff className="w-3.5 h-3.5" />
                            Ignorovat
                          </button>
                          : <button onClick={() => markNew(tx.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                            <Clock className="w-3.5 h-3.5" />
                            Označit jako nový
                          </button>
                        }
                        <hr className="border-white/10 my-1" />
                        <button onClick={() => { deleteTx(tx.id); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          Smazat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] text-xs text-slate-500">
            <span>{filtered.length} pohybů</span>
            <span className={`font-medium ${(totalCredit - totalDebit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Saldo: {(totalCredit - totalDebit) >= 0 ? '+' : ''}{(totalCredit - totalDebit).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč
            </span>
          </div>
        )}
      </div>

      {showTxModal && (
        <BankTransactionModal
          transaction={editingTx}
          accounts={accounts}
          onClose={() => setShowTxModal(false)}
          onSaved={loadData}
        />
      )}
      {showImport && (
        <BankImportModal
          accounts={accounts}
          onClose={() => setShowImport(false)}
          onImported={loadData}
        />
      )}
      {matchingTx && (
        <BankMatchModal
          transaction={matchingTx}
          onClose={() => setMatchingTx(null)}
          onSaved={loadData}
        />
      )}
      {showAccountModal && (
        <BankAccountModal
          account={editingAccount}
          onClose={() => setShowAccountModal(false)}
          onSaved={loadData}
        />
      )}

      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
