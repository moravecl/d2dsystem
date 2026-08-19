import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { LightingNorm } from '../types/database';

export function useLightingNorms() {
  const [norms, setNorms] = useState<LightingNorm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('lighting_norms')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      setNorms(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return { norms, loading };
}

export interface LightingCalcResult {
  roomName: string;
  floorName: string;
  areaM2: number;
  requiredLux: number;
  roomType: string;
  totalRequiredLumens: number;
  lights: { productName: string; productId: string; lumens: number; requiredCount: number; currentCount: number }[];
}

const UTILIZATION_FACTOR = 0.9;
const MAINTENANCE_FACTOR = 1.0;

export function calculateLighting(
  requiredLux: number,
  areaM2: number,
  lumensPerLight: number
): number {
  if (lumensPerLight <= 0 || areaM2 <= 0) return 0;
  const totalRequired = (requiredLux * areaM2) / (UTILIZATION_FACTOR * MAINTENANCE_FACTOR);
  return Math.ceil(totalRequired / lumensPerLight);
}

export function calculateRequiredLumens(
  requiredLux: number,
  areaM2: number
): number {
  if (areaM2 <= 0) return 0;
  return Math.round((requiredLux * areaM2) / (UTILIZATION_FACTOR * MAINTENANCE_FACTOR));
}
