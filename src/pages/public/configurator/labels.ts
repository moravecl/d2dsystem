export const HEATING_LABELS: Record<string, string> = {
  heat_pump: 'Tepelne cerpadlo',
  electroboiler: 'Elektrokotel',
  gas_boiler: 'Plynovy kotel',
  solid_fuel: 'Tuha paliva (krb/kotel)',
  electric_mats: 'Elektricke rohoze',
  hp_floor: 'TC + podlahove topeni',
  hp_radiator: 'TC + radiatory',
  electro: 'Elektrokotel',
};

export const DISTRIBUTION_LABELS: Record<string, string> = {
  floor_wet: 'Podlahove (mokra)',
  floor_dry: 'Podlahove (sucha)',
  radiators: 'Radiatory',
};

export const RECUP_LABELS: Record<string, string> = {
  premium: 'Premiova rekuperace',
  yes: 'Standardni rekuperace',
  no: 'Bez rekuperace',
};

export const FVE_LABELS: Record<string, string> = {
  none: 'Bez FVE',
  basic: 'Zakladni (3-4 kWp)',
  optimum: 'Optimum (6-8 kWp + baterie)',
  max: 'Maximum (10+ kWp + baterie + wallbox)',
};

export const SMART_LABELS: Record<string, string> = {
  none: 'Bez smart home',
  basic: 'Zakladni smart home',
  loxone: 'Loxone',
};

export const ALARM_LABELS: Record<string, string> = {
  none: 'Bez alarmu',
  prep: 'Priprava kabelaze',
  full: 'Kompletni alarm Jablotron',
};

export const CAMERA_LABELS: Record<string, string> = {
  none: 'Bez kamer',
  prep: 'Priprava rozvodu',
  full: 'Kompletni kamerovy system',
};

export const SECTOR_LABELS: Record<string, string> = {
  heating: 'Vytapeni',
  air: 'Vzduchotechnika',
  energy_basic: 'Fotovoltaika - zakladni',
  energy_optimum: 'Fotovoltaika - optimum',
  energy_max: 'Fotovoltaika - maximum',
};

export function labelFor(map: Record<string, string>, key: string): string {
  return map[key] || key;
}
