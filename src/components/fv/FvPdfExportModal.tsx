import { useState } from 'react';
import { X, Check, FileText, BarChart3, Home, Wrench, Table, Zap, DollarSign, Image } from 'lucide-react';
import type { PdfSectionFlags } from './fvPdfExport';
import type { RoofSurface } from '../../lib/fvCalculations';

interface SectionOption {
  key: keyof PdfSectionFlags;
  label: string;
  description: string;
  icon: typeof FileText;
}

const SECTION_OPTIONS: SectionOption[] = [
  { key: 'summary', label: 'Souhrn', description: 'Klíčové ukazatele: výkon, výroba, úspory, návratnost', icon: BarChart3 },
  { key: 'roofs', label: 'Střešní plochy', description: 'Parametry střech, náhled rozmístění panelů', icon: Home },
  { key: 'construction', label: 'Montážní konstrukce', description: 'Háky, profily, příchytky a rozpis materiálu', icon: Wrench },
  { key: 'charts', label: 'Grafy bilance', description: 'Měsíční výroba vs spotřeba, krytí spotřeby', icon: BarChart3 },
  { key: 'energyTable', label: 'Energetická bilance', description: 'Tabulka měsíční produkce, spotřeby a přetoků', icon: Table },
  { key: 'system', label: 'Konfigurace systému', description: 'Střídač, baterie, wallbox a detaily komponentů', icon: Zap },
  { key: 'price', label: 'Cenová kalkulace', description: 'Rozpis cen, dotace, návratnost investice', icon: DollarSign },
];

interface Props {
  roofs: RoofSurface[];
  roofSnapshots: Record<string, string>;
  onClose: () => void;
  onExport: (sections: PdfSectionFlags) => void;
}

export default function FvPdfExportModal({ roofs, roofSnapshots, onClose, onExport }: Props) {
  const [flags, setFlags] = useState<PdfSectionFlags>(() => {
    const all: PdfSectionFlags = {};
    for (const opt of SECTION_OPTIONS) all[opt.key] = true;
    return all;
  });

  const toggle = (key: keyof PdfSectionFlags) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(flags).filter(Boolean).length;
  const allEnabled = enabledCount === SECTION_OPTIONS.length;

  const toggleAll = () => {
    const newVal = !allEnabled;
    const next: PdfSectionFlags = {};
    for (const opt of SECTION_OPTIONS) next[opt.key] = newVal;
    setFlags(next);
  };

  const roofPreviews = roofs.filter(r => r.panelCount > 0 && roofSnapshots[r.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] px-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl shadow-slate-900/10 w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white">Export PDF nabídky</h2>
            <p className="text-xs text-slate-500 mt-0.5">Vyberte sekce, které chcete zahrnout do PDF</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-3">
          {roofPreviews.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <Image className="w-3 h-3" /> Náhled střech
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {roofPreviews.map(roof => (
                  <div key={roof.id} className="shrink-0 rounded-xl border border-white/10 overflow-hidden bg-white/[0.04]">
                    <img
                      src={roofSnapshots[roof.id]}
                      alt={roof.name}
                      className="w-36 h-24 object-contain"
                    />
                    <div className="px-2 py-1.5 text-center">
                      <div className="text-[10px] font-extrabold text-slate-300 truncate">{roof.name}</div>
                      <div className="text-[9px] text-slate-400">{roof.panelCount} ks / {Math.round(roof.panelCount * roof.panelPowerWp / 10) / 100} kWp</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Sekce dokumentu</div>
            <button
              onClick={toggleAll}
              className="text-[10px] font-extrabold text-orange-600 hover:text-orange-700 transition"
            >
              {allEnabled ? 'Odznačit vše' : 'Vybrat vše'}
            </button>
          </div>

          <div className="space-y-1.5">
            {SECTION_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isOn = flags[opt.key] ?? true;

              return (
                <div
                  key={opt.key}
                  onClick={() => toggle(opt.key)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition ${
                    isOn ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOn ? 'bg-orange-500/20' : 'bg-white/[0.06]'}`}>
                    <Icon className={`w-4 h-4 ${isOn ? 'text-orange-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-white">{opt.label}</div>
                    <div className="text-[10px] text-slate-500">{opt.description}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 transition ${
                    isOn ? 'bg-orange-500 border-orange-500' : 'bg-white/[0.06] border-slate-300'
                  }`}>
                    {isOn && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.04]">
          <button
            onClick={() => onExport(flags)}
            disabled={enabledCount === 0}
            className="w-full py-3 bg-slate-800 text-white rounded-xl font-extrabold text-sm hover:bg-slate-900 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Generovat PDF ({enabledCount} {enabledCount === 1 ? 'sekce' : enabledCount < 5 ? 'sekce' : 'sekcí'})
          </button>
        </div>
      </div>
    </div>
  );
}
