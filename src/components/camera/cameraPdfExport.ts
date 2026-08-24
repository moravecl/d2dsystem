import html2pdf from 'html2pdf.js';
import type { CameraDesignData, DesignLayer } from '../../hooks/useCameraDesign';
import type { CameraCatalogData, CameraModel } from '../../hooks/useCameraCatalog';
import { calculateStorage, calcTotalPoePowerW } from '../../lib/cameraCalculations';
import { polylineLength, normalizedToMeters } from '../catalog/floorplan/geometry';
import { metersPerPixelAtZoom } from './CameraCanvas';

interface ExportParams {
  projectName: string;
  designData: CameraDesignData;
  catalog: CameraCatalogData;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('cs-CZ');
}

const CAMERA_TYPE_LABELS: Record<string, string> = {
  dome: 'Dome', bullet: 'Bullet', ptz: 'PTZ', fisheye: 'Fisheye', box: 'Box',
};

const CAMERA_TYPE_COLORS: Record<string, string> = {
  dome: '#3b82f6', bullet: '#10b981', ptz: '#f59e0b', fisheye: '#ec4899', box: '#8b5cf6',
};

function stringToColor(str: string): string {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getRouteLengthM(
  points: { x: number; y: number }[],
  scale: CameraDesignData['scale'],
  mapLayer: DesignLayer | undefined,
  layerScale?: DesignLayer['scale']
): number {
  if (points.length < 2) return 0;
  const normLen = polylineLength(points);
  const effectiveScale = layerScale ?? scale;
  if (effectiveScale) return normalizedToMeters(normLen, effectiveScale);
  if (mapLayer?.mapCenter && mapLayer.mapZoom) {
    const mpp = metersPerPixelAtZoom(mapLayer.mapCenter.lat, mapLayer.mapZoom);
    return normLen * 1000 * mpp;
  }
  return 0;
}

function buildLayerPreviewSvg(
  designData: CameraDesignData,
  catalog: CameraCatalogData,
  mapLayer: DesignLayer | undefined
): string {
  const W = 1200;
  const H = 800;

  const toAbs = (nx: number, ny: number) => ({ x: nx * W, y: ny * H });

  const getNormPixelsPerMeter = (): number => {
    if (mapLayer?.mapCenter && mapLayer.mapZoom) {
      const mpp = metersPerPixelAtZoom(mapLayer.mapCenter.lat, mapLayer.mapZoom);
      return 1 / (mpp * W);
    }
    const scale = designData.scale;
    if (scale) {
      const dx = scale.p2.x - scale.p1.x;
      const dy = scale.p2.y - scale.p1.y;
      const normDist = Math.sqrt(dx * dx + dy * dy);
      return normDist / scale.realDistanceM;
    }
    return 0.002;
  };

  const fovRadius = (irRangeM: number): number => {
    const nppm = getNormPixelsPerMeter();
    const rangeM = Math.min(irRangeM, 60);
    return rangeM * nppm * W;
  };

  let routesSvg = '';
  designData.routes.forEach(route => {
    if (route.points.length < 2) return;
    const pts = route.points.map(p => toAbs(p.x, p.y));
    const color = route.label ? stringToColor(route.label) : '#f59e0b';
    const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
    routesSvg += `<polyline points="${pointsStr}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="8 4" opacity="0.9"/>`;
    pts.forEach(p => {
      routesSvg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"/>`;
    });
    if (route.label && pts.length >= 2) {
      const mx = (pts[0].x + pts[Math.floor(pts.length / 2)].x) / 2;
      const my = (pts[0].y + pts[Math.floor(pts.length / 2)].y) / 2 - 8;
      routesSvg += `<text x="${mx}" y="${my}" text-anchor="middle" fill="white" font-size="9" font-weight="bold" style="text-shadow:0 1px 3px rgba(0,0,0,0.9)">${esc(route.label)}</text>`;
    }
  });

  let camerasSvg = '';
  designData.cameras.forEach(cam => {
    const model = catalog.cameras.find(m => m.id === cam.modelId);
    if (!model) return;
    const abs = toAbs(cam.x, cam.y);
    const color = CAMERA_TYPE_COLORS[model.camera_type] ?? '#3b82f6';
    const halfFov = (model.h_fov_deg / 2) * (Math.PI / 180);
    const rotRad = cam.rotationDeg * (Math.PI / 180);
    const fovR = fovRadius(model.ir_range_m);

    const fovPath = `M ${abs.x} ${abs.y}
      L ${abs.x + Math.cos(rotRad - halfFov) * fovR} ${abs.y + Math.sin(rotRad - halfFov) * fovR}
      A ${fovR} ${fovR} 0 ${model.h_fov_deg > 180 ? 1 : 0} 1 ${abs.x + Math.cos(rotRad + halfFov) * fovR} ${abs.y + Math.sin(rotRad + halfFov) * fovR}
      Z`;
    camerasSvg += `<path d="${fovPath}" fill="${color}" opacity="0.15" stroke="${color}" stroke-width="1" stroke-opacity="0.4"/>`;
    camerasSvg += `<circle cx="${abs.x}" cy="${abs.y}" r="10" fill="${color}" stroke="white" stroke-width="2"/>`;
    camerasSvg += `<text x="${abs.x}" y="${abs.y - 16}" text-anchor="middle" fill="white" font-size="9" font-weight="bold" style="text-shadow:0 1px 3px rgba(0,0,0,0.8)">${esc(cam.label || model.name)}</text>`;
  });

  let nvrsSvg = '';
  designData.nvrs.forEach(nvr => {
    const abs = toAbs(nvr.x, nvr.y);
    nvrsSvg += `<rect x="${abs.x - 16}" y="${abs.y - 12}" width="32" height="24" rx="4" fill="#1e293b" stroke="#60a5fa" stroke-width="2"/>`;
    nvrsSvg += `<text x="${abs.x}" y="${abs.y + 3}" text-anchor="middle" fill="white" font-size="8" font-weight="bold">NVR</text>`;
  });

  let switchesSvg = '';
  designData.switches.forEach(sw => {
    const abs = toAbs(sw.x, sw.y);
    switchesSvg += `<rect x="${abs.x - 14}" y="${abs.y - 10}" width="28" height="20" rx="3" fill="#1e293b" stroke="#10b981" stroke-width="2"/>`;
    switchesSvg += `<text x="${abs.x}" y="${abs.y + 3}" text-anchor="middle" fill="#10b981" font-size="7" font-weight="bold">SW</text>`;
  });

  let mapTilesBg = '';
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
        mapTilesBg += `<image href="https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${zoom}/${ty}/${wrappedTx}" x="${Math.round(px)}" y="${Math.round(py)}" width="${tileSize}" height="${tileSize}"/>`;
      }
    }
  }

  let imageLayerBg = '';
  const imageLayer = designData.layers.find(l => l.type === 'image' && l.imageData);
  if (imageLayer?.imageData && !mapLayer) {
    imageLayerBg = `<image href="${imageLayer.imageData}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  const displayW = 680;
  const displayH = Math.round(displayW * H / W);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${displayW}" height="${displayH}" viewBox="0 0 ${W} ${H}" style="border-radius:8px;border:1px solid #e2e8f0;background:#1e293b;">
    ${mapTilesBg}${imageLayerBg}
    ${routesSvg}
    ${camerasSvg}
    ${nvrsSvg}
    ${switchesSvg}
  </svg>`;
}

function buildStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; }
    @page { size: A4 portrait; margin: 15mm 12mm; }
    @media print { .page-break { page-break-before: always; } }
    .brand-bar { background: linear-gradient(135deg, #1e40af, #3b82f6); height: 6px; width: 100%; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 800; color: #0f172a; margin: 20px 0 12px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; }
    .subtitle { font-size: 11px; color: #64748b; margin-bottom: 20px; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin: 14px 0; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .stat-card.blue { background: #eff6ff; border-color: #bfdbfe; }
    .stat-card.green { background: #f0fdf4; border-color: #bbf7d0; }
    .stat-card.amber { background: #fffbeb; border-color: #fde68a; }
    .stat-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 18px; font-weight: 800; margin-top: 2px; }
    .blue .stat-value { color: #2563eb; }
    .green .stat-value { color: #16a34a; }
    .amber .stat-value { color: #d97706; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 6px 8px; text-align: left; font-size: 10px; }
    th { background: #f1f5f9; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .text-bold { font-weight: 700; }
    .section-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 10px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; }
    .info-label { color: #64748b; font-weight: 600; }
    .info-value { color: #1e293b; font-weight: 700; }
    .price-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    .price-row.total { border-top: 2px solid #e2e8f0; border-bottom: none; font-size: 12px; font-weight: 800; margin-top: 4px; padding-top: 8px; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: right; }
    .preview-container { margin: 14px 0; text-align: center; }
    .preview-container svg { max-width: 100%; height: auto; }
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  `;
}

export function exportCameraProposalPdf(p: ExportParams): void {
  const { designData, catalog } = p;
  const storage = calculateStorage(designData.cameras, catalog.cameras, designData.storageConfig);
  const totalPoe = calcTotalPoePowerW(designData.cameras, catalog.cameras);
  const now = new Date().toLocaleDateString('cs-CZ');

  const mapLayer = designData.layers.find(l => l.type === 'map' && l.mapCenter);

  const totalCableM = designData.routes.reduce((sum, route) => {
    return sum + getRouteLengthM(route.points, designData.scale, mapLayer, designData.layers[route.layerIndex]?.scale);
  }, 0);

  const cameraRows = designData.cameras.map(cam => {
    const model = catalog.cameras.find(m => m.id === cam.modelId);
    if (!model) return '';
    return `<tr>
      <td>${esc(cam.label)}</td>
      <td>${esc(model.name)}</td>
      <td>${CAMERA_TYPE_LABELS[model.camera_type] ?? model.camera_type}</td>
      <td>${model.resolution_label}</td>
      <td>${model.h_fov_deg}&deg;</td>
      <td>${model.ir_range_m} m</td>
      <td class="text-right text-bold">${fmtNum(model.price)} Kc</td>
    </tr>`;
  }).join('');

  const cableRows = designData.routes.map(route => {
    const cable = catalog.cables.find(c => c.id === route.cableTypeId);
    if (!cable) return '';
    const len = getRouteLengthM(route.points, designData.scale, mapLayer, designData.layers[route.layerIndex]?.scale);
    const price = len * cable.price_per_m;
    return `<tr>
      <td>${esc(route.label || '-')}</td>
      <td>${esc(cable.name)}</td>
      <td class="text-right">${len.toFixed(1)} m</td>
      <td class="text-right">${fmtNum(cable.price_per_m)} Kc/m</td>
      <td class="text-right text-bold">${fmtNum(Math.round(price))} Kc</td>
    </tr>`;
  }).join('');

  const priceLines: { label: string; value: number }[] = [];

  const camGroups = new Map<string, { model: CameraModel; count: number }>();
  designData.cameras.forEach(cam => {
    const model = catalog.cameras.find(m => m.id === cam.modelId);
    if (!model) return;
    const existing = camGroups.get(model.id);
    if (existing) existing.count++;
    else camGroups.set(model.id, { model, count: 1 });
  });
  camGroups.forEach(({ model, count }) => {
    priceLines.push({ label: `${model.name} (${count}x)`, value: model.price * count });
  });

  designData.nvrs.forEach(nvr => {
    const model = catalog.nvrs.find(n => n.id === nvr.nvrId);
    if (model) priceLines.push({ label: `NVR ${model.name}`, value: model.price });
  });

  designData.switches.forEach(sw => {
    const model = catalog.poeSwitches.find(s => s.id === sw.switchId);
    if (model) priceLines.push({ label: `Switch ${model.name}`, value: model.price });
  });

  const cableGroups = new Map<string, { name: string; lengthM: number; pricePerM: number }>();
  designData.routes.forEach(route => {
    const cable = catalog.cables.find(c => c.id === route.cableTypeId);
    if (!cable) return;
    const len = getRouteLengthM(route.points, designData.scale, mapLayer, designData.layers[route.layerIndex]?.scale);
    if (len <= 0) return;
    const existing = cableGroups.get(cable.id);
    if (existing) existing.lengthM += len;
    else cableGroups.set(cable.id, { name: cable.name, lengthM: len, pricePerM: cable.price_per_m });
  });
  cableGroups.forEach(({ name, lengthM, pricePerM }) => {
    priceLines.push({ label: `${name} (${Math.ceil(lengthM)} m)`, value: lengthM * pricePerM });
  });

  designData.accessoryItems.forEach(ai => {
    const acc = catalog.accessories.find(a => a.id === ai.accessoryId);
    if (acc && ai.quantity > 0) priceLines.push({ label: `${acc.name} (${ai.quantity}x)`, value: acc.price * ai.quantity });
  });

  const total = priceLines.reduce((s, l) => s + l.value, 0);

  const layerPreviewSvg = buildLayerPreviewSvg(designData, catalog, mapLayer);

  const nvrRows = designData.nvrs.map(nvr => {
    const model = catalog.nvrs.find(n => n.id === nvr.nvrId);
    if (!model) return '';
    return `<tr>
      <td>${esc(model.name)}</td>
      <td>${model.channels} kanalu</td>
      <td>${model.poe_ports} PoE portu</td>
      <td>${model.hdd_bays} HDD slotu</td>
      <td class="text-right text-bold">${fmtNum(model.price)} Kc</td>
    </tr>`;
  }).join('');

  const switchRows = designData.switches.map(sw => {
    const model = catalog.poeSwitches.find(s => s.id === sw.switchId);
    if (!model) return '';
    return `<tr>
      <td>${esc(model.name)}</td>
      <td>${model.poe_ports} PoE portu</td>
      <td>${model.poe_budget_w} W budget</td>
      <td class="text-right text-bold">${fmtNum(model.price)} Kc</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"><title>Kamerovy system - ${esc(p.projectName)}</title>
<style>${buildStyles()}</style></head><body>
<div class="brand-bar"></div>
<h1>Nabidka kameroveho systemu</h1>
<div class="subtitle">${esc(p.projectName)} &bull; ${now}</div>

<div class="stat-grid">
  <div class="stat-card blue">
    <div class="stat-label">Kamery</div>
    <div class="stat-value">${designData.cameras.length}</div>
  </div>
  <div class="stat-card green">
    <div class="stat-label">Kabelaz</div>
    <div class="stat-value">${fmtNum(Math.round(totalCableM))} m</div>
  </div>
  <div class="stat-card amber">
    <div class="stat-label">PoE prikon</div>
    <div class="stat-value">${fmtNum(Math.round(totalPoe))} W</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Uloziste</div>
    <div class="stat-value">${storage.recommendedHddCount}x${storage.recommendedHddSizeTb}TB</div>
  </div>
</div>

<h2>Nahled rozmisteni</h2>
<div class="preview-container">
  ${layerPreviewSvg}
</div>

<div class="page-break"></div>
<h2>Seznam kamer</h2>
<table>
  <thead>
    <tr><th>Oznaceni</th><th>Model</th><th>Typ</th><th>Rozliseni</th><th>FOV</th><th>IR</th><th class="text-right">Cena</th></tr>
  </thead>
  <tbody>${cameraRows}</tbody>
</table>

${cableRows ? `
<h2>Kabelaz</h2>
<table>
  <thead>
    <tr><th>Trasa</th><th>Typ kabelu</th><th class="text-right">Delka</th><th class="text-right">Cena/m</th><th class="text-right">Celkem</th></tr>
  </thead>
  <tbody>${cableRows}</tbody>
</table>
` : ''}

${nvrRows ? `
<h2>NVR zaznamniky</h2>
<table>
  <thead>
    <tr><th>Model</th><th>Kanaly</th><th>PoE</th><th>HDD</th><th class="text-right">Cena</th></tr>
  </thead>
  <tbody>${nvrRows}</tbody>
</table>
` : ''}

${switchRows ? `
<h2>PoE Switche</h2>
<table>
  <thead>
    <tr><th>Model</th><th>PoE porty</th><th>PoE budget</th><th class="text-right">Cena</th></tr>
  </thead>
  <tbody>${switchRows}</tbody>
</table>
` : ''}

<h2>Uloziste a nahravani</h2>
<div class="section-box">
  <div class="info-grid">
    <div><span class="info-label">Kodek:</span></div>
    <div><span class="info-value">${designData.storageConfig.codec.toUpperCase()}</span></div>
    <div><span class="info-label">Nahravani:</span></div>
    <div><span class="info-value">${designData.storageConfig.recordingHoursPerDay}h/den</span></div>
    <div><span class="info-label">Retence:</span></div>
    <div><span class="info-value">${designData.storageConfig.retentionDays} dni</span></div>
    <div><span class="info-label">Detekce pohybu:</span></div>
    <div><span class="info-value">${designData.storageConfig.motionOnlyPct}%</span></div>
    <div><span class="info-label">Denni objem:</span></div>
    <div><span class="info-value">${fmtNum(storage.dailyStorageGb)} GB</span></div>
    <div><span class="info-label">Celkovy objem:</span></div>
    <div><span class="info-value">${fmtNum(storage.totalStorageTb)} TB</span></div>
    <div><span class="info-label">Doporuceny HDD:</span></div>
    <div><span class="info-value" style="color:#2563eb;font-size:12px;">${storage.recommendedHddCount}x ${storage.recommendedHddSizeTb} TB</span></div>
  </div>
</div>

<div class="page-break"></div>
<h2>Cenova kalkulace</h2>
${priceLines.map(l => `<div class="price-row"><span>${esc(l.label)}</span><span class="text-bold">${fmtNum(Math.round(l.value))} Kc</span></div>`).join('')}
<div class="price-row total"><span>Celkem</span><span>${fmtNum(Math.round(total))} Kc</span></div>

<div class="footer">HouseSmart Kamerovy system &bull; Vygenerovano: ${now}</div>
</body></html>`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  document.body.appendChild(wrapper);

  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.padding = '0';
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  container.style.color = '#1e293b';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  wrapper.appendChild(container);

  setTimeout(() => {
    const pdfOptions = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `kamerovy-system-${p.projectName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };
    html2pdf()
      .set(pdfOptions)
      .from(container)
      .save()
      .then(() => {
        document.body.removeChild(wrapper);
      });
  }, 150);
}
