import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { ElementTypeProductCompatibility, CompatibilityType } from '../types/designElements';

export interface CompatibilityMap {
  getCompatibility(elementTypeId: string, productId: string): CompatibilityType | null;
  isCompatible(elementTypeId: string, productId: string): boolean;
  isRecommended(elementTypeId: string, productId: string): boolean;
  getCompatibleProducts(elementTypeId: string): string[];
  getRecommendedProducts(elementTypeId: string): string[];
  getIncompatibleProducts(elementTypeId: string): string[];
}

export function useElementTypeCompatibility() {
  const [compatibilities, setCompatibilities] = useState<ElementTypeProductCompatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('element_type_product_compatibility')
      .select('*')
      .order('created_at');

    if (err) {
      setError(err.message);
    } else {
      setCompatibilities((data as ElementTypeProductCompatibility[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const compatibilityMap: CompatibilityMap = useMemo(() => {
    const byElementType = new Map<string, Map<string, ElementTypeProductCompatibility>>();

    for (const c of compatibilities) {
      if (!byElementType.has(c.element_type_id)) {
        byElementType.set(c.element_type_id, new Map());
      }
      byElementType.get(c.element_type_id)!.set(c.product_id, c);
    }

    return {
      getCompatibility(elementTypeId: string, productId: string): CompatibilityType | null {
        const typeMap = byElementType.get(elementTypeId);
        if (!typeMap) return null;
        const entry = typeMap.get(productId);
        return entry?.compatibility_type ?? null;
      },

      isCompatible(elementTypeId: string, productId: string): boolean {
        const compat = this.getCompatibility(elementTypeId, productId);
        return compat === null || compat === 'compatible' || compat === 'recommended';
      },

      isRecommended(elementTypeId: string, productId: string): boolean {
        return this.getCompatibility(elementTypeId, productId) === 'recommended';
      },

      getCompatibleProducts(elementTypeId: string): string[] {
        const typeMap = byElementType.get(elementTypeId);
        if (!typeMap) return [];
        return Array.from(typeMap.entries())
          .filter(([, c]) => c.compatibility_type === 'compatible' || c.compatibility_type === 'recommended')
          .map(([productId]) => productId);
      },

      getRecommendedProducts(elementTypeId: string): string[] {
        const typeMap = byElementType.get(elementTypeId);
        if (!typeMap) return [];
        return Array.from(typeMap.entries())
          .filter(([, c]) => c.compatibility_type === 'recommended')
          .map(([productId]) => productId);
      },

      getIncompatibleProducts(elementTypeId: string): string[] {
        const typeMap = byElementType.get(elementTypeId);
        if (!typeMap) return [];
        return Array.from(typeMap.entries())
          .filter(([, c]) => c.compatibility_type === 'incompatible')
          .map(([productId]) => productId);
      },
    };
  }, [compatibilities]);

  const addCompatibility = useCallback(
    async (params: {
      elementTypeId: string;
      productId: string;
      compatibilityType: CompatibilityType;
      notes?: string;
    }) => {
      const { data, error: err } = await supabase
        .from('element_type_product_compatibility')
        .insert({
          element_type_id: params.elementTypeId,
          product_id: params.productId,
          compatibility_type: params.compatibilityType,
          notes: params.notes ?? null,
        })
        .select()
        .single();

      if (err) return { error: err.message };
      setCompatibilities((prev) => [...prev, data as ElementTypeProductCompatibility]);
      return { data: data as ElementTypeProductCompatibility, error: null };
    },
    []
  );

  const updateCompatibility = useCallback(
    async (
      id: string,
      params: { compatibilityType?: CompatibilityType; notes?: string }
    ) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.compatibilityType !== undefined) {
        updates.compatibility_type = params.compatibilityType;
      }
      if (params.notes !== undefined) {
        updates.notes = params.notes;
      }

      const { data, error: err } = await supabase
        .from('element_type_product_compatibility')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) return { error: err.message };
      setCompatibilities((prev) =>
        prev.map((c) => (c.id === id ? (data as ElementTypeProductCompatibility) : c))
      );
      return { data: data as ElementTypeProductCompatibility, error: null };
    },
    []
  );

  const removeCompatibility = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('element_type_product_compatibility')
      .delete()
      .eq('id', id);

    if (err) return { error: err.message };
    setCompatibilities((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  }, []);

  return {
    compatibilities,
    loading,
    error,
    refetch: fetchData,
    compatibilityMap,
    addCompatibility,
    updateCompatibility,
    removeCompatibility,
  };
}
