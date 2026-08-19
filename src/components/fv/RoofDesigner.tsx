import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Compass, Wrench } from 'lucide-react';
import type { RoofSurface } from '../../lib/fvCalculations';
import type { FvPanel, FvRoofTile, FvHook, FvRailProfile, FvClamp } from '../../hooks/useFvCatalog';
import FvPanelPicker from './FvPanelPicker';
import RoofCanvas from './RoofCanvas';

interface Props {
  roofs: RoofSurface[];
  panels: FvPanel[];
  roofTiles?: FvRoofTile[];
  hooks?: FvHook[];
  railProfiles?: FvRailProfile[];
  clamps?: FvClamp[];
  onChange: (roofs: RoofSurface[]) => void;
  onSnapshotChange?: (roofId: string, dataUrl: string) => void;
}

const AZIMUTH_PRESETS = [
  { label: 'J (0°)', value: 0 },
  { label: 'JV (-45°)', value: -45 },
  { label: 'JZ (45°)', value: 45 },
  { label: 'V (-90°)', value: -90 },
  { label: 'Z (90°)', value: 90 },
  { label: 'S (180°)', value: 180 },
];

function createDefaultRoof(idx: number): RoofSurface {
  return {
    id: crypto.randomUUID(),
    name: `Střecha ${idx + 1}`,
    azimuthDeg: 0,
    tiltDeg: 30,
    panelCount: 0,
    panelPowerWp: 400,
    panelWidthMm: 1134,
    panelHeightMm: 1762,
    points: [],
  };
}

const TILE_TYPE_LABELS: Record<string, string> = {
  tiled: 'Tašková', metal_sheet: 'Plechová', bitumen: 'Bitumenová',
  flat: 'Plochá', trapezoid: 'Trapézový plech', other: 'Jiná',
};

