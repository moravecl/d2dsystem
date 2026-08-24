export interface FvInputParams {
  address: string;
  lat: number;
  lon: number;
  annualConsumptionKwh: number;
  electricityPriceCzkPerKwh: number;
  gridFeedInPriceCzkPerKwh: number;
  heatingSource: 'heat_pump' | 'electric_boiler' | 'gas' | 'other';
  hotWaterSource: 'electric' | 'gas' | 'heat_pump' | 'other';
  evCount: number;
  evKmPerYear: number;
}

export interface RoofMountingConfig {
  roofTileId?: string;
  hookId?: string;
  railProfileId?: string;
  midClampId?: string;
  endClampId?: string;
  hookSpacingMm?: number;
  showConstruction?: boolean;
}

export interface RoofSurface {
  id: string;
  name: string;
  azimuthDeg: number;
  tiltDeg: number;
  panelCount: number;
  panelPowerWp: number;
  panelWidthMm: number;
  panelHeightMm: number;
  panelId?: string;
  imageUrl?: string;
  points?: { x: number; y: number }[];
  scale?: { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };
  mounting?: RoofMountingConfig;
  placedPanels?: { x: number; y: number; rotated: boolean }[];
  fillRegion?: { x: number; y: number }[];
  snapshotDataUrl?: string;
}

export interface PvgisMonthlyResult {
  month: number;
  monthLabel: string;
  productionKwh: number;
  consumptionKwh: number;
  selfConsumptionKwh: number;
  gridFeedKwh: number;
  gridDrawKwh: number;
  directSelfConsumptionKwh: number;
  batteryContributionKwh: number;
  batteryChargeKwh: number;
  batteryDischargeKwh: number;
  batteryStartSocKwh: number;
  batteryEndSocKwh: number;
}

export interface PvgisRoofInput {
  roofId: string;
  roofName: string;
  lat: number;
  lon: number;
  peakPowerKwp: number;
  aspect: number;
  angle: number;
  loss: number;
  mountingplace: string;
}

export interface PvgisRoofOutput {
  roofId: string;
  roofName: string;
  monthlyKwh: number[];
  annualKwh: number;
  success: boolean;
  source: 'pvgis' | 'fallback';
  errorMessage?: string;
  requestUrl?: string;
  httpStatus?: number;
  rawResponseError?: string;
}

export interface PvgisDebugData {
  address: string;
  lat: number;
  lon: number;
  roofInputs: PvgisRoofInput[];
  roofOutputs: PvgisRoofOutput[];
  totalPvgisAnnualKwh: number;
  totalPvgisMonthlyKwh: number[];
}

export interface FvCalculationResult {
  totalPowerKwp: number;
  annualProductionKwh: number;
  annualConsumptionKwh: number;
  selfConsumptionKwh: number;
  selfConsumptionPct: number;
  gridFeedKwh: number;
  gridDrawKwh: number;
  coveragePct: number;
  annualSavingsCzk: number;
  annualFeedInRevenueCzk: number;
  totalAnnualBenefitCzk: number;
  recommendedBatteryKwh: number;
  monthly: PvgisMonthlyResult[];
  co2SavedKg: number;
  batteryContributionKwh?: number;
  pvgisDebug?: PvgisDebugData;
}

export interface BatterySimParams {
  capacityKwh: number;
  chargeEfficiency?: number;
  dischargeEfficiency?: number;
  maxDodPct?: number;
}

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

const BASE_CONSUMPTION = [0.95, 0.92, 0.90, 0.85, 0.82, 0.80, 0.79, 0.80, 0.84, 0.88, 0.92, 0.96];

