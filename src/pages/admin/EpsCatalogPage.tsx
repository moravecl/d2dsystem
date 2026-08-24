import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, X, ShieldAlert, Cpu, Volume2, Cable, Package, Loader2, Move, Keyboard, Radio, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEpsCatalog } from '../../hooks/useEpsCatalog';
import { useCatalogCategories } from '../../hooks/useCatalogCategories';
import type { CategoryGroupDef } from '../../hooks/useCatalogCategories';
import CategoryManager from '../../components/admin/CategoryManager';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import type { EpsDetectorModel, EpsPanel, EpsSiren, EpsCable, EpsAccessory, EpsMotionSensor, EpsKeypad, EpsControlDevice } from '../../hooks/useEpsCatalog';

type Tab = 'detectors' | 'panels' | 'sirens' | 'cables' | 'accessories' | 'motion_sensors' | 'keypads' | 'control_devices' | 'categories';

const TABS: { id: Tab; label: string; icon: typeof ShieldAlert }[] = [
  { id: 'detectors', label: 'Detektory', icon: ShieldAlert },
  { id: 'panels', label: 'Ústředny', icon: Cpu },
  { id: 'sirens', label: 'Sirény', icon: Volume2 },
  { id: 'cables', label: 'Kabely', icon: Cable },
  { id: 'accessories', label: 'Příslušenství', icon: Package },
  { id: 'motion_sensors', label: 'Pohybová čidla', icon: Move },
  { id: 'keypads', label: 'Klávesnice', icon: Keyboard },
  { id: 'control_devices', label: 'Ovládací prvky', icon: Radio },
  { id: 'categories', label: 'Kategorie', icon: Tag },
];

const DETECTOR_TYPE_DEFAULTS: [string, string][] = [
  ['smoke', 'Kourovak'], ['heat', 'Tepelny'], ['smoke_heat', 'Kombinovany'],
  ['linear', 'Linearni'], ['manual_call_point', 'Tlacitkove'], ['gas', 'Plynovy'],
  ['co', 'CO detektor'], ['flame', 'Plamenovy'],
];
const SIREN_TYPE_DEFAULTS: [string, string][] = [['indoor', 'Vnitrni'], ['outdoor', 'Venkovni'], ['combined', 'Kombinovana']];
const CABLE_TYPE_DEFAULTS: [string, string][] = [['jhfe', 'JHFE'], ['jb_h_st', 'JB-H(ST)'], ['shf', 'SHF'], ['standard', 'Standard']];
const ACC_TYPE_DEFAULTS: [string, string][] = [['base', 'Patice'], ['module', 'Modul'], ['repeater', 'Repeater'], ['power_supply', 'Napajeni'], ['io_module', 'I/O modul'], ['other', 'Jine']];
const MOTION_TYPE_DEFAULTS: [string, string][] = [['pir', 'PIR'], ['pir_camera', 'PIR+kamera'], ['dual_tech', 'Dual (PIR+MW)'], ['curtain', 'Zavora'], ['outdoor', 'Venkovni'], ['pet_immune', 'Pet imunni']];
const KEYPAD_TYPE_DEFAULTS: [string, string][] = [['lcd', 'LCD'], ['segment', 'Segmentova'], ['rfid', 'RFID přístup'], ['touch', 'Dotykova'], ['combined', 'Kombinovana']];
const DEVICE_TYPE_DEFAULTS: [string, string][] = [['remote_control', 'Dalkovak'], ['relay_output', 'Rele vystup'], ['communicator', 'Komunikator'], ['expander', 'Rozsirovac'], ['thermostat', 'Termostat'], ['rfid_tag', 'RFID tag'], ['other', 'Ostatni']];
const CONNECTION_DEFAULTS: [string, string][] = [['bus', 'Bus (sbernice)'], ['wireless', 'Bezdrátové']];
const POWER_DEFAULTS: [string, string][] = [['bus_12v', 'Bus 12V'], ['battery_aa', 'AA baterie'], ['battery_lithium', 'Lithiová baterie'], ['mains_230v', 'Sit 230V']];
const COMM_DEFAULTS: [string, string][] = [['gsm', 'GSM'], ['gsm_lan', 'GSM+LAN'], ['gsm_gprs', 'GSM+GPRS'], ['none', 'Zadny']];

