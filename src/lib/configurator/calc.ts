import type {
  ConfiguratorConfig, CustomItem, DetailLine, QuoteState, QuoteTotals, SectionResult,
} from './types';

/**
 * Výpočet předběžné nabídky — věrný port funkce calculateTotals
 * z původní aplikace HouseSmart Manager. Pořadí operací zachováno:
 * přirážka sekce → sleva/ruční cena → odhad nákladů z marže → zisk;
 * součty → bonus za komplet a obchodní sleva → celková sleva % →
 * DPH → dotace.
 */

function applyDiscount(
  basePrice: number,
  discountPercent: number,
  manualPrice: number | null,
  sectionMargin: number,
  sectionSurcharge: number,
  details: DetailLine[],
): SectionResult {
  const surchargedBase = basePrice * (1 + sectionSurcharge / 100);
  let final = surchargedBase;
  let discountAmount = 0;
  if (manualPrice !== null && !Number.isNaN(manualPrice)) {
    final = Number(manualPrice);
    discountAmount = surchargedBase - final;
  } else {
    discountAmount = surchargedBase * (discountPercent / 100);
    final = surchargedBase - discountAmount;
  }
  // odhad nakladu vychazi z puvodni ceny bez prirazky (jako v originale)
  const estimatedCost = basePrice * (1 - sectionMargin / 100);
  const profit = final - estimatedCost;
  return {
    base: basePrice, final, discount: discountAmount,
    percent: discountPercent, surcharge: sectionSurcharge, profit, details,
  };
}

function addCustomItems(items: CustomItem[] | undefined, details: DetailLine[]): number {
  let sum = 0;
  for (const i of items ?? []) {
    if (i.label && i.price) {
      sum += Number(i.price);
      details.push({ label: i.label, price: Number(i.price) });
    }
  }
  return sum;
}

