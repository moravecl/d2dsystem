export interface ProjectProtocol {
  id: string;
  project_id: string;
  protocol_number: string;
  protocol_type: string;
  title: string;
  protocol_date: string;
  valid_until: string | null;
  inspector_name: string;
  inspector_company: string;
  result: string;
  description: string;
  findings: string;
  recommendations: string;
  notes: string;
  measured_values: Record<string, string>;
  inspector_signature: string;
  client_signature: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id?: string;
  protocol_id?: string;
  label: string;
  checked: boolean;
  note: string;
  sort_order: number;
}

export const PROTOCOL_TYPES: { key: string; label: string; icon: string; defaultChecklist: string[] }[] = [
  {
    key: 'pressure_test',
    label: 'Tlaková zkouška',
    icon: 'gauge',
    defaultChecklist: [
      'Vizuální kontrola potrubí',
      'Napuštění zkušebního média',
      'Dosažení zkušebního tlaku',
      'Udržení tlaku po stanovenou dobu',
      'Kontrola těsnosti spojů',
      'Kontrola armatur a ventilů',
      'Odpuštění zkušebního média',
      'Zápis naměřených hodnot',
    ],
  },
  {
    key: 'electrical_inspection',
    label: 'Revize elektroinstalace',
    icon: 'zap',
    defaultChecklist: [
      'Vizuální prohlídka rozvaděčů',
      'Kontrola ochranného pospojování',
      'Měření izolačního odporu',
      'Měření impedance smyčky',
      'Kontrola proudových chráničů (RCD)',
      'Kontrola jističů a pojistek',
      'Měření odporu uzemnění',
      'Kontrola značení obvodů',
      'Funkční zkouška zásuvek',
      'Kontrola osvětlení',
    ],
  },
  {
    key: 'recuperation_regulation',
    label: 'Zaregulování rekuperace',
    icon: 'wind',
    defaultChecklist: [
      'Kontrola filtrů',
      'Měření průtoku vzduchu na přívodu',
      'Měření průtoku vzduchu na odvodu',
      'Nastavení výkonových stupňů',
      'Kontrola teploty na výstupu',
      'Zaregulování distribučních elementů',
      'Kontrola těsnosti rozvodů',
      'Měření hlučnosti',
      'Nastavení časového programu',
      'Kontrola bypass klapky',
    ],
  },
  {
    key: 'gas_inspection',
    label: 'Revize plynového zařízení',
    icon: 'flame',
    defaultChecklist: [
      'Vizuální kontrola plynového rozvodu',
      'Kontrola těsnosti spojů (pěnotvorný roztok)',
      'Kontrola uzavíracích armatur',
      'Kontrola plynového kotle / spotřebiče',
      'Kontrola odvodu spalin',
      'Kontrola přívodu vzduchu',
      'Kontrola detektoru plynu',
      'Měření CO ve spalinách',
      'Kontrola tlaku plynu na spotřebiči',
    ],
  },
  {
    key: 'fire_inspection',
    label: 'Požární revize',
    icon: 'flame-kindling',
    defaultChecklist: [
      'Kontrola hasicích přístrojů',
      'Kontrola hydrantů',
      'Kontrola požárních hlásičů',
      'Kontrola nouzového osvětlení',
      'Kontrola únikových cest',
      'Kontrola požárních uzávěrů',
      'Kontrola značení',
      'Kontrola požárních prostupů',
    ],
  },
  {
    key: 'hvac_commissioning',
    label: 'Uvedení VZT do provozu',
    icon: 'thermometer',
    defaultChecklist: [
      'Kontrola montáže jednotky',
      'Kontrola elektro připojení',
      'Kontrola regulace',
      'Nastavení průtoků',
      'Kontrola odtoku kondenzátu',
      'Měření teploty na výstupu',
      'Měření příkonu',
      'Kontrola vibrací',
      'Zaškolení obsluhy',
    ],
  },
  {
    key: 'waterproofing_test',
    label: 'Zkouška hydroizolace',
    icon: 'droplets',
    defaultChecklist: [
      'Vizuální kontrola izolace',
      'Kontrola spojů a přechodů',
      'Zkouška zatopením',
      'Udržení hladiny po stanovenou dobu',
      'Kontrola průsaku na spodní straně',
      'Kontrola prostupů',
      'Kontrola napojení na svislou izolaci',
    ],
  },
  {
    key: 'thermal_imaging',
    label: 'Termovizní měření',
    icon: 'scan',
    defaultChecklist: [
      'Kalibrace termovizní kamery',
      'Měření venkovního pláště budovy',
      'Kontrola oken a dveří',
      'Kontrola střešního pláště',
      'Kontrola podlahového vytápění',
      'Kontrola tepelných mostů',
      'Kontrola rozvodů',
      'Vyhodnocení snímků',
    ],
  },
  {
    key: 'heating_test',
    label: 'Topná zkouška',
    icon: 'thermometer-sun',
    defaultChecklist: [
      'Napuštění a odvzdušnění soustavy',
      'Kontrola tlaku v soustavě',
      'Spuštění zdroje tepla',
      'Kontrola regulace',
      'Měření teplot na radiátorech / okruzích',
      'Zaregulování soustavy',
      'Kontrola expanzní nádoby',
      'Kontrola oběhových čerpadel',
      'Měření teploty zpátečky',
    ],
  },
  {
    key: 'other',
    label: 'Jiný protokol',
    icon: 'file-check',
    defaultChecklist: [],
  },
];

