import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ProjectDesignElement } from '../types/designElements';

export function useProjectDesignElements(projectId: string | undefined) {
  const [elements, setElements] = useState<ProjectDesignElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchElements = useCallback(async () => {
    if (!projectId) {
      setElements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('project_design_elements')
      .select('*, element_type:design_element_types(*)')
      .eq('project_id', projectId)
      .order('floor_id')
      .order('sort_order');

    if (err) {
      setError(err.message);
      setElements([]);
    } else {
      setElements((data as ProjectDesignElement[]) || []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  const addElement = useCallback(
    async (
      element: Omit<ProjectDesignElement, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'element_type'>
    ) => {
      if (!projectId) return { error: 'No project ID' };
      const { data, error: err } = await supabase
        .from('project_design_elements')
        .insert({ ...element, project_id: projectId })
        .select('*, element_type:design_element_types(*)')
        .single();

      if (err) return { error: err.message };
      setElements((prev) => [...prev, data as ProjectDesignElement]);
      return { data: data as ProjectDesignElement, error: null };
    },
    [projectId]
  );

  const updateElement = useCallback(
    async (
      elementId: string,
      updates: Partial<Omit<ProjectDesignElement, 'id' | 'project_id' | 'org_id' | 'created_at' | 'element_type'>>
    ) => {
      const { data, error: err } = await supabase
        .from('project_design_elements')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', elementId)
        .select('*, element_type:design_element_types(*)')
        .single();

      if (err) return { error: err.message };
      setElements((prev) =>
        prev.map((e) => (e.id === elementId ? (data as ProjectDesignElement) : e))
      );
      return { data: data as ProjectDesignElement, error: null };
    },
    []
  );

  const removeElement = useCallback(async (elementId: string) => {
    const { error: err } = await supabase
      .from('project_design_elements')
      .delete()
      .eq('id', elementId);

    if (err) return { error: err.message };
    setElements((prev) => prev.filter((e) => e.id !== elementId));
    return { error: null };
  }, []);

  const getElementsByFloor = useCallback(
    (floorId: string) => elements.filter((e) => e.floor_id === floorId),
    [elements]
  );

  const getElementsByRoom = useCallback(
    (roomId: string) => elements.filter((e) => e.room_id === roomId),
    [elements]
  );

  const getElementsByType = useCallback(
    (typeId: string) => elements.filter((e) => e.element_type_id === typeId),
    [elements]
  );

  return {
    elements,
    loading,
    error,
    refetch: fetchElements,
    addElement,
    updateElement,
    removeElement,
    getElementsByFloor,
    getElementsByRoom,
    getElementsByType,
    setElements,
  };
}
