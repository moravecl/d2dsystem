import { useState, useEffect } from 'react';
import { X, RepeatIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

export interface FixedCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  interval_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  interval_day: number | null;
  start_date: string;
  end_date: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: FixedCost | null;
}

const CATEGORIES = [
  'Nájem', 'Mzdy', 'Úvěry a leasing', 'Pojištění', 'Energie a utilities',
  'Telefon a internet', 'Software a licence', 'Marketing', 'Účetnictví a právní služby',
  'Doprava', 'Ostatní',
];

const INTERVAL_OPTIONS = [
  { value: 'weekly', label: 'Týdně' },
  { value: 'monthly', label: 'Měsíčně' },
  { value: 'quarterly', label: 'Čtvrtletně' },
  { value: 'yearly', label: 'Ročně' },
  { value: 'one_time', label: 'Jednorázově' },
];

const empty = (): Omit<FixedCost, 'id' | 'created_at'> => ({
  name: '',
  category: 'Ostatní',
  amount: 0,
  currency: 'CZK',
  interval_type: 'monthly',
  interval_day: 1,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  note: null,
  is_active: true,
});

export default function FixedCostsModal({ open, onClose, onSaved, editing }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        category: editing.category,
        amount: editing.amount,
        currency: editing.currency,
        interval_type: editing.interval_type,
        interval_day: editing.interval_day,
        start_date: editing.start_date,
        end_date: editing.end_date,
        note: editing.note,
        is_active: editing.is_active,
      });
      setHasEndDate(!!editing.end_date);
    } else {
      setForm(empty());
      setHasEndDate(false);
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Zadejte název nákladu', 'error'); return; }
    if (form.amount <= 0) { toast('Částka musí být větší než 0', 'error'); return; }
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      interval_day: form.interval_type === 'one_time' ? null : (form.interval_day || null),
      end_date: hasEndDate ? form.end_date : null,
    };
    const { error } = editing
      ? await supabase.from('fixed_costs').update(payload).eq('id', editing.id)
      : await supabase.from('fixed_costs').insert(payload);
    setSaving(false);
    if (error) { toast('Chyba při ukládání', 'error'); return; }
    toast(editing ? 'Náklad upraven' : 'Náklad přidán');
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0f172a] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <RepeatIcon className="w-4 h-4 text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-white">
              {editing ? 'Upravit stálý náklad' : 'Nový stálý náklad'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="např. Nájem kanceláře"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-[#0f172a]">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Opakování</label>
              <select
                value={form.interval_type}
                onChange={e => set('interval_type', e.target.value as typeof form.interval_type)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition"
              >
                {INTERVAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-[#0f172a]">{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Částka (CZK) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ''}
                onChange={e => set('amount', Number(e.target.value))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition"
              />
            </div>
            {form.interval_type !== 'one_time' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Den v měsíci</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.interval_day ?? ''}
                  onChange={e => set('interval_day', e.target.value ? Number(e.target.value) : null)}
                  placeholder="1–31"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Platnost od</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                <span>Platnost do</span>
              </label>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setHasEndDate(v => !v)}
                  className={`flex-shrink-0 w-9 h-9 rounded-xl border transition flex items-center justify-center text-xs font-bold ${
                    hasEndDate
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-500'
                  }`}
                  title={hasEndDate ? 'Nastaveno' : 'Nekonečně'}
                >
                  {hasEndDate ? '✓' : '∞'}
                </button>
                {hasEndDate ? (
                  <input
                    type="date"
                    value={form.end_date || ''}
                    onChange={e => set('end_date', e.target.value || null)}
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition"
                  />
                ) : (
                  <span className="text-sm text-slate-500 italic">Nekonečně</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <textarea
              value={form.note || ''}
              onChange={e => set('note', e.target.value || null)}
              rows={2}
              placeholder="Volitelná poznámka..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-emerald-500' : 'bg-white/[0.12]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-slate-300">Aktivní</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition rounded-xl hover:bg-white/[0.06]"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
          >
            {saving ? 'Ukládám...' : (editing ? 'Uložit změny' : 'Přidat náklad')}
          </button>
        </div>
      </div>
    </div>
  );
}