export const RESULT_OPTIONS = [
  { key: 'pass', label: 'Vyhovující', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'conditional', label: 'Podmínečně vyhovující', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'fail', label: 'Nevyhovující', color: 'bg-red-50 text-red-700 border-red-200' },
];

export const STATUS_OPTIONS = [
  { key: 'draft', label: 'Koncept', color: 'bg-slate-100 text-slate-600' },
  { key: 'completed', label: 'Dokončeno', color: 'bg-emerald-50 text-emerald-700' },
  { key: 'archived', label: 'Archivováno', color: 'bg-slate-50 text-slate-400' },
];

export const MEASURED_VALUE_TEMPLATES: Record<string, { key: string; label: string; unit: string }[]> = {
  pressure_test: [
    { key: 'test_pressure', label: 'Zkušební tlak', unit: 'bar' },
    { key: 'hold_duration', label: 'Doba udržení', unit: 'min' },
    { key: 'pressure_drop', label: 'Pokles tlaku', unit: 'bar' },
    { key: 'medium_temperature', label: 'Teplota média', unit: '°C' },
  ],
  electrical_inspection: [
    { key: 'insulation_resistance', label: 'Izolační odpor', unit: 'MΩ' },
    { key: 'loop_impedance', label: 'Impedance smyčky', unit: 'Ω' },
    { key: 'earth_resistance', label: 'Odpor uzemnění', unit: 'Ω' },
    { key: 'rcd_trip_time', label: 'Čas vypnutí RCD', unit: 'ms' },
  ],
  recuperation_regulation: [
    { key: 'supply_airflow', label: 'Průtok přívod', unit: 'm³/h' },
    { key: 'extract_airflow', label: 'Průtok odvod', unit: 'm³/h' },
    { key: 'supply_temperature', label: 'Teplota přívod', unit: '°C' },
    { key: 'extract_temperature', label: 'Teplota odvod', unit: '°C' },
    { key: 'noise_level', label: 'Hladina hluku', unit: 'dB' },
  ],
  gas_inspection: [
    { key: 'gas_pressure', label: 'Tlak plynu', unit: 'mbar' },
    { key: 'co_level', label: 'Hladina CO', unit: 'ppm' },
    { key: 'flue_temperature', label: 'Teplota spalin', unit: '°C' },
  ],
  heating_test: [
    { key: 'system_pressure', label: 'Tlak v soustavě', unit: 'bar' },
    { key: 'supply_temperature', label: 'Teplota přívodní', unit: '°C' },
    { key: 'return_temperature', label: 'Teplota zpátečky', unit: '°C' },
    { key: 'flow_rate', label: 'Průtok', unit: 'l/h' },
  ],
  thermal_imaging: [
    { key: 'outdoor_temp', label: 'Venkovní teplota', unit: '°C' },
    { key: 'indoor_temp', label: 'Vnitřní teplota', unit: '°C' },
    { key: 'min_surface_temp', label: 'Min. povrchová teplota', unit: '°C' },
  ],
  waterproofing_test: [
    { key: 'water_level', label: 'Výška hladiny', unit: 'mm' },
    { key: 'hold_duration', label: 'Doba udržení', unit: 'hod' },
  ],
};
