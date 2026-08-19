import { useState } from 'react';
import { Wrench, Plus, Trash2, Check, X, Pencil, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { Circuit, Cable as CableType, FloorScale, CircuitType, FittingOverride } from '../../../hooks/useProjectState';
import type { Material } from '../../../types/database';
import { analyzeBends, countTPieces, polylineLength, normalizedToMeters } from './geometry';
import { CIRCUIT_TYPE_LABELS } from './materialLibrary';

const CALC_RULE_LABELS: Record<string, string> = {
  per_bend: 'za ohyb',
  per_tee: 'za T-kus',
  per_endpoint: 'za koncovku',
  per_10m: 'za 10 m',
};

interface TradeStats {
  totalBends: number;
  totalTees: number;
  totalEndpoints: number;
  totalMeters: number;
}

function computeTradeStats(cables: CableType[], circuits: Circuit[], scale?: FloorScale): Record<string, TradeStats> {
  const stats: Record<string, TradeStats> = {};
  const cablesByTrade: Record<string, CableType[]> = {};

  for (const cable of cables) {
    const circuit = circuits.find((c) => c.id === cable.circuitId);
    const trade = circuit?.type ?? 'electric';
    if (!cablesByTrade[trade]) cablesByTrade[trade] = [];
    cablesByTrade[trade].push(cable);
  }

  for (const [trade, tradeCables] of Object.entries(cablesByTrade)) {
    if (!stats[trade]) stats[trade] = { totalBends: 0, totalTees: 0, totalEndpoints: 0, totalMeters: 0 };
    const s = stats[trade];

    for (const cable of tradeCables) {
      s.totalBends += analyzeBends(cable.points).length;
      if (cable.points.length >= 2) s.totalEndpoints += 2;
      const len = polylineLength(cable.points);
      s.totalMeters += scale ? normalizedToMeters(len, scale) : 0;
    }

    s.totalTees += countTPieces(tradeCables);
  }

  return stats;
}

interface ComputedFitting {
  materialId: string;
  name: string;
  unit: string;
  trade: CircuitType;
  calcRule: string;
  baseQty: number;
  quantity: number;
  correction: number;
  pricePerUnit: number;
}

function computeAutoFittings(
  materials: Material[],
  tradeStats: Record<string, TradeStats>,
  corrections: Record<string, number>,
): ComputedFitting[] {
  const fittingMaterials = materials.filter(m => m.material_type === 'fitting' && m.is_active && m.fitting_calc_rule);
  const results: ComputedFitting[] = [];

  for (const mat of fittingMaterials) {
    const stats = tradeStats[mat.trade];
    if (!stats) continue;

    let baseQty = 0;
    switch (mat.fitting_calc_rule) {
      case 'per_bend': baseQty = stats.totalBends; break;
      case 'per_tee': baseQty = stats.totalTees; break;
      case 'per_endpoint': baseQty = stats.totalEndpoints; break;
      case 'per_10m': baseQty = Math.ceil(stats.totalMeters / 10); break;
    }

    if (baseQty <= 0 && !(mat.id in corrections)) continue;

    const corr = corrections[mat.id] ?? 0;
    const finalQty = Math.max(0, baseQty + corr);

    if (finalQty <= 0 && baseQty <= 0) continue;

    results.push({
      materialId: mat.id,
      name: mat.name,
      unit: mat.unit,
      trade: mat.trade,
      calcRule: mat.fitting_calc_rule!,
      baseQty,
      quantity: finalQty,
      correction: corr,
      pricePerUnit: mat.price_per_unit,
    });
  }

  return results;
}

function mergeCorrections(circuits: Circuit[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const c of circuits) {
    for (const [matId, delta] of Object.entries(c.fittingCorrections ?? {})) {
      merged[matId] = (merged[matId] ?? 0) + delta;
    }
  }
  return merged;
}

interface Props {
  circuits: Circuit[];
  cables: CableType[];
  materials: Material[];
  scale?: FloorScale;
  onUpdateCircuit: (circuitId: string, updates: Partial<Omit<Circuit, 'id'>>) => void;
}

export default function FittingsPanel({ circuits, cables, materials, scale, onUpdateCircuit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAutoId, setEditingAutoId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState(0);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);
  const [newUnit, setNewUnit] = useState('ks');

  const tradeStats = computeTradeStats(cables, circuits, scale);
  const allCorrections = mergeCorrections(circuits);
  const autoFittings = computeAutoFittings(materials, tradeStats, allCorrections);

  const allOverrides = circuits.flatMap((c) =>
    (c.fittingOverrides ?? []).map((fo) => ({ ...fo, circuitId: c.id, circuitName: c.name, trade: c.type }))
  );

  const autoTotal = autoFittings.reduce((s, f) => s + f.quantity * f.pricePerUnit, 0);
  const manualTotal = allOverrides.reduce((s, f) => s + f.quantity * f.pricePerUnit, 0);
  const totalPrice = autoTotal + manualTotal;
  const totalItems = autoFittings.length + allOverrides.length;

  if (totalItems === 0 && cables.length === 0) return null;

  const groupedAuto: Record<string, ComputedFitting[]> = {};
  for (const f of autoFittings) {
    if (!groupedAuto[f.trade]) groupedAuto[f.trade] = [];
    groupedAuto[f.trade].push(f);
  }

  const findCorrectionOwner = (materialId: string): string | null => {
    for (const c of circuits) {
      if (c.fittingCorrections && materialId in c.fittingCorrections) return c.id;
    }
    return circuits[0]?.id ?? null;
  };

  const handleSetAutoQty = (materialId: string, baseQty: number, newTotal: number) => {
    const delta = newTotal - baseQty;
    const existingOwner = findCorrectionOwner(materialId);
    const targetCircuitId = existingOwner ?? circuits[0]?.id;
    if (!targetCircuitId) return;

    const circuit = circuits.find((c) => c.id === targetCircuitId);
    if (!circuit) return;

    const prev = { ...(circuit.fittingCorrections ?? {}) };
    if (delta === 0) {
      delete prev[materialId];
    } else {
      prev[materialId] = delta;
    }

    onUpdateCircuit(targetCircuitId, { fittingCorrections: prev });
    setEditingAutoId(null);
  };

  const handleResetAutoQty = (materialId: string) => {
    for (const c of circuits) {
      if (c.fittingCorrections && materialId in c.fittingCorrections) {
        const prev = { ...(c.fittingCorrections ?? {}) };
        delete prev[materialId];
        onUpdateCircuit(c.id, { fittingCorrections: prev });
      }
    }
  };

  const handleAddOverride = (circuitId: string) => {
    if (!newName.trim()) return;
    const circuit = circuits.find((c) => c.id === circuitId);
    if (!circuit) return;
    const override: FittingOverride = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      unit: newUnit,
      quantity: newQty,
      pricePerUnit: newPrice,
    };
    onUpdateCircuit(circuitId, {
      fittingOverrides: [...(circuit.fittingOverrides ?? []), override],
    });
    setAddingFor(null);
    setNewName('');
    setNewQty(1);
    setNewPrice(0);
    setNewUnit('ks');
  };

  const handleRemoveOverride = (circuitId: string, overrideId: string) => {
    const circuit = circuits.find((c) => c.id === circuitId);
    if (!circuit) return;
    onUpdateCircuit(circuitId, {
      fittingOverrides: (circuit.fittingOverrides ?? []).filter((f) => f.id !== overrideId),
    });
  };

  const handleUpdateOverrideQty = (circuitId: string, overrideId: string, quantity: number) => {
    const circuit = circuits.find((c) => c.id === circuitId);
    if (!circuit) return;
    onUpdateCircuit(circuitId, {
      fittingOverrides: (circuit.fittingOverrides ?? []).map((f) =>
        f.id === overrideId ? { ...f, quantity } : f
      ),
    });
    setEditingId(null);
  };

  const statsEntries = Object.entries(tradeStats);

  return (
    <div className="mt-4 pt-3 border-t border-white/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Wrench className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex-1">
          Tvarovky a prislusenstvi
        </span>
        {totalItems > 0 && (
          <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
            {totalItems}
          </span>
        )}
        {totalPrice > 0 && (
          <span className="text-[10px] font-extrabold text-emerald-400">
            {Math.round(totalPrice).toLocaleString('cs-CZ')} Kc
          </span>
        )}
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {statsEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {statsEntries.map(([trade, s]) => {
                const info = CIRCUIT_TYPE_LABELS[trade as CircuitType];
                return (
                  <div key={trade} className="bg-white/[0.04] rounded-lg p-2 border border-white/[0.06]">
                    <div className="text-[10px] font-extrabold mb-1" style={{ color: info?.color }}>{info?.label}</div>
                    <div className="space-y-0.5 text-[10px] text-slate-400">
                      {s.totalBends > 0 && <div>Ohyby: <span className="text-white font-extrabold">{s.totalBends}</span></div>}
                      {s.totalTees > 0 && <div>T-kusy: <span className="text-white font-extrabold">{s.totalTees}</span></div>}
                      {s.totalEndpoints > 0 && <div>Koncovky: <span className="text-white font-extrabold">{s.totalEndpoints}</span></div>}
                      {s.totalMeters > 0 && <div>Metry: <span className="text-white font-extrabold">{s.totalMeters.toFixed(1)}</span></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {autoFittings.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Vypoctene</div>
              <div className="space-y-1">
                {Object.entries(groupedAuto).map(([trade, items]) => {
                  const info = CIRCUIT_TYPE_LABELS[trade as CircuitType];
                  return items.map((f) => {
                    const isEditing = editingAutoId === f.materialId;
                    const hasCorrection = f.correction !== 0;
                    return (
                      <div
                        key={f.materialId}
                        className={`flex items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 border ${
                          hasCorrection
                            ? 'bg-blue-500/5 border-blue-500/15'
                            : 'bg-white/[0.04] border-white/[0.06]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: info?.color }} />
                        <span className="flex-1 font-extrabold text-slate-300 truncate">{f.name}</span>
                        <span className="text-[9px] text-slate-500">{CALC_RULE_LABELS[f.calcRule]}</span>

                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              value={editVal}
                              onChange={(e) => setEditVal(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-14 px-1.5 py-0.5 rounded border border-blue-400 bg-white/[0.06] text-[11px] font-extrabold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSetAutoQty(f.materialId, f.baseQty, editVal); if (e.key === 'Escape') setEditingAutoId(null); }}
                            />
                            <button onClick={() => handleSetAutoQty(f.materialId, f.baseQty, editVal)} className="p-0.5 text-blue-400 hover:text-blue-300 transition">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingAutoId(null)} className="p-0.5 text-slate-500 hover:text-slate-300 transition">
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingAutoId(f.materialId); setEditVal(f.quantity); }}
                              className="flex items-center gap-1 group"
                              title="Upravit pocet"
                            >
                              <span className="font-extrabold text-white group-hover:text-blue-400 transition">{f.quantity} {f.unit}</span>
                              {hasCorrection && (
                                <span className={`text-[9px] font-extrabold ${f.correction > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                  ({f.correction > 0 ? '+' : ''}{f.correction})
                                </span>
                              )}
                              <Pencil className="w-2.5 h-2.5 text-slate-600 group-hover:text-blue-400 transition" />
                            </button>
                            {hasCorrection && (
                              <button
                                onClick={() => handleResetAutoQty(f.materialId)}
                                className="p-0.5 text-slate-600 hover:text-amber-400 transition"
                                title="Obnovit puvodni"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                              </button>
                            )}
                            {f.pricePerUnit > 0 && (
                              <span className="text-[10px] text-emerald-400 font-extrabold">{Math.round(f.quantity * f.pricePerUnit).toLocaleString('cs-CZ')} Kc</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          )}

          {allOverrides.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Rucne pridane</div>
              <div className="space-y-1">
                {allOverrides.map((f) => {
                  const info = CIRCUIT_TYPE_LABELS[f.trade as CircuitType];
                  const isEditing = editingId === f.id;
                  return (
                    <div key={f.id} className="flex items-center gap-2 text-[11px] bg-amber-500/5 rounded-lg px-2.5 py-1.5 border border-amber-500/15">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: info?.color }} />
                      <span className="flex-1 font-extrabold text-slate-300 truncate">{f.name}</span>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            value={editVal}
                            onChange={(e) => setEditVal(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-14 px-1.5 py-0.5 rounded border border-amber-300 bg-white/[0.06] text-[11px] font-extrabold text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateOverrideQty(f.circuitId, f.id, editVal); if (e.key === 'Escape') setEditingId(null); }}
                          />
                          <button onClick={() => handleUpdateOverrideQty(f.circuitId, f.id, editVal)} className="p-0.5 text-amber-400 hover:text-amber-300 transition">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-0.5 text-slate-500 hover:text-slate-300 transition">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(f.id); setEditVal(f.quantity); }}
                            className="flex items-center gap-1 group"
                          >
                            <span className="font-extrabold text-white group-hover:text-amber-400 transition">{f.quantity} {f.unit}</span>
                            <Pencil className="w-2.5 h-2.5 text-slate-600 group-hover:text-amber-400 transition" />
                          </button>
                          {f.pricePerUnit > 0 && (
                            <span className="text-[10px] text-emerald-400 font-extrabold">{Math.round(f.quantity * f.pricePerUnit).toLocaleString('cs-CZ')} Kc</span>
                          )}
                          <button
                            onClick={() => handleRemoveOverride(f.circuitId, f.id)}
                            className="p-0.5 text-slate-500 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {circuits.length > 0 && (
            <div>
              {addingFor ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-extrabold text-amber-400">
                    Pridat tvarovku k: {circuits.find((c) => c.id === addingFor)?.name}
                  </div>
                  <select
                    value={newName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewName(val);
                      if (val !== '__custom') {
                        const mat = materials.find((m) => m.name === val);
                        if (mat) { setNewPrice(mat.price_per_unit); setNewUnit(mat.unit); }
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300/30 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="">-- Vyber tvarovku --</option>
                    {materials
                      .filter((m) => m.material_type === 'fitting' && m.trade === circuits.find((c) => c.id === addingFor)?.type)
                      .map((m) => (
                        <option key={m.id} value={m.name}>{m.name} ({m.price_per_unit} Kc/{m.unit})</option>
                      ))}
                    <option value="__custom">-- Vlastni --</option>
                  </select>
                  {newName === '__custom' && (
                    <input
                      placeholder="Nazev..."
                      onChange={(e) => { if (e.target.value) setNewName(e.target.value); }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300/30 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-500 font-extrabold">Pocet</label>
                      <input
                        type="number"
                        min="1"
                        value={newQty}
                        onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 rounded-lg border border-amber-300/30 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="w-16">
                      <label className="text-[9px] text-slate-500 font-extrabold">Jedn.</label>
                      <input
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-amber-300/30 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-500 font-extrabold">Cena/ks</label>
                      <input
                        type="number"
                        min="0"
                        value={newPrice}
                        onChange={(e) => setNewPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-2 py-1.5 rounded-lg border border-amber-300/30 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddOverride(addingFor)}
                      disabled={!newName.trim() || newName === '__custom'}
                      className="flex-1 bg-amber-600 text-white py-1.5 rounded-lg font-extrabold text-xs hover:bg-amber-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Pridat
                    </button>
                    <button
                      onClick={() => { setAddingFor(null); setNewName(''); }}
                      className="px-3 py-1.5 bg-white/[0.06] border border-white/[0.08] text-slate-400 rounded-lg font-extrabold text-xs hover:bg-white/[0.08] transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {circuits.map((c) => {
                    const info = CIRCUIT_TYPE_LABELS[c.type];
                    return (
                      <button
                        key={c.id}
                        onClick={() => setAddingFor(c.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-extrabold text-slate-400 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info?.color }} />
                        <span>Pridat tvarovku k {c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {totalPrice > 0 && (
            <div className="flex items-center justify-between text-xs bg-amber-500/10 rounded-lg px-2.5 py-2 border border-amber-500/20">
              <span className="font-extrabold text-amber-400">Celkem tvarovky</span>
              <span className="font-extrabold text-amber-300">{Math.round(totalPrice).toLocaleString('cs-CZ')} Kc</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
