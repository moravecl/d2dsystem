import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface FvPanel {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  power_wp: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  weight_kg: number;
  technology: 'mono' | 'poly' | 'topcon' | 'hjt' | 'other';
  efficiency_pct: number;
  warranty_product_years: number;
  warranty_performance_years: number;
  price: number;
  purchase_price: number;
  gap_h_mm: number;
  gap_v_mm: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FvInverter {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  power_kw: number;
  phases: 1 | 3;
  mppt_count: number;
  efficiency_pct: number;
  technology: string;
  max_pv_power_kw: number | null;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export type BatteryRole = 'master' | 'slave' | 'bms' | 'standalone';

export interface FvBattery {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  capacity_kwh: number;
  power_kw: number;
  chemistry: 'lfp' | 'nmc' | 'lead' | 'other';
  cycles: number;
  dod_pct: number;
  warranty_years: number;
  price: number;
  purchase_price: number;
  battery_role: BatteryRole;
  compatibility_group: string | null;
  max_slave_units: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FvWallbox {
  id: string;
  org_id: string;
  name: string;
  manufacturer: string;
  power_kw: number;
  phases: 1 | 3;
  connector_type: 'type1' | 'type2' | 'ccs' | 'chademo' | 'other';
  smart_charging: boolean;
  dynamic_load_balancing: boolean;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FvAccessory {
  id: string;
  org_id: string;
  name: string;
  type: 'mounting_flat' | 'mounting_pitched' | 'optimizer' | 'cable' | 'combiner' | 'monitoring' | 'protection' | 'other';
  unit: string;
  price_per_unit: number;
  purchase_price_per_unit: number;
  notes: string | null;
  is_active: boolean;
}

export type RoofTileType = 'tiled' | 'metal_sheet' | 'bitumen' | 'flat' | 'trapezoid' | 'other';

export interface FvRoofTile {
  id: string;
  org_id: string;
  name: string;
  type: RoofTileType;
  hook_spacing_mm: number;
  notes: string | null;
  is_active: boolean;
}

export interface FvHook {
  id: string;
  org_id: string;
  name: string;
  compatible_tile_type: RoofTileType;
  height_mm: number;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FvRailProfile {
  id: string;
  org_id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  length_mm: number;
  material: 'aluminum' | 'steel' | 'other';
  price_per_m: number;
  purchase_price_per_m: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FvClamp {
  id: string;
  org_id: string;
  name: string;
  clamp_type: 'mid' | 'end';
  min_thickness_mm: number;
  max_thickness_mm: number;
  price: number;
  purchase_price: number;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export type FvLaborComponentType = 'panel' | 'inverter' | 'battery' | 'wallbox' | 'construction' | 'other';

export interface FvLaborRate {
  id: string;
  org_id: string;
  name: string;
  component_type: FvLaborComponentType;
  price_per_unit: number;
  purchase_price_per_unit: number;
  unit: string;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface FvCatalogData {
  panels: FvPanel[];
  inverters: FvInverter[];
  batteries: FvBattery[];
  wallboxes: FvWallbox[];
  accessories: FvAccessory[];
  roofTiles: FvRoofTile[];
  hooks: FvHook[];
  railProfiles: FvRailProfile[];
  clamps: FvClamp[];
  laborRates: FvLaborRate[];
  loading: boolean;
  reload: () => void;
}

export function useFvCatalog(): FvCatalogData {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [panels, setPanels] = useState<FvPanel[]>([]);
  const [inverters, setInverters] = useState<FvInverter[]>([]);
  const [batteries, setBatteries] = useState<FvBattery[]>([]);
  const [wallboxes, setWallboxes] = useState<FvWallbox[]>([]);
  const [accessories, setAccessories] = useState<FvAccessory[]>([]);
  const [roofTiles, setRoofTiles] = useState<FvRoofTile[]>([]);
  const [hooks, setHooks] = useState<FvHook[]>([]);
  const [railProfiles, setRailProfiles] = useState<FvRailProfile[]>([]);
  const [clamps, setClamps] = useState<FvClamp[]>([]);
  const [laborRates, setLaborRates] = useState<FvLaborRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);

    Promise.all([
      supabase.from('fv_panels').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('fv_inverters').select('*').eq('org_id', organizationId).eq('is_active', true).order('power_kw'),
      supabase.from('fv_batteries').select('*').eq('org_id', organizationId).eq('is_active', true).order('capacity_kwh'),
      supabase.from('fv_wallboxes').select('*').eq('org_id', organizationId).eq('is_active', true).order('power_kw'),
      supabase.from('fv_accessories').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('fv_roof_tiles').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('fv_hooks').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('fv_rail_profiles').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('fv_clamps').select('*').eq('org_id', organizationId).eq('is_active', true).order('name'),
      supabase.from('fv_labor_rates').select('*').eq('org_id', organizationId).eq('is_active', true).order('sort_order'),
    ]).then(([p, inv, bat, wb, acc, rt, hk, rp, cl, lr]) => {
      setPanels((p.data ?? []) as FvPanel[]);
      setInverters((inv.data ?? []) as FvInverter[]);
      setBatteries((bat.data ?? []) as FvBattery[]);
      setWallboxes((wb.data ?? []) as FvWallbox[]);
      setAccessories((acc.data ?? []) as FvAccessory[]);
      setRoofTiles((rt.data ?? []) as FvRoofTile[]);
      setHooks((hk.data ?? []) as FvHook[]);
      setRailProfiles((rp.data ?? []) as FvRailProfile[]);
      setClamps((cl.data ?? []) as FvClamp[]);
      setLaborRates((lr.data ?? []) as FvLaborRate[]);
      setLoading(false);
    });
  }, [organizationId, tick]);

  return { panels, inverters, batteries, wallboxes, accessories, roofTiles, hooks, railProfiles, clamps, laborRates, loading, reload: () => setTick(t => t + 1) };
}
