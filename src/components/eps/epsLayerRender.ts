import type { EpsDesignData, EpsDesignLayer } from '../../hooks/useEpsDesign';
import type { EpsCatalogData } from '../../hooks/useEpsCatalog';

const DETECTOR_TYPE_COLORS: Record<string, string> = {
  smoke: '#3b82f6', heat: '#ef4444', smoke_heat: '#10b981',
  linear: '#8b5cf6', manual_call_point: '#f59e0b', gas: '#ec4899',
  co: '#06b6d4', flame: '#f97316',
};

const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderLayerToDataUrl(
  layer: EpsDesignLayer,
  layerIndex: number,
  designData: EpsDesignData,
  catalog: EpsCatalogData,
  width = 760,
  height = 520,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const renderW = width;
  let renderH = height;

  if (layer.imageData) {
    const img = await loadImage(layer.imageData);
    if (img) {
      const ar = img.naturalWidth / img.naturalHeight;
      renderH = Math.round(renderW / ar);
      canvas.width = renderW;
      canvas.height = renderH;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, renderW, renderH);
      ctx.globalAlpha = 0.88;
      ctx.drawImage(img, 0, 0, renderW, renderH);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, renderW, renderH);
    }
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, renderW, renderH);
  }

  const cw = canvas.width;
  const ch = canvas.height;

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
    for (let i = 1; i < route.points.length; i++) {
      ctx.lineTo(route.points[i].x * cw, route.points[i].y * ch);
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const d of detectors) {
    const model = catalog.detectors.find(m => m.id === d.modelId);
    const color = DETECTOR_TYPE_COLORS[model?.detector_type ?? 'smoke'] ?? '#3b82f6';
    const sx = d.x * cw;
    const sy = d.y * ch;
    const isManualCallPoint = model?.detector_type === 'manual_call_point';

    const zoneIdx = designData.zones.findIndex(z => z.detectorIds.includes(d.id));
    if (zoneIdx >= 0) {
      const zoneColor = designData.zones[zoneIdx].color || ZONE_COLORS[zoneIdx % ZONE_COLORS.length];
      ctx.beginPath();
      ctx.arc(sx, sy, 18, 0, Math.PI * 2);
      ctx.fillStyle = zoneColor + '28';
      ctx.fill();
      ctx.strokeStyle = zoneColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (isManualCallPoint) {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(sx - 8, sy - 8, 16, 16);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (d.label) {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, sx, sy + 18);
    }
  }

  for (const ms of motionSensors) {
    const sx = ms.x * cw;
    const sy = ms.y * ch;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-9, -9, 18, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.fillStyle = '#67e8f9';
    ctx.textAlign = 'center';
    ctx.fillText('PIR', sx, sy + 2.5);
    if (ms.label) {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(ms.label, sx, sy + 20);
    }
  }

  for (const kp of keypads) {
    const sx = kp.x * cw;
    const sy = kp.y * ch;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(sx - 12, sy - 8, 24, 16);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.fillStyle = '#6ee7b7';
    ctx.textAlign = 'center';
    ctx.fillText('KLV', sx, sy + 2.5);
  }

  for (const cd of controlDevices) {
    const sx = cd.x * cw;
    const sy = cd.y * ch;
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.fillStyle = '#fcd34d';
    ctx.textAlign = 'center';
    ctx.fillText('OVL', sx, sy + 2.5);
  }

  for (const s of sirens) {
    const sx = s.x * cw;
    const sy = s.y * ch;
    ctx.beginPath();
    ctx.arc(sx, sy, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.fillStyle = '#fdba74';
    ctx.textAlign = 'center';
    ctx.fillText('SIR', sx, sy + 2.5);
  }

  for (const p of panels) {
    const sx = p.x * cw;
    const sy = p.y * ch;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(sx - 14, sy - 14, 28, 28);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillStyle = '#a5b4fc';
    ctx.textAlign = 'center';
    ctx.fillText('CPU', sx, sy + 3);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, ch - 26, cw, 26);
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.textAlign = 'left';
  ctx.fillText(layer.name, 10, ch - 8);

  const totalElements = detectors.length + motionSensors.length + keypads.length + sirens.length + panels.length + controlDevices.length;
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText(`${totalElements} prvku`, cw - 10, ch - 8);

  return canvas.toDataURL('image/jpeg', 0.88);
}

export interface LayerLegendItem {
  color: string;
  shape: 'circle' | 'square' | 'rect' | 'diamond' | 'line';
  label: string;
}

const DETECTOR_LEGEND_LABELS: Record<string, string> = {
  smoke: 'Detektor kou\u0159e', heat: 'Tepeln\u00fd detektor', smoke_heat: 'Kombinovan\u00fd detektor',
  linear: 'Line\u00e1rn\u00ed detektor', manual_call_point: 'Tla\u010d\u00edtkov\u00fd hla\u0161i\u010d', gas: 'Plynov\u00fd detektor',
  co: 'CO detektor', flame: 'Plamenov\u00fd detektor',
};

function buildLayerLegend(layerIndex: number, designData: EpsDesignData, catalog: EpsCatalogData): LayerLegendItem[] {
  const items: LayerLegendItem[] = [];
  const detectors = designData.detectors.filter(d => d.layerIndex === layerIndex);
  const motionSensors = (designData.motionSensors ?? []).filter(ms => ms.layerIndex === layerIndex);
  const sirens = designData.sirens.filter(s => s.layerIndex === layerIndex);
  const keypads = (designData.keypads ?? []).filter(kp => kp.layerIndex === layerIndex);
  const controlDevices = (designData.controlDevices ?? []).filter(cd => cd.layerIndex === layerIndex);
  const panels = designData.panels.filter(p => p.layerIndex === layerIndex);
  const routes = designData.routes.filter(r => r.layerIndex === layerIndex);

  const usedDetectorTypes = new Set(detectors.map(d => {
    const model = catalog.detectors.find(m => m.id === d.modelId);
    return model?.detector_type ?? 'smoke';
  }));
  for (const dt of usedDetectorTypes) {
    items.push({
      color: DETECTOR_TYPE_COLORS[dt] ?? '#3b82f6',
      shape: dt === 'manual_call_point' ? 'square' : 'circle',
      label: DETECTOR_LEGEND_LABELS[dt] ?? dt,
    });
  }
  if (motionSensors.length > 0) items.push({ color: '#06b6d4', shape: 'diamond', label: 'PIR pohybov\u00e9 \u010didlo' });
  if (sirens.length > 0) items.push({ color: '#f97316', shape: 'circle', label: 'Sir\u00e9na' });
  if (keypads.length > 0) items.push({ color: '#10b981', shape: 'rect', label: 'Kl\u00e1vesnice' });
  if (controlDevices.length > 0) items.push({ color: '#f59e0b', shape: 'circle', label: 'Ovl\u00e1dac\u00ed prvek' });
  if (panels.length > 0) items.push({ color: '#6366f1', shape: 'square', label: '\u00DAst\u0159edna EPS/EZS' });
  if (routes.length > 0) items.push({ color: '#f59e0b', shape: 'line', label: 'Kabelov\u00e1 trasa' });

  return items;
}

export async function renderAllLayerImages(
  designData: EpsDesignData,
  catalog: EpsCatalogData,
): Promise<{ name: string; dataUrl: string; legend: LayerLegendItem[] }[]> {
  const results: { name: string; dataUrl: string; legend: LayerLegendItem[] }[] = [];
  for (let i = 0; i < designData.layers.length; i++) {
    const layer = designData.layers[i];
    if (!layer.imageData) continue;
    const dataUrl = await renderLayerToDataUrl(layer, i, designData, catalog);
    const legend = buildLayerLegend(i, designData, catalog);
    results.push({ name: layer.name, dataUrl, legend });
  }
  return results;
}
