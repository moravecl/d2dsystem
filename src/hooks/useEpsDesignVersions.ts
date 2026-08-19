import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

export interface EpsDesignVersion {
  id: string;
  eps_design_id: string;
  org_id: string;
  version_number: number;
  note: string;
  summary_detector_count: number;
  summary_total_price: number;
  design_data: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export function useEpsDesignVersions(epsDesignId: string | null | undefined) {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const orgId = organization?.id;
  const [versions, setVersions] = useState<EpsDesignVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!epsDesignId || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('eps_design_versions')
      .select('*')
      .eq('eps_design_id', epsDesignId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as EpsDesignVersion[]);
        setLoading(false);
        setFetched(true);
      });
  }, [epsDesignId, orgId]);

  const createVersion = useCallback(async (params: {
    note: string;
    designData: Record<string, unknown>;
    summaryDetectorCount: number;
    summaryTotalPrice: number;
  }) => {
    if (!epsDesignId || !orgId) return null;
    const nextNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('eps_design_versions')
      .insert({
        eps_design_id: epsDesignId,
        org_id: orgId,
        version_number: nextNumber,
        note: params.note,
        summary_detector_count: params.summaryDetectorCount,
        summary_total_price: params.summaryTotalPrice,
        design_data: params.designData,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;
    setVersions(prev => [data as EpsDesignVersion, ...prev]);
    return data as EpsDesignVersion;
  }, [epsDesignId, orgId, versions, user]);

  const loadVersion = useCallback(async (versionId: string): Promise<EpsDesignVersion | null> => {
    const { data, error } = await supabase
      .from('eps_design_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();
    if (error || !data) return null;
    return data as EpsDesignVersion;
  }, []);

  return { versions, loading, fetched, createVersion, loadVersion };
}
