import { BUILDING_TYPES } from './radiatorCalc';
export { BUILDING_TYPES };

export interface FloorCoveringType {
  value: string;
  label: string;
  rLambda: number;
}

export const FLOOR_COVERINGS: FloorCoveringType[] = [
  { value: 'tile', label: 'Dlažba / keramika', rLambda: 0.01 },
  { value: 'vinyl', label: 'Vinyl / PVC', rLambda: 0.02 },
  { value: 'laminate', label: 'Laminát', rLambda: 0.05 },
  { value: 'wood_thin', label: 'Dřevo (tenké, <12 mm)', rLambda: 0.07 },
  { value: 'wood_thick', label: 'Dřevo (silné, >12 mm)', rLambda: 0.10 },
  { value: 'carpet', label: 'Koberec', rLambda: 0.15 },
];

export interface PipeSpacingOption {
  valueMm: number;
  label: string;
}

export const PIPE_SPACINGS: PipeSpacingOption[] = [
  { valueMm: 100, label: '10 cm' },
  { valueMm: 125, label: '12,5 cm' },
  { valueMm: 150, label: '15 cm' },
  { valueMm: 200, label: '20 cm' },
  { valueMm: 250, label: '25 cm' },
  { valueMm: 300, label: '30 cm' },
];

const RESERVE_FACTOR = 1.10;

export interface FloorHeatCalcInput {
  areaM2: number;
  roomHeight: number;
  buildingType: string;
  indoorTemp: number;
  flowTemp: number;
  returnTemp: number;
  floorCovering: string;
  isDrySystem: boolean;
}

export interface SpacingResult {
  spacingMm: number;
  specificOutputWm2: number;
  totalOutputW: number;
  coveragePercent: number;
  pipeLengthM: number;
  flowRateLph: number;
  flowRateMs: number;
  sufficient: boolean;
}

export interface FloorHeatCalcResult {
  volumeM3: number;
  qWPerM3: number;
  heatLossW: number;
  designPowerW: number;
  requiredWm2: number;
  meanWaterTemp: number;
  deltaT: number;
  floorSurfaceTemp: number;
  maxAllowedWm2: number;
  spacingResults: SpacingResult[];
  recommendedSpacingMm: number;
  warnings: string[];
}

function getFloorCoveringR(value: string): number {
  return FLOOR_COVERINGS.find((f) => f.value === value)?.rLambda ?? 0.02;
}

export function computeFloorHeating(input: FloorHeatCalcInput): FloorHeatCalcResult | null {
  const bt = BUILDING_TYPES.find((b) => b.value === input.buildingType);
  if (!bt) return null;

  const volumeM3 = input.areaM2 * input.roomHeight;
  const heatLossW = volumeM3 * bt.q;
  const designPowerW = heatLossW * RESERVE_FACTOR;
  const requiredWm2 = designPowerW / input.areaM2;

  const meanWaterTemp = (input.flowTemp + input.returnTemp) / 2;
  const deltaT = meanWaterTemp - input.indoorTemp;

  if (deltaT <= 0) return null;

  const rCovering = getFloorCoveringR(input.floorCovering);
  const rScreed = input.isDrySystem ? 0.01 : 0.04;
  const rTotal = rCovering + rScreed + 0.10;

  const floorSurfaceTemp = input.indoorTemp + (deltaT * 0.85) / (1 + rTotal * 8);
  const maxAllowedWm2 = floorSurfaceTemp > 29 ? 100 : 150;

  const warnings: string[] = [];

  if (floorSurfaceTemp > 29) {
    warnings.push(`Teplota povrchu podlahy ${floorSurfaceTemp.toFixed(1)} °C překračuje normu 29 °C pro obytné místnosti.`);
  }

  const spacingResults: SpacingResult[] = [];
  let recommendedSpacingMm = 150;
  let bestFit: SpacingResult | null = null;

  const deltaTw = input.flowTemp - input.returnTemp;

  for (const sp of PIPE_SPACINGS) {
    const spacing = sp.valueMm;

    const spacingM = spacing / 1000;
    const alpha_b = 1 / (rTotal + spacingM / (2 * Math.PI * 0.35));
    const qFloor = alpha_b * deltaT;
    const specificOutput = Math.min(qFloor, maxAllowedWm2);

    const totalOutputW = specificOutput * input.areaM2;
    const coveragePercent = (totalOutputW / designPowerW) * 100;
    const sufficient = coveragePercent >= 100;

    const pipeLengthM = input.areaM2 / spacingM + input.areaM2 * 0.1;

    let flowRateLph = 0;
    let flowRateMs = 0;
    if (deltaTw > 0) {
      const flowKgH = (totalOutputW * 0.86) / deltaTw;
      flowRateLph = flowKgH;
      const pipeDiamInnerM = 0.013;
      const crossSection = Math.PI * (pipeDiamInnerM / 2) ** 2;
      flowRateMs = (flowKgH / 3600) / (1000 * crossSection);
    }

    const result: SpacingResult = {
      spacingMm: spacing,
      specificOutputWm2: Math.round(specificOutput),
      totalOutputW: Math.round(totalOutputW),
      coveragePercent,
      pipeLengthM: Math.round(pipeLengthM),
      flowRateLph: Math.round(flowRateLph),
      flowRateMs: Math.round(flowRateMs * 1000) / 1000,
      sufficient,
    };

    spacingResults.push(result);

    if (sufficient && (!bestFit || spacing > bestFit.spacingMm)) {
      bestFit = result;
    }
  }

  if (bestFit) {
    recommendedSpacingMm = bestFit.spacingMm;
  } else if (spacingResults.length > 0) {
    recommendedSpacingMm = spacingResults[0].spacingMm;
    warnings.push('Ani nejmenší rozteč nepokryje tepelnou ztrátu -- zvažte doplnkový zdroj nebo nižší požadavek.');
  }

  if (deltaT < 10) {
    warnings.push('Velmi nízký teplotní spád -- podlahové vytápění nebude efektivní.');
  }

  if (requiredWm2 > 100) {
    warnings.push('Požadovaný výkon přesahuje 100 W/m\u00B2 -- zvažte doplnkové radiátory nebo lepší zateplení.');
  }

  return {
    volumeM3,
    qWPerM3: bt.q,
    heatLossW,
    designPowerW,
    requiredWm2,
    meanWaterTemp,
    deltaT,
    floorSurfaceTemp,
    maxAllowedWm2,
    spacingResults,
    recommendedSpacingMm,
    warnings,
  };
}
