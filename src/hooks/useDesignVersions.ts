import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface DesignVersion {
  id: string;
  project_id: string;
  version_number: number;
  label: string;
  description: string;
  selection_data: Record<string, unknown>;
  floorplan_data: unknown[];
  created_at: string;
  created_by: string | null;
}

export function useDesignVersions(projectId: string | null | undefined) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('design_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as DesignVersion[]);
        setLoading(false);
        setFetched(true);
      });
  }, [projectId]);

  const createVersion = useCallback(async (params: {
    note: string;
    selectionData: Record<string, unknown>;
    floorplanData: unknown[];
  }) => {
    if (!projectId) return null;
    const nextNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('design_versions')
      .insert({
        project_id: projectId,
        version_number: nextNumber,
        label: params.note,
        description: '',
        selection_data: params.selectionData,
        floorplan_data: params.floorplanData,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;
    setVersions(prev => [data as DesignVersion, ...prev]);
    return data as DesignVersion;
  }, [projectId, versions, user]);

  const loadVersion = useCallback(async (versionId: string): Promise<DesignVersion | null> => {
    const { data, error } = await supabase
      .from('design_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();
    if (error || !data) return null;
    return data as DesignVersion;
  }, []);

  const updateVersion = useCallback(async (versionId: string, params: {
    selectionData: Record<string, unknown>;
    floorplanData: unknown[];
  }) => {
    const { data, error } = await supabase
      .from('design_versions')
      .update({
        selection_data: params.selectionData,
        floorplan_data: params.floorplanData,
      })
      .eq('id', versionId)
      .select()
      .single();
    if (error || !data) return null;
    setVersions(prev => prev.map(v => v.id === versionId ? data as DesignVersion : v));
    return data as DesignVersion;
  }, []);

  return { versions, loading, fetched, createVersion, loadVersion, updateVersion };
}
