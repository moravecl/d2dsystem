import type { EpsDesignData } from '../hooks/useEpsDesign';
import type { EpsDetectorModel, EpsPanel, EpsSiren, EpsCable, EpsAccessory, EpsMotionSensor, EpsKeypad, EpsControlDevice } from '../hooks/useEpsCatalog';
import { polylineLength, normalizedToMeters } from '../components/catalog/floorplan/geometry';

export interface EpsPriceSummary {
  detectorsCost: number;
  panelsCost: number;
  sirensCost: number;
  cablesCost: number;
  accessoriesCost: number;
  motionSensorsCost: number;
  keypadsCost: number;
  controlDevicesCost: number;
  totalCost: number;
}

export function calcTotalPrice(
  designData: EpsDesignData,
  detectors: EpsDetectorModel[],
  panels: EpsPanel[],
  sirens: EpsSiren[],
  cables: EpsCable[],
  accessories: EpsAccessory[],
  motionSensors?: EpsMotionSensor[],
  keypads?: EpsKeypad[],
  controlDevices?: EpsControlDevice[],
  priceOverrides?: Record<string, number>,
): EpsPriceSummary {
  const overrides = priceOverrides ?? {};

  let detectorsCost = 0;
  for (const d of designData.detectors) {
    const model = detectors.find(m => m.id === d.modelId);
    if (model) detectorsCost += overrides[model.id] ?? model.price;
  }

  let panelsCost = 0;
  for (const p of designData.panels) {
    const model = panels.find(m => m.id === p.panelId);
    if (model) panelsCost += overrides[model.id] ?? model.price;
  }

  let sirensCost = 0;
  for (const s of designData.sirens) {
    const model = sirens.find(m => m.id === s.sirenId);
    if (model) sirensCost += overrides[model.id] ?? model.price;
  }

  let cablesCost = 0;
  for (const route of designData.routes) {
    const cable = cables.find(c => c.id === route.cableTypeId);
    if (cable && route.points.length >= 2) {
      const normLen = polylineLength(route.points);
      const effectiveScale = designData.layers[route.layerIndex]?.scale ?? designData.scale;
      const meters = effectiveScale ? normalizedToMeters(normLen, effectiveScale) : normLen * 10;
      cablesCost += meters * (overrides[cable.id] ?? cable.price_per_m);
    }
  }

  let accessoriesCost = 0;
  for (const item of designData.accessoryItems) {
    const acc = accessories.find(a => a.id === item.accessoryId);
    if (acc) accessoriesCost += (overrides[acc.id] ?? acc.price) * item.quantity;
  }

  let motionSensorsCost = 0;
  if (motionSensors) {
    for (const ms of (designData.motionSensors ?? [])) {
      const model = motionSensors.find(m => m.id === ms.sensorId);
      if (model) motionSensorsCost += overrides[model.id] ?? model.price;
    }
  }

  let keypadsCost = 0;
  if (keypads) {
    for (const kp of (designData.keypads ?? [])) {
      const model = keypads.find(m => m.id === kp.keypadId);
      if (model) keypadsCost += overrides[model.id] ?? model.price;
    }
  }

  let controlDevicesCost = 0;
  if (controlDevices) {
    for (const cd of (designData.controlDevices ?? [])) {
      const model = controlDevices.find(m => m.id === cd.deviceId);
      if (model) controlDevicesCost += overrides[model.id] ?? model.price;
    }
  }

  const total = detectorsCost + panelsCost + sirensCost + cablesCost + accessoriesCost + motionSensorsCost + keypadsCost + controlDevicesCost;

  return {
    detectorsCost: Math.round(detectorsCost),
    panelsCost: Math.round(panelsCost),
    sirensCost: Math.round(sirensCost),
    cablesCost: Math.round(cablesCost),
    accessoriesCost: Math.round(accessoriesCost),
    motionSensorsCost: Math.round(motionSensorsCost),
    keypadsCost: Math.round(keypadsCost),
    controlDevicesCost: Math.round(controlDevicesCost),
    totalCost: Math.round(total),
  };
}

export function calcCableLengthM(
  designData: EpsDesignData,
): number {
  let totalM = 0;
  for (const route of designData.routes) {
    if (route.points.length < 2) continue;
    const normLen = polylineLength(route.points);
    const effectiveScale = designData.layers[route.layerIndex]?.scale ?? designData.scale;
    totalM += effectiveScale ? normalizedToMeters(normLen, effectiveScale) : normLen * 10;
  }
  return Math.round(totalM * 10) / 10;
}

export function calcZoneUtilization(
  designData: EpsDesignData,
  panels: EpsPanel[],
): { totalDetectors: number; maxZones: number; utilization: number } {
  const totalDetectors = designData.detectors.length + (designData.motionSensors ?? []).length;
  let maxZones = 0;
  for (const p of designData.panels) {
    const model = panels.find(m => m.id === p.panelId);
    if (model) maxZones += model.max_zones;
  }
  return {
    totalDetectors,
    maxZones,
    utilization: maxZones > 0 ? Math.round((totalDetectors / maxZones) * 100) : 0,
  };
}

export interface DesignWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
}

export function validateDesign(
  designData: EpsDesignData,
  detectors: EpsDetectorModel[],
  panels: EpsPanel[],
): DesignWarning[] {
  const warnings: DesignWarning[] = [];

  if (designData.panels.length === 0) {
    warnings.push({ type: 'error', message: 'Chyb\u00ed \u00fastředna EPS/EZS' });
  }

  const zoneUtil = calcZoneUtilization(designData, panels);
  if (zoneUtil.maxZones > 0 && zoneUtil.totalDetectors > zoneUtil.maxZones) {
    warnings.push({ type: 'error', message: `P\u0159ekro\u010dena kapacita \u00fastředny: ${zoneUtil.totalDetectors}/${zoneUtil.maxZones} z\u00f3n` });
  }

  if (designData.detectors.length === 0 && (designData.motionSensors ?? []).length === 0) {
    warnings.push({ type: 'warning', message: '\u017d\u00e1dn\u00e9 detektory ani \u010didla v n\u00e1vrhu' });
  }

  const hasManualCallPoint = designData.detectors.some(d => {
    const model = detectors.find(m => m.id === d.modelId);
    return model?.detector_type === 'manual_call_point';
  });
  if (designData.detectors.length > 0 && !hasManualCallPoint) {
    warnings.push({ type: 'info', message: 'Doporu\u010den\u00ed: P\u0159idejte alespo\u0148 jedno tla\u010d\u00edtkov\u00e9 hla\u0161i\u010d' });
  }

  const hasSiren = designData.sirens.length > 0;
  if ((designData.detectors.length > 0 || (designData.motionSensors ?? []).length > 0) && !hasSiren) {
    warnings.push({ type: 'warning', message: '\u017d\u00e1dn\u00e1 sirén\u00e1 v n\u00e1vrhu' });
  }

  if ((designData.keypads ?? []).length === 0) {
    warnings.push({ type: 'info', message: 'Doporu\u010den\u00ed: P\u0159idejte kl\u00e1vesnici pro ovl\u00e1d\u00e1n\u00ed syst\u00e9mu' });
  }

  return warnings;
}