const EPS_CATEGORY_GROUPS: CategoryGroupDef[] = [
  { group: 'detector_type', label: 'Typy detektoru', defaults: DETECTOR_TYPE_DEFAULTS },
  { group: 'sirén_type', label: 'Typy sirén', defaults: SIREN_TYPE_DEFAULTS },
  { group: 'eps_cable_type', label: 'Typy kabelu', defaults: CABLE_TYPE_DEFAULTS },
  { group: 'eps_accessory_type', label: 'Typy příslušenství', defaults: ACC_TYPE_DEFAULTS },
  { group: 'motion_type', label: 'Typy pohybových čidel', defaults: MOTION_TYPE_DEFAULTS },
  { group: 'keypad_type', label: 'Typy klávesnic', defaults: KEYPAD_TYPE_DEFAULTS },
  { group: 'device_type', label: 'Typy ovládacích prvku', defaults: DEVICE_TYPE_DEFAULTS },
  { group: 'connection_type', label: 'Typy připojení', defaults: CONNECTION_DEFAULTS },
  { group: 'power_source', label: 'Typy napájení', defaults: POWER_DEFAULTS },
  { group: 'communicator_type', label: 'Typy komunikátoru', defaults: COMM_DEFAULTS },
];

const DETECTOR_TYPE_LABELS: Record<string, string> = {
  smoke: 'Kourovak', heat: 'Tepelny', smoke_heat: 'Kombinovany',
  linear: 'Linearni', manual_call_point: 'Tlacitkove', gas: 'Plynovy',
  co: 'CO detektor', flame: 'Plamenovy',
};
const CONNECTION_LABELS: Record<string, string> = { bus: 'Bus (sbernice)', wireless: 'Bezdrátové' };
const SIREN_TYPE_LABELS: Record<string, string> = { indoor: 'Vnitrni', outdoor: 'Venkovni', combined: 'Kombinovana' };
const CABLE_TYPE_LABELS: Record<string, string> = { jhfe: 'JHFE', jb_h_st: 'JB-H(ST)', shf: 'SHF', standard: 'Standard' };
const ACC_TYPE_LABELS: Record<string, string> = { base: 'Patice', module: 'Modul', repeater: 'Repeater', power_supply: 'Napajeni', io_module: 'I/O modul', other: 'Jine' };
const POWER_LABELS: Record<string, string> = { bus_12v: 'Bus 12V', battery_aa: 'AA baterie', battery_lithium: 'Lithiová baterie', mains_230v: 'Sit 230V' };
const COMM_LABELS: Record<string, string> = { gsm: 'GSM', gsm_lan: 'GSM+LAN', gsm_gprs: 'GSM+GPRS', none: 'Zadny' };
const MOTION_TYPE_LABELS: Record<string, string> = { pir: 'PIR', pir_camera: 'PIR+kamera', dual_tech: 'Dual (PIR+MW)', curtain: 'Zavora', outdoor: 'Venkovni', pet_immune: 'Pet imunni' };
const KEYPAD_TYPE_LABELS: Record<string, string> = { lcd: 'LCD', segment: 'Segmentova', rfid: 'RFID přístup', touch: 'Dotykova', combined: 'Kombinovana' };
const DEVICE_TYPE_LABELS: Record<string, string> = { remote_control: 'Dalkovak', relay_output: 'Rele vystup', communicator: 'Komunikator', expander: 'Rozsirovac', thermostat: 'Termostat', rfid_tag: 'RFID tag', other: 'Ostatni' };

