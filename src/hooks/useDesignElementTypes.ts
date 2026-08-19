import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignElementType } from '../types/designElements';

export function useDesignElementTypes() {
  const [types, setTypes] = useState<DesignElementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('design_element_types')
      .select('*')
      .order('category')
      .order('sort_order');

    if (err) {
      setError(err.message);
      setTypes([]);
    } else {
      setTypes((data as DesignElementType[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const getTypesByCategory = useCallback(
    (category: string) => types.filter((t) => t.category === category),
    [types]
  );

  const getTypeById = useCallback(
    (id: string) => types.find((t) => t.id === id),
    [types]
  );

  const getTypeBySlug = useCallback(
    (slug: string) => types.find((t) => t.slug === slug),
    [types]
  );

  const categories = [...new Set(types.map((t) => t.category))];

  return {
    types,
    loading,
    error,
    refetch: fetchTypes,
    getTypesByCategory,
    getTypeById,
    getTypeBySlug,
    categories,
  };
}
