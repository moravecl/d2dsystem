/**
 * Konfigurátor předběžných cenových nabídek — typy.
 * Věrný port aplikace „HouseSmart Manager" (10 sekcí, katalogy voleb,
 * jednotkové ceny, marže/slevy/přirážky, dotace, DPH).
 */

export interface CatalogOption {
  id?: string;
  label: string;
  basePrice?: number;
  price?: number;
  pricePerM2?: number;
  power?: number;
  capacity?: number;
  multiplier?: number;
  surchargePerPoint?: number;
}

export interface ConfiguratorCatalog {
  heatSources: CatalogOption[];
  floorInstallationTypes: CatalogOption[];
  recuperationUnits: CatalogOption[];
  pvPanels: CatalogOption[];
  pvInverters: CatalogOption[];
  pvBatteries: CatalogOption[];
  optimizerTypes: CatalogOption[];
  nvrTypes: CatalogOption[];
  hddSizes: CatalogOption[];
  rackSizes: CatalogOption[];
  switchTypes: CatalogOption[];
  accessTypes: CatalogOption[];
  coolingTypes: CatalogOption[];
  waterMaterials: CatalogOption[];
  faucetTypes: CatalogOption[];
}

/** Jednotkové ceny (Kč) — vše, co editor umožňuje ladit. */
export type ConfiguratorPrices = Record<string, number>;

export interface PublicPriceItem { value: number; unit: string }

export interface PublicSubsidy {
  sector: string;
  label: string;
  description: string;
  amount: number;
  enabled: boolean;
}

/** Zjednodušený ceník veřejného konfigurátoru (port z Bolt prototypu). */
export interface PublicConfiguratorSettings {
  prices: Record<string, PublicPriceItem>;
  subsidies: PublicSubsidy[];
  showLivePrices: boolean;
  showResultPrices: boolean;
}

export interface ConfiguratorConfig {
  catalog: ConfiguratorCatalog;
  prices: ConfiguratorPrices;
  /** výchozí hodnoty nové nabídky */
  defaults: {
    vatRate: number;
    margin: number;
    projectFee: number;
    coordinationDiscount: number;
  };
  /** veřejný konfigurátor pro zákazníky (leady) */
  public: PublicConfiguratorSettings;
}

export interface CustomItem { label: string; price: number }

interface SectionBase {
  active: boolean;
  discountPercent: number;
  margin: number;
  surcharge: number;
  manualPrice: number | null;
  customItems: CustomItem[];
}

export interface HeatingState extends SectionBase {
  sourceIndex: number;
  zone1Area: number; zone1TypeIndex: number;
  zone2Area: number; zone2TypeIndex: number;
  radiators: number;
  fireplaceExchanger: boolean;
  subsidy: boolean; subsidyAmount: number;
}

export interface VentilationState extends SectionBase {
  unitIndex: number;
  inlets: number; outlets: number;
  preheat: boolean;
  coolingType: string;
  acCount: number;
  subsidy: boolean; subsidyAmount: number;
}

export interface FveState extends SectionBase {
  panelTypeIndex: number; panelCount: number;
  inverterIndex: number;
  batteryTypeIndex: number; batteryModules: number;
  optimizerTypeIndex: number; optimizerCount: number;
  wallbox: boolean;
  subsidy: boolean; subsidyAmount: number;
}

export interface ElectroState extends SectionBase {
  sockets230: number; socketsData: number; sockets400V: number;
  lightCircuits: number;
}

export interface WaterState extends SectionBase {
  materialIndex: number; faucetTypeIndex: number;
  circulation: boolean; smartValve: boolean;
  fixtures: Record<string, number>;
}

export interface LoxoneState extends SectionBase {
  intLighting: boolean; dimmableCount: number;
  intHeating: boolean; heatingZones: number;
  intShading: boolean; windowCount: number;
  intAudio: boolean; audioZones: number;
  weatherStation: boolean; alarmIntegration: boolean;
}

export interface SecurityState extends SectionBase {
  jablotron: boolean; jabPir: number; jabMag: number; jabKeypad: number; jabSiren: number;
  cameraMode: 'yes' | 'prep' | 'no';
  cameraCount: number; nvrIndex: number; hddSizeIndex: number;
}

export interface ExteriorState extends SectionBase {
  pool: boolean; sauna: boolean;
  switchedSockets: number; lightPoints: number;
  gateControl: boolean;
}

export interface AccessState extends SectionBase {
  intercomCount: number; intercomTypeIndex: number;
  nfcCount: number; electricStrike: boolean;
}

export interface NetworkState extends SectionBase {
  apCount: number; rackIndex: number;
  switchTypeIndex: number; switchPorts: number;
  patchPanelCount: number; pduCount: number;
}

export interface QuoteClient {
  firstName: string; lastName: string; vocative: string; address: string; date: string;
}

export interface QuoteState {
  client: QuoteClient;
  property: { area: number; type: string; garage: boolean; garageArea: number };
  vatRate: number;
  heating: HeatingState;
  ventilation: VentilationState;
  fve: FveState;
  electro: ElectroState;
  water: WaterState;
  loxone: LoxoneState;
  security: SecurityState;
  exterior: ExteriorState;
  access: AccessState;
  network: NetworkState;
  fees: {
    project: number;
    coordinationDiscount: number;
    manualDiscount: number;
    globalDiscountPercent: number;
    globalSurcharge: number;
  };
  introText: string;
}

export interface DetailLine { label: string; price: number }

export interface SectionResult {
  base: number;
  final: number;
  discount: number;
  percent: number;
  surcharge: number;
  profit: number;
  details: DetailLine[];
}

export interface QuoteTotals {
  resHeating: SectionResult; resVent: SectionResult; resFve: SectionResult;
  resElectro: SectionResult; resWater: SectionResult; resLoxone: SectionResult;
  resSec: SectionResult; resExt: SectionResult; resAccess: SectionResult; resNet: SectionResult;
  kwp: number;
  batteryCapacity: number;
  totalBase: number;
  totalSectionDiscounts: number;
  totalDiscountCombined: number;
  totalFinal: number;
  vat: number;
  totalWithVat: number;
  marketPrice: number;
  totalSavings: number;
  totalSubsidy: number;
  finalPriceAfterSubsidy: number;
  totalProfit: number;
  heatSourceLabel: string;
  ventUnitLabel: string;
}
