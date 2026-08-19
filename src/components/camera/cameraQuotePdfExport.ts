import html2pdf from 'html2pdf.js';
import type { CameraDesignData, DesignLayer, CameraQuoteConfig } from '../../hooks/useCameraDesign';
import type { CameraCatalogData } from '../../hooks/useCameraCatalog';
import { calculateStorage, calcTotalPoePowerW } from '../../lib/cameraCalculations';
import { polylineLength, normalizedToMeters } from '../catalog/floorplan/geometry';
import { metersPerPixelAtZoom } from './CameraCanvas';
import { buildQuoteHeaderHtml, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface QuoteLine {
  category: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  discountedTotal: number;
  imageUrl?: string | null;
  capacityTb?: number;
}

interface ExportParams {
  projectName: string;
  designData: CameraDesignData;
  catalog: CameraCatalogData;
  quoteConfig: CameraQuoteConfig;
  lines: QuoteLine[];
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
  vatRate?: number;
  quoteMode: 'itemized' | 'total';
  showImages?: boolean;
  client?: QuoteClientInfo | null;
  company?: QuoteCompanyInfo | null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('cs-CZ');
}

const CAMERA_TYPE_COLORS: Record<string, string> = {
  dome: '#3b82f6', bullet: '#10b981', ptz: '#f59e0b', fisheye: '#ec4899', box: '#8b5cf6',
};

function stringToColor(str: string): string {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
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
    return normLen * 1000 * metersPerPixelAtZoom(mapLayer.mapCenter.lat, mapLayer.mapZoom);
  }
  return 0;
}

async function fetchTileAsDataUrl(url: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(''), 10000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 256;
        canvas.height = img.naturalHeight || img.height || 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve('');
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(''); };
    img.src = url;
  });
}

async function fetchProductImageViaProxy(url: string): Promise<string> {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Apikey: SUPABASE_ANON_KEY } }
    );
    if (!resp.ok) return '';
    const data = await resp.json();
    return data.dataUrl || '';
  } catch {
    return '';
  }
}

async function buildMapTilesDataUrls(
  layer: DesignLayer,
  W: number,
  H: number
): Promise<{ px: number; py: number; dataUrl: string }[]> {
  if (layer.type !== 'map' || !layer.mapCenter || !layer.mapZoom) return [];
  const zoom = layer.mapZoom;
  const lonToTileX = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
  const latToTileY = (lat: number, z: number) => {
    const rad = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
  };
  const centerX = lonToTileX(layer.mapCenter.lon, zoom);
  const centerY = latToTileY(layer.mapCenter.lat, zoom);
  const tileSize = 256;
  const tilesW = Math.ceil(W / tileSize) + 1;
  const tilesH = Math.ceil(H / tileSize) + 1;
  const startTX = Math.floor(centerX - tilesW / 2);
  const startTY = Math.floor(centerY - tilesH / 2);
  const maxT = Math.pow(2, zoom);

  const tileRequests: { tx: number; ty: number; wrappedTx: number; px: number; py: number }[] = [];
  for (let tx = startTX; tx <= startTX + tilesW; tx++) {
    for (let ty = startTY; ty <= startTY + tilesH; ty++) {
      if (ty < 0 || ty >= maxT) continue;
      const wrappedTx = ((tx % maxT) + maxT) % maxT;
      const px = (tx - centerX) * tileSize + W / 2;
      const py = (ty - centerY) * tileSize + H / 2;
      tileRequests.push({ tx, ty, wrappedTx, px, py });
    }
  }

  const results = await Promise.all(
    tileRequests.map(async t => {
      const url = `https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${zoom}/${t.ty}/${t.wrappedTx}`;
      const dataUrl = await fetchTileAsDataUrl(url);
      return { px: Math.round(t.px), py: Math.round(t.py), dataUrl };
    })
  );
  return results.filter(r => r.dataUrl !== '');
}

