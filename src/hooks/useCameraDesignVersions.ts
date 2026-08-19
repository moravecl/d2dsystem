import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

export interface CameraDesignVersion {
  id: string;
  camera_design_id: string;
  org_id: string;
  version_number: number;
  note: string;
  summary_camera_count: number;
  summary_total_price: number;
  design_data: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export function useCameraDesignVersions(cameraDesignId: string | null | undefined) {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const orgId = organization?.id;
  const [versions, setVersions] = useState<CameraDesignVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!cameraDesignId || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('camera_design_versions')
      .select('*')
      .eq('camera_design_id', cameraDesignId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as CameraDesignVersion[]);
        setLoading(false);
        setFetched(true);
      });
  }, [cameraDesignId, orgId]);

  const createVersion = useCallback(async (params: {
    note: string;
    designData: Record<string, unknown>;
    summaryCameraCount: number;
    summaryTotalPrice: number;
  }) => {
    if (!cameraDesignId) {
      console.error('Cannot create version: cameraDesignId is missing');
      return null;
    }
    if (!orgId) {
      console.error('Cannot create version: orgId is missing');
      return null;
    }
    const nextNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
    const insertPayload = {
      camera_design_id: cameraDesignId,
      org_id: orgId,
      version_number: nextNumber,
      note: params.note,
      summary_camera_count: params.summaryCameraCount,
      summary_total_price: params.summaryTotalPrice,
      design_data: params.designData,
      created_by: user?.id ?? null,
    };
    console.log('Creating camera design version:', insertPayload);
    const { data, error } = await supabase
      .from('camera_design_versions')
      .insert(insertPayload)
      .select()
      .single();
    if (error) {
      console.error('Failed to create camera design version:', error.message, error.details, error.hint);
      return null;
    }
    if (!data) return null;
    console.log('Camera design version created:', data);
    setVersions(prev => [data as CameraDesignVersion, ...prev]);
    return data as CameraDesignVersion;
  }, [cameraDesignId, orgId, versions, user]);

  const loadVersion = useCallback(async (versionId: string): Promise<CameraDesignVersion | null> => {
    const { data, error } = await supabase
      .from('camera_design_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CameraDesignVersion;
  }, []);

  return { versions, loading, fetched, createVersion, loadVersion };
}
