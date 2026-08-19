import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import type { FvInputParams, RoofSurface, FvCalculationResult } from '../lib/fvCalculations';

export interface FvSystemConfig {
  inverterId?: string;
  batteryId?: string;
  batteryCount?: number;
  slaveBatteryId?: string;
  slaveBatteryCount?: number;
  wallboxId?: string;
  accessories?: { accessoryId: string; quantity: number }[];
  laborCost?: number;
  totalInvestmentCzk?: number;
  subsidyCzk?: number;
  subsidyProgramId?: string;
  itemDiscounts?: Record<string, number>;
  globalDiscountPct?: number;
  quoteMode?: 'itemized' | 'total';
  customItems?: { id: string; name: string; qty: number; unit: string; unitPrice: number }[];
  laborOverride?: number | null;
  constructionPriceOverride?: number | null;
}

export interface FvDesign {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string;
  input_params: FvInputParams;
  roofs: RoofSurface[];
  system_config: FvSystemConfig;
  pvgis_results: FvCalculationResult | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_PARAMS: FvInputParams = {
  address: '',
  lat: 50.0755,
  lon: 14.4378,
  annualConsumptionKwh: 5000,
  electricityPriceCzkPerKwh: 5.5,
  gridFeedInPriceCzkPerKwh: 2.0,
  heatingSource: 'gas',
  hotWaterSource: 'gas',
  evCount: 0,
  evKmPerYear: 0,
};

export function useFvDesign(projectId: string | null | undefined) {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [design, setDesign] = useState<FvDesign | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef = useRef<FvDesign | null>(null);
  designRef.current = design;

  useEffect(() => {
    if (!projectId || !organizationId) return;
    setLoading(true);
    supabase
      .from('fv_designs')
      .select('*')
      .eq('project_id', projectId)
      .eq('org_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDesign({
            ...data,
            input_params: data.input_params ?? EMPTY_PARAMS,
            roofs: data.roofs ?? [],
            system_config: data.system_config ?? {},
            pvgis_results: data.pvgis_results ?? null,
          } as FvDesign);
        } else {
          setDesign(null);
        }
        setLoading(false);
      });
  }, [projectId, organizationId]);

  const createDesign = useCallback(async () => {
    if (!organizationId) return null;
    const { data, error } = await supabase
      .from('fv_designs')
      .insert({
        org_id: organizationId,
        project_id: projectId ?? null,
        name: 'FV Návrh',
        input_params: EMPTY_PARAMS,
        roofs: [],
        system_config: {},
        pvgis_results: null,
      })
      .select()
      .single();
    if (error || !data) return null;
    const d = { ...data, input_params: EMPTY_PARAMS, roofs: [], system_config: {}, pvgis_results: null } as FvDesign;
    setDesign(d);
    return d;
  }, [organizationId, projectId]);

  const saveDesign = useCallback(async (updates: Partial<Pick<FvDesign, 'input_params' | 'roofs' | 'system_config' | 'pvgis_results' | 'name'>>) => {
    if (!design || !organizationId) return;
    setSaving(true);
    const next = { ...design, ...updates };
    setDesign(next);
    await supabase
      .from('fv_designs')
      .update({
        input_params: next.input_params,
        roofs: next.roofs,
        system_config: next.system_config,
        pvgis_results: next.pvgis_results,
        name: next.name,
      })
      .eq('id', design.id);
    setSaving(false);
  }, [design, organizationId]);

  const autoSave = useCallback((updates: Partial<Pick<FvDesign, 'input_params' | 'roofs' | 'system_config' | 'pvgis_results'>>) => {
    setDesign(prev => prev ? { ...prev, ...updates } : prev);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const cur = designRef.current;
      if (!cur || !organizationId) return;
      const merged = { ...cur, ...updates };
      setSaving(true);
      await supabase
        .from('fv_designs')
        .update({
          input_params: merged.input_params,
          roofs: merged.roofs,
          system_config: merged.system_config,
          pvgis_results: merged.pvgis_results,
          name: merged.name,
        })
        .eq('id', cur.id);
      setSaving(false);
    }, 2000);
  }, [organizationId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const cur = designRef.current;
        if (cur && organizationId) {
          supabase
            .from('fv_designs')
            .update({
              input_params: cur.input_params,
              roofs: cur.roofs,
              system_config: cur.system_config,
              pvgis_results: cur.pvgis_results,
              name: cur.name,
            })
            .eq('id', cur.id);
        }
      }
    };
  }, [organizationId]);

  return { design, loading, saving, createDesign, saveDesign, autoSave };
}
