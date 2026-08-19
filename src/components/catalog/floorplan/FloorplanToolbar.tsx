import { useState, useRef, useEffect } from 'react';
import { MousePointer2, MapPin, Ruler, Square, Cable, Move3d as Move3D, Grid3x3 as Grid3X3, Minus, Plus, Flame, Lightbulb, Wind, Layers, ChevronUp, PanelLeftOpen, PanelLeftClose, Eye, EyeOff } from 'lucide-react';

import type { CircuitType } from '../../../hooks/useProjectState';
import { CIRCUIT_TYPE_LABELS, ALL_TRADES } from './materialLibrary';

export type ToolMode = 'pointer' | 'place' | 'scale' | 'room' | 'cable' | 'dimension' | 'heating' | 'lighting' | 'ventilation';

interface Props {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  hasScale: boolean;
  hasImage: boolean;
  visibleLayers: Record<CircuitType, boolean>;
  onToggleLayer: (type: CircuitType) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showHeatingPipes: boolean;
  onToggleHeatingPipes: () => void;
  pinSize: number;
  onPinSizeChange: (size: number) => void;
  schematicSymbolScale?: number;
  onSchematicSymbolScaleChange?: (size: number) => void;
  isSchematicMode?: boolean;
}

const TOOLS: { mode: ToolMode; icon: typeof MousePointer2; label: string; hint: string }[] = [
  { mode: 'pointer', icon: MousePointer2, label: 'Vybrat', hint: 'Táhej piny, klikej pro výběr' },
  { mode: 'place', icon: MapPin, label: 'Umístit', hint: 'Klikni na půdorys pro umístění' },
  { mode: 'scale', icon: Ruler, label: 'Měřítko', hint: 'Klikni 2 body a zadej vzdálenost' },
  { mode: 'room', icon: Square, label: 'Místnost', hint: 'Klikej rohy stěny, uzavři polygon' },
  { mode: 'cable', icon: Cable, label: 'Trasy', hint: 'Kabely, trubky - kresli po bodech' },
  { mode: 'dimension', icon: Move3D, label: 'Kóta', hint: 'Klikni 2 body pro kótu' },
  { mode: 'heating', icon: Flame, label: 'Vytápění', hint: 'Konfigurace vytápění místnosti' },
  { mode: 'lighting', icon: Lightbulb, label: 'Osvětlení', hint: 'Konfigurace osvětlení místnosti' },
  { mode: 'ventilation', icon: Wind, label: 'Rekuperace', hint: 'Výpočet výústek a doporučení jednotky' },
];

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/tip:flex items-center z-50 pointer-events-none">
        <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          {text}
        </div>
      </div>
    </div>
  );
}

