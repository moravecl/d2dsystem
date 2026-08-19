import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

export interface FinancialEntry {
  id: string;
  project_id: string | null;
  entry_type: 'income' | 'expense';
  amount: number;
  description: string;
  entry_date: string;
  category: string;
  note: string;
  created_by: string;
  created_at: string;
}

interface ProjectRef {
  id: string;
  project_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entry: FinancialEntry | null;
  defaultProjectId?: string;
  defaultType?: 'income' | 'expense';
  onSaved: () => void;
}

const INCOME_CATEGORIES = [
  'Platba od klienta',
  'Záloha',
  'Doplatek',
  'Bonus',
  'Jiný výnos',
];

const EXPENSE_CATEGORIES = [
  'Materiál',
  'Subdodávka',
  'Doprava',
  'Nástroje',
  'Služby',
  'Poplatky',
  'Jiný náklad',
];

export default function ManualEntryModal({ open, onClose, entry, defaultProjectId, defaultType, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entry_type: 'income' as 'income' | 'expense',
    amount: 0,
    description: '',
    entry_date: new Date().toISOString().split('T')[0],
    category: '',
    note: '',
    project_id: '',
  });

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_name')
      .neq('status', 'cancelled')
      .order('project_name');
    setProjects((data || []) as ProjectRef[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadProjects();
    if (entry) {
      setForm({
        entry_type: entry.entry_type,
        amount: entry.amount,
        description: entry.description,
        entry_date: entry.entry_date,
        category: entry.category,
        note: entry.note,
        project_id: entry.project_id || '',
      });
    } else {
      setForm({
        entry_type: defaultType || 'income',
        amount: 0,
        description: '',
        entry_date: new Date().toISOString().split('T')[0],
        category: '',
        note: '',
        project_id: defaultProjectId || '',
      });
    }
  }, [open, entry, defaultProjectId, defaultType, loadProjects]);

  const handleSave = async () => {
    if (!form.description.trim()) {
      toast('Zadejte popis', 'error');
      return;
    }
    if (form.amount <= 0) {
      toast('Zadejte částku', 'error');
      return;
    }
    setSaving(true);

    try {
      const payload = {
        entry_type: form.entry_type,
        amount: form.amount,
        description: form.description,
        entry_date: form.entry_date,
        category: form.category,
        note: form.note,
        project_id: form.project_id || null,
      };

      if (entry) {
        const { error } = await supabase
          .from('financial_entries')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('financial_entries')
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }

      toast(entry ? 'Záznam upraven' : 'Záznam vytvořen');
      onSaved();
      onClose();
    } catch {
      toast('Chyba při ukládání', 'error');
    } finally {
      setSaving(false);
    }
  };

  const categories = form.entry_type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? 'Upravit záznam' : 'Nový finanční záznam'}
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
            disabled={saving || !form.description.trim() || form.amount <= 0}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : entry ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, entry_type: 'income', category: '' }))}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition border-2 ${
              form.entry_type === 'income'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/[0.06] text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Výnos
          </button>
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, entry_type: 'expense', category: '' }))}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition border-2 ${
              form.entry_type === 'expense'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-white/10 bg-white/[0.06] text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Náklad
          </button>
        </div>

        <div>
          <label className={labelCls}>Popis *</label>
          <input
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            className={inputCls}
            placeholder="Např. Platba za materiál..."
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
              value={form.entry_date}
              onChange={e => setForm(prev => ({ ...prev, entry_date: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Kategorie</label>
          <select
            value={form.category}
            onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
            className={inputCls}
          >
            <option value="">-- bez kategorie --</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Projekt</label>
          <select
            value={form.project_id}
            onChange={e => setForm(prev => ({ ...prev, project_id: e.target.value }))}
            className={inputCls}
          >
            <option value="">-- bez projektu --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Poznámka</label>
          <textarea
            rows={2}
            value={form.note}
            onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
            className={inputCls}
            placeholder="Volitelná poznámka..."
          />
        </div>
      </div>
    </Modal>
  );
}
