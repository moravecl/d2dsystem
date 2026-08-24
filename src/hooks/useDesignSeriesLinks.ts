import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignSeriesProductLink } from '../types/designElements';

export interface DesignSeriesLinkMap {
  getProductForRole(designSeriesId: string, roleKey: string): string | null;
  getDefaultProductForRole(designSeriesId: string, roleKey: string): string | null;
  getAlternativesForRole(designSeriesId: string, roleKey: string): string[];
  getRolesForDesignSeries(designSeriesId: string): string[];
  resolveModulesToProducts(designSeriesId: string, modules: string[]): Map<string, string>;
}

export function useDesignSeriesLinks(designSeriesId?: string) {
  const [links, setLinks] = useState<DesignSeriesProductLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('design_series_product_links')
      .select('*')
      .order('priority', { ascending: false });

    if (designSeriesId) {
      query = query.eq('design_series_id', designSeriesId);
    }

    const { data, error: err } = await query;

    if (err) {
      setError(err.message);
    } else {
      setLinks((data as DesignSeriesProductLink[]) || []);
    }
    setLoading(false);
  }, [designSeriesId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const linkMap: DesignSeriesLinkMap = useMemo(() => {
    const bySeriesAndRole = new Map<string, Map<string, DesignSeriesProductLink[]>>();

    for (const link of links) {
      const key = link.design_series_id;
      if (!bySeriesAndRole.has(key)) {
        bySeriesAndRole.set(key, new Map());
      }
      const roleMap = bySeriesAndRole.get(key)!;
      if (!roleMap.has(link.role_key)) {
        roleMap.set(link.role_key, []);
      }
      roleMap.get(link.role_key)!.push(link);
    }

    for (const roleMap of bySeriesAndRole.values()) {
      for (const [, roleLinks] of roleMap) {
        roleLinks.sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return b.priority - a.priority;
        });
      }
    }

    return {
      getProductForRole(dsId: string, roleKey: string): string | null {
        const roleMap = bySeriesAndRole.get(dsId);
        if (!roleMap) return null;
        const roleLinks = roleMap.get(roleKey);
        if (!roleLinks || roleLinks.length === 0) return null;
        return roleLinks[0].product_id;
      },

      getDefaultProductForRole(dsId: string, roleKey: string): string | null {
        const roleMap = bySeriesAndRole.get(dsId);
        if (!roleMap) return null;
        const roleLinks = roleMap.get(roleKey);
        if (!roleLinks) return null;
        const defaultLink = roleLinks.find((l) => l.is_default);
        return defaultLink?.product_id ?? null;
      },

      getAlternativesForRole(dsId: string, roleKey: string): string[] {
        const roleMap = bySeriesAndRole.get(dsId);
        if (!roleMap) return [];
        const roleLinks = roleMap.get(roleKey);
        if (!roleLinks) return [];
        return roleLinks.map((l) => l.product_id);
      },

      getRolesForDesignSeries(dsId: string): string[] {
        const roleMap = bySeriesAndRole.get(dsId);
        if (!roleMap) return [];
        return Array.from(roleMap.keys());
      },

      resolveModulesToProducts(dsId: string, modules: string[]): Map<string, string> {
        const result = new Map<string, string>();
        for (const module of modules) {
          const productId = this.getProductForRole(dsId, module);
          if (productId) {
            result.set(module, productId);
          }
        }
        return result;
      },
    };
  }, [links]);

  const addLink = useCallback(
    async (params: {
      designSeriesId: string;
      productId: string;
      roleKey: string;
      isDefault?: boolean;
      priority?: number;
      notes?: string;
    }) => {
      const { data, error: err } = await supabase
        .from('design_series_product_links')
        .insert({
          design_series_id: params.designSeriesId,
          product_id: params.productId,
          role_key: params.roleKey,
          is_default: params.isDefault ?? false,
          priority: params.priority ?? 0,
          notes: params.notes ?? null,
        })
        .select()
        .single();

      if (err) return { error: err.message };
      setLinks((prev) => [...prev, data as DesignSeriesProductLink]);
      return { data: data as DesignSeriesProductLink, error: null };
    },
    []
  );

  const updateLink = useCallback(
    async (
      id: string,
      params: { roleKey?: string; isDefault?: boolean; priority?: number; notes?: string }
    ) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.roleKey !== undefined) updates.role_key = params.roleKey;
      if (params.isDefault !== undefined) updates.is_default = params.isDefault;
      if (params.priority !== undefined) updates.priority = params.priority;
      if (params.notes !== undefined) updates.notes = params.notes;

      const { data, error: err } = await supabase
        .from('design_series_product_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) return { error: err.message };
      setLinks((prev) =>
        prev.map((l) => (l.id === id ? (data as DesignSeriesProductLink) : l))
      );
      return { data: data as DesignSeriesProductLink, error: null };
    },
    []
  );

  const removeLink = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('design_series_product_links')
      .delete()
      .eq('id', id);

    if (err) return { error: err.message };
    setLinks((prev) => prev.filter((l) => l.id !== id));
    return { error: null };
  }, []);

  return {
    links,
    loading,
    error,
    refetch: fetchData,
    linkMap,
    addLink,
    updateLink,
    removeLink,
  };
}
