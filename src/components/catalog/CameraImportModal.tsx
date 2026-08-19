import { useState, useEffect, useMemo } from 'react';
import { Camera, Loader2, ChevronRight, Calendar, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { QuoteSection, QuoteItem, QuoteAttachment, QuoteSystemSummary } from './quoteHelpers';
import type {
  CameraModel, CameraNvr, CameraCable, CameraPoeSwitch, CameraAccessory,
} from '../../hooks/useCameraCatalog';
import type { CameraDesignData } from '../../hooks/useCameraDesign';
import Modal from '../ui/Modal';

interface CameraVersionRow {
  id: string;
  camera_design_id: string;
  version_number: number;
  note: string;
  summary_camera_count: number;
  summary_total_price: number;
  design_data: Record<string, unknown>;
  created_at: string;
}

interface CameraDesignRow {
  id: string;
  name: string;
  design_data: Record<string, unknown>;
  updated_at: string;
}

export interface CameraImportResult {
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
  onImport: (section: QuoteSection, meta?: CameraImportResult) => void;
}

interface CatalogState {
  cameras: CameraModel[];
  nvrs: CameraNvr[];
  cables: CameraCable[];
  poeSwitches: CameraPoeSwitch[];
  accessories: CameraAccessory[];
}

const EMPTY_CATALOG: CatalogState = {
  cameras: [], nvrs: [], cables: [], poeSwitches: [], accessories: [],
};

function buildCameraSection(
  designData: Record<string, unknown>,
  cat: CatalogState,
): QuoteSection {
  const items: QuoteItem[] = [];
  const dd = designData as unknown as CameraDesignData;

  const cameraCounts: Record<string, number> = {};
  for (const cam of dd.cameras ?? []) {
    cameraCounts[cam.modelId] = (cameraCounts[cam.modelId] || 0) + 1;
  }

  for (const [modelId, count] of Object.entries(cameraCounts)) {
    const model = cat.cameras.find(c => c.id === modelId);
    if (model) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `${model.manufacturer} ${model.name} (${model.resolution_label}, ${model.camera_type})`,
        unit: 'ks',
        quantity: count,
        sellingPrice: model.price,
        costPrice: model.price * 0.75,
      });
    }
  }

  const nvrCounts: Record<string, number> = {};
  for (const nvr of dd.nvrs ?? []) {
    nvrCounts[nvr.nvrId] = (nvrCounts[nvr.nvrId] || 0) + 1;
  }
  for (const [nvrId, count] of Object.entries(nvrCounts)) {
    const nvr = cat.nvrs.find(n => n.id === nvrId);
    if (nvr) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `NVR ${nvr.manufacturer} ${nvr.name} (${nvr.channels}ch)`,
        unit: 'ks',
        quantity: count,
        sellingPrice: nvr.price,
        costPrice: nvr.price * 0.75,
      });
    }
  }

  const switchCounts: Record<string, number> = {};
  for (const sw of dd.switches ?? []) {
    switchCounts[sw.switchId] = (switchCounts[sw.switchId] || 0) + 1;
  }
  for (const [switchId, count] of Object.entries(switchCounts)) {
    const sw = cat.poeSwitches.find(s => s.id === switchId);
    if (sw) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `PoE Switch ${sw.manufacturer} ${sw.name} (${sw.poe_ports}p)`,
        unit: 'ks',
        quantity: count,
        sellingPrice: sw.price,
        costPrice: sw.price * 0.75,
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
        costPrice: cable.price_per_m * 0.75,
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
      costPrice: acc.price * 0.75,
    });
  }

  return {
    id: crypto.randomUUID(),
    name: 'Kamerový systém',
    trade: 'camera',
    icon: 'camera',
    items,
  };
}

function buildCameraSummary(
  designData: Record<string, unknown>,
  cat: CatalogState,
): QuoteSystemSummary {
  const dd = designData as unknown as CameraDesignData;
  const cameraCount = (dd.cameras ?? []).length;

  let totalStorage = 0;
  for (const nvr of dd.nvrs ?? []) {
    const nvrModel = cat.nvrs.find(n => n.id === nvr.nvrId);
    if (nvrModel) totalStorage += (nvrModel as any).storage_tb ?? 0;
  }

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

  const nvrCount = (dd.nvrs ?? []).length;
  const switchCount = (dd.switches ?? []).length;

  const data: Record<string, string | number> = {
    'Počet kamer': cameraCount,
    'NVR záznamníky': nvrCount,
  };
  if (switchCount > 0) data['PoE switche'] = switchCount;
  if (totalStorage > 0) data['Úložiště'] = `${totalStorage} TB`;
  if (totalCableM > 0) data['Kabeláž'] = `${totalCableM} m`;

  return { type: 'camera', data };
}