const HEATING_LOAD: Record<FvInputParams['heatingSource'], number[]> = {
  heat_pump:       [1.80, 1.50, 1.10, 0.50, 0.15, 0.00, 0.00, 0.00, 0.20, 0.60, 1.20, 1.70],
  electric_boiler: [2.20, 1.80, 1.30, 0.60, 0.10, 0.00, 0.00, 0.00, 0.15, 0.70, 1.50, 2.10],
  gas:             [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  other:           [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
};

const HOT_WATER_LOAD: Record<FvInputParams['hotWaterSource'], number[]> = {
  electric:  [1.10, 1.05, 1.00, 0.95, 0.90, 0.85, 0.85, 0.85, 0.90, 0.95, 1.00, 1.10],
  gas:       [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  heat_pump: [0.60, 0.55, 0.50, 0.45, 0.42, 0.40, 0.40, 0.40, 0.42, 0.45, 0.50, 0.60],
  other:     [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
};

export function getMonthlyConsumptionProfile(
  heatingSource: FvInputParams['heatingSource'],
  hotWaterSource: FvInputParams['hotWaterSource'],
): number[] {
  const h = HEATING_LOAD[heatingSource];
  const w = HOT_WATER_LOAD[hotWaterSource];
  return BASE_CONSUMPTION.map((b, m) => b + h[m] + w[m]);
}

export interface FetchPvgisResult {
  monthly: number[];
  annual: number;
  input: PvgisRoofInput;
  requestUrl: string;
}

export interface FetchPvgisError {
  input: PvgisRoofInput;
  requestUrl: string;
  httpStatus?: number;
  errorMessage: string;
}

export async function fetchPvgisData(
  lat: number,
  lon: number,
  peakPowerKwp: number,
  azimuth: number,
  tilt: number,
  roofId: string,
  roofName: string,
  loss = 14,
  mountingplace = 'building',
): Promise<{ result: FetchPvgisResult | null; error: FetchPvgisError | null }> {
  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pvgis-proxy`;

  const input: PvgisRoofInput = {
    roofId,
    roofName,
    lat,
    lon,
    peakPowerKwp,
    aspect: azimuth,
    angle: tilt,
    loss,
    mountingplace,
  };

  try {
    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        lat,
        lon,
        peakpower: peakPowerKwp,
        aspect: azimuth,
        angle: tilt,
        loss,
        mountingplace,
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '');
      return {
        result: null,
        error: {
          input,
          requestUrl: proxyUrl,
          httpStatus: resp.status,
          errorMessage: `Proxy HTTP ${resp.status}: ${resp.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ''}`,
        },
      };
    }

    const data = await resp.json();

    if (!data.success) {
      return {
        result: null,
        error: {
          input,
          requestUrl: data.requestUrl ?? proxyUrl,
          errorMessage: data.error ?? 'Unknown PVGIS error',
        },
      };
    }

    return {
      result: {
        monthly: data.monthly,
        annual: data.annual,
        input,
        requestUrl: data.requestUrl ?? proxyUrl,
      },
      error: null,
    };
  } catch (err) {
    return {
      result: null,
      error: {
        input,
        requestUrl: proxyUrl,
        errorMessage: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}

const HOURLY_PRODUCTION_PROFILE = [
  0, 0, 0, 0, 0, 0.02, 0.08, 0.15, 0.22, 0.28, 0.32, 0.35,
  0.36, 0.35, 0.32, 0.28, 0.22, 0.15, 0.08, 0.02, 0, 0, 0, 0,
];

const HOURLY_CONSUMPTION_PROFILE = [
  0.02, 0.015, 0.012, 0.012, 0.015, 0.025, 0.05, 0.065, 0.055, 0.04, 0.035, 0.04,
  0.055, 0.045, 0.04, 0.045, 0.055, 0.075, 0.09, 0.085, 0.07, 0.055, 0.04, 0.025,
];

interface DaySimResult {
  directSelfConsumption: number;
  batteryContribution: number;
  batteryCharge: number;
  batteryDischarge: number;
  gridFeed: number;
  gridDraw: number;
  batteryEndSoc: number;
}

function simulateDay(
  dailyProductionKwh: number,
  dailyConsumptionKwh: number,
  batteryStartSoc: number,
  usableCapacity: number,
  chargeEff: number,
  dischargeEff: number,
): DaySimResult {
  const prodNorm = HOURLY_PRODUCTION_PROFILE.reduce((s, v) => s + v, 0);
  const consNorm = HOURLY_CONSUMPTION_PROFILE.reduce((s, v) => s + v, 0);

  let batteryState = batteryStartSoc;
  let directSelfConsumption = 0;
  let batteryContribution = 0;
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let gridFeed = 0;
  let gridDraw = 0;

  for (let h = 0; h < 24; h++) {
    const production = dailyProductionKwh * (HOURLY_PRODUCTION_PROFILE[h] / prodNorm);
    const consumption = dailyConsumptionKwh * (HOURLY_CONSUMPTION_PROFILE[h] / consNorm);

    const directSelf = Math.min(production, consumption);
    directSelfConsumption += directSelf;

    const surplus = production - directSelf;
    const deficit = consumption - directSelf;

    if (surplus > 0 && usableCapacity > 0) {
      const canCharge = (usableCapacity - batteryState) / chargeEff;
      const charged = Math.min(surplus, canCharge);
      batteryState += charged * chargeEff;
      batteryCharge += charged * chargeEff;
      gridFeed += surplus - charged;
    } else if (surplus > 0) {
      gridFeed += surplus;
    }

    if (deficit > 0 && batteryState > 0) {
      const canDischarge = batteryState * dischargeEff;
      const discharged = Math.min(deficit, canDischarge);
      batteryState -= discharged / dischargeEff;
      batteryDischarge += discharged / dischargeEff;
      batteryContribution += discharged;
      gridDraw += deficit - discharged;
    } else if (deficit > 0) {
      gridDraw += deficit;
    }
  }

  return {
    directSelfConsumption,
    batteryContribution,
    batteryCharge,
    batteryDischarge,
    gridFeed,
    gridDraw,
    batteryEndSoc: batteryState,
  };
}

export async function calculateFvSystem(
  params: FvInputParams,
  roofs: RoofSurface[],
  batteryCapacityKwh = 0,
  batteryParams?: Partial<BatterySimParams>,
): Promise<FvCalculationResult> {
  const totalPowerKwp = roofs.reduce((sum, r) => sum + (r.panelCount * r.panelPowerWp) / 1000, 0);

  const monthlyProductionRaw: number[] = new Array(12).fill(0);
  const pvgisRoofInputs: PvgisRoofInput[] = [];
  const pvgisRoofOutputs: PvgisRoofOutput[] = [];

  for (const roof of roofs) {
    if (roof.panelCount === 0) continue;
    const roofPowerKwp = (roof.panelCount * roof.panelPowerWp) / 1000;
    if (roofPowerKwp <= 0) continue;

    const { result: pvgis, error: pvgisError } = await fetchPvgisData(
      params.lat,
      params.lon,
      roofPowerKwp,
      roof.azimuthDeg,
      roof.tiltDeg,
      roof.id,
      roof.name,
    );
    if (pvgis) {
      pvgisRoofInputs.push(pvgis.input);
      pvgisRoofOutputs.push({
        roofId: roof.id,
        roofName: roof.name,
        monthlyKwh: pvgis.monthly,
        annualKwh: pvgis.annual,
        success: true,
        source: 'pvgis',
        requestUrl: pvgis.requestUrl,
      });
      for (let m = 0; m < 12; m++) {
        monthlyProductionRaw[m] += pvgis.monthly[m];
      }
    } else {
      const estimated = estimateProduction(roofPowerKwp, params.lat, roof.azimuthDeg, roof.tiltDeg);
      const input: PvgisRoofInput = pvgisError?.input ?? {
        roofId: roof.id,
        roofName: roof.name,
        lat: params.lat,
        lon: params.lon,
        peakPowerKwp: roofPowerKwp,
        aspect: roof.azimuthDeg,
        angle: roof.tiltDeg,
        loss: 14,
        mountingplace: 'building',
      };
      pvgisRoofInputs.push(input);
      pvgisRoofOutputs.push({
        roofId: roof.id,
        roofName: roof.name,
        monthlyKwh: estimated,
        annualKwh: estimated.reduce((s, v) => s + v, 0),
        success: false,
        source: 'fallback',
        errorMessage: pvgisError?.errorMessage ?? 'PVGIS API nedostupné, použit odhad',
        requestUrl: pvgisError?.requestUrl,
        httpStatus: pvgisError?.httpStatus,
        rawResponseError: pvgisError?.errorMessage,
      });
      for (let m = 0; m < 12; m++) {
        monthlyProductionRaw[m] += estimated[m];
      }
    }
  }

  const pvgisDebug: PvgisDebugData = {
    address: params.address,
    lat: params.lat,
    lon: params.lon,
    roofInputs: pvgisRoofInputs,
    roofOutputs: pvgisRoofOutputs,
    totalPvgisAnnualKwh: pvgisRoofOutputs.reduce((s, o) => s + o.annualKwh, 0),
    totalPvgisMonthlyKwh: monthlyProductionRaw.slice(),
  };

  const annualProductionKwh = monthlyProductionRaw.reduce((s, v) => s + v, 0);
  const annualConsumptionKwh = params.annualConsumptionKwh;

  const consumptionProfile = getMonthlyConsumptionProfile(params.heatingSource, params.hotWaterSource);
  const totalConsumptionWeight = consumptionProfile.reduce((s, v) => s + v, 0);
  const monthly: PvgisMonthlyResult[] = [];

  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const chargeEff = batteryParams?.chargeEfficiency ?? 0.95;
  const dischargeEff = batteryParams?.dischargeEfficiency ?? 0.95;
  const maxDod = batteryParams?.maxDodPct ?? 90;
  const usableCapacity = batteryCapacityKwh * (maxDod / 100);

  let batteryState = usableCapacity * 0.5;

  let totalSelfConsumption = 0;
  let totalGridFeed = 0;
  let totalGridDraw = 0;
  let totalBatteryContribution = 0;

  for (let m = 0; m < 12; m++) {
    const production = monthlyProductionRaw[m];
    const consumption = annualConsumptionKwh * (consumptionProfile[m] / totalConsumptionWeight);
    const days = DAYS_IN_MONTH[m];

    const dailyProd = production / days;
    const dailyCons = consumption / days;

    let monthDirectSelf = 0;
    let monthGridFeed = 0;
    let monthGridDraw = 0;
    let monthBatteryContribution = 0;
    let monthBatteryCharge = 0;
    let monthBatteryDischarge = 0;
    const monthStartSoc = batteryState;

    for (let d = 0; d < days; d++) {
      const dayResult = simulateDay(
        dailyProd,
        dailyCons,
        batteryState,
        usableCapacity,
        chargeEff,
        dischargeEff,
      );
      monthDirectSelf += dayResult.directSelfConsumption;
      monthGridFeed += dayResult.gridFeed;
      monthGridDraw += dayResult.gridDraw;
      monthBatteryContribution += dayResult.batteryContribution;
      monthBatteryCharge += dayResult.batteryCharge;
      monthBatteryDischarge += dayResult.batteryDischarge;
      batteryState = dayResult.batteryEndSoc;
    }

    const monthSelf = monthDirectSelf + monthBatteryContribution;
    totalSelfConsumption += monthSelf;
    totalGridFeed += monthGridFeed;
    totalGridDraw += monthGridDraw;
    totalBatteryContribution += monthBatteryContribution;

    monthly.push({
      month: m + 1,
      monthLabel: MONTH_LABELS[m],
      productionKwh: Math.round(production),
      consumptionKwh: Math.round(consumption),
      selfConsumptionKwh: Math.round(monthSelf),
      gridFeedKwh: Math.round(monthGridFeed),
      gridDrawKwh: Math.round(monthGridDraw),
      directSelfConsumptionKwh: Math.round(monthDirectSelf),
      batteryContributionKwh: Math.round(monthBatteryContribution),
      batteryChargeKwh: Math.round(monthBatteryCharge),
      batteryDischargeKwh: Math.round(monthBatteryDischarge),
      batteryStartSocKwh: Math.round(monthStartSoc * 10) / 10,
      batteryEndSocKwh: Math.round(batteryState * 10) / 10,
    });
  }

  const selfConsumptionPct = annualConsumptionKwh > 0 ? (totalSelfConsumption / annualConsumptionKwh) * 100 : 0;
  const coveragePct = annualConsumptionKwh > 0 ? (totalSelfConsumption / annualConsumptionKwh) * 100 : 0;
  const annualSavingsCzk = totalSelfConsumption * params.electricityPriceCzkPerKwh;
  const annualFeedInRevenueCzk = totalGridFeed * params.gridFeedInPriceCzkPerKwh;
  const totalAnnualBenefitCzk = annualSavingsCzk + annualFeedInRevenueCzk;

  const peakMonthlyConsumption = Math.max(...monthly.map(m => m.consumptionKwh)) / 30;
  const recommendedBatteryKwh = Math.round(peakMonthlyConsumption * 1.5 * 10) / 10;

  const co2SavedKg = Math.round(totalSelfConsumption * 0.43);

  return {
    totalPowerKwp: Math.round(totalPowerKwp * 100) / 100,
    annualProductionKwh: Math.round(annualProductionKwh),
    annualConsumptionKwh: Math.round(annualConsumptionKwh),
    selfConsumptionKwh: Math.round(totalSelfConsumption),
    selfConsumptionPct: Math.round(selfConsumptionPct),
    gridFeedKwh: Math.round(totalGridFeed),
    gridDrawKwh: Math.round(totalGridDraw),
    coveragePct: Math.round(coveragePct),
    annualSavingsCzk: Math.round(annualSavingsCzk),
    annualFeedInRevenueCzk: Math.round(annualFeedInRevenueCzk),
    totalAnnualBenefitCzk: Math.round(totalAnnualBenefitCzk),
    recommendedBatteryKwh,
    monthly,
    co2SavedKg,
    batteryContributionKwh: batteryCapacityKwh > 0 ? Math.round(totalBatteryContribution) : undefined,
    pvgisDebug,
  };
}

function estimateProduction(powerKwp: number, lat: number, azimuth: number, tilt: number): number[] {
  const latRad = (lat * Math.PI) / 180;
  const tiltRad = (tilt * Math.PI) / 180;
  const azRad = (azimuth * Math.PI) / 180;

  const MONTHS_DECL = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];
  const EXTRA_TERR = [1.412, 1.345, 1.203, 1.046, 0.920, 0.855, 0.871, 0.961, 1.091, 1.221, 1.354, 1.416];
  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const CLEARNESS = [0.35, 0.38, 0.42, 0.44, 0.46, 0.47, 0.48, 0.47, 0.44, 0.40, 0.35, 0.33];

  const monthlyKwh: number[] = [];

  for (let m = 0; m < 12; m++) {
    const decl = (MONTHS_DECL[m] * Math.PI) / 180;
    const cosOmegaS = -Math.tan(latRad) * Math.tan(decl);
    const omegaS = Math.acos(Math.max(-1, Math.min(1, cosOmegaS)));

    const hGlobal = EXTRA_TERR[m] * CLEARNESS[m] * (24 / Math.PI) *
      (Math.cos(latRad) * Math.cos(decl) * Math.sin(omegaS) + omegaS * Math.sin(latRad) * Math.sin(decl));

    const hDiffuse = hGlobal * (1.0 - 1.13 * CLEARNESS[m]);
    const hBeam = hGlobal - hDiffuse;

    const rb = Math.max(0,
      (Math.cos(latRad - tiltRad) * Math.cos(decl) * Math.sin(omegaS) + omegaS * Math.sin(latRad - tiltRad) * Math.sin(decl)) /
      (Math.cos(latRad) * Math.cos(decl) * Math.sin(omegaS) + omegaS * Math.sin(latRad) * Math.sin(decl))
    );

    const azimuthFactor = Math.max(0.6, Math.cos(azRad));
    const hTilted = hBeam * rb * azimuthFactor + hDiffuse * (1 + Math.cos(tiltRad)) / 2 + hGlobal * 0.2 * (1 - Math.cos(tiltRad)) / 2;

    const dailyKwh = powerKwp * hTilted * 0.82;
    monthlyKwh.push(Math.max(0, dailyKwh * DAYS_IN_MONTH[m]));
  }

  return monthlyKwh;
}

export function calculatePayback(
  totalInvestmentCzk: number,
  annualBenefitCzk: number,
  annualDegradationPct = 0.5,
  discountRatePct = 4,
): { years: number; npv10: number; npv20: number } {
  if (annualBenefitCzk <= 0) return { years: 99, npv10: -totalInvestmentCzk, npv20: -totalInvestmentCzk };

  let cumulative = -totalInvestmentCzk;
  let years = 0;
  let benefit = annualBenefitCzk;

  for (let y = 1; y <= 30; y++) {
    cumulative += benefit;
    benefit *= (1 - annualDegradationPct / 100);
    if (cumulative >= 0 && years === 0) years = y;
  }

  // B5: skutečné NPV — roční přínos diskontovaný sazbou discountRatePct
  let npv10 = -totalInvestmentCzk;
  let npv20 = -totalInvestmentCzk;
  benefit = annualBenefitCzk;
  const r = discountRatePct / 100;
  for (let y = 1; y <= 20; y++) {
    const discounted = benefit / Math.pow(1 + r, y);
    if (y <= 10) npv10 += discounted;
    npv20 += discounted;
    benefit *= (1 - annualDegradationPct / 100);
  }

  return { years: years || 99, npv10: Math.round(npv10), npv20: Math.round(npv20) };
}

export function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  return fetch(url, { headers: { 'Accept-Language': 'cs' } })
    .then(r => r.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) return null;
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    })
    .catch(() => null);
}
