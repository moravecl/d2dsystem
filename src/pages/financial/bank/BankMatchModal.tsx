import { useState, useEffect } from 'react';
import { X, Link2, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/Toast';
import type { BankTransaction, BankTransactionMatch } from '../../../types/bank';

interface IssuedInvoice { id: string; invoice_number: string; client_name: string; total: number; due_date: string; status: string; }
interface ReceivedInvoice { id: string; invoice_number?: string; supplier_name: string; total_amount: number; due_date: string; status: string; }

interface Props {
  transaction: BankTransaction;
  onClose: () => void;
  onSaved: () => void;
}

const MATCH_LABELS: Record<BankTransactionMatch['match_type'], string> = {
  issued_invoice: 'Vydaná faktura',
  received_invoice: 'Přijatá faktura',
  manual_cost: 'Ruční náklad',
  manual_income: 'Ruční příjem',
};

export default function BankMatchModal({ transaction, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [matchType, setMatchType] = useState<BankTransactionMatch['match_type']>(
    transaction.type === 'credit' ? 'issued_invoice' : 'received_invoice'
  );
  const [issuedInvoices, setIssuedInvoices] = useState<IssuedInvoice[]>([]);
  const [receivedInvoices, setReceivedInvoices] = useState<ReceivedInvoice[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [matchedAmount, setMatchedAmount] = useState(String(transaction.amount));
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingMatches, setExistingMatches] = useState<BankTransactionMatch[]>([]);

  useEffect(() => {
    const load = async () => {
      const [issued, received, matches] = await Promise.all([
        supabase.from('invoices').select('id, invoice_number, client_name, total, due_date, status').neq('status', 'cancelled').order('due_date', { ascending: false }),
        supabase.from('received_invoices').select('id, invoice_number, supplier_name, total_amount, due_date, status').order('due_date', { ascending: false }),
        supabase.from('bank_transaction_matches').select('*').eq('transaction_id', transaction.id),
      ]);
      setIssuedInvoices((issued.data || []) as IssuedInvoice[]);
      setReceivedInvoices((received.data || []) as ReceivedInvoice[]);
      setExistingMatches((matches.data || []) as BankTransactionMatch[]);
    };
    load();
  }, [transaction.id]);

  const handleSave = async () => {
    if (!matchedAmount || parseFloat(matchedAmount) <= 0) {
      toast('Zadejte platnou částku', 'error');
      return;
    }
    if ((matchType === 'issued_invoice' || matchType === 'received_invoice') && !selectedId) {
      toast('Vyberte fakturu', 'error');
      return;
    }
    setSaving(true);
    const { error: matchErr } = await supabase.from('bank_transaction_matches').insert({
      transaction_id: transaction.id,
      match_type: matchType,
      match_id: selectedId || null,
      matched_amount: parseFloat(matchedAmount),
      note,
    });
    if (matchErr) { toast('Chyba při párování', 'error'); setSaving(false); return; }

    await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', transaction.id);

    if (matchType === 'issued_invoice' && selectedId) {
      await supabase.from('invoices').update({ status: 'paid', paid_at: transaction.date }).eq('id', selectedId);
    }
    if (matchType === 'received_invoice' && selectedId) {
      await supabase.from('received_invoices').update({ status: 'paid', paid_date: transaction.date, paid_amount: parseFloat(matchedAmount) }).eq('id', selectedId);
    }

    setSaving(false);
    toast('Párování uloženo', 'success');
    onSaved();
    onClose();
  };

  const deleteMatch = async (id: string) => {
    await supabase.from('bank_transaction_matches').delete().eq('id', id);
    setExistingMatches(m => m.filter(x => x.id !== id));
    toast('Párování odebráno', 'success');
  };

  const filteredIssued = issuedInvoices.filter(inv =>
    !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.client_name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredReceived = receivedInvoices.filter(inv =>
    !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.supplier_name.toLowerCase().includes(search.toLowerCase())
  );

  const fmtCZK = (v: number) => v.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-white">Párování pohybu</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 bg-white/[0.03] border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{transaction.date} · {transaction.description || transaction.counterparty_name || '—'}</span>
            <span className={`font-bold ${transaction.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
              {transaction.type === 'credit' ? '+' : '-'}{fmtCZK(transaction.amount)}
            </span>
          </div>
          {transaction.vs && <div className="text-xs text-slate-500 mt-0.5">VS: {transaction.vs}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {existingMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">Existující párování:</p>
              {existingMatches.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs">
                  <div>
                    <span className="text-emerald-300 font-medium">{MATCH_LABELS[m.match_type]}</span>
                    <span className="text-slate-400 ml-2">{fmtCZK(m.matched_amount)}</span>
                    {m.note && <span className="text-slate-500 ml-2">· {m.note}</span>}
                  </div>
                  <button onClick={() => deleteMatch(m.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Typ párování</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MATCH_LABELS) as [BankTransactionMatch['match_type'], string][]).map(([k, v]) => (
                <button key={k} onClick={() => { setMatchType(k); setSelectedId(''); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${matchType === k ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {(matchType === 'issued_invoice' || matchType === 'received_invoice') && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                {matchType === 'issued_invoice' ? 'Vydaná faktura' : 'Přijatá faktura'}
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Hledat..." className="w-full bg-white/[0.06] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {(matchType === 'issued_invoice' ? filteredIssued : filteredReceived).map(inv => {
                  const label = matchType === 'issued_invoice'
                    ? `${(inv as IssuedInvoice).invoice_number || '—'} · ${(inv as IssuedInvoice).client_name}`
                    : `${(inv as ReceivedInvoice).invoice_number || (inv as ReceivedInvoice).supplier_name}`;
                  const amount = matchType === 'issued_invoice' ? (inv as IssuedInvoice).total : (inv as ReceivedInvoice).total_amount;
                  const isSelected = selectedId === inv.id;
                  return (
                    <button key={inv.id} onClick={() => { setSelectedId(inv.id); setMatchedAmount(String(amount)); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border ${isSelected ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:bg-white/[0.06]'}`}>
                      <span className="truncate">{label}</span>
                      <span className="shrink-0 ml-2 font-medium">{fmtCZK(amount)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(matchType === 'manual_cost' || matchType === 'manual_income') && (
            <div className="bg-white/[0.04] rounded-xl p-3 text-xs text-slate-400">
              Pohyb bude označen jako {matchType === 'manual_cost' ? 'náklad' : 'příjem'} bez vazby na fakturu.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Párovaná částka (Kč)</label>
              <input type="number" value={matchedAmount} onChange={e => setMatchedAmount(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Poznámka</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Zrušit</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Link2 className="w-4 h-4" />
            {saving ? 'Ukládám...' : 'Párovat'}
          </button>
        </div>
      </div>
    </div>
  );
}