export default function FloorplanToolbar({ mode, onModeChange, hasScale, hasImage, visibleLayers, onToggleLayer, showGrid, onToggleGrid, showHeatingPipes, onToggleHeatingPipes, pinSize, onPinSizeChange, schematicSymbolScale = 24, onSchematicSymbolScaleChange, isSchematicMode = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layersOpen) return;
    const handler = (e: MouseEvent) => {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [layersOpen]);

  return (
    <div className={`bg-white/[0.06] border-r flex flex-col py-3 shrink-0 transition-all duration-200 ease-in-out ${expanded ? 'w-48' : 'w-14'} ${expanded ? 'items-stretch px-2' : 'items-center'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-10 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition mb-2 self-center"
      >
        {expanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
      </button>

      <div className="flex flex-col gap-0.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = mode === tool.mode;
          const needsScale = hasImage && !hasScale && tool.mode !== 'scale';

          const btn = (
            <button
              key={tool.mode}
              onClick={() => onModeChange(tool.mode)}
              disabled={needsScale}
              className={`${expanded ? 'w-full px-3 py-2 rounded-xl flex items-center gap-2.5' : 'w-10 h-10 rounded-xl flex items-center justify-center self-center'} transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : needsScale
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {expanded && (
                <div className="min-w-0">
                  <div className={`text-xs font-extrabold leading-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>{tool.label}</div>
                  <div className={`text-[10px] leading-tight truncate ${isActive ? 'text-white/60' : 'text-slate-400'}`}>{tool.hint}</div>
                </div>
              )}
            </button>
          );

          if (expanded) return <div key={tool.mode}>{btn}</div>;
          return <Tooltip key={tool.mode} text={`${tool.label}: ${tool.hint}`}>{btn}</Tooltip>;
        })}
      </div>

      <div className={`h-px bg-white/[0.08] my-2 ${expanded ? 'mx-2' : 'w-6 self-center'}`} />

      <div className="flex flex-col gap-0.5">
        {expanded ? (
          <>
            <button
              onClick={onToggleGrid}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                showGrid ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:bg-white/[0.06]'
              }`}
            >
              <Grid3X3 className="w-[18px] h-[18px] shrink-0" />
              <span className="text-xs font-extrabold">{showGrid ? 'Skrýt mřížku' : 'Mřížka'}</span>
            </button>
            <button
              onClick={onToggleHeatingPipes}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                showHeatingPipes ? 'bg-red-500/10 text-red-400' : 'text-slate-500 hover:bg-white/[0.06]'
              }`}
            >
              <Flame className="w-[18px] h-[18px] shrink-0" />
              <span className="text-xs font-extrabold">{showHeatingPipes ? 'Skrýt topení' : 'Topení'}</span>
            </button>
          </>
        ) : (
          <>
            <Tooltip text={showGrid ? 'Skrýt mřížku' : 'Zobrazit mřížku'}>
              <button
                onClick={onToggleGrid}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition self-center ${
                  showGrid ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-400'
                }`}
              >
                <Grid3X3 className="w-[18px] h-[18px]" />
              </button>
            </Tooltip>
            <Tooltip text={showHeatingPipes ? 'Skrýt trubky topení' : 'Zobrazit trubky topení'}>
              <button
                onClick={onToggleHeatingPipes}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition self-center ${
                  showHeatingPipes ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-400'
                }`}
              >
                <Flame className="w-[18px] h-[18px]" />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      <div className={`h-px bg-white/[0.08] my-2 ${expanded ? 'mx-2' : 'w-6 self-center'}`} />

      {expanded ? (
        <div className="flex flex-col gap-1">
          {!isSchematicMode && (
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Piny</span>
              <div className="flex-1" />
              <button
                onClick={() => onPinSizeChange(Math.max(16, pinSize - 4))}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-extrabold text-slate-400 w-5 text-center">{pinSize}</span>
              <button
                onClick={() => onPinSizeChange(Math.min(48, pinSize + 4))}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
          {isSchematicMode && onSchematicSymbolScaleChange && (
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-wider">Symboly</span>
              <div className="flex-1" />
              <button
                onClick={() => onSchematicSymbolScaleChange(Math.max(16, schematicSymbolScale - 4))}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-extrabold text-teal-400 w-5 text-center">{schematicSymbolScale}</span>
              <button
                onClick={() => onSchematicSymbolScaleChange(Math.min(64, schematicSymbolScale + 4))}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          {isSchematicMode && onSchematicSymbolScaleChange ? (
            <>
              <button
                onClick={() => onSchematicSymbolScaleChange(Math.min(64, schematicSymbolScale + 4))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-teal-400 hover:text-teal-300 hover:bg-white/[0.06] transition"
              >
                <Plus className="w-3 h-3" />
              </button>
              <span className="text-[9px] font-extrabold text-teal-400 select-none">{schematicSymbolScale}</span>
              <button
                onClick={() => onSchematicSymbolScaleChange(Math.max(16, schematicSymbolScale - 4))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-teal-400 hover:text-teal-300 hover:bg-white/[0.06] transition"
              >
                <Minus className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onPinSizeChange(Math.min(48, pinSize + 4))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
              >
                <Plus className="w-3 h-3" />
              </button>
              <span className="text-[9px] font-extrabold text-slate-400 select-none">{pinSize}</span>
              <button
                onClick={() => onPinSizeChange(Math.max(16, pinSize - 4))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
              >
                <Minus className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex-1" />

      <div className={`relative ${expanded ? '' : 'mb-1'}`} ref={layersRef}>
        {expanded ? (
          <button
            onClick={() => setLayersOpen(!layersOpen)}
            className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 transition text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
          >
            <Layers className="w-[18px] h-[18px] shrink-0" />
            <span className="text-xs font-extrabold flex-1 text-left">Vrstvy</span>
            <ChevronUp className={`w-3.5 h-3.5 transition-transform ${layersOpen ? '' : 'rotate-180'}`} />
          </button>
        ) : (
          <Tooltip text="Vrstvy">
            <button
              onClick={() => setLayersOpen(!layersOpen)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition self-center ${
                layersOpen ? 'bg-white/[0.08] text-slate-300' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-400'
              }`}
            >
              <Layers className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        )}

        {layersOpen && (
          <div className={`${expanded ? 'mt-1 px-2' : 'absolute bottom-full left-full ml-1 mb-0'} z-50`}>
            <div className={`${expanded ? '' : 'bg-navy-800/60 rounded-xl shadow-lg border border-white/10 p-2 min-w-[160px]'} flex flex-col gap-0.5`}>
              {ALL_TRADES.map((type) => {
                const info = CIRCUIT_TYPE_LABELS[type];
                const isVisible = visibleLayers[type];
                return (
                  <button
                    key={type}
                    onClick={() => onToggleLayer(type)}
                    className={`w-full px-3 py-1.5 rounded-lg flex items-center gap-2.5 transition ${
                      isVisible ? 'bg-white/[0.06]  ring-1 ring-slate-200' : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                    <span className={`text-[11px] font-extrabold flex-1 text-left ${isVisible ? 'text-slate-300' : 'text-slate-400'}`}>{info.label}</span>
                    {isVisible ? (
                      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
