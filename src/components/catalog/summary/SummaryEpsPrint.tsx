import { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, Siren, Eye, Keyboard, Settings, Layers } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useOrganization } from '../../../contexts/OrganizationContext';
import type { EpsDesignData, EpsDesignLayer } from '../../../hooks/useEpsDesign';
import type { EpsCatalogData, EpsDetectorModel, EpsPanel as EpsPanelModel, EpsSiren, EpsAccessory, EpsMotionSensor, EpsKeypad, EpsControlDevice } from '../../../hooks/useEpsCatalog';

const DETECTOR_TYPE_COLORS: Record<string, string> = {
  smoke: '#3b82f6', heat: '#ef4444', smoke_heat: '#10b981',
  linear: '#8b5cf6', manual_call_point: '#f59e0b', gas: '#ec4899',
  co: '#06b6d4', flame: '#f97316',
};

const DETECTOR_TYPE_LABELS: Record<string, string> = {
  smoke: 'Detektor kouře', heat: 'Tepelný detektor', smoke_heat: 'Kombinovaný',
  linear: 'Lineární', manual_call_point: 'Tlačítkový hlásič', gas: 'Plynový',
  co: 'CO detektor', flame: 'Plamenový',
};

const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function EpsLayerPreview({ layer, layerIndex, designData, catalog }: {
  layer: EpsDesignLayer; layerIndex: number; designData: EpsDesignData; catalog: EpsCatalogData;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 600;
    const H = 420;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const draw = (bgImg?: HTMLImageElement) => {
      const cw = W;
      let ch = H;
      if (bgImg) {
        const ar = bgImg.naturalWidth / bgImg.naturalHeight;
        ch = Math.round(cw / ar);
        canvas.width = cw;
        canvas.height = ch;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalAlpha = 0.88;
        ctx.drawImage(bgImg, 0, 0, cw, ch);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cw, ch);
      }

      const detectors = designData.detectors.filter(d => d.layerIndex === layerIndex);
      const panels = designData.panels.filter(p => p.layerIndex === layerIndex);
      const sirens = designData.sirens.filter(s => s.layerIndex === layerIndex);
      const motionSensors = (designData.motionSensors ?? []).filter(ms => ms.layerIndex === layerIndex);
      const keypads = (designData.keypads ?? []).filter(kp => kp.layerIndex === layerIndex);
      const controlDevices = (designData.controlDevices ?? []).filter(cd => cd.layerIndex === layerIndex);
      const routes = designData.routes.filter(r => r.layerIndex === layerIndex);

      for (const route of routes) {
        if (route.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(route.points[0].x * cw, route.points[0].y * ch);
        for (let i = 1; i < route.points.length; i++) ctx.lineTo(route.points[i].x * cw, route.points[i].y * ch);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const d of detectors) {
        const model = catalog.detectors.find(m => m.id === d.modelId);
        const color = DETECTOR_TYPE_COLORS[model?.detector_type ?? 'smoke'] ?? '#3b82f6';
        const sx = d.x * cw, sy = d.y * ch;
        const zoneIdx = designData.zones.findIndex(z => z.detectorIds.includes(d.id));
        if (zoneIdx >= 0) {
          const zc = designData.zones[zoneIdx].color || ZONE_COLORS[zoneIdx % ZONE_COLORS.length];
          ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2);
          ctx.fillStyle = zc + '28'; ctx.fill();
          ctx.strokeStyle = zc; ctx.lineWidth = 1.5; ctx.stroke();
        }
        if (model?.detector_type === 'manual_call_point') {
          ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.rect(sx - 8, sy - 8, 16, 16); ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        if (d.label) { ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.fillText(d.label, sx, sy + 18); }
      }

      for (const ms of motionSensors) {
        const sx = ms.x * cw, sy = ms.y * ch;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(-9, -9, 18, 18); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.font = 'bold 7px sans-serif'; ctx.fillStyle = '#67e8f9'; ctx.textAlign = 'center'; ctx.fillText('PIR', sx, sy + 2.5);
      }

      for (const kp of keypads) {
        const sx = kp.x * cw, sy = kp.y * ch;
        ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(sx - 12, sy - 8, 24, 16); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 7px sans-serif'; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'center'; ctx.fillText('KLV', sx, sy + 2.5);
      }

      for (const cd of controlDevices) {
        const sx = cd.x * cw, sy = cd.y * ch;
        ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = 'bold 7px sans-serif'; ctx.fillStyle = '#fcd34d'; ctx.textAlign = 'center'; ctx.fillText('OVL', sx, sy + 2.5);
      }

      for (const s of sirens) {
        const sx = s.x * cw, sy = s.y * ch;
        ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = 'bold 7px sans-serif'; ctx.fillStyle = '#fdba74'; ctx.textAlign = 'center'; ctx.fillText('SIR', sx, sy + 2.5);
      }

      for (const p of panels) {
        const sx = p.x * cw, sy = p.y * ch;
        ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(sx - 14, sy - 14, 28, 28); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#a5b4fc'; ctx.textAlign = 'center'; ctx.fillText('CPU', sx, sy + 3);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, ch - 26, cw, 26);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#f1f5f9';
      ctx.textAlign = 'left';
      ctx.fillText(layer.name, 10, ch - 8);

      setDataUrl(canvas.toDataURL('image/jpeg', 0.88));
    };

    if (layer.imageData) {
      const img = new Image();
      img.onload = () => draw(img);
      img.onerror = () => draw();
      img.src = layer.imageData;
    } else {
      draw();
    }
  }, [layer, layerIndex, designData, catalog]);

  return (
    <div className="mb-4 print:mb-2">
      <canvas ref={canvasRef} className="hidden" />
      {dataUrl && (
        <img src={dataUrl} alt={layer.name} className="w-full rounded-lg border border-white/10 print:rounded-none" />
      )}
    </div>
  );
}

