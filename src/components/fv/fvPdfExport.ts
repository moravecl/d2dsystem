import html2pdf from 'html2pdf.js';
import type { FvCalculationResult, FvInputParams, RoofSurface } from '../../lib/fvCalculations';
import { calculatePayback } from '../../lib/fvCalculations';
import type { FvSystemConfig } from '../../hooks/useFvDesign';
import type { FvCatalogData } from '../../hooks/useFvCatalog';
import { buildQuoteHeaderHtml, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';
import {
  buildFvQuoteLineItems,
  applyDiscountsToLineItems,
  computeFvQuoteTotals,
} from '../../lib/fvQuoteLineItems';

export interface PdfSectionFlags {
  summary?: boolean;
  roofs?: boolean;
  construction?: boolean;
  charts?: boolean;
  energyTable?: boolean;
  system?: boolean;
  price?: boolean;
}

export const PDF_SECTION_DEFAULTS: PdfSectionFlags = {
  summary: true,
  roofs: true,
  construction: true,
  charts: true,
  energyTable: true,
  system: true,
  price: true,
};

interface ExportParams {
  projectName: string;
  result: FvCalculationResult;
  inputParams: FvInputParams;
  roofs: RoofSurface[];
  systemConfig: FvSystemConfig;
  catalog: FvCatalogData;
  roofCanvasDataUrls: string[];
  totalInvestmentCzk: number;
  subsidyCzk: number;
  sections?: PdfSectionFlags;
  client?: QuoteClientInfo | null;
  company?: QuoteCompanyInfo | null;
  itemDiscounts?: Record<string, number>;
  globalDiscountPct?: number;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('cs-CZ');
}

const MONTH_LABELS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const MONTH_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

function buildStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, .pdf-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; word-spacing: normal; letter-spacing: normal; }
    .brand-bar { background: linear-gradient(135deg, #ea580c, #f97316); height: 6px; width: 100%; margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; word-spacing: 0.15em; }
    h2 { font-size: 14px; font-weight: 800; color: #0f172a; margin: 16px 0 10px; border-bottom: 2px solid #f97316; padding-bottom: 5px; }
    h3 { font-size: 12px; font-weight: 700; color: #334155; margin: 12px 0 6px; }
    .subtitle { font-size: 11px; color: #64748b; margin-bottom: 16px; }
    .section { page-break-inside: avoid; margin-bottom: 16px; }
    .page-break { page-break-before: always; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .stat-card.orange { background: #fff7ed; border-color: #fed7aa; }
    .stat-card.green { background: #f0fdf4; border-color: #bbf7d0; }
    .stat-card.blue { background: #eff6ff; border-color: #bfdbfe; }
    .stat-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 16px; font-weight: 800; margin-top: 2px; }
    .stat-sub { font-size: 8px; color: #94a3b8; margin-top: 1px; }
    .orange .stat-value { color: #ea580c; }
    .green .stat-value { color: #16a34a; }
    .blue .stat-value { color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 5px 6px; text-align: left; font-size: 9px; }
    th { background: #f1f5f9; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .text-bold { font-weight: 700; }
    .text-orange { color: #ea580c; }
    .text-green { color: #16a34a; }
    .text-blue { color: #2563eb; }
    .text-muted { color: #94a3b8; }
    .bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 100px; margin: 8px 0; }
    .bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; height: 100%; justify-content: flex-end; }
    .bar { width: 100%; border-radius: 2px 2px 0 0; min-width: 3px; }
    .bar.production { background: #f97316; }
    .bar.consumption { background: #cbd5e1; }
    .bar-label { font-size: 6px; font-weight: 700; color: #94a3b8; text-align: center; }
    .legend { display: flex; gap: 14px; justify-content: center; margin-top: 5px; }
    .legend-item { display: flex; align-items: center; gap: 3px; font-size: 8px; font-weight: 600; color: #64748b; }
    .legend-dot { width: 8px; height: 6px; border-radius: 2px; }
    .coverage-bar { display: flex; height: 18px; border-radius: 9px; overflow: hidden; margin: 6px 0; }
    .coverage-self { background: #f97316; }
    .coverage-grid { background: #e2e8f0; }
    .coverage-label { font-size: 7px; font-weight: 700; color: white; display: flex; align-items: center; justify-content: center; }
    .roof-image { max-width: 100%; max-height: 220px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 6px 0; }
    .price-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 9px; }
    .price-row.total { border-top: 2px solid #e2e8f0; border-bottom: none; font-size: 11px; font-weight: 800; margin-top: 4px; padding-top: 6px; }
    .price-row.subsidy { color: #16a34a; }
    .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 7px; color: #94a3b8; text-align: right; }
    .section-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin: 8px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 9px; }
    .info-label { color: #64748b; font-weight: 600; }
    .info-value { color: #1e293b; font-weight: 700; }
  `;
}

function buildSummarySection(p: ExportParams): string {
  const { result } = p;
  const payback = p.totalInvestmentCzk > 0 && result.totalAnnualBenefitCzk > 0
    ? calculatePayback(p.totalInvestmentCzk, result.totalAnnualBenefitCzk)
    : null;

  return `
    <div class="section">
      <div class="stat-grid">
        <div class="stat-card orange">
          <div class="stat-label">Instalovaný výkon</div>
          <div class="stat-value">${result.totalPowerKwp} kWp</div>
          <div class="stat-sub">${p.roofs.reduce((s, r) => s + r.panelCount, 0)} panelů</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-label">Roční výroba</div>
          <div class="stat-value">${fmtNum(result.annualProductionKwh)} kWh</div>
          <div class="stat-sub">${fmtNum(Math.round(result.annualProductionKwh / (result.totalPowerKwp || 1)))} kWh/kWp</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Pokrytí spotřeby</div>
          <div class="stat-value">${result.coveragePct} %</div>
          <div class="stat-sub">${fmtNum(result.selfConsumptionKwh)} kWh vlastní</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">Roční úspory</div>
          <div class="stat-value">${fmtNum(result.annualSavingsCzk)} Kč</div>
          <div class="stat-sub">${result.annualFeedInRevenueCzk > 0 ? `+${fmtNum(result.annualFeedInRevenueCzk)} Kč přetoky` : ''}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Úspora CO2</div>
          <div class="stat-value">${fmtNum(result.co2SavedKg)} kg</div>
          <div class="stat-sub">za rok</div>
        </div>
        ${payback ? `
          <div class="stat-card">
            <div class="stat-label">Návratnost</div>
            <div class="stat-value">${payback.years < 99 ? `${payback.years} let` : '> 30 let'}</div>
            <div class="stat-sub">${p.totalInvestmentCzk > 0 ? `Investice ${fmtNum(p.totalInvestmentCzk)} Kč` : ''}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function buildChartSection(p: ExportParams): string {
  const maxVal = Math.max(...p.result.monthly.flatMap(m => [m.productionKwh, m.consumptionKwh]), 1);
  const maxRounded = Math.ceil(maxVal / 100) * 100;

  const bars = p.result.monthly.map((m, i) => {
    const prodH = Math.round((m.productionKwh / maxRounded) * 100);
    const consH = Math.round((m.consumptionKwh / maxRounded) * 100);
    return `
      <div class="bar-group">
        <div class="bar production" style="height: ${prodH}%"></div>
        <div class="bar consumption" style="height: ${consH}%"></div>
        <div class="bar-label">${MONTH_SHORT[i]}</div>
      </div>
    `;
  }).join('');

  const selfPct = p.result.coveragePct;
  const gridPct = 100 - selfPct;

  const chartTableRows = p.result.monthly.map((m, i) => `
    <tr>
      <td>${MONTH_SHORT[i]}</td>
      <td class="text-right text-orange">${fmtNum(m.productionKwh)}</td>
      <td class="text-right text-muted">${fmtNum(m.consumptionKwh)}</td>
      <td class="text-right text-green">${fmtNum(m.selfConsumptionKwh)}</td>
    </tr>
  `).join('');

  return `
    <div class="section">
      <h2>Měsíční bilance</h2>
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="flex:1;">
          <div style="position:relative;padding-left:28px;">
            <div style="position:absolute;left:0;top:0;height:100px;display:flex;flex-direction:column;justify-content:space-between;font-size:6px;color:#94a3b8;text-align:right;width:26px;">
              <span>${fmtNum(maxRounded)} kWh</span>
              <span>${fmtNum(Math.round(maxRounded / 2))} kWh</span>
              <span>0 kWh</span>
            </div>
            <div class="bar-chart">${bars}</div>
          </div>
          <div class="legend">
            <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div> Výroba FV (kWh)</div>
            <div class="legend-item"><div class="legend-dot" style="background:#cbd5e1"></div> Spotřeba (kWh)</div>
          </div>
        </div>
        <div style="width:140px;flex-shrink:0;">
          <table style="width:100%;margin:0;">
            <thead>
              <tr>
                <th style="font-size:7px;padding:2px 3px;">Měsíc</th>
                <th style="font-size:7px;padding:2px 3px;text-align:right;">Výroba</th>
                <th style="font-size:7px;padding:2px 3px;text-align:right;">Spotř.</th>
                <th style="font-size:7px;padding:2px 3px;text-align:right;">Vlastní</th>
              </tr>
            </thead>
            <tbody>${chartTableRows}</tbody>
            <tfoot>
              <tr class="text-bold">
                <td style="font-size:7px;padding:2px 3px;">Rok</td>
                <td style="font-size:7px;padding:2px 3px;text-align:right;" class="text-orange">${fmtNum(p.result.annualProductionKwh)}</td>
                <td style="font-size:7px;padding:2px 3px;text-align:right;">${fmtNum(p.result.annualConsumptionKwh)}</td>
                <td style="font-size:7px;padding:2px 3px;text-align:right;" class="text-green">${fmtNum(p.result.selfConsumptionKwh)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <h3>Pokrytí spotřeby</h3>
      <div class="coverage-bar">
        <div class="coverage-self coverage-label" style="width:${selfPct}%">${selfPct > 12 ? `${selfPct}% FV` : ''}</div>
        <div class="coverage-grid coverage-label" style="width:${gridPct}%; color: #64748b">${gridPct > 12 ? `${gridPct}% síť` : ''}</div>
      </div>
    </div>
  `;
}

function buildEnergyTable(p: ExportParams): string {
  const hasBattery = p.result.batteryContributionKwh !== undefined && p.result.batteryContributionKwh > 0;

  const totalDirectSelf = p.result.monthly.reduce((s, m) => s + (m.directSelfConsumptionKwh ?? 0), 0);
  const totalBatteryContrib = p.result.monthly.reduce((s, m) => s + (m.batteryContributionKwh ?? 0), 0);

  const rows = p.result.monthly.map((m, i) => `
    <tr>
      <td>${MONTH_LABELS[i]}</td>
      <td class="text-right text-orange">${fmtNum(m.productionKwh)}</td>
      <td class="text-right">${fmtNum(m.consumptionKwh)}</td>
      <td class="text-right" style="color:#059669;">${fmtNum(m.directSelfConsumptionKwh ?? 0)}</td>
      ${hasBattery ? `<td class="text-right" style="color:#8b5cf6;">${fmtNum(m.batteryContributionKwh ?? 0)}</td>` : ''}
      <td class="text-right text-green">${fmtNum(m.selfConsumptionKwh)}</td>
      <td class="text-right text-blue">${fmtNum(m.gridFeedKwh)}</td>
      <td class="text-right text-muted">${fmtNum(m.gridDrawKwh)}</td>
    </tr>
  `).join('');

  const r = p.result;
  return `
    <div class="section">
      <h2>Energetická bilance</h2>
      <table>
        <thead>
          <tr>
            <th>Měsíc</th>
            <th class="text-right">Výroba (kWh)</th>
            <th class="text-right">Spotřeba (kWh)</th>
            <th class="text-right">Přímá spotř. (kWh)</th>
            ${hasBattery ? '<th class="text-right">Z baterie (kWh)</th>' : ''}
            <th class="text-right">Vlastní (kWh)</th>
            <th class="text-right">Přetoky (kWh)</th>
            <th class="text-right">Ze sítě (kWh)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="text-bold">
            <td>Celkem za rok</td>
            <td class="text-right text-orange">${fmtNum(r.annualProductionKwh)}</td>
            <td class="text-right">${fmtNum(r.annualConsumptionKwh)}</td>
            <td class="text-right" style="color:#059669;">${fmtNum(Math.round(totalDirectSelf))}</td>
            ${hasBattery ? `<td class="text-right" style="color:#8b5cf6;">${fmtNum(Math.round(totalBatteryContrib))}</td>` : ''}
            <td class="text-right text-green">${fmtNum(r.selfConsumptionKwh)}</td>
            <td class="text-right text-blue">${fmtNum(r.gridFeedKwh)}</td>
            <td class="text-right text-muted">${fmtNum(r.gridDrawKwh)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-box">
        <div class="info-grid">
          <div><span class="info-label">Roční spotřeba:</span></div>
          <div><span class="info-value">${fmtNum(r.annualConsumptionKwh)} kWh</span></div>
          <div><span class="info-label">Vlastní spotřeba celkem:</span></div>
          <div><span class="info-value text-green">${fmtNum(r.selfConsumptionKwh)} kWh (${r.selfConsumptionPct}%)</span></div>
          <div><span class="info-label">Přetoky do sítě:</span></div>
          <div><span class="info-value text-blue">${fmtNum(r.gridFeedKwh)} kWh</span></div>
          <div><span class="info-label">Odběr ze sítě:</span></div>
          <div><span class="info-value">${fmtNum(r.gridDrawKwh)} kWh</span></div>
          <div><span class="info-label">Doporučená baterie:</span></div>
          <div><span class="info-value">${r.recommendedBatteryKwh} kWh</span></div>
        </div>
      </div>
    </div>
  `;
}

function buildRoofSection(p: ExportParams): string {
  const TECH_MAP: Record<string, string> = { mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jiná' };

  const roofCards = p.roofs.map((roof, idx) => {
    const panel = p.catalog.panels.find(pn => pn.id === roof.panelId);
    const imgSrc = p.roofCanvasDataUrls[idx];
    const powerKwp = Math.round((roof.panelCount * roof.panelPowerWp) / 10) / 100;

    return `
      <div class="section-box">
        <h3>${esc(roof.name)}</h3>
        ${imgSrc ? `<img src="${imgSrc}" class="roof-image" />` : ''}
        <div class="info-grid">
          <div><span class="info-label">Azimut:</span></div>
          <div><span class="info-value">${roof.azimuthDeg}°</span></div>
          <div><span class="info-label">Sklon:</span></div>
          <div><span class="info-value">${roof.tiltDeg}°</span></div>
          <div><span class="info-label">Počet panelů:</span></div>
          <div><span class="info-value">${roof.panelCount} ks</span></div>
          <div><span class="info-label">Výkon plochy:</span></div>
          <div><span class="info-value">${powerKwp} kWp</span></div>
          ${panel ? `
            <div><span class="info-label">Panel:</span></div>
            <div><span class="info-value">${esc(panel.name)} (${panel.power_wp} Wp, ${TECH_MAP[panel.technology] ?? panel.technology})</span></div>
            <div><span class="info-label">Rozměr panelu:</span></div>
            <div><span class="info-value">${panel.width_mm} x ${panel.height_mm} mm</span></div>
          ` : `
            <div><span class="info-label">Výkon panelu:</span></div>
            <div><span class="info-value">${roof.panelPowerWp} Wp</span></div>
          `}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <h2>Střešní plochy</h2>
      ${roofCards}
    </div>
  `;
}

function buildConstructionSection(p: ExportParams): string {
  const roofConstructions = p.roofs.filter(r => r.mounting?.showConstruction && r.panelCount > 0);
  if (roofConstructions.length === 0) return '';

  const TILE_LABELS: Record<string, string> = {
    tiled: 'Tašková', metal_sheet: 'Plechová', bitumen: 'Bitumenová',
    flat: 'Plochá', trapezoid: 'Trapézový plech', other: 'Jiná',
  };

  let totalHooks = 0;
  let totalRailM = 0;
  let totalMidClamps = 0;
  let totalEndClamps = 0;

  const rows = roofConstructions.map(roof => {
    const tile = p.catalog.roofTiles.find(t => t.id === roof.mounting?.roofTileId);
    const rail = p.catalog.railProfiles.find(rp => rp.id === roof.mounting?.railProfileId);
    const hookSpacing = roof.mounting?.hookSpacingMm ?? tile?.hook_spacing_mm ?? 350;
    const railCount = 2;
    const panelCount = roof.panelCount;
    const totalRailLenPerRow = roof.panelWidthMm * panelCount;
    const totalRailLenMm = totalRailLenPerRow * railCount;
    const hooksPerRail = Math.max(2, Math.ceil(totalRailLenPerRow / hookSpacing) + 1);
    const hooksTotal = hooksPerRail * railCount;
    const railPieces = rail ? Math.ceil(totalRailLenMm / rail.length_mm) : 0;
    const midCount = (panelCount - 1) * railCount;
    const endCount = 2 * railCount;

    totalHooks += hooksTotal;
    totalRailM += totalRailLenMm / 1000;
    totalMidClamps += midCount;
    totalEndClamps += endCount;

    return `
      <tr>
        <td>${esc(roof.name)}</td>
        <td>${tile ? esc(tile.name) + ' (' + (TILE_LABELS[tile.type] ?? tile.type) + ')' : '-'}</td>
        <td class="text-right">${hooksTotal} ks</td>
        <td class="text-right">${(totalRailLenMm / 1000).toFixed(1)} m${rail ? ` / ${railPieces} ks` : ''}</td>
        <td class="text-right">${midCount} ks</td>
        <td class="text-right">${endCount} ks</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="section">
      <h2>Montážní konstrukce</h2>
      <table>
        <thead>
          <tr>
            <th>Střecha</th>
            <th>Krytina</th>
            <th class="text-right">Háky</th>
            <th class="text-right">Profily</th>
            <th class="text-right">Střed. př.</th>
            <th class="text-right">Kraj. př.</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="text-bold">
            <td>Celkem</td>
            <td></td>
            <td class="text-right">${totalHooks} ks</td>
            <td class="text-right">${totalRailM.toFixed(1)} m</td>
            <td class="text-right">${totalMidClamps} ks</td>
            <td class="text-right">${totalEndClamps} ks</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function buildSystemSection(p: ExportParams): string {
  const { systemConfig, catalog } = p;
  const inverter = catalog.inverters.find(i => i.id === systemConfig.inverterId);
  const masterBat = catalog.batteries.find(b => b.id === systemConfig.batteryId);
  const slaveBat = catalog.batteries.find(b => b.id === systemConfig.slaveBatteryId);
  const wallbox = catalog.wallboxes.find(w => w.id === systemConfig.wallboxId);
  const masterCount = systemConfig.batteryCount ?? 0;
  const slaveCount = systemConfig.slaveBatteryCount ?? 0;

  let components = '';

  if (inverter) {
    components += `
      <div class="section-box">
        <h3>Střídač</h3>
        <div class="info-grid">
          <div><span class="info-label">Model:</span></div>
          <div><span class="info-value">${esc(inverter.name)}</span></div>
          <div><span class="info-label">Výrobce:</span></div>
          <div><span class="info-value">${esc(inverter.manufacturer)}</span></div>
          <div><span class="info-label">Výkon:</span></div>
          <div><span class="info-value">${inverter.power_kw} kW / ${inverter.phases}f / ${inverter.mppt_count} MPPT</span></div>
          <div><span class="info-label">Účinnost:</span></div>
          <div><span class="info-value">${inverter.efficiency_pct}%</span></div>
        </div>
      </div>
    `;
  }

  if (masterBat && masterCount > 0) {
    const totalKwh = masterBat.capacity_kwh * masterCount + (slaveBat ? slaveBat.capacity_kwh * slaveCount : 0);
    components += `
      <div class="section-box">
        <h3>Bateriové úložiště (celkem ${totalKwh} kWh)</h3>
        <div class="info-grid">
          <div><span class="info-label">Master baterie:</span></div>
          <div><span class="info-value">${masterCount}x ${esc(masterBat.name)} (${masterBat.capacity_kwh} kWh)</span></div>
          ${slaveBat && slaveCount > 0 ? `
            <div><span class="info-label">Slave baterie:</span></div>
            <div><span class="info-value">${slaveCount}x ${esc(slaveBat.name)} (${slaveBat.capacity_kwh} kWh)</span></div>
          ` : ''}
          <div><span class="info-label">Chemie:</span></div>
          <div><span class="info-value">${masterBat.chemistry.toUpperCase()}</span></div>
          <div><span class="info-label">Cyklů:</span></div>
          <div><span class="info-value">${fmtNum(masterBat.cycles)}</span></div>
        </div>
      </div>
    `;
  }

  if (wallbox) {
    components += `
      <div class="section-box">
        <h3>Wallbox</h3>
        <div class="info-grid">
          <div><span class="info-label">Model:</span></div>
          <div><span class="info-value">${esc(wallbox.name)} (${wallbox.manufacturer})</span></div>
          <div><span class="info-label">Výkon:</span></div>
          <div><span class="info-value">${wallbox.power_kw} kW / ${wallbox.phases}f</span></div>
        </div>
      </div>
    `;
  }

  if (!components) return '';

  return `
    <div class="section">
      <h2>Konfigurace systému</h2>
      ${components}
    </div>
  `;
}

function buildPriceSection(p: ExportParams): string {
  const { systemConfig, catalog, subsidyCzk } = p;
  const itemDiscounts = p.itemDiscounts ?? {};
  const globalDiscountPct = p.globalDiscountPct ?? 0;

  const baseItems = buildFvQuoteLineItems(catalog, systemConfig, p.roofs);
  const discountedItems = applyDiscountsToLineItems(baseItems, itemDiscounts, globalDiscountPct);
  const totals = computeFvQuoteTotals(discountedItems, subsidyCzk);

  const priceRows = discountedItems.map(item => {
    const discountNote = item.discountPct && item.discountPct > 0 ? ` (-${Math.round(item.discountPct)}%)` : '';
    return `
      <div class="price-row">
        <span>${esc(item.name)}${discountNote}</span>
        <span class="text-bold">${fmtNum(Math.round(item.totalPrice))} Kč</span>
      </div>
    `;
  }).join('');

  const afterSubsidy = totals.finalPrice;
  const payback = p.result.totalAnnualBenefitCzk > 0 && afterSubsidy > 0
    ? calculatePayback(afterSubsidy, p.result.totalAnnualBenefitCzk)
    : null;

  return `
    <div class="section">
      <h2>Cenová kalkulace</h2>
      ${priceRows}
      <div class="price-row total">
        <span>Celkem</span>
        <span>${fmtNum(Math.round(totals.totalPrice))} Kč</span>
      </div>
      ${subsidyCzk > 0 ? `
        <div class="price-row subsidy">
          <span>Dotace NZÚ</span>
          <span>-${fmtNum(subsidyCzk)} Kč</span>
        </div>
        <div class="price-row total" style="color: #16a34a;">
          <span>Po dotaci</span>
          <span>${fmtNum(Math.round(afterSubsidy))} Kč</span>
        </div>
      ` : ''}
      ${payback ? `
        <div class="section-box" style="margin-top: 12px;">
          <div class="info-grid">
            <div><span class="info-label">Návratnost:</span></div>
            <div><span class="info-value">${payback.years < 99 ? `${payback.years} let` : '> 30 let'}</span></div>
            <div><span class="info-label">Roční úspory:</span></div>
            <div><span class="info-value text-green">${fmtNum(p.result.annualSavingsCzk + p.result.annualFeedInRevenueCzk)} Kč</span></div>
            <div><span class="info-label">Čistý zisk za 20 let (NPV):</span></div>
            <div><span class="info-value ${payback.npv20 >= 0 ? 'text-green' : 'text-orange'}">${payback.npv20 >= 0 ? '+' : ''}${fmtNum(payback.npv20)} Kč</span></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

export async function exportFvProposalPdf(p: ExportParams): Promise<void> {
  const now = new Date().toLocaleDateString('cs-CZ');
  const s = { ...PDF_SECTION_DEFAULTS, ...p.sections };

  const page1Parts: string[] = [];
  if (s.summary) page1Parts.push(buildSummarySection(p));
  if (s.roofs) page1Parts.push(buildRoofSection(p));
  if (s.construction) page1Parts.push(buildConstructionSection(p));

  const page2Parts: string[] = [];
  if (s.charts) page2Parts.push(buildChartSection(p));
  if (s.energyTable) page2Parts.push(buildEnergyTable(p));

  const page3Parts: string[] = [];
  if (s.system) page3Parts.push(buildSystemSection(p));
  if (s.price) page3Parts.push(buildPriceSection(p));

  const html = `
    <div class="pdf-container" style="padding: 20px;">
      <style>${buildStyles()}</style>
      <div class="brand-bar"></div>
      <h1>Nabídka&nbsp;fotovoltaického&nbsp;systému</h1>
      <div class="subtitle">${esc(p.projectName)} &bull; ${now}</div>
      ${buildQuoteHeaderHtml(p.company ?? null, p.client ?? null, '#ea580c')}

      ${page1Parts.join('\n')}

      ${page2Parts.length > 0 ? `<div class="page-break"></div>${page2Parts.join('\n')}` : ''}

      ${page3Parts.length > 0 ? `<div class="page-break"></div>${page3Parts.join('\n')}` : ''}

      <div class="footer">HouseSmart FV Designer &bull; Vygenerováno: ${now}</div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const pdfOptions = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `fv-nabidka-${p.projectName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.page-break', avoid: '.section' },
    };
    await html2pdf()
      .set(pdfOptions)
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
