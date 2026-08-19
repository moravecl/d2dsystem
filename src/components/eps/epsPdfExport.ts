import html2pdf from 'html2pdf.js';
import type { EpsDesignData } from '../../hooks/useEpsDesign';
import type { EpsCatalogData } from '../../hooks/useEpsCatalog';
import { calcTotalPrice, calcCableLengthM, calcZoneUtilization } from '../../lib/epsCalculations';
import { renderAllLayerImages } from './epsLayerRender';
import type { LayerLegendItem } from './epsLayerRender';

interface ExportParams {
  projectName: string;
  designData: EpsDesignData;
  catalog: EpsCatalogData;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('cs-CZ');
}

const DETECTOR_TYPE_LABELS: Record<string, string> = {
  smoke: 'Detektor kou\u0159e', heat: 'Tepeln\u00fd detektor', smoke_heat: 'Kombinovan\u00fd detektor',
  linear: 'Line\u00e1rn\u00ed detektor', manual_call_point: 'Tla\u010d\u00edtkov\u00e9 hla\u0161i\u010d', gas: 'Plynov\u00fd detektor',
  co: 'CO detektor', flame: 'Plamenov\u00fd detektor',
};

const DETECTOR_TYPE_COLORS: Record<string, string> = {
  smoke: '#3b82f6', heat: '#ef4444', smoke_heat: '#10b981',
  linear: '#8b5cf6', manual_call_point: '#f59e0b', gas: '#ec4899',
  co: '#06b6d4', flame: '#f97316',
};

const MOTION_SENSOR_TYPE_LABELS: Record<string, string> = {
  pir: 'PIR', pir_camera: 'PIR s kamerou', dual_tech: 'Dual tech (PIR+MW)',
  curtain: 'Z\u00e1vora', outdoor: 'Venkovn\u00ed', pet_immune: 'Pet imunni',
};

