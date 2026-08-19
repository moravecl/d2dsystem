import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { INVOICE_TYPE_LABELS } from '../../lib/invoiceTypes';

interface InvSettings {
  id: string;
  number_prefix: string;
  number_format: string;
  next_number: number;
  default_due_days: number;
  default_vat_rate: number;
  default_payment_method: string;
  footer_text: string;
  reset_yearly: boolean;
  current_year: number;
  prefix_standard: string;
  prefix_deposit_invoice: string;
  prefix_tax_document: string;
  prefix_credit_note: string;
  prefix_settlement_invoice: string;
  prefix_cash_receipt: string;
  next_number_deposit_invoice: number;
  next_number_tax_document: number;
  next_number_credit_note: number;
  next_number_settlement_invoice: number;
  next_number_cash_receipt: number;
}

const TYPE_ROWS: { key: keyof InvSettings; nextKey: keyof InvSettings; label: string; desc: string }[] = [
  { key: 'prefix_standard', nextKey: 'next_number', label: 'Faktura', desc: 'Běžná faktura' },
  { key: 'prefix_deposit_invoice', nextKey: 'next_number_deposit_invoice', label: 'Zálohová faktura', desc: 'Záloha před plněním' },
  { key: 'prefix_tax_document', nextKey: 'next_number_tax_document', label: 'Daňový doklad', desc: 'Daňový doklad k přijaté platbě' },
  { key: 'prefix_credit_note', nextKey: 'next_number_credit_note', label: 'Dobropis', desc: 'Opravný daňový doklad' },
  { key: 'prefix_settlement_invoice', nextKey: 'next_number_settlement_invoice', label: 'Vyúčtovací faktura', desc: 'Vyúčtování se zálohou' },
  { key: 'prefix_cash_receipt', nextKey: 'next_number_cash_receipt', label: 'Pokladní doklad', desc: 'Příjmový pokladní doklad' },
];

