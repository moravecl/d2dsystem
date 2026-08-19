import { useState, useEffect } from 'react';
import { Video, Sun, ShieldAlert, ArrowRight, Layers, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { CameraDesignData, DesignLayer, PlacedCamera } from '../../hooks/useCameraDesign';
import type { EpsDesignData, EpsDesignLayer, PlacedDetector, PlacedMotionSensor } from '../../hooks/useEpsDesign';
import type { RoofSurface } from '../../lib/fvCalculations';
import type { Floor } from '../../hooks/useProjectState';

interface Props {
  projectId: string;
  onNavigate: (tab: string) => void;
}

export function CameraLayerPreview({ layer, cameras, layerIndex }: {
  layer: DesignLayer;
  cameras: PlacedCamera[];
  layerIndex: number;
}) {
  const W = 400;
  const H = layer.canvasAspect
    ? Math.round(W / layer.canvasAspect)
    : layer.canvasWidth && layer.canvasHeight
      ? Math.round(W * (layer.canvasHeight / layer.canvasWidth))
      : 260;
  const clampedH = Math.min(H, 300);

  const layerCams = cameras.filter(c => c.layerIndex === layerIndex);

  return (
    <svg
      viewBox={`0 0 ${W} ${clampedH}`}
      width="100%"
      style={{ display: 'block', background: '#1e293b' }}
    >
      {layer.imageData && (
        <image href={layer.imageData} x="0" y="0" width={W} height={clampedH} preserveAspectRatio="xMidYMid meet" />
      )}
      {layer.type === 'map' && !layer.imageData && (
        <>
          <rect x="0" y="0" width={W} height={clampedH} fill="#1a3a5c" />
          <text x={W / 2} y={clampedH / 2 - 8} textAnchor="middle" fill="#60a5fa" fontSize="13" fontWeight="bold">Satelitní mapa</text>
          {layer.mapCenter && (
            <text x={W / 2} y={clampedH / 2 + 10} textAnchor="middle" fill="#94a3b8" fontSize="10">
              {`${layer.mapCenter.lat.toFixed(4)}, ${layer.mapCenter.lon.toFixed(4)}`}
            </text>
          )}
        </>
      )}
      {layerCams.map(cam => {
        const cx = cam.x * W;
        const cy = cam.y * clampedH;
        const halfFov = (90 / 2) * (Math.PI / 180);
        const rotRad = cam.rotationDeg * (Math.PI / 180);
        const fovR = Math.min(W, clampedH) * 0.14;
        const x1 = cx + Math.cos(rotRad - halfFov) * fovR;
        const y1 = cy + Math.sin(rotRad - halfFov) * fovR;
        const x2 = cx + Math.cos(rotRad + halfFov) * fovR;
        const y2 = cy + Math.sin(rotRad + halfFov) * fovR;
        return (
          <g key={cam.id}>
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${fovR} ${fovR} 0 0 1 ${x2} ${y2} Z`}
              fill="#3b82f6"
              opacity={0.2}
              stroke="#3b82f6"
              strokeWidth={0.5}
              strokeOpacity={0.6}
            />
            <circle cx={cx} cy={cy} r={8} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
          </g>
        );
      })}
      {layerCams.length > 0 && (
        <text x={8} y={clampedH - 8} fill="white" fontSize="10" fontWeight="bold" opacity={0.85}>
          {`${layerCams.length} kamer`}
        </text>
      )}
    </svg>
  );
}

export function FvRoofPreview({ roof }: { roof: RoofSurface }) {
  const pts = roof.points ?? [];
  const panels = roof.placedPanels ?? [];

  const allX = [...pts.map(p => p.x), ...panels.map(p => p.x), ...panels.map(p => p.x + 170)];
  const allY = [...pts.map(p => p.y), ...panels.map(p => p.y), ...panels.map(p => p.y + 100)];

  const hasContent = pts.length >= 3 || panels.length > 0;

  if (!hasContent) {
    return (
      <div className="w-full h-28 bg-navy-900/60 flex flex-col items-center justify-center gap-1">
        <div className="text-xl font-extrabold text-amber-400">{roof.panelCount}</div>
        <div className="text-[10px] text-amber-300 font-semibold">panelů</div>
        <div className="text-[10px] text-slate-500">
          {Math.round((roof.panelCount * roof.panelPowerWp) / 1000 * 10) / 10} kWp
        </div>
      </div>
    );
  }

  const pad = 16;
  const minX = allX.length ? Math.min(...allX) - pad : 0;
  const minY = allY.length ? Math.min(...allY) - pad : 0;
  const maxX = allX.length ? Math.max(...allX) + pad : 400;
  const maxY = allY.length ? Math.max(...allY) + pad : 260;
  const vbW = maxX - minX;
  const vbH = maxY - minY;
  const polyPath = pts.length >= 3 ? `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')} Z` : null;

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      width="100%"
      style={{ display: 'block', background: '#0f1a0a' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {roof.imageUrl && (
        <image href={roof.imageUrl} x={minX} y={minY} width={vbW} height={vbH} preserveAspectRatio="xMidYMid meet" opacity={0.65} />
      )}
      {polyPath && (
        <path d={polyPath} fill="rgba(249,115,22,0.1)" stroke="#f97316" strokeWidth={2} />
      )}
      {panels.map((panel, i) => {
        const pw = panel.rotated ? 100 : 170;
        const ph = panel.rotated ? 170 : 100;
        return (
          <rect key={i} x={panel.x} y={panel.y} width={pw} height={ph}
            fill="rgba(249,115,22,0.55)" stroke="#ea580c" strokeWidth={1} rx={2} />
        );
      })}
    </svg>
  );
}

export function EpsLayerPreview({ layer, detectors, motionSensors, layerIndex }: {
  layer: EpsDesignLayer;
  detectors: PlacedDetector[];
  motionSensors: PlacedMotionSensor[];
  layerIndex: number;
}) {
  const W = 400;
  const H = 260;
  const layerDets = detectors.filter(d => d.layerIndex === layerIndex);
  const layerMotion = motionSensors.filter(m => m.layerIndex === layerIndex);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', background: '#1e293b' }}>
      {layer.imageData && (
        <image href={layer.imageData} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid meet" />
      )}
      {!layer.imageData && <rect x="0" y="0" width={W} height={H} fill="#1a1a2e" />}

      {layerDets.map(det => {
        const cx = det.x * W;
        const cy = det.y * H;
        return (
          <g key={det.id}>
            <circle cx={cx} cy={cy} r={7} fill="#ef4444" stroke="white" strokeWidth={1.5} opacity={0.9} />
            <text x={cx} y={cy + 16} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="bold" opacity={0.8}>
              {det.label || 'D'}
            </text>
          </g>
        );
      })}
      {layerMotion.map(ms => {
        const cx = ms.x * W;
        const cy = ms.y * H;
        const rotRad = (ms.rotationDeg ?? 0) * (Math.PI / 180);
        const halfFov = (90 / 2) * (Math.PI / 180);
        const fovR = Math.min(W, H) * 0.1;
        const x1 = cx + Math.cos(rotRad - halfFov) * fovR;
        const y1 = cy + Math.sin(rotRad - halfFov) * fovR;
        const x2 = cx + Math.cos(rotRad + halfFov) * fovR;
        const y2 = cy + Math.sin(rotRad + halfFov) * fovR;
        return (
          <g key={ms.id}>
            <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${fovR} ${fovR} 0 0 1 ${x2} ${y2} Z`}
              fill="#f59e0b" opacity={0.2} stroke="#f59e0b" strokeWidth={0.5} />
            <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="white" strokeWidth={1.5} opacity={0.9} />
          </g>
        );
      })}
      {(layerDets.length + layerMotion.length) > 0 && (
        <text x={8} y={H - 8} fill="white" fontSize="10" fontWeight="bold" opacity={0.85}>
          {`${layerDets.length + layerMotion.length} čidel`}
        </text>
      )}
    </svg>
  );
}

export function FloorplanLayerPreview({ floor }: { floor: Floor }) {
  if (!floor.floorplanImg) {
    return (
      <div className="w-full h-28 bg-navy-900/60 flex items-center justify-center">
        <span className="text-xs text-slate-500">Bez obrázku</span>
      </div>
    );
  }
  return (
    <div className="relative w-full overflow-hidden bg-navy-900/60" style={{ maxHeight: 240 }}>
      <img
        src={floor.floorplanImg}
        alt={floor.name}
        className="w-full h-full object-contain"
        style={{ maxHeight: 240 }}
      />
    </div>
  );
}

interface DesignCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  onOpen: () => void;
  versionLabel?: string;
  children: React.ReactNode;
}

function DesignCard({ title, subtitle, icon, accentColor, onOpen, versionLabel, children }: DesignCardProps) {
  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentColor}`}>
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">{title}</div>
            <div className="text-[11px] text-slate-500 leading-tight">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {versionLabel && (
            <span className="text-[10px] text-slate-500 bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.06]">
              {versionLabel}
            </span>
          )}
          <button
            onClick={onOpen}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.08]"
          >
            Otevřít
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

interface VersionedData<T> {
  data: T;
  versionLabel: string | null;
}

export default function DesignPreviewSection({ projectId, onNavigate }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [cameraInfo, setCameraInfo] = useState<VersionedData<CameraDesignData> | null>(null);
  const [fvRoofs, setFvRoofs] = useState<VersionedData<RoofSurface[]> | null>(null);
  const [epsInfo, setEpsInfo] = useState<VersionedData<EpsDesignData> | null>(null);
  const [floorplanInfo, setFloorplanInfo] = useState<VersionedData<Floor[]> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId || !orgId) return;

    async function load() {
      const [
        camDesignRes,
        fvDesignRes,
        epsDesignRes,
        designVerRes,
      ] = await Promise.all([
        supabase.from('camera_designs').select('id, design_data').eq('project_id', projectId).eq('org_id', orgId!).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('fv_designs').select('id, roofs').eq('project_id', projectId).eq('org_id', orgId!).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('eps_designs').select('id, design_data').eq('project_id', projectId).eq('org_id', orgId!).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('design_versions').select('floorplan_data, label, version_number').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const [camVerRes, fvVerRes, epsVerRes] = await Promise.all([
        camDesignRes.data?.id
          ? supabase.from('camera_design_versions').select('design_data, note, version_number').eq('camera_design_id', camDesignRes.data.id).eq('org_id', orgId!).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        fvDesignRes.data?.id
          ? supabase.from('fv_design_versions').select('roofs, note, version_number').eq('fv_design_id', fvDesignRes.data.id).eq('org_id', orgId!).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        epsDesignRes.data?.id
          ? supabase.from('eps_design_versions').select('design_data, note, version_number').eq('eps_design_id', epsDesignRes.data.id).eq('org_id', orgId!).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (camVerRes.data?.design_data) {
        const v = camVerRes.data;
        setCameraInfo({ data: v.design_data as CameraDesignData, versionLabel: v.note ? `v${v.version_number} · ${v.note}` : `v${v.version_number}` });
      } else if (camDesignRes.data?.design_data) {
        setCameraInfo({ data: camDesignRes.data.design_data as CameraDesignData, versionLabel: null });
      }

      if (fvVerRes.data?.roofs) {
        const v = fvVerRes.data;
        setFvRoofs({ data: v.roofs as RoofSurface[], versionLabel: v.note ? `v${v.version_number} · ${v.note}` : `v${v.version_number}` });
      } else if (fvDesignRes.data?.roofs) {
        setFvRoofs({ data: fvDesignRes.data.roofs as RoofSurface[], versionLabel: null });
      }

      if (epsVerRes.data?.design_data) {
        const v = epsVerRes.data;
        setEpsInfo({ data: v.design_data as EpsDesignData, versionLabel: v.note ? `v${v.version_number} · ${v.note}` : `v${v.version_number}` });
      } else if (epsDesignRes.data?.design_data) {
        setEpsInfo({ data: epsDesignRes.data.design_data as EpsDesignData, versionLabel: null });
      }

      if (designVerRes.data?.floorplan_data) {
        const v = designVerRes.data;
        const floors = (v.floorplan_data as Floor[]).filter(f => f.floorplanImg);
        if (floors.length > 0) {
          setFloorplanInfo({ data: floors, versionLabel: v.label ? `${v.label}` : `v${v.version_number}` });
        }
      }

      setLoaded(true);
    }

    load();
  }, [projectId, orgId]);

  if (!loaded) return null;

  const camLayers = cameraInfo?.data.layers.filter(l => l.visible !== false) ?? [];
  const fvRoofsWithPanels = (fvRoofs?.data ?? []).filter(r => r.panelCount > 0);
  const epsLayers = epsInfo?.data.layers.filter(l => l.visible !== false) ?? [];
  const floorLayers = floorplanInfo?.data ?? [];

  const hasCamera = camLayers.length > 0;
  const hasFv = fvRoofsWithPanels.length > 0;
  const hasEps = epsLayers.length > 0;
  const hasFloorplan = floorLayers.length > 0;

  if (!hasCamera && !hasFv && !hasEps && !hasFloorplan) return null;

  const totalCameras = cameraInfo?.data.cameras.length ?? 0;
  const totalFvKwp = fvRoofsWithPanels.reduce((s, r) => s + r.panelCount * r.panelPowerWp / 1000, 0);
  const totalEpsSensors = (epsInfo?.data.detectors.length ?? 0) + (epsInfo?.data.motionSensors.length ?? 0);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <Zap className="w-3.5 h-3.5" />
        Grafické návrhy
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {hasFloorplan && (
          <DesignCard
            title="Návrhář"
            subtitle={`${floorLayers.length} patro${floorLayers.length > 1 ? 'a' : ''}`}
            icon={<Layers className="w-4 h-4 text-slate-300" />}
            accentColor="bg-slate-500/15"
            onOpen={() => onNavigate('design')}
            versionLabel={floorplanInfo?.versionLabel ?? undefined}
          >
            <div className="overflow-hidden">
              {floorLayers.slice(0, 2).map((floor, i) => (
                <div key={floor.id} className={i > 0 ? 'border-t border-white/[0.06]' : ''}>
                  {floorLayers.length > 1 && (
                    <div className="px-3 py-1.5 bg-white/[0.03] flex items-center gap-1.5">
                      <div className="w-1 h-3.5 rounded-sm bg-slate-400 opacity-60" />
                      <span className="text-[11px] text-slate-400 font-medium truncate">{floor.name}</span>
                    </div>
                  )}
                  <FloorplanLayerPreview floor={floor} />
                </div>
              ))}
              {floorLayers.length > 2 && (
                <div className="px-3 py-2 text-center text-xs text-slate-500 border-t border-white/[0.06]">
                  + {floorLayers.length - 2} dalších pater
                </div>
              )}
            </div>
          </DesignCard>
        )}

        {hasCamera && (
          <DesignCard
            title="Kamerový systém"
            subtitle={`${totalCameras} kamer · ${camLayers.length} vrstev`}
            icon={<Video className="w-4 h-4 text-blue-400" />}
            accentColor="bg-blue-500/15"
            onOpen={() => onNavigate('design')}
            versionLabel={cameraInfo?.versionLabel ?? undefined}
          >
            <div className="overflow-hidden">
              {camLayers.slice(0, 2).map((layer, i) => {
                const realIdx = cameraInfo!.data.layers.indexOf(layer);
                return (
                  <div key={layer.id} className={i > 0 ? 'border-t border-white/[0.06]' : ''}>
                    {camLayers.length > 1 && (
                      <div className="px-3 py-1.5 bg-white/[0.03] flex items-center gap-1.5">
                        <div className="w-1 h-3.5 rounded-sm bg-blue-500 opacity-70" />
                        <span className="text-[11px] text-slate-400 font-medium truncate">{layer.name || `Vrstva ${i + 1}`}</span>
                      </div>
                    )}
                    <CameraLayerPreview layer={layer} cameras={cameraInfo!.data.cameras} layerIndex={realIdx} />
                  </div>
                );
              })}
              {camLayers.length > 2 && (
                <div className="px-3 py-2 text-center text-xs text-slate-500 border-t border-white/[0.06]">
                  + {camLayers.length - 2} dalších vrstev
                </div>
              )}
            </div>
          </DesignCard>
        )}

        {hasFv && (
          <DesignCard
            title="Fotovoltaika"
            subtitle={`${Math.round(totalFvKwp * 10) / 10} kWp · ${fvRoofsWithPanels.length} střech`}
            icon={<Sun className="w-4 h-4 text-amber-400" />}
            accentColor="bg-amber-500/15"
            onOpen={() => onNavigate('design')}
            versionLabel={fvRoofs?.versionLabel ?? undefined}
          >
            <div className="overflow-hidden">
              {fvRoofsWithPanels.slice(0, 2).map((roof, i) => (
                <div key={roof.id} className={i > 0 ? 'border-t border-white/[0.06]' : ''}>
                  {fvRoofsWithPanels.length > 1 && (
                    <div className="px-3 py-1.5 bg-white/[0.03] flex items-center gap-1.5">
                      <div className="w-1 h-3.5 rounded-sm bg-amber-500 opacity-70" />
                      <span className="text-[11px] text-slate-400 font-medium truncate">
                        {roof.name} · {roof.panelCount} panelů
                      </span>
                    </div>
                  )}
                  <FvRoofPreview roof={roof} />
                </div>
              ))}
              {fvRoofsWithPanels.length > 2 && (
                <div className="px-3 py-2 text-center text-xs text-slate-500 border-t border-white/[0.06]">
                  + {fvRoofsWithPanels.length - 2} dalších střech
                </div>
              )}
            </div>
          </DesignCard>
        )}

        {hasEps && (
          <DesignCard
            title="Alarm / EZS"
            subtitle={`${totalEpsSensors} čidel · ${epsLayers.length} vrstev`}
            icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
            accentColor="bg-red-500/15"
            onOpen={() => onNavigate('design')}
            versionLabel={epsInfo?.versionLabel ?? undefined}
          >
            <div className="overflow-hidden">
              {epsLayers.slice(0, 2).map((layer, i) => {
                const realIdx = epsInfo!.data.layers.indexOf(layer);
                return (
                  <div key={layer.id} className={i > 0 ? 'border-t border-white/[0.06]' : ''}>
                    {epsLayers.length > 1 && (
                      <div className="px-3 py-1.5 bg-white/[0.03] flex items-center gap-1.5">
                        <div className="w-1 h-3.5 rounded-sm bg-red-500 opacity-70" />
                        <span className="text-[11px] text-slate-400 font-medium truncate">{layer.name || `Vrstva ${i + 1}`}</span>
                      </div>
                    )}
                    <EpsLayerPreview layer={layer} detectors={epsInfo!.data.detectors} motionSensors={epsInfo!.data.motionSensors} layerIndex={realIdx} />
                  </div>
                );
              })}
              {epsLayers.length > 2 && (
                <div className="px-3 py-2 text-center text-xs text-slate-500 border-t border-white/[0.06]">
                  + {epsLayers.length - 2} dalších vrstev
                </div>
              )}
            </div>
          </DesignCard>
        )}
      </div>
    </div>
  );
}