export default function RoofDesigner({ roofs, panels, roofTiles = [], hooks = [], railProfiles = [], clamps = [], onChange, onSnapshotChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(roofs[0]?.id ?? null);

  const updateRoof = (id: string, updates: Partial<RoofSurface>) => {
    onChange(roofs.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addRoof = () => {
    const r = createDefaultRoof(roofs.length);
    if (panels.length > 0) {
      r.panelId = panels[0].id;
      r.panelPowerWp = panels[0].power_wp;
      r.panelWidthMm = panels[0].width_mm;
      r.panelHeightMm = panels[0].height_mm;
    }
    onChange([...roofs, r]);
    setExpandedId(r.id);
  };

  const removeRoof = (id: string) => {
    onChange(roofs.filter(r => r.id !== id));
    if (expandedId === id) setExpandedId(roofs.find(r => r.id !== id)?.id ?? null);
  };

  const totalPanels = roofs.reduce((s, r) => s + r.panelCount, 0);
  const totalKwp = roofs.reduce((s, r) => s + (r.panelCount * r.panelPowerWp) / 1000, 0);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          Střešní plochy
        </div>
        <div className="text-[10px] font-extrabold text-orange-600 bg-orange-500/10 rounded-lg px-2 py-1">
          {totalPanels} panelů · {Math.round(totalKwp * 100) / 100} kWp
        </div>
      </div>

      {roofs.length === 0 && (
        <div className="bg-white/[0.04] border border-dashed border-white/10 rounded-xl p-4 text-center text-xs text-slate-400 font-extrabold">
          Přidejte první střešní plochu
        </div>
      )}

      {roofs.map((roof, idx) => {
        const isExpanded = expandedId === roof.id;
        const selectedPanel = panels.find(p => p.id === roof.panelId) ?? null;
        const roofKwp = Math.round((roof.panelCount * roof.panelPowerWp) / 1000 * 100) / 100;

        return (
          <div key={roof.id} className="border border-white/10 rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition"
              onClick={() => setExpandedId(isExpanded ? null : roof.id)}
            >
              <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 text-[10px] font-extrabold text-orange-600">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-white truncate">{roof.name}</div>
                <div className="text-[10px] font-extrabold text-slate-400">
                  {roof.panelCount} panelů · {roofKwp} kWp · {roof.azimuthDeg >= 0 ? `${roof.azimuthDeg}°Z` : `${Math.abs(roof.azimuthDeg)}°V`} · sklon {roof.tiltDeg}°
                </div>
              </div>
              {roofs.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); removeRoof(roof.id); }}
                  className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </div>

            {isExpanded && (
              <div className="p-3 bg-white/[0.04] border-t border-white/[0.06] space-y-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Název střechy</label>
                  <input
                    className="w-full mt-0.5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
                    value={roof.name}
                    onChange={e => updateRoof(roof.id, { name: e.target.value })}
                  />
                </div>

                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                    <Compass className="w-3 h-3" /> Azimut (orientace)
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-1.5">
                    {AZIMUTH_PRESETS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => updateRoof(roof.id, { azimuthDeg: p.value })}
                        className={`px-1.5 py-1.5 rounded-lg text-[10px] font-extrabold transition border ${
                          roof.azimuthDeg === p.value
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white/[0.06] text-slate-400 border-white/10 hover:border-orange-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="5"
                      value={roof.azimuthDeg}
                      onChange={e => updateRoof(roof.id, { azimuthDeg: parseInt(e.target.value) })}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-xs font-extrabold text-slate-400 w-12 text-right">{roof.azimuthDeg}°</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1">Sklon střechy</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="5"
                      value={roof.tiltDeg}
                      onChange={e => updateRoof(roof.id, { tiltDeg: parseInt(e.target.value) })}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-xs font-extrabold text-slate-400 w-12 text-right">{roof.tiltDeg}°</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Panel</div>
                  <FvPanelPicker
                    panels={panels}
                    selectedId={roof.panelId ?? null}
                    onSelect={p => updateRoof(roof.id, {
                      panelId: p.id,
                      panelPowerWp: p.power_wp,
                      panelWidthMm: p.width_mm,
                      panelHeightMm: p.height_mm,
                    })}
                  />
                </div>

                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1">Počet panelů</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="flex-1 border border-white/10 rounded-xl px-3 py-1.5 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
                      value={roof.panelCount}
                      onChange={e => updateRoof(roof.id, { panelCount: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                    <span className="text-xs font-extrabold text-orange-600 shrink-0">{roofKwp} kWp</span>
                  </div>
                </div>

                <div className="border border-white/10 rounded-xl p-3 bg-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Konstrukce</span>
                    <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roof.mounting?.showConstruction ?? false}
                        onChange={e => updateRoof(roof.id, { mounting: { ...roof.mounting, showConstruction: e.target.checked } })}
                        className="accent-orange-500"
                      />
                      <span className="text-[10px] font-extrabold text-slate-500">Zobrazit</span>
                    </label>
                  </div>

                  {(roofTiles.length > 0 || hooks.length > 0 || railProfiles.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {roofTiles.length > 0 && (
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Krytina</label>
                          <select
                            className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 bg-white/[0.06] focus:outline-none focus:border-orange-400"
                            value={roof.mounting?.roofTileId ?? ''}
                            onChange={e => {
                              const tile = roofTiles.find(t => t.id === e.target.value);
                              const compatHooks = tile ? hooks.filter(h => h.compatible_tile_type === tile.type) : [];
                              updateRoof(roof.id, {
                                mounting: {
                                  ...roof.mounting,
                                  roofTileId: e.target.value || undefined,
                                  hookSpacingMm: tile?.hook_spacing_mm ?? roof.mounting?.hookSpacingMm,
                                  hookId: compatHooks.length === 1 ? compatHooks[0].id : (roof.mounting?.hookId ?? undefined),
                                  showConstruction: roof.mounting?.showConstruction ?? false,
                                },
                              });
                            }}
                          >
                            <option value="">-- vybrat --</option>
                            {roofTiles.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({TILE_TYPE_LABELS[t.type] ?? t.type})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {hooks.length > 0 && (
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Hák</label>
                          <select
                            className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 bg-white/[0.06] focus:outline-none focus:border-orange-400"
                            value={roof.mounting?.hookId ?? ''}
                            onChange={e => updateRoof(roof.id, { mounting: { ...roof.mounting, hookId: e.target.value || undefined } })}
                          >
                            <option value="">-- vybrat --</option>
                            {(() => {
                              const selTile = roofTiles.find(t => t.id === roof.mounting?.roofTileId);
                              const filtered = selTile ? hooks.filter(h => h.compatible_tile_type === selTile.type) : hooks;
                              return filtered.map(h => (
                                <option key={h.id} value={h.id}>{h.name} ({h.height_mm} mm, {h.price} Kč)</option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}

                      {railProfiles.length > 0 && (
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Profil</label>
                          <select
                            className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 bg-white/[0.06] focus:outline-none focus:border-orange-400"
                            value={roof.mounting?.railProfileId ?? ''}
                            onChange={e => updateRoof(roof.id, { mounting: { ...roof.mounting, railProfileId: e.target.value || undefined } })}
                          >
                            <option value="">-- vybrat --</option>
                            {railProfiles.map(rp => (
                              <option key={rp.id} value={rp.id}>{rp.name} ({rp.width_mm}x{rp.height_mm} mm, {rp.price_per_m} Kč/m)</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {clamps.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Středová příchytka</label>
                        <select
                          className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 bg-white/[0.06] focus:outline-none focus:border-orange-400"
                          value={roof.mounting?.midClampId ?? ''}
                          onChange={e => updateRoof(roof.id, { mounting: { ...roof.mounting, midClampId: e.target.value || undefined } })}
                        >
                          <option value="">-- vybrat --</option>
                          {clamps.filter(c => c.clamp_type === 'mid').map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.min_thickness_mm}-{c.max_thickness_mm} mm, {c.price} Kč)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Krajová příchytka</label>
                        <select
                          className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 bg-white/[0.06] focus:outline-none focus:border-orange-400"
                          value={roof.mounting?.endClampId ?? ''}
                          onChange={e => updateRoof(roof.id, { mounting: { ...roof.mounting, endClampId: e.target.value || undefined } })}
                        >
                          <option value="">-- vybrat --</option>
                          {clamps.filter(c => c.clamp_type === 'end').map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.min_thickness_mm}-{c.max_thickness_mm} mm, {c.price} Kč)</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {roof.mounting?.roofTileId && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-extrabold text-slate-400">Rozteč háků:</label>
                      <input
                        type="number"
                        min="100"
                        step="10"
                        className="w-20 border border-white/10 rounded-lg px-2 py-1 text-xs font-medium bg-white/[0.06] text-slate-300"
                        value={roof.mounting?.hookSpacingMm ?? roofTiles.find(t => t.id === roof.mounting?.roofTileId)?.hook_spacing_mm ?? 350}
                        onChange={e => updateRoof(roof.id, { mounting: { ...roof.mounting, hookSpacingMm: parseInt(e.target.value) || 350 } })}
                      />
                      <span className="text-[10px] font-extrabold text-slate-400">mm</span>
                    </div>
                  )}

                  {roof.mounting?.showConstruction && roof.panelCount > 0 && (() => {
                    const selTile = roofTiles.find(t => t.id === roof.mounting?.roofTileId);
                    const selHook = hooks.find(h => h.id === roof.mounting?.hookId);
                    const selRail = railProfiles.find(rp => rp.id === roof.mounting?.railProfileId);
                    const selMidClamp = clamps.find(c => c.id === roof.mounting?.midClampId);
                    const selEndClamp = clamps.find(c => c.id === roof.mounting?.endClampId);
                    const hookSpacing = roof.mounting?.hookSpacingMm ?? selTile?.hook_spacing_mm ?? 350;
                    const panelH = roof.panelHeightMm;
                    const railCount = 2;
                    const panelCount = roof.panelCount;
                    const totalRailLengthPerRow = roof.panelWidthMm * panelCount;
                    const totalRailLengthMm = totalRailLengthPerRow * railCount;
                    const hooksPerRail = Math.max(2, Math.ceil(totalRailLengthPerRow / hookSpacing) + 1);
                    const totalHooks = hooksPerRail * railCount;
                    const railPieces = selRail ? Math.ceil(totalRailLengthMm / selRail.length_mm) : 0;
                    const hookCost = selHook ? totalHooks * selHook.price : 0;
                    const railCost = selRail ? (totalRailLengthMm / 1000) * selRail.price_per_m : 0;

                    const midClampCount = (panelCount - 1) * railCount;
                    const endClampCount = 2 * railCount;
                    const midClampCost = selMidClamp ? midClampCount * selMidClamp.price : 0;
                    const endClampCost = selEndClamp ? endClampCount * selEndClamp.price : 0;
                    const totalCost = hookCost + railCost + midClampCost + endClampCost;

                    return (
                      <div className="bg-white/[0.04] rounded-lg p-2 text-[10px] font-extrabold text-slate-400 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Profily: {railCount} linie x {Math.round(totalRailLengthPerRow)} mm = {(totalRailLengthMm / 1000).toFixed(1)} m</span>
                          {selRail && <span>{railPieces} ks profilů ({selRail.length_mm} mm)</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Háky: {hooksPerRail}/profil x {railCount} = {totalHooks} ks (á {hookSpacing} mm)</span>
                          <span className="text-slate-500">1/4 od hrany = {Math.round(panelH / 4)} mm</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Středové příchytky: ({panelCount}-1) x {railCount} = {midClampCount} ks</span>
                          {selMidClamp && <span>{midClampCost.toLocaleString('cs-CZ')} Kč</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Krajové příchytky: 2 x {railCount} = {endClampCount} ks</span>
                          {selEndClamp && <span>{endClampCost.toLocaleString('cs-CZ')} Kč</span>}
                        </div>
                        {totalCost > 0 && (
                          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-orange-600">
                            <span>Materiál konstrukce celkem</span>
                            <span>{Math.round(totalCost).toLocaleString('cs-CZ')} Kč</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1">Vizuální editor střechy</div>
                  <RoofCanvas
                    roof={roof}
                    panel={selectedPanel}
                    mounting={roof.mounting?.showConstruction ? {
                      showConstruction: true,
                      hookSpacingMm: roof.mounting?.hookSpacingMm ?? roofTiles.find(t => t.id === roof.mounting?.roofTileId)?.hook_spacing_mm ?? 350,
                    } : undefined}
                    onUpdatePanelCount={count => updateRoof(roof.id, { panelCount: count })}
                    onUpdatePoints={(pts, sc) => updateRoof(roof.id, { points: pts, scale: sc })}
                    onImageChange={(url) => updateRoof(roof.id, { imageUrl: url ?? undefined, scale: undefined })}
                    onUpdatePlacedPanels={(panels, region) => updateRoof(roof.id, { placedPanels: panels, fillRegion: region })}
                    onSnapshotChange={(dataUrl) => {
                      updateRoof(roof.id, { snapshotDataUrl: dataUrl });
                      onSnapshotChange?.(roof.id, dataUrl);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addRoof}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/[0.06] border border-dashed border-orange-300 rounded-xl text-xs font-extrabold text-orange-600 hover:bg-orange-500/10 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Přidat střešní plochu
      </button>
    </div>
  );
}