export async function exportEpsPdf({ projectName, designData, catalog }: ExportParams) {
  const prices = calcTotalPrice(designData, catalog.detectors, catalog.panels, catalog.sirens, catalog.cables, catalog.accessories, catalog.motionSensors, catalog.keypads, catalog.controlDevices);
  const cableLen = calcCableLengthM(designData);
  const zoneUtil = calcZoneUtilization(designData, catalog.panels);
  const layerImages = await renderAllLayerImages(designData, catalog);

  const motionSensors = designData.motionSensors ?? [];
  const keypads = designData.keypads ?? [];

  const detectorRows = designData.detectors.map(d => {
    const model = catalog.detectors.find(m => m.id === d.modelId);
    return model ? `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${DETECTOR_TYPE_COLORS[model.detector_type] ?? '#3b82f6'};margin-right:6px;"></span>
        ${esc(model.model_number)}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${DETECTOR_TYPE_LABELS[model.detector_type] ?? model.detector_type}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${model.connection_type === 'wireless' ? 'Bezdr.' : 'Bus'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:center;">${model.detection_range_m} m</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${esc(d.label || '-')}</td>
    </tr>` : '';
  }).join('');

  const motionSensorRows = motionSensors.map(s => {
    const model = catalog.motionSensors.find(m => m.id === s.sensorId);
    return model ? `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#06b6d4;margin-right:6px;"></span>
        ${esc(model.model_number)}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${MOTION_SENSOR_TYPE_LABELS[model.sensor_type] ?? model.sensor_type}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${model.connection_type === 'wireless' ? 'Bezdr.' : 'Bus'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:center;">${model.detection_range_m} m</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${esc(s.label || '-')}</td>
    </tr>` : '';
  }).join('');

  const zoneRows = designData.zones.map(z =>
    `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${z.color};margin-right:6px;"></span>
        ${esc(z.name)}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:center;">${z.detectorIds.length}</td>
    </tr>`
  ).join('');

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;padding:30px;color:#1e293b;">
      <h1 style="font-size:20px;font-weight:800;margin:0 0 4px;">N&#225;vrh EPS / EZS syst&#233;mu</h1>
      <p style="font-size:12px;color:#64748b;margin:0 0 20px;">${esc(projectName)} · ${new Date().toLocaleDateString('cs-CZ')}</p>

      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#3b82f6;">${designData.detectors.length}</div>
          <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Detektor&#367;</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#06b6d4;">${motionSensors.length}</div>
          <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Pohyb. &#269;idel</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#10b981;">${keypads.length}</div>
          <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Kl&#225;vesnic</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#6366f1;">${designData.panels.length}</div>
          <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">&#218;st&#345;edny</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#f97316;">${designData.sirens.length}</div>
          <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Sir&#233;n</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#f59e0b;">${fmtNum(cableLen)}</div>
          <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Kabelá&#382; (m)</div>
        </div>
      </div>

      <h2 style="font-size:13px;font-weight:800;margin:0 0 8px;">Specifikace detektor&#367;</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <thead><tr style="background:#1e293b;color:#fff;">
          <th style="padding:6px 8px;font-size:9px;text-align:left;">MODEL</th>
          <th style="padding:6px 8px;font-size:9px;text-align:left;">TYP</th>
          <th style="padding:6px 8px;font-size:9px;text-align:left;">P&#344;IPOJENÍ</th>
          <th style="padding:6px 8px;font-size:9px;text-align:center;">DOSAH</th>
          <th style="padding:6px 8px;font-size:9px;text-align:left;">OZNA&#268;ENÍ</th>
        </tr></thead>
        <tbody>${detectorRows}</tbody>
      </table>

      ${motionSensors.length > 0 ? `
        <h2 style="font-size:13px;font-weight:800;margin:0 0 8px;">Pohybov&#225; &#269;idla</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <thead><tr style="background:#1e293b;color:#fff;">
            <th style="padding:6px 8px;font-size:9px;text-align:left;">MODEL</th>
            <th style="padding:6px 8px;font-size:9px;text-align:left;">TYP</th>
            <th style="padding:6px 8px;font-size:9px;text-align:left;">P&#344;IPOJENÍ</th>
            <th style="padding:6px 8px;font-size:9px;text-align:center;">DOSAH</th>
            <th style="padding:6px 8px;font-size:9px;text-align:left;">OZNA&#268;ENÍ</th>
          </tr></thead>
          <tbody>${motionSensorRows}</tbody>
        </table>
      ` : ''}

      ${designData.zones.length > 0 ? `
        <h2 style="font-size:13px;font-weight:800;margin:0 0 8px;">Z&#243;ny</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <thead><tr style="background:#1e293b;color:#fff;">
            <th style="padding:6px 8px;font-size:9px;text-align:left;">Z&#211;NA</th>
            <th style="padding:6px 8px;font-size:9px;text-align:center;">DETEKTOR&#366;</th>
          </tr></thead>
          <tbody>${zoneRows}</tbody>
        </table>
      ` : ''}

      <h2 style="font-size:13px;font-weight:800;margin:0 0 8px;">Kapacita &#250;st&#345;edny</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;">${zoneUtil.totalDetectors} / ${zoneUtil.maxZones} z&#243;n (${zoneUtil.utilization}%)</div>
        <div style="height:6px;background:#e2e8f0;border-radius:3px;margin-top:6px;overflow:hidden;">
          <div style="height:100%;background:${zoneUtil.utilization > 90 ? '#ef4444' : zoneUtil.utilization > 70 ? '#f59e0b' : '#10b981'};width:${Math.min(100, zoneUtil.utilization)}%;border-radius:3px;"></div>
        </div>
      </div>

      ${layerImages.length > 0 ? layerImages.map(img => `
        <div style="page-break-before:always;padding-top:20px;">
          <h2 style="font-size:13px;font-weight:800;margin:0 0 8px;">Grafick&#253; n&#225;vrh syst&#233;mu</h2>
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
                  <span style="display:inline-block;width:12px;height:12px;border-radius:${item.shape === 'circle' ? '50%' : item.shape === 'line' ? '0' : '2px'};background:${item.shape === 'line' ? 'transparent' : item.color};border:${item.shape === 'line' ? 'none' : '1px solid rgba(0,0,0,0.15)'};${item.shape === 'line' ? `border-top:2px solid ${item.color};height:0;margin-top:6px;` : ''};${item.shape === 'diamond' ? `transform:rotate(45deg);` : ''}"></span>
                  <span style="font-size:9px;color:#334155;">${esc(item.label)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      `).join('') : ''}

      <div style="text-align:right;padding-top:16px;border-top:1px solid #e2e8f0;">
        <div style="font-size:10px;color:#64748b;">Celkov&#225; cena:</div>
        <div style="font-size:22px;font-weight:800;color:#dc2626;">${fmtNum(prices.totalCost)} Kc</div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  await html2pdf()
    .set({
      margin: 8,
      filename: `eps-navrh-${projectName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}
