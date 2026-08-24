import { useState, useEffect } from 'react';
import { Sun, Zap, Battery, Car, Wrench, Package, MapPin, Ruler, Settings, BarChart3 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useOrganization } from '../../../contexts/OrganizationContext';
import type { FvPanel, FvInverter, FvBattery, FvWallbox, FvAccessory, FvRoofTile, FvHook, FvRailProfile, FvClamp } from '../../../hooks/useFvCatalog';
import type { RoofSurface, FvInputParams } from '../../../lib/fvCalculations';

const TECH_MAP: Record<string, string> = { mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jiná' };
const CHEM_MAP: Record<string, string> = { lfp: 'LFP', nmc: 'NMC', lead: 'Olovo', other: 'Jiná' };
const HEATING_MAP: Record<string, string> = { heat_pump: 'Tepelné čerpadlo', electric_boiler: 'Elektrický kotel', gas: 'Plyn', other: 'Jiné' };
const HOT_WATER_MAP: Record<string, string> = { electric: 'Elektrický', gas: 'Plyn', heat_pump: 'Tepelné čerpadlo', other: 'Jiné' };
const TILE_TYPE_MAP: Record<string, string> = { tiled: 'Taška', metal_sheet: 'Plech', bitumen: 'Bitumen', flat: 'Plochá', trapezoid: 'Trapéz', other: 'Jiné' };

interface FvDesignRow {
  id: string;
  roofs: RoofSurface[];
  system_config: Record<string, unknown>;
  pvgis_results: Record<string, unknown> | null;
  input_params: Record<string, unknown>;
}

interface Props {
  projectId: string | null;
}

function RoofPreviewSvg({ roof }: { roof: RoofSurface }) {
  if (!roof.imageUrl && (!roof.placedPanels || roof.placedPanels.length === 0)) return null;

  const W = 400;
  const H = 280;
  const points = roof.points ?? [];
  const placedPanels = roof.placedPanels ?? [];
  const fillRegion = roof.fillRegion ?? [];

  const computeRoofAngle = (pts: { x: number; y: number }[]): number => {
    if (pts.length < 2) return 0;
    let longestDist = 0;
    let longestAngle = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > longestDist) {
        longestDist = dist;
        longestAngle = Math.atan2(dy, dx);
      }
    }
    return longestAngle;
  };

  const angle = points.length >= 3 ? computeRoofAngle(points) : (fillRegion.length >= 3 ? computeRoofAngle(fillRegion) : 0);
  const angleDeg = (angle * 180) / Math.PI;

  const getPanelSize = () => {
    if (!roof.scale) return { w: 20, h: 30 };
    const dx = roof.scale.p2.x - roof.scale.p1.x;
    const dy = roof.scale.p2.y - roof.scale.p1.y;
    const pixelDist = Math.sqrt((dx * W) ** 2 + (dy * H) ** 2);
    const pxPerMm = pixelDist / (roof.scale.realDistanceM * 1000);
    return {
      w: Math.max(8, roof.panelWidthMm * pxPerMm),
      h: Math.max(12, roof.panelHeightMm * pxPerMm),
    };
  };

  const pSz = getPanelSize();

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-slate-900 print:rounded-none">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        {roof.imageUrl && (
          <image href={roof.imageUrl} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid meet" />
        )}

        {points.length > 2 && (
          <polygon
            points={points.map(p => `${p.x * W},${p.y * H}`).join(' ')}
            fill="rgba(249,115,22,0.12)"
            stroke="#f97316"
            strokeWidth="1.5"
          />
        )}

        {fillRegion.length > 2 && (
          <polygon
            points={fillRegion.map(p => `${p.x * W},${p.y * H}`).join(' ')}
            fill="rgba(16,185,129,0.12)"
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        )}

        {placedPanels.map((p, i) => (
          <g key={i} transform={`translate(${p.x},${p.y}) rotate(${angleDeg})`}>
            <rect
              x={-pSz.w / 2}
              y={-pSz.h / 2}
              width={pSz.w}
              height={pSz.h}
              fill="rgba(249,115,22,0.5)"
              stroke="#ea580c"
              strokeWidth="1"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function SummaryFvPrint({ projectId }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [design, setDesign] = useState<FvDesignRow | null>(null);
  const [panels, setPanels] = useState<FvPanel[]>([]);
  const [inverters, setInverters] = useState<FvInverter[]>([]);
  const [batteries, setBatteries] = useState<FvBattery[]>([]);
  const [wallboxes, setWallboxes] = useState<FvWallbox[]>([]);
  const [accessories, setAccessories] = useState<FvAccessory[]>([]);
  const [roofTiles, setRoofTiles] = useState<FvRoofTile[]>([]);
  const [hooks, setHooks] = useState<FvHook[]>([]);
  const [railProfiles, setRailProfiles] = useState<FvRailProfile[]>([]);
  const [clamps, setClamps] = useState<FvClamp[]>([]);

  useEffect(() => {
    if (!projectId || !orgId) return;

    supabase
      .from('fv_designs')
      .select('id, roofs, system_config, pvgis_results, input_params')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        const { data: ver } = await supabase
          .from('fv_design_versions')
          .select('roofs, system_config, pvgis_results, input_params')
          .eq('fv_design_id', data.id)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ver) {
          setDesign({ id: data.id, roofs: ver.roofs, system_config: ver.system_config, pvgis_results: ver.pvgis_results, input_params: ver.input_params } as unknown as FvDesignRow);
        } else {
          setDesign(data as unknown as FvDesignRow);
        }
      });

    supabase.from('fv_panels').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setPanels((data ?? []) as FvPanel[]));
    supabase.from('fv_inverters').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setInverters((data ?? []) as FvInverter[]));
    supabase.from('fv_batteries').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setBatteries((data ?? []) as FvBattery[]));
    supabase.from('fv_wallboxes').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setWallboxes((data ?? []) as FvWallbox[]));
    supabase.from('fv_accessories').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setAccessories((data ?? []) as FvAccessory[]));
    supabase.from('fv_roof_tiles').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setRoofTiles((data ?? []) as FvRoofTile[]));
    supabase.from('fv_hooks').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setHooks((data ?? []) as FvHook[]));
    supabase.from('fv_rail_profiles').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setRailProfiles((data ?? []) as FvRailProfile[]));
    supabase.from('fv_clamps').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setClamps((data ?? []) as FvClamp[]));
  }, [projectId, orgId]);

  if (!design) return null;

  const roofs = (design.roofs ?? []).filter((r: RoofSurface) => r.panelCount > 0);
  if (roofs.length === 0) return null;

  const cfg = design.system_config as Record<string, unknown>;
  const result = design.pvgis_results as Record<string, unknown> | null;
  const inputParams = design.input_params as Partial<FvInputParams>;
  const totalPanels = roofs.reduce((s: number, r: RoofSurface) => s + r.panelCount, 0);
  const totalKwp = roofs.reduce((s: number, r: RoofSurface) => s + (r.panelCount * r.panelPowerWp) / 1000, 0);

  const inverter = inverters.find(i => i.id === cfg.inverterId);
  const masterBat = batteries.find(b => b.id === cfg.batteryId);
  const slaveBat = batteries.find(b => b.id === cfg.slaveBatteryId);
  const wallbox = wallboxes.find(w => w.id === cfg.wallboxId);
  const masterCount = (cfg.batteryCount as number) ?? 0;
  const slaveCount = (cfg.slaveBatteryCount as number) ?? 0;
  const totalBatteryKwh = (masterBat ? masterBat.capacity_kwh * masterCount : 0) + (slaveBat ? slaveBat.capacity_kwh * slaveCount : 0);

  const cfgAccessories = (cfg.accessories as { accessoryId: string; quantity: number }[]) ?? [];

  const annualProd = result ? (result.annualProductionKwh as number) ?? 0 : 0;
  const coveragePct = result ? (result.coveragePct as number) ?? 0 : 0;
  const annualSavings = result ? (result.annualSavingsCzk as number) ?? 0 : 0;
  const co2 = result ? (result.co2SavedKg as number) ?? 0 : 0;
  const selfConsumptionPct = result ? (result.selfConsumptionPct as number) ?? 0 : 0;
  const gridFeedKwh = result ? (result.gridFeedKwh as number) ?? 0 : 0;
  const gridDrawKwh = result ? (result.gridDrawKwh as number) ?? 0 : 0;
  const annualFeedIn = result ? (result.annualFeedInRevenueCzk as number) ?? 0 : 0;
  const totalBenefit = result ? (result.totalAnnualBenefitCzk as number) ?? 0 : 0;

  return (
    <div className="page-break-before mt-10 print:mt-0">
      <div className="flex items-center gap-2 mb-4 border-b-2 border-orange-400 pb-2 print:mb-2">
        <Sun className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-extrabold text-white">Fotovoltaický systém</h2>
      </div>

      {result && (
        <div className="grid grid-cols-4 gap-3 mb-5 print:gap-2 print:mb-3">
          <div className="bg-orange-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-orange-600">Výkon</div>
            <div className="text-xl font-extrabold text-orange-700 print:text-base">{Math.round(totalKwp * 100) / 100} kWp</div>
            <div className="text-[10px] text-orange-500">{totalPanels} panelů</div>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-orange-600">Roční výroba</div>
            <div className="text-xl font-extrabold text-orange-700 print:text-base">{annualProd.toLocaleString('cs-CZ')} kWh</div>
            <div className="text-[10px] text-orange-500">pokrytí {coveragePct}%</div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">Roční úspory</div>
            <div className="text-xl font-extrabold text-emerald-400 print:text-base">{annualSavings.toLocaleString('cs-CZ')} Kc</div>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-blue-400">Úspora CO2</div>
            <div className="text-xl font-extrabold text-blue-400 print:text-base">{co2.toLocaleString('cs-CZ')} kg</div>
            <div className="text-[10px] text-blue-500">za rok</div>
          </div>
        </div>
      )}

      {(inputParams.lat || inputParams.annualConsumptionKwh) && (
        <div className="mb-5 print:mb-3">
          <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-slate-500" /> Vstupní parametry
          </h3>
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {inputParams.lat != null && inputParams.lon != null && (
                <>
                  <div className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> GPS:</div>
                  <div className="font-extrabold text-slate-300 md:col-span-2">{inputParams.lat.toFixed(4)}°, {inputParams.lon.toFixed(4)}°</div>
                </>
              )}
              {inputParams.annualConsumptionKwh != null && (
                <>
                  <div className="text-slate-500">Roční spotřeba:</div>
                  <div className="font-extrabold text-slate-300">{inputParams.annualConsumptionKwh.toLocaleString('cs-CZ')} kWh</div>
                </>
              )}
              {inputParams.electricityPriceCzkPerKwh != null && (
                <>
                  <div className="text-slate-500">Cena el.:</div>
                  <div className="font-extrabold text-slate-300">{inputParams.electricityPriceCzkPerKwh} Kc/kWh</div>
                </>
              )}
              {inputParams.gridFeedInPriceCzkPerKwh != null && (
                <>
                  <div className="text-slate-500">Výkup do sítě:</div>
                  <div className="font-extrabold text-slate-300">{inputParams.gridFeedInPriceCzkPerKwh} Kc/kWh</div>
                </>
              )}
              {inputParams.heatingSource && (
                <>
                  <div className="text-slate-500">Vytápění:</div>
                  <div className="font-extrabold text-slate-300">{HEATING_MAP[inputParams.heatingSource] ?? inputParams.heatingSource}</div>
                </>
              )}
              {inputParams.hotWaterSource && (
                <>
                  <div className="text-slate-500">Ohřev vody:</div>
                  <div className="font-extrabold text-slate-300">{HOT_WATER_MAP[inputParams.hotWaterSource] ?? inputParams.hotWaterSource}</div>
                </>
              )}
              {(inputParams.evCount ?? 0) > 0 && (
                <>
                  <div className="text-slate-500">Elektromobily:</div>
                  <div className="font-extrabold text-slate-300">{inputParams.evCount}x ({inputParams.evKmPerYear?.toLocaleString('cs-CZ')} km/rok)</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mb-5 print:mb-3">
          <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-orange-500" /> Energetická bilance
          </h3>
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              <div className="text-slate-500">Vlastní spotřeba:</div>
              <div className="font-extrabold text-slate-300">{selfConsumptionPct}%</div>
              <div className="text-slate-500">Přebytek do sítě:</div>
              <div className="font-extrabold text-slate-300">{gridFeedKwh.toLocaleString('cs-CZ')} kWh</div>
              <div className="text-slate-500">Odběr ze sítě:</div>
              <div className="font-extrabold text-slate-300">{gridDrawKwh.toLocaleString('cs-CZ')} kWh</div>
              {annualFeedIn > 0 && (
                <>
                  <div className="text-slate-500">Příjem za přebytek:</div>
                  <div className="font-extrabold text-emerald-400">{annualFeedIn.toLocaleString('cs-CZ')} Kc/rok</div>
                </>
              )}
              {totalBenefit > 0 && (
                <>
                  <div className="text-slate-500">Celkový roční přínos:</div>
                  <div className="font-extrabold text-emerald-400">{totalBenefit.toLocaleString('cs-CZ')} Kc</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 print:mb-3">
        <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
          <Sun className="w-4 h-4 text-orange-500" /> Střešní plochy a panely
        </h3>
        <div className="space-y-4 print:space-y-3">
          {roofs.map((roof: RoofSurface) => {
            const panel = panels.find(p => p.id === roof.panelId);
            const roofKwp = Math.round((roof.panelCount * roof.panelPowerWp) / 10) / 100;
            const m = roof.mounting;
            const tile = m?.roofTileId ? roofTiles.find(t => t.id === m.roofTileId) : null;
            const hook = m?.hookId ? hooks.find(h => h.id === m.hookId) : null;
            const rail = m?.railProfileId ? railProfiles.find(rp => rp.id === m.railProfileId) : null;
            const midClamp = m?.midClampId ? clamps.find(c => c.id === m.midClampId) : null;
            const endClamp = m?.endClampId ? clamps.find(c => c.id === m.endClampId) : null;
            const hasConstruction = tile || hook || rail || midClamp || endClamp;

            return (
              <div key={roof.id} className="bg-white/[0.04] rounded-xl border border-white/10 overflow-hidden print:rounded-lg">
                {(roof.imageUrl || (roof.placedPanels && roof.placedPanels.length > 0)) && (
                  <div className="p-2 print:p-1">
                    <RoofPreviewSvg roof={roof} />
                  </div>
                )}
                <div className="p-3 print:p-2">
                  <div className="text-sm font-extrabold text-white mb-2">{roof.name}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-slate-500">Počet panelů:</div>
                    <div className="font-extrabold text-slate-300">{roof.panelCount} ks ({roofKwp} kWp)</div>
                    <div className="text-slate-500">Azimut / sklon:</div>
                    <div className="font-extrabold text-slate-300">{roof.azimuthDeg}° / {roof.tiltDeg}°</div>
                    {panel && (
                      <>
                        <div className="text-slate-500">Typ panelů:</div>
                        <div className="font-extrabold text-slate-300">{panel.name}</div>
                        <div className="text-slate-500">Výrobce:</div>
                        <div className="font-extrabold text-slate-300">{panel.manufacturer}</div>
                        <div className="text-slate-500">Technologie:</div>
                        <div className="font-extrabold text-slate-300">{TECH_MAP[panel.technology] ?? panel.technology} / {panel.power_wp} Wp</div>
                        <div className="text-slate-500">Rozměr:</div>
                        <div className="font-extrabold text-slate-300">{panel.width_mm} x {panel.height_mm} mm</div>
                        <div className="text-slate-500">Účinnost:</div>
                        <div className="font-extrabold text-slate-300">{panel.efficiency_pct}%</div>
                        <div className="text-slate-500">Záruka produkt/výkon:</div>
                        <div className="font-extrabold text-slate-300">{panel.warranty_product_years} / {panel.warranty_performance_years} let</div>
                      </>
                    )}
                  </div>

                  {hasConstruction && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
                        <Ruler className="w-3 h-3" /> Konstrukce
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {tile && (
                          <>
                            <div className="text-slate-500">Typ střechy:</div>
                            <div className="font-extrabold text-slate-300">{tile.name} ({TILE_TYPE_MAP[tile.type] ?? tile.type})</div>
                          </>
                        )}
                        {hook && (
                          <>
                            <div className="text-slate-500">Háky:</div>
                            <div className="font-extrabold text-slate-300">{hook.name}</div>
                          </>
                        )}
                        {m?.hookSpacingMm && (
                          <>
                            <div className="text-slate-500">Rozestup háků:</div>
                            <div className="font-extrabold text-slate-300">{m.hookSpacingMm} mm</div>
                          </>
                        )}
                        {rail && (
                          <>
                            <div className="text-slate-500">Profil (lišta):</div>
                            <div className="font-extrabold text-slate-300">{rail.name} ({rail.width_mm}x{rail.height_mm} mm, {rail.length_mm} mm)</div>
                          </>
                        )}
                        {midClamp && (
                          <>
                            <div className="text-slate-500">Středové příchytky:</div>
                            <div className="font-extrabold text-slate-300">{midClamp.name}</div>
                          </>
                        )}
                        {endClamp && (
                          <>
                            <div className="text-slate-500">Krajové příchytky:</div>
                            <div className="font-extrabold text-slate-300">{endClamp.name}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5 print:gap-2 print:mb-3">
        {inverter && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Střídač</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="text-slate-500">Model:</div>
              <div className="font-extrabold text-slate-300">{inverter.name}</div>
              <div className="text-slate-500">Výrobce:</div>
              <div className="font-extrabold text-slate-300">{inverter.manufacturer}</div>
              <div className="text-slate-500">Výkon:</div>
              <div className="font-extrabold text-slate-300">{inverter.power_kw} kW</div>
              <div className="text-slate-500">Fáze / MPPT:</div>
              <div className="font-extrabold text-slate-300">{inverter.phases}f / {inverter.mppt_count} MPPT</div>
              <div className="text-slate-500">Účinnost:</div>
              <div className="font-extrabold text-slate-300">{inverter.efficiency_pct}%</div>
            </div>
          </div>
        )}

        {(masterBat && masterCount > 0) && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Battery className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Baterie ({totalBatteryKwh} kWh)</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="col-span-2 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 mt-1">Master</div>
              <div className="text-slate-500">Model:</div>
              <div className="font-extrabold text-slate-300">{masterBat.name}</div>
              <div className="text-slate-500">Výrobce:</div>
              <div className="font-extrabold text-slate-300">{masterBat.manufacturer}</div>
              <div className="text-slate-500">Počet:</div>
              <div className="font-extrabold text-slate-300">{masterCount}x ({masterBat.capacity_kwh} kWh/ks)</div>
              <div className="text-slate-500">Chemie:</div>
              <div className="font-extrabold text-slate-300">{CHEM_MAP[masterBat.chemistry] ?? masterBat.chemistry}</div>
              <div className="text-slate-500">Cyklu:</div>
              <div className="font-extrabold text-slate-300">{masterBat.cycles.toLocaleString('cs-CZ')}</div>
              <div className="text-slate-500">Výkon:</div>
              <div className="font-extrabold text-slate-300">{masterBat.power_kw} kW</div>
              <div className="text-slate-500">DoD:</div>
              <div className="font-extrabold text-slate-300">{masterBat.dod_pct}%</div>
              <div className="text-slate-500">Záruka:</div>
              <div className="font-extrabold text-slate-300">{masterBat.warranty_years} let</div>

              {slaveBat && slaveCount > 0 && (
                <>
                  <div className="col-span-2 text-[10px] font-extrabold uppercase tracking-widest text-teal-600 mt-2 pt-2 border-t border-white/10">Slave</div>
                  <div className="text-slate-500">Model:</div>
                  <div className="font-extrabold text-slate-300">{slaveBat.name}</div>
                  <div className="text-slate-500">Výrobce:</div>
                  <div className="font-extrabold text-slate-300">{slaveBat.manufacturer}</div>
                  <div className="text-slate-500">Počet:</div>
                  <div className="font-extrabold text-slate-300">{slaveCount}x ({slaveBat.capacity_kwh} kWh/ks)</div>
                  <div className="text-slate-500">Chemie:</div>
                  <div className="font-extrabold text-slate-300">{CHEM_MAP[slaveBat.chemistry] ?? slaveBat.chemistry}</div>
                  <div className="text-slate-500">Cyklu:</div>
                  <div className="font-extrabold text-slate-300">{slaveBat.cycles.toLocaleString('cs-CZ')}</div>
                  <div className="text-slate-500">Výkon:</div>
                  <div className="font-extrabold text-slate-300">{slaveBat.power_kw} kW</div>
                  <div className="text-slate-500">DoD:</div>
                  <div className="font-extrabold text-slate-300">{slaveBat.dod_pct}%</div>
                  <div className="text-slate-500">Záruka:</div>
                  <div className="font-extrabold text-slate-300">{slaveBat.warranty_years} let</div>
                </>
              )}
            </div>
          </div>
        )}

        {wallbox && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Car className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Wallbox</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="text-slate-500">Model:</div>
              <div className="font-extrabold text-slate-300">{wallbox.name}</div>
              <div className="text-slate-500">Výrobce:</div>
              <div className="font-extrabold text-slate-300">{wallbox.manufacturer}</div>
              <div className="text-slate-500">Výkon:</div>
              <div className="font-extrabold text-slate-300">{wallbox.power_kw} kW / {wallbox.phases}f</div>
              <div className="text-slate-500">Konektor:</div>
              <div className="font-extrabold text-slate-300">{wallbox.connector_type.toUpperCase()}</div>
              {wallbox.smart_charging && (
                <>
                  <div className="text-slate-500">Smart nabíjení:</div>
                  <div className="font-extrabold text-emerald-400">Ano</div>
                </>
              )}
            </div>
          </div>
        )}

        {cfgAccessories.length > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Příslušenství</h3>
            </div>
            <div className="space-y-1">
              {cfgAccessories.map(a => {
                const acc = accessories.find(x => x.id === a.accessoryId);
                if (!acc) return null;
                return (
                  <div key={a.accessoryId} className="flex justify-between text-xs">
                    <span className="text-slate-400">{acc.name}</span>
                    <span className="font-extrabold text-slate-300">{a.quantity} {acc.unit}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {panels.filter(p => roofs.some((r: RoofSurface) => r.panelId === p.id)).length > 0 && (
        <div className="mb-5 print:mb-3">
          <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-slate-500" /> Přehled použitých panelů
          </h3>
          <table className="w-full text-xs border border-white/10 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-white/[0.06]">
                <th className="px-3 py-2 text-left font-extrabold text-slate-400">Panel</th>
                <th className="px-3 py-2 text-left font-extrabold text-slate-400">Výrobce</th>
                <th className="px-3 py-2 text-left font-extrabold text-slate-400">Technologie</th>
                <th className="px-3 py-2 text-right font-extrabold text-slate-400">Výkon</th>
                <th className="px-3 py-2 text-right font-extrabold text-slate-400">Rozměr</th>
                <th className="px-3 py-2 text-right font-extrabold text-slate-400">Účinnost</th>
                <th className="px-3 py-2 text-right font-extrabold text-slate-400">Záruka</th>
              </tr>
            </thead>
            <tbody>
              {panels.filter(p => roofs.some((r: RoofSurface) => r.panelId === p.id)).map(p => (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2 font-extrabold text-white">{p.name}</td>
                  <td className="px-3 py-2 text-slate-400">{p.manufacturer}</td>
                  <td className="px-3 py-2 text-slate-400">{TECH_MAP[p.technology] ?? p.technology}</td>
                  <td className="px-3 py-2 text-right font-extrabold text-slate-300">{p.power_wp} Wp</td>
                  <td className="px-3 py-2 text-right text-slate-400">{p.width_mm}x{p.height_mm} mm</td>
                  <td className="px-3 py-2 text-right text-slate-400">{p.efficiency_pct}%</td>
                  <td className="px-3 py-2 text-right text-slate-400">{p.warranty_product_years}/{p.warranty_performance_years} let</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
