import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { MountingGroup, MountingGroupSlot, MountingOrientation } from '../types/designElements';

export interface MountingGroupWithSlots extends MountingGroup {
  slots: MountingGroupSlot[];
}

export function useMountingGroups(projectId: string | undefined) {
  const [groups, setGroups] = useState<MountingGroup[]>([]);
  const [slots, setSlots] = useState<MountingGroupSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setGroups([]);
      setSlots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: groupsData, error: groupsErr } = await supabase
      .from('mounting_groups')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');

    if (groupsErr) {
      setError(groupsErr.message);
      setLoading(false);
      return;
    }

    const loadedGroups = (groupsData as MountingGroup[]) || [];
    setGroups(loadedGroups);

    if (loadedGroups.length > 0) {
      const groupIds = loadedGroups.map((g) => g.id);
      const { data: slotsData, error: slotsErr } = await supabase
        .from('mounting_group_slots')
        .select('*')
        .in('mounting_group_id', groupIds)
        .order('slot_index');

      if (slotsErr) {
        setError(slotsErr.message);
      } else {
        setSlots((slotsData as MountingGroupSlot[]) || []);
      }
    } else {
      setSlots([]);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupsWithSlots: MountingGroupWithSlots[] = useMemo(() => {
    return groups.map((g) => ({
      ...g,
      slots: slots.filter((s) => s.mounting_group_id === g.id).sort((a, b) => a.slot_index - b.slot_index),
    }));
  }, [groups, slots]);

  const getGroupsByRoom = useCallback(
    (roomId: string | null): MountingGroupWithSlots[] => {
      return groupsWithSlots.filter((g) => g.room_id === roomId);
    },
    [groupsWithSlots]
  );

  const getGroupsByFloor = useCallback(
    (floorId: string): MountingGroupWithSlots[] => {
      return groupsWithSlots.filter((g) => g.floor_id === floorId);
    },
    [groupsWithSlots]
  );

  const createGroup = useCallback(
    async (params: {
      floorId?: string;
      roomId?: string;
      x: number;
      y: number;
      rotation?: number;
      frameSize: number;
      orientation?: MountingOrientation;
      designSeriesId?: string;
      colorName?: string;
      modules?: string[];
      label?: string;
      notes?: string;
      elementIds?: string[];
    }) => {
      if (!projectId) return { error: 'No project ID' };

      const { data, error: err } = await supabase
        .from('mounting_groups')
        .insert({
          project_id: projectId,
          floor_id: params.floorId ?? null,
          room_id: params.roomId ?? null,
          x: params.x,
          y: params.y,
          rotation: params.rotation ?? 0,
          frame_size: params.frameSize,
          orientation: params.orientation ?? 'horizontal',
          design_series_id: params.designSeriesId ?? null,
          color_name: params.colorName ?? null,
          modules: params.modules ?? [],
          label: params.label ?? null,
          notes: params.notes ?? null,
        })
        .select()
        .single();

      if (err) return { error: err.message };

      const newGroup = data as MountingGroup;
      setGroups((prev) => [...prev, newGroup]);

      const initialSlots: MountingGroupSlot[] = [];
      for (let i = 0; i < params.frameSize; i++) {
        const { data: slotData } = await supabase
          .from('mounting_group_slots')
          .insert({
            mounting_group_id: newGroup.id,
            slot_index: i,
            element_id: params.elementIds?.[i] ?? null,
            module_name: params.modules?.[i] ?? null,
          })
          .select()
          .single();

        if (slotData) {
          initialSlots.push(slotData as MountingGroupSlot);
        }
      }
      setSlots((prev) => [...prev, ...initialSlots]);

      return { data: newGroup, error: null };
    },
    [projectId]
  );

  const createGroupFromElements = useCallback(
    async (params: {
      elementIds: string[];
      floorId?: string;
      roomId?: string;
      x: number;
      y: number;
      orientation?: MountingOrientation;
      designSeriesId?: string;
      colorName?: string;
      label?: string;
    }) => {
      const frameSize = params.elementIds.length;
      if (frameSize < 2) return { error: 'Need at least 2 elements for a mounting group' };

      return createGroup({
        floorId: params.floorId,
        roomId: params.roomId,
        x: params.x,
        y: params.y,
        frameSize,
        orientation: params.orientation ?? 'horizontal',
        designSeriesId: params.designSeriesId,
        colorName: params.colorName,
        label: params.label,
        elementIds: params.elementIds,
      });
    },
    [createGroup]
  );

  const getGroupForElement = useCallback(
    (elementId: string): MountingGroupWithSlots | null => {
      for (const group of groupsWithSlots) {
        const slot = group.slots.find((s) => s.element_id === elementId);
        if (slot) return group;
      }
      return null;
    },
    [groupsWithSlots]
  );

  const getSlotForElement = useCallback(
    (elementId: string): { group: MountingGroupWithSlots; slot: MountingGroupSlot } | null => {
      for (const group of groupsWithSlots) {
        const slot = group.slots.find((s) => s.element_id === elementId);
        if (slot) return { group, slot };
      }
      return null;
    },
    [groupsWithSlots]
  );

  const updateGroup = useCallback(
    async (
      id: string,
      params: {
        x?: number;
        y?: number;
        rotation?: number;
        frameSize?: number;
        orientation?: MountingOrientation;
        designSeriesId?: string | null;
        colorName?: string | null;
        modules?: string[];
        label?: string | null;
        notes?: string | null;
      }
    ) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.x !== undefined) updates.x = params.x;
      if (params.y !== undefined) updates.y = params.y;
      if (params.rotation !== undefined) updates.rotation = params.rotation;
      if (params.frameSize !== undefined) updates.frame_size = params.frameSize;
      if (params.orientation !== undefined) updates.orientation = params.orientation;
      if (params.designSeriesId !== undefined) updates.design_series_id = params.designSeriesId;
      if (params.colorName !== undefined) updates.color_name = params.colorName;
      if (params.modules !== undefined) updates.modules = params.modules;
      if (params.label !== undefined) updates.label = params.label;
      if (params.notes !== undefined) updates.notes = params.notes;

      const { data, error: err } = await supabase
        .from('mounting_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) return { error: err.message };
      setGroups((prev) => prev.map((g) => (g.id === id ? (data as MountingGroup) : g)));
      return { data: data as MountingGroup, error: null };
    },
    []
  );

  const deleteGroup = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('mounting_groups').delete().eq('id', id);

    if (err) return { error: err.message };
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setSlots((prev) => prev.filter((s) => s.mounting_group_id !== id));
    return { error: null };
  }, []);

  const disbandGroup = useCallback(
    async (groupId: string) => {
      return deleteGroup(groupId);
    },
    [deleteGroup]
  );

  const updateSlot = useCallback(
    async (
      slotId: string,
      params: {
        elementId?: string | null;
        moduleName?: string | null;
        productId?: string | null;
      }
    ) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.elementId !== undefined) updates.element_id = params.elementId;
      if (params.moduleName !== undefined) updates.module_name = params.moduleName;
      if (params.productId !== undefined) updates.product_id = params.productId;

      const { data, error: err } = await supabase
        .from('mounting_group_slots')
        .update(updates)
        .eq('id', slotId)
        .select()
        .single();

      if (err) return { error: err.message };
      setSlots((prev) => prev.map((s) => (s.id === slotId ? (data as MountingGroupSlot) : s)));
      return { data: data as MountingGroupSlot, error: null };
    },
    []
  );

  const assignElementToSlot = useCallback(
    async (groupId: string, slotIndex: number, elementId: string) => {
      const slot = slots.find((s) => s.mounting_group_id === groupId && s.slot_index === slotIndex);
      if (!slot) return { error: 'Slot not found' };
      return updateSlot(slot.id, { elementId });
    },
    [slots, updateSlot]
  );

  const removeElementFromSlot = useCallback(
    async (groupId: string, slotIndex: number) => {
      const slot = slots.find((s) => s.mounting_group_id === groupId && s.slot_index === slotIndex);
      if (!slot) return { error: 'Slot not found' };
      return updateSlot(slot.id, { elementId: null });
    },
    [slots, updateSlot]
  );

  return {
    groups,
    slots,
    groupsWithSlots,
    loading,
    error,
    refetch: fetchData,
    getGroupsByRoom,
    getGroupsByFloor,
    getGroupForElement,
    getSlotForElement,
    createGroup,
    createGroupFromElements,
    updateGroup,
    deleteGroup,
    disbandGroup,
    updateSlot,
    assignElementToSlot,
    removeElementFromSlot,
  };
}