async function buildLayerSvg(
  designData: CameraDesignData,
  catalog: CameraCatalogData,
  layerIndex: number,
  layer: DesignLayer,
  displayW: number,
): Promise<string> {
  const TILE_SIZE = 256;
  const isMap = layer.type === 'map' && !!layer.mapCenter && !!layer.mapZoom;

  const canvasW = layer.canvasWidth ?? (layer.canvasAspect ? Math.round(600 * layer.canvasAspect) : 1067);
  const canvasH = layer.canvasHeight ?? 600;

  const toAbs = (nx: number, ny: number) => ({ x: nx * canvasW, y: ny * canvasH });

  const displayH = Math.round(displayW * (canvasH / canvasW));

  const getPixelsPerMeter = (): number => {
    if (isMap && layer.mapCenter && layer.mapZoom) {
      return 1 / metersPerPixelAtZoom(layer.mapCenter.lat, layer.mapZoom);
    }
    const scale = layer.scale ?? designData.scale;
    if (scale) {
      const dx = (scale.p2.x - scale.p1.x) * canvasW;
      const dy = (scale.p2.y - scale.p1.y) * canvasH;
      const pxDist = Math.sqrt(dx * dx + dy * dy);
      if (pxDist > 0) return pxDist / scale.realDistanceM;
    }
    return 0;
  };

  const fovRadius = (irRangeM: number): number => {
    const ppm = getPixelsPerMeter();
    if (ppm <= 0) return Math.min(canvasW, canvasH) * 0.06;
    const rangeM = Math.min(irRangeM, 60);
    return Math.min(rangeM * ppm, Math.min(canvasW, canvasH) * 0.4);
  };

  const layerCameras = designData.cameras.filter(c => c.layerIndex === layerIndex);
  const layerRoutes = designData.routes.filter(r => r.layerIndex === layerIndex);
  const layerNvrs = designData.nvrs.filter(n => n.layerIndex === layerIndex);
  const layerSwitches = designData.switches.filter(s => s.layerIndex === layerIndex);

  let bg = '';
  if (isMap && layer.mapCenter && layer.mapZoom) {
    const tiles = await buildMapTilesDataUrls(layer, canvasW, canvasH);
    if (tiles.length > 0) {
      tiles.forEach(t => {
        bg += `<image href="${t.dataUrl}" x="${t.px}" y="${t.py}" width="${TILE_SIZE}" height="${TILE_SIZE}"/>`;
      });
    } else {
      bg = `<rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="#1a3a5c"/>`;
      bg += `<text x="${canvasW / 2}" y="${canvasH / 2}" text-anchor="middle" fill="#60a5fa" font-size="14" font-weight="bold">Satelitn\u00ed mapa</text>`;
      bg += `<text x="${canvasW / 2}" y="${canvasH / 2 + 20}" text-anchor="middle" fill="#94a3b8" font-size="10">${layer.mapCenter ? `${layer.mapCenter.lat.toFixed(5)}, ${layer.mapCenter.lon.toFixed(5)}` : ''}</text>`;
    }
  } else if (layer.type === 'image' && layer.imageData) {
    bg = `<image href="${layer.imageData}" x="0" y="0" width="${canvasW}" height="${canvasH}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  let routesSvg = '';
  layerRoutes.forEach(route => {
    if (route.points.length < 2) return;
    const pts = route.points.map(p => toAbs(p.x, p.y));
    const color = route.label ? stringToColor(route.label) : '#f59e0b';
    routesSvg += `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="8 4" opacity="0.85"/>`;
    pts.forEach(p => {
      routesSvg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"/>`;
    });
    if (route.label && pts.length >= 2) {
      const mx = (pts[0].x + pts[Math.floor(pts.length / 2)].x) / 2;
      const my = (pts[0].y + pts[Math.floor(pts.length / 2)].y) / 2 - 8;
      routesSvg += `<text x="${mx}" y="${my}" text-anchor="middle" fill="white" font-size="9" font-weight="bold" style="text-shadow:0 1px 3px rgba(0,0,0,0.9)">${esc(route.label)}</text>`;
    }
  });

  const camR = Math.max(6, Math.round(Math.min(canvasW, canvasH) * 0.012));
  const labelSize = Math.max(7, Math.round(camR * 0.9));

  let camsSvg = '';
  layerCameras.forEach(cam => {
    const model = catalog.cameras.find(m => m.id === cam.modelId);
    if (!model) return;
    const abs = toAbs(cam.x, cam.y);
    const color = CAMERA_TYPE_COLORS[model.camera_type] ?? '#3b82f6';
    const halfFov = (model.h_fov_deg / 2) * (Math.PI / 180);
    const rotRad = cam.rotationDeg * (Math.PI / 180);
    const fovR = fovRadius(model.ir_range_m);
    camsSvg += `<path d="M ${abs.x} ${abs.y} L ${abs.x + Math.cos(rotRad - halfFov) * fovR} ${abs.y + Math.sin(rotRad - halfFov) * fovR} A ${fovR} ${fovR} 0 ${model.h_fov_deg > 180 ? 1 : 0} 1 ${abs.x + Math.cos(rotRad + halfFov) * fovR} ${abs.y + Math.sin(rotRad + halfFov) * fovR} Z" fill="${color}" opacity="0.15" stroke="${color}" stroke-width="1" stroke-opacity="0.4"/>`;
    camsSvg += `<circle cx="${abs.x}" cy="${abs.y}" r="${camR}" fill="${color}" stroke="white" stroke-width="2"/>`;
    camsSvg += `<text x="${abs.x}" y="${abs.y - camR - 4}" text-anchor="middle" fill="white" font-size="${labelSize}" font-weight="bold" style="text-shadow:0 1px 3px rgba(0,0,0,0.8)">${esc(cam.label || model.name)}</text>`;
  });

  let nvrsSvg = '';
  layerNvrs.forEach(nvr => {
    const abs = toAbs(nvr.x, nvr.y);
    nvrsSvg += `<rect x="${abs.x - 16}" y="${abs.y - 12}" width="32" height="24" rx="4" fill="#1e293b" stroke="#60a5fa" stroke-width="2"/>`;
    nvrsSvg += `<text x="${abs.x}" y="${abs.y + 3}" text-anchor="middle" fill="white" font-size="8" font-weight="bold">NVR</text>`;
  });

  let swSvg = '';
  layerSwitches.forEach(sw => {
    const abs = toAbs(sw.x, sw.y);
    swSvg += `<rect x="${abs.x - 14}" y="${abs.y - 10}" width="28" height="20" rx="3" fill="#1e293b" stroke="#10b981" stroke-width="2"/>`;
    swSvg += `<text x="${abs.x}" y="${abs.y + 3}" text-anchor="middle" fill="#10b981" font-size="7" font-weight="bold">SW</text>`;
  });

  const stats: string[] = [];
  if (layerCameras.length > 0) stats.push(`${layerCameras.length} kamer`);
  if (layerRoutes.length > 0) stats.push(`${layerRoutes.length} tras`);
  if (layerNvrs.length > 0) stats.push(`${layerNvrs.length} NVR`);
  if (layerSwitches.length > 0) stats.push(`${layerSwitches.length} SW`);
  const statsLabel = stats.length > 0 ? stats.join(' \u2022 ') : 'Podklad';

  return `<div style="margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;page-break-after:avoid;break-after:avoid;">
      <div style="width:4px;height:20px;background:#3b82f6;border-radius:2px;"></div>
      <div style="font-size:12px;font-weight:800;color:#0f172a;">${esc(layer.name || `Vrstva ${layerIndex + 1}`)}</div>
      <div style="font-size:10px;color:#64748b;font-weight:600;">${statsLabel}</div>
    </div>
    <div style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.06);page-break-inside:avoid;break-inside:avoid;">
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${displayW}" height="${displayH}" viewBox="0 0 ${canvasW} ${canvasH}" style="display:block;background:#1e293b;">
        ${bg}${routesSvg}${camsSvg}${nvrsSvg}${swSvg}
      </svg>
    </div>
  </div>`;
}

