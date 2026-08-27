import type { ConfigurationData } from './types';
import type { PriceMap, SubsidySetting } from './types';

function getPrice(prices: PriceMap, key: string, quantity: number = 1): number {
  const item = prices[key];
  if (!item) return 0;

  if (item.unit === 'per_m2' || item.unit === 'per_piece') {
    return item.value * quantity;
  } else {
    return item.value;
  }
}

const STEP_DETAIL_MAP: Record<string, string[]> = {
  heating: ['Vytápění'],
  water: ['Voda a odpady'],
  air: ['Vzduchotechnika'],
  energy: ['Fotovoltaika'],
  smart: ['Elektroinstalace', 'Smart Home'],
  security: ['Zabezpečení'],
};

const STEP_ORDER = ['property', 'heating', 'water', 'air', 'energy', 'smart', 'loxone', 'security', 'contact', 'result'];

export function getIncludedLabels(currentStepId: string): Set<string> {
  const currentIdx = STEP_ORDER.indexOf(currentStepId);
  const labels = new Set<string>();
  for (let i = 0; i <= currentIdx; i++) {
    const stepLabels = STEP_DETAIL_MAP[STEP_ORDER[i]];
    if (stepLabels) stepLabels.forEach(l => labels.add(l));
  }
  return labels;
}

const DISTRIBUTION_LABELS: Record<string, string> = {
  floor_wet: 'Podlahové topení (mokrá)',
  floor_dry: 'Podlahové topení (suchá)',
  radiators: 'Radiátory',
};

const SOURCE_LABELS: Record<string, string> = {
  heat_pump: 'Tepelné čerpadlo',
  electroboiler: 'Elektrokotel',
  gas_boiler: 'Plynový kotel',
  solid_fuel: 'Tuhá paliva (krb/kotel)',
  electric_mats: 'Elektrické rohože',
};

function calcDistributionPrice(
  dist: string,
  areaShare: number,
  prices: PriceMap,
): number {
  if (dist === 'floor_wet' || dist === 'floor_dry') {
    return getPrice(prices, 'floorHeatingPerM2', areaShare);
  }
  return getPrice(prices, 'radiatorPerPcs', areaShare / 15);
}

