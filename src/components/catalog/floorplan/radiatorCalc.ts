export interface BuildingType {
  value: string;
  label: string;
  q: number;
}

export const BUILDING_TYPES: BuildingType[] = [
  { value: 'passive', label: 'Pasivní dům', q: 15 },
  { value: 'low_energy', label: 'Nízkoenergetický dům', q: 25 },
  { value: 'new_insulated', label: 'Novostavba / zateplený dům', q: 35 },
  { value: 'older_partial', label: 'Starší stavba, částečně zateplená', q: 45 },
  { value: 'older_uninsulated', label: 'Starší stavba, nezateplená (před 1990)', q: 55 },
  { value: 'very_old', label: 'Velmi starý objekt, bez zateplení', q: 65 },
];

export interface RadiatorHeightOption {
  value: number;
  label: string;
}

export const RADIATOR_HEIGHTS: RadiatorHeightOption[] = [
  { value: 300, label: '300 mm' },
  { value: 400, label: '400 mm' },
  { value: 500, label: '500 mm' },
  { value: 554, label: '554 mm (standard)' },
  { value: 600, label: '600 mm' },
  { value: 900, label: '900 mm' },
];

export const MANUFACTURED_LENGTHS = [
  400, 500, 600, 700, 800, 900, 1000, 1100, 1200,
  1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000,
];

interface CatalogEntry {
  p50PerMeter: number;
  n: number;
}

type RadType = 'panel_11' | 'panel_22' | 'panel_33';

const CATALOG: Record<RadType, Record<number, CatalogEntry>> = {
  panel_11: {
    300: { p50PerMeter: 460, n: 1.30 },
    400: { p50PerMeter: 580, n: 1.30 },
    500: { p50PerMeter: 700, n: 1.30 },
    554: { p50PerMeter: 807, n: 1.30 },
    600: { p50PerMeter: 860, n: 1.30 },
    900: { p50PerMeter: 1220, n: 1.29 },
  },
  panel_22: {
    300: { p50PerMeter: 810, n: 1.33 },
    400: { p50PerMeter: 1050, n: 1.33 },
    500: { p50PerMeter: 1290, n: 1.33 },
    554: { p50PerMeter: 1614, n: 1.33 },
    600: { p50PerMeter: 1580, n: 1.33 },
    900: { p50PerMeter: 2240, n: 1.32 },
  },
  panel_33: {
    300: { p50PerMeter: 1110, n: 1.32 },
    400: { p50PerMeter: 1440, n: 1.32 },
    500: { p50PerMeter: 1780, n: 1.32 },
    554: { p50PerMeter: 2224, n: 1.32 },
    600: { p50PerMeter: 2170, n: 1.32 },
    900: { p50PerMeter: 3080, n: 1.31 },
  },
};

const RESERVE_FACTOR = 1.10;

export interface RadiatorCalcInput {
  areaM2: number;
  roomHeight: number;
  buildingType: string;
  flowTemp: number;
  returnTemp: number;
  indoorTemp: number;
  radiatorCount: number;
  radiatorType: RadType;
  radiatorHeight: number;
}

export interface RadiatorCalcResult {
  volumeM3: number;
  qWPerM3: number;
  heatLossW: number;
  designPowerW: number;
  perRadiatorW: number;
  deltaT: number;
  deltaTRef: number;
  catalogP50PerM: number;
  exponentN: number;
  adjustedPowerPerM: number;
  requiredLengthMm: number;
  recommendedLengthMm: number;
  actualOutputW: number;
  coveragePercent: number;
  warnings: string[];
}

export function getCatalogEntry(type: RadType, height: number): CatalogEntry | null {
  return CATALOG[type]?.[height] ?? null;
}

export function computeRadiatorSizing(input: RadiatorCalcInput): RadiatorCalcResult | null {
  const bt = BUILDING_TYPES.find((b) => b.value === input.buildingType);
  if (!bt) return null;

  const catalog = getCatalogEntry(input.radiatorType, input.radiatorHeight);
  if (!catalog) return null;

  const volumeM3 = input.areaM2 * input.roomHeight;
  const heatLossW = volumeM3 * bt.q;
  const designPowerW = heatLossW * RESERVE_FACTOR;
  const count = Math.max(1, input.radiatorCount);
  const perRadiatorW = designPowerW / count;

  const tmw = (input.flowTemp + input.returnTemp) / 2;
  const deltaT = tmw - input.indoorTemp;
  const deltaTRef = 50;

  if (deltaT <= 0) return null;

  const ratio = deltaT / deltaTRef;
  const adjustedPowerPerM = catalog.p50PerMeter * Math.pow(ratio, catalog.n);

  if (adjustedPowerPerM <= 0) return null;

  const requiredLengthM = perRadiatorW / adjustedPowerPerM;
  const requiredLengthMm = Math.ceil(requiredLengthM * 1000);

  const recommendedLengthMm = snapToManufacturedLength(requiredLengthMm);
  const actualOutputW = adjustedPowerPerM * (recommendedLengthMm / 1000);
  const coveragePercent = (actualOutputW / perRadiatorW) * 100;

  const warnings: string[] = [];
  if (deltaT < 15) {
    warnings.push('Velmi nízký teplotní spád -- zvažte podlahové vytápění nebo větší radiátory.');
  }
  if (recommendedLengthMm > 3000) {
    warnings.push('Délka přesahuje 3 000 mm -- zvyšte počet radiátorů nebo zvolte vyšší typ (11\u219222, 22\u219233).');
  }
  if (requiredLengthMm > 3000 && recommendedLengthMm <= 3000) {
    warnings.push('Délka je na hranici maxima -- zvažte přidání radiátoru.');
  }

  return {
    volumeM3,
    qWPerM3: bt.q,
    heatLossW,
    designPowerW,
    perRadiatorW,
    deltaT,
    deltaTRef,
    catalogP50PerM: catalog.p50PerMeter,
    exponentN: catalog.n,
    adjustedPowerPerM,
    requiredLengthMm,
    recommendedLengthMm,
    actualOutputW,
    coveragePercent,
    warnings,
  };
}

function snapToManufacturedLength(mm: number): number {
  for (const len of MANUFACTURED_LENGTHS) {
    if (len >= mm) return len;
  }
  return MANUFACTURED_LENGTHS[MANUFACTURED_LENGTHS.length - 1];
}
