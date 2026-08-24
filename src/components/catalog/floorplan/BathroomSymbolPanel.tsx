import type { BathroomSymbol } from './BathroomDesigner';
import { sanitizeSvg } from '../../../lib/sanitize';

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'wc', label: 'WC' },
  { id: 'umyvadlo', label: 'Umyvadlo' },
  { id: 'vana', label: 'Vana' },
  { id: 'sprcha', label: 'Sprcha' },
  { id: 'bidet', label: 'Bidet' },
  { id: 'ostatni', label: 'Ostatní' },
];

interface Props {
  symbols: BathroomSymbol[];
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  onPlace: (sym: BathroomSymbol) => void;
}

export default function BathroomSymbolPanel({ symbols, activeCategory, onCategoryChange, onPlace }: Props) {
  const filtered = symbols.filter((s) => s.category === activeCategory);

  return (
    <div className="w-56 shrink-0 border-r border-white/[0.06] bg-white/[0.06] flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Kategorie</div>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map((cat) => {
            const count = symbols.filter((s) => s.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-between ${
                  activeCategory === cat.id
                    ? 'bg-cyan-500/10 text-cyan-700 border border-cyan-200'
                    : 'text-slate-400 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {cat.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                    activeCategory === cat.id ? 'bg-cyan-100 text-cyan-600' : 'bg-white/[0.06] text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-6">Žádné symboly</div>
        )}
        {filtered.map((sym) => {
          const aspect = sym.height_mm / sym.width_mm;
          const previewW = 80;
          const previewH = Math.max(40, Math.min(80, previewW * aspect));

          return (
            <button
              key={sym.id}
              onClick={() => onPlace(sym)}
              className="w-full bg-white/[0.04] hover:bg-cyan-500/10 border border-white/[0.06] hover:border-cyan-200 rounded-xl p-2 transition group text-left"
            >
              <div
                className="w-full flex items-center justify-center mb-1.5 bg-navy-800/60 rounded-lg overflow-hidden border border-white/[0.06]"
                style={{ height: previewH }}
              >
                <svg
                  width={previewW}
                  height={previewH}
                  viewBox={`0 0 ${sym.width_mm} ${sym.height_mm}`}
                  preserveAspectRatio="xMidYMid meet"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(sym.svg_content) }}
                />
              </div>
              <div className="text-[11px] font-extrabold text-slate-300 group-hover:text-cyan-700 leading-tight">{sym.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{sym.width_mm} × {sym.height_mm} mm</div>
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-white/[0.06] shrink-0">
        <p className="text-[10px] text-slate-400 text-center">Klikni pro vložení</p>
      </div>
    </div>
  );
}
