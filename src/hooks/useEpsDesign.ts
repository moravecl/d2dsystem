import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface PlacedDetector {
  id: string;
  modelId: string;
  x: number;
  y: number;
  rotationDeg: number;
  label: string;
  layerIndex: number;
}

export interface PlacedPanel {
  id: string;
  panelId: string;
  x: number;
  y: number;
  layerIndex: number;
}

export interface PlacedSiren {
  id: string;
  sirenId: string;
  x: number;
  y: number;
  layerIndex: number;
}

export interface EpsCableRoute {
  id: string;
  points: { x: number; y: number }[];
  cableTypeId: string;
  layerIndex: number;
  label: string;
}

export interface PlacedMotionSensor {
  id: string;
  sensorId: string;
  x: number;
  y: number;
  rotationDeg: number;
  label: string;
  layerIndex: number;
}

export interface PlacedKeypad {
  id: string;
  keypadId: string;
  x: number;
  y: number;
  layerIndex: number;
}

export interface PlacedControlDevice {
  id: string;
  deviceId: string;
  x: number;
  y: number;
  layerIndex: number;
}

export interface EpsZone {
  id: string;
  name: string;
  detectorIds: string[];
  color: string;
}

export type EpsFloorScale = { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };

export interface EpsDesignLayer {
  id: string;
  name: string;
  type: 'image';
  imageData?: string;
  visible: boolean;
  locked?: boolean;
  scale?: EpsFloorScale;
}

export interface EpsQuoteConfig {
  itemDiscounts?: Record<string, number>;
  priceOverrides?: Record<string, number>;
  costOverrides?: Record<string, number>;
  globalDiscountPct?: number;
  vatPct?: number;
  laborCost?: number;
  laborSellPrice?: number;
  laborCostPrice?: number;
  laborDescription?: string;
  laborOverride?: number | null;
  customItems?: { id: string; name: string; qty: number; unit: string; unitPrice: number; costPrice?: number }[];
  quoteMode?: 'itemized' | 'total';
}

export interface EpsDesignData {
  layers: EpsDesignLayer[];
  detectors: PlacedDetector[];
  panels: PlacedPanel[];
  sirens: PlacedSiren[];
  motionSensors: PlacedMotionSensor[];
  keypads: PlacedKeypad[];
  controlDevices: PlacedControlDevice[];
  routes: EpsCableRoute[];
  scale?: EpsFloorScale;
  accessoryItems: { accessoryId: string; quantity: number }[];
  zones: EpsZone[];
  quoteConfig?: EpsQuoteConfig;
}

export interface EpsDesign {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string;
  design_data: EpsDesignData;
  created_at: string;
  updated_at: string;
}

const EMPTY_DESIGN_DATA: EpsDesignData = {
  layers: [],
  detectors: [],
  panels: [],
  sirens: [],
  motionSensors: [],
  keypads: [],
  controlDevices: [],
  routes: [],
  accessoryItems: [],
  zones: [],
};

export function useEpsDesign(projectId: string | null | undefined) {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [design, setDesign] = useState<EpsDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetched, setFetched] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef = useRef<EpsDesign | null>(null);

  useEffect(() => {
    designRef.current = design;
  }, [design]);

  useEffect(() => {
    if (!projectId || !organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetched(false);
    supabase
      .from('eps_designs')
      .select('*')
      .eq('project_id', projectId)
      .eq('org_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = {
            ...data,
            design_data: { ...EMPTY_DESIGN_DATA, ...(data.design_data as object) },
          } as EpsDesign;
          setDesign(d);
          designRef.current = d;
        } else {
          setDesign(null);
          designRef.current = null;
        }
        setLoading(false);
        setFetched(true);
      });
  }, [projectId, organizationId]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const cur = designRef.current;
    if (cur && organizationId) {
      supabase
        .from('eps_designs')
        .update({ design_data: cur.design_data, name: cur.name, updated_at: new Date().toISOString() })
        .eq('id', cur.id)
        .eq('org_id', organizationId)
        .then(() => {});
    }
  }, [organizationId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      const cur = designRef.current;
      if (!cur || !organizationId) return;
      setSaving(true);
      await supabase
        .from('eps_designs')
        .update({ design_data: cur.design_data, name: cur.name, updated_at: new Date().toISOString() })
        .eq('id', cur.id)
        .eq('org_id', organizationId);
      setSaving(false);
    }, 1200);
  }, [organizationId]);

  const createDesign = useCallback(async () => {
    if (!organizationId) return null;
    const { data, error } = await supabase
      .from('eps_designs')
      .insert({
        org_id: organizationId,
        project_id: projectId ?? null,
        name: 'EPS navrh',
        design_data: EMPTY_DESIGN_DATA,
      })
      .select()
      .single();
    if (error || !data) return null;
    const d = { ...data, design_data: EMPTY_DESIGN_DATA } as EpsDesign;
    setDesign(d);
    designRef.current = d;
    return d;
  }, [organizationId, projectId]);

  const saveDesign = useCallback(async (updates?: Partial<Pick<EpsDesign, 'design_data' | 'name'>>) => {
    const cur = designRef.current;
    if (!cur || !organizationId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const next = updates ? { ...cur, ...updates } : cur;
    setDesign(next);
    designRef.current = next;
    setSaving(true);
    await supabase
      .from('eps_designs')
      .update({ design_data: next.design_data, name: next.name, updated_at: new Date().toISOString() })
      .eq('id', cur.id)
      .eq('org_id', organizationId);
    setSaving(false);
  }, [organizationId]);

  const updateDesignData = useCallback((updater: (prev: EpsDesignData) => EpsDesignData) => {
    const cur = designRef.current;
    if (!cur) return;
    const nextData = updater(cur.design_data);
    const next = { ...cur, design_data: nextData };
    setDesign(next);
    designRef.current = next;
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    return () => { flushSave(); };
  }, [flushSave]);

  useEffect(() => {
    const onBeforeUnload = () => { flushSave(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flushSave]);

  const getDesignData = useCallback(() => designRef.current?.design_data ?? null, []);

  return { design, loading, saving, fetched, createDesign, saveDesign, updateDesignData, getDesignData };
}
