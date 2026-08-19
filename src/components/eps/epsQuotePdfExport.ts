import html2pdf from 'html2pdf.js';
import type { EpsDesignData, EpsQuoteConfig } from '../../hooks/useEpsDesign';
import type { EpsCatalogData } from '../../hooks/useEpsCatalog';
import { calcTotalPrice, calcCableLengthM } from '../../lib/epsCalculations';
import { polylineLength, normalizedToMeters } from '../catalog/floorplan/geometry';
import { buildQuoteHeaderHtml, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';
import { renderAllLayerImages } from './epsLayerRender';
import type { LayerLegendItem } from './epsLayerRender';

interface ExportParams {
  projectName: string;
  designData: EpsDesignData;
  catalog: EpsCatalogData;
  quoteConfig: EpsQuoteConfig;
  client?: QuoteClientInfo | null;
  company?: QuoteCompanyInfo | null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('cs-CZ');
}

export async function exportEpsQuotePdf({ projectName, designData, catalog, quoteConfig, client, company }: ExportParams) {
  const priceOverrides = quoteConfig.priceOverrides ?? {};
  const prices = calcTotalPrice(designData, catalog.detectors, catalog.panels, catalog.sirens, catalog.cables, catalog.accessories, catalog.motionSensors, catalog.keypads, catalog.controlDevices, priceOverrides);
  const cableLen = calcCableLengthM(designData);
  const layerImages = await renderAllLayerImages(designData, catalog);
  const globalDiscount = quoteConfig.globalDiscountPct ?? 0;
  const vatPct = quoteConfig.vatPct ?? 21;
  const laborCost = quoteConfig.laborSellPrice ?? quoteConfig.laborCost ?? 0;
  const laborDescription = quoteConfig.laborDescription ?? '';
  const customItems = quoteConfig.customItems ?? [];
  const customItemsTotal = customItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const subtotal = prices.totalCost + customItemsTotal + laborCost;
  const discountAmount = Math.round(subtotal * (globalDiscount / 100));
  const priceBeforeVat = subtotal - discountAmount;
  const vatAmount = Math.round(priceBeforeVat * (vatPct / 100));
  const grandTotal = priceBeforeVat + vatAmount;

  const motionSensors = designData.motionSensors ?? [];
  const keypads = designData.keypads ?? [];
  const controlDevices = designData.controlDevices ?? [];

  const detectorGroups = new Map<string, { name: string; model: string; count: number; price: number }>();
  for (const d of designData.detectors) {
    const existing = detectorGroups.get(d.modelId);
    if (existing) existing.count++;
    else {
      const model = catalog.detectors.find(m => m.id === d.modelId);
      if (model) detectorGroups.set(d.modelId, { name: model.name, model: model.model_number, count: 1, price: priceOverrides[model.id] ?? model.price });
    }
  }

  const panelGroups = new Map<string, { name: string; model: string; count: number; price: number }>();
  for (const p of designData.panels) {
    const existing = panelGroups.get(p.panelId);
    if (existing) existing.count++;
    else {
      const model = catalog.panels.find(m => m.id === p.panelId);
      if (model) panelGroups.set(p.panelId, { name: model.name, model: model.model_number, count: 1, price: priceOverrides[model.id] ?? model.price });
    }
  }

  const sirenGroups = new Map<string, { name: string; model: string; count: number; price: number }>();
  for (const s of designData.sirens) {
    const existing = sirenGroups.get(s.sirenId);
    if (existing) existing.count++;
    else {
      const model = catalog.sirens.find(m => m.id === s.sirenId);
      if (model) sirenGroups.set(s.sirenId, { name: model.name, model: model.model_number, count: 1, price: priceOverrides[model.id] ?? model.price });
    }
  }

  const motionSensorGroups = new Map<string, { name: string; model: string; count: number; price: number }>();
  for (const s of motionSensors) {
    const existing = motionSensorGroups.get(s.sensorId);
    if (existing) existing.count++;
    else {
      const model = catalog.motionSensors.find(m => m.id === s.sensorId);
      if (model) motionSensorGroups.set(s.sensorId, { name: model.name, model: model.model_number, count: 1, price: priceOverrides[model.id] ?? model.price });
    }
  }

  const keypadGroups = new Map<string, { name: string; model: string; count: number; price: number }>();
  for (const k of keypads) {
    const existing = keypadGroups.get(k.keypadId);
    if (existing) existing.count++;
    else {
      const model = catalog.keypads.find(m => m.id === k.keypadId);
      if (model) keypadGroups.set(k.keypadId, { name: model.name, model: model.model_number, count: 1, price: priceOverrides[model.id] ?? model.price });
    }
  }

  const controlDeviceGroups = new Map<string, { name: string; model: string; count: number; price: number }>();
  for (const cd of controlDevices) {
    const existing = controlDeviceGroups.get(cd.deviceId);
    if (existing) existing.count++;
    else {
      const model = catalog.controlDevices.find(m => m.id === cd.deviceId);
      if (model) controlDeviceGroups.set(cd.deviceId, { name: model.name, model: model.model_number, count: 1, price: priceOverrides[model.id] ?? model.price });
    }
  }

  const cableRows = designData.routes.map(route => {
    const cable = catalog.cables.find(c => c.id === route.cableTypeId);
    if (!cable || route.points.length < 2) return null;
    const normLen = polylineLength(route.points);
    const effectiveScale = designData.layers[route.layerIndex]?.scale ?? designData.scale;
    const meters = effectiveScale ? Math.round(normalizedToMeters(normLen, effectiveScale) * 10) / 10 : Math.round(normLen * 100) / 10;
    return { name: cable.name, length: meters, pricePerM: priceOverrides[cable.id] ?? cable.price_per_m };
  }).filter(Boolean);

  const makeRow = (name: string, qty: string, unit: string, unitPrice: number, total: number) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;">${esc(name)}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;">${qty} ${unit}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;">${fmtNum(unitPrice)} Kc</td>
     <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;font-weight:700;">${fmtNum(total)} Kc</td></tr>`;

  let tableRows = '';
  const sectionHeader = (title: string) =>
    `<tr><td colspan="4" style="padding:8px 10px;background:#f8fafc;font-weight:800;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0;">${esc(title)}</td></tr>`;

  tableRows += sectionHeader('Detektory');
  for (const [, g] of detectorGroups) {
    tableRows += makeRow(`${g.model} \u2014 ${g.name}`, String(g.count), 'ks', g.price, g.count * g.price);
  }

  tableRows += sectionHeader('\u00DAst\u0159edny');
  for (const [, g] of panelGroups) {
    tableRows += makeRow(`${g.model} \u2014 ${g.name}`, String(g.count), 'ks', g.price, g.count * g.price);
  }

  tableRows += sectionHeader('Sir\u00e9ny');
  for (const [, g] of sirenGroups) {
    tableRows += makeRow(`${g.model} \u2014 ${g.name}`, String(g.count), 'ks', g.price, g.count * g.price);
  }

  if (motionSensorGroups.size > 0) {
    tableRows += sectionHeader('Pohybov\u00e1 \u010didla');
    for (const [, g] of motionSensorGroups) {
      tableRows += makeRow(`${g.model} \u2014 ${g.name}`, String(g.count), 'ks', g.price, g.count * g.price);
    }
  }

  if (keypadGroups.size > 0) {
    tableRows += sectionHeader('Kl\u00e1vesnice');
    for (const [, g] of keypadGroups) {
      tableRows += makeRow(`${g.model} \u2014 ${g.name}`, String(g.count), 'ks', g.price, g.count * g.price);
    }
  }

  if (controlDeviceGroups.size > 0) {
    tableRows += sectionHeader('Ovl\u00e1dac\u00ed prvky');
    for (const [, g] of controlDeviceGroups) {
      tableRows += makeRow(`${g.model} \u2014 ${g.name}`, String(g.count), 'ks', g.price, g.count * g.price);
    }
  }

  if (cableRows.length > 0) {
    tableRows += sectionHeader('Kabel\u00e1\u017e');
    for (const r of cableRows) {
      if (!r) continue;
      tableRows += makeRow(r.name, String(r.length), 'm', r.pricePerM, Math.round(r.length * r.pricePerM));
    }
  }

  if (designData.accessoryItems.length > 0) {
    tableRows += sectionHeader('P\u0159\u00edslu\u0161enstv\u00ed');
    for (const item of designData.accessoryItems) {
      const acc = catalog.accessories.find(a => a.id === item.accessoryId);
      if (!acc || item.quantity <= 0) continue;
      tableRows += makeRow(acc.name, String(item.quantity), 'ks', priceOverrides[acc.id] ?? acc.price, item.quantity * (priceOverrides[acc.id] ?? acc.price));
    }
  }

  if (laborCost > 0) {
    tableRows += sectionHeader('Pr\u00e1ce a mont\u00e1\u017e');
    tableRows += makeRow(laborDescription || 'Mont\u00e1\u017e a zprovozn\u011bn\u00ed', '1', 'pau\u0161\u00e1l', laborCost, laborCost);
  }

  if (customItems.length > 0) {
    tableRows += sectionHeader('Vlastn\u00ed polo\u017eky');
    for (const item of customItems) {
      if (item.qty <= 0) continue;
      tableRows += makeRow(item.name || 'Polo\u017eka', String(item.qty), item.unit, item.unitPrice, item.qty * item.unitPrice);
    }
  }

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;padding:30px;color:#1e293b;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        <div>
          <h1 style="font-size:20px;font-weight:800;margin:0;">Cenov\u00e1 nab\u00eddka EPS / EZS</h1>
          <p style="font-size:12px;color:#64748b;margin:4px 0 0;">${esc(projectName)} · ${new Date().toLocaleDateString('cs-CZ')}</p>
        </div>
      </div>
      ${buildQuoteHeaderHtml(company ?? null, client ?? null, '#dc2626')}
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1e293b;color:#fff;">
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;">POLO&#381;KA</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;">MNO&#381;STVI</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;">JED. CENA</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;">CELKEM</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div style="margin-top:20px;text-align:right;">
        <div style="font-size:11px;color:#64748b;">Mezisou\u010det: ${fmtNum(subtotal)} K\u010d</div>
        ${globalDiscount > 0 ? `<div style="font-size:11px;color:#10b981;">Sleva ${globalDiscount}%: -${fmtNum(discountAmount)} K\u010d</div>` : ''}
        <div style="font-size:13px;font-weight:700;margin-top:6px;color:#1e293b;">Cena bez DPH: ${fmtNum(priceBeforeVat)} K\u010d</div>
        <div style="font-size:11px;color:#64748b;">DPH ${vatPct}%: +${fmtNum(vatAmount)} K\u010d</div>
        <div style="font-size:22px;font-weight:800;margin-top:8px;color:#dc2626;">${fmtNum(grandTotal)} K\u010d v\u010detn\u011b DPH</div>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;">
        Souhrn: ${designData.detectors.length} detektor\u016f \u00b7 ${motionSensors.length} pohyb. \u010didel \u00b7 ${keypads.length} kl\u00e1vesnic \u00b7 ${designData.panels.length} \u00fast\u0159edna \u00b7 ${designData.sirens.length} sir\u00e9n \u00b7 ${fmtNum(cableLen)} m kabel\u00e1\u017ee
      </div>

      ${layerImages.length > 0 ? layerImages.map(img => `
        <div style="page-break-before:always;padding-top:20px;">
          <h2 style="font-size:13px;font-weight:800;margin:0 0 8px;">Grafick\u00fd n\u00e1vrh syst\u00e9mu</h2>
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="padding:6px 10px;background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;">${esc(img.name)}</div>
            <img src="${img.dataUrl}" style="width:100%;display:block;" />
          </div>
          ${img.legend.length > 0 ? `
          <div style="margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.05em;">Legenda</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px 16px;">
              ${img.legend.map((item: LayerLegendItem) => `
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="display:inline-block;width:12px;height:12px;border-radius:${item.shape === 'circle' ? '50%' : item.shape === 'line' ? '0' : '2px'};background:${item.shape === 'line' ? 'transparent' : item.color};border:${item.shape === 'line' ? 'none' : '1px solid rgba(0,0,0,0.15)'};${item.shape === 'line' ? `border-top:2px solid ${item.color};height:0;margin-top:6px;` : ''}${item.shape === 'diamond' ? 'transform:rotate(45deg);' : ''}"></span>
                  <span style="font-size:9px;color:#334155;">${esc(item.label)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      `).join('') : ''}
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  await html2pdf()
    .set({
      margin: 8,
      filename: `eps-nabidka-${projectName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}
