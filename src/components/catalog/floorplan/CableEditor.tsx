import { useState } from 'react';
import { Cable, Trash2, Plus, Check, X, Zap, Droplets, Flame, Wind, Shield, Eye, EyeOff } from 'lucide-react';
import type { Circuit, Cable as CableType, FloorScale, CircuitType, CircuitBreaker } from '../../../hooks/useProjectState';
import type { Material } from '../../../types/database';
import { polylineLength, normalizedToMeters, polylineLengthM } from './geometry';
import { CIRCUIT_TYPE_LABELS } from './materialLibrary';
import FittingsPanel from './FittingsPanel';

const CIRCUIT_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f97316',
  '#06b6d4', '#ec4899', '#eab308', '#14b8a6',
];

const TYPE_ICONS: Record<CircuitType, typeof Zap> = {
  electric: Zap,
  water: Droplets,
  heating: Flame,
  recuperation: Wind,
};

const ALL_TRADES: CircuitType[] = ['electric', 'water', 'heating', 'recuperation'];

interface Props {
  circuits: Circuit[];
  cables: CableType[];
  scale?: FloorScale;
  activeCircuitId: string | null;
  isDrawing: boolean;
  drawingPoints: { x: number; y: number }[];
  materials: Material[];
  hiddenCircuitIds: Set<string>;
  onToggleCircuitVisibility: (circuitId: string) => void;
  onAddCircuit: (circuit: Circuit) => void;
  onRemoveCircuit: (circuitId: string) => void;
  onUpdateCircuit: (circuitId: string, updates: Partial<Omit<Circuit, 'id'>>) => void;
  onSelectCircuit: (circuitId: string) => void;
  onStartDraw: (materialName: string) => void;
  onFinishCable: () => void;
  onCancelDraw: () => void;
  onRemoveCable: (cableId: string) => void;
}

