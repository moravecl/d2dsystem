import { useEffect, useState, useCallback } from 'react';
import {
  FileText, CheckCircle2, ChevronDown, ChevronUp, Percent,
  Loader2, Receipt,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import type { InvoiceItem } from '../../lib/invoiceUtils';
import { calcItemTotals } from '../../lib/invoiceUtils';
import { calcSectionTotal, type QuoteSection } from '../catalog/quoteHelpers';

interface QuoteRow {
  id: string;
  version: number;
  quote_number: string;
  status: string;
  total_selling: number;
  sections_data: QuoteSection[] | { sections: QuoteSection[] };
  created_at: string;
}


interface VicepraceItemRow {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SelectableSection {
  key: string;
  label: string;
  sourceType: 'quote' | 'viceprace';
  sourceId: string;
  sourceLabel: string;
  totalSelling: number;
  items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }[];
  selected: boolean;
  percentage: number;
}

export interface BillingSources {
  workIds: string[];
  materialIds: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultVatRate: number;
  onConfirm: (items: InvoiceItem[], note: string, sources?: BillingSources) => void;
}

interface UnbilledWorklog {
  id: string;
  activity: string;
  started_at: string;
  duration_minutes: number;
  hourly_rate: number;
  selected: boolean;
}

interface UnbilledMaterial {
  id: string;
  material_name: string;
  unit: string;
  actual_qty: number;
  unit_price: number;
  selected: boolean;
}

function parseSections(raw: QuoteSection[] | { sections: QuoteSection[] }): QuoteSection[] {
  if (Array.isArray(raw)) return raw;
  if (raw && 'sections' in raw && Array.isArray(raw.sections)) return raw.sections;
  return [];
}

export default function InvoiceFromProjectModal({ open, onClose, projectId, defaultVatRate, onConfirm }: Props) {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'quotes' | 'work'>('quotes');
  const [worklogs, setWorklogs] = useState<UnbilledWorklog[]>([]);
  const [materials, setMaterials] = useState<UnbilledMaterial[]>([]);
  const [sections, setSections] = useState<SelectableSection[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [globalPercentage, setGlobalPercentage] = useState(100);
  const [invoiceLabel, setInvoiceLabel] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);

    const [quotesRes, vicepraceRes] = await Promise.all([
      supabase
        .from('project_quotes')
        .select('id, version, quote_number, status, total_selling, sections_data, created_at')
        .eq('project_id', projectId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      supabase
        .from('viceprace')
        .select('id, title, status, amount, viceprace_items(id, name, unit, quantity, unit_price, total_price)')
        .eq('project_id', projectId)
        .in('status', ['approved', 'completed'])
        .order('created_at', { ascending: false }),
    ]);

    const selectableSections: SelectableSection[] = [];

    for (const quote of (quotesRes.data || []) as QuoteRow[]) {
      const quoteSections = parseSections(quote.sections_data);
      for (const section of quoteSections) {
        const sectionTotal = calcSectionTotal(section);
        if (sectionTotal <= 0 && section.items.length === 0) continue;

        selectableSections.push({
          key: `q_${quote.id}_${section.id}`,
          label: section.name,
          sourceType: 'quote',
          sourceId: quote.id,
          sourceLabel: quote.quote_number || `Nabídka v${quote.version}`,
          totalSelling: sectionTotal,
          items: section.items.map(item => {
            const basePrice = item.sellingPrice * item.quantity;
            const discountedPrice = item.discount ? basePrice * (1 - item.discount / 100) : basePrice;
            const unitPriceAfterDiscount = item.quantity > 0 ? discountedPrice / item.quantity : 0;
            return {
              description: item.name,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: unitPriceAfterDiscount,
            };
          }),
          selected: true,
          percentage: 100,
        });
      }
    }

    for (const vp of (vicepraceRes.data || []) as any[]) {
      const vpItems = (vp.viceprace_items || []) as VicepraceItemRow[];
      const vpTotal = vpItems.reduce((s: number, it: VicepraceItemRow) => s + (it.quantity * it.unit_price), 0);

      selectableSections.push({
        key: `vp_${vp.id}`,
        label: `Vícepráce: ${vp.title}`,
        sourceType: 'viceprace',
        sourceId: vp.id,
        sourceLabel: vp.title,
        totalSelling: vpTotal > 0 ? vpTotal : vp.amount,
        items: vpItems.length > 0
          ? vpItems.map((it: VicepraceItemRow) => ({
              description: it.name,
              quantity: it.quantity,
              unit: it.unit,
              unit_price: it.unit_price,
            }))
          : [{
              description: vp.title,
              quantity: 1,
              unit: 'kpl',
              unit_price: vp.amount,
            }],
        selected: true,
        percentage: 100,
      });
    }

    setSections(selectableSections);
    // nevyuctovana prace a material z realizace (nejnovejsi job projektu)
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1);
    const jobId = (jobRows ?? [])[0]?.id as string | undefined;
    if (jobId) {
      const [workRes, matRes] = await Promise.all([
        supabase.from('job_worklogs')
          .select('id, activity, started_at, duration_minutes, hourly_rate')
          .eq('job_id', jobId).is('billed_invoice_id', null).eq('is_running', false)
          .order('started_at'),
        supabase.from('job_material_entries')
          .select('id, material_name, unit, actual_qty, unit_price')
          .eq('job_id', jobId).is('billed_invoice_id', null).gt('actual_qty', 0)
          .order('created_at'),
      ]);
      setWorklogs(((workRes.data ?? []) as Omit<UnbilledWorklog, 'selected'>[])
        .map((w) => ({ ...w, selected: true })));
      setMaterials(((matRes.data ?? []) as Omit<UnbilledMaterial, 'selected'>[])
        .map((m) => ({ ...m, selected: true })));
    } else {
      setWorklogs([]);
      setMaterials([]);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open) {
      loadData();
      setGlobalPercentage(100);
      setInvoiceLabel('');
      setExpandedKeys(new Set());
    }
  }, [open, loadData]);

  const toggleSection = (key: string) => {
    setSections(prev => prev.map(s => s.key === key ? { ...s, selected: !s.selected } : s));
  };

  const updatePercentage = (key: string, pct: number) => {
    const clamped = Math.max(0, Math.min(200, pct));
    setSections(prev => prev.map(s => s.key === key ? { ...s, percentage: clamped } : s));
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyGlobalPercentage = () => {
    setSections(prev => prev.map(s => ({ ...s, percentage: globalPercentage })));
  };

  const selectAll = () => setSections(prev => prev.map(s => ({ ...s, selected: true })));
  const deselectAll = () => setSections(prev => prev.map(s => ({ ...s, selected: false })));

  const selectedSections = sections.filter(s => s.selected);
  const totalBeforePercentage = selectedSections.reduce((s, sec) => s + sec.totalSelling, 0);
  const totalAfterPercentage = selectedSections.reduce(
    (s, sec) => s + sec.totalSelling * (sec.percentage / 100),
    0
  );

  const updateWorklogRate = async (id: string, rate: number) => {
    setWorklogs((prev) => prev.map((w) => (w.id === id ? { ...w, hourly_rate: rate } : w)));
    await supabase.from('job_worklogs').update({ hourly_rate: rate }).eq('id', id);
  };

  const toggleWorklog = (id: string) =>
    setWorklogs((prev) => prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w)));
  const toggleMaterial = (id: string) =>
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)));

  const workTotal = worklogs.filter((w) => w.selected)
    .reduce((sum, w) => sum + (w.duration_minutes / 60) * w.hourly_rate, 0);
  const materialTotal = materials.filter((m) => m.selected)
    .reduce((sum, m) => sum + m.actual_qty * m.unit_price, 0);

  const handleConfirmWork = () => {
    const selWork = worklogs.filter((w) => w.selected);
    const selMat = materials.filter((m) => m.selected);
    if (selWork.length === 0 && selMat.length === 0) return;

    const invoiceItems: InvoiceItem[] = [];
    for (const w of selWork) {
      const hours = Math.round((w.duration_minutes / 60) * 100) / 100;
      invoiceItems.push(calcItemTotals({
        description: `Práce: ${w.activity} (${new Date(w.started_at).toLocaleDateString('cs-CZ')})`,
        quantity: hours,
        unit: 'hod',
        unit_price: w.hourly_rate,
        vat_rate: defaultVatRate,
        total_price: 0,
        vat_amount: 0,
        sort_order: invoiceItems.length,
        section_name: 'Práce',
      }));
    }
    for (const m of selMat) {
      invoiceItems.push(calcItemTotals({
        description: m.material_name,
        quantity: m.actual_qty,
        unit: m.unit,
        unit_price: m.unit_price,
        vat_rate: defaultVatRate,
        total_price: 0,
        vat_amount: 0,
        sort_order: invoiceItems.length,
        section_name: 'Materiál',
      }));
    }
    const note = `Vyúčtování práce a materiálu k ${new Date().toLocaleDateString('cs-CZ')}`;
    onConfirm(invoiceItems, note, {
      workIds: selWork.map((w) => w.id),
      materialIds: selMat.map((m) => m.id),
    });
  };

  const handleConfirm = () => {
    const invoiceItems: InvoiceItem[] = [];
    let sortOrder = 0;

    for (const sec of selectedSections) {
      const pctFactor = sec.percentage / 100;

      if (sec.percentage === 100) {
        for (const item of sec.items) {
          invoiceItems.push(calcItemTotals({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: Math.round(item.unit_price * 100) / 100,
            total_price: 0,
            vat_rate: defaultVatRate,
            vat_amount: 0,
            sort_order: sortOrder++,
            section_name: sec.label,
          }));
        }
      } else {
        const label = sec.percentage < 100
          ? `${sec.label} - záloha ${sec.percentage}%`
          : `${sec.label} - ${sec.percentage}%`;
        const totalForSection = sec.totalSelling * pctFactor;

        invoiceItems.push(calcItemTotals({
          description: label,
          quantity: 1,
          unit: 'kpl',
          unit_price: Math.round(totalForSection * 100) / 100,
          total_price: 0,
          vat_rate: defaultVatRate,
          vat_amount: 0,
          sort_order: sortOrder++,
          section_name: sec.label,
        }));
      }
    }

    const noteLines: string[] = [];
    if (invoiceLabel.trim()) noteLines.push(invoiceLabel.trim());
    const quoteNums = [...new Set(selectedSections.filter(s => s.sourceType === 'quote').map(s => s.sourceLabel))];
    if (quoteNums.length > 0) noteLines.push(`Dle nabídky: ${quoteNums.join(', ')}`);
    const vpNames = selectedSections.filter(s => s.sourceType === 'viceprace').map(s => s.sourceLabel);
    if (vpNames.length > 0) noteLines.push(`Vícepráce: ${vpNames.join(', ')}`);

    onConfirm(invoiceItems, noteLines.join('\n'));
    onClose();
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <Modal open={open} onClose={onClose} title="Fakturace z projektu" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : (
      <div className="space-y-4">
        <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
          <button
            onClick={() => setTab('quotes')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'quotes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Nabídky a vícepráce
          </button>
          <button
            onClick={() => setTab('work')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'work' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Práce a materiál
            {(worklogs.length + materials.length) > 0 && (
              <span className="ml-1.5 text-[10px] opacity-80">({worklogs.length + materials.length})</span>
            )}
          </button>
        </div>

      {tab === 'work' ? (
        (worklogs.length === 0 && materials.length === 0) ? (
          <div className="text-center py-12">
            <Receipt className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-400">Nic nevyúčtovaného</div>
            <div className="text-xs text-slate-500 mt-1">Veškerá zapsaná práce i materiál už byly vyfakturovány.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {worklogs.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Práce ({worklogs.length})</div>
                <div className="max-h-48 overflow-y-auto divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                  {worklogs.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 px-3 py-2">
                      <input type="checkbox" checked={w.selected} onChange={() => toggleWorklog(w.id)} className="accent-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">{w.activity}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(w.started_at).toLocaleDateString('cs-CZ')} · {(w.duration_minutes / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} hod
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          value={w.hourly_rate}
                          onChange={(e) => updateWorklogRate(w.id, Number(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-xs text-right"
                          title="Hodinová sazba"
                        />
                        <span className="text-[10px] text-slate-500">Kč/h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {materials.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Materiál ({materials.length})</div>
                <div className="max-h-48 overflow-y-auto divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                  {materials.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                      <input type="checkbox" checked={m.selected} onChange={() => toggleMaterial(m.id)} className="accent-blue-500" />
                      <div className="flex-1 min-w-0 text-sm text-slate-200 truncate">{m.material_name}</div>
                      <div className="text-xs text-slate-400 shrink-0">
                        {m.actual_qty.toLocaleString('cs-CZ')} {m.unit} × {fmt(m.unit_price)} Kč
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3">
              <div className="text-xs text-slate-400">
                Práce {fmt(workTotal)} Kč · Materiál {fmt(materialTotal)} Kč
              </div>
              <div className="text-sm font-extrabold text-white">Celkem {fmt(workTotal + materialTotal)} Kč</div>
            </div>
            <button
              onClick={handleConfirmWork}
              disabled={workTotal + materialTotal <= 0}
              className="w-full px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              Pokračovat na fakturu
            </button>
          </div>
        )
      ) : sections.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-500">Žiadne schválené nabídky ani vícepráce</div>
          <div className="text-xs text-slate-400 mt-1">Nejprve schvalte nabídku nebo vícepráce</div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-2 flex-1">
              <button onClick={selectAll} className="text-[10px] font-bold text-blue-400 hover:underline">Vybrat vše</button>
              <span className="text-slate-300">|</span>
              <button onClick={deselectAll} className="text-[10px] font-bold text-slate-500 hover:underline">Zrušit vybrané</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Procento</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={globalPercentage}
                  onChange={e => setGlobalPercentage(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded-lg border border-white/10 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-xs text-slate-500">%</span>
                <button
                  onClick={applyGlobalPercentage}
                  className="ml-1 px-2 py-1 text-[10px] font-bold bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition"
                >
                  Aplikovat
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {sections.map(sec => {
              const isExpanded = expandedKeys.has(sec.key);
              const effectiveTotal = sec.totalSelling * (sec.percentage / 100);

              return (
                <div
                  key={sec.key}
                  className={`rounded-xl border transition ${
                    sec.selected
                      ? 'border-blue-200 bg-blue-500/10'
                      : 'border-white/10 bg-white/[0.06] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => toggleSection(sec.key)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        sec.selected
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white/[0.06] border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {sec.selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>

                    <button onClick={() => toggleExpand(sec.key)} className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{sec.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          sec.sourceType === 'quote'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {sec.sourceType === 'quote' ? 'Nabídka' : 'Vícepráce'}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        }
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {sec.sourceLabel} | {sec.items.length} položek
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={sec.percentage}
                          onChange={e => updatePercentage(sec.key, parseInt(e.target.value) || 0)}
                          className="w-14 px-2 py-1 rounded-lg border border-white/10 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          disabled={!sec.selected}
                        />
                        <Percent className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="text-right min-w-[80px]">
                        {sec.percentage !== 100 && (
                          <div className="text-[10px] text-slate-400 line-through">{fmt(sec.totalSelling)} Kč</div>
                        )}
                        <div className="text-sm font-bold text-white">{fmt(effectiveTotal)} Kč</div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
                      <div className="space-y-1">
                        {sec.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-400 py-1 px-2 rounded-lg hover:bg-white/[0.06]">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="flex-1 truncate">{item.description}</span>
                            <span className="text-slate-400">{item.quantity} {item.unit}</span>
                            <span className="font-semibold tabular-nums">{fmt(item.unit_price * item.quantity)} Kč</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Popis na faktuře (volitelně)
            </label>
            <input
              value={invoiceLabel}
              onChange={e => setInvoiceLabel(e.target.value)}
              placeholder="např. 1. záloha, konečná faktura..."
              className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div className="bg-white/[0.04] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Vybraných sekcí</span>
              <span className="font-bold text-white">{selectedSections.length} z {sections.length}</span>
            </div>
            {totalBeforePercentage !== totalAfterPercentage && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Základ</span>
                <span className="text-slate-400 line-through">{fmt(totalBeforePercentage)} Kč</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-extrabold">
              <span className="text-slate-300">Celkem k fakturaci</span>
              <span className="text-blue-400">{fmt(totalAfterPercentage)} Kč</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-400 bg-white/[0.06] rounded-xl hover:bg-white/[0.08] transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedSections.length === 0}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pokračovat na fakturu
            </button>
          </div>
        </div>
      )}
      </div>
      )}
    </Modal>
  );
}
