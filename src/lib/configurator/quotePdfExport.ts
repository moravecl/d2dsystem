import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OfferDocument from './OfferDocument';
import type { ConfiguratorConfig, QuoteState, QuoteTotals } from './types';

/**
 * Tisk předběžné nabídky ve VĚRNÉM designu původní aplikace HouseSmart
 * Manager: dokument se vyrenderuje jako statické HTML se stejnými
 * Tailwind třídami a otevře v tiskovém okně s Tailwind CDN a fonty
 * Inter + Playfair Display — vzhled 1:1 s originálem.
 */
export function exportQuotePdf(params: {
  state: QuoteState;
  totals: QuoteTotals;
  config: ConfiguratorConfig;
}) {
  const body = renderToStaticMarkup(
    createElement(OfferDocument, {
      state: params.state,
      totals: params.totals,
      config: params.config,
    }),
  );

  const title = `Nabídka ${params.state.client.lastName || ''}`.trim();

  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8">
<title>${title.replace(/</g, '&lt;')}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
  body { font-family: 'Inter', sans-serif; margin: 0; background: #e5e7eb; }
  .font-serif { font-family: 'Playfair Display', serif; }
  .a4-container {
    width: 210mm;
    min-height: 297mm;
    background: white;
    box-shadow: 0 0 20px rgba(0,0,0,0.1);
    color: #1e293b;
    position: relative;
    padding-bottom: 20px;
    margin: 0 auto;
  }
  .page-break-after { page-break-after: always; break-after: page; }
  .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
  @media print {
    body { background: white; }
    .a4-container { box-shadow: none; width: auto; }
    @page { size: A4; margin: 0; }
  }
</style></head><body>
${body}
<script>
  // pockat na Tailwind CDN (generuje styly az po nacteni) a fonty
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 900);
  });
</script>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) URL.revokeObjectURL(url);
}
