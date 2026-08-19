import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { ELEMENT_CATEGORIES } from '../types/designElements';

export interface CategoryColor {
  id: string;
  org_id: string | null;
  category_slug: string;
  color: string;
}

const DEFAULT_COLORS: Record<string, string> = Object.fromEntries(
  ELEMENT_CATEGORIES.map((c) => [c.id, c.color])
);

export function useCategoryColors() {
  const { organization } = useOrganization();
  const [colors, setColors] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const loadColors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('element_category_colors')
      .select('*')
      .or(`org_id.is.null,org_id.eq.${organization?.id ?? '00000000-0000-0000-0000-000000000000'}`);

    if (!error && data) {
      setColors(data as CategoryColor[]);
    }
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    loadColors();
  }, [loadColors]);

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of ELEMENT_CATEGORIES) {
      const orgColor = colors.find((c) => c.org_id === organization?.id && c.category_slug === cat.id);
      if (orgColor) {
        map[cat.id] = orgColor.color;
      } else {
        const globalColor = colors.find((c) => c.org_id === null && c.category_slug === cat.id);
        map[cat.id] = globalColor?.color ?? DEFAULT_COLORS[cat.id] ?? '#6b7280';
      }
    }
    return map;
  }, [colors, organization?.id, version]);

  const getColor = useCallback((categorySlug: string): string => {
    return colorMap[categorySlug] ?? DEFAULT_COLORS[categorySlug] ?? '#6b7280';
  }, [colorMap]);

  const updateColor = useCallback(async (categorySlug: string, newColor: string) => {
    if (!organization?.id) return;

    setColors((prev) => {
      const existing = prev.find((c) => c.org_id === organization.id && c.category_slug === categorySlug);
      if (existing) {
        return prev.map((c) => (c.id === existing.id ? { ...c, color: newColor } : c));
      } else {
        return [...prev, { id: `temp-${Date.now()}`, org_id: organization.id, category_slug: categorySlug, color: newColor }];
      }
    });
    setVersion((v) => v + 1);

    const existing = colors.find((c) => c.org_id === organization.id && c.category_slug === categorySlug);

    if (existing) {
      await supabase
        .from('element_category_colors')
        .update({ color: newColor, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      const { data } = await supabase
        .from('element_category_colors')
        .insert({ org_id: organization.id, category_slug: categorySlug, color: newColor })
        .select()
        .single();

      if (data) {
        setColors((prev) => prev.map((c) =>
          c.id.startsWith('temp-') && c.category_slug === categorySlug ? (data as CategoryColor) : c
        ));
      }
    }
  }, [colors, organization?.id]);

  const resetToDefault = useCallback(async (categorySlug: string) => {
    if (!organization?.id) return;

    const existing = colors.find((c) => c.org_id === organization.id && c.category_slug === categorySlug);
    if (existing) {
      setColors((prev) => prev.filter((c) => c.id !== existing.id));
      setVersion((v) => v + 1);

      await supabase
        .from('element_category_colors')
        .delete()
        .eq('id', existing.id);
    }
  }, [colors, organization?.id]);

  return {
    colors,
    colorMap,
    loading,
    getColor,
    updateColor,
    resetToDefault,
    reload: loadColors,
  };
}
