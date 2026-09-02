import { useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import Modal from '../../ui/Modal';
import type { ExportData, SectionKey } from '../selectionPdfExport';
import { CIRCUIT_TYPE_LABELS, ALL_TRADES } from '../../catalog/floorplan/materialLibrary';
import { listAllPins } from '../../catalog/floorplan/pinUtils';
import {
  SECTION_LABELS, SECTION_ORDER, loadStoredOptions, saveStoredOptions, sanitizeFileName,
  type PdfExportOptions, type PriceLevel,
} from './exportOptions';

interface Props {
  open: boolean;
  onClose: () => void;
  data: ExportData;
  /** klic pro pamatovani voleb (id projektu, v portalu nazev projektu) */
  storageKey: string;
  /** nektera prostredi (portal) nenabizeji plne ceny */
  allowFullPrices?: boolean;
}

const PRICE_LEVELS: { key: PriceLevel; label: string; desc: string }[] = [
  { key: 'full', label: 'Kompletní ceny', desc: 'Jednotkové ceny u položek i celkové součty' },
  { key: 'totals', label: 'Jen součty', desc: 'Bez cen u položek, pouze součty sekcí a celkem' },
  { key: 'none', label: 'Bez cen', desc: 'Žádné ceny v celém dokumentu' },
];

export default function ExportPdfDialog({ open, onClose, data, storageKey, allowFullPrices = true }: Props) {
  const floorsWithPlan = useMemo(() => data.floors.filter(f => f.floorplanImg), [data.floors]);

  const availability = useMemo<Record<SectionKey, boolean>>(() => {
    const { floors, selected, products } = data;
    const anyRooms = floors.some(f => (f.rooms ?? []).length > 0);
    const anyCables = floors.some(f => (f.cables ?? []).length > 0);
    const anyMaterial = floors.some(f => (f.cables ?? []).some(c => c.materialName));
    const wetTrades = floors.some(f => (f.cables ?? []).some(c => {
      const t = (f.circuits ?? []).find(ci => ci.id === c.circuitId)?.type ?? 'electric';
      return t === 'water' || t === 'heating';
    }));
    const tradeHasContent = (trade: string) => floors.some(f =>
      (f.circuits ?? []).some(c => (c.type ?? 'electric') === trade)
      || listAllPins(selected, products, f.id).some(pin => (pin.product.trade || 'electric') === trade));
    return {
      products: Object.keys(selected).length > 0 || floors.some(f => (f.objects ?? []).length > 0),
      rooms: anyRooms,
      cables: anyCables,
      materials: anyMaterial,
      fittings: wetTrades,
      breakers: floors.some(f => (f.circuits ?? []).some(c => c.breaker)),
      ventilation: floors.some(f => (f.rooms ?? []).some(r => r.ventilationMode)),
      lighting: floors.some(f => (f.rooms ?? []).some(r => (r.requiredLux ?? 0) > 0)),
      fv_system: (data.fvIncluded ?? true) && !!data.fvSummary && data.fvSummary.panelCount > 0,
      camera_system: (data.cameraIncluded ?? true) && !!data.cameraSummary && data.cameraSummary.cameraCount > 0,
      schematic: (data.designElements ?? []).length > 0 || (data.mountingGroups ?? []).length > 0,
      floorplans: floorsWithPlan.length > 0,
      trades: ALL_TRADES.some(tradeHasContent),
      heating: floors.some(f => (f.rooms ?? []).some(r => r.heatingSystemId)),
    };
  }, [data, floorsWithPlan]);

  const tradeAvailability = useMemo<Record<string, boolean>>(() => {
    const { floors, selected, products } = data;
    return Object.fromEntries(ALL_TRADES.map(trade => [trade, floors.some(f =>
      (f.circuits ?? []).some(c => (c.type ?? 'electric') === trade)
      || listAllPins(selected, products, f.id).some(pin => (pin.product.trade || 'electric') === trade))]));
  }, [data]);

  const [options, setOptions] = useState<PdfExportOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const loaded = loadStoredOptions(storageKey, floorsWithPlan.map(f => f.id), [...ALL_TRADES]);
    if (!allowFullPrices && loaded.priceLevel === 'full') loaded.priceLevel = 'totals';
    setOptions(loaded);
    setError(null);
  }, [open, storageKey, floorsWithPlan, allowFullPrices]);

  if (!options) return null;

  const toggleSection = (key: SectionKey) =>
    setOptions(o => o ? { ...o, sections: { ...o.sections, [key]: !(o.sections[key] !== false) } } : o);
  const toggleFloor = (id: string) =>
    setOptions(o => o ? { ...o, floorIds: { ...o.floorIds, [id]: !(o.floorIds[id] !== false) } } : o);
  const toggleTrade = (t: string) =>
    setOptions(o => o ? { ...o, trades: { ...o.trades, [t]: !(o.trades[t] !== false) } } : o);

  const defaultFileName = `Souhrn projektu - ${sanitizeFileName(data.projectName || 'Projekt') || 'Projekt'}`;

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const { generateSelectionPdf } = await import('./generateSelectionPdf');
      await generateSelectionPdf(data, options);
      saveStoredOptions(storageKey, options);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export selhal, zkuste to prosím znovu.');
    } finally {
      setBusy(false);
    }
  };

  const checkboxCls = 'w-4 h-4 accent-blue-600 shrink-0';
  const rowCls = 'flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.05] cursor-pointer select-none';

  const sectionRow = (key: SectionKey) => {
    const enabled = availability[key];
    const checked = enabled && options.sections[key] !== false;
    return (
      <label key={key} className={`${rowCls} ${enabled ? '' : 'opacity-40 cursor-not-allowed'}`}>
        <input type="checkbox" className={checkboxCls} disabled={!enabled || busy} checked={checked} onChange={() => toggleSection(key)} />
        <span className="text-sm text-slate-200">{SECTION_LABELS[key]}</span>
        {!enabled && <span className="text-[10px] text-slate-500 ml-auto">žádná data</span>}
      </label>
    );
  };

  const plainSections = SECTION_ORDER.filter(k => k !== 'floorplans' && k !== 'trades');

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Export do PDF"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-60 flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {busy ? 'Generuji PDF…' : 'Exportovat PDF'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Sekce dokumentu</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {plainSections.map(sectionRow)}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
            {sectionRow('floorplans')}
            <div className="mt-1 ml-6 space-y-0.5">
              {floorsWithPlan.length === 0 && <div className="text-xs text-slate-500">Žádné podlaží s půdorysem</div>}
              {floorsWithPlan.map(f => (
                <label key={f.id} className={`${rowCls} py-1 ${options.sections.floorplans !== false && options.sections.trades !== false ? '' : ''}`}>
                  <input type="checkbox" className={checkboxCls} disabled={busy} checked={options.floorIds[f.id] !== false} onChange={() => toggleFloor(f.id)} />
                  <span className="text-sm text-slate-300">{f.name}</span>
                </label>
              ))}
              {floorsWithPlan.length > 0 && (
                <div className="text-[10px] text-slate-500 pt-1">Výběr podlaží platí pro půdorysy i řemesla</div>
              )}
            </div>
          </div>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
            {sectionRow('trades')}
            <div className="mt-1 ml-6 space-y-0.5">
              {ALL_TRADES.map(t => {
                const enabled = tradeAvailability[t];
                return (
                  <label key={t} className={`${rowCls} py-1 ${enabled ? '' : 'opacity-40 cursor-not-allowed'}`}>
                    <input type="checkbox" className={checkboxCls} disabled={!enabled || busy} checked={enabled && options.trades[t] !== false} onChange={() => toggleTrade(t)} />
                    <span className="text-sm text-slate-300">{CIRCUIT_TYPE_LABELS[t].label}</span>
                    {!enabled && <span className="text-[10px] text-slate-500 ml-auto">žádná data</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Ceny</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRICE_LEVELS.filter(l => allowFullPrices || l.key !== 'full').map(l => (
              <label
                key={l.key}
                className={`border rounded-xl p-3 cursor-pointer transition ${
                  options.priceLevel === l.key
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/[0.08] bg-white/[0.04] hover:border-blue-400/40'
                }`}
              >
                <input
                  type="radio"
                  name="priceLevel"
                  className="hidden"
                  disabled={busy}
                  checked={options.priceLevel === l.key}
                  onChange={() => setOptions(o => o ? { ...o, priceLevel: l.key } : o)}
                />
                <div className={`text-sm font-bold ${options.priceLevel === l.key ? 'text-blue-300' : 'text-slate-200'}`}>{l.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{l.desc}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Název souboru</div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={options.fileName}
              disabled={busy}
              onChange={(e) => setOptions(o => o ? { ...o, fileName: e.target.value } : o)}
              placeholder={defaultFileName}
              className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-200 placeholder:text-slate-500"
            />
            <span className="text-sm text-slate-500 shrink-0">.pdf</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
