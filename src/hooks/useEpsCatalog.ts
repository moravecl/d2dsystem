import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface EpsDetectorModel {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  model_number: string;
  detector_type: 'smoke' | 'heat' | 'smoke_heat' | 'linear' | 'manual_call_point' | 'gas' | 'co' | 'flame';
  connection_type: 'bus' | 'wireless';
  detection_range_m: number;
  detection_angle_deg: number;
  max_coverage_area_m2: number;
  max_ceiling_height_m: number;
  has_siren: boolean;
  ip_rating: string;
  operating_temp_min: number;
  operating_temp_max: number;
  power_source: 'bus_12v' | 'battery_aa' | 'battery_lithium' | 'mains_230v';
  battery_life_years: number | null;
  frequency_mhz: number | null;
  wireless_range_m: number | null;
  en_class: string;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsPanel {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  model_number: string;
  max_zones: number;
  max_sections: number;
  max_users: number;
  bus_support: boolean;
  wireless_support: boolean;
  communicator_type: 'gsm' | 'gsm_lan' | 'gsm_gprs' | 'none';
  backup_battery_ah: number;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsSiren {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  model_number: string;
  siren_type: 'indoor' | 'outdoor' | 'combined';
  connection_type: 'bus' | 'wireless';
  sound_level_db: number;
  has_strobe: boolean;
  power_source: string;
  ip_rating: string;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsCable {
  id: string;
  org_id: string;
  name: string;
  cable_type: 'jhfe' | 'jb_h_st' | 'shf' | 'standard';
  fire_resistance_minutes: number;
  max_length_m: number;
  price_per_m: number;
  purchase_price_per_m: number;
  notes: string | null;
  is_active: boolean;
}

export interface EpsAccessory {
  id: string;
  org_id: string;
  name: string;
  accessory_type: 'base' | 'module' | 'repeater' | 'power_supply' | 'io_module' | 'other';
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsMotionSensor {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  model_number: string;
  sensor_type: 'pir' | 'pir_camera' | 'dual_tech' | 'curtain' | 'outdoor' | 'pet_immune';
  connection_type: 'bus' | 'wireless';
  detection_range_m: number;
  detection_angle_deg: number;
  pet_immune_kg: number;
  has_camera: boolean;
  ip_rating: string;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsKeypad {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  model_number: string;
  keypad_type: 'lcd' | 'segment' | 'rfid' | 'touch' | 'combined';
  connection_type: 'bus' | 'wireless';
  has_rfid: boolean;
  has_display: boolean;
  sections_control: number;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsControlDevice {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  model_number: string;
  device_type: 'remote_control' | 'relay_output' | 'communicator' | 'expander' | 'thermostat' | 'rfid_tag' | 'other';
  connection_type: 'bus' | 'wireless' | 'standalone';
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface EpsCatalogData {
  detectors: EpsDetectorModel[];
  panels: EpsPanel[];
  sirens: EpsSiren[];
  cables: EpsCable[];
  accessories: EpsAccessory[];
  motionSensors: EpsMotionSensor[];
  keypads: EpsKeypad[];
  controlDevices: EpsControlDevice[];
  loading: boolean;
  reload: () => void;
}

export function useEpsCatalog(): EpsCatalogData {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [detectors, setDetectors] = useState<EpsDetectorModel[]>([]);
  const [panels, setPanels] = useState<EpsPanel[]>([]);
  const [sirens, setSirens] = useState<EpsSiren[]>([]);
  const [cables, setCables] = useState<EpsCable[]>([]);
  const [accessories, setAccessories] = useState<EpsAccessory[]>([]);
  const [motionSensors, setMotionSensors] = useState<EpsMotionSensor[]>([]);
  const [keypads, setKeypads] = useState<EpsKeypad[]>([]);
  const [controlDevices, setControlDevices] = useState<EpsControlDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);

    Promise.all([
      supabase.from('eps_detector_models').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('eps_panels').select('*').eq('org_id', organizationId).eq('is_active', true).order('max_zones'),
      supabase.from('eps_sirens').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('eps_cables').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('eps_accessories').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('eps_motion_sensors').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('eps_keypads').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('eps_control_devices').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
    ]).then(([det, pan, sir, cab, acc, mot, key, ctrl]) => {
      setDetectors((det.data ?? []) as EpsDetectorModel[]);
      setPanels((pan.data ?? []) as EpsPanel[]);
      setSirens((sir.data ?? []) as EpsSiren[]);
      setCables((cab.data ?? []) as EpsCable[]);
      setAccessories((acc.data ?? []) as EpsAccessory[]);
      setMotionSensors((mot.data ?? []) as EpsMotionSensor[]);
      setKeypads((key.data ?? []) as EpsKeypad[]);
      setControlDevices((ctrl.data ?? []) as EpsControlDevice[]);
      setLoading(false);
    });
  }, [organizationId, tick]);

  return { detectors, panels, sirens, cables, accessories, motionSensors, keypads, controlDevices, loading, reload: () => setTick(t => t + 1) };
}
