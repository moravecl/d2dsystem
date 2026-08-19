import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

export interface FvDesignVersion {
  id: string;
  fv_design_id: string;
  org_id: string;
  version_number: number;
  note: string;
  summary_battery_kwh: number;
  summary_inverter_kw: number;
  summary_panel_kwp: number;
  summary_panel_count: number;
  input_params: Record<string, unknown>;
  roofs: Record<string, unknown>[];
  system_config: Record<string, unknown>;
  pvgis_results: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export function useFvDesignVersions(fvDesignId: string | null | undefined) {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const orgId = organization?.id;
  const [versions, setVersions] = useState<FvDesignVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!fvDesignId || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('fv_design_versions')
      .select('*')
      .eq('fv_design_id', fvDesignId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as FvDesignVersion[]);
        setLoading(false);
        setFetched(true);
      });
  }, [fvDesignId, orgId]);

  const createVersion = useCallback(async (params: {
    note: string;
    inputParams: Record<string, unknown>;
    roofs: Record<string, unknown>[];
    systemConfig: Record<string, unknown>;
    pvgisResults: Record<string, unknown> | null;
    summaryBatteryKwh: number;
    summaryInverterKw: number;
    summaryPanelKwp: number;
    summaryPanelCount: number;
  }) => {
    if (!fvDesignId || !orgId) return null;
    const nextNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('fv_design_versions')
      .insert({
        fv_design_id: fvDesignId,
        org_id: orgId,
        version_number: nextNumber,
        note: params.note,
        summary_battery_kwh: params.summaryBatteryKwh,
        summary_inverter_kw: params.summaryInverterKw,
        summary_panel_kwp: params.summaryPanelKwp,
        summary_panel_count: params.summaryPanelCount,
        input_params: params.inputParams,
        roofs: params.roofs,
        system_config: params.systemConfig,
        pvgis_results: params.pvgisResults,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;
    setVersions(prev => [data as FvDesignVersion, ...prev]);
    return data as FvDesignVersion;
  }, [fvDesignId, orgId, versions, user]);

  const loadVersion = useCallback(async (versionId: string): Promise<FvDesignVersion | null> => {
    const { data, error } = await supabase
      .from('fv_design_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();
    if (error || !data) return null;
    return data as FvDesignVersion;
  }, []);

  return { versions, loading, fetched, createVersion, loadVersion };
}
