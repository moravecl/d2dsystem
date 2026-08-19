import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Zap, Droplets, Flame, Wind, Lightbulb, ClipboardList, Check, ChevronRight, FileText, CheckCircle2, Eye, RotateCcw, Package, X } from 'lucide-react';

interface QuoteItem {
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  productId?: string;
  trade: string;
  sectionName: string;
  quoteId: string;
}

interface ProjectQuote {
  id: string;
  quote_number: string;
  version: number;
  total_selling: number;
  status: string;
}

interface BulkRow {
  name: string;
  unit: string;
  plannedQty: number;
  sellingPrice: number;
  productId?: string;
  trade: string;
  sectionName: string;
  quoteId: string;
  qty: string;
  note: string;
}

const TRADE_META: Record<string, { label: string; accent: string; bg: string; Icon: typeof Zap }> = {
  electric: { label: 'Elektro', accent: '#eab308', bg: '#1a1500', Icon: Zap },
  water: { label: 'Voda', accent: '#3b82f6', bg: '#0d1a2d', Icon: Droplets },
  heating: { label: 'Topení', accent: '#ef4444', bg: '#1a0d0d', Icon: Flame },
  recuperation: { label: 'Rekuperace', accent: '#22c55e', bg: '#0d1a10', Icon: Wind },
  lighting: { label: 'Osvětlení', accent: '#f59e0b', bg: '#1a1400', Icon: Lightbulb },
};


const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 },
  presented: { label: 'Předloženo', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Eye },
  returned: { label: 'Vráceno', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: RotateCcw },
  draft: { label: 'Rozpracovaná', cls: 'text-slate-400 bg-white/[0.06] border-white/[0.08]', Icon: FileText },
};

interface BulkMaterialModalProps {
  open: boolean;
  onClose: () => void;
  plannedItems: QuoteItem[];
  saving: boolean;
  onSave: (rows: { name: string; unit: string; plannedQty: number; actualQty: number; unitPrice: number; productId: string | null; note: string; sourceQuoteId?: string | null; trade?: string | null }[]) => Promise<void>;
  allQuotes: ProjectQuote[];
}

