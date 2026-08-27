export type HeatSource = 'heat_pump' | 'electroboiler' | 'gas_boiler' | 'solid_fuel' | 'electric_mats';
export type HeatingDistribution = 'floor_wet' | 'floor_dry' | 'radiators';

export interface HeatingExtras {
  tank: boolean;
  fireplaceInsert: boolean;
}

export interface WaterExtras {
  waterSoftener?: boolean;
  smartValve?: boolean;
  circulationPump?: boolean;
}

export interface ConfigurationData {
  area: number;
  floors: string;
  occupants: number;
  heatSource: HeatSource;
  groundFloorHeating: HeatingDistribution;
  upperFloorHeating: HeatingDistribution;
  heatingExtras: HeatingExtras;
  recuperation: string;
  recuperationCooling: boolean;
  fve: string;
  smart: string;
  loxoneFeatures: string[];
  alarm: string;
  cameras: string;
  waterExtras?: WaterExtras;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientRegion: string;
  gdprConsent: boolean;
  /** @deprecated kept for backward compat with saved configs */
  heatingType?: string;
}

export const CZECH_REGIONS = [
  'Hlavní město Praha',
  'Středočeský kraj',
  'Jihočeský kraj',
  'Plzeňský kraj',
  'Karlovarský kraj',
  'Ústecký kraj',
  'Liberecký kraj',
  'Královéhradecký kraj',
  'Pardubický kraj',
  'Kraj Vysočina',
  'Jihomoravský kraj',
  'Olomoucký kraj',
  'Zlínský kraj',
  'Moravskoslezský kraj',
] as const;

export interface PriceItem {
  value: number;
  unit: string;
}

export interface PriceMap {
  [key: string]: PriceItem;
}

export interface SubsidySetting {
  id?: string;
  sector: string;
  label: string;
  description: string;
  amount: number;
  enabled: boolean;
}

export interface StepProps {
  data: ConfigurationData;
  setData: (data: ConfigurationData) => void;
  prices?: PriceMap | null;
  showPrices?: boolean;
}
