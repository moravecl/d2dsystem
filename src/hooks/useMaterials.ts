import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Material } from '../types/database';

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('trade')
        .order('sort_order');
      setMaterials(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return { materials, loading };
}