function buildCameraAttachments(
  designData: Record<string, unknown>,
): QuoteAttachment[] {
  const attachments: QuoteAttachment[] = [];
  const dd = designData as any;
  const mapUrl = dd.mapImageUrl || dd.mapImageData || dd.backgroundImage || null;
  if (mapUrl) {
    attachments.push({
      id: crypto.randomUUID(),
      type: 'camera_layout',
      label: 'Kamerový systém - layout',
      imageData: mapUrl,
    });
  }
  return attachments;
}

export default function CameraImportModal({ open, onClose, projectId, onImport }: Props) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [design, setDesign] = useState<CameraDesignRow | null>(null);
  const [versions, setVersions] = useState<CameraVersionRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG);

  useEffect(() => {
    if (!open || !organization?.id) return;
    setLoading(true);

    const orgId = organization.id;

    const loadDesign = projectId
      ? supabase.from('camera_designs').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as CameraDesignRow[] });

    Promise.all([
      loadDesign,
      supabase.from('camera_models').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('camera_nvrs').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('camera_cables').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('camera_poe_switches').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('camera_accessories').select('*').eq('org_id', orgId).eq('is_active', true),
    ]).then(async ([designRes, camRes, nvrRes, cableRes, swRes, accRes]) => {
      setCatalog({
        cameras: (camRes.data ?? []) as CameraModel[],
        nvrs: (nvrRes.data ?? []) as CameraNvr[],
        cables: (cableRes.data ?? []) as CameraCable[],
        poeSwitches: (swRes.data ?? []) as CameraPoeSwitch[],
        accessories: (accRes.data ?? []) as CameraAccessory[],
      });

      const d = (designRes.data ?? [])[0] as CameraDesignRow | undefined;
      if (d) {
        setDesign(d);
        const { data: vers } = await supabase
          .from('camera_design_versions')
          .select('*')
          .eq('camera_design_id', d.id)
          .order('created_at', { ascending: false });
        setVersions((vers ?? []) as CameraVersionRow[]);
      } else {
        setDesign(null);
        setVersions([]);
      }
      setLoading(false);
    });
  }, [open, projectId, organization?.id]);

  const handleImportCurrent = () => {
    if (!design) return;
    const section = buildCameraSection(design.design_data, catalog);
    const summary = buildCameraSummary(design.design_data, catalog);
    const attachments = buildCameraAttachments(design.design_data);
    onImport(section, {
      section,
      designId: design.id,
      attachments,
      summary,
    });
    onClose();
  };

  const handleImportVersion = (version: CameraVersionRow) => {
    const section = buildCameraSection(version.design_data, catalog);
    const summary = buildCameraSummary(version.design_data, catalog);
    const attachments = buildCameraAttachments(version.design_data);
    onImport(section, {
      section,
      designId: design?.id || '',
      versionId: version.id,
      attachments,
      summary,
    });
    onClose();
  };

  const currentCameraCount = useMemo(() => {
    if (!design?.design_data) return 0;
    const dd = design.design_data as unknown as CameraDesignData;
    return (dd.cameras ?? []).length;
  }, [design]);

  return (
    <Modal open={open} onClose={onClose} title="Importovat kamery do nabídky" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : !design ? (
        <div className="text-center py-10">
          <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-extrabold text-slate-300">Žádný kamerový návrh</div>
          <div className="text-xs text-slate-400 mt-1">
            Tento projekt nemá žádný kamerový návrh. Nejprve jej vytvořte v záložce Kamery.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={handleImportCurrent}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 hover:border-sky-400 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-white">
                Aktuální konfigurace
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {currentCameraCount} kamer
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-sky-500 transition shrink-0" />
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.06] hover:border-sky-300 hover:bg-sky-50/30 transition-all text-left group"
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
                          <Layers className="w-2.5 h-2.5" /> {v.summary_camera_count} kamer
                        </span>
                        {v.summary_total_price > 0 && (
                          <span className="flex items-center gap-1">
                            {v.summary_total_price.toLocaleString('cs-CZ')} Kč
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> {new Date(v.created_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition shrink-0" />
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