export default function InvoiceSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<InvSettings>({
    id: '',
    number_prefix: 'FV',
    number_format: '{PREFIX}-{YYYY}-{NNN}',
    next_number: 1,
    default_due_days: 14,
    default_vat_rate: 21,
    default_payment_method: 'bank_transfer',
    footer_text: '',
    reset_yearly: true,
    current_year: new Date().getFullYear(),
    prefix_standard: 'FV',
    prefix_deposit_invoice: 'ZF',
    prefix_tax_document: 'DD',
    prefix_credit_note: 'D',
    prefix_settlement_invoice: 'VF',
    prefix_cash_receipt: 'PPD',
    next_number_deposit_invoice: 1,
    next_number_tax_document: 1,
    next_number_credit_note: 1,
    next_number_settlement_invoice: 1,
    next_number_cash_receipt: 1,
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('invoice_settings').select('*').limit(1).maybeSingle();
    if (data) setForm(prev => ({ ...prev, ...(data as InvSettings) }));
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      number_prefix: form.prefix_standard || form.number_prefix,
      number_format: form.number_format,
      next_number: form.next_number,
      default_due_days: form.default_due_days,
      default_vat_rate: form.default_vat_rate,
      default_payment_method: form.default_payment_method,
      footer_text: form.footer_text,
      reset_yearly: form.reset_yearly,
      current_year: form.current_year,
      prefix_standard: form.prefix_standard,
      prefix_deposit_invoice: form.prefix_deposit_invoice,
      prefix_tax_document: form.prefix_tax_document,
      prefix_credit_note: form.prefix_credit_note,
      prefix_settlement_invoice: form.prefix_settlement_invoice,
      prefix_cash_receipt: form.prefix_cash_receipt,
      next_number_deposit_invoice: form.next_number_deposit_invoice,
      next_number_tax_document: form.next_number_tax_document,
      next_number_credit_note: form.next_number_credit_note,
      next_number_settlement_invoice: form.next_number_settlement_invoice,
      next_number_cash_receipt: form.next_number_cash_receipt,
      updated_at: new Date().toISOString(),
    };

    if (form.id) {
      const { error } = await supabase.from('invoice_settings').update(payload).eq('id', form.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('invoice_settings').insert(payload).select('id').single();
      if (error || !data) { toast('Chyba', 'error'); setSaving(false); return; }
      setForm(prev => ({ ...prev, id: data.id }));
    }
    setSaving(false);
    toast('Nastavení fakturace uloženo');
  };

  const previewNumber = (prefix: string, nextNum: number) => {
    const num = String(nextNum).padStart(3, '0');
    return form.number_format
      .replace('{PREFIX}', prefix)
      .replace('{YYYY}', String(new Date().getFullYear()))
      .replace('{NNN}', num)
      .replace('{NN}', String(nextNum).padStart(2, '0'));
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-64 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />
      </div>
    );
  }

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition';
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6 text-slate-300" />
          <h1 className="text-2xl font-extrabold text-white">Nastavení fakturace</h1>
        </div>
        <p className="text-sm text-slate-400">Číslování dokladů, výchozí hodnoty a patička</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Číslování dokladů dle typu</h2>
          </div>
          <p className="text-xs text-slate-500 -mt-2">Každý typ dokladu má vlastní prefix a čítač. Formát se sdílí pro všechny typy.</p>

          <div className="mb-4">
            <label className={labelCls}>Formát čísla</label>
            <input
              value={form.number_format}
              onChange={e => setForm(p => ({ ...p, number_format: e.target.value }))}
              className={inputCls}
            />
            <p className="text-[10px] text-slate-500 mt-1">Proměnné: {'{PREFIX}'}, {'{YYYY}'}, {'{NNN}'}, {'{NN}'}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.08]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Typ dokladu</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-32">Prefix</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">Další číslo</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Náhled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {TYPE_ROWS.map(row => {
                  const prefixVal = form[row.key] as string;
                  const nextVal = form[row.nextKey] as number;
                  return (
                    <tr key={row.key} className="hover:bg-white/[0.03] transition">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-white">{row.label}</div>
                        <div className="text-[10px] text-slate-500">{row.desc}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={prefixVal}
                          onChange={e => setForm(p => ({ ...p, [row.key]: e.target.value }))}
                          className="w-full px-2.5 py-1.5 text-sm border border-white/10 rounded-lg bg-white/[0.06] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                          placeholder="FV"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          value={nextVal}
                          onChange={e => setForm(p => ({ ...p, [row.nextKey]: parseInt(e.target.value) || 1 }))}
                          className="w-full px-2.5 py-1.5 text-sm border border-white/10 rounded-lg bg-white/[0.06] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded-lg">
                          {previewNumber(prefixVal, nextVal)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.reset_yearly}
              onChange={e => setForm(p => ({ ...p, reset_yearly: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 text-blue-400 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-300">Resetovat číslování každý rok</span>
              <p className="text-xs text-slate-500">Na začátku nového roku se všechna čísla vrátí na 1</p>
            </div>
          </label>
        </div>

        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Výchozí hodnoty</h2>

          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Splatnost (dny)</label>
              <input
                type="number"
                min={1}
                value={form.default_due_days}
                onChange={e => setForm(p => ({ ...p, default_due_days: parseInt(e.target.value) || 14 }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>DPH sazba (%)</label>
              <select
                value={form.default_vat_rate}
                onChange={e => setForm(p => ({ ...p, default_vat_rate: parseFloat(e.target.value) }))}
                className={inputCls}
              >
                <option value={0}>0%</option>
                <option value={12}>12%</option>
                <option value={21}>21%</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Způsob platby</label>
              <select
                value={form.default_payment_method}
                onChange={e => setForm(p => ({ ...p, default_payment_method: e.target.value }))}
                className={inputCls}
              >
                <option value="bank_transfer">Bankovní převod</option>
                <option value="cash">Hotovost</option>
                <option value="card">Kartou</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Patička faktury</h2>
          <div>
            <label className={labelCls}>Text patičky</label>
            <textarea
              rows={4}
              value={form.footer_text}
              onChange={e => setForm(p => ({ ...p, footer_text: e.target.value }))}
              className={inputCls}
              placeholder="Děkujeme za Vaši důvěru. Faktura je splatná do data splatnosti uvedeného výše."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit nastavení
          </button>
        </div>
      </div>
    </div>
  );
}