export function calculateEstimate(data: ConfigurationData, PRICES: PriceMap, subsidySettings?: SubsidySetting[]) {
  let total = 0;
  const details: any[] = [];

  const wantHeating = data.wantHeating !== false;
  let heatPrice = 0;
  const heatItems: string[] = [];

  const source = data.heatSource;
  heatItems.push(SOURCE_LABELS[source] || source);

  if (source === 'heat_pump') {
    heatPrice += getPrice(PRICES, 'heatPumpBase');
    heatItems.push('Tepelné čerpadlo včetně instalace');
  } else if (source === 'electroboiler') {
    heatPrice += getPrice(PRICES, 'electroBoiler');
    heatItems.push('Elektrokotel včetně instalace');
  } else if (source === 'gas_boiler') {
    heatPrice += getPrice(PRICES, 'electroBoiler') * 1.1;
    heatItems.push('Plynový kondenzační kotel včetně instalace');
  } else if (source === 'solid_fuel') {
    heatPrice += getPrice(PRICES, 'solidFuelBoiler');
    heatItems.push('Kotel na tuhá paliva včetně instalace');
    heatItems.push('Napojení na komín');
  } else if (source === 'electric_mats') {
    heatPrice += getPrice(PRICES, 'floorHeatingPerM2', data.area) * 0.6;
    heatItems.push('Elektrické topné rohože');
  }

  if (source !== 'electric_mats') {
    const isTwoFloor = data.floors !== '1';
    const groundArea = isTwoFloor ? data.area * 0.55 : data.area;
    const upperArea = isTwoFloor ? data.area * 0.45 : 0;

    heatPrice += calcDistributionPrice(data.groundFloorHeating, groundArea, PRICES);
    heatItems.push(`Přízemí: ${DISTRIBUTION_LABELS[data.groundFloorHeating]}`);

    if (isTwoFloor) {
      heatPrice += calcDistributionPrice(data.upperFloorHeating, upperArea, PRICES);
      heatItems.push(`Patro: ${DISTRIBUTION_LABELS[data.upperFloorHeating]}`);
    }

    heatItems.push('Regulace s termostatem v každé místnosti');
  }

  if (data.heatingExtras.fireplaceInsert) {
    heatPrice += getPrice(PRICES, 'tank') * 0.8;
    heatItems.push('Krbová vložka s výměníkem');
  }

  if (data.heatingExtras.tank) {
    heatPrice += getPrice(PRICES, 'tank');
    heatItems.push('Akumulační nádrž 300-500l');
    heatItems.push('Hydraulické propojení');
  }

  if (wantHeating) {
    total += heatPrice;
    details.push({
      label: 'Vytápění',
      items: heatItems,
      price: heatPrice,
    });
  }

  let airPrice = 0;
  const airItems: string[] = [];
  if (data.recuperation === 'premium') {
    airPrice = getPrice(PRICES, 'recuperationBase') * 1.3 + getPrice(PRICES, 'recuperationPerM2', data.area);
    airItems.push('Prémiová rekuperační jednotka Zehnder');
    airItems.push('Entalpický výměník (nevysušuje vzduch)');
  } else if (data.recuperation === 'yes') {
    airPrice = getPrice(PRICES, 'recuperationBase') + getPrice(PRICES, 'recuperationPerM2', data.area);
    airItems.push('Rekuperační jednotka s účinností 90%');
  }

  if (data.recuperation !== 'no') {
    airItems.push('Rozvody vzduchotechniky po celém domě');
    airItems.push('Vyústky a regulační klapky');
    airItems.push('Filtrace vzduchu');
  }

  if (data.recuperationCooling && data.recuperation !== 'no') {
    airPrice += getPrice(PRICES, 'recuperationCooling');
    airItems.push('Chladicí článek pro letní provoz');
    airItems.push('Automatická regulace podle teploty');
  }

  if (airPrice > 0) {
    total += airPrice;
    details.push({
      label: 'Vzduchotechnika',
      items: airItems,
      price: airPrice,
    });
  }

  let fvePrice = 0;
  const fveItems: string[] = [];
  if (data.fve === 'basic') {
    fvePrice = getPrice(PRICES, 'fveBasic');
    fveItems.push('FV panely 3-4 kWp');
    fveItems.push('Střídač');
    fveItems.push('Montáž na střechu');
    fveItems.push('Ohřev TUV přebytky');
  }
  if (data.fve === 'optimum') {
    fvePrice = getPrice(PRICES, 'fveOptimum');
    fveItems.push('FV panely 6-8 kWp');
    fveItems.push('Hybridní střídač');
    fveItems.push('Baterie 10-15 kWh');
    fveItems.push('Montáž na střechu');
    fveItems.push('Monitoring výroby');
  }
  if (data.fve === 'max') {
    fvePrice = getPrice(PRICES, 'fveMax');
    fveItems.push('FV panely 10+ kWp (plná střecha)');
    fveItems.push('Výkonný hybridní střídač');
    fveItems.push('Velká baterie 15-20 kWh');
    fveItems.push('Montáž na střechu');
    fveItems.push('Wallbox pro elektromobil');
    fveItems.push('Monitoring a optimalizace');
  }

  if (fvePrice > 0) {
    total += fvePrice;
    details.push({ label: 'Fotovoltaika', items: fveItems, price: fvePrice });
  }

  const wantElectro = data.wantElectro !== false;
  let electroPrice = wantElectro ? getPrice(PRICES, 'electroPerM2', data.area) : 0;
  const electroItems = [
    'Kompletní kabelové rozvody',
    'Rozvodnice včetně jističů',
    'Zásuvky a vypínače ve všech místnostech',
    'Venkovní zásuvky',
    'LED osvětlení',
  ];

  let smartPrice = 0;
  const smartItems: string[] = [];
  if (data.smart === 'loxone') {
    smartPrice = getPrice(PRICES, 'smartHomeBase') + getPrice(PRICES, 'smartPerM2', data.area);
    smartPrice += getPrice(PRICES, 'loxoneFeatureBase') * data.loxoneFeatures.length;
    electroPrice *= 1.2;
    smartItems.push('Loxone Miniserver');
    smartItems.push('Ovládání mobilní aplikací');
    smartItems.push('Vizualizace na tabletech');
    smartItems.push('Integrace všech technologií');
    if (data.loxoneFeatures.length > 0) {
      smartItems.push(`Funkce: ${data.loxoneFeatures.join(', ')}`);
    }
  } else if (data.smart === 'basic') {
    smartPrice = getPrice(PRICES, 'smartBasic');
    smartItems.push('WiFi/Zigbee gateway');
    smartItems.push('Chytré žárovky');
    smartItems.push('Ovládání mobilem');
  }

  total += electroPrice + smartPrice;
  if (wantElectro) {
    details.push({ label: 'Elektroinstalace', items: electroItems, price: electroPrice });
  }
  if (smartPrice > 0) {
    details.push({
      label: 'Smart Home',
      items: smartItems,
      price: smartPrice,
    });
  }

  const wantWater = data.wantWater !== false;
  let waterPrice = wantWater ? getPrice(PRICES, 'waterBase') : 0;
  const waterItems = [
    'Kompletní vodovodní rozvody (studená + teplá voda)',
    'Kanalizační rozvody včetně ventilace',
    'Přípojka vody a kanalizace',
    'Základní vybavení (baterie, umyvadla, WC)',
  ];
  if (wantWater && data.waterExtras?.waterSoftener) {
    waterPrice += getPrice(PRICES, 'waterSoftener');
    waterItems.push('Změkčovač vody (ochrana před vodním kamenem)');
  }
  if (wantWater && data.waterExtras?.smartValve) {
    waterPrice += getPrice(PRICES, 'smartValve');
    waterItems.push('Smart Valve - automatické uzavření přívodu vody');
  }
  if (wantWater && data.waterExtras?.circulationPump) {
    waterPrice += getPrice(PRICES, 'circulationPump');
    waterItems.push('Cirkulace teplé vody (okamžitá teplá voda)');
  }

  if (wantWater) {
    total += waterPrice;
    details.push({ label: 'Voda a odpady', items: waterItems, price: waterPrice });
  }

  let secPrice = 0;
  const secItems: string[] = [];
  if (data.alarm === 'prep') {
    secPrice += getPrice(PRICES, 'alarmPrep');
    secItems.push('ALARM - Příprava kabeláže');
    secItems.push('Husí krky nebo trubky pro budoucí montáž');
  }
  if (data.alarm === 'full') {
    secPrice += getPrice(PRICES, 'alarmBase') + getPrice(PRICES, 'alarmPerM2', data.area / 20);
    secItems.push('ALARM - Jablotron centrála');
    secItems.push('Pohybové detektory (PIR)');
    secItems.push('Dveřní/okenní kontakty');
    secItems.push('Venkovní siréna');
    secItems.push('Klávesnice a ovládání mobilem');
  }
  if (data.cameras === 'prep') {
    secPrice += getPrice(PRICES, 'cameraPrep');
    secItems.push('KAMERY - Příprava síťových rozvodů');
  }
  if (data.cameras === 'full') {
    secPrice += getPrice(PRICES, 'cameraFull');
    secItems.push('KAMERY - 4x IP kamera Full HD');
    secItems.push('Záznamové zařízení (NVR)');
    secItems.push('HDD 2TB pro záznamy');
    secItems.push('Síťové rozvody pro kamery');
  }

  if (secPrice > 0) {
    total += secPrice;
    details.push({ label: 'Zabezpečení', items: secItems, price: secPrice });
  }

  let subsidyEstimate = 0;

  if (subsidySettings && subsidySettings.length > 0) {
    const enabledSubsidies = subsidySettings.filter(s => s.enabled);
    for (const subsidy of enabledSubsidies) {
      if (subsidy.sector === 'heating' && wantHeating && source === 'heat_pump') {
        subsidyEstimate += subsidy.amount;
      } else if (subsidy.sector === 'air' && data.recuperation !== 'no') {
        subsidyEstimate += subsidy.amount;
      } else if (subsidy.sector === 'energy_basic' && data.fve === 'basic') {
        subsidyEstimate += subsidy.amount;
      } else if (subsidy.sector === 'energy_optimum' && data.fve === 'optimum') {
        subsidyEstimate += subsidy.amount;
      } else if (subsidy.sector === 'energy_max' && data.fve === 'max') {
        subsidyEstimate += subsidy.amount;
      }
    }
  }

  return { total, details, subsidyEstimate, totalWithVat: total * 1.12 };
}
