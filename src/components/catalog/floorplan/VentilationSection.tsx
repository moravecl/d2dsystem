import { useState, useMemo } from 'react';
import { Wind, ChevronDown, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { Room, FloorScale, VentilationMode } from '../../../hooks/useProjectState';
import { polygonAreaM2 } from './geometry';

interface Props {
  rooms: Room[];
  scale?: FloorScale;
  onUpdateRoomVentilation: (roomId: string, updates: {
    ceilingHeight?: number;
    ventilationMode?: VentilationMode;
    airChangesPerHour?: number;
    ductDiameter?: number;
    manualSupplyVents?: number | null;
    manualExhaustVents?: number | null;
  }) => void;
}

const ROOM_TYPE_DEFAULTS: Record<string, { ach: number; mode: VentilationMode }> = {
  'Obývací pokoj': { ach: 0.5, mode: 'supply' },
  'Ložnice': { ach: 0.5, mode: 'supply' },
  'Dětský pokoj': { ach: 0.5, mode: 'supply' },
  'Pracovna': { ach: 0.5, mode: 'supply' },
  'Kuchyně': { ach: 1.0, mode: 'exhaust' },
  'Koupelna': { ach: 1.5, mode: 'exhaust' },
  'WC': { ach: 1.5, mode: 'exhaust' },
  'Technická místnost': { ach: 0.5, mode: 'exhaust' },
  'Šatna': { ach: 0.5, mode: 'exhaust' },
  'Chodba': { ach: 0.3, mode: 'supply' },
  'Předsíň': { ach: 0.3, mode: 'supply' },
  'Sušárna': { ach: 1.0, mode: 'exhaust' },
  'Prádelna': { ach: 1.0, mode: 'exhaust' },
};

const DUCT_OPTIONS = [
  { diameter: 75, capacity: 25, label: 'DN75 (25 m\u00B3/h)' },
  { diameter: 90, capacity: 38, label: 'DN90 (38 m\u00B3/h)' },
];

const UNIT_SIZES = [
  { maxFlow: 100, label: '150', nominal: 150 },
  { maxFlow: 200, label: '250', nominal: 250 },
  { maxFlow: 300, label: '350', nominal: 350 },
  { maxFlow: 450, label: '500', nominal: 500 },
  { maxFlow: 600, label: '600', nominal: 600 },
];

function getRecommendedUnit(totalFlow: number) {
  for (const unit of UNIT_SIZES) {
    if (totalFlow <= unit.maxFlow) return unit;
  }
  return UNIT_SIZES[UNIT_SIZES.length - 1];
}

function getVentModeLabel(mode: VentilationMode) {
  switch (mode) {
    case 'supply': return 'Přívod';
    case 'exhaust': return 'Odvod';
    case 'both': return 'Přívod + Odvod';
  }
}

function getVentModeColor(mode: VentilationMode) {
  switch (mode) {
    case 'supply': return 'text-blue-400 bg-blue-500/10';
    case 'exhaust': return 'text-amber-400 bg-amber-500/10';
    case 'both': return 'text-emerald-400 bg-emerald-500/10';
  }
}

interface RoomCalc {
  room: Room;
  areaM2: number;
  volume: number;
  airFlow: number;
  autoVentCount: number;
  supplyVents: number;
  exhaustVents: number;
  ductCapacity: number;
}

export default function VentilationSection({ rooms, scale, onUpdateRoomVentilation }: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id ?? '');

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const roomCalculations = useMemo(() => {
    if (!scale) return [];
    return rooms.map((room): RoomCalc => {
      const areaM2 = polygonAreaM2(room.points, scale);
      const height = room.ceilingHeight ?? 2.6;
      const ach = room.airChangesPerHour ?? 0.5;
      const volume = areaM2 * height;
      const airFlow = volume * ach;
      const ductDiam = room.ductDiameter ?? 75;
      const ductCapacity = DUCT_OPTIONS.find((d) => d.diameter === ductDiam)?.capacity ?? 25;
      const autoVentCount = Math.ceil(airFlow / ductCapacity);
      const mode = room.ventilationMode ?? 'supply';
      const supplyVents = room.manualSupplyVents ?? (mode === 'supply' || mode === 'both' ? autoVentCount : 0);
      const exhaustVents = room.manualExhaustVents ?? (mode === 'exhaust' || mode === 'both' ? autoVentCount : 0);
      return { room, areaM2, volume, airFlow, autoVentCount, supplyVents, exhaustVents, ductCapacity };
    });
  }, [rooms, scale]);

  const summary = useMemo(() => {
    let totalSupply = 0;
    let totalExhaust = 0;
    let totalSupplyVents = 0;
    let totalExhaustVents = 0;

    for (const calc of roomCalculations) {
      const mode = calc.room.ventilationMode ?? 'supply';
      if (mode === 'supply' || mode === 'both') totalSupply += calc.airFlow;
      if (mode === 'exhaust' || mode === 'both') totalExhaust += calc.airFlow;
      totalSupplyVents += calc.supplyVents;
      totalExhaustVents += calc.exhaustVents;
    }

    const totalVents = totalSupplyVents + totalExhaustVents;
    const maxFlow = Math.max(totalSupply, totalExhaust);
    const recommended = getRecommendedUnit(maxFlow);
    const balance = totalSupply > 0 && totalExhaust > 0
      ? Math.min(totalSupply, totalExhaust) / Math.max(totalSupply, totalExhaust)
      : 0;

    return { totalSupply, totalExhaust, totalVents, totalSupplyVents, totalExhaustVents, maxFlow, recommended, balance };
  }, [roomCalculations]);

  const currentCalc = roomCalculations.find((c) => c.room.id === selectedRoomId);
  const currentArea = currentCalc?.areaM2 ?? 0;
  const currentHeight = selectedRoom?.ceilingHeight ?? 2.6;
  const currentAch = selectedRoom?.airChangesPerHour ?? 0.5;
  const currentMode = selectedRoom?.ventilationMode ?? 'supply';
  const currentDuct = selectedRoom?.ductDiameter ?? 75;

  const handleApplyPreset = (roomType: string) => {
    if (!selectedRoom) return;
    const preset = ROOM_TYPE_DEFAULTS[roomType];
    if (!preset) return;
    onUpdateRoomVentilation(selectedRoom.id, {
      airChangesPerHour: preset.ach,
      ventilationMode: preset.mode,
    });
  };

  return (
    <div className="overflow-auto">
      {rooms.length > 0 && scale && roomCalculations.length > 0 && (
        <div className="p-4 border-b border-white/10 bg-gradient-to-br from-slate-50 to-white">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <Wind className="w-3.5 h-3.5" />
            Souhrn rekuperace
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5">
              <div className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider">Přívod</div>
              <div className="text-lg font-extrabold text-blue-400">{Math.round(summary.totalSupply)} <span className="text-xs font-bold">m3/h</span></div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
              <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Odvod</div>
              <div className="text-lg font-extrabold text-amber-400">{Math.round(summary.totalExhaust)} <span className="text-xs font-bold">m3/h</span></div>
            </div>
          </div>

          {summary.totalSupply > 0 && summary.totalExhaust > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] font-extrabold mb-1">
                <span className="text-slate-500">Bilance přívod/odvod</span>
                <span className={summary.balance >= 0.85 ? 'text-emerald-400' : summary.balance >= 0.7 ? 'text-amber-400' : 'text-red-400'}>
                  {Math.round(summary.balance * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    summary.balance >= 0.85 ? 'bg-emerald-500' : summary.balance >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.round(summary.balance * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className={`rounded-xl p-3 border ${
            summary.maxFlow <= summary.recommended.nominal
              ? 'bg-emerald-500/10 border-emerald-200'
              : 'bg-amber-500/10 border-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {summary.maxFlow <= summary.recommended.nominal ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="text-xs font-extrabold text-slate-300">Doporučená jednotka</span>
            </div>
            <div className="flex items-baseline gap-2 ml-6">
              <span className="text-xl font-extrabold text-white">{summary.recommended.label}</span>
              <span className="text-xs font-bold text-slate-500">m3/h</span>
            </div>
            <div className="ml-6 text-[10px] text-slate-500 mt-0.5">
              Potřeba: {Math.round(summary.maxFlow)} m3/h | Přívod: {summary.totalSupplyVents} | Odvod: {summary.totalExhaustVents}
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Wind className="w-3.5 h-3.5" />
          Nastavení místnosti
        </div>

        {rooms.length === 0 && (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-xs text-slate-500">
            Nejprve nakreslete místnosti v režimu "Místnost".
          </div>
        )}

        {!scale && rooms.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-3 text-xs text-amber-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Nastavte měřítko půdorysu pro přesné výpočty.
          </div>
        )}

        {rooms.length > 0 && (
          <>
            <div className="relative mb-4">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-extrabold text-slate-300 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
              >
                {rooms.map((r) => {
                  const calc = roomCalculations.find((c) => c.room.id === r.id);
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name} {calc ? `(${calc.areaM2.toFixed(1)} m2)` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedRoom && scale && (
              <div className="space-y-3">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Přednastavení</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(ROOM_TYPE_DEFAULTS).map(([type, preset]) => (
                      <button
                        key={type}
                        onClick={() => handleApplyPreset(type)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                          selectedRoom.airChangesPerHour === preset.ach && selectedRoom.ventilationMode === preset.mode
                            ? 'bg-emerald-500/20 border-emerald-300 text-emerald-400'
                            : 'bg-white/[0.06] border-white/10 text-slate-400 hover:bg-white/[0.04]'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Výška stropu (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="2.0"
                      max="6.0"
                      value={currentHeight}
                      onChange={(e) => onUpdateRoomVentilation(selectedRoom.id, { ceilingHeight: parseFloat(e.target.value) || 2.6 })}
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Výměna (x/h)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={currentAch}
                      onChange={(e) => onUpdateRoomVentilation(selectedRoom.id, { airChangesPerHour: parseFloat(e.target.value) || 0.5 })}
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Typ větrání</label>
                  <div className="flex gap-1.5">
                    {(['supply', 'exhaust', 'both'] as VentilationMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onUpdateRoomVentilation(selectedRoom.id, { ventilationMode: mode })}
                        className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold border transition ${
                          currentMode === mode
                            ? getVentModeColor(mode) + ' border-current'
                            : 'bg-white/[0.06] border-white/10 text-slate-500 hover:bg-white/[0.04]'
                        }`}
                      >
                        {getVentModeLabel(mode)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Průměr potrubí</label>
                  <div className="flex gap-1.5">
                    {DUCT_OPTIONS.map((opt) => (
                      <button
                        key={opt.diameter}
                        onClick={() => onUpdateRoomVentilation(selectedRoom.id, { ductDiameter: opt.diameter })}
                        className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold border transition ${
                          currentDuct === opt.diameter
                            ? 'bg-emerald-500/10 border-emerald-300 text-emerald-400'
                            : 'bg-white/[0.06] border-white/10 text-slate-500 hover:bg-white/[0.04]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {currentCalc && (
                  <div className="bg-navy-800/60 border border-white/[0.08] rounded-xl overflow-hidden">
                    <div className="bg-white/[0.04] px-3 py-2 border-b border-white/10">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Výpočet</span>
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-slate-500">Plocha</span>
                        <span className="text-xs font-extrabold text-slate-300">{currentArea.toFixed(1)} m2</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-slate-500">Objem</span>
                        <span className="text-xs font-extrabold text-slate-300">{currentCalc.volume.toFixed(1)} m3</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10">
                        <span className="text-xs font-bold text-emerald-400">Průtok vzduchu</span>
                        <span className="text-sm font-extrabold text-emerald-400">{Math.round(currentCalc.airFlow)} m3/h</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-slate-500">Dopor. výustek (auto)</span>
                        <span className="text-xs font-extrabold text-slate-300">{currentCalc.autoVentCount}</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentCalc && (
                  <div className="bg-navy-800/60 border border-white/[0.08] rounded-xl overflow-hidden">
                    <div className="bg-white/[0.04] px-3 py-2 border-b border-white/10">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Počet výustek</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {(currentMode === 'supply' || currentMode === 'both') && (
                        <div>
                          <label className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider block mb-1">
                            Přívod (ks)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={currentCalc.supplyVents}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                onUpdateRoomVentilation(selectedRoom!.id, {
                                  manualSupplyVents: isNaN(val) || val < 0 ? null : val,
                                });
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-500/10 text-sm font-extrabold text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            {selectedRoom!.manualSupplyVents != null && (
                              <button
                                onClick={() => onUpdateRoomVentilation(selectedRoom!.id, { manualSupplyVents: null })}
                                className="text-[9px] font-extrabold text-blue-500 hover:text-blue-400 whitespace-nowrap px-2 py-1 rounded-lg hover:bg-blue-500/10 transition"
                              >
                                Auto
                              </button>
                            )}
                          </div>
                          {selectedRoom!.manualSupplyVents != null && (
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              Doporučeno: {currentCalc.autoVentCount}
                            </div>
                          )}
                        </div>
                      )}
                      {(currentMode === 'exhaust' || currentMode === 'both') && (
                        <div>
                          <label className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block mb-1">
                            Odvod (ks)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={currentCalc.exhaustVents}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                onUpdateRoomVentilation(selectedRoom!.id, {
                                  manualExhaustVents: isNaN(val) || val < 0 ? null : val,
                                });
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-500/10 text-sm font-extrabold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                            {selectedRoom!.manualExhaustVents != null && (
                              <button
                                onClick={() => onUpdateRoomVentilation(selectedRoom!.id, { manualExhaustVents: null })}
                                className="text-[9px] font-extrabold text-amber-500 hover:text-amber-400 whitespace-nowrap px-2 py-1 rounded-lg hover:bg-amber-500/10 transition"
                              >
                                Auto
                              </button>
                            )}
                          </div>
                          {selectedRoom!.manualExhaustVents != null && (
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              Doporučeno: {currentCalc.autoVentCount}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900">
                      <span className="text-xs font-bold text-white">Celkem výustek</span>
                      <span className="text-lg font-extrabold text-white">{currentCalc.supplyVents + currentCalc.exhaustVents}</span>
                    </div>
                  </div>
                )}

                <div className={`rounded-xl px-3 py-2 text-[10px] font-bold flex items-center gap-1.5 ${getVentModeColor(currentMode)}`}>
                  <Wind className="w-3 h-3" />
                  {getVentModeLabel(currentMode)}: {currentCalc ? Math.round(currentCalc.airFlow) : 0} m3/h
                  {currentCalc && (currentMode === 'supply' || currentMode === 'both') && `, ${currentCalc.supplyVents} přívod`}
                  {currentCalc && (currentMode === 'exhaust' || currentMode === 'both') && `, ${currentCalc.exhaustVents} odvod`}
                </div>
              </div>
            )}

            {rooms.length > 0 && scale && roomCalculations.length > 1 && (
              <div className="mt-4">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Přehled všech místností</div>
                <div className="space-y-1">
                  {roomCalculations.map((calc) => {
                    const mode = calc.room.ventilationMode ?? 'supply';
                    return (
                      <button
                        key={calc.room.id}
                        onClick={() => setSelectedRoomId(calc.room.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition ${
                          selectedRoomId === calc.room.id
                            ? 'bg-emerald-500/10 border-emerald-200'
                            : 'bg-white/[0.06] border-white/[0.06] hover:bg-white/[0.04]'
                        }`}
                      >
                        <Wind className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-xs font-extrabold text-slate-300 flex-1 truncate">{calc.room.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getVentModeColor(mode)}`}>
                          {getVentModeLabel(mode)}
                        </span>
                        {calc.supplyVents > 0 && <span className="text-[10px] font-extrabold text-blue-400">{calc.supplyVents}P</span>}
                        {calc.exhaustVents > 0 && <span className="text-[10px] font-extrabold text-amber-400">{calc.exhaustVents}O</span>}
                        <span className="text-[10px] font-extrabold text-emerald-400">{Math.round(calc.airFlow)} m3/h</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
