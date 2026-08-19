import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface CatalogCategory {
  id: string;
  org_id: string;
  catalog_system: string;
  category_group: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryGroupDef {
  group: string;
  label: string;
  defaults: [string, string][];
}

export function useCatalogCategories(catalogSystem: string, groups: CategoryGroupDef[]) {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    supabase
      .from('catalog_categories')
      .select('*')
      .eq('org_id', organizationId)
      .eq('catalog_system', catalogSystem)
      .order('sort_order')
      .then(({ data }) => {
        setCategories((data ?? []) as CatalogCategory[]);
        setLoading(false);
      });
  }, [organizationId, catalogSystem, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);

  const getOptions = useCallback((group: string): [string, string][] => {
    const custom = categories.filter(c => c.category_group === group && c.is_active);
    if (custom.length > 0) {
      return custom.map(c => [c.key, c.label]);
    }
    const def = groups.find(g => g.group === group);
    return def?.defaults ?? [];
  }, [categories, groups]);

  const getLabel = useCallback((group: string, key: string): string => {
    const custom = categories.find(c => c.category_group === group && c.key === key && c.is_active);
    if (custom) return custom.label;
    const def = groups.find(g => g.group === group);
    const match = def?.defaults.find(([k]) => k === key);
    return match?.[1] ?? key;
  }, [categories, groups]);

  const getCategoriesForGroup = useCallback((group: string): CatalogCategory[] => {
    return categories.filter(c => c.category_group === group);
  }, [categories]);

  const hasCustomCategories = useCallback((group: string): boolean => {
    return categories.some(c => c.category_group === group && c.is_active);
  }, [categories]);

  const seedDefaults = useCallback(async (group: string) => {
    if (!organizationId) return;
    const def = groups.find(g => g.group === group);
    if (!def) return;
    const rows = def.defaults.map(([key, label], i) => ({
      org_id: organizationId,
      catalog_system: catalogSystem,
      category_group: group,
      key,
      label,
      sort_order: i,
      is_active: true,
    }));
    await supabase.from('catalog_categories').upsert(rows, { onConflict: 'org_id,catalog_system,category_group,key' });
    reload();
  }, [organizationId, catalogSystem, groups, reload]);

  const addCategory = useCallback(async (group: string, key: string, label: string) => {
    if (!organizationId) return;
    const maxSort = categories
      .filter(c => c.category_group === group)
      .reduce((max, c) => Math.max(max, c.sort_order), -1);
    await supabase.from('catalog_categories').insert({
      org_id: organizationId,
      catalog_system: catalogSystem,
      category_group: group,
      key,
      label,
      sort_order: maxSort + 1,
      is_active: true,
    });
    reload();
  }, [organizationId, catalogSystem, categories, reload]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Pick<CatalogCategory, 'key' | 'label' | 'sort_order' | 'is_active'>>) => {
    await supabase.from('catalog_categories').update(updates).eq('id', id);
    reload();
  }, [reload]);

  const deleteCategory = useCallback(async (id: string) => {
    await supabase.from('catalog_categories').delete().eq('id', id);
    reload();
  }, [reload]);

  return {
    categories,
    loading,
    reload,
    getOptions,
    getLabel,
    getCategoriesForGroup,
    hasCustomCategories,
    seedDefaults,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
