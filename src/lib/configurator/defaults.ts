import type { ConfiguratorConfig, QuoteState } from './types';

/**
 * Výchozí ceník konfigurátoru — přenesený 1:1 z původní aplikace
 * HouseSmart Manager. Ceny, které tam byly zadrátované ve výpočtech
 * (rozvaděč, kabeláž/m², revize, DALI blok…), jsou zde vytažené do
 * `prices`, takže je editor v administraci umí měnit.
 */
export const DEFAULT_CONFIGURATOR_CONFIG: ConfiguratorConfig = {
  catalog: {
    heatSources: [
      { id: 'hp_aku', label: 'TČ Vzduch/Voda + 1000L AKU (High Perf.)', basePrice: 320000 },
      { id: 'hp_ground', label: 'TČ Země/Voda (Vrt/Plošný kolektor)', basePrice: 380000 },
      { id: 'hp', label: 'Tepelné čerpadlo (Vzduch/Voda - Split)', basePrice: 220000 },
      { id: 'el', label: 'Elektrokotel', basePrice: 28000 },
      { id: 'gas', label: 'Plynový kondenzační kotel', basePrice: 48000 },
      { id: 'solid', label: 'Kotel na tuhá paliva', basePrice: 85000 },
      { id: 'mats', label: 'Elektrické topné rohože', basePrice: 15000 },
    ],
    floorInstallationTypes: [
      { id: 'sys_eps', label: 'Mokrý: Systémová deska s EPS', pricePerM2: 1450 },
      { id: 'foil', label: 'Mokrý: Pouze odrazová folie (Tacker)', pricePerM2: 650 },
      { id: 'sys_foil', label: 'Mokrý: Systémová folie (Nopová)', pricePerM2: 950 },
      { id: 'dry_system', label: 'Suchý: Fermacell/OSB (Teplovodní)', pricePerM2: 2100 },
      { id: 'prep', label: 'Příprava od investora', pricePerM2: 250 },
      { id: 'el_mats', label: 'El. rohože (Fenix/Raychem)', pricePerM2: 1800 },
    ],
    recuperationUnits: [
      { id: 'zehnder350', label: 'Zehnder ComfoAir Q350 (Swiss Quality)', price: 155000 },
      { id: 'zehnder600', label: 'Zehnder ComfoAir Q600 (Swiss Quality)', price: 205000 },
      { id: 'ventbox400', label: 'Ventbox 400 ERV Comfort (Entalpie)', price: 145000 },
      { id: 'jablotronM', label: 'Jablotron Futura M (350 m3/h)', price: 135000 },
      { id: 'jablotronL', label: 'Jablotron Futura L (450 m3/h)', price: 155000 },
    ],
    pvPanels: [
      { label: '450Wp All Black', price: 4200, power: 450 },
      { label: '500Wp High Efficiency', price: 4800, power: 500 },
    ],
    pvInverters: [
      { label: 'SolaX X3-Hybrid G4 10.0', price: 55000 },
      { label: 'SolaX X3-Hybrid G4 15.0', price: 65000 },
      { label: 'SolaX X3-ULT-20K', price: 89000 },
      { label: 'SolaX X3-ULT-30K', price: 105000 },
    ],
    pvBatteries: [
      { label: 'Triple Power T58 (5.8 kWh)', price: 45000, capacity: 5.8 },
      { label: 'Triple Power HS36 (3.6 kWh)', price: 32000, capacity: 3.6 },
      { label: 'Triple Power HS51 (5.1 kWh)', price: 40000, capacity: 5.1 },
    ],
    optimizerTypes: [
      { label: 'Tigo (Optimalizační)', price: 1600 },
      { label: 'Safety Box (Odpojení)', price: 900 },
    ],
    nvrTypes: [
      { label: 'NVR 4-channel', price: 6000 },
      { label: 'NVR 8-channel', price: 9500 },
      { label: 'NVR 16-channel', price: 16000 },
    ],
    hddSizes: [
      { label: '1TB (cca 7 dní)', price: 1500 },
      { label: '2TB (cca 14 dní)', price: 2500 },
      { label: '4TB (cca 30 dní)', price: 4000 },
      { label: '6TB (cca 45 dní)', price: 6000 },
    ],
    rackSizes: [
      { label: '9U Nástěnný', price: 4500 },
      { label: '12U Nástěnný', price: 5000 },
      { label: '18U Stojanový', price: 9500 },
      { label: '42U Stojanový', price: 18000 },
    ],
    switchTypes: [
      { label: 'Standard 24-port', price: 5000 },
      { label: 'PoE+ 24-port', price: 8000 },
    ],
    accessTypes: [
      { label: 'Loxone Intercom', price: 28000 },
      { label: 'NFC Code Touch', price: 7500 },
      { label: 'Hikvision IP', price: 8500 },
    ],
    coolingTypes: [
      { id: 'none', label: 'Bez chlazení', price: 0 },
      { id: 'ventbox_cool', label: 'Integrovaný výparník (Ventbox)', price: 48000 },
      { id: 'coolbreeze', label: 'CoolBreeze (z TČ)', price: 68000 },
      { id: 'passive', label: 'Pasivní chlazení (jen pro TČ Země/Voda)', price: 25000 },
      { id: 'ac', label: 'Klimatizace (Split)', price: 0 },
    ],
    waterMaterials: [
      { id: 'ppr', label: 'PPR (Svařovaný plast)', multiplier: 1.0 },
      { id: 'alpex', label: 'Alpex (Lisovaný plastohliník)', multiplier: 1.3 },
    ],
    faucetTypes: [
      { id: 'standard', label: 'Nástěnné (Roháčky)', surchargePerPoint: 0 },
      { id: 'hidden', label: 'Podomítkové (iBox)', surchargePerPoint: 4500 },
    ],
  },
  prices: {
    radiator: 8000,
    fireplaceExchangerConnection: 18000,
    pvSystemBaseCost: 65000,
    pvPanelInstall: 3500,
    wallbox: 22000,
    recupOutlet: 2500,
    recupPreheat: 12000,
    acUnit: 35000,
    socket230: 1200,
    socketData: 1400,
    socket400V: 3500,
    smartValve: 14500,
    circulationPump: 8500,
    circulationLoopPrice: 6500,
    loxoneCore: 55000,
    loxoneDimmerChannel: 2500,
    loxoneValve: 2800,
    weatherStation: 8500,
    jablotronCentral: 18000,
    pirSensor: 1800,
    magContact: 1200,
    keypad: 3500,
    siren: 2500,
    camera: 6500,
    cameraPrep: 1800,
    poolIntegration: 18000,
    saunaIntegration: 12000,
    gardenSocket: 1800,
    gardenLightPoint: 1500,
    gateControl: 4500,
    electricStrike: 2500,
    wifiAp: 3500,
    patchPanel: 2000,
    pdu: 1500,
    networkInstallBase: 5000,
    waterBaseCost: 15000,
    fixWC: 4800,
    fixWashbasin: 5200,
    fixShower: 5800,
    fixBath: 5800,
    fixSink: 5200,
    fixDishwasher: 3200,
    fixWasher: 3200,
    fixGarden: 7500,
    // drive zadratovane ve vypoctech:
    electroSwitchboard: 45000,
    electroWiringPerM2: 550,
    electroRevision: 15000,
    loxoneRelayBlock: 8000,
    loxoneRelayBlockCircuits: 12,
    loxoneShadingPerWindow: 6000,
    loxoneAudioPerZone: 16000,
    loxoneAlarmLogic: 12000,
    marketPriceMultiplier: 1.15,
  },
  defaults: {
    vatRate: 12,
    margin: 25,
    projectFee: 35000,
    coordinationDiscount: 25000,
  },
};