function BreakerEditor({ breaker, onChange }: { breaker?: CircuitBreaker; onChange: (b: CircuitBreaker | undefined) => void }) {
  const current = breaker ?? { amperage: 16, poles: 1, curve: 'B' };
  const isSet = !!breaker;

  if (!isSet) {
    return (
      <div className="px-3 pb-2.5">
        <button
          onClick={() => onChange({ amperage: 16, poles: 1, curve: 'B' })}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-200 text-amber-400 text-[10px] font-extrabold hover:bg-amber-500/20 transition"
        >
          <Shield className="w-3 h-3" />
          Nastavit jištění
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-2.5">
      <div className="bg-amber-500/10 border border-amber-200 rounded-lg p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[10px] font-extrabold text-amber-400">Jištění</span>
          <span className="flex-1 text-[10px] font-extrabold text-amber-900 text-right">
            {current.amperage}A / {current.poles}p / {current.curve}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={current.amperage}
            onChange={(e) => onChange({ ...current, amperage: Number(e.target.value) })}
            className="flex-1 px-1.5 py-1 rounded border border-amber-200 bg-white/[0.06] text-[10px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-300"
          >
            {[6, 10, 13, 16, 20, 25, 32, 40, 50, 63].map((a) => (
              <option key={a} value={a}>{a}A</option>
            ))}
          </select>
          <select
            value={current.poles}
            onChange={(e) => onChange({ ...current, poles: Number(e.target.value) })}
            className="w-14 px-1.5 py-1 rounded border border-amber-200 bg-white/[0.06] text-[10px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-300"
          >
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>{p}p</option>
            ))}
          </select>
          <select
            value={current.curve}
            onChange={(e) => onChange({ ...current, curve: e.target.value })}
            className="w-12 px-1.5 py-1 rounded border border-amber-200 bg-white/[0.06] text-[10px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-300"
          >
            {['B', 'C', 'D'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => onChange(undefined)}
            title="Odebrat jištění"
            className="p-0.5 rounded text-amber-400 hover:text-red-500 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CableEditor({
  circuits,
  cables,
  scale,
  activeCircuitId,
  isDrawing,
  drawingPoints,
  materials,
  hiddenCircuitIds,
  onToggleCircuitVisibility,
  onAddCircuit,
  onRemoveCircuit,
  onUpdateCircuit,
  onSelectCircuit,
  onStartDraw,
  onFinishCable,
  onCancelDraw,
  onRemoveCable,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CircuitType>('electric');
  const [addingCircuit, setAddingCircuit] = useState(false);
  const [pickingMaterial, setPickingMaterial] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState('');

  const activeCircuit = circuits.find((c) => c.id === activeCircuitId);

  const getMaterialsForTrade = (trade: CircuitType) =>
    materials.filter((m) => m.trade === trade && m.material_type === 'linear');

  const getPrice = (materialName: string): number => {
    const mat = materials.find((m) => m.name === materialName);
    return mat?.price_per_unit ?? 0;
  };

  const handleAddCircuit = () => {
    const name = newName.trim() || `${CIRCUIT_TYPE_LABELS[newType].label} ${circuits.filter((c) => c.type === newType).length + 1}`;
    const usedColors = new Set(circuits.map((c) => c.color));
    const color = CIRCUIT_COLORS.find((c) => !usedColors.has(c)) ?? CIRCUIT_COLORS[circuits.length % CIRCUIT_COLORS.length];
    onAddCircuit({ id: crypto.randomUUID(), name, color, type: newType });
    setNewName('');
    setAddingCircuit(false);
  };

  const handleStartMaterialPick = () => {
    if (!activeCircuit) return;
    const tradeMaterials = getMaterialsForTrade(activeCircuit.type ?? 'electric');
    setSelectedMaterial(tradeMaterials[0]?.name ?? '');
    setPickingMaterial(true);
  };

  const handleConfirmMaterial = () => {
    if (!selectedMaterial) return;
    setPickingMaterial(false);
    onStartDraw(selectedMaterial);
  };

  const getCableLength = (cable: CableType): string => {
    if (scale) {
      return `${polylineLengthM(cable.points, scale).toFixed(1)} m`;
    }
    return `${(polylineLength(cable.points) * 100).toFixed(0)} j.`;
  };

  const getCircuitTotalLength = (circuitId: string): string => {
    const circuitCables = cables.filter((c) => c.circuitId === circuitId);
    if (scale) {
      const meters = circuitCables.reduce((sum, c) => sum + polylineLengthM(c.points, scale), 0);
      return `${meters.toFixed(1)} m`;
    }
    const totalNormalized = circuitCables.reduce((sum, c) => sum + polylineLength(c.points), 0);
    return `${(totalNormalized * 100).toFixed(0)} j.`;
  };

  const getMaterialTotals = (): { name: string; length: string; price: number }[] => {
    const totals: Record<string, number> = {};
    for (const cable of cables) {
      if (!cable.materialName) continue;
      totals[cable.materialName] = (totals[cable.materialName] || 0) + (scale ? polylineLengthM(cable.points, scale) : polylineLength(cable.points));
    }
    return Object.entries(totals).map(([name, normalized]) => {
      const meters = scale ? normalized : normalized * 100;
      const price = getPrice(name);
      return {
        name,
        length: scale ? `${meters.toFixed(1)} m` : `${meters.toFixed(0)} j.`,
        price: price > 0 ? Math.round(meters * price) : 0,
      };
    });
  };

  const materialTotals = getMaterialTotals();
  const totalRoutesPrice = materialTotals.reduce((s, m) => s + m.price, 0);

  const PLACEHOLDER_MAP: Record<CircuitType, string> = {
    electric: 'Světla',
    water: 'Studená voda',
    heating: 'Podlahové topení',
    recuperation: 'Přívod vzduchu',
  };

  return (
    <div className="p-4 border-b border-white/10">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Cable className="w-3.5 h-3.5" />
        Trasy / Okruhy
        {circuits.length > 0 && (
          <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{circuits.length}</span>
        )}
      </div>

      {!scale && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-2.5 mb-3">
          <div className="text-[11px] font-extrabold text-amber-400">Nastav měřítko pro výpočet délek v metrech.</div>
        </div>
      )}

      {isDrawing && activeCircuitId ? (
        <div className="bg-blue-500/10 border border-blue-200 rounded-2xl p-3 mb-3 space-y-2">
          <div className="text-sm font-extrabold text-blue-800">
            Kreslení trasy ({drawingPoints.length} bodů)
          </div>
          <div className="text-xs text-blue-400">Klikej na půdorys pro přidání bodu trasy.</div>
          {drawingPoints.length >= 2 && (
            <button onClick={onFinishCable} className="w-full bg-blue-600 text-white py-2 rounded-xl font-extrabold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Dokončit trasu
            </button>
          )}
          <button onClick={onCancelDraw} className="text-xs font-extrabold text-blue-400 underline">Zrušit</button>
        </div>
      ) : null}

      {pickingMaterial && activeCircuit && (
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 mb-3 space-y-2">
          <div className="text-xs font-extrabold text-slate-300">Vyber materiál:</div>
          <select
            value={selectedMaterial}
            onChange={(e) => setSelectedMaterial(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {getMaterialsForTrade(activeCircuit.type ?? 'electric').map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}{m.price_per_unit > 0 ? ` (${m.price_per_unit} Kč/m)` : ''}
              </option>
            ))}
            <option value="__custom">-- Vlastní --</option>
          </select>
          {selectedMaterial === '__custom' && (
            <input
              autoFocus
              placeholder="Název materiálu..."
              onChange={(e) => { if (e.target.value) setSelectedMaterial(e.target.value); }}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          )}
          <div className="flex gap-2">
            <button onClick={handleConfirmMaterial} className="flex-1 bg-slate-900 text-white py-2 rounded-xl font-extrabold text-xs hover:bg-slate-800 transition flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Kreslit
            </button>
            <button onClick={() => setPickingMaterial(false)} className="px-3 py-2 bg-navy-800/60 border border-white/[0.08] text-slate-400 rounded-xl font-extrabold text-xs hover:bg-white/[0.04] transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {circuits.map((circuit) => {
          const circuitCables = cables.filter((c) => c.circuitId === circuit.id);
          const isActive = activeCircuitId === circuit.id;
          const circuitType = circuit.type ?? 'electric';
          const TypeIcon = TYPE_ICONS[circuitType];
          const typeInfo = CIRCUIT_TYPE_LABELS[circuitType];
          const isHidden = hiddenCircuitIds.has(circuit.id);
          return (
            <div
              key={circuit.id}
              className={`rounded-2xl border-2 transition ${
                isActive ? 'border-blue-400 bg-blue-500/10' : 'border-white/[0.06] bg-white/[0.04]'
              } ${isHidden ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => onSelectCircuit(circuit.id)}>
                <span className="w-4 h-4 rounded-full border-2 border-white shadow shrink-0" style={{ backgroundColor: circuit.color }} />
                <TypeIcon className="w-3 h-3 shrink-0" style={{ color: typeInfo.color }} />
                <span className="flex-1 text-xs font-extrabold text-slate-300 truncate">{circuit.name}</span>
                <span className="text-[10px] font-extrabold text-slate-500">{getCircuitTotalLength(circuit.id)}</span>
                {isActive && !isDrawing && !pickingMaterial && (
                  <button onClick={(e) => { e.stopPropagation(); handleStartMaterialPick(); }} className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold hover:bg-blue-700 transition">
                    + Trasa
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCircuitVisibility(circuit.id); }}
                  className={`p-1 rounded-lg transition ${isHidden ? 'text-slate-300 hover:text-blue-500 hover:bg-blue-500/10' : 'text-slate-400 hover:text-slate-400 hover:bg-white/[0.06]'}`}
                  title={isHidden ? 'Zobrazit trasu' : 'Skrýt trasu'}
                >
                  {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemoveCircuit(circuit.id); }} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {isActive && circuitCables.length > 0 && (
                <div className="px-3 pb-2.5 space-y-1">
                  {circuitCables.map((cable, idx) => {
                    const price = cable.materialName ? getPrice(cable.materialName) : 0;
                    return (
                      <div key={cable.id} className="flex items-center gap-2 text-[11px] text-slate-400 bg-navy-800/60 rounded-lg px-2 py-1.5 border border-white/[0.06]">
                        <span className="font-extrabold shrink-0">#{idx + 1}</span>
                        {cable.materialName && (
                          <span className="text-[10px] font-extrabold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">{cable.materialName}</span>
                        )}
                        <span className="flex-1 text-[10px]">{cable.points.length} bodů</span>
                        <span className="font-extrabold">{getCableLength(cable)}</span>
                        {price > 0 && (
                          <span className="text-[10px] text-emerald-400 font-extrabold">{price} Kč/m</span>
                        )}
                        <button onClick={() => onRemoveCable(cable.id)} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {isActive && circuitType === 'electric' && (
                <BreakerEditor
                  breaker={circuit.breaker}
                  onChange={(breaker) => onUpdateCircuit(circuit.id, { breaker })}
                />
              )}
            </div>
          );
        })}
      </div>

      {addingCircuit ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1">
            {ALL_TRADES.map((t) => {
              const Icon = TYPE_ICONS[t];
              const info = CIRCUIT_TYPE_LABELS[t];
              return (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-extrabold transition ${
                    newType === t ? 'bg-slate-900 text-white shadow' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {info.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCircuit(); }}
              placeholder={`např. ${PLACEHOLDER_MAP[newType]}...`}
              className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button onClick={handleAddCircuit} className="bg-slate-900 text-white px-3 py-2 rounded-xl font-extrabold text-xs hover:bg-slate-800 transition">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setAddingCircuit(false)} className="bg-navy-800/60 border border-white/[0.08] text-slate-400 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCircuit(true)}
          className="mt-2 w-full bg-white/[0.06] text-slate-300 py-2.5 rounded-2xl font-extrabold text-sm hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Přidat okruh
        </button>
      )}

      {materialTotals.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Součet materiálu</div>
          <div className="space-y-1">
            {materialTotals.map((mt) => (
              <div key={mt.name} className="flex items-center justify-between text-[11px] bg-white/[0.04] rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
                <span className="font-extrabold text-slate-300">{mt.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white">{mt.length}</span>
                  {mt.price > 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-400">{mt.price.toLocaleString('cs-CZ')} Kč</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {totalRoutesPrice > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs bg-emerald-500/10 rounded-lg px-2.5 py-2 border border-emerald-500/20">
              <span className="font-extrabold text-emerald-400">Celkem trasy</span>
              <span className="font-extrabold text-emerald-800">{totalRoutesPrice.toLocaleString('cs-CZ')} Kč</span>
            </div>
          )}
        </div>
      )}

      <FittingsPanel
        circuits={circuits}
        cables={cables}
        materials={materials}
        scale={scale}
        onUpdateCircuit={onUpdateCircuit}
      />
    </div>
  );
}