function buildStyles(): string {
  return `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#1e293b; font-size:11px; line-height:1.5; }
    @page { size:A4 portrait; margin:14mm 12mm; }
    .page-break { page-break-before:always; break-before:always; }
    @media print { .page-break { page-break-before:always; break-before:always; } }
    print-color-adjust:exact; -webkit-print-color-adjust:exact;
    .brand-bar { background:linear-gradient(135deg,#0f172a 0%,#1e40af 50%,#3b82f6 100%); height:5px; width:100%; margin-bottom:20px; border-radius:0 0 3px 3px; }
    h1 { font-size:20px; font-weight:800; color:#0f172a; margin-bottom:2px; letter-spacing:-0.3px; }
    h2 { font-size:13px; font-weight:800; color:#0f172a; margin:18px 0 10px; padding-bottom:6px; border-bottom:2px solid #3b82f6; page-break-after:avoid; break-after:avoid; }
    .subtitle { font-size:10px; color:#64748b; margin-bottom:18px; }
    .stat-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr 1fr; gap:8px; margin:12px 0 16px; }
    .stat-card { border-radius:8px; padding:10px 12px; }
    .stat-card.blue { background:#eff6ff; border:1px solid #bfdbfe; }
    .stat-card.green { background:#f0fdf4; border:1px solid #bbf7d0; }
    .stat-card.amber { background:#fffbeb; border:1px solid #fde68a; }
    .stat-card.slate { background:#f8fafc; border:1px solid #e2e8f0; }
    .stat-card.highlight { background:linear-gradient(135deg,#1e40af,#3b82f6); border:none; }
    .stat-label { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
    .stat-card.blue .stat-label { color:#3b82f6; }
    .stat-card.green .stat-label { color:#16a34a; }
    .stat-card.amber .stat-label { color:#d97706; }
    .stat-card.slate .stat-label { color:#64748b; }
    .stat-card.highlight .stat-label { color:rgba(255,255,255,0.7); }
    .stat-value { font-size:16px; font-weight:800; margin-top:2px; }
    .stat-card.blue .stat-value { color:#1e40af; }
    .stat-card.green .stat-value { color:#15803d; }
    .stat-card.amber .stat-value { color:#b45309; }
    .stat-card.slate .stat-value { color:#334155; }
    .stat-card.highlight .stat-value { color:white; }
    table { width:100%; border-collapse:collapse; margin:8px 0; }
    thead th { background:#f8fafc; font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.3px; padding:8px 10px; border-bottom:2px solid #e2e8f0; text-align:left; }
    tbody td { padding:7px 10px; font-size:10px; border-bottom:1px solid #f1f5f9; }
    .text-right { text-align:right; }
    .text-bold { font-weight:700; }
    .cat-row { background:#f1f5f9; page-break-after:avoid; break-after:avoid; }
    .cat-row td { font-weight:800; font-size:10px; color:#334155; padding:8px 10px; border-bottom:2px solid #e2e8f0; }
    .summary-box { background:#0f172a; border-radius:10px; padding:16px 20px; margin:14px 0; color:white; }
    .summary-row { display:flex; justify-content:space-between; padding:5px 0; font-size:10px; }
    .summary-row.muted { color:#94a3b8; }
    .summary-row.total { border-top:2px solid #334155; font-size:13px; font-weight:800; margin-top:6px; padding-top:10px; }
    .summary-row .line-through { text-decoration:line-through; color:#64748b; }
    .vat-row { color:#64748b; font-size:10px; }
    .grand-total { color:#60a5fa; }
    .footer { margin-top:24px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:8px; color:#94a3b8; text-align:right; }
    .layers-section { margin:14px 0; }
    .layer-block { page-break-inside:avoid; break-inside:avoid; margin-bottom:16px; }
  `;
}

