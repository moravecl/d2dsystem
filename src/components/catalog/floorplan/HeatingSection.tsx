import { useState } from 'react';
import { Flame, DoorOpen, Plus, Trash2, Thermometer } from 'lucide-react';
import type { Room, FloorScale, RoomDoor } from '../../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../../hooks/useHeatingSystems';
import { calculateHeatingMaterials } from '../../../hooks/useHeatingSystems';
import { polygonAreaM2, polygonPerimeterM } from './geometry';
import RadiatorCalcSection from './RadiatorCalcSection';
import FloorHeatCalcSection from './FloorHeatCalcSection';

interface Props {
  rooms: Room[];
  scale?: FloorScale;
  heatingSystems: HeatingSystemFull[];
  onUpdateRoomHeating: (roomId: string, systemId: string | undefined, config?: Record<string, string>) => void;
  onUpdateRoomHeatingConfig: (roomId: string, key: string, value: string) => void;
  onAddRoomDoor: (roomId: string, door: RoomDoor) => void;
  onRemoveRoomDoor: (roomId: string, doorId: string) => void;
}

export default function HeatingSection({
  rooms,
  scale,
  heatingSystems,
  onUpdateRoomHeating,
  onUpdateRoomHeatingConfig,
  onAddRoomDoor,
  onRemoveRoomDoor,
}: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id ?? '');
  const [newDoorWidth, setNewDoorWidth] = useState('0.8');

  const room = rooms.find((r) => r.id === selectedRoomId);
  const selectedSystem = room ? heatingSystems.find((s) => s.system.id === room.heatingSystemId) : undefined;
  const config = room?.heatingConfig ?? {};
  const hasPipeSpacing = selectedSystem?.options.some((o) => o.slug === 'pipe_spacing') ?? false;
  const isRadiators = selectedSystem?.system.slug === 'radiators';
  const isFloorHeating = selectedSystem?.system.slug === 'wet_underfloor' || selectedSystem?.system.slug === 'dry_underfloor';
  const isDrySystem = selectedSystem?.system.slug === 'dry_underfloor';

  const areaM2 = room && scale ? polygonAreaM2(room.points, scale) : null;
  const perimeterM = room && scale ? polygonPerimeterM(room.points, scale) : null;
  const doorWidthsTotal = room ? (room.doors ?? []).reduce((sum, d) => sum + d.widthM, 0) : 0;
  const effectivePerimeter = perimeterM !== null ? Math.max(0, perimeterM - doorWidthsTotal) : null;

  const materialLines = selectedSystem && areaM2 !== null && effectivePerimeter !== null
    ? calculateHeatingMaterials(selectedSystem, config, areaM2, effectivePerimeter)
    : [];
  const totalPrice = materialLines.reduce((sum, l) => sum + l.totalPrice, 0);

  const handleSystemChange = (systemId: string) => {
    if (!room) return;
    if (!systemId) {
      onUpdateRoomHeating(room.id, undefined);
      return;
    }
    const sys = heatingSystems.find((s) => s.system.id === systemId);
    if (!sys) return;
    const defaults: Record<string, string> = {};
    for (const opt of sys.options) {
      defaults[opt.slug] = opt.default_value;
    }
    if (sys.options.some((o) => o.slug === 'pipe_spacing')) {
      defaults['pipe_pattern'] = 'meandr';
    }
    onUpdateRoomHeating(room.id, systemId, defaults);
  };

  const handleAddDoor = () => {
    if (!room) return;
    const width = parseFloat(newDoorWidth);
    if (isNaN(width) || width <= 0) return;
    onAddRoomDoor(room.id, {
      id: crypto.randomUUID(),
      wallIndex: 0,
      position: 0.5,
      widthM: width,
    });
  };

  if (rooms.length === 0) {
    return (
      <div className="p-4 border-b border-white/10">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Flame className="w-3.5 h-3.5" /> Vytápění
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
          <div className="text-xs font-extrabold text-slate-500">Žádné místnosti</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Nejdřív nakresli místnost v režimu Místnost.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-white/10">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Flame className="w-3.5 h-3.5" /> Vytápění
      </div>

      <select
        value={selectedRoomId}
        onChange={(e) => setSelectedRoomId(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-red-500/20 mb-3"
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      {room && (
        <div className="space-y-3">
          {!scale && (
            <div className="text-[10px] bg-amber-500/10 border border-amber-200 rounded-lg p-2 text-amber-400 font-semibold">
              Nastav měřítko pro výpočet plochy a materiálu.
            </div>
          )}

          {areaM2 !== null && perimeterM !== null && (
            <div className="flex gap-2 flex-wrap text-[10px]">
              <div className="bg-red-500/10 rounded-lg px-2 py-1.5 border border-red-500/20">
                <span className="text-slate-500">Plocha:</span>{' '}
                <span className="font-extrabold text-white">{areaM2.toFixed(1)} m2</span>
              </div>
              <div className="bg-red-500/10 rounded-lg px-2 py-1.5 border border-red-500/20">
                <span className="text-slate-500">Obvod:</span>{' '}
                <span className="font-extrabold text-white">{perimeterM.toFixed(1)} m</span>
              </div>
              {doorWidthsTotal > 0 && (
                <div className="bg-red-500/10 rounded-lg px-2 py-1.5 border border-red-500/20">
                  <span className="text-slate-500">Efekt.:</span>{' '}
                  <span className="font-extrabold text-white">{effectivePerimeter?.toFixed(1)} m</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] font-extrabold text-slate-400 mb-1 block">Typ vytápění</label>
            <select
              value={room.heatingSystemId ?? ''}
              onChange={(e) => handleSystemChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-red-200 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              <option value="">-- Bez vytápění --</option>
              {heatingSystems.filter((s) => s.system.is_active).map((s) => (
                <option key={s.system.id} value={s.system.id}>{s.system.name}</option>
              ))}
            </select>
          </div>

          {selectedSystem && hasPipeSpacing && (
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 mb-0.5 block">Vzor pokladky trubek</label>
              <select
                value={config['pipe_pattern'] ?? 'meandr'}
                onChange={(e) => onUpdateRoomHeatingConfig(room.id, 'pipe_pattern', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-red-200 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="meandr">Meandr (hadovite)</option>
                <option value="spiral">Smycka (spirala)</option>
              </select>
            </div>
          )}

          {selectedSystem && (
            <div className="space-y-2">
              {selectedSystem.options.map((opt) => {
                const val = config[opt.slug] ?? opt.default_value;
                const choices = Array.isArray(opt.options) ? opt.options as { value: string; label: string }[] : [];

                if (opt.field_type === 'boolean') {
                  return (
                    <label key={opt.id} className="flex items-center gap-2 text-[10px] font-extrabold text-slate-300">
                      <input
                        type="checkbox"
                        checked={val === 'true'}
                        onChange={(e) => onUpdateRoomHeatingConfig(room.id, opt.slug, e.target.checked ? 'true' : 'false')}
                        className="rounded"
                      />
                      {opt.name}
                    </label>
                  );
                }

                if (opt.field_type === 'number') {
                  return (
                    <div key={opt.id}>
                      <label className="text-[10px] font-extrabold text-slate-400 mb-0.5 block">{opt.name} {opt.unit && `(${opt.unit})`}</label>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => onUpdateRoomHeatingConfig(room.id, opt.slug, e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500/20"
                      />
                    </div>
                  );
                }

                return (
                  <div key={opt.id}>
                    <label className="text-[10px] font-extrabold text-slate-400 mb-0.5 block">{opt.name}</label>
                    <select
                      value={val}
                      onChange={(e) => onUpdateRoomHeatingConfig(room.id, opt.slug, e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-red-500/20"
                    >
                      {choices.map((ch) => (
                        <option key={ch.value} value={ch.value}>{ch.label}</option>
                      ))}
                    </select>
                    {opt.description && (
                      <div className="text-[9px] text-slate-400 mt-0.5">{opt.description}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isRadiators && room && (
            <RadiatorCalcSection
              room={room}
              scale={scale}
              config={config}
              onUpdateConfig={(key, val) => onUpdateRoomHeatingConfig(room.id, key, val)}
            />
          )}

          {isFloorHeating && room && (
            <FloorHeatCalcSection
              room={room}
              scale={scale}
              config={config}
              onUpdateConfig={(key, val) => onUpdateRoomHeatingConfig(room.id, key, val)}
              isDrySystem={isDrySystem}
            />
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 flex items-center gap-1">
                <DoorOpen className="w-3 h-3" /> Dvere ({(room.doors ?? []).length})
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.4"
                  max="2.0"
                  value={newDoorWidth}
                  onChange={(e) => setNewDoorWidth(e.target.value)}
                  className="w-14 px-1.5 py-1 rounded-md border border-white/10 text-[10px] font-semibold text-center focus:outline-none focus:ring-1 focus:ring-red-500/20"
                />
                <span className="text-[10px] text-slate-400">m</span>
                <button
                  onClick={handleAddDoor}
                  className="p-1 rounded-md bg-white/[0.06] border border-red-200 text-red-400 hover:bg-red-500/10 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            {(room.doors ?? []).length > 0 && (
              <div className="space-y-1">
                {(room.doors ?? []).map((door, idx) => (
                  <div key={door.id} className="flex items-center gap-2 bg-navy-800/60 rounded-lg px-2 py-1 border border-white/[0.06] text-[10px]">
                    <DoorOpen className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="font-extrabold text-slate-300">Dvere {idx + 1}</span>
                    <span className="text-slate-500">{door.widthM} m</span>
                    <button onClick={() => onRemoveRoomDoor(room.id, door.id)} className="ml-auto p-0.5 text-slate-400 hover:text-red-500 transition">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {materialLines.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 mb-1.5 flex items-center gap-1">
                <Thermometer className="w-3 h-3" /> Kalkulace materiálu
              </div>
              <div className="bg-navy-800/60 rounded-lg border border-red-500/20 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-white/[0.04]">
                      <th className="text-left px-2 py-1 font-extrabold text-slate-500">Materiál</th>
                      <th className="text-right px-2 py-1 font-extrabold text-slate-500">Množství</th>
                      <th className="text-right px-2 py-1 font-extrabold text-slate-500">Cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialLines.map((line, idx) => (
                      <tr key={idx} className="border-t border-white/[0.06]">
                        <td className="px-2 py-1 font-semibold text-slate-300">{line.name}</td>
                        <td className="px-2 py-1 text-right font-extrabold">
                          {line.quantity < 10 ? line.quantity.toFixed(1) : Math.ceil(line.quantity)} {line.unit}
                        </td>
                        <td className="px-2 py-1 text-right font-extrabold text-red-400">
                          {line.totalPrice > 0 ? `${Math.round(line.totalPrice).toLocaleString('cs-CZ')} Kč` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/10 bg-red-500/10">
                      <td colSpan={2} className="px-2 py-1.5 font-extrabold text-white text-right">Celkem</td>
                      <td className="px-2 py-1.5 text-right font-extrabold text-red-400">
                        {Math.round(totalPrice).toLocaleString('cs-CZ')} Kč
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