const TABLE_NAME: Partial<Record<Tab, string>> = {
  detectors: 'eps_detector_models', panels: 'eps_panels', sirens: 'eps_sirens',
  cables: 'eps_cables', accessories: 'eps_accessories',
  motion_sensors: 'eps_motion_sensors', keypads: 'eps_keypads', control_devices: 'eps_control_devices',
};

type AnyItem = EpsDetectorModel | EpsPanel | EpsSiren | EpsCable | EpsAccessory | EpsMotionSensor | EpsKeypad | EpsControlDevice;

function emptyItem(tab: Tab): Partial<AnyItem> {
  if (tab === 'detectors') return {
    name: '', manufacturer: 'Jablotron', model_number: '', detector_type: 'smoke', connection_type: 'bus',
    detection_range_m: 7.5, detection_angle_deg: 360, max_coverage_area_m2: 150, max_ceiling_height_m: 12,
    has_siren: false, ip_rating: 'IP40', operating_temp_min: -10, operating_temp_max: 55,
    power_source: 'bus_12v', en_class: '', price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsDetectorModel>;
  if (tab === 'panels') return {
    name: '', manufacturer: 'Jablotron', model_number: '', max_zones: 50, max_sections: 15,
    max_users: 50, bus_support: true, wireless_support: true, communicator_type: 'gsm_lan',
    backup_battery_ah: 7, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsPanel>;
  if (tab === 'sirens') return {
    name: '', manufacturer: 'Jablotron', model_number: '', siren_type: 'indoor', connection_type: 'bus',
    sound_level_db: 100, has_strobe: true, power_source: 'bus_12v', ip_rating: 'IP40',
    price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsSiren>;
  if (tab === 'cables') return {
    name: '', cable_type: 'standard', fire_resistance_minutes: 0, max_length_m: 500,
    price_per_m: 0, purchase_price_per_m: 0, notes: '', is_active: true,
  } as Partial<EpsCable>;
  if (tab === 'motion_sensors') return {
    name: '', manufacturer: 'Jablotron', model_number: '', sensor_type: 'pir', connection_type: 'bus',
    detection_range_m: 12, detection_angle_deg: 110, pet_immune_kg: 0, has_camera: false, ip_rating: 'IP40',
    price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsMotionSensor>;
  if (tab === 'keypads') return {
    name: '', manufacturer: 'Jablotron', model_number: '', keypad_type: 'lcd', connection_type: 'bus',
    has_rfid: false, has_display: true, sections_control: 1,
    price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsKeypad>;
  if (tab === 'control_devices') return {
    name: '', manufacturer: 'Jablotron', model_number: '', device_type: 'other', connection_type: 'bus',
    price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsControlDevice>;
  return {
    name: '', accessory_type: 'other', price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
  } as Partial<EpsAccessory>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
      <input className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-red-400 bg-white/[0.06]" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
      <input type="number" step={step ?? 1} min="0" className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-red-400 bg-white/[0.06]" value={value} onChange={e => onChange(step ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
      <select className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-red-400 bg-white/[0.06]" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}

function Row({ children, cols }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid gap-3 ${cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{children}</div>;
}

function DetectorFields({ data, onChange, opts }: { data: Partial<EpsDetectorModel>; onChange: (d: Partial<EpsDetectorModel>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsDetectorModel, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row cols={2}><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /><Field label="Číslo modelu" value={data.model_number ?? ''} onChange={v => set('model_number', v)} /></Row>
      <Row cols={2}><Field label="Výrobce" value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><SelectField label="Typ detektoru" value={data.detector_type ?? 'smoke'} options={opts.detector_type} onChange={v => set('detector_type', v)} /></Row>
      <Row cols={2}><SelectField label="Připojení" value={data.connection_type ?? 'bus'} options={opts.connection_type} onChange={v => set('connection_type', v)} /><SelectField label="Napájení" value={data.power_source ?? 'bus_12v'} options={opts.power_source} onChange={v => set('power_source', v)} /></Row>
      <Row cols={3}>
        <NumField label="Dosah detekce (m)" value={data.detection_range_m ?? 7.5} step={0.1} onChange={v => set('detection_range_m', v)} />
        <NumField label="Úhel (°)" value={data.detection_angle_deg ?? 360} onChange={v => set('detection_angle_deg', v)} />
        <NumField label="Max plocha (m2)" value={data.max_coverage_area_m2 ?? 150} onChange={v => set('max_coverage_area_m2', v)} />
      </Row>
      <Row cols={3}>
        <NumField label="Max výška stropu (m)" value={data.max_ceiling_height_m ?? 12} step={0.1} onChange={v => set('max_ceiling_height_m', v)} />
        <Field label="IP stupeň" value={data.ip_rating ?? 'IP40'} onChange={v => set('ip_rating', v)} />
        <Field label="EN třída" value={data.en_class ?? ''} onChange={v => set('en_class', v)} />
      </Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
      <Row><Field label="Poznámka" value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
    </>
  );
}

function PanelFields({ data, onChange, opts }: { data: Partial<EpsPanel>; onChange: (d: Partial<EpsPanel>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsPanel, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row cols={2}><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /><Field label="Číslo modelu" value={data.model_number ?? ''} onChange={v => set('model_number', v)} /></Row>
      <Row cols={3}>
        <NumField label="Max zón" value={data.max_zones ?? 50} onChange={v => set('max_zones', v)} />
        <NumField label="Max sekcí" value={data.max_sections ?? 15} onChange={v => set('max_sections', v)} />
        <NumField label="Max uživatelů" value={data.max_users ?? 50} onChange={v => set('max_users', v)} />
      </Row>
      <Row cols={2}>
        <SelectField label="Komunikátor" value={data.communicator_type ?? 'gsm_lan'} options={opts.communicator_type} onChange={v => set('communicator_type', v)} />
        <NumField label="Záložní baterie (Ah)" value={data.backup_battery_ah ?? 7} step={0.1} onChange={v => set('backup_battery_ah', v)} />
      </Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
    </>
  );
}

function SirenFields({ data, onChange, opts }: { data: Partial<EpsSiren>; onChange: (d: Partial<EpsSiren>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsSiren, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row cols={2}><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /><Field label="Číslo modelu" value={data.model_number ?? ''} onChange={v => set('model_number', v)} /></Row>
      <Row cols={2}>
        <SelectField label="Typ sirény" value={data.siren_type ?? 'indoor'} options={opts.siren_type} onChange={v => set('siren_type', v)} />
        <SelectField label="Připojení" value={data.connection_type ?? 'bus'} options={opts.connection_type} onChange={v => set('connection_type', v)} />
      </Row>
      <Row cols={2}>
        <NumField label="Hlasitost (dB)" value={data.sound_level_db ?? 100} onChange={v => set('sound_level_db', v)} />
        <Field label="IP stupeň" value={data.ip_rating ?? 'IP40'} onChange={v => set('ip_rating', v)} />
      </Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
    </>
  );
}

function CableFields({ data, onChange, opts }: { data: Partial<EpsCable>; onChange: (d: Partial<EpsCable>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsCable, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
      <Row cols={2}>
        <SelectField label="Typ kabelu" value={data.cable_type ?? 'standard'} options={opts.eps_cable_type} onChange={v => set('cable_type', v)} />
        <NumField label="Požární odolnost (min)" value={data.fire_resistance_minutes ?? 0} onChange={v => set('fire_resistance_minutes', v)} />
      </Row>
      <Row cols={2}>
        <NumField label="Nákupní cena/m (Kč)" value={data.purchase_price_per_m ?? 0} step={0.01} onChange={v => set('purchase_price_per_m', v)} />
        <NumField label="Prodejní cena/m (Kč)" value={data.price_per_m ?? 0} step={0.01} onChange={v => set('price_per_m', v)} />
      </Row>
    </>
  );
}

function AccessoryFields({ data, onChange, opts }: { data: Partial<EpsAccessory>; onChange: (d: Partial<EpsAccessory>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsAccessory, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
      <Row><SelectField label="Typ" value={data.accessory_type ?? 'other'} options={opts.eps_accessory_type} onChange={v => set('accessory_type', v)} /></Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
    </>
  );
}

function MotionSensorFields({ data, onChange, opts }: { data: Partial<EpsMotionSensor>; onChange: (d: Partial<EpsMotionSensor>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsMotionSensor, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row cols={2}><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /><Field label="Číslo modelu" value={data.model_number ?? ''} onChange={v => set('model_number', v)} /></Row>
      <Row cols={2}><Field label="Výrobce" value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><SelectField label="Typ čidla" value={data.sensor_type ?? 'pir'} options={opts.motion_type} onChange={v => set('sensor_type', v)} /></Row>
      <Row cols={2}><SelectField label="Připojení" value={data.connection_type ?? 'bus'} options={opts.connection_type} onChange={v => set('connection_type', v)} /><Field label="IP stupeň" value={data.ip_rating ?? 'IP40'} onChange={v => set('ip_rating', v)} /></Row>
      <Row cols={3}>
        <NumField label="Dosah detekce (m)" value={data.detection_range_m ?? 12} step={0.1} onChange={v => set('detection_range_m', v)} />
        <NumField label="Úhel (°)" value={data.detection_angle_deg ?? 110} onChange={v => set('detection_angle_deg', v)} />
        <NumField label="Pet imunita (kg)" value={data.pet_immune_kg ?? 0} onChange={v => set('pet_immune_kg', v)} />
      </Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
      <Row><Field label="Poznámka" value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
    </>
  );
}

function KeypadFields({ data, onChange, opts }: { data: Partial<EpsKeypad>; onChange: (d: Partial<EpsKeypad>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsKeypad, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row cols={2}><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /><Field label="Číslo modelu" value={data.model_number ?? ''} onChange={v => set('model_number', v)} /></Row>
      <Row cols={2}><Field label="Výrobce" value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><SelectField label="Typ klávesnice" value={data.keypad_type ?? 'lcd'} options={opts.keypad_type} onChange={v => set('keypad_type', v)} /></Row>
      <Row cols={2}><SelectField label="Připojení" value={data.connection_type ?? 'bus'} options={opts.connection_type} onChange={v => set('connection_type', v)} /><NumField label="Počet sekcí" value={data.sections_control ?? 1} onChange={v => set('sections_control', v)} /></Row>
      <Row cols={2}>
        <div>
          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1.5">Funkce</label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer">
              <input type="checkbox" checked={data.has_rfid ?? false} onChange={e => set('has_rfid', e.target.checked)} className="accent-red-500" />
              RFID čtečka
            </label>
            <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer">
              <input type="checkbox" checked={data.has_display ?? true} onChange={e => set('has_display', e.target.checked)} className="accent-red-500" />
              Display
            </label>
          </div>
        </div>
        <div />
      </Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
      <Row><Field label="Poznámka" value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
    </>
  );
}

function ControlDeviceFields({ data, onChange, opts }: { data: Partial<EpsControlDevice>; onChange: (d: Partial<EpsControlDevice>) => void; opts: Record<string, [string, string][]> }) {
  const set = (k: keyof EpsControlDevice, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <Row cols={2}><Field label="Název" value={data.name ?? ''} onChange={v => set('name', v)} /><Field label="Číslo modelu" value={data.model_number ?? ''} onChange={v => set('model_number', v)} /></Row>
      <Row cols={2}><Field label="Výrobce" value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><SelectField label="Typ zařízení" value={data.device_type ?? 'other'} options={opts.device_type} onChange={v => set('device_type', v)} /></Row>
      <Row><SelectField label="Připojení" value={data.connection_type ?? 'bus'} options={opts.connection_type} onChange={v => set('connection_type', v)} /></Row>
      <Row cols={2}>
        <NumField label="Nákupní cena (Kč)" value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
        <NumField label="Prodejní cena (Kč)" value={data.price ?? 0} onChange={v => set('price', v)} />
      </Row>
      <Row><Field label="Poznámka" value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
    </>
  );
}

export default function EpsCatalogPage() {
  const catalog = useEpsCatalog();
  const catCats = useCatalogCategories('eps', EPS_CATEGORY_GROUPS);
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('detectors');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AnyItem>>({});
  const [adding, setAdding] = useState(false);
  const [addData, setAddData] = useState<Partial<AnyItem>>({});
  const [saving, setSaving] = useState(false);

  const getItems = (): AnyItem[] => {
    if (tab === 'detectors') return catalog.detectors;
    if (tab === 'panels') return catalog.panels;
    if (tab === 'sirens') return catalog.sirens;
    if (tab === 'cables') return catalog.cables;
    if (tab === 'motion_sensors') return catalog.motionSensors;
    if (tab === 'keypads') return catalog.keypads;
    if (tab === 'control_devices') return catalog.controlDevices;
    if (tab === 'accessories') return catalog.accessories;
    return [];
  };

  const startAdd = () => { setAdding(true); setAddData(emptyItem(tab)); setEditingId(null); };
  const startEdit = (item: AnyItem) => { setEditingId(item.id); setEditData({ ...item }); setAdding(false); };
  const cancelEdit = () => { setEditingId(null); setAdding(false); };

  const handleSave = useCallback(async (id: string | null, data: Partial<AnyItem>) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      if (id) {
        const { error } = await supabase.from(TABLE_NAME[tab]!).update(data).eq('id', id);
        if (error) throw error;
        toast('Uloženo', 'success');
      } else {
        const { error } = await supabase.from(TABLE_NAME[tab]!).insert({ ...data, org_id: organizationId });
        if (error) throw error;
        toast('Přidáno', 'success');
      }
      catalog.reload();
      setEditingId(null);
      setAdding(false);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? JSON.stringify(e);
      toast(msg, 'error');
      console.error('EPS save error:', e);
    } finally { setSaving(false); }
  }, [organizationId, tab, catalog, toast]);

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat?')) return;
    const { error } = await supabase.from(TABLE_NAME[tab]!).delete().eq('id', id);
    if (error) toast(error.message, 'error');
    else { toast('Smazáno', 'success'); catalog.reload(); }
  };

  const resolveOpts = (group: string, fallback: Record<string, string>): [string, string][] => {
    const custom = catCats.getOptions(group);
    return custom.length > 0 ? custom : Object.entries(fallback) as [string, string][];
  };

  const fieldOpts: Record<string, [string, string][]> = {
    detector_type: resolveOpts('detector_type', DETECTOR_TYPE_LABELS),
    siren_type: resolveOpts('siren_type', SIREN_TYPE_LABELS),
    eps_cable_type: resolveOpts('eps_cable_type', CABLE_TYPE_LABELS),
    eps_accessory_type: resolveOpts('eps_accessory_type', ACC_TYPE_LABELS),
    motion_type: resolveOpts('motion_type', MOTION_TYPE_LABELS),
    keypad_type: resolveOpts('keypad_type', KEYPAD_TYPE_LABELS),
    device_type: resolveOpts('device_type', DEVICE_TYPE_LABELS),
    connection_type: resolveOpts('connection_type', CONNECTION_LABELS),
    power_source: resolveOpts('power_source', POWER_LABELS),
    communicator_type: resolveOpts('communicator_type', COMM_LABELS),
  };

  const lbl = (group: string, key: string, fallback: Record<string, string>) =>
    catCats.getLabel(group, key) || fallback[key] || key;

  const renderFields = (data: Partial<AnyItem>, onChange: (d: Partial<AnyItem>) => void) => {
    if (tab === 'detectors') return <DetectorFields data={data as Partial<EpsDetectorModel>} onChange={onChange as (d: Partial<EpsDetectorModel>) => void} opts={fieldOpts} />;
    if (tab === 'panels') return <PanelFields data={data as Partial<EpsPanel>} onChange={onChange as (d: Partial<EpsPanel>) => void} opts={fieldOpts} />;
    if (tab === 'sirens') return <SirenFields data={data as Partial<EpsSiren>} onChange={onChange as (d: Partial<EpsSiren>) => void} opts={fieldOpts} />;
    if (tab === 'cables') return <CableFields data={data as Partial<EpsCable>} onChange={onChange as (d: Partial<EpsCable>) => void} opts={fieldOpts} />;
    if (tab === 'motion_sensors') return <MotionSensorFields data={data as Partial<EpsMotionSensor>} onChange={onChange as (d: Partial<EpsMotionSensor>) => void} opts={fieldOpts} />;
    if (tab === 'keypads') return <KeypadFields data={data as Partial<EpsKeypad>} onChange={onChange as (d: Partial<EpsKeypad>) => void} opts={fieldOpts} />;
    if (tab === 'control_devices') return <ControlDeviceFields data={data as Partial<EpsControlDevice>} onChange={onChange as (d: Partial<EpsControlDevice>) => void} opts={fieldOpts} />;
    return <AccessoryFields data={data as Partial<EpsAccessory>} onChange={onChange as (d: Partial<EpsAccessory>) => void} opts={fieldOpts} />;
  };

  const getSubline = (item: AnyItem): string => {
    if (tab === 'detectors') {
      const d = item as EpsDetectorModel;
      return `${d.manufacturer} · ${lbl('detector_type', d.detector_type, DETECTOR_TYPE_LABELS)} · ${lbl('connection_type', d.connection_type, CONNECTION_LABELS)} · ${d.detection_range_m}m · ${d.price.toLocaleString('cs-CZ')} Kc`;
    }
    if (tab === 'panels') {
      const p = item as EpsPanel;
      return `${p.manufacturer} · ${p.max_zones} zon · ${lbl('communicator_type', p.communicator_type, COMM_LABELS)} · ${p.price.toLocaleString('cs-CZ')} Kc`;
    }
    if (tab === 'sirens') {
      const s = item as EpsSiren;
      return `${s.manufacturer} · ${lbl('siren_type', s.siren_type, SIREN_TYPE_LABELS)} · ${s.sound_level_db} dB · ${s.price.toLocaleString('cs-CZ')} Kc`;
    }
    if (tab === 'cables') {
      const c = item as EpsCable;
      return `${lbl('eps_cable_type', c.cable_type, CABLE_TYPE_LABELS)} · ${c.fire_resistance_minutes > 0 ? `${c.fire_resistance_minutes} min` : 'Standard'} · ${c.price_per_m} Kc/m`;
    }
    if (tab === 'motion_sensors') {
      const m = item as EpsMotionSensor;
      return `${m.manufacturer} · ${lbl('motion_type', m.sensor_type, MOTION_TYPE_LABELS)} · ${lbl('connection_type', m.connection_type, CONNECTION_LABELS)} · ${m.detection_range_m}m · ${m.price.toLocaleString('cs-CZ')} Kc`;
    }
    if (tab === 'keypads') {
      const k = item as EpsKeypad;
      return `${k.manufacturer} · ${lbl('keypad_type', k.keypad_type, KEYPAD_TYPE_LABELS)} · ${lbl('connection_type', k.connection_type, CONNECTION_LABELS)} · ${k.price.toLocaleString('cs-CZ')} Kc`;
    }
    if (tab === 'control_devices') {
      const cd = item as EpsControlDevice;
      return `${cd.manufacturer} · ${lbl('device_type', cd.device_type, DEVICE_TYPE_LABELS)} · ${lbl('connection_type', cd.connection_type, CONNECTION_LABELS)} · ${cd.price.toLocaleString('cs-CZ')} Kc`;
    }
    const a = item as EpsAccessory;
    return `${lbl('eps_accessory_type', a.accessory_type, ACC_TYPE_LABELS)} · ${a.price.toLocaleString('cs-CZ')} Kc`;
  };

  const items = getItems();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">EPS / EZS katalog</h1>
            <p className="text-sm text-slate-500 font-medium">Detektory, čidla, ústředny, klávesnice, sirény, ovládání, kabely a příslušenství</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.06] rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const count = (() => {
            if (t.id === 'detectors') return catalog.detectors.length;
            if (t.id === 'panels') return catalog.panels.length;
            if (t.id === 'sirens') return catalog.sirens.length;
            if (t.id === 'cables') return catalog.cables.length;
            if (t.id === 'motion_sensors') return catalog.motionSensors.length;
            if (t.id === 'keypads') return catalog.keypads.length;
            if (t.id === 'control_devices') return catalog.controlDevices.length;
            if (t.id === 'accessories') return catalog.accessories.length;
            if (t.id === 'categories') return EPS_CATEGORY_GROUPS.length;
            return 0;
          })();
          return (
            <button key={t.id} onClick={() => { setTab(t.id); cancelEdit(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-extrabold text-xs transition ${tab === t.id ? 'bg-white/[0.06] text-red-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {count > 0 && <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.08] text-slate-500'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'categories' ? (
        <CategoryManager
          groups={EPS_CATEGORY_GROUPS}
          getCategoriesForGroup={catCats.getCategoriesForGroup}
          hasCustomCategories={catCats.hasCustomCategories}
          seedDefaults={catCats.seedDefaults}
          addCategory={catCats.addCategory}
          updateCategory={catCats.updateCategory}
          deleteCategory={catCats.deleteCategory}
          accentColor="red"
        />
      ) : (<>

      <div className="flex justify-end mb-4">
        <button onClick={startAdd} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-extrabold text-sm hover:bg-red-700 transition">
          <Plus className="w-4 h-4" /> Přidat
        </button>
      </div>

      {adding && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <div className="text-sm font-extrabold text-white mb-4">Nová položka</div>
          <div className="space-y-3">{renderFields(addData, setAddData)}</div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => handleSave(null, addData)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl font-extrabold text-sm hover:bg-red-700 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Přidat
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 bg-navy-800/60 border border-white/[0.08] rounded-xl font-extrabold text-sm text-slate-400 hover:bg-white/[0.04] transition flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Zrušit
            </button>
          </div>
        </div>
      )}

      {catalog.loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
      ) : items.length === 0 && !adding ? (
        <div className="text-center py-12 text-slate-400">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <div className="font-extrabold">Žádné položky</div>
          <div className="text-sm mt-1">Klikněte na "Přidat" pro první položku.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`rounded-xl border bg-white/[0.06] overflow-hidden transition ${editingId === item.id ? 'border-red-500/30 shadow-md' : 'border-white/10 hover:border-white/[0.12]'}`}>
              {editingId === item.id ? (
                <div className="p-4">
                  <div className="space-y-3 mb-4">{renderFields(editData, setEditData)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(item.id, editData)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl font-extrabold text-sm hover:bg-red-700 transition disabled:opacity-50">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Uložit
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2 bg-navy-800/60 border border-white/[0.08] rounded-xl font-extrabold text-sm text-slate-400 hover:bg-white/[0.04] transition flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Zrušit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-white truncate">{item.name}</div>
                    <div className="text-[11px] font-extrabold text-slate-400 truncate">{getSubline(item)}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </>)}
    </div>
  );
}
