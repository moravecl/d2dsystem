import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface PlacedCamera {
  id: string;
  modelId: string;
  x: number;
  y: number;
  rotationDeg: number;
  label: string;
  layerIndex: number;
}

export interface CableRoute {
  id: string;
  points: { x: number; y: number }[];
  cableTypeId: string;
  layerIndex: number;
  label: string;
}

export interface PlacedNvr {
  id: string;
  nvrId: string;
  x: number;
  y: number;
  layerIndex: number;
}

export interface PlacedSwitch {
  id: string;
  switchId: string;
  x: number;
  y: number;
  layerIndex: number;
}

export type FloorScale = { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };

export interface DesignLayer {
  id: string;
  name: string;
  type: 'map' | 'image';
  imageData?: string;
  mapCenter?: { lat: number; lon: number };
  mapZoom?: number;
  visible: boolean;
  locked?: boolean;
  scale?: FloorScale;
  canvasAspect?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface StorageConfig {
  codec: 'h264' | 'h265' | 'h265+';
  recordingHoursPerDay: number;
  retentionDays: number;
  motionOnlyPct: number;
}

export interface CameraCustomItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

export interface CameraQuoteConfig {
  itemDiscounts?: Record<string, number>;
  globalDiscountPct?: number;
  laborCost?: number;
  laborOverride?: number | null;
  customItems?: CameraCustomItem[];
  quoteMode?: 'itemized' | 'total';
  vatRate?: number;
}

export interface CameraDesignData {
  layers: DesignLayer[];
  cameras: PlacedCamera[];
  routes: CableRoute[];
  nvrs: PlacedNvr[];
  switches: PlacedSwitch[];
  scale?: { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };
  storageConfig: StorageConfig;
  accessoryItems: { accessoryId: string; quantity: number }[];
  quoteConfig?: CameraQuoteConfig;
}

export interface CameraDesign {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string;
  design_data: CameraDesignData;
  created_at: string;
  updated_at: string;
}

const EMPTY_DESIGN_DATA: CameraDesignData = {
  layers: [],
  cameras: [],
  routes: [],
  nvrs: [],
  switches: [],
  storageConfig: {
    codec: 'h265',
    recordingHoursPerDay: 24,
    retentionDays: 14,
    motionOnlyPct: 50,
  },
  accessoryItems: [],
};

export function useCameraDesign(projectId: string | null | undefined) {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [design, setDesign] = useState<CameraDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetched, setFetched] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef = useRef<CameraDesign | null>(null);

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
      .from('camera_designs')
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
          } as CameraDesign;
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
        .from('camera_designs')
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
      const { error } = await supabase
        .from('camera_designs')
        .update({ design_data: cur.design_data, name: cur.name, updated_at: new Date().toISOString() })
        .eq('id', cur.id)
        .eq('org_id', organizationId);
      if (error) console.error('Camera save failed:', error);
      setSaving(false);
    }, 1200);
  }, [organizationId]);

  const createDesign = useCallback(async () => {
    if (!organizationId) return null;
    const { data, error } = await supabase
      .from('camera_designs')
      .insert({
        org_id: organizationId,
        project_id: projectId ?? null,
        name: 'Kamerovy system',
        design_data: EMPTY_DESIGN_DATA,
      })
      .select()
      .single();
    if (error || !data) return null;
    const d = { ...data, design_data: EMPTY_DESIGN_DATA } as CameraDesign;
    setDesign(d);
    designRef.current = d;
    return d;
  }, [organizationId, projectId]);

  const saveDesign = useCallback(async (updates?: Partial<Pick<CameraDesign, 'design_data' | 'name'>>) => {
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
    const { error } = await supabase
      .from('camera_designs')
      .update({ design_data: next.design_data, name: next.name, updated_at: new Date().toISOString() })
      .eq('id', cur.id)
      .eq('org_id', organizationId);
    if (error) console.error('Camera save failed:', error);
    setSaving(false);
  }, [organizationId]);

  const updateDesignData = useCallback((updater: (prev: CameraDesignData) => CameraDesignData) => {
    const cur = designRef.current;
    if (!cur) return;
    const nextData = updater(cur.design_data);
    const next = { ...cur, design_data: nextData };
    setDesign(next);
    designRef.current = next;
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    const onBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flushSave]);

  const getDesignData = useCallback(() => designRef.current?.design_data ?? null, []);

  return { design, loading, saving, fetched, createDesign, saveDesign, updateDesignData, getDesignData };
}
