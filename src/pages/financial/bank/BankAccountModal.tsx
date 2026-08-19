import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/Toast';
import type { BankAccount } from '../../../types/bank';

interface Props {
  account: Partial<BankAccount> | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function BankAccountModal({ account, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = !!account?.id;

  const [form, setForm] = useState({
    name: account?.name || '',
    bank_name: account?.bank_name || '',
    account_number: account?.account_number || '',
    currency: account?.currency || 'CZK',
    current_balance: account?.current_balance?.toString() || '0',
    is_default: account?.is_default ?? false,
    notes: account?.notes || '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name) { toast('Zadejte název účtu', 'error'); return; }
    setSaving(true);
    const payload = {
      name: form.name,
      bank_name: form.bank_name,
      account_number: form.account_number,
      currency: form.currency,
      current_balance: parseFloat(form.current_balance) || 0,
      is_default: form.is_default,
      notes: form.notes,
    };
    const { error } = isEdit
      ? await supabase.from('bank_accounts').update(payload).eq('id', account!.id!)
      : await supabase.from('bank_accounts').insert(payload);
    setSaving(false);
    if (error) { toast('Chyba při ukládání', 'error'); return; }
    toast(isEdit ? 'Účet uložen' : 'Účet přidán', 'success');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Upravit účet' : 'Nový bankovní účet'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Název účtu *</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Např. Hlavní firemní účet"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Název banky</label>
              <input type="text" value={form.bank_name} onChange={set('bank_name')} placeholder="FIO, KB, CSOB..."
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Měna</label>
              <select value={form.currency} onChange={set('currency')}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50">
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Číslo účtu / IBAN</label>
            <input type="text" value={form.account_number} onChange={set('account_number')}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Počáteční / aktuální zůstatek (Kč)</label>
            <input type="number" value={form.current_balance} onChange={set('current_balance')}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-sm text-slate-300">Výchozí účet</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Poznámky</label>
            <textarea rows={2} value={form.notes} onChange={set('notes')}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Zrušit</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />{saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}
