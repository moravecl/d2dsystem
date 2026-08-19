import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface CameraModel {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  camera_type: 'dome' | 'bullet' | 'ptz' | 'fisheye' | 'box';
  resolution_w: number;
  resolution_h: number;
  resolution_label: string;
  h_fov_deg: number;
  v_fov_deg: number;
  lens_mm: number;
  ir_range_m: number;
  poe: boolean;
  power_w: number;
  ip_rating: string;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface CameraNvr {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  channels: number;
  max_resolution_label: string;
  hdd_bays: number;
  max_hdd_tb: number;
  poe_ports: number;
  poe_budget_w: number;
  throughput_mbps: number;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface CameraCable {
  id: string;
  org_id: string;
  name: string;
  cable_type: 'utp_cat5e' | 'utp_cat6' | 'coax' | 'fiber';
  max_length_m: number;
  price_per_m: number;
  purchase_price_per_m: number;
  notes: string | null;
  is_active: boolean;
}

export interface CameraPoeSwitch {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  poe_ports: number;
  uplink_ports: number;
  poe_budget_w: number;
  managed: boolean;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface CameraAccessory {
  id: string;
  org_id: string;
  name: string;
  accessory_type: 'bracket' | 'junction_box' | 'hdd' | 'power_supply' | 'other';
  capacity_tb: number | null;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface CameraCatalogData {
  cameras: CameraModel[];
  nvrs: CameraNvr[];
  cables: CameraCable[];
  poeSwitches: CameraPoeSwitch[];
  accessories: CameraAccessory[];
  loading: boolean;
  reload: () => void;
}

export function useCameraCatalog(): CameraCatalogData {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [cameras, setCameras] = useState<CameraModel[]>([]);
  const [nvrs, setNvrs] = useState<CameraNvr[]>([]);
  const [cables, setCables] = useState<CameraCable[]>([]);
  const [poeSwitches, setPoeSwitches] = useState<CameraPoeSwitch[]>([]);
  const [accessories, setAccessories] = useState<CameraAccessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);

    Promise.all([
      supabase.from('camera_models').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('camera_nvrs').select('*').eq('org_id', organizationId).eq('is_active', true).order('channels'),
      supabase.from('camera_cables').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('camera_poe_switches').select('*').eq('org_id', organizationId).eq('is_active', true).order('poe_ports'),
      supabase.from('camera_accessories').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
    ]).then(([cam, nvr, cab, poe, acc]) => {
      setCameras((cam.data ?? []) as CameraModel[]);
      setNvrs((nvr.data ?? []) as CameraNvr[]);
      setCables((cab.data ?? []) as CameraCable[]);
      setPoeSwitches((poe.data ?? []) as CameraPoeSwitch[]);
      setAccessories((acc.data ?? []) as CameraAccessory[]);
      setLoading(false);
    });
  }, [organizationId, tick]);

  return { cameras, nvrs, cables, poeSwitches, accessories, loading, reload: () => setTick(t => t + 1) };
}
