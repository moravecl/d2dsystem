import type { Floor } from '../../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../../hooks/useHeatingSystems';
import { calculateHeatingMaterials } from '../../../hooks/useHeatingSystems';
import { polygonAreaM2, polygonPerimeterM } from '../floorplan/geometry';
import { computeFloorHeating, type FloorHeatCalcResult } from '../floorplan/floorHeatCalc';
import { computeRadiatorSizing, type RadiatorCalcResult } from '../floorplan/radiatorCalc';

interface Props {
  floors: Floor[];
  heatingSystems: HeatingSystemFull[];
  alwaysVisible?: boolean;
  showPrices?: boolean;
}

interface HeatingEntry {
  roomName: string;
  floorName: string;
  systemName: string;
  systemSlug: string;
  areaM2: number;
  lines: ReturnType<typeof calculateHeatingMaterials>;
  roomTotal: number;
  floorCalc: FloorHeatCalcResult | null;
  radCalc: RadiatorCalcResult | null;
}

export default function SummaryHeatingPrint({ floors, heatingSystems, alwaysVisible, showPrices = true }: Props) {
  const heatedRooms = floors.flatMap((floor) =>
    (floor.rooms ?? []).filter((r) => r.heatingSystemId).map((r) => ({ room: r, floor }))
  );
  if (heatedRooms.length === 0) return null;

  let heatingGrandTotal = 0;
  const allHeatingLines: HeatingEntry[] = [];

  for (const { room, floor } of heatedRooms) {
    const sys = heatingSystems.find((s) => s.system.id === room.heatingSystemId);
    if (!sys || !floor.scale) continue;
    const areaM2 = polygonAreaM2(room.points, floor.scale);
    const perimeterM = polygonPerimeterM(room.points, floor.scale);
    const doorWidths = (room.doors ?? []).reduce((s, d) => s + d.widthM, 0);
    const effectivePerimeter = Math.max(0, perimeterM - doorWidths);
    const cfg = room.heatingConfig ?? {};
    const lines = calculateHeatingMaterials(sys, cfg, areaM2, effectivePerimeter);
    const roomTotal = lines.reduce((s, l) => s + l.totalPrice, 0);
    heatingGrandTotal += roomTotal;

    const slug = sys.system.slug;
    const isFloor = slug === 'wet_underfloor' || slug === 'dry_underfloor';
    const isRad = slug === 'radiators';

    let floorCalc: FloorHeatCalcResult | null = null;
    let radCalc: RadiatorCalcResult | null = null;

    if (isFloor && areaM2 > 0) {
      const roomHeight = parseFloat(cfg['calc_room_height'] || '') || (room.ceilingHeight ?? 2.6);
      floorCalc = computeFloorHeating({
        areaM2,
        roomHeight,
        buildingType: cfg['calc_building_type'] || 'new_insulated',
        indoorTemp: parseFloat(cfg['calc_indoor_temp'] || '') || 20,
        flowTemp: parseFloat(cfg['calc_flow_temp'] || '') || 35,
        returnTemp: parseFloat(cfg['calc_return_temp'] || '') || 30,
        floorCovering: cfg['calc_floor_covering'] || 'tile',
        isDrySystem: slug === 'dry_underfloor',
      });
    }

    if (isRad && areaM2 > 0) {
      const roomHeight = parseFloat(cfg['calc_room_height'] || '') || (room.ceilingHeight ?? 2.6);
      const radType = cfg['radiator_type'] as 'panel_11' | 'panel_22' | 'panel_33' ?? 'panel_22';
      radCalc = computeRadiatorSizing({
        areaM2,
        roomHeight,
        buildingType: cfg['calc_building_type'] || 'new_insulated',
        flowTemp: parseFloat(cfg['calc_flow_temp'] || '') || 55,
        returnTemp: parseFloat(cfg['calc_return_temp'] || '') || 45,
        indoorTemp: parseFloat(cfg['calc_indoor_temp'] || '') || 20,
        radiatorCount: parseInt(cfg['calc_radiator_count'] || '', 10) || 1,
        radiatorType: (['panel_11', 'panel_22', 'panel_33'].includes(radType) ? radType : 'panel_22') as 'panel_11' | 'panel_22' | 'panel_33',
        radiatorHeight: parseInt(cfg['calc_radiator_height'] || '', 10) || 554,
      });
    }

    allHeatingLines.push({
      roomName: room.name,
      floorName: floor.name,
      systemName: sys.system.name,
      systemSlug: slug,
      areaM2,
      lines,
      roomTotal,
      floorCalc,
      radCalc,
    });
  }

  return (
    <div className={`${alwaysVisible ? '' : 'hidden print:block'} print:break-before-page mt-8`}>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-red-300">
        <span className="w-4 h-4 rounded-full bg-red-500" />
        <span className="text-lg font-extrabold text-white">Vytápění -- kalkulace materiálu</span>
      </div>

      {allHeatingLines.map((entry, idx) => (
        <div key={idx} className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xs font-extrabold text-white">{entry.floorName} &ndash; {entry.roomName}</span>
            <span className="text-[10px] text-slate-500">{entry.systemName}</span>
            <span className="text-[10px] font-extrabold text-teal-700">{entry.areaM2.toFixed(1)} m²</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-2">
            {entry.floorCalc && <FloorCalcSummary result={entry.floorCalc} />}
            {entry.radCalc && <RadCalcSummary result={entry.radCalc} count={parseInt((entry as any).roomConfig?.['calc_radiator_count'] || '1', 10) || 1} />}

            <div className={entry.floorCalc || entry.radCalc ? '' : 'lg:col-span-2'}>
              {entry.lines.length > 0 && (
                <table className="w-full text-[10px] border-collapse border border-white/10">
                  <thead>
                    <tr className="bg-white/[0.04]">
                      <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Materiál</th>
                      <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Množství</th>
                      {showPrices && <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Kč/j.</th>}
                      {showPrices && <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Cena</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line, li) => (
                      <tr key={li} className="border-t border-white/[0.06]">
                        <td className="px-2 py-1 border border-white/10">{line.name}</td>
                        <td className="px-2 py-1 border border-white/10 text-right font-extrabold">
                          {line.quantity < 10 ? line.quantity.toFixed(1) : Math.ceil(line.quantity)} {line.unit}
                        </td>
                        {showPrices && <td className="px-2 py-1 border border-white/10 text-right">{line.pricePerUnit > 0 ? `${line.pricePerUnit} Kč` : '\u2014'}</td>}
                        {showPrices && <td className="px-2 py-1 border border-white/10 text-right font-extrabold">
                          {line.totalPrice > 0 ? `${Math.round(line.totalPrice).toLocaleString('cs-CZ')} Kč` : '\u2014'}
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                  {showPrices && entry.roomTotal > 0 && (
                    <tfoot>
                      <tr className="bg-red-500/10 border-t-2 border-white/10">
                        <td colSpan={3} className="px-2 py-1 border border-white/10 font-extrabold text-right">Celkem místnost</td>
                        <td className="px-2 py-1 border border-white/10 font-extrabold text-right text-red-400">
                          {Math.round(entry.roomTotal).toLocaleString('cs-CZ')} Kč
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </div>
      ))}

      {showPrices && heatingGrandTotal > 0 && (
        <div className="mt-2 bg-red-500/10 border-2 border-red-200 rounded p-2 text-right">
          <span className="text-xs font-extrabold text-white">Celkem vytápění: </span>
          <span className="text-sm font-extrabold text-red-400">{Math.round(heatingGrandTotal).toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}
    </div>
  );
}

function FloorCalcSummary({ result }: { result: FloorHeatCalcResult }) {
  const rec = result.spacingResults.find((s) => s.spacingMm === result.recommendedSpacingMm);
  const hasSufficient = result.spacingResults.some((s) => s.sufficient);

  return (
    <div className={`rounded-lg border p-2.5 text-[10px] space-y-1.5 ${hasSufficient ? 'border-emerald-200 bg-emerald-500/10' : 'border-amber-200 bg-amber-500/10'}`}>
      <div className="font-extrabold text-slate-300 text-[10px] mb-1">Dimenzování podlahového vytápění</div>
      <InfoRow label="Tepelná ztráta" value={`${Math.round(result.heatLossW)} W`} />
      <InfoRow label="Návrhový výkon" value={`${Math.round(result.designPowerW)} W`} bold />
      <InfoRow label="Potřebný výkon" value={`${result.requiredWm2.toFixed(0)} W/m²`} bold />
      <InfoRow label="Teplota povrchu" value={`${result.floorSurfaceTemp.toFixed(1)} °C`} warn={result.floorSurfaceTemp > 29} />
      {rec && (
        <>
          <div className="border-t border-white/10 pt-1 mt-1" />
          <InfoRow label="Doporučená rozteč" value={`${rec.spacingMm / 10} cm`} bold highlight />
          <InfoRow label="Výkon při rozteči" value={`${rec.specificOutputWm2} W/m²`} />
          <InfoRow label="Délka trubky" value={`${rec.pipeLengthM} m`} />
          <InfoRow label="Průtok" value={`${rec.flowRateLph} l/h`} />
          <InfoRow label="Pokrytí" value={`${rec.coveragePercent.toFixed(0)} %`} bold highlight={rec.sufficient} warn={!rec.sufficient} />
        </>
      )}
    </div>
  );
}

function RadCalcSummary({ result, count }: { result: RadiatorCalcResult; count: number }) {
  const isOk = result.coveragePercent >= 100;

  return (
    <div className={`rounded-lg border p-2.5 text-[10px] space-y-1.5 ${isOk ? 'border-emerald-200 bg-emerald-500/10' : 'border-amber-200 bg-amber-500/10'}`}>
      <div className="font-extrabold text-slate-300 text-[10px] mb-1">Dimenzování radiátorů</div>
      <InfoRow label="Tepelná ztráta" value={`${Math.round(result.heatLossW)} W`} />
      <InfoRow label="Návrhový výkon" value={`${Math.round(result.designPowerW)} W`} bold />
      {count > 1 && <InfoRow label={`Na 1 radiátor (${count} ks)`} value={`${Math.round(result.perRadiatorW)} W`} />}
      <div className="border-t border-white/10 pt-1 mt-1" />
      <InfoRow label="Doporučená délka" value={`${result.recommendedLengthMm} mm`} bold highlight />
      <InfoRow label="Skutečný výkon" value={`${Math.round(result.actualOutputW)} W`} />
      <InfoRow label="Pokrytí" value={`${result.coveragePercent.toFixed(0)} %`} bold highlight={isOk} warn={!isOk} />
    </div>
  );
}

function InfoRow({
  label,
  value,
  bold,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span
        className={[
          bold ? 'font-extrabold' : 'font-semibold',
          highlight ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-white',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