export const FIXTURE_LABELS: Record<string, string> = {
  wc: 'WC',
  washbasin: 'Umyvadlo',
  shower: 'Sprcha',
  bath: 'Vana',
  sink: 'Dřez',
  dishwasher: 'Myčka',
  washer: 'Pračka',
  garden: 'Zahradní ventil',
};

export const QUOTE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rozpracováno', color: 'bg-white/[0.08] text-slate-300' },
  sent: { label: 'Odesláno', color: 'bg-blue-500/20 text-blue-300' },
  accepted: { label: 'Přijato', color: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Zamítnuto', color: 'bg-red-500/20 text-red-300' },
};

export function createDefaultQuoteState(config: ConfiguratorConfig): QuoteState {
  const m = config.defaults.margin;
  return {
    client: {
      firstName: '', lastName: '', vocative: '', address: '',
      date: new Date().toISOString().split('T')[0],
    },
    property: { area: 150, type: 'bungalow', garage: true, garageArea: 25 },
    vatRate: config.defaults.vatRate,
    heating: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      sourceIndex: 0, zone1Area: 75, zone1TypeIndex: 0, zone2Area: 75, zone2TypeIndex: 3,
      radiators: 2, fireplaceExchanger: true, subsidy: false, subsidyAmount: 80000,
    },
    ventilation: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      unitIndex: 0, inlets: 5, outlets: 4, preheat: false, coolingType: 'ventbox_cool', acCount: 0,
      subsidy: false, subsidyAmount: 100000,
    },
    fve: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      panelTypeIndex: 0, panelCount: 24, inverterIndex: 0, batteryTypeIndex: 0, batteryModules: 2,
      optimizerTypeIndex: 0, optimizerCount: 0, wallbox: true, subsidy: true, subsidyAmount: 160000,
    },
    electro: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      sockets230: 65, socketsData: 18, sockets400V: 2, lightCircuits: 20,
    },
    water: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      materialIndex: 1, faucetTypeIndex: 0, circulation: true, smartValve: true,
      fixtures: { wc: 2, washbasin: 2, shower: 1, bath: 1, sink: 1, dishwasher: 1, washer: 1, garden: 1 },
    },
    loxone: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      intLighting: true, dimmableCount: 8, intHeating: true, heatingZones: 6,
      intShading: true, windowCount: 10, intAudio: true, audioZones: 4,
      weatherStation: true, alarmIntegration: true,
    },
    security: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      jablotron: true, jabPir: 8, jabMag: 10, jabKeypad: 1, jabSiren: 1,
      cameraMode: 'yes', cameraCount: 4, nvrIndex: 0, hddSizeIndex: 0,
    },
    exterior: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      pool: false, sauna: false, switchedSockets: 2, lightPoints: 4, gateControl: true,
    },
    access: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      intercomCount: 1, intercomTypeIndex: 0, nfcCount: 1, electricStrike: true,
    },
    network: {
      active: true, discountPercent: 0, margin: m, surcharge: 0, manualPrice: null, customItems: [],
      apCount: 3, rackIndex: 1, switchTypeIndex: 0, switchPorts: 24, patchPanelCount: 1, pduCount: 1,
    },
    fees: {
      project: config.defaults.projectFee,
      coordinationDiscount: config.defaults.coordinationDiscount,
      manualDiscount: 0,
      globalDiscountPercent: 0,
      globalSurcharge: 0,
    },
    introText: '',
  };
}