const CAT_LABELS: Record<string, string> = {
  cameras: 'Kamery', nvrs: 'NVR z\u00e1znamn\u00edky', switches: 'PoE switche',
  cabling: 'Kabel\u00e1\u017e', storage: '\u00daložiště / HDD', accessories: 'P\u0159\u00edslu\u0161enstv\u00ed',
  labor: 'Mont\u00e1\u017en\u00ed pr\u00e1ce', custom: 'Vlastn\u00ed polo\u017eky',
};

export async function exportCameraQuotePdf(p: ExportParams): Promise<void> {
  const { designData, catalog, quoteConfig, lines, totalBeforeDiscount, totalAfterDiscount, vatRate: vatRateParam, quoteMode, showImages } = p;
  const vatRate = vatRateParam ?? quoteConfig.vatRate ?? 21;
  const storage = calculateStorage(designData.cameras, catalog.cameras, designData.storageConfig);
  const totalPoe = calcTotalPoePowerW(designData.cameras, catalog.cameras);
  const mapLayer = designData.layers.find(l => l.type === 'map' && l.mapCenter);
  const totalCableM = designData.routes.reduce((sum, r) => sum + getRouteLengthM(r.points, designData.scale, mapLayer, designData.layers[r.layerIndex]?.scale), 0);
  const now = new Date().toLocaleDateString('cs-CZ');
  const globalDiscountPct = quoteConfig.globalDiscountPct ?? 0;
  const hddLines = lines.filter(l => l.category === 'storage' && (l.capacityTb ?? 0) > 0);
  const hddTotalTb = hddLines.reduce((sum, l) => sum + l.qty * (l.capacityTb ?? 0), 0);
  const hddLabel = hddLines.length > 0 ? `${hddLines[0].qty}x${hddLines[0].capacityTb}TB` : `${storage.recommendedHddCount}x${storage.recommendedHddSizeTb}TB`;
  const hddDisplayTb = hddTotalTb > 0 ? hddTotalTb : storage.recommendedHddCount * storage.recommendedHddSizeTb;
  const actualRetentionDays = storage.dailyStorageGb > 0 ? Math.floor(hddDisplayTb * 1024 / storage.dailyStorageGb) : 0;

  const layerPreviewsArr = await Promise.all(
    designData.layers
      .filter(l => l.visible !== false)
      .map(layer => {
        const realIdx = designData.layers.indexOf(layer);
        return buildLayerSvg(designData, catalog, realIdx, layer, 680);
      })
  );
  const layerPreviews = layerPreviewsArr.join('');

  const imageDataUrlCache = new Map<string, string>();
  if (showImages) {
    const uniqueUrls = [...new Set(lines.map(l => l.imageUrl).filter((u): u is string => !!u))];
    await Promise.all(uniqueUrls.map(async url => {
      const dataUrl = await fetchProductImageViaProxy(url);
      if (dataUrl) imageDataUrlCache.set(url, dataUrl);
    }));
  }

  const imgCell = (url?: string | null) => {
    if (!showImages) return '';
    const src = url ? (imageDataUrlCache.get(url) ?? url) : null;
    if (src) {
      return `<td style="width:50px;padding:4px;"><img src="${src}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;" /></td>`;
    }
    return `<td style="width:50px;padding:4px;"><div style="width:40px;height:40px;background:#f1f5f9;border-radius:6px;border:1px solid #e2e8f0;"></div></td>`;
  };

  let tableHtml = '';
  if (quoteMode === 'itemized') {
    const grouped = new Map<string, QuoteLine[]>();
    lines.forEach(l => {
      if (!grouped.has(l.category)) grouped.set(l.category, []);
      grouped.get(l.category)!.push(l);
    });
    let rows = '';
    grouped.forEach((items, cat) => {
      const catTotal = items.reduce((s, l) => s + l.discountedTotal, 0);
      const colSpan = showImages ? 5 : 4;
      rows += `<tr class="cat-row"><td colspan="${colSpan}">${esc(CAT_LABELS[cat] ?? cat)}</td><td class="text-right text-bold">${fmtNum(catTotal)} K\u010d</td></tr>`;
      items.forEach(item => {
        rows += `<tr>
          ${imgCell(item.imageUrl)}
          <td style="padding-left:${showImages ? '8px' : '20px'};">${esc(item.name)}</td>
          <td class="text-right">${item.qty}</td>
          <td class="text-right">${item.unit}</td>
          <td class="text-right">${fmtNum(item.unitPrice)} K\u010d</td>
          <td class="text-right text-bold">${fmtNum(item.discountedTotal)} K\u010d</td>
        </tr>`;
      });
    });
    tableHtml = `<table>
      <thead><tr>${showImages ? '<th style="width:50px;"></th>' : ''}<th>Polo\u017eka</th><th class="text-right">Po\u010det</th><th class="text-right">J.</th><th class="text-right">Cena/j.</th><th class="text-right">Celkem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } else {
    const grouped = new Map<string, QuoteLine[]>();
    lines.forEach(l => {
      if (!grouped.has(l.category)) grouped.set(l.category, []);
      grouped.get(l.category)!.push(l);
    });
    let rows = '';
    grouped.forEach((items, cat) => {
      const colSpan = showImages ? 3 : 2;
      rows += `<tr class="cat-row"><td colspan="${colSpan}">${esc(CAT_LABELS[cat] ?? cat)}</td></tr>`;
      items.forEach(item => {
        rows += `<tr>
          ${imgCell(item.imageUrl)}
          <td style="padding-left:${showImages ? '8px' : '20px'};">${esc(item.name)}</td>
          <td class="text-right">${item.qty} ${esc(item.unit)}</td>
        </tr>`;
      });
    });
    tableHtml = `<table>
      <thead><tr>${showImages ? '<th style="width:50px;"></th>' : ''}<th>Polo\u017eka</th><th class="text-right">Mno\u017estv\u00ed</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"><title>Kalkulace - ${esc(p.projectName)}</title>
<style>${buildStyles()}</style></head><body>
<div class="brand-bar"></div>
<h1>Kalkulace kamerov\u00e9ho syst\u00e9mu</h1>
<div class="subtitle">${esc(p.projectName)} &bull; ${now}</div>
${buildQuoteHeaderHtml(p.company ?? null, p.client ?? null, '#3b82f6')}

<div class="stat-grid">
  <div class="stat-card blue"><div class="stat-label">Kamery</div><div class="stat-value">${designData.cameras.length}</div></div>
  <div class="stat-card green"><div class="stat-label">Kabel\u00e1\u017e</div><div class="stat-value">${fmtNum(Math.round(totalCableM))} m</div></div>
  <div class="stat-card amber"><div class="stat-label">PoE p\u0159\u00edkon</div><div class="stat-value">${fmtNum(Math.round(totalPoe))} W</div></div>
  <div class="stat-card slate"><div class="stat-label">\u00daložiště</div><div class="stat-value">${hddDisplayTb}TB</div><div style="font-size:9px;font-weight:700;color:#64748b;margin-top:2px;">${hddLabel}</div></div>
  <div class="stat-card highlight"><div class="stat-label">Celkem</div><div class="stat-value">${fmtNum(totalAfterDiscount)} K\u010d</div></div>
</div>

<h2>N\u00e1vrh syst\u00e9mu &ndash; vrstvy</h2>
<div class="layers-section">
  ${layerPreviews || '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:10px;">\u017d\u00e1dn\u00e9 vrstvy</div>'}
</div>

<div class="page-break"></div>
<h2>${quoteMode === 'itemized' ? 'Polo\u017ekov\u00e1 cenov\u00e1 nab\u00eddka' : 'Cenov\u00e1 nab\u00eddka'}</h2>
${tableHtml}

<div class="summary-box">
  ${totalBeforeDiscount !== totalAfterDiscount
    ? `<div class="summary-row muted"><span>P\u0159ed slevou</span><span class="line-through">${fmtNum(totalBeforeDiscount)} K\u010d</span></div>`
    : ''
  }
  ${globalDiscountPct > 0
    ? `<div class="summary-row muted"><span>Glob\u00e1ln\u00ed sleva</span><span>-${globalDiscountPct}%</span></div>`
    : ''
  }
  <div class="summary-row"><span>Celkem bez DPH</span><span style="font-weight:800;font-size:14px;">${fmtNum(totalAfterDiscount)} K\u010d</span></div>
  <div class="summary-row vat-row"><span>DPH ${vatRate}\u00a0%</span><span>${fmtNum(totalAfterDiscount * (vatRate / 100))} K\u010d</span></div>
  <div class="summary-row total"><span>Celkem s DPH</span><span class="grand-total">${fmtNum(totalAfterDiscount * (1 + vatRate / 100))} K\u010d</span></div>
</div>

<h2>Technick\u00e9 parametry</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
  <div style="color:#64748b;font-weight:600;">Kodek nahr\u00e1v\u00e1n\u00ed</div><div style="font-weight:700;">${designData.storageConfig.codec.toUpperCase()}</div>
  <div style="color:#64748b;font-weight:600;">Doba nahr\u00e1v\u00e1n\u00ed</div><div style="font-weight:700;">${designData.storageConfig.recordingHoursPerDay}h / den</div>
  <div style="color:#64748b;font-weight:600;">Detekce pohybu</div><div style="font-weight:700;">${designData.storageConfig.motionOnlyPct}%</div>
  <div style="color:#64748b;font-weight:600;">Denn\u00ed objem dat</div><div style="font-weight:700;">${storage.dailyStorageGb.toFixed(1)} GB</div>
  <div style="color:#64748b;font-weight:600;">Celkov\u00e9 \u00falo\u017ei\u0161t\u011b</div><div style="font-weight:700;color:#1e40af;">${storage.totalStorageTb.toFixed(1)} TB</div>
  <div style="color:#64748b;font-weight:600;">Navr\u017een\u00fd HDD</div><div style="font-weight:700;color:#1e40af;">${hddLabel} (${hddDisplayTb} TB celkem)</div>
  <div style="color:#64748b;font-weight:600;">V\u00fdr\u017e z\u00e1znamu</div><div style="font-weight:800;color:#16a34a;">${actualRetentionDays} dn\u00ed</div>
  <div style="color:#64748b;font-weight:600;">Celkov\u00fd PoE p\u0159\u00edkon</div><div style="font-weight:700;">${fmtNum(Math.round(totalPoe))} W</div>
  <div style="color:#64748b;font-weight:600;">Celkov\u00e1 d\u00e9lka kabelu</div><div style="font-weight:700;">${fmtNum(Math.round(totalCableM))} m</div>
</div>

<div class="footer">HouseSmart &ndash; Kamerov\u00fd syst\u00e9m &bull; Vygenerov\u00e1no: ${now}</div>
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
    html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `kalkulace-kamerovy-system-${p.projectName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 794, imageTimeout: 30000, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.layer-block', 'svg'] },
      })
      .from(container)
      .save()
      .then(() => {
        document.body.removeChild(wrapper);
      });
  }, 300);
}
