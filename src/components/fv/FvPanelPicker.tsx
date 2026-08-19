import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Sun } from 'lucide-react';
import type { FvPanel } from '../../hooks/useFvCatalog';

interface Props {
  panels: FvPanel[];
  selectedId: string | null;
  onSelect: (panel: FvPanel) => void;
}

const TECH_LABELS: Record<string, string> = {
  mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jiná',
};

const TECH_COLORS: Record<string, string> = {
  mono: 'bg-blue-500/20 text-blue-400',
  poly: 'bg-white/[0.06] text-slate-400',
  topcon: 'bg-emerald-500/20 text-emerald-400',
  hjt: 'bg-orange-500/20 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function FvPanelPicker({ panels, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const selectedPanel = panels.find(p => p.id === selectedId);
  const filtered = panels.filter(p =>
    `${p.name} ${p.manufacturer}`.toLowerCase().includes(search.toLowerCase())
  );

  if (panels.length === 0) {
    return (
      <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-extrabold">
        Žádné panely v katalogu. Přidejte je v Admin &rarr; FV katalog.
      </div>
    );
  }

  return (
    <div>
      {selectedPanel ? (
        <div
          className="flex items-center gap-3 p-2.5 bg-orange-500/10 border border-orange-200 rounded-xl cursor-pointer hover:bg-orange-500/20 transition"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0">
            <Sun className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold text-white truncate">{selectedPanel.name}</div>
            <div className="text-[10px] font-extrabold text-slate-500">{selectedPanel.manufacturer} · {selectedPanel.power_wp} Wp · {selectedPanel.price.toLocaleString('cs-CZ')} Kč</div>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        </div>
      ) : (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/[0.06] border border-dashed border-orange-300 rounded-xl text-xs font-extrabold text-orange-600 hover:bg-orange-500/10 transition"
        >
          <Sun className="w-3.5 h-3.5" />
          Vybrat panel
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}

      {expanded && (
        <div className="mt-2 bg-navy-800/60 border border-white/[0.08] rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-white/10 rounded-lg focus:outline-none focus:border-orange-400"
                placeholder="Hledat panel..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(panel => (
              <button
                key={panel.id}
                onClick={() => { onSelect(panel); setExpanded(false); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 hover:bg-orange-500/10 transition text-left border-b border-slate-50 last:border-0 ${selectedId === panel.id ? 'bg-orange-500/10' : ''}`}
              >
                <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Sun className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold text-white truncate">{panel.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-extrabold text-slate-500">{panel.manufacturer}</span>
                    <span className="text-[10px] font-extrabold text-orange-600">{panel.power_wp} Wp</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${TECH_COLORS[panel.technology] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TECH_LABELS[panel.technology] ?? panel.technology}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400">{panel.width_mm}×{panel.height_mm} mm</span>
                  </div>
                </div>
                <div className="text-xs font-extrabold text-slate-300 shrink-0">{panel.price.toLocaleString('cs-CZ')} Kč</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">Žádné výsledky</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
