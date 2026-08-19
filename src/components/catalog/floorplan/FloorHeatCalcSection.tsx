import { useMemo } from 'react';
import { Calculator, AlertTriangle, CheckCircle, Droplets, ThermometerSun } from 'lucide-react';
import type { Room, FloorScale } from '../../../hooks/useProjectState';
import { polygonAreaM2 } from './geometry';
import {
  BUILDING_TYPES,
  FLOOR_COVERINGS,
  computeFloorHeating,
  type FloorHeatCalcResult,
  type SpacingResult,
} from './floorHeatCalc';

interface Props {
  room: Room;
  scale?: FloorScale;
  config: Record<string, string>;
  onUpdateConfig: (key: string, value: string) => void;
  isDrySystem: boolean;
}

const INPUT_CLS =
  'w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500/20';
const LABEL_CLS = 'text-[10px] font-extrabold text-slate-400 mb-0.5 block';

export default function FloorHeatCalcSection({ room, scale, config, onUpdateConfig, isDrySystem }: Props) {
  const areaM2 = room && scale ? polygonAreaM2(room.points, scale) : null;

  const roomHeight = parseFloat(config['calc_room_height'] || '') || (room.ceilingHeight ?? 2.6);
  const buildingType = config['calc_building_type'] || 'new_insulated';
  const indoorTemp = parseFloat(config['calc_indoor_temp'] || '') || 20;
  const flowTemp = parseFloat(config['calc_flow_temp'] || '') || 35;
  const returnTemp = parseFloat(config['calc_return_temp'] || '') || (flowTemp - 5);
  const floorCovering = config['calc_floor_covering'] || 'tile';

  const result = useMemo(() => {
    if (areaM2 === null || areaM2 <= 0) return null;
    return computeFloorHeating({
      areaM2,
      roomHeight,
      buildingType,
      indoorTemp,
      flowTemp,
      returnTemp,
      floorCovering,
      isDrySystem,
    });
  }, [areaM2, roomHeight, buildingType, indoorTemp, flowTemp, returnTemp, floorCovering, isDrySystem]);

  const setVal = (key: string, val: string) => onUpdateConfig(key, val);

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 flex items-center gap-1.5">
        <Calculator className="w-3.5 h-3.5" /> Dimenzování podlahového vytápění
      </div>

      {areaM2 === null && (
        <div className="text-[10px] bg-amber-500/10 border border-amber-200 rounded-lg p-2 text-amber-400 font-semibold">
          Nastav měřítko a nakresli místnost pro výpočet.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLS}>Výška místnosti (m)</label>
          <input
            type="number"
            step="0.1"
            min="2.0"
            max="6.0"
            value={config['calc_room_height'] || roomHeight}
            onChange={(e) => setVal('calc_room_height', e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Vnitřní teplota (°C)</label>
          <input
            type="number"
            step="1"
            min="15"
            max="30"
            value={config['calc_indoor_temp'] || indoorTemp}
            onChange={(e) => setVal('calc_indoor_temp', e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div>
        <label className={LABEL_CLS}>Typ objektu (tepelné ztráty)</label>
        <select
          value={buildingType}
          onChange={(e) => setVal('calc_building_type', e.target.value)}
          className={INPUT_CLS}
        >
          {BUILDING_TYPES.map((bt) => (
            <option key={bt.value} value={bt.value}>
              {bt.label} ({bt.q} W/m³)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLS}>Přívodní teplota (°C)</label>
          <input
            type="number"
            step="1"
            min="25"
            max="55"
            value={config['calc_flow_temp'] || flowTemp}
            onChange={(e) => {
              setVal('calc_flow_temp', e.target.value);
              const ft = parseFloat(e.target.value);
              if (!isNaN(ft) && !config['calc_return_temp']) {
                setVal('calc_return_temp', String(ft - 5));
              }
            }}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Vratná teplota (°C)</label>
          <input
            type="number"
            step="1"
            min="20"
            max="50"
            value={config['calc_return_temp'] || returnTemp}
            onChange={(e) => setVal('calc_return_temp', e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div>
        <label className={LABEL_CLS}>Nášlapná vrstva</label>
        <select
          value={floorCovering}
          onChange={(e) => setVal('calc_floor_covering', e.target.value)}
          className={INPUT_CLS}
        >
          {FLOOR_COVERINGS.map((fc) => (
            <option key={fc.value} value={fc.value}>
              {fc.label} (R = {fc.rLambda.toFixed(2)} m²K/W)
            </option>
          ))}
        </select>
      </div>

      {result && <ResultPanel result={result} onSelectSpacing={(mm) => {
        setVal('calc_recommended_spacing', String(mm));
        onUpdateConfig('pipe_spacing', String(mm));
      }} />}
    </div>
  );
}

function ResultPanel({
  result,
  onSelectSpacing,
}: {
  result: FloorHeatCalcResult;
  onSelectSpacing: (mm: number) => void;
}) {
  const hasSufficient = result.spacingResults.some((s) => s.sufficient);
  const borderColor = hasSufficient ? 'border-emerald-200' : 'border-amber-200';
  const bgColor = hasSufficient ? 'bg-emerald-500/10' : 'bg-amber-500/10';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-3 space-y-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
        {hasSufficient ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className={hasSufficient ? 'text-emerald-800' : 'text-amber-800'}>
          Výsledek dimenzování
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <Row label="Objem místnosti" value={`${result.volumeM3.toFixed(1)} m³`} />
        <Row label="Měrná ztráta" value={`${result.qWPerM3} W/m³`} sub />
        <Row label="Tepelná ztráta" value={`${Math.round(result.heatLossW)} W`} />
        <Row label="Návrhový výkon (+10 %)" value={`${Math.round(result.designPowerW)} W`} bold />
        <Row label="Potřebný výkon" value={`${result.requiredWm2.toFixed(0)} W/m²`} bold />
        <Row label="Střední teplota vody" value={`${result.meanWaterTemp.toFixed(0)} °C`} sub />
      </div>

      <div className="border-t border-white/10 pt-2 space-y-1 text-[10px]">
        <div className="flex items-center gap-1.5">
          <ThermometerSun className="w-3 h-3 text-slate-500" />
          <span className="text-slate-400">Teplota povrchu podlahy:</span>
          <span className={`font-extrabold ${result.floorSurfaceTemp > 29 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {result.floorSurfaceTemp.toFixed(1)} °C
          </span>
          <span className="text-slate-400">(max 29 °C)</span>
        </div>
      </div>

      <div className="border-t border-white/10 pt-2">
        <div className="text-[10px] font-extrabold text-slate-300 mb-1.5 flex items-center gap-1">
          <Droplets className="w-3 h-3" /> Porovnání roztečí
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-white/[0.06]">
                <th className="text-left px-1.5 py-1 font-extrabold text-slate-500">Rozteč</th>
                <th className="text-right px-1.5 py-1 font-extrabold text-slate-500">W/m²</th>
                <th className="text-right px-1.5 py-1 font-extrabold text-slate-500">Trubka</th>
                <th className="text-right px-1.5 py-1 font-extrabold text-slate-500">Průtok</th>
                <th className="text-right px-1.5 py-1 font-extrabold text-slate-500">Pokrytí</th>
                <th className="px-1 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {result.spacingResults.map((sr) => (
                <SpacingRow
                  key={sr.spacingMm}
                  sr={sr}
                  isRecommended={sr.spacingMm === result.recommendedSpacingMm}
                  onSelect={() => onSelectSpacing(sr.spacingMm)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="space-y-1 pt-1">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="text-[9px] font-semibold text-amber-400 bg-amber-500/20 rounded-md px-2 py-1 flex items-start gap-1"
            >
              <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpacingRow({
  sr,
  isRecommended,
  onSelect,
}: {
  sr: SpacingResult;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  const bg = isRecommended
    ? 'bg-emerald-500/20 border-emerald-300'
    : sr.sufficient
    ? 'bg-white/[0.06] border-white/[0.06]'
    : 'bg-red-500/10 border-red-500/20';

  return (
    <tr
      className={`border-t ${bg} cursor-pointer hover:bg-white/[0.04] transition`}
      onClick={onSelect}
    >
      <td className="px-1.5 py-1 font-extrabold text-slate-300">
        {sr.spacingMm / 10} cm
        {isRecommended && (
          <span className="ml-1 text-[8px] bg-emerald-600 text-white px-1 py-0.5 rounded font-extrabold uppercase">
            dop.
          </span>
        )}
      </td>
      <td className="px-1.5 py-1 text-right font-extrabold">
        {sr.specificOutputWm2}
      </td>
      <td className="px-1.5 py-1 text-right font-semibold text-slate-400">
        {sr.pipeLengthM} m
      </td>
      <td className="px-1.5 py-1 text-right font-semibold text-slate-400">
        {sr.flowRateLph} l/h
      </td>
      <td className={`px-1.5 py-1 text-right font-extrabold ${sr.sufficient ? 'text-emerald-400' : 'text-red-400'}`}>
        {sr.coveragePercent.toFixed(0)} %
      </td>
      <td className="px-1 py-1 text-center">
        {sr.sufficient ? (
          <CheckCircle className="w-3 h-3 text-emerald-500 inline" />
        ) : (
          <AlertTriangle className="w-3 h-3 text-red-400 inline" />
        )}
      </td>
    </tr>
  );
}

function Row({
  label,
  value,
  bold,
  sub,
}: {
  label: string;
  value: string;
  bold?: boolean;
  sub?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={sub ? 'text-slate-400' : 'text-slate-400'}>{label}</span>
      <span className={bold ? 'font-extrabold text-white' : 'font-semibold text-white'}>
        {value}
      </span>
    </div>
  );
}