export default function BulkMaterialModal({ open, onClose, plannedItems, saving, onSave, allQuotes }: BulkMaterialModalProps) {
  const multipleQuotes = allQuotes.length > 1;
  type Step = 'quote' | 'trades' | 'items';

  const [step, setStep] = useState<Step>(multipleQuotes ? 'quote' : 'trades');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<BulkRow[]>([]);

  useEffect(() => {
    if (open) {
      setStep(multipleQuotes ? 'quote' : 'trades');
      setSelectedQuoteId(null);
      setSelectedTrades(new Set());
      setRows([]);
    }
  }, [open, multipleQuotes]);

  const filteredPlannedItems = useMemo(() => {
    if (!selectedQuoteId) return plannedItems;
    return plannedItems.filter(p => p.quoteId === selectedQuoteId);
  }, [plannedItems, selectedQuoteId]);

  const availableSections = useMemo(() => {
    const sectionMap = new Map<string, { sectionName: string; trade: string; count: number }>();
    for (const item of filteredPlannedItems) {
      const existing = sectionMap.get(item.sectionName);
      if (existing) {
        existing.count++;
      } else {
        sectionMap.set(item.sectionName, { sectionName: item.sectionName, trade: item.trade, count: 1 });
      }
    }
    return [...sectionMap.values()];
  }, [filteredPlannedItems]);

  const toggleSection = (sectionName: string) => {
    setSelectedTrades(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) next.delete(sectionName);
      else next.add(sectionName);
      return next;
    });
  };

  const goToTrades = () => {
    setSelectedTrades(new Set());
    setStep('trades');
  };

  const goToItems = () => {
    const filtered = filteredPlannedItems
      .filter(item => selectedTrades.has(item.sectionName))
      .sort((a, b) => {
        if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName, 'cs');
        return a.name.localeCompare(b.name, 'cs');
      });

    setRows(filtered.map(item => ({
      name: item.name,
      unit: item.unit,
      plannedQty: item.quantity,
      sellingPrice: item.sellingPrice,
      productId: item.productId,
      trade: item.trade,
      sectionName: item.sectionName,
      quoteId: item.quoteId,
      qty: '',
      note: '',
    })));
    setStep('items');
  };

  const updateRow = (index: number, field: 'qty' | 'note', value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const filledCount = rows.filter(r => r.qty.trim() !== '' && parseFloat(r.qty) > 0).length;

  const handleSave = async () => {
    const toSave = rows
      .filter(r => r.qty.trim() !== '' && parseFloat(r.qty) > 0)
      .map(r => ({
        name: r.name,
        unit: r.unit,
        plannedQty: r.plannedQty,
        actualQty: parseFloat(r.qty),
        unitPrice: r.sellingPrice,
        productId: r.productId || null,
        note: r.note,
        sourceQuoteId: r.quoteId || null,
        trade: r.trade || null,
      }));

    if (toSave.length === 0) return;
    await onSave(toSave);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const handleBack = () => {
    if (step === 'items') {
      setStep('trades');
    } else if (step === 'trades' && multipleQuotes) {
      setStep('quote');
    }
  };

  const groupedRows = useMemo(() => {
    const groups = new Map<string, { rows: (BulkRow & { index: number })[]; sectionName: string; trade: string }>();
    rows.forEach((row, index) => {
      if (!groups.has(row.sectionName)) {
        groups.set(row.sectionName, { rows: [], sectionName: row.sectionName, trade: row.trade });
      }
      groups.get(row.sectionName)!.rows.push({ ...row, index });
    });
    return [...groups.values()];
  }, [rows]);

  const stepTitle = step === 'quote'
    ? 'Vyberte nabídku'
    : step === 'trades'
      ? 'Vyberte sekce'
      : 'Zadejte množství';

  if (!open) return null;

  const footer = step === 'quote' ? (
    <>
      <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
        Zrušit
      </button>
      <button
        onClick={goToTrades}
        disabled={!selectedQuoteId}
        className="px-5 py-2 text-sm font-extrabold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
      >
        Pokračovat <ChevronRight className="w-4 h-4" />
      </button>
    </>
  ) : step === 'trades' ? (
    <>
      <button onClick={multipleQuotes ? handleBack : handleClose} className="px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
        {multipleQuotes ? 'Zpět' : 'Zrušit'}
      </button>
      <button
        onClick={goToItems}
        disabled={selectedTrades.size === 0}
        className="px-5 py-2 text-sm font-extrabold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
      >
        Pokračovat <ChevronRight className="w-4 h-4" />
      </button>
    </>
  ) : (
    <>
      <button onClick={handleBack} className="px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
        Zpět
      </button>
      <button
        onClick={handleSave}
        disabled={saving || filledCount === 0}
        className="px-5 py-2 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Uložit {filledCount > 0 && `(${filledCount})`}
      </button>
    </>
  );

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} onClick={handleClose} />
      <div style={{ position: 'relative', zIndex: 1, background: 'rgb(15, 31, 63)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', boxShadow: '0 8px 48px -4px rgba(0,0,0,0.6)', width: '100%', maxWidth: '56rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white', margin: 0 }}>{stepTitle}</h2>
          <button onClick={handleClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 12, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {step === 'quote' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Vyberte nabídku, pro kterou chcete zadat hromadný výkaz:
          </p>
          <div className="space-y-2">
            {allQuotes.map(q => {
              const isSelected = selectedQuoteId === q.id;
              const badgeMeta = STATUS_BADGE[q.status] || STATUS_BADGE.draft;
              const BadgeIcon = badgeMeta.Icon;
              const quoteItemCount = plannedItems.filter(p => p.quoteId === q.id).length;

              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuoteId(q.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-sky-500/20' : 'bg-white/[0.06]'
                  }`}>
                    <FileText className={`w-5 h-5 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{q.quote_number}</span>
                      <span className="text-xs text-slate-500">v{q.version}</span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${badgeMeta.cls}`}>
                        <BadgeIcon className="w-2.5 h-2.5" /> {badgeMeta.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {quoteItemCount} {quoteItemCount === 1 ? 'položka' : quoteItemCount < 5 ? 'položky' : 'položek'}
                      {q.total_selling > 0 && (
                        <span className="ml-2 tabular-nums">{Math.round(q.total_selling).toLocaleString('cs-CZ')} Kč</span>
                      )}
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-sky-600 border-sky-600'
                      : 'border-white/20'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          {plannedItems.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Připojené nabídky neobsahují žádné položky</p>
            </div>
          )}
        </div>
      )}

      {step === 'trades' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Vyberte sekce, pro které chcete zadat výkaz materiálu:
          </p>
          <div className="space-y-2">
            {availableSections.map(sec => {
              const meta = TRADE_META[sec.trade];
              const TradeIcon = meta?.Icon || ClipboardList;
              const isSelected = selectedTrades.has(sec.sectionName);

              return (
                <button
                  key={sec.sectionName}
                  onClick={() => toggleSection(sec.sectionName)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{ backgroundColor: isSelected ? 'rgba(14,165,233,0.15)' : (meta?.bg || '#1a1a2e') }}
                  >
                    <TradeIcon className="w-5 h-5" style={{ color: meta?.accent || '#94a3b8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">
                      {sec.sectionName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {sec.count} {sec.count === 1 ? 'položka' : sec.count < 5 ? 'položky' : 'položek'}
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-sky-600 border-sky-600'
                      : 'border-white/20'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          {availableSections.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Žádné položky k dispozici</p>
            </div>
          )}
        </div>
      )}

      {step === 'items' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">
              Vyplňte skutečné množství. Prázdné řádky budou přeskočeny.
            </p>
            {filledCount > 0 && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                {filledCount} k uložení
              </span>
            )}
          </div>

          {groupedRows.map(group => {
            const meta = TRADE_META[group.trade];
            const TradeIcon = meta?.Icon || ClipboardList;

            return (
              <div key={group.sectionName} className="mb-4">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-t-xl"
                  style={{ background: meta?.bg || '#1a1a2e', borderLeft: `3px solid ${meta?.accent || '#94a3b8'}` }}
                >
                  <TradeIcon className="w-3.5 h-3.5" style={{ color: meta?.accent || '#94a3b8' }} />
                  <span className="text-xs font-extrabold" style={{ color: meta?.accent || '#94a3b8' }}>
                    {group.sectionName}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">{group.rows.length} pol.</span>
                </div>

                <div className="border border-white/[0.08] border-t-0 rounded-b-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/[0.04] border-b border-white/[0.08] text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-2 text-left font-semibold">Položka</th>
                        <th className="px-3 py-2 text-right font-semibold w-20">Plán</th>
                        <th className="px-3 py-2 text-center font-semibold w-28">Množství</th>
                        <th className="px-3 py-2 text-left font-semibold w-36">Poznámka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(row => {
                        const isFilled = row.qty.trim() !== '' && parseFloat(row.qty) > 0;
                        return (
                          <tr
                            key={row.index}
                            className={`border-b border-white/[0.06] transition-colors ${
                              isFilled ? 'bg-emerald-500/10' : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-300">{row.name}</span>
                              <span className="text-slate-500 ml-1.5">({row.unit})</span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                              {Math.round(row.plannedQty).toLocaleString('cs-CZ')}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={row.qty}
                                onChange={e => updateRow(row.index, 'qty', e.target.value)}
                                placeholder="0"
                                className={`w-full text-center px-2 py-1.5 rounded-lg border text-sm tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
                                  isFilled
                                    ? 'border-emerald-500/30 bg-emerald-500/15 font-semibold text-emerald-300'
                                    : 'border-white/10 bg-white/[0.06] text-slate-300'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.note}
                                onChange={e => updateRow(row.index, 'note', e.target.value)}
                                placeholder="-"
                                className="w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 placeholder:text-slate-600"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
}
