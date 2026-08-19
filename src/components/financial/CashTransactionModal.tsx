import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

export interface CashTransaction {
  id: string;
  transaction_type: 'income' | 'expense';
  amount: number;
  description: string;
  note: string;
  source: 'manual' | 'invoice_payment' | 'received_invoice_payment';
  reference_id: string | null;
  performed_by: string | null;
  performed_by_name: string;
  transaction_date: string;
  created_by: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  display_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  transaction: CashTransaction | null;
  defaultType?: 'income' | 'expense';
  onSaved: () => void;
}

export default function CashTransactionModal({ open, onClose, transaction, defaultType, onSaved }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    transaction_type: 'income' as 'income' | 'expense',
    amount: 0,
    description: '',
    note: '',
    performed_by: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });

  const loadTeam = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name');
    setTeam((data || []) as TeamMember[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadTeam();
    if (transaction) {
      setForm({
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        description: transaction.description,
        note: transaction.note,
        performed_by: transaction.performed_by || '',
        transaction_date: transaction.transaction_date,
      });
    } else {
      setForm({
        transaction_type: defaultType || 'income',
        amount: 0,
        description: '',
        note: '',
        performed_by: user?.id || '',
        transaction_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [open, transaction, defaultType, loadTeam, user]);

  const handleSave = async () => {
    if (!form.description.trim()) {
      toast('Zadejte popis', 'error');
      return;
    }
    if (form.amount <= 0) {
      toast('Zadejte částku', 'error');
      return;
    }
    if (!form.performed_by) {
      toast('Vyberte osobu', 'error');
      return;
    }
    setSaving(true);

    try {
      const performerName = team.find(t => t.id === form.performed_by)?.display_name || profile?.display_name || '';

      const payload = {
        transaction_type: form.transaction_type,
        amount: form.amount,
        description: form.description,
        note: form.note,
        source: 'manual' as const,
        performed_by: form.performed_by,
        performed_by_name: performerName,
        transaction_date: form.transaction_date,
      };

      if (transaction) {
        const { error } = await supabase
          .from('cash_transactions')
          .update(payload)
          .eq('id', transaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cash_transactions')
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }

      toast(transaction ? 'Záznam upraven' : 'Záznam vytvořen');
      onSaved();
      onClose();
    } catch {
      toast('Chyba při ukládání', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? 'Upravit pokladní doklad' : 'Nový pokladní doklad'}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.description.trim() || form.amount <= 0 || !form.performed_by}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : transaction ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, transaction_type: 'income' }))}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition border-2 ${
              form.transaction_type === 'income'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/[0.06] text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Příjem
          </button>
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, transaction_type: 'expense' }))}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition border-2 ${
              form.transaction_type === 'expense'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-white/10 bg-white/[0.06] text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Výdej
          </button>
        </div>

        <div>
          <label className={labelCls}>Popis *</label>
          <input
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            className={inputCls}
            placeholder="Např. Výběr na materiál, Platba od klienta..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Částka (Kč) *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.amount || ''}
              onChange={e => setForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              className={inputCls}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelCls}>Datum</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={e => setForm(prev => ({ ...prev, transaction_date: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Provedl(a) *</label>
          <select
            value={form.performed_by}
            onChange={e => setForm(prev => ({ ...prev, performed_by: e.target.value }))}
            className={inputCls}
          >
            <option value="">-- vyberte --</option>
            {team.map(m => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Poznámka {form.transaction_type === 'expense' && '*'}</label>
          <textarea
            rows={2}
            value={form.note}
            onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
            className={inputCls}
            placeholder={form.transaction_type === 'expense' ? 'Povinná poznámka k výdeji...' : 'Volitelná poznámka...'}
          />
        </div>
      </div>
    </Modal>
  );
}
