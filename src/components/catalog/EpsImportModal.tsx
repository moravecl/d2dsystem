import { useState, useEffect, useMemo } from 'react';
import { Shield, Loader2, ChevronRight, Calendar, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { QuoteSection, QuoteItem, QuoteAttachment, QuoteSystemSummary } from './quoteHelpers';
import type {
  EpsDetectorModel, EpsPanel, EpsSiren, EpsCable,
  EpsAccessory, EpsMotionSensor, EpsKeypad, EpsControlDevice,
} from '../../hooks/useEpsCatalog';
import type { EpsDesignData } from '../../hooks/useEpsDesign';
import Modal from '../ui/Modal';

interface EpsVersionRow {
  id: string;
  eps_design_id: string;
  version_number: number;
  note: string;
  summary_detector_count: number;
  summary_total_price: number;
  design_data: Record<string, unknown>;
  created_at: string;
}

interface EpsDesignRow {
  id: string;
  name: string;
  design_data: Record<string, unknown>;
  updated_at: string;
}

export interface EpsImportResult {
  section: QuoteSection;
  designId: string;
  versionId?: string;
  attachments: QuoteAttachment[];
  summary: QuoteSystemSummary;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  onImport: (section: QuoteSection, meta?: EpsImportResult) => void;
}

interface CatalogState {
  detectors: EpsDetectorModel[];
  panels: EpsPanel[];
  sirens: EpsSiren[];
  cables: EpsCable[];
  accessories: EpsAccessory[];
  motionSensors: EpsMotionSensor[];
  keypads: EpsKeypad[];
  controlDevices: EpsControlDevice[];
}

const EMPTY_CATALOG: CatalogState = {
  detectors: [], panels: [], sirens: [], cables: [],
  accessories: [], motionSensors: [], keypads: [], controlDevices: [],
};

function buildEpsSection(
  designData: Record<string, unknown>,
  cat: CatalogState,
): QuoteSection {
  const items: QuoteItem[] = [];
  const dd = designData as unknown as EpsDesignData;

  const detectorCounts: Record<string, number> = {};
  for (const det of dd.detectors ?? []) {
    detectorCounts[det.modelId] = (detectorCounts[det.modelId] || 0) + 1;
  }
  for (const [modelId, count] of Object.entries(detectorCounts)) {
    const model = cat.detectors.find(d => d.id === modelId);
    if (model) {
      items.push({
        id: crypto.randomUUID(),
        code: model.model_number || '',
        name: `${model.manufacturer} ${model.name}`,
        unit: 'ks',
        quantity: count,
        sellingPrice: model.price,
        costPrice: model.purchase_price || model.price * 0.7,
      });
    }
  }

  const panelCounts: Record<string, number> = {};
  for (const p of dd.panels ?? []) {
    panelCounts[p.panelId] = (panelCounts[p.panelId] || 0) + 1;
  }
  for (const [panelId, count] of Object.entries(panelCounts)) {
    const panel = cat.panels.find(p => p.id === panelId);
    if (panel) {
      items.push({
        id: crypto.randomUUID(),
        code: panel.model_number || '',
        name: `Ustredna ${panel.manufacturer} ${panel.name} (${panel.max_zones} zon)`,
        unit: 'ks',
        quantity: count,
        sellingPrice: panel.price,
        costPrice: panel.purchase_price || panel.price * 0.7,
      });
    }
  }

  const sirenCounts: Record<string, number> = {};
  for (const s of dd.sirens ?? []) {
    sirenCounts[s.sirenId] = (sirenCounts[s.sirenId] || 0) + 1;
  }
  for (const [sirenId, count] of Object.entries(sirenCounts)) {
    const siren = cat.sirens.find(s => s.id === sirenId);
    if (siren) {
      items.push({
        id: crypto.randomUUID(),
        code: siren.model_number || '',
        name: `Sirena ${siren.manufacturer} ${siren.name} (${siren.sound_level_db} dB)`,
        unit: 'ks',
        quantity: count,
        sellingPrice: siren.price,
        costPrice: siren.purchase_price || siren.price * 0.7,
      });
    }
  }

  const sensorCounts: Record<string, number> = {};
  for (const ms of dd.motionSensors ?? []) {
    sensorCounts[ms.sensorId] = (sensorCounts[ms.sensorId] || 0) + 1;
  }
  for (const [sensorId, count] of Object.entries(sensorCounts)) {
    const sensor = cat.motionSensors.find(s => s.id === sensorId);
    if (sensor) {
      items.push({
        id: crypto.randomUUID(),
        code: sensor.model_number || '',
        name: `${sensor.manufacturer} ${sensor.name} (${sensor.detection_range_m}m)`,
        unit: 'ks',
        quantity: count,
        sellingPrice: sensor.price,
        costPrice: sensor.purchase_price || sensor.price * 0.7,
      });
    }
  }

  const keypadCounts: Record<string, number> = {};
  for (const k of dd.keypads ?? []) {
    keypadCounts[k.keypadId] = (keypadCounts[k.keypadId] || 0) + 1;
  }
  for (const [keypadId, count] of Object.entries(keypadCounts)) {
    const keypad = cat.keypads.find(k => k.id === keypadId);
    if (keypad) {
      items.push({
        id: crypto.randomUUID(),
        code: keypad.model_number || '',
        name: `Klavesnice ${keypad.manufacturer} ${keypad.name}`,
        unit: 'ks',
        quantity: count,
        sellingPrice: keypad.price,
        costPrice: keypad.purchase_price || keypad.price * 0.7,
      });
    }
  }

  const deviceCounts: Record<string, number> = {};
  for (const cd of dd.controlDevices ?? []) {
    deviceCounts[cd.deviceId] = (deviceCounts[cd.deviceId] || 0) + 1;
  }
  for (const [deviceId, count] of Object.entries(deviceCounts)) {
    const device = cat.controlDevices.find(d => d.id === deviceId);
    if (device) {
      items.push({
        id: crypto.randomUUID(),
        code: device.model_number || '',
        name: `${device.manufacturer} ${device.name}`,
        unit: 'ks',
        quantity: count,
        sellingPrice: device.price,
        costPrice: device.purchase_price || device.price * 0.7,
      });
    }
  }

  const cableLengths: Record<string, number> = {};
  for (const route of dd.routes ?? []) {
    if (route.points.length < 2) continue;
    let len = 0;
    for (let i = 1; i < route.points.length; i++) {
      const dx = route.points[i].x - route.points[i - 1].x;
      const dy = route.points[i].y - route.points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    cableLengths[route.cableTypeId] = (cableLengths[route.cableTypeId] || 0) + len;
  }
  for (const [cableId, normalizedLen] of Object.entries(cableLengths)) {
    const cable = cat.cables.find(c => c.id === cableId);
    if (cable && normalizedLen > 0) {
      const lengthM = Math.ceil(normalizedLen * 100);
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `Kabel ${cable.name}`,
        unit: 'm',
        quantity: lengthM,
        sellingPrice: cable.price_per_m,
        costPrice: cable.purchase_price_per_m || cable.price_per_m * 0.7,
      });
    }
  }

  for (const ai of dd.accessoryItems ?? []) {
    const acc = cat.accessories.find(a => a.id === ai.accessoryId);
    if (!acc || ai.quantity <= 0) continue;
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: acc.name,
      unit: 'ks',
      quantity: ai.quantity,
      sellingPrice: acc.price,
      costPrice: acc.purchase_price || acc.price * 0.7,
    });
  }

  return {
    id: crypto.randomUUID(),
    name: 'EPS / EZS - Zabezpecovaci system',
    trade: 'eps',
    icon: 'shield',
    items,
  };
}

