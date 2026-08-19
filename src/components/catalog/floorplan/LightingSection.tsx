import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { Room, FloorScale } from '../../../hooks/useProjectState';
import type { LightingNorm } from '../../../types/database';
import { polygonAreaM2 } from './geometry';
import { calculateRequiredLumens } from '../../../hooks/useLightingNorms';

interface LightInRoom {
  productName: string;
  lumens: number;
  count: number;
}

interface Props {
  rooms: Room[];
  scale?: FloorScale;
  lightingNorms: LightingNorm[];
  roomLightingData: Record<string, { currentLumens: number; lightsInRoom: LightInRoom[] }>;
  onUpdateRoomLighting: (roomId: string, roomType: string, requiredLux: number) => void;
}

export default function LightingSection({
  rooms,
  scale,
  lightingNorms,
  roomLightingData,
  onUpdateRoomLighting,
}: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id ?? '');

  const room = rooms.find((r) => r.id === selectedRoomId);
  const areaM2 = room && scale ? polygonAreaM2(room.points, scale) : null;
  const data = room ? roomLightingData[room.id] : undefined;
  const currentLumens = data?.currentLumens ?? 0;
  const lightsInRoom = data?.lightsInRoom ?? [];

  if (rooms.length === 0) {
    return (
      <div className="p-4 border-b border-white/10">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5" /> Osvětlení
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
        <Lightbulb className="w-3.5 h-3.5" /> Osvětlení
      </div>

      <select
        value={selectedRoomId}
        onChange={(e) => setSelectedRoomId(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20 mb-3"
      >
        {rooms.map((r) => {
          const rd = roomLightingData[r.id];
          const hasLighting = r.requiredLux && r.requiredLux > 0;
          const suffix = hasLighting ? (rd && rd.currentLumens > 0 ? ' (nastaveno)' : ' (lux zadaný)') : '';
          return (
            <option key={r.id} value={r.id}>{r.name}{suffix}</option>
          );
        })}
      </select>

      {room && (
        <div className="space-y-3">
          {areaM2 !== null && (
            <div className="flex gap-2 text-[10px]">
              <div className="bg-amber-500/10 rounded-lg px-2 py-1.5 border border-amber-500/20">
                <span className="text-slate-500">Plocha:</span>{' '}
                <span className="font-extrabold text-white">{areaM2.toFixed(1)} m2</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-extrabold text-slate-400 mb-0.5 block">Typ místnosti</label>
            <select
              value={room.roomType ?? ''}
              onChange={(e) => {
                const norm = lightingNorms.find((n) => n.room_type === e.target.value);
                onUpdateRoomLighting(room.id, e.target.value, norm?.required_lux ?? 150);
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-amber-200 bg-white/[0.06] text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">-- Vyberte typ --</option>
              {lightingNorms.map((n) => (
                <option key={n.id} value={n.room_type}>{n.room_type} ({n.required_lux} lx)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-extrabold text-slate-400 mb-0.5 block">Požadovaný lux</label>
            <input
              type="number"
              value={room.requiredLux ?? 0}
              onChange={(e) => onUpdateRoomLighting(room.id, room.roomType ?? '', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded-lg border border-amber-200 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {areaM2 !== null && room.requiredLux && room.requiredLux > 0 && (() => {
            const totalRequired = calculateRequiredLumens(room.requiredLux, areaM2);
            const deficit = totalRequired - currentLumens;
            const pct = totalRequired > 0 ? Math.round((currentLumens / totalRequired) * 100) : 0;
            const isOk = deficit <= 0;
            const isPartial = currentLumens > 0 && deficit > 0;
            return (
              <div className="space-y-2">
                <div className="bg-navy-800/60 rounded-lg border border-amber-500/20 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Požadováno:</span>
                    <span className="font-extrabold text-amber-800">
                      {totalRequired.toLocaleString('cs-CZ')} lm
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Aktuálně umístěno:</span>
                    <span className={`font-extrabold ${isOk ? 'text-emerald-400' : isPartial ? 'text-amber-400' : 'text-slate-400'}`}>
                      {currentLumens.toLocaleString('cs-CZ')} lm
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOk ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-white/[0.08]'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-extrabold ${isOk ? 'text-emerald-400' : 'text-red-500'}`}>
                      {isOk ? 'Splněno' : `Chybí ${deficit.toLocaleString('cs-CZ')} lm`}
                    </span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                </div>
                {lightsInRoom.length > 0 && (
                  <div className="bg-navy-800/60 rounded-lg border border-amber-500/20 overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-amber-500/10">
                          <th className="text-left px-2 py-1 font-extrabold text-slate-500">Světlo</th>
                          <th className="text-right px-2 py-1 font-extrabold text-slate-500">ks</th>
                          <th className="text-right px-2 py-1 font-extrabold text-slate-500">Lumeny</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lightsInRoom.map((l, idx) => (
                          <tr key={idx} className="border-t border-white/[0.06]">
                            <td className="px-2 py-1 font-semibold text-slate-300 truncate max-w-[120px]">{l.productName}</td>
                            <td className="px-2 py-1 text-right font-extrabold">{l.count}</td>
                            <td className="px-2 py-1 text-right font-extrabold text-amber-400">{(l.lumens * l.count).toLocaleString('cs-CZ')} lm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
