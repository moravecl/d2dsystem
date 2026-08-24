import { useRef } from 'react';
import { Trash2, MapPin, Star } from 'lucide-react';
import type { PinData } from './pinUtils';
import type { Room, Circuit, ProjectState } from '../../../hooks/useProjectState';
import type { MaterialSettingsState } from '../../../hooks/useMaterialSettings';
import { describeConfig } from './pinUtils';
import { renderPinIcon } from './iconLibrary';

interface Props {
  floorPins: PinData[];
  rooms: Room[];
  circuits: Circuit[];
  activePinId: string | null;
  floorName: string;
  project: ProjectState;
  materialSettings: MaterialSettingsState;
  onSetActivePinId: (id: string | null) => void;
  onOpenIconPicker: (pin: PinData) => void;
}

export default function FloorplanLegend({
  floorPins,
  rooms,
  circuits,
  activePinId,
  floorName,
  project,
  materialSettings,
  onSetActivePinId,
  onOpenIconPicker,
}: Props) {
  const pinRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleSetDefaultIcon = (pin: PinData) => {
    materialSettings.setDefaultIcon(pin.productId, pin.placement.icon);
  };

  return (
    <div className="p-4 flex-1">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5" />
        Legenda – {floorName}
        {floorPins.length > 0 && (
          <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{floorPins.length}</span>
        )}
      </div>
      {floorPins.length === 0 ? (
        <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/[0.06] text-center">
          <div className="text-sm font-extrabold text-white">Zatím žádné piny</div>
          <div className="text-xs text-slate-500 mt-1">Výběr produkt a klikni na půdorys.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {floorPins.map((pin) => {
            const cfgDesc = describeConfig(pin.placement.config);
            const isActive = activePinId === pin.placement.id;
            const isDefaultIcon = materialSettings.defaultIcons[pin.productId] === pin.placement.icon && !!pin.placement.icon;
            const pinCircuit = pin.placement.circuitId ? circuits.find((c) => c.id === pin.placement.circuitId) : null;
            const roomName = pin.placement.room ? rooms.find(r => r.id === pin.placement.room)?.name ?? pin.placement.room : undefined;
            return (
              <div
                key={pin.placement.id}
                ref={(el) => { if (el) pinRefs.current.set(pin.placement.id, el); else pinRefs.current.delete(pin.placement.id); }}
                onClick={() => onSetActivePinId(pin.placement.id)}
                className={`rounded-xl border transition cursor-pointer ${
                  isActive ? 'border-blue-400 bg-blue-500/10 ' : 'border-white/[0.06] hover:border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenIconPicker(pin); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow transition hover:ring-blue-500/20"
                    style={{ backgroundColor: pinCircuit?.color ?? '#1e293b' }}
                    aria-label={`Změnit ikonu pro ${pin.label}`}
                  >
                    {pin.placement.icon ? renderPinIcon(pin.placement.icon, 13) : (
                      <MapPin className="w-3 h-3 text-white" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-white">{pin.label}</span>
                      <span className="text-[9px] text-slate-400 truncate">{pin.product.name}</span>
                      {pin.placement.icon && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetDefaultIcon(pin); }}
                          aria-label={isDefaultIcon ? 'Výchozí ikona nastavena' : 'Nastavit jako výchozí'}
                          className={`shrink-0 ${isDefaultIcon ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                        >
                          <Star className="w-2.5 h-2.5" fill={isDefaultIcon ? 'currentColor' : 'none'} />
                        </button>
                      )}
                    </div>
                    {(roomName || cfgDesc || pin.placement.config?.colorName || pin.placement.colorName) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {roomName && (
                          <span className="text-[9px] font-extrabold text-teal-600 bg-teal-500/10 px-1 py-px rounded">{roomName}</span>
                        )}
                        {cfgDesc && (
                          <span className="text-[9px] text-slate-500">{cfgDesc}</span>
                        )}
                        {(pin.placement.config?.colorName || pin.placement.colorName) && (
                          <span className="flex items-center gap-0.5">
                            <span className="w-2 h-2 rounded-full border border-slate-300" style={{ backgroundColor: pin.placement.config?.colorHex ?? pin.placement.colorHex ?? '#ccc' }} />
                            <span className="text-[9px] text-slate-500">{pin.placement.config?.colorName ?? pin.placement.colorName}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); project.removePlacement(pin.productId, pin.placement.id); }}
                    aria-label={`Smazat ${pin.label}`}
                    className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-500/10 transition shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {isActive && (
                  <div className="px-2.5 pb-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="sr-only" htmlFor={`note-${pin.placement.id}`}>Poznámka</label>
                      <input
                        id={`note-${pin.placement.id}`}
                        value={pin.placement.note}
                        onChange={(e) => project.updatePlacementNote(pin.productId, pin.placement.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.06] text-[10px] font-semibold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                        placeholder="Poznámka..."
                      />
                      <label className="sr-only" htmlFor={`height-${pin.placement.id}`}>Výška montáže</label>
                      <input
                        id={`height-${pin.placement.id}`}
                        value={pin.placement.mountingHeight ?? ''}
                        onChange={(e) => project.updatePlacementMountingHeight(pin.productId, pin.placement.id, e.target.value || undefined)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.06] text-[10px] font-semibold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                        placeholder="Výška..."
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="sr-only" htmlFor={`circuit-${pin.placement.id}`}>Okruh</label>
                      <select
                        id={`circuit-${pin.placement.id}`}
                        value={pin.placement.circuitId ?? ''}
                        onChange={(e) => {
                          project.updatePlacementCircuit(pin.productId, pin.placement.id, e.target.value || undefined);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.06] text-[10px] font-extrabold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                      >
                        <option value="">-- Okruh --</option>
                        {circuits.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
