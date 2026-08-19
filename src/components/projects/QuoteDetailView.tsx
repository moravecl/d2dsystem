import { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Loader2, Sun, Camera, ShieldAlert, Package,
  Wrench, HardHat, Zap, Battery, Car, PenLine, Monitor, Network, Cable,
  HardDrive, Keyboard, Siren, Eye as EyeIcon, Radio, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { QuoteSection, QuoteItem, QuoteSystemSummary, QuoteAttachment } from '../catalog/quoteHelpers';
import { calcSectionTotal, calcSectionCostTotal } from '../catalog/quoteHelpers';

const TRADE_ICONS: Record<string, typeof Sun> = {
  fotovoltaika: Sun, fve: Sun, solar: Sun,
  camera: Camera, kamery: Camera, kamerovy: Camera,
  eps: ShieldAlert, ezs: ShieldAlert, alarm: ShieldAlert,
  elektro: Zap, baterie: Battery, wallbox: Car,
  montaz: HardHat, accessories: Package, prislusenstvi: Package,
  konstrukce: Wrench, custom: PenLine,
};

const TRADE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  fotovoltaika: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
  fve: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
  camera: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
  eps: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
  ezs: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
};

const SUMMARY_ICONS: Record<string, typeof Sun> = {
  'Detektory': EyeIcon, 'Ustredny': HardDrive, 'Sireny': Siren,
  'Pohyb. cidla': Radio, 'Klavesnice': Keyboard, 'Kabelaz': Cable,
  'Kamery': Camera, 'NVR': Monitor, 'Switche': Network,
  'PoE': Zap, 'Panely': Sun, 'Invertor': Zap,
  'Výkon': Sun, 'Střechy': HardDrive, 'Střídač': Zap,
  'Baterie': Battery, 'Roční produkce': Zap,
  'Celkový výkon': Sun, 'Počet panelů': Sun, 'Počet střech': HardDrive,
};

