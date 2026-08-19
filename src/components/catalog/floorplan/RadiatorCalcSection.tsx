import { useMemo } from 'react';
import { Calculator, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import type { Room, FloorScale } from '../../../hooks/useProjectState';
import { polygonAreaM2 } from './geometry';
import {
  BUILDING_TYPES,
  RADIATOR_HEIGHTS,
  computeRadiatorSizing,
  type RadiatorCalcResult,
} from './radiatorCalc';

interface Props {
  room: Room;
  scale?: FloorScale;
  config: Record<string, string>;
  onUpdateConfig: (key: string, value: string) => void;
}

const INPUT_CLS =
  'w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-200';
const LABEL_CLS = 'text-[10px] font-extrabold text-slate-400 mb-0.5 block';

function getRadType(config: Record<string, string>): 'panel_11' | 'panel_22' | 'panel_33' {
  const v = config['radiator_type'] ?? 'panel_22';
  if (v === 'panel_11' || v === 'panel_22' || v === 'panel_33') return v;
  return 'panel_22';
}

export default function RadiatorCalcSection({ room, scale, config, onUpdateConfig }: Props) {
  const areaM2 = room && scale ? polygonAreaM2(room.points, scale) : null;

  const roomHeight = parseFloat(config['calc_room_height'] || '') || (room.ceilingHeight ?? 2.6);
  const buildingType = config['calc_building_type'] || 'new_insulated';
  const flowTemp = parseFloat(config['calc_flow_temp'] || '') || 55;
  const returnTemp = parseFloat(config['calc_return_temp'] || '') || (flowTemp - 10);
  const indoorTemp = parseFloat(config['calc_indoor_temp'] || '') || 20;
  const radiatorCount = parseInt(config['calc_radiator_count'] || '', 10) || 1;
  const radiatorHeight = parseInt(config['calc_radiator_height'] || '', 10) || 554;
  const radType = getRadType(config);

  const result: RadiatorCalcResult | null = useMemo(() => {
    if (areaM2 === null || areaM2 <= 0) return null;
    return computeRadiatorSizing({
      areaM2,
      roomHeight,
      buildingType,
      flowTemp,
      returnTemp,
      indoorTemp,
      radiatorCount,
      radiatorType: radType,
      radiatorHeight,
    });
  }, [areaM2, roomHeight, buildingType, flowTemp, returnTemp, indoorTemp, radiatorCount, radType, radiatorHeight]);

  const setVal = (key: string, val: string) => onUpdateConfig(key, val);

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
        <Calculator className="w-3.5 h-3.5" /> Výpočet radiátorů
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
            max="90"
            value={config['calc_flow_temp'] || flowTemp}
            onChange={(e) => {
              setVal('calc_flow_temp', e.target.value);
              const ft = parseFloat(e.target.value);
              if (!isNaN(ft) && !config['calc_return_temp']) {
                setVal('calc_return_temp', String(ft - 10));
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
            max="85"
            value={config['calc_return_temp'] || returnTemp}
            onChange={(e) => setVal('calc_return_temp', e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLS}>Počet radiátorů</label>
          <input
            type="number"
            step="1"
            min="1"
            max="10"
            value={config['calc_radiator_count'] || radiatorCount}
            onChange={(e) => setVal('calc_radiator_count', e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Stavební výška</label>
          <select
            value={config['calc_radiator_height'] || radiatorHeight}
            onChange={(e) => setVal('calc_radiator_height', e.target.value)}
            className={INPUT_CLS}
          >
            {RADIATOR_HEIGHTS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-[9px] text-slate-400 flex items-center gap-1">
        <ArrowRight className="w-2.5 h-2.5 shrink-0" />
        Typ radiátoru ({radType.replace('panel_', 'typ ')}) se přebírá z konfigurace výše.
      </div>

      {result && <ResultCard result={result} radiatorCount={radiatorCount} radType={radType} />}
    </div>
  );
}

function ResultCard({
  result,
  radiatorCount,
  radType,
}: {
  result: RadiatorCalcResult;
  radiatorCount: number;
  radType: string;
}) {
  const isOk = result.coveragePercent >= 100;
  const borderColor = isOk ? 'border-emerald-200' : 'border-amber-200';
  const bgColor = isOk ? 'bg-emerald-500/10' : 'bg-amber-500/10';
  const typeLabel = radType.replace('panel_', 'typ ');

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-3 space-y-2.5`}>
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
        {isOk ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className={isOk ? 'text-emerald-800' : 'text-amber-800'}>
          Výsledek dimenzování
        </span>
      </div>

      <div className="space-y-1 text-[10px]">
        <Row label="Objem místnosti" value={`${result.volumeM3.toFixed(1)} m³`} />
        <Row label="Měrná ztráta" value={`${result.qWPerM3} W/m³`} sub />
        <Row label="Tepelná ztráta" value={`${Math.round(result.heatLossW)} W`} />
        <Row label="Návrhový výkon (+10 %)" value={`${Math.round(result.designPowerW)} W`} bold />
        {radiatorCount > 1 && (
          <Row
            label={`Na 1 radiátor (${radiatorCount} ks)`}
            value={`${Math.round(result.perRadiatorW)} W`}
          />
        )}
      </div>

      <div className="border-t border-white/10 pt-2 space-y-1 text-[10px]">
        <Row
          label={`\u0394T (${result.deltaT.toFixed(0)} K vs. ref. ${result.deltaTRef} K)`}
          value={`(${result.deltaT.toFixed(0)}/${result.deltaTRef})^${result.exponentN}`}
          sub
        />
        <Row
          label={`Katalog ${typeLabel} / ${result.catalogP50PerM} W/m`}
          value={`${Math.round(result.adjustedPowerPerM)} W/m`}
          sub
        />
      </div>

      <div className="border-t border-white/10 pt-2 space-y-1 text-[10px]">
        <Row label="Potřebná délka" value={`${result.requiredLengthMm} mm`} />
        <Row
          label="Doporučená délka"
          value={`${result.recommendedLengthMm} mm`}
          bold
          highlight
        />
        <Row
          label="Skutečný výkon"
          value={`${Math.round(result.actualOutputW)} W`}
          bold
        />
        <Row
          label="Pokrytí"
          value={`${result.coveragePercent.toFixed(0)} %`}
          bold
          highlight={result.coveragePercent >= 100}
          warn={result.coveragePercent < 100}
        />
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

function Row({
  label,
  value,
  bold,
  sub,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  bold?: boolean;
  sub?: boolean;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={sub ? 'text-slate-400' : 'text-slate-400'}>{label}</span>
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
