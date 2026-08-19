import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { SalesInvoice } from '../../types/cashflow';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  invoice?: SalesInvoice | null;
}

interface ProjectRef { id: string; project_name: string; }
interface AllocationRow { project_id: string; amount: string; }

const STATUS_OPTS = [
  { value: 'draft', label: 'Koncept' },
  { value: 'sent', label: 'Odeslaná' },
  { value: 'paid', label: 'Zaplacená' },
  { value: 'canceled', label: 'Zrušená' },
];

export default function SalesInvoiceModal({ open, onClose, onSaved, invoice }: Props) {
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    invoice_number: '',
    customer_name: '',
    project_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    paid_date: '',
    amount_gross: '',
    amount_net: '',
    vat_amount: '',
    status: 'draft',
    note: '',
  });

  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  useEffect(() => {
    supabase.from('projects').select('id, project_name').order('project_name').then(({ data }) => {
      setProjects((data || []) as ProjectRef[]);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (invoice) {
      setForm({
        invoice_number: invoice.invoice_number || '',
        customer_name: invoice.customer_name || '',
        project_id: invoice.project_id || '',
        issue_date: invoice.issue_date || new Date().toISOString().slice(0, 10),
        due_date: invoice.due_date || '',
        paid_date: invoice.paid_date || '',
        amount_gross: String(invoice.amount_gross || 0),
        amount_net: String(invoice.amount_net || 0),
        vat_amount: String(invoice.vat_amount || 0),
        status: invoice.status || 'draft',
        note: invoice.note || '',
      });
      supabase.from('invoice_project_allocations').select('*').eq('sales_invoice_id', invoice.id).then(({ data }) => {
        setAllocations((data || []).map((a: { project_id: string; allocated_amount_gross: number }) => ({
          project_id: a.project_id,
          amount: String(a.allocated_amount_gross),
        })));
      });
    } else {
      setForm({
        invoice_number: '',
        customer_name: '',
        project_id: '',
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
        paid_date: '',
        amount_gross: '',
        amount_net: '',
        vat_amount: '',
        status: 'draft',
        note: '',
      });
      setAllocations([]);
    }
  }, [open, invoice]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const calcVat = (net: string, gross: string) => {
    const n = parseFloat(net) || 0;
    const g = parseFloat(gross) || 0;
    return String(Math.round((g - n) * 100) / 100);
  };

  const handleNetChange = (v: string) => {
    set('amount_net', v);
    if (form.amount_gross) set('vat_amount', calcVat(v, form.amount_gross));
  };
  const handleGrossChange = (v: string) => {
    set('amount_gross', v);
    if (form.amount_net) set('vat_amount', calcVat(form.amount_net, v));
  };

  const addAllocation = () => setAllocations(a => [...a, { project_id: '', amount: '' }]);
  const removeAllocation = (idx: number) => setAllocations(a => a.filter((_, i) => i !== idx));
  const updateAllocation = (idx: number, k: keyof AllocationRow, v: string) =>
    setAllocations(a => a.map((row, i) => i === idx ? { ...row, [k]: v } : row));

  const totalAllocated = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const amountGross = parseFloat(form.amount_gross) || 0;
  const unallocated = amountGross - totalAllocated;

  const handleSave = async () => {
    if (!form.customer_name || !form.due_date || !form.amount_gross) {
      toast('Vyplňte zákazníka, datum splatnosti a částku', 'error');
      return;
    }
    if (!organization?.id) {
      toast('Chyba: organizace nenalezena', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      org_id: organization.id,
      invoice_number: form.invoice_number,
      customer_name: form.customer_name,
      project_id: form.project_id || null,
      issue_date: form.issue_date,
      due_date: form.due_date,
      paid_date: form.paid_date || null,
      amount_gross: parseFloat(form.amount_gross) || 0,
      amount_net: parseFloat(form.amount_net) || 0,
      vat_amount: parseFloat(form.vat_amount) || 0,
      status: form.status,
      note: form.note || null,
    };

    let invoiceId = invoice?.id;

    if (invoice) {
      const { error } = await supabase.from('sales_invoices').update(payload).eq('id', invoice.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('sales_invoices').insert(payload).select('id').single();
      if (error || !data) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
      invoiceId = data.id;
    }

    if (invoiceId) {
      await supabase.from('invoice_project_allocations').delete().eq('sales_invoice_id', invoiceId);
      const validAllocs = allocations.filter(a => a.project_id && parseFloat(a.amount) > 0);
      if (validAllocs.length > 0) {
        await supabase.from('invoice_project_allocations').insert(
          validAllocs.map(a => ({
            org_id: organization.id,
            sales_invoice_id: invoiceId,
            project_id: a.project_id,
            allocated_amount_gross: parseFloat(a.amount),
          }))
        );
      }
    }

    toast(invoice ? 'Faktura upravena' : 'Faktura přidána');
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <h2 className="text-lg font-bold text-white">{invoice ? 'Upravit fakturu' : 'Nová vystavená faktura'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Číslo faktury</label>
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)}
                placeholder="FV-2024-001"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value} className="bg-[#0f172a]">{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Zákazník *</label>
            <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
              placeholder="Jméno zákazníka / firmy"
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="" className="bg-[#0f172a]">-- Bez projektu --</option>
              {projects.map(p => <option key={p.id} value={p.id} className="bg-[#0f172a]">{p.project_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum vystavení</label>
              <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum splatnosti *</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum zaplacení</label>
              <input type="date" value={form.paid_date} onChange={e => set('paid_date', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Základ bez DPH (Kč)</label>
              <input type="number" value={form.amount_net} onChange={e => handleNetChange(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">DPH (Kč)</label>
              <input type="number" value={form.vat_amount} onChange={e => set('vat_amount', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Celkem s DPH (Kč) *</label>
              <input type="number" value={form.amount_gross} onChange={e => handleGrossChange(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>

          <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Alokace na projekty</span>
              </div>
              <button onClick={addAllocation}
                className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition">
                <Plus className="w-3.5 h-3.5" /> Přidat projekt
              </button>
            </div>

            {allocations.length === 0 ? (
              <p className="text-xs text-slate-500">Faktura není alokována na žádný projekt.</p>
            ) : (
              <div className="space-y-2">
                {allocations.map((alloc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={alloc.project_id} onChange={e => updateAllocation(idx, 'project_id', e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                      <option value="" className="bg-[#0f172a]">-- Vyberte projekt --</option>
                      {projects.map(p => <option key={p.id} value={p.id} className="bg-[#0f172a]">{p.project_name}</option>)}
                    </select>
                    <input type="number" value={alloc.amount} onChange={e => updateAllocation(idx, 'amount', e.target.value)}
                      placeholder="Kč"
                      className="w-28 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    <button onClick={() => removeAllocation(idx)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {amountGross > 0 && (
              <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
                <span>Alokováno: <span className="text-blue-400 font-semibold">{totalAllocated.toLocaleString('cs-CZ')} Kč</span></span>
                <span>Nealokováno: <span className={`font-semibold ${unallocated < 0 ? 'text-red-400' : 'text-slate-300'}`}>{unallocated.toLocaleString('cs-CZ')} Kč</span></span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] transition">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}
