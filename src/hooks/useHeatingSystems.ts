import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { HeatingSystem, HeatingSystemOption, HeatingSystemMaterial } from '../types/database';

export interface HeatingSystemFull {
  system: HeatingSystem;
  options: HeatingSystemOption[];
  materials: HeatingSystemMaterial[];
}

export function useHeatingSystems() {
  const [systems, setSystems] = useState<HeatingSystemFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [sysRes, optRes, matRes] = await Promise.all([
        supabase.from('heating_systems').select('*').order('sort_order'),
        supabase.from('heating_system_options').select('*').order('sort_order'),
        supabase.from('heating_system_materials').select('*').eq('is_active', true).order('sort_order'),
      ]);

      const sysList = (sysRes.data ?? []) as HeatingSystem[];
      const optList = (optRes.data ?? []) as HeatingSystemOption[];
      const matList = (matRes.data ?? []) as HeatingSystemMaterial[];

      const full: HeatingSystemFull[] = sysList.map((system) => ({
        system,
        options: optList.filter((o) => o.heating_system_id === system.id),
        materials: matList.filter((m) => m.heating_system_id === system.id),
      }));

      setSystems(full);
      setLoading(false);
    };
    load();
  }, []);

  return { systems, loading };
}

export interface HeatingMaterialLine {
  name: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  wastePercent: number;
}

export function calculateHeatingMaterials(
  systemFull: HeatingSystemFull,
  config: Record<string, string>,
  areaM2: number,
  perimeterM: number
): HeatingMaterialLine[] {
  const lines: HeatingMaterialLine[] = [];
  const pipeOption = config['pipe_diameter'] || '';

  for (const mat of systemFull.materials) {
    if (mat.condition_option_slug && mat.condition_option_value) {
      const selectedVal = config[mat.condition_option_slug] ?? '';
      if (selectedVal !== mat.condition_option_value) continue;

      if (mat.condition_option_slug === 'pipe_diameter' || mat.condition_option_slug === 'pipe_spacing') {
        if (mat.name.includes('Trubka') && pipeOption) {
          const matchesDiameter = mat.name.toLowerCase().includes(pipeOption.replace('x', '×').toLowerCase())
            || mat.name.toLowerCase().includes(pipeOption.toLowerCase());
          if (!matchesDiameter && mat.condition_option_slug === 'pipe_spacing') continue;
        }
      }
    }

    let quantity = 0;
    quantity += mat.quantity_per_m2 * areaM2;
    quantity += mat.quantity_per_m_perimeter * perimeterM;
    quantity += mat.quantity_fixed;

    if (quantity <= 0) continue;

    const wastedQty = quantity * (1 + mat.waste_percent / 100);

    const existing = lines.find((l) => l.name === mat.name && l.unit === mat.unit);
    if (existing) {
      existing.quantity += wastedQty;
      existing.totalPrice = existing.quantity * existing.pricePerUnit;
    } else {
      lines.push({
        name: mat.name,
        unit: mat.unit,
        quantity: wastedQty,
        pricePerUnit: mat.price_per_unit,
        totalPrice: wastedQty * mat.price_per_unit,
        wastePercent: mat.waste_percent,
      });
    }
  }

  return lines;
}
