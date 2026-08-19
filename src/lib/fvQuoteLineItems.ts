import type { FvCatalogData, FvLaborRate } from '../hooks/useFvCatalog';
import type { FvSystemConfig } from '../hooks/useFvDesign';
import type { RoofSurface } from './fvCalculations';

export interface FvQuoteLineItem {
  key: string;
  category: 'panels' | 'inverter' | 'battery' | 'wallbox' | 'accessories' | 'construction' | 'labor' | 'custom';
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  totalCost: number;
  discountPct?: number;
}

export interface FvQuoteTotals {
  totalPrice: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPct: number;
  subsidyCzk: number;
  finalPrice: number;
}

export interface ConstructionBreakdown {
  hooksCost: number;
  hooksPrice: number;
  profilesCost: number;
  profilesPrice: number;
  midClampsCost: number;
  midClampsPrice: number;
  endClampsCost: number;
  endClampsPrice: number;
  totalCost: number;
  totalPrice: number;
}

const TECH_MAP: Record<string, string> = { mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jiná' };

export function calcConstructionBreakdown(
  roofs: RoofSurface[],
  catalog: FvCatalogData,
): ConstructionBreakdown {
  let hooksCost = 0, hooksPrice = 0;
  let profilesCost = 0, profilesPrice = 0;
  let midClampsCost = 0, midClampsPrice = 0;
  let endClampsCost = 0, endClampsPrice = 0;

  for (const roof of roofs) {
    if (roof.panelCount === 0 || !roof.mounting) continue;
    const m = roof.mounting;

    const selTile = catalog.roofTiles.find(t => t.id === m.roofTileId);
    const selHook = catalog.hooks.find(h => h.id === m.hookId);
    const selRail = catalog.railProfiles.find(rp => rp.id === m.railProfileId);
    const selMidClamp = catalog.clamps.find(c => c.id === m.midClampId);
    const selEndClamp = catalog.clamps.find(c => c.id === m.endClampId);

    const hookSpacing = m.hookSpacingMm ?? selTile?.hook_spacing_mm ?? 350;
    const railCount = 2;
    const panelCount = roof.panelCount;
    const totalRailLengthPerRow = roof.panelWidthMm * panelCount;
    const totalRailLengthMm = totalRailLengthPerRow * railCount;
    const hooksPerRail = Math.max(2, Math.ceil(totalRailLengthPerRow / hookSpacing) + 1);
    const totalHooks = hooksPerRail * railCount;

    if (selHook) {
      hooksPrice += totalHooks * selHook.price;
      hooksCost += totalHooks * (selHook.purchase_price ?? selHook.price * 0.75);
    }
    if (selRail) {
      const meters = totalRailLengthMm / 1000;
      profilesPrice += meters * selRail.price_per_m;
      profilesCost += meters * (selRail.purchase_price_per_m ?? selRail.price_per_m * 0.75);
    }
    const midCount = (panelCount - 1) * railCount;
    if (selMidClamp && midCount > 0) {
      midClampsPrice += midCount * selMidClamp.price;
      midClampsCost += midCount * (selMidClamp.purchase_price ?? selMidClamp.price * 0.75);
    }
    const endCount = 2 * railCount;
    if (selEndClamp && endCount > 0) {
      endClampsPrice += endCount * selEndClamp.price;
      endClampsCost += endCount * (selEndClamp.purchase_price ?? selEndClamp.price * 0.75);
    }
  }

  return {
    hooksCost, hooksPrice,
    profilesCost, profilesPrice,
    midClampsCost, midClampsPrice,
    endClampsCost, endClampsPrice,
    totalCost: hooksCost + profilesCost + midClampsCost + endClampsCost,
    totalPrice: hooksPrice + profilesPrice + midClampsPrice + endClampsPrice,
  };
}

export function calcAutoLaborCostAndPrice(
  catalog: FvCatalogData,
  config: FvSystemConfig,
  roofs: RoofSurface[],
): { price: number; cost: number } {
  const rates = catalog.laborRates;
  if (rates.length === 0) return { price: 0, cost: 0 };

  let totalPrice = 0;
  let totalCost = 0;
  const panelCount = roofs.reduce((s, r) => s + r.panelCount, 0);

  const addRate = (rate: FvLaborRate, count: number) => {
    totalPrice += rate.price_per_unit * count;
    totalCost += (rate.purchase_price_per_unit ?? rate.price_per_unit * 0.6) * count;
  };

  const panelRates = rates.filter(r => r.component_type === 'panel');
  for (const rate of panelRates) addRate(rate, panelCount);

  if (config.inverterId) {
    const invRates = rates.filter(r => r.component_type === 'inverter');
    for (const rate of invRates) addRate(rate, 1);
  }

  const batCount = (config.batteryCount ?? 0) + (config.slaveBatteryCount ?? 0);
  if (batCount > 0) {
    const batRates = rates.filter(r => r.component_type === 'battery');
    for (const rate of batRates) addRate(rate, batCount);
  }

  if (config.wallboxId) {
    const wbRates = rates.filter(r => r.component_type === 'wallbox');
    for (const rate of wbRates) addRate(rate, 1);
  }

  const constRates = rates.filter(r => r.component_type === 'construction');
  if (constRates.length > 0) {
    for (const rate of constRates) addRate(rate, panelCount);
  }

  const otherRates = rates.filter(r => r.component_type === 'other');
  for (const rate of otherRates) addRate(rate, 1);

  return { price: Math.round(totalPrice), cost: Math.round(totalCost) };
}

export function buildFvQuoteLineItems(
  catalog: FvCatalogData,
  config: FvSystemConfig,
  roofs: RoofSurface[],
): FvQuoteLineItem[] {
  const items: FvQuoteLineItem[] = [];

  roofs.filter(r => r.panelCount > 0).forEach(r => {
    const panel = catalog.panels.find(p => p.id === r.panelId);
    const unitPrice = panel?.price ?? 0;
    const unitCost = panel?.purchase_price ?? unitPrice * 0.75;
    items.push({
      key: `panel-${r.id}`,
      category: 'panels',
      name: panel
        ? `${panel.name} (${panel.power_wp} Wp, ${TECH_MAP[panel.technology] ?? panel.technology}) - ${r.name}`
        : `FV panely ${r.name} (${r.panelPowerWp} Wp)`,
      qty: r.panelCount,
      unit: 'ks',
      unitPrice,
      unitCost,
      totalPrice: r.panelCount * unitPrice,
      totalCost: r.panelCount * unitCost,
    });
  });

  const inverter = catalog.inverters.find(i => i.id === config.inverterId);
  if (inverter) {
    const unitCost = inverter.purchase_price ?? inverter.price * 0.75;
    items.push({
      key: 'inverter',
      category: 'inverter',
      name: `Střídač ${inverter.name} (${inverter.power_kw} kW)`,
      qty: 1,
      unit: 'ks',
      unitPrice: inverter.price,
      unitCost,
      totalPrice: inverter.price,
      totalCost: unitCost,
    });
  }

  const masterBat = catalog.batteries.find(b => b.id === config.batteryId);
  if (masterBat && (config.batteryCount ?? 0) > 0) {
    const cnt = config.batteryCount ?? 1;
    const unitCost = masterBat.purchase_price ?? masterBat.price * 0.75;
    items.push({
      key: 'battery-master',
      category: 'battery',
      name: `Baterie master ${masterBat.name} (${masterBat.capacity_kwh} kWh)`,
      qty: cnt,
      unit: 'ks',
      unitPrice: masterBat.price,
      unitCost,
      totalPrice: masterBat.price * cnt,
      totalCost: unitCost * cnt,
    });
  }

  const slaveBat = catalog.batteries.find(b => b.id === config.slaveBatteryId);
  if (slaveBat && (config.slaveBatteryCount ?? 0) > 0) {
    const cnt = config.slaveBatteryCount ?? 1;
    const unitCost = slaveBat.purchase_price ?? slaveBat.price * 0.75;
    items.push({
      key: 'battery-slave',
      category: 'battery',
      name: `Baterie slave ${slaveBat.name} (${slaveBat.capacity_kwh} kWh)`,
      qty: cnt,
      unit: 'ks',
      unitPrice: slaveBat.price,
      unitCost,
      totalPrice: slaveBat.price * cnt,
      totalCost: unitCost * cnt,
    });
  }

  const wallbox = catalog.wallboxes.find(w => w.id === config.wallboxId);
  if (wallbox) {
    const unitCost = wallbox.purchase_price ?? wallbox.price * 0.75;
    items.push({
      key: 'wallbox',
      category: 'wallbox',
      name: `Wallbox ${wallbox.name} (${wallbox.power_kw} kW)`,
      qty: 1,
      unit: 'ks',
      unitPrice: wallbox.price,
      unitCost,
      totalPrice: wallbox.price,
      totalCost: unitCost,
    });
  }

  (config.accessories ?? []).forEach(a => {
    const acc = catalog.accessories.find(x => x.id === a.accessoryId);
    if (!acc || a.quantity === 0) return;
    const unitCost = acc.purchase_price_per_unit ?? acc.price_per_unit * 0.75;
    items.push({
      key: `acc-${a.accessoryId}`,
      category: 'accessories',
      name: acc.name,
      qty: a.quantity,
      unit: acc.unit,
      unitPrice: acc.price_per_unit,
      unitCost,
      totalPrice: acc.price_per_unit * a.quantity,
      totalCost: unitCost * a.quantity,
    });
  });

  const cb = calcConstructionBreakdown(roofs, catalog);
  if (cb.totalPrice > 0) {
    const constPrice = config.constructionPriceOverride !== undefined && config.constructionPriceOverride !== null
      ? config.constructionPriceOverride
      : cb.totalPrice;
    const constCost = config.constructionPriceOverride !== undefined && config.constructionPriceOverride !== null
      ? cb.totalCost
      : cb.totalCost;
    items.push({
      key: 'construction-bundle',
      category: 'construction',
      name: 'Montážní konstrukce',
      qty: 1,
      unit: 'komplet',
      unitPrice: constPrice,
      unitCost: constCost,
      totalPrice: constPrice,
      totalCost: constCost,
    });
  }

  const autoLabor = calcAutoLaborCostAndPrice(catalog, config, roofs);
  const laborPrice = config.laborOverride !== undefined && config.laborOverride !== null
    ? config.laborOverride
    : (config.laborCost && config.laborCost > 0 ? config.laborCost : autoLabor.price);
  const laborCost = config.laborOverride !== undefined && config.laborOverride !== null
    ? config.laborOverride * 0.6
    : (config.laborCost && config.laborCost > 0 ? config.laborCost * 0.6 : autoLabor.cost);

  if (laborPrice > 0) {
    items.push({
      key: 'labor',
      category: 'labor',
      name: 'Montáž, administrativa, revize',
      qty: 1,
      unit: 'pausal',
      unitPrice: laborPrice,
      unitCost: laborCost,
      totalPrice: laborPrice,
      totalCost: laborCost,
    });
  }

  (config.customItems ?? []).forEach(ci => {
    if (ci.qty <= 0) return;
    const unitCost = ci.unitPrice * 0.75;
    items.push({
      key: `custom-${ci.id}`,
      category: 'custom',
      name: ci.name || 'Vlastní položka',
      qty: ci.qty,
      unit: ci.unit,
      unitPrice: ci.unitPrice,
      unitCost,
      totalPrice: ci.unitPrice * ci.qty,
      totalCost: unitCost * ci.qty,
    });
  });

  return items;
}

export function applyDiscountsToLineItems(
  items: FvQuoteLineItem[],
  itemDiscounts: Record<string, number>,
  globalDiscountPct: number,
): FvQuoteLineItem[] {
  return items.map(item => {
    const itemDisc = itemDiscounts[item.key] ?? 0;
    const discMultiplier = (1 - itemDisc / 100) * (1 - globalDiscountPct / 100);
    return {
      ...item,
      discountPct: itemDisc + globalDiscountPct - (itemDisc * globalDiscountPct / 100),
      totalPrice: item.totalPrice * discMultiplier,
      unitPrice: item.unitPrice * discMultiplier,
    };
  });
}

export function computeFvQuoteTotals(
  items: FvQuoteLineItem[],
  subsidyCzk: number,
): FvQuoteTotals {
  const totalPrice = items.reduce((s, item) => s + item.totalPrice, 0);
  const totalCost = items.reduce((s, item) => s + item.totalCost, 0);
  const totalProfit = totalPrice - totalCost;
  const profitMarginPct = totalPrice > 0 ? Math.round((totalProfit / totalPrice) * 100) : 0;
  const finalPrice = Math.max(0, totalPrice - subsidyCzk);

  return {
    totalPrice,
    totalCost,
    totalProfit,
    profitMarginPct,
    subsidyCzk,
    finalPrice,
  };
}
