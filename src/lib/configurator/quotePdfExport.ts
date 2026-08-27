import type { QuoteState, QuoteTotals, SectionResult } from './types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function kc(n: number): string {
  return `${Math.round(n).toLocaleString('cs-CZ')} Kč`;
}

interface CompanyData {
  company_name?: string;
  address?: string;
  city?: string;
  zip?: string;
  company_id?: string;
  tax_id?: string;
}

const SECTION_ORDER: { key: keyof QuoteTotals; stateKey: keyof QuoteState; title: string }[] = [
  { key: 'resHeating', stateKey: 'heating', title: 'Topení & Zóny' },
  { key: 'resVent', stateKey: 'ventilation', title: 'Vzduchotechnika & Chlazení' },
  { key: 'resFve', stateKey: 'fve', title: 'Fotovoltaika (FVE)' },
  { key: 'resElectro', stateKey: 'electro', title: 'Elektroinstalace' },
  { key: 'resWater', stateKey: 'water', title: 'Voda & Odpady' },
  { key: 'resLoxone', stateKey: 'loxone', title: 'Chytrá domácnost Loxone' },
  { key: 'resSec', stateKey: 'security', title: 'Zabezpečení & Kamery' },
  { key: 'resExt', stateKey: 'exterior', title: 'Exteriér' },
  { key: 'resAccess', stateKey: 'access', title: 'Vstup & Přístup' },
  { key: 'resNet', stateKey: 'network', title: 'Datová síť' },
];

/**
 * Tisk předběžné nabídky — HTML → nové okno → print (stejný mechanismus
 * jako protokoly a dodací listy). Klientská verze: bez marží a zisků.
 */
export function exportQuotePdf(params: {
  state: QuoteState;
  totals: QuoteTotals;
  company: CompanyData | null;
}) {
  const { state, totals, company } = params;
  const dateStr = new Date(state.client.date + 'T00:00:00').toLocaleDateString('cs-CZ');
  const clientName = `${state.client.firstName} ${state.client.lastName}`.trim() || '—';

  let sectionsHtml = '';
  for (const def of SECTION_ORDER) {
    const sectionState = state[def.stateKey] as { active?: boolean };
    if (!sectionState?.active) continue;
    const res = totals[def.key] as SectionResult;
    const rows = res.details.map((d) =>
      `<tr><td>${esc(d.label)}</td><td class="num">${kc(d.price)}</td></tr>`,
    ).join('');
    const discountRow = res.discount > 0.5
      ? `<tr class="disc"><td>Sleva sekce</td><td class="num">−${kc(res.discount)}</td></tr>`
      : '';
    sectionsHtml += `
      <div class="section">
        <div class="sec-head"><span>${esc(def.title)}</span><span>${kc(res.final)}</span></div>
        <table><tbody>${rows}${discountRow}</tbody></table>
      </div>`;
  }

  const intro = state.introText
    ? `<div class="intro">${esc(state.introText).replace(/\n/g, '<br>')}</div>`
    : '';

  const subsidyBlock = totals.totalSubsidy > 0 ? `
    <tr><td>Možné dotace (NZÚ)</td><td class="num">−${kc(totals.totalSubsidy)}</td></tr>
    <tr class="grand"><td>Cena po odečtu dotací</td><td class="num">${kc(totals.finalPriceAfterSubsidy)}</td></tr>` : '';

  const discountsBlock = totals.totalDiscountCombined > 0.5 ? `
    <tr><td>Ceníková cena celkem</td><td class="num">${kc(totals.totalBase + 0)}</td></tr>
    <tr class="disc"><td>Celková sleva HouseSmart</td><td class="num">−${kc(totals.totalDiscountCombined)}</td></tr>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Předběžná nabídka — ${esc(clientName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 16mm 14mm; font-size: 11.5px; }
  h1 { font-size: 22px; letter-spacing: 2px; }
  .muted { color: #64748b; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  .parties { display: flex; gap: 20px; margin-bottom: 16px; }
  .party { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 11px; }
  .party h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 5px; }
  .intro { margin-bottom: 16px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 4px; white-space: normal; }
  .section { margin-bottom: 12px; break-inside: avoid; }
  .sec-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 12.5px; background: #f1f5f9; padding: 6px 9px; border-radius: 5px 5px 0 0; border: 1px solid #e2e8f0; border-bottom: none; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
  td { padding: 4.5px 9px; border-bottom: 1px solid #f1f5f9; }
  td.num { text-align: right; white-space: nowrap; width: 110px; }
  tr.disc td { color: #059669; font-weight: 600; }
  .totals { margin-top: 18px; border-top: 2px solid #0f172a; padding-top: 10px; }
  .totals table { border: none; }
  .totals td { border: none; padding: 3.5px 9px; font-size: 12px; }
  tr.grand td { font-weight: 800; font-size: 14px; border-top: 1.5px solid #0f172a; padding-top: 7px; }
  .market { margin-top: 16px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 11px; }
  .foot { margin-top: 22px; font-size: 10px; color: #64748b; }
  @media print { body { padding: 8mm 7mm; } }
</style></head><body>

<div class="head">
  <div>
    <h1>PŘEDBĚŽNÁ NABÍDKA</h1>
    <div class="muted">Komplexní nabídka technologií · ${dateStr}</div>
  </div>
  <div style="text-align:right">
    <div style="font-weight:800">${esc(company?.company_name ?? '')}</div>
    ${company?.address ? `<div class="muted">${esc(company.address)}</div>` : ''}
    ${company?.zip || company?.city ? `<div class="muted">${esc([company?.zip, company?.city].filter(Boolean).join(' '))}</div>` : ''}
    ${company?.company_id ? `<div class="muted">IČO: ${esc(company.company_id)}</div>` : ''}
  </div>
</div>

<div class="parties">
  <div class="party">
    <h3>Klient</h3>
    <div><strong>${esc(clientName)}</strong></div>
    ${state.client.address ? `<div>${esc(state.client.address)}</div>` : ''}
  </div>
  <div class="party">
    <h3>Objekt</h3>
    <div>Podlahová plocha: <strong>${state.property.area} m²</strong></div>
    ${totals.kwp > 0 && state.fve.active ? `<div>FVE: <strong>${totals.kwp.toFixed(1)} kWp</strong>, baterie ${totals.batteryCapacity.toFixed(1)} kWh</div>` : ''}
  </div>
</div>

${intro}
${sectionsHtml}

<div class="totals">
  <table><tbody>
    ${discountsBlock}
    <tr><td>Cena celkem bez DPH</td><td class="num">${kc(totals.totalFinal)}</td></tr>
    <tr><td>DPH ${state.vatRate} %</td><td class="num">${kc(totals.vat)}</td></tr>
    <tr class="grand"><td>Celková cena s DPH</td><td class="num">${kc(totals.totalWithVat)}</td></tr>
    ${subsidyBlock}
  </tbody></table>
</div>

${totals.totalSavings > 0 ? `<div class="market">
  Běžná tržní cena při realizaci po částech: <strong>${kc(totals.marketPrice)}</strong>
  &nbsp;·&nbsp; Vaše úspora s řešením od jednoho dodavatele: <strong>${kc(totals.totalSavings)}</strong>
</div>` : ''}

<div class="foot">
  Toto je předběžná cenová nabídka — finální cena bude upřesněna po technickém zaměření.
  Cena zahrnuje montáž, revize, zprovoznění a zaškolení. Nekupujete produkty, ale funkční systém.
</div>

</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 500);
    });
  } else {
    URL.revokeObjectURL(url);
  }
}
