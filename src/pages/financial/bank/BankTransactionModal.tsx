import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/Toast';
import type { BankTransaction, BankAccount } from '../../../types/bank';

interface Props {
  transaction: Partial<BankTransaction> | null;
  accounts: BankAccount[];
  onClose: () => void;
  onSaved: () => void;
}

export default function BankTransactionModal({ transaction, accounts, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = !!transaction?.id;

  const [form, setForm] = useState({
    account_id: transaction?.account_id || (accounts[0]?.id ?? ''),
    date: transaction?.date || new Date().toISOString().slice(0, 10),
    amount: transaction ? Math.abs(Number(transaction.amount)).toString() : '',
    type: (transaction?.type ?? 'credit') as 'credit' | 'debit',
    description: transaction?.description || '',
    counterparty_name: transaction?.counterparty_name || '',
    counterparty_account: transaction?.counterparty_account || '',
    vs: transaction?.vs || '',
    ks: transaction?.ks || '',
    ss: transaction?.ss || '',
    raw_note: transaction?.raw_note || '',
  });

  useEffect(() => {
    if (!isEdit && accounts.length > 0 && !form.account_id) {
      setForm(f => ({ ...f, account_id: accounts[0].id }));
    }
  }, [accounts, isEdit, form.account_id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.date || !form.amount) {
      toast('Vyplňte datum a částku', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      account_id: form.account_id || null,
      date: form.date,
      amount: parseFloat(form.amount),
      type: form.type,
      description: form.description,
      counterparty_name: form.counterparty_name,
      counterparty_account: form.counterparty_account,
      vs: form.vs,
      ks: form.ks,
      ss: form.ss,
      raw_note: form.raw_note,
    };
    const { error } = isEdit
      ? await supabase.from('bank_transactions').update(payload).eq('id', transaction!.id!)
      : await supabase.from('bank_transactions').insert(payload);
    setSaving(false);
    if (error) {
      toast('Chyba při ukládání', 'error');
      return;
    }
    toast(isEdit ? 'Pohyb uložen' : 'Pohyb přidán', 'success');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Upravit pohyb' : 'Nový pohyb'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Datum *</label>
              <input type="date" value={form.date} onChange={set('date')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Typ *</label>
              <select value={form.type} onChange={set('type')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50">
                <option value="credit">Příjem (Credit)</option>
                <option value="debit">Výdaj (Debit)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Částka (Kč) *</label>
              <input type="number" value={form.amount} onChange={set('amount')} placeholder="0"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Bankovní účet</label>
              <select value={form.account_id} onChange={set('account_id')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50">
                <option value="">— bez účtu —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Popis</label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Popis transakce"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Protiúčet – název</label>
              <input type="text" value={form.counterparty_name} onChange={set('counterparty_name')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Protiúčet – číslo</label>
              <input type="text" value={form.counterparty_account} onChange={set('counterparty_account')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">VS</label>
              <input type="text" value={form.vs} onChange={set('vs')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">KS</label>
              <input type="text" value={form.ks} onChange={set('ks')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">SS</label>
              <input type="text" value={form.ss} onChange={set('ss')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Poznámka</label>
            <textarea rows={2} value={form.raw_note} onChange={set('raw_note')}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Zrušit</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}