interface Props {
  projectId: string | null;
}

export default function SummaryEpsPrint({ projectId }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [designData, setDesignData] = useState<EpsDesignData | null>(null);
  const [detectorModels, setDetectorModels] = useState<EpsDetectorModel[]>([]);
  const [panelModels, setPanelModels] = useState<EpsPanelModel[]>([]);
  const [sirenModels, setSirenModels] = useState<EpsSiren[]>([]);
  const [motionSensorModels, setMotionSensorModels] = useState<EpsMotionSensor[]>([]);
  const [keypadModels, setKeypadModels] = useState<EpsKeypad[]>([]);
  const [controlDeviceModels, setControlDeviceModels] = useState<EpsControlDevice[]>([]);
  const [accessories, setAccessories] = useState<EpsAccessory[]>([]);

  useEffect(() => {
    if (!projectId || !orgId) return;

    supabase
      .from('eps_designs')
      .select('id, design_data')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        let dd = data.design_data as EpsDesignData;
        const { data: ver } = await supabase
          .from('eps_design_versions')
          .select('design_data')
          .eq('eps_design_id', data.id)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ver?.design_data) dd = ver.design_data as EpsDesignData;
        if (dd) {
          setDesignData({
            layers: dd.layers ?? [],
            detectors: dd.detectors ?? [],
            panels: dd.panels ?? [],
            sirens: dd.sirens ?? [],
            motionSensors: dd.motionSensors ?? [],
            keypads: dd.keypads ?? [],
            controlDevices: dd.controlDevices ?? [],
            routes: dd.routes ?? [],
            accessoryItems: dd.accessoryItems ?? [],
            zones: dd.zones ?? [],
            scale: dd.scale,
            quoteConfig: dd.quoteConfig,
          });
        }
      });

    supabase.from('eps_detector_models').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setDetectorModels((data ?? []) as EpsDetectorModel[]));
    supabase.from('eps_panels').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setPanelModels((data ?? []) as EpsPanelModel[]));
    supabase.from('eps_sirens').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setSirenModels((data ?? []) as EpsSiren[]));
    supabase.from('eps_motion_sensors').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setMotionSensorModels((data ?? []) as EpsMotionSensor[]));
    supabase.from('eps_keypads').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setKeypadModels((data ?? []) as EpsKeypad[]));
    supabase.from('eps_control_devices').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setControlDeviceModels((data ?? []) as EpsControlDevice[]));
    supabase.from('eps_accessories').select('*').eq('org_id', orgId).eq('is_active', true).then(({ data }) => setAccessories((data ?? []) as EpsAccessory[]));
  }, [projectId, orgId]);

  if (!designData || designData.detectors.length === 0) return null;

  const catalog: EpsCatalogData = {
    detectors: detectorModels, panels: panelModels, sirens: sirenModels,
    motionSensors: motionSensorModels, keypads: keypadModels, controlDevices: controlDeviceModels,
    accessories, cables: [], loading: false, reload: () => {},
  };

  const detectorGroups = new Map<string, { model: EpsDetectorModel; count: number }>();
  designData.detectors.forEach(d => {
    const model = detectorModels.find(m => m.id === d.modelId);
    if (!model) return;
    const existing = detectorGroups.get(model.id);
    if (existing) existing.count++;
    else detectorGroups.set(model.id, { model, count: 1 });
  });

  const totalDetectors = designData.detectors.length;
  const totalMotion = (designData.motionSensors ?? []).length;
  const totalKeypads = (designData.keypads ?? []).length;
  const totalSirens = designData.sirens.length;
  const totalPanels = designData.panels.length;
  const totalElements = totalDetectors + totalMotion + totalKeypads + totalSirens + totalPanels + (designData.controlDevices ?? []).length;

  const layersWithImages = designData.layers.filter(l => l.imageData);

  return (
    <div className="page-break-before mt-10 print:mt-0">
      <div className="flex items-center gap-2 mb-4 border-b-2 border-red-400 pb-2 print:mb-2">
        <Shield className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-extrabold text-white">{`EPS / EZS systém`}</h2>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5 print:gap-2 print:mb-3">
        <div className="bg-blue-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-blue-400">Detektory</div>
          <div className="text-xl font-extrabold text-blue-400 print:text-base">{totalDetectors}</div>
        </div>
        <div className="bg-cyan-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400">PIR</div>
          <div className="text-xl font-extrabold text-cyan-400 print:text-base">{totalMotion}</div>
        </div>
        <div className="bg-orange-500/10 rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-orange-400">{`Sirény`}</div>
          <div className="text-xl font-extrabold text-orange-400 print:text-base">{totalSirens}</div>
        </div>
        <div className="bg-white/[0.04] rounded-xl p-3 print:p-2 print:rounded-lg">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{`Celkem prvků`}</div>
          <div className="text-xl font-extrabold text-slate-300 print:text-base">{totalElements}</div>
        </div>
      </div>

      {layersWithImages.length > 0 && (
        <div className="mb-5 print:mb-3">
          <h3 className="text-sm font-extrabold text-slate-300 mb-2">{`Náhled rozmístění`}</h3>
          {layersWithImages.map((layer, i) => (
            <EpsLayerPreview key={i} layer={layer} layerIndex={designData.layers.indexOf(layer)} designData={designData} catalog={catalog} />
          ))}
        </div>
      )}

      {designData.zones.length > 0 && (
        <div className="mb-5 print:mb-3">
          <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-500" /> {`Zóny`}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {designData.zones.map((zone, i) => {
              const zoneColor = zone.color || ZONE_COLORS[i % ZONE_COLORS.length];
              return (
                <div key={zone.id} className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-2 border border-white/10 text-xs">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: zoneColor }} />
                  <span className="font-extrabold text-slate-300">{zone.name}</span>
                  <span className="text-slate-500 ml-auto">{zone.detectorIds.length} det.</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-5 print:mb-3">
        <h3 className="text-sm font-extrabold text-slate-300 mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-blue-500" /> {`Seznam detektorů`}
        </h3>
        <table className="w-full text-xs border border-white/10 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-white/[0.06]">
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">Model</th>
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">Typ</th>
              <th className="px-3 py-2 text-left font-extrabold text-slate-400">{`Výrobce`}</th>
              <th className="px-3 py-2 text-right font-extrabold text-slate-400">{`Počet`}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(detectorGroups.values()).map(({ model, count }) => (
              <tr key={model.id} className="border-t border-white/[0.06]">
                <td className="px-3 py-2 font-extrabold text-white">{model.name}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: DETECTOR_TYPE_COLORS[model.detector_type] ?? '#3b82f6' }} />
                    {DETECTOR_TYPE_LABELS[model.detector_type] ?? model.detector_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{model.manufacturer}</td>
                <td className="px-3 py-2 text-right font-extrabold text-white">{count}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 print:gap-2">
        {totalPanels > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">{`Ústředny`}</h3>
            </div>
            {designData.panels.map(panel => {
              const model = panelModels.find(p => p.id === panel.panelId);
              if (!model) return null;
              return (
                <div key={panel.id} className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2 last:mb-0">
                  <div className="text-slate-500">Model:</div>
                  <div className="font-extrabold text-slate-300">{model.name}</div>
                  <div className="text-slate-500">{`Výrobce`}:</div>
                  <div className="font-extrabold text-slate-300">{model.manufacturer}</div>
                  <div className="text-slate-500">{`Zóny`}:</div>
                  <div className="font-extrabold text-slate-300">{`max ${model.max_zones}`}</div>
                </div>
              );
            })}
          </div>
        )}

        {totalMotion > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">{`Pohybová čidla`}</h3>
            </div>
            {(() => {
              const msGroups = new Map<string, number>();
              for (const ms of designData.motionSensors ?? []) {
                msGroups.set(ms.sensorId, (msGroups.get(ms.sensorId) ?? 0) + 1);
              }
              return Array.from(msGroups.entries()).map(([modelId, count]) => {
                const model = motionSensorModels.find(m => m.id === modelId);
                return model ? (
                  <div key={modelId} className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{model.name}</span>
                    <span className="font-extrabold text-slate-300">{count}x</span>
                  </div>
                ) : null;
              });
            })()}
          </div>
        )}

        {totalKeypads > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Keyboard className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">{`Klávesnice`}</h3>
            </div>
            {(() => {
              const kpGroups = new Map<string, number>();
              for (const kp of designData.keypads ?? []) {
                kpGroups.set(kp.keypadId, (kpGroups.get(kp.keypadId) ?? 0) + 1);
              }
              return Array.from(kpGroups.entries()).map(([modelId, count]) => {
                const model = keypadModels.find(m => m.id === modelId);
                return model ? (
                  <div key={modelId} className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{model.name}</span>
                    <span className="font-extrabold text-slate-300">{count}x</span>
                  </div>
                ) : null;
              });
            })()}
          </div>
        )}

        {totalSirens > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Siren className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">{`Sirény`}</h3>
            </div>
            {(() => {
              const sGroups = new Map<string, number>();
              for (const s of designData.sirens) {
                sGroups.set(s.sirenId, (sGroups.get(s.sirenId) ?? 0) + 1);
              }
              return Array.from(sGroups.entries()).map(([sirenId, count]) => {
                const model = sirenModels.find(m => m.id === sirenId);
                return model ? (
                  <div key={sirenId} className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{model.name}</span>
                    <span className="font-extrabold text-slate-300">{count}x</span>
                  </div>
                ) : null;
              });
            })()}
          </div>
        )}

        {designData.accessoryItems.length > 0 && (
          <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3 print:p-2 print:rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">{`Příslušenství`}</h3>
            </div>
            <div className="space-y-1">
              {designData.accessoryItems.map(ai => {
                const acc = accessories.find(a => a.id === ai.accessoryId);
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