function buildEpsSummary(
  designData: Record<string, unknown>,
): QuoteSystemSummary {
  const dd = designData as unknown as EpsDesignData;
  const detectorCount = (dd.detectors ?? []).length;
  const panelCount = (dd.panels ?? []).length;
  const sirenCount = (dd.sirens ?? []).length;
  const motionSensorCount = (dd.motionSensors ?? []).length;
  const keypadCount = (dd.keypads ?? []).length;
  const controlDeviceCount = (dd.controlDevices ?? []).length;

  let totalCableM = 0;
  for (const route of dd.routes ?? []) {
    if (route.points.length < 2) continue;
    let len = 0;
    for (let i = 1; i < route.points.length; i++) {
      const dx = route.points[i].x - route.points[i - 1].x;
      const dy = route.points[i].y - route.points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    totalCableM += Math.ceil(len * 100);
  }

  const data: Record<string, string | number> = {
    'Detektory': detectorCount,
    'Ustredny': panelCount,
  };
  if (sirenCount > 0) data['Sireny'] = sirenCount;
  if (motionSensorCount > 0) data['Pohybova cidla'] = motionSensorCount;
  if (keypadCount > 0) data['Klavesnice'] = keypadCount;
  if (controlDeviceCount > 0) data['Ovladaci prvky'] = controlDeviceCount;
  if (totalCableM > 0) data['Kabelaz'] = `${totalCableM} m`;

  return { type: 'eps', data };
}

function buildEpsAttachments(
  designData: Record<string, unknown>,
): QuoteAttachment[] {
  const attachments: QuoteAttachment[] = [];
  const dd = designData as any;
  const layers = dd.layers ?? [];
  for (const layer of layers) {
    if (layer.imageData) {
      attachments.push({
        id: crypto.randomUUID(),
        type: 'custom',
        label: `EPS/EZS - ${layer.name || 'pudorys'}`,
        imageData: layer.imageData,
      });
      break;
    }
  }
  return attachments;
}

export default function EpsImportModal({ open, onClose, projectId, onImport }: Props) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [design, setDesign] = useState<EpsDesignRow | null>(null);
  const [versions, setVersions] = useState<EpsVersionRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG);

  useEffect(() => {
    if (!open || !organization?.id) return;
    setLoading(true);

    const orgId = organization.id;

    const loadDesign = projectId
      ? supabase.from('eps_designs').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as EpsDesignRow[] });

    Promise.all([
      loadDesign,
      supabase.from('eps_detector_models').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_panels').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_sirens').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_cables').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_accessories').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_motion_sensors').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_keypads').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('eps_control_devices').select('*').eq('org_id', orgId).eq('is_active', true),
    ]).then(async ([designRes, detRes, panRes, sirRes, cabRes, accRes, motRes, keyRes, ctrlRes]) => {
      setCatalog({
        detectors: (detRes.data ?? []) as EpsDetectorModel[],
        panels: (panRes.data ?? []) as EpsPanel[],
        sirens: (sirRes.data ?? []) as EpsSiren[],
        cables: (cabRes.data ?? []) as EpsCable[],
        accessories: (accRes.data ?? []) as EpsAccessory[],
        motionSensors: (motRes.data ?? []) as EpsMotionSensor[],
        keypads: (keyRes.data ?? []) as EpsKeypad[],
        controlDevices: (ctrlRes.data ?? []) as EpsControlDevice[],
      });

      const d = (designRes.data ?? [])[0] as EpsDesignRow | undefined;
      if (d) {
        setDesign(d);
        const { data: vers } = await supabase
          .from('eps_design_versions')
          .select('*')
          .eq('eps_design_id', d.id)
          .order('created_at', { ascending: false });
        setVersions((vers ?? []) as EpsVersionRow[]);
      } else {
        setDesign(null);
        setVersions([]);
      }
      setLoading(false);
    });
  }, [open, projectId, organization?.id]);

  const handleImportCurrent = () => {
    if (!design) return;
    const section = buildEpsSection(design.design_data, catalog);
    const summary = buildEpsSummary(design.design_data);
    const attachments = buildEpsAttachments(design.design_data);
    onImport(section, {
      section,
      designId: design.id,
      attachments,
      summary,
    });
    onClose();
  };

  const handleImportVersion = (version: EpsVersionRow) => {
    const section = buildEpsSection(version.design_data, catalog);
    const summary = buildEpsSummary(version.design_data);
    const attachments = buildEpsAttachments(version.design_data);
    onImport(section, {
      section,
      designId: design?.id || '',
      versionId: version.id,
      attachments,
      summary,
    });
    onClose();
  };

  const currentDeviceCount = useMemo(() => {
    if (!design?.design_data) return 0;
    const dd = design.design_data as unknown as EpsDesignData;
    return (dd.detectors ?? []).length
      + (dd.panels ?? []).length
      + (dd.sirens ?? []).length
      + (dd.motionSensors ?? []).length
      + (dd.keypads ?? []).length
      + (dd.controlDevices ?? []).length;
  }, [design]);

  return (
    <Modal open={open} onClose={onClose} title="Importovat EPS/EZS do nabídky" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
        </div>
      ) : !design ? (
        <div className="text-center py-10">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-extrabold text-slate-300">Žádný EPS/EZS návrh</div>
          <div className="text-xs text-slate-400 mt-1">
            Tento projekt nemá žádný návrh zabezpečovacího systému. Nejprve jej vytvořte v záložce EPS.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={handleImportCurrent}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 hover:border-rose-400 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-white">
                Aktuální konfigurace
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {currentDeviceCount} zařízení
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition shrink-0" />
          </button>

          {versions.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">
                Uložené verze ({versions.length})
              </div>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {versions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleImportVersion(v)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.06] hover:border-rose-300 hover:bg-rose-50/30 transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-xs font-extrabold text-slate-400">
                      v{v.version_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">
                        {v.note || `Verze ${v.version_number}`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5" /> {v.summary_detector_count} detektoru
                        </span>
                        {v.summary_total_price > 0 && (
                          <span className="flex items-center gap-1">
                            {v.summary_total_price.toLocaleString('cs-CZ')} Kc
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> {new Date(v.created_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-500 transition shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
