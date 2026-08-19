import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  ALL_SIDEBAR_ITEMS,
  DEFAULT_ORDER,
  DEFAULT_GROUPS,
  type SidebarItemDef,
  type SidebarItemSetting,
  type SidebarGroup,
} from '../lib/sidebarConfig';

export interface SidebarGroupWithItems extends SidebarGroup {
  items: (SidebarItemDef & { visible: boolean })[];
}

export function useSidebarSettings() {
  const { organization } = useOrganization();
  const [settings, setSettings] = useState<SidebarItemSetting[]>(DEFAULT_ORDER);
  const [groups, setGroups] = useState<SidebarGroup[]>(DEFAULT_GROUPS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization?.id) {
      setSettings(DEFAULT_ORDER);
      setGroups(DEFAULT_GROUPS);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('sidebar_settings')
      .select('items, groups')
      .eq('organization_id', organization.id)
      .maybeSingle();

    if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
      const saved = data.items as SidebarItemSetting[];
      const knownKeys = new Set(ALL_SIDEBAR_ITEMS.map((i) => i.key));
      const savedKeys = new Set(saved.map((s) => s.key));
      const merged = saved.filter((s) => knownKeys.has(s.key));
      ALL_SIDEBAR_ITEMS.forEach((item) => {
        if (!savedKeys.has(item.key)) {
          const defaultItem = DEFAULT_ORDER.find((d) => d.key === item.key);
          merged.push({ key: item.key, visible: true, groupId: defaultItem?.groupId || null });
        }
      });
      setSettings(merged);
    } else {
      setSettings(DEFAULT_ORDER);
    }

    if (data?.groups && Array.isArray(data.groups) && data.groups.length > 0) {
      setGroups(data.groups as SidebarGroup[]);
    } else {
      setGroups(DEFAULT_GROUPS);
    }

    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (items: SidebarItemSetting[], grps?: SidebarGroup[]) => {
      if (!organization?.id) return;

      const groupsToSave = grps || groups;

      const { data: existing } = await supabase
        .from('sidebar_settings')
        .select('id')
        .eq('organization_id', organization.id)
        .maybeSingle();

      const payload = {
        items: items as unknown as Record<string, unknown>[],
        groups: groupsToSave as unknown as Record<string, unknown>[],
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('sidebar_settings')
          .update(payload)
          .eq('organization_id', organization.id);
      } else {
        await supabase
          .from('sidebar_settings')
          .insert({ organization_id: organization.id, ...payload });
      }

      setSettings(items);
      setGroups(groupsToSave);
    },
    [organization?.id, groups],
  );

  const orderedItems: (SidebarItemDef & { visible: boolean; groupId?: string | null })[] = settings
    .map((s) => {
      const def = ALL_SIDEBAR_ITEMS.find((i) => i.key === s.key);
      if (!def) return null;
      return { ...def, visible: s.visible, groupId: s.groupId };
    })
    .filter(Boolean) as (SidebarItemDef & { visible: boolean; groupId?: string | null })[];

  const groupedItems: SidebarGroupWithItems[] = (() => {
    const ungrouped = orderedItems.filter((i) => !i.groupId);
    const result: SidebarGroupWithItems[] = [];

    if (ungrouped.length > 0) {
      result.push({ id: '', name: '', description: '', items: ungrouped });
    }

    groups.forEach((g) => {
      const gItems = orderedItems.filter((i) => i.groupId === g.id);
      result.push({ ...g, items: gItems });
    });

    return result;
  })();

  return { settings, groups, orderedItems, groupedItems, loading, save, reload: load };
}
