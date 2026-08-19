import { useState, useEffect } from 'react';
import { Camera, HardDrive, Network, Cable, Package } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useOrganization } from '../../../contexts/OrganizationContext';
import type { CameraDesignData, DesignLayer } from '../../../hooks/useCameraDesign';
import type { CameraModel, CameraNvr, CameraCable, CameraPoeSwitch, CameraAccessory, CameraCatalogData } from '../../../hooks/useCameraCatalog';
import { calculateStorage, calcTotalPoePowerW } from '../../../lib/cameraCalculations';

const CAMERA_TYPE_LABELS: Record<string, string> = {
  dome: 'Dome', bullet: 'Bullet', ptz: 'PTZ', fisheye: 'Fisheye', box: 'Box',
};

const CAMERA_TYPE_COLORS: Record<string, string> = {
  dome: '#3b82f6', bullet: '#10b981', ptz: '#f59e0b', fisheye: '#ec4899', box: '#8b5cf6',
};

function stringToColor(str: string): string {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function CameraDesignPreview({ designData, catalog }: { designData: CameraDesignData; catalog: CameraCatalogData }) {
  const W = 600;
  const H = 420;
  const toAbs = (nx: number, ny: number) => ({ x: nx * W, y: ny * H });

  const mapLayer = designData.layers.find(l => l.type === 'map' && l.mapCenter) as DesignLayer | undefined;
  const imageLayer = designData.layers.find(l => l.type === 'image' && l.imageData);

  let mapTiles: JSX.Element[] = [];
  if (mapLayer?.type === 'map' && mapLayer.mapCenter && mapLayer.mapZoom) {
    const zoom = mapLayer.mapZoom;
    const lonToTileX = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
    const latToTileY = (lat: number, z: number) => {
      const rad = (lat * Math.PI) / 180;
      return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
    };
    const centerX = lonToTileX(mapLayer.mapCenter.lon, zoom);
    const centerY = latToTileY(mapLayer.mapCenter.lat, zoom);
    const tileSize = 256;
    const tilesW = Math.ceil(W / tileSize) + 1;
    const tilesH = Math.ceil(H / tileSize) + 1;
    const startTX = Math.floor(centerX - tilesW / 2);
    const startTY = Math.floor(centerY - tilesH / 2);
    const maxT = Math.pow(2, zoom);

    for (let tx = startTX; tx <= startTX + tilesW; tx++) {
      for (let ty = startTY; ty <= startTY + tilesH; ty++) {
        if (ty < 0 || ty >= maxT) continue;
        const wrappedTx = ((tx % maxT) + maxT) % maxT;
        const px = (tx - centerX) * tileSize + W / 2;
        const py = (ty - centerY) * tileSize + H / 2;
        mapTiles.push(
          <image
            key={`${tx}-${ty}`}
            href={`https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${zoom}/${ty}/${wrappedTx}`}
            x={Math.round(px)}
            y={Math.round(py)}
            width={tileSize}
            height={tileSize}
          />
        );
      }
    }
  }

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-slate-900 print:rounded-none">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block" style={{ borderRadius: '8px' }}>
        {mapTiles}
        {imageLayer?.imageData && !mapLayer && (
          <image href={imageLayer.imageData} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid meet" />
        )}

        {designData.routes.map(route => {
          if (route.points.length < 2) return null;
          const pts = route.points.map(p => toAbs(p.x, p.y));
          const color = route.label ? stringToColor(route.label) : '#f59e0b';
          return (
            <g key={route.id}>
              <polyline
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray="8 4"
                opacity="0.9"
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
              ))}
              {route.label && pts.length >= 2 && (
                <text
                  x={(pts[0].x + pts[Math.floor(pts.length / 2)].x) / 2}
                  y={(pts[0].y + pts[Math.floor(pts.length / 2)].y) / 2 - 8}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="bold"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                >{route.label}</text>
              )}
            </g>
          );
        })}

        {designData.cameras.map(cam => {
          const model = catalog.cameras.find(m => m.id === cam.modelId);
          if (!model) return null;
          const abs = toAbs(cam.x, cam.y);
          const color = CAMERA_TYPE_COLORS[model.camera_type] ?? '#3b82f6';
          const halfFov = (model.h_fov_deg / 2) * (Math.PI / 180);
          const rotRad = cam.rotationDeg * (Math.PI / 180);
          const fovR = Math.min(model.ir_range_m * 2, 80);

          const fovPath = `M ${abs.x} ${abs.y}
            L ${abs.x + Math.cos(rotRad - halfFov) * fovR} ${abs.y + Math.sin(rotRad - halfFov) * fovR}
            A ${fovR} ${fovR} 0 ${model.h_fov_deg > 180 ? 1 : 0} 1 ${abs.x + Math.cos(rotRad + halfFov) * fovR} ${abs.y + Math.sin(rotRad + halfFov) * fovR}
            Z`;

          return (
            <g key={cam.id}>
              <path d={fovPath} fill={color} opacity="0.15" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
              <circle cx={abs.x} cy={abs.y} r="10" fill={color} stroke="white" strokeWidth="2" />
              <text
                x={abs.x}
                y={abs.y - 16}
                textAnchor="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >{cam.label || model.name}</text>
            </g>
          );
        })}

        {designData.nvrs.map(nvr => {
          const abs = toAbs(nvr.x, nvr.y);
          return (
            <g key={nvr.id}>
              <rect x={abs.x - 16} y={abs.y - 12} width="32" height="24" rx="4" fill="#1e293b" stroke="#60a5fa" strokeWidth="2" />
              <text x={abs.x} y={abs.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">NVR</text>
            </g>
          );
        })}

        {designData.switches.map(sw => {
          const abs = toAbs(sw.x, sw.y);
          return (
            <g key={sw.id}>
              <rect x={abs.x - 14} y={abs.y - 10} width="28" height="20" rx="3" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
              <text x={abs.x} y={abs.y + 3} textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="bold">SW</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface Props {
  projectId: string | null;
}

export default function SummaryCameraPrint({ projectId }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [designData, setDesignData] = useState<CameraDesignData | null>(null);
  const [cameras, setCameras] = useState<CameraModel[]>([]);
  const [nvrs, setNvrs] = useState<CameraNvr[]>([]);
  const [cables, setCables] = useState<CameraCable[]>([]);
  const [poeSwitches, setPoeSwitches] = useState<CameraPoeSwitch[]>([]);
  const [cameraAccessories, setCameraAccessories] = useState<CameraAccessory[]>([]);

  useEffect(() => {
    if (!projectId || !orgId) return;

    supabase
      .from('camera_designs')
      .select('id, design_data')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        let dd = data.design_data as CameraDesignData;
        const { data: ver } = await supabase
          .from('camera_design_versions')
          .select('design_data')
          .eq('camera_design_id', data.id)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ver?.design_data) dd = ver.design_data as CameraDesignData;
        if (dd) {
          setDesignData({
            layers: dd.layers ?? [],
            cameras: dd.cameras ?? [],
            routes: dd.routes ?? [],
            nvrs: dd.nvrs ?? [],
            switches: dd.switches ?? [],
            storageConfig: dd.storageConfig ?? { codec: 'h265', recordingHoursPerDay: 24, retentionDays: 14, motionOnlyPct: 50 },
            accessoryItems: dd.accessoryItems ?? [],
          });
        }
      });

    supabase.from('camera_models').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setCameras((data ?? []) as CameraModel[]));
    supabase.from('camera_nvrs').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setNvrs((data ?? []) as CameraNvr[]));
    supabase.from('camera_cables').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setCables((data ?? []) as CameraCable[]));
    supabase.from('camera_poe_switches').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setPoeSwitches((data ?? []) as CameraPoeSwitch[]));
    supabase.from('camera_accessories').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setCameraAccessories((data ?? []) as CameraAccessory[]));
  }, [projectId, orgId]);

  if (!designData || designData.cameras.length === 0) return null;

  const catalog: CameraCatalogData = {
    cameras, nvrs, cables, poeSwitches, accessories: cameraAccessories, loading: false, reload: () => {},
  };

  const storage = calculateStorage(designData.cameras, cameras, designData.storageConfig);
  const totalPoe = calcTotalPoePowerW(designData.cameras, cameras);

  const camGroups = new Map<string, { model: CameraModel; count: number }>();
  designData.cameras.forEach(cam => {
    const model = cameras.find(m => m.id === cam.modelId);
    if (!model) return;
    const existing = camGroups.get(model.id);
    if (existing) existing.count++;
    else camGroups.set(model.id, { model, count: 1 });
  });

  return (
    <div className="page-break-before mt-10 print:mt-0">
      <div className="flex items-center gap-2 mb-4 border-b-2 border-blue-400 pb-2 print:mb-2">
        <Camera className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-extrabold text-white">Kamerovy system</h2>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5 print:gap-2 print:mb-3">
        <div className="bg-blue-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-blue-400">Kamery</div>
          <div className="text-xl font-extrabold text-blue-400 print:text-base">{designData.cameras.length}</div>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">PoE prikon</div>
          <div className="text-xl font-extrabold text-emerald-400 print:text-base">{Math.round(totalPoe)} W</div>
        </div>
        <div className="bg-amber-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">Uloziste</div>
          <div className="text-xl font-extrabold text-amber-400 print:text-base">{storage.totalStorageTb} TB</div>
          <div className="text-[10px] text-amber-500">{storage.recommendedHddCount}x{storage.recommendedHddSizeTb} TB HDD</div>
        </div>
        <div className="bg-white/[0.04] rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Retence</div>
          <div className="text-xl font-extrabold text-slate-300 print:text-base">{designData.storageConfig.retentionDays} dni</div>
          <div className="text-[10px] text-slate-400">{designData.storageConfig.codec.toUpperCase()}</div>
        </div>
      </div>

      <div className="mb-5 print:mb-3">
        <h3 className="text-sm font-extrabold text-slate-300 mb-2">Nahled rozmisteni</h3>
        <CameraDesignPreview designData={designData} catalog={catalog} />
      </div>

      <div className="mb-5 print:mb-3">
        <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-blue-500" /> Seznam kamer
        </h3>
        <table className="w-full text-xs border border-white/10 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-white/[0.06]">
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">Oznaceni</th>
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">Model</th>
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">Typ</th>
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">Rozliseni</th>
              <th className="px-3 py-2 text-right font-extrabold text-slate-400">FOV</th>
              <th className="px-3 py-2 text-right font-extrabold text-slate-400">IR</th>
            </tr>
          </thead>
          <tbody>
            {designData.cameras.map(cam => {
              const model = cameras.find(m => m.id === cam.modelId);
              if (!model) return null;
              return (
                <tr key={cam.id} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2 font-extrabold text-white">{cam.label}</td>
                  <td className="px-3 py-2 text-slate-400">{model.name}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: CAMERA_TYPE_COLORS[model.camera_type] ?? '#3b82f6' }} />
                      {CAMERA_TYPE_LABELS[model.camera_type] ?? model.camera_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{model.resolution_label}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{model.h_fov_deg}&deg;</td>
                  <td className="px-3 py-2 text-right text-slate-400">{model.ir_range_m} m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 print:gap-2">
        {designData.nvrs.length > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <HardDrive className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">NVR zaznamniky</h3>
            </div>
            {designData.nvrs.map(nvr => {
              const model = nvrs.find(n => n.id === nvr.nvrId);
              if (!model) return null;
              return (
                <div key={nvr.id} className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2 last:mb-0">
                  <div className="text-slate-500">Model:</div>
                  <div className="font-extrabold text-slate-300">{model.name}</div>
                  <div className="text-slate-500">Vyrobce:</div>
                  <div className="font-extrabold text-slate-300">{model.manufacturer}</div>
                  <div className="text-slate-500">Kanaly / PoE:</div>
                  <div className="font-extrabold text-slate-300">{model.channels} / {model.poe_ports} portu</div>
                  <div className="text-slate-500">HDD sloty:</div>
                  <div className="font-extrabold text-slate-300">{model.hdd_bays} (max {model.max_hdd_tb} TB)</div>
                </div>
              );
            })}
          </div>
        )}

        {designData.switches.length > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Network className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">PoE switche</h3>
            </div>
            {designData.switches.map(sw => {
              const model = poeSwitches.find(s => s.id === sw.switchId);
              if (!model) return null;
              return (
                <div key={sw.id} className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2 last:mb-0">
                  <div className="text-slate-500">Model:</div>
                  <div className="font-extrabold text-slate-300">{model.name}</div>
                  <div className="text-slate-500">PoE porty:</div>
                  <div className="font-extrabold text-slate-300">{model.poe_ports}</div>
                  <div className="text-slate-500">PoE budget:</div>
                  <div className="font-extrabold text-slate-300">{model.poe_budget_w} W</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <HardDrive className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Uloziste</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="text-slate-500">Kodek:</div>
            <div className="font-extrabold text-slate-300">{designData.storageConfig.codec.toUpperCase()}</div>
            <div className="text-slate-500">Nahravani:</div>
            <div className="font-extrabold text-slate-300">{designData.storageConfig.recordingHoursPerDay}h / den</div>
            <div className="text-slate-500">Retence:</div>
            <div className="font-extrabold text-slate-300">{designData.storageConfig.retentionDays} dni</div>
            <div className="text-slate-500">Detekce pohybu:</div>
            <div className="font-extrabold text-slate-300">{designData.storageConfig.motionOnlyPct}%</div>
            <div className="text-slate-500">Denni objem:</div>
            <div className="font-extrabold text-slate-300">{storage.dailyStorageGb} GB</div>
            <div className="text-slate-500">Celkovy objem:</div>
            <div className="font-extrabold text-slate-300">{storage.totalStorageTb} TB</div>
            <div className="text-slate-500">Doporuceny HDD:</div>
            <div className="font-extrabold text-blue-400">{storage.recommendedHddCount}x {storage.recommendedHddSizeTb} TB</div>
          </div>
        </div>

        {designData.accessoryItems.length > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Prislusenstvi</h3>
            </div>
            <div className="space-y-1">
              {designData.accessoryItems.map(ai => {
                const acc = cameraAccessories.find(a => a.id === ai.accessoryId);
                if (!acc || ai.quantity === 0) return null;
                return (
                  <div key={ai.accessoryId} className="flex justify-between text-xs">
                    <span className="text-slate-400">{acc.name}</span>
                    <span className="font-extrabold text-slate-300">{ai.quantity}x</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