function getTradeStyle(trade?: string) {
  if (!trade) return { bg: 'bg-white/[0.06]', border: 'border-white/[0.08]', text: 'text-slate-300' };
  const key = trade.toLowerCase();
  for (const [k, v] of Object.entries(TRADE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { bg: 'bg-white/[0.06]', border: 'border-white/[0.08]', text: 'text-slate-300' };
}

function getTradeIcon(trade?: string): typeof Sun {
  if (!trade) return Package;
  const key = trade.toLowerCase();
  for (const [k, v] of Object.entries(TRADE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return Package;
}

const SUMMARY_TYPE_STYLES: Record<string, { bg: string; border: string; text: string; icon: typeof Sun }> = {
  fve: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', icon: Sun },
  camera: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', icon: Camera },
  eps: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: ShieldAlert },
};

interface Props {
  quoteId: string;
}

interface UnassignedItem {
  elementId: string;
  elementTypeName: string;
  quantity: number;
  roomName: string | null;
}

export default function QuoteDetailView({ quoteId }: Props) {
  const [sections, setSections] = useState<QuoteSection[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [summaries, setSummaries] = useState<QuoteSystemSummary[]>([]);
  const [images, setImages] = useState<QuoteAttachment[]>([]);
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [unassignedItems, setUnassignedItems] = useState<UnassignedItem[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('project_quotes')
        .select('sections_data, attachments, source_type')
        .eq('id', quoteId)
        .maybeSingle();

      if (data) {
        const raw = data.sections_data as any;
        const secs = raw?.sections ?? (Array.isArray(raw) ? raw : []);
        setSections(secs);
        setGlobalDiscount(raw?.globalDiscount ?? 0);
        setExpandedSections(new Set(secs.map((s: QuoteSection) => s.id)));
        setUnassignedItems((raw?.unassignedItems ?? []) as UnassignedItem[]);

        const att = data.attachments as any;
        setSummaries((att?.summaries ?? []) as QuoteSystemSummary[]);
        setImages((att?.images ?? []) as QuoteAttachment[]);
        setSourceType(data.source_type);
      }
      setLoading(false);
    })();
  }, [quoteId]);

  const totals = useMemo(() => {
    const totalSelling = sections.reduce((s, sec) => s + calcSectionTotal(sec), 0);
    const afterGlobal = totalSelling * (1 - globalDiscount / 100);
    const totalCost = sections.reduce((s, sec) => s + calcSectionCostTotal(sec), 0);
    const profit = afterGlobal - totalCost;
    const margin = afterGlobal > 0 ? (profit / afterGlobal) * 100 : 0;
    return { totalSelling, afterGlobal, totalCost, profit, margin };
  }, [sections, globalDiscount]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-500">Žádná data nabídky</div>
    );
  }

  return (
    <div className="border-t border-white/[0.06] bg-slate-900/40">
      <div className="p-4 space-y-3">

        {summaries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summaries.map((summary, sIdx) => {
              const sStyle = SUMMARY_TYPE_STYLES[summary.type] ?? SUMMARY_TYPE_STYLES.camera;
              const SIcon = sStyle.icon;
              return (
                <div
                  key={sIdx}
                  className={`rounded-xl ${sStyle.bg} border ${sStyle.border} px-4 py-3 flex-1 min-w-[280px]`}
                >
                  <div className={`flex items-center gap-2 mb-2 ${sStyle.text} text-xs font-extrabold uppercase tracking-wider`}>
                    <SIcon className="w-4 h-4" />
                    {summary.type === 'eps' ? 'EPS / EZS' : summary.type === 'camera' ? 'Kamerový systém' : 'FVE'}
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                    {Object.entries(summary.data || {}).map(([key, val]) => {
                      const KIcon = SUMMARY_ICONS[key] || Package;
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <KIcon className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-[10px] text-slate-500">{key}</span>
                          <span className="text-xs font-extrabold text-slate-200 ml-auto">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map(img => (
              <div key={img.id} className="rounded-xl border border-white/[0.08] overflow-hidden bg-black/30">
                <img
                  src={img.imageData}
                  alt={img.label}
                  className="max-h-48 w-auto object-contain"
                />
                {img.label && (
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-t border-white/[0.06]">
                    {img.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {sections.map(section => {
          const Icon = getTradeIcon(section.trade);
          const style = getTradeStyle(section.trade);
          const isExpanded = expandedSections.has(section.id);
          const secTotal = calcSectionTotal(section);
          const secCost = calcSectionCostTotal(section);
          const secProfit = secTotal - secCost;

          return (
            <div key={section.id} className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition"
              >
                <Icon className={`w-4 h-4 ${style.text} shrink-0`} />
                <span className={`text-sm font-extrabold ${style.text} flex-1 text-left`}>
                  {section.name}
                </span>
                {section.discount ? (
                  <span className="text-[10px] font-extrabold text-orange-400 mr-1">-{section.discount}%</span>
                ) : null}
                <span className="text-[10px] font-bold text-slate-500 mr-2">
                  {section.items.length} položek
                </span>
                <span className="text-sm font-extrabold text-white mr-2">
                  {fmt(secTotal)} Kč
                </span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3">
                  <div className="rounded-lg bg-black/20 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="text-left px-3 py-2">Položka</th>
                          <th className="text-right px-2 py-2 w-16">Mn.</th>
                          <th className="text-center px-2 py-2 w-12">Jedn.</th>
                          <th className="text-right px-2 py-2 w-24">Cena/j.</th>
                          <th className="text-right px-3 py-2 w-24">Celkem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item: QuoteItem) => {
                          const itemTotal = item.quantity * item.sellingPrice * (1 - (item.discount ?? 0) / 100);
                          return (
                            <tr key={item.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                              <td className="px-3 py-2 text-slate-300 font-semibold">
                                {item.code && (
                                  <span className="text-slate-500 mr-1.5">{item.code}</span>
                                )}
                                {item.name}
                                {item.discount ? (
                                  <span className="ml-1.5 text-[9px] font-extrabold text-orange-400">-{item.discount}%</span>
                                ) : null}
                              </td>
                              <td className="px-2 py-2 text-right text-slate-400 font-semibold">{item.quantity}</td>
                              <td className="px-2 py-2 text-center text-slate-500">{item.unit}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{fmt(item.sellingPrice)} Kč</td>
                              <td className="px-3 py-2 text-right text-white font-bold">{fmt(itemTotal)} Kč</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-[10px] font-bold text-emerald-400">
                      Zisk sekce: {fmt(secProfit)} Kč
                      {secTotal > 0 && ` (${Math.round((secProfit / secTotal) * 100)}%)`}
                    </span>
                    <span className="text-xs font-extrabold text-white">
                      {fmt(secTotal)} Kč
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-xl border border-white/[0.1] bg-gradient-to-r from-slate-800/80 to-slate-900/80 p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Celkem</div>
              <div className="text-lg font-extrabold text-white">
                {fmt(totals.afterGlobal)} Kč
              </div>
              {globalDiscount > 0 && (
                <div className="text-[10px] text-slate-500">
                  před slevou {fmt(totals.totalSelling)} Kč ({globalDiscount}% sleva)
                </div>
              )}
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">Zisk</div>
              <div className="text-lg font-extrabold text-emerald-400">{fmt(totals.profit)} Kč</div>
              <div className="text-[10px] text-emerald-500">Marže {totals.margin.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Náklady</div>
              <div className="text-lg font-extrabold text-slate-400">{fmt(totals.totalCost)} Kč</div>
            </div>
          </div>
        </div>

        {unassignedItems.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 transition"
            >
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm font-extrabold text-amber-400 flex-1 text-left">
                Nepřiřazené položky
              </span>
              <span className="text-[10px] font-bold text-slate-500 mr-2">
                {unassignedItems.length} položek
              </span>
              {showUnassigned ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            {showUnassigned && (
              <div className="px-4 pb-3">
                <div className="text-[10px] text-slate-400 mb-2">
                  Tyto položky nemají přiřazený produkt. Zákazník si je může vybrat později.
                </div>
                <div className="rounded-lg bg-black/20 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="text-left px-3 py-2">Typ prvku</th>
                        <th className="text-left px-2 py-2">Místnost</th>
                        <th className="text-right px-3 py-2 w-16">Počet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-white/[0.04]">
                          <td className="px-3 py-2 text-slate-300 font-semibold">
                            {item.elementTypeName}
                          </td>
                          <td className="px-2 py-2 text-slate-500">
                            {item.roomName || '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400 font-semibold">
                            {item.quantity}x
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