export function calculateQuoteTotals(s: QuoteState, config: ConfiguratorConfig): QuoteTotals {
  const C = config.catalog;
  const P = config.prices;

  // TOPENI
  let rawHeating = 0; const heatDetails: DetailLine[] = [];
  const source = C.heatSources[s.heating.sourceIndex] ?? C.heatSources[0];
  rawHeating += source.basePrice ?? 0;
  heatDetails.push({ label: `Dodávka a montáž: ${source.label}`, price: source.basePrice ?? 0 });
  const f1 = C.floorInstallationTypes[s.heating.zone1TypeIndex] ?? C.floorInstallationTypes[0];
  rawHeating += s.heating.zone1Area * (f1.pricePerM2 ?? 0);
  heatDetails.push({ label: `Realizace podlahy 1.NP: ${f1.label} (${s.heating.zone1Area} m²)`, price: s.heating.zone1Area * (f1.pricePerM2 ?? 0) });
  const f2 = C.floorInstallationTypes[s.heating.zone2TypeIndex] ?? C.floorInstallationTypes[0];
  rawHeating += s.heating.zone2Area * (f2.pricePerM2 ?? 0);
  heatDetails.push({ label: `Realizace podlahy 2.NP: ${f2.label} (${s.heating.zone2Area} m²)`, price: s.heating.zone2Area * (f2.pricePerM2 ?? 0) });
  if (s.heating.radiators > 0) {
    rawHeating += s.heating.radiators * P.radiator;
    heatDetails.push({ label: `Dodávka a montáž radiátorů (${s.heating.radiators} ks)`, price: s.heating.radiators * P.radiator });
  }
  if (s.heating.fireplaceExchanger) {
    rawHeating += P.fireplaceExchangerConnection;
    heatDetails.push({ label: 'Propojení krbové vložky a AKU (trubky, čerpadlo, práce)', price: P.fireplaceExchangerConnection });
  }
  rawHeating += addCustomItems(s.heating.customItems, heatDetails);
  const resHeating = applyDiscount(rawHeating, s.heating.discountPercent, s.heating.manualPrice, s.heating.margin, s.heating.surcharge, heatDetails);

  // VZDUCHOTECHNIKA
  let rawVent = 0; const ventDetails: DetailLine[] = [];
  const unit = C.recuperationUnits[s.ventilation.unitIndex] ?? C.recuperationUnits[0];
  rawVent += unit.price ?? 0;
  ventDetails.push({ label: `Dodávka a montáž jednotky: ${unit.label}`, price: unit.price ?? 0 });
  const outletsTotal = s.ventilation.inlets + s.ventilation.outlets;
  rawVent += outletsTotal * P.recupOutlet;
  ventDetails.push({ label: `Kompletní rozvody vzduchu a boxy (${outletsTotal} výústek)`, price: outletsTotal * P.recupOutlet });
  if (s.ventilation.preheat) {
    rawVent += P.recupPreheat;
    ventDetails.push({ label: 'Instalace elektrického předehřevu', price: P.recupPreheat });
  }
  const cooling = C.coolingTypes.find((c) => c.id === s.ventilation.coolingType);
  if (cooling && cooling.id !== 'none') {
    rawVent += cooling.price ?? 0;
    ventDetails.push({ label: `Instalace chlazení: ${cooling.label}`, price: cooling.price ?? 0 });
  }
  if (s.ventilation.coolingType === 'ac') {
    rawVent += s.ventilation.acCount * P.acUnit;
    ventDetails.push({ label: `Dodávka a montáž klimatizace Split (${s.ventilation.acCount} ks)`, price: s.ventilation.acCount * P.acUnit });
  }
  rawVent += addCustomItems(s.ventilation.customItems, ventDetails);
  const resVent = applyDiscount(rawVent, s.ventilation.discountPercent, s.ventilation.manualPrice, s.ventilation.margin, s.ventilation.surcharge, ventDetails);

  // FVE
  let rawFve = 0; const fveDetails: DetailLine[] = [];
  rawFve += P.pvSystemBaseCost;
  fveDetails.push({ label: 'Projekt, revize, administrativa a oživení FVE', price: P.pvSystemBaseCost });
  const pPan = C.pvPanels[s.fve.panelTypeIndex] ?? C.pvPanels[0];
  const kwp = (s.fve.panelCount * (pPan.power ?? 0)) / 1000;
  rawFve += s.fve.panelCount * (pPan.price ?? 0);
  fveDetails.push({ label: `Panely materiál: ${s.fve.panelCount}x ${pPan.label}`, price: s.fve.panelCount * (pPan.price ?? 0) });
  rawFve += s.fve.panelCount * P.pvPanelInstall;
  fveDetails.push({ label: 'Montáž panelů, konstrukce a střešní práce', price: s.fve.panelCount * P.pvPanelInstall });
  const pInv = C.pvInverters[s.fve.inverterIndex] ?? C.pvInverters[0];
  rawFve += pInv.price ?? 0;
  fveDetails.push({ label: `Střídač a zapojení: ${pInv.label}`, price: pInv.price ?? 0 });
  const pBat = C.pvBatteries[s.fve.batteryTypeIndex] ?? C.pvBatteries[0];
  const batteryCapacity = s.fve.batteryModules * (pBat.capacity ?? 0);
  rawFve += s.fve.batteryModules * (pBat.price ?? 0);
  fveDetails.push({ label: `Baterie a zapojení: ${s.fve.batteryModules}x ${pBat.label}`, price: s.fve.batteryModules * (pBat.price ?? 0) });
  if (s.fve.optimizerCount > 0) {
    const pOpt = C.optimizerTypes[s.fve.optimizerTypeIndex] ?? C.optimizerTypes[0];
    rawFve += s.fve.optimizerCount * (pOpt.price ?? 0);
    fveDetails.push({ label: `Optimizéry vč. montáže: ${s.fve.optimizerCount}x ${pOpt.label}`, price: s.fve.optimizerCount * (pOpt.price ?? 0) });
  }
  if (s.fve.wallbox) {
    rawFve += P.wallbox;
    fveDetails.push({ label: 'Dodávka a montáž Wallboxu', price: P.wallbox });
  }
  rawFve += addCustomItems(s.fve.customItems, fveDetails);
  const resFve = applyDiscount(rawFve, s.fve.discountPercent, s.fve.manualPrice, s.fve.margin, s.fve.surcharge, fveDetails);

  // ELEKTRO
  let rawElectro = 0; const elDetails: DetailLine[] = [];
  rawElectro += s.electro.sockets230 * P.socket230;
  elDetails.push({ label: `Kompletace zásuvek 230V (${s.electro.sockets230} ks)`, price: s.electro.sockets230 * P.socket230 });
  rawElectro += s.electro.socketsData * P.socketData;
  elDetails.push({ label: `Kompletace datových zásuvek (${s.electro.socketsData} ks)`, price: s.electro.socketsData * P.socketData });
  rawElectro += s.electro.sockets400V * P.socket400V;
  elDetails.push({ label: `Zapojení vývodů 400V (${s.electro.sockets400V} ks)`, price: s.electro.sockets400V * P.socket400V });
  rawElectro += P.electroSwitchboard;
  elDetails.push({ label: 'Dodávka a vystrojení rozvaděče', price: P.electroSwitchboard });
  rawElectro += s.property.area * P.electroWiringPerM2;
  elDetails.push({ label: 'Hrubé rozvody, kabeláž a sekání', price: s.property.area * P.electroWiringPerM2 });
  rawElectro += P.electroRevision;
  elDetails.push({ label: 'Revize elektroinstalace', price: P.electroRevision });
  rawElectro += addCustomItems(s.electro.customItems, elDetails);
  const resElectro = applyDiscount(rawElectro, s.electro.discountPercent, s.electro.manualPrice, s.electro.margin, s.electro.surcharge, elDetails);

  // VODA
  let rawWater = 0; const watDetails: DetailLine[] = [];
  const mat = C.waterMaterials[s.water.materialIndex] ?? C.waterMaterials[0];
  const fix = s.water.fixtures;
  const sanita = ((fix.wc ?? 0) * P.fixWC + (fix.washbasin ?? 0) * P.fixWashbasin
    + (fix.shower ?? 0) * P.fixShower + (fix.bath ?? 0) * P.fixBath
    + (fix.sink ?? 0) * P.fixSink + (fix.dishwasher ?? 0) * P.fixDishwasher
    + (fix.washer ?? 0) * P.fixWasher + (fix.garden ?? 0) * P.fixGarden) * (mat.multiplier ?? 1);
  rawWater += sanita;
  watDetails.push({ label: `Dodávka a montáž sanity + rozvody (${mat.label})`, price: sanita });
  const faucet = C.faucetTypes[s.water.faucetTypeIndex] ?? C.faucetTypes[0];
  if (faucet.id === 'hidden') {
    const surcharge = ((fix.shower ?? 0) + (fix.bath ?? 0)) * (faucet.surchargePerPoint ?? 0);
    rawWater += surcharge;
    watDetails.push({ label: 'Stavební příprava a montáž podomítkových těles', price: surcharge });
  }
  if (s.water.circulation) {
    rawWater += P.circulationPump + P.circulationLoopPrice;
    watDetails.push({ label: 'Cirkulace TUV (čerpadlo, potrubí, izolace)', price: P.circulationPump + P.circulationLoopPrice });
  }
  if (s.water.smartValve) {
    rawWater += P.smartValve;
    watDetails.push({ label: 'Instalace Smart Valve (ochrana)', price: P.smartValve });
  }
  rawWater += P.waterBaseCost;
  watDetails.push({ label: 'Vodoměrná sestava, filtr a dopojení', price: P.waterBaseCost });
  rawWater += addCustomItems(s.water.customItems, watDetails);
  const resWater = applyDiscount(rawWater, s.water.discountPercent, s.water.manualPrice, s.water.margin, s.water.surcharge, watDetails);

  // LOXONE
  let rawLoxone = 0; const loxDetails: DetailLine[] = [];
  rawLoxone += P.loxoneCore;
  loxDetails.push({ label: 'Instalace Miniserveru a základních modulů', price: P.loxoneCore });
  if (s.loxone.intLighting) {
    const std = Math.max(0, s.electro.lightCircuits - s.loxone.dimmableCount);
    const lighting = Math.ceil(std / P.loxoneRelayBlockCircuits) * P.loxoneRelayBlock
      + s.loxone.dimmableCount * P.loxoneDimmerChannel;
    rawLoxone += lighting;
    loxDetails.push({ label: 'Zapojení řízení osvětlení (DALI/Dimmer/Relay)', price: lighting });
  }
  if (s.loxone.intHeating) {
    rawLoxone += s.loxone.heatingZones * P.loxoneValve;
    loxDetails.push({ label: `Osazení hlavic topení (${s.loxone.heatingZones} zón)`, price: s.loxone.heatingZones * P.loxoneValve });
  }
  if (s.loxone.intShading) {
    rawLoxone += s.loxone.windowCount * P.loxoneShadingPerWindow;
    loxDetails.push({ label: `Zapojení žaluzií (${s.loxone.windowCount} oken)`, price: s.loxone.windowCount * P.loxoneShadingPerWindow });
  }
  if (s.loxone.intAudio) {
    rawLoxone += s.loxone.audioZones * P.loxoneAudioPerZone;
    loxDetails.push({ label: `Audio Multiroom - oživení (${s.loxone.audioZones} zón)`, price: s.loxone.audioZones * P.loxoneAudioPerZone });
  }
  if (s.loxone.weatherStation) {
    rawLoxone += P.weatherStation;
    loxDetails.push({ label: 'Montáž meteostanice', price: P.weatherStation });
  }
  if (s.loxone.alarmIntegration) {
    rawLoxone += P.loxoneAlarmLogic;
    loxDetails.push({ label: 'Programování logiky alarmu', price: P.loxoneAlarmLogic });
  }
  rawLoxone += addCustomItems(s.loxone.customItems, loxDetails);
  const resLoxone = applyDiscount(rawLoxone, s.loxone.discountPercent, s.loxone.manualPrice, s.loxone.margin, s.loxone.surcharge, loxDetails);

  // ZABEZPECENI
  let rawSec = 0; const secDetails: DetailLine[] = [];
  if (s.security.jablotron) {
    const jab = P.jablotronCentral + s.security.jabPir * P.pirSensor + s.security.jabMag * P.magContact
      + s.security.jabKeypad * P.keypad + s.security.jabSiren * P.siren;
    rawSec += jab;
    secDetails.push({ label: 'Alarm Jablotron 100+ (kompletní montáž prvků)', price: jab });
  }
  const nvr = C.nvrTypes[s.security.nvrIndex] ?? C.nvrTypes[0];
  const hdd = C.hddSizes[s.security.hddSizeIndex] ?? C.hddSizes[0];
  if (s.security.cameraMode === 'yes') {
    const cp = s.security.cameraCount * P.camera + (nvr.price ?? 0) + (hdd.price ?? 0);
    rawSec += cp;
    secDetails.push({ label: `Kamerový systém (${s.security.cameraCount}x kam., NVR, ${hdd.label})`, price: cp });
  } else if (s.security.cameraMode === 'prep') {
    const pp = s.security.cameraCount * P.cameraPrep;
    rawSec += pp;
    secDetails.push({ label: 'Příprava kabeláže pro kamery', price: pp });
  }
  rawSec += addCustomItems(s.security.customItems, secDetails);
  const resSec = applyDiscount(rawSec, s.security.discountPercent, s.security.manualPrice, s.security.margin, s.security.surcharge, secDetails);

  // EXTERIER
  let rawExt = 0; const extDetails: DetailLine[] = [];
  const extBase = s.exterior.switchedSockets * P.gardenSocket + s.exterior.lightPoints * P.gardenLightPoint;
  rawExt += extBase;
  extDetails.push({ label: 'Montáž venkovních zásuvek a světel', price: extBase });
  if (s.exterior.gateControl) {
    rawExt += P.gateControl;
    extDetails.push({ label: 'Zapojení ovládání brány', price: P.gateControl });
  }
  if (s.exterior.pool) {
    rawExt += P.poolIntegration;
    extDetails.push({ label: 'Zapojení technologie bazénu', price: P.poolIntegration });
  }
  if (s.exterior.sauna) {
    rawExt += P.saunaIntegration;
    extDetails.push({ label: 'Zapojení technologie sauny', price: P.saunaIntegration });
  }
  rawExt += addCustomItems(s.exterior.customItems, extDetails);
  const resExt = applyDiscount(rawExt, s.exterior.discountPercent, s.exterior.manualPrice, s.exterior.margin, s.exterior.surcharge, extDetails);

  // VSTUP
  let rawAccess = 0; const accDetails: DetailLine[] = [];
  const ic = C.accessTypes[s.access.intercomTypeIndex] ?? C.accessTypes[0];
  rawAccess += s.access.intercomCount * (ic.price ?? 0);
  accDetails.push({ label: `Montáž interkomu (${s.access.intercomCount} ks)`, price: s.access.intercomCount * (ic.price ?? 0) });
  const nfc = C.accessTypes[1] ?? C.accessTypes[0];
  rawAccess += s.access.nfcCount * (nfc.price ?? 0);
  accDetails.push({ label: `Montáž NFC Code Touch (${s.access.nfcCount} ks)`, price: s.access.nfcCount * (nfc.price ?? 0) });
  if (s.access.electricStrike) {
    rawAccess += P.electricStrike;
    accDetails.push({ label: 'Instalace elektrozámku', price: P.electricStrike });
  }
  rawAccess += addCustomItems(s.access.customItems, accDetails);
  const resAccess = applyDiscount(rawAccess, s.access.discountPercent, s.access.manualPrice, s.access.margin, s.access.surcharge, accDetails);

  // SIT
  let rawNet = 0; const netDetails: DetailLine[] = [];
  rawNet += s.network.apCount * P.wifiAp;
  netDetails.push({ label: `Montáž WiFi AP (${s.network.apCount} ks)`, price: s.network.apCount * P.wifiAp });
  const rack = C.rackSizes[s.network.rackIndex] ?? C.rackSizes[0];
  rawNet += rack.price ?? 0;
  netDetails.push({ label: `Osazení datového rozvaděče (${rack.label})`, price: rack.price ?? 0 });
  const sw = C.switchTypes[s.network.switchTypeIndex] ?? C.switchTypes[0];
  rawNet += sw.price ?? 0;
  netDetails.push({ label: `Switch (${sw.label})`, price: sw.price ?? 0 });
  const patch = s.network.patchPanelCount * P.patchPanel + s.network.pduCount * P.pdu;
  rawNet += patch;
  netDetails.push({ label: 'Vyvázání patch panelů a napájení', price: patch });
  rawNet += P.networkInstallBase;
  netDetails.push({ label: 'Měření sítě a konektorování', price: P.networkInstallBase });
  rawNet += addCustomItems(s.network.customItems, netDetails);
  const resNet = applyDiscount(rawNet, s.network.discountPercent, s.network.manualPrice, s.network.margin, s.network.surcharge, netDetails);

  // SOUCTY
  const sections: [boolean, SectionResult][] = [
    [s.heating.active, resHeating], [s.ventilation.active, resVent], [s.fve.active, resFve],
    [s.electro.active, resElectro], [s.water.active, resWater], [s.loxone.active, resLoxone],
    [s.security.active, resSec], [s.exterior.active, resExt], [s.access.active, resAccess],
    [s.network.active, resNet],
  ];
  let totalBase = s.fees.project;
  let totalProfit = s.fees.project;
  let listPriceSum = s.fees.project;
  for (const [active, res] of sections) {
    if (!active) continue;
    totalBase += res.final;
    totalProfit += res.profit;
    listPriceSum += res.base;
  }

  const sectionDiscounts = listPriceSum - totalBase;
  const subtotalBeforeGlobal = totalBase - s.fees.coordinationDiscount - s.fees.manualDiscount;
  const globalDiscountAmount = subtotalBeforeGlobal * (s.fees.globalDiscountPercent / 100);
  const totalFinal = subtotalBeforeGlobal - globalDiscountAmount;
  const totalDiscountCombined = listPriceSum - totalFinal;
  const vat = totalFinal * (s.vatRate / 100);
  const totalWithVat = totalFinal + vat;

  const marketPrice = Math.round(listPriceSum * (P.marketPriceMultiplier || 1.15));
  const totalSavings = marketPrice - totalFinal;

  const totalSubsidy = (s.heating.active && s.heating.subsidy ? s.heating.subsidyAmount : 0)
    + (s.ventilation.active && s.ventilation.subsidy ? s.ventilation.subsidyAmount : 0)
    + (s.fve.active && s.fve.subsidy ? s.fve.subsidyAmount : 0);
  const finalPriceAfterSubsidy = totalWithVat - totalSubsidy;

  const globalDiscountsValue = s.fees.coordinationDiscount + s.fees.manualDiscount + globalDiscountAmount;
  totalProfit -= globalDiscountsValue;

  return {
    resHeating, resVent, resFve, resElectro, resWater, resLoxone,
    resSec, resExt, resAccess, resNet,
    kwp, batteryCapacity,
    totalBase: listPriceSum,
    totalSectionDiscounts: sectionDiscounts,
    totalDiscountCombined,
    totalFinal, vat, totalWithVat,
    marketPrice, totalSavings, totalSubsidy, finalPriceAfterSubsidy, totalProfit,
    heatSourceLabel: source.label,
    ventUnitLabel: unit.label,
  };
}
