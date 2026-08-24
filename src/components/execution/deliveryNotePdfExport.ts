function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface DeliveryNoteData {
  number: string;
  issue_date: string;
  note: string;
  client_name: string;
  client_address: string;
}

interface DeliveryNoteItemData {
  name: string;
  unit: string;
  quantity: number;
}

interface CompanyData {
  company_name: string;
  address?: string;
  city?: string;
  zip?: string;
  company_id?: string;
  tax_id?: string;
}

/**
 * Tisk dodacího listu — stejný mechanismus jako protocolPdfExport
 * (HTML → nové okno → print, s iframe fallbackem). Bez cen; jen položky,
 * množství a podpisové řádky Předal / Převzal.
 */
export function exportDeliveryNotePdf(params: {
  note: DeliveryNoteData;
  items: DeliveryNoteItemData[];
  company: CompanyData | null;
}) {
  const { note, items, company } = params;
  const dateStr = new Date(note.issue_date + 'T00:00:00').toLocaleDateString('cs-CZ');

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dodací list ${esc(note.number)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 18mm 16mm; font-size: 12px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #64748b; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 14px; }
  .parties { display: flex; gap: 24px; margin-bottom: 20px; }
  .party { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
  .party h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 1.5px solid #0f172a; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .note { margin-bottom: 26px; }
  .sigs { display: flex; gap: 40px; margin-top: 40px; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 1px solid #0f172a; margin-top: 46px; padding-top: 6px; font-size: 11px; color: #334155; }
  @media print { body { padding: 10mm 8mm; } }
</style></head><body>`;

  html += `<div class="head">
    <div>
      <h1>Dodací list ${esc(note.number)}</h1>
      <div class="muted">Datum vystavení: ${dateStr}</div>
    </div>
  </div>`;

  html += `<div class="parties">
    <div class="party">
      <h3>Dodavatel</h3>
      <div><strong>${esc(company?.company_name ?? '')}</strong></div>
      ${company?.address ? `<div>${esc(company.address)}</div>` : ''}
      ${company?.zip || company?.city ? `<div>${esc([company?.zip, company?.city].filter(Boolean).join(' '))}</div>` : ''}
      ${company?.company_id ? `<div class="muted">IČO: ${esc(company.company_id)}</div>` : ''}
      ${company?.tax_id ? `<div class="muted">DIČ: ${esc(company.tax_id)}</div>` : ''}
    </div>
    <div class="party">
      <h3>Odběratel</h3>
      <div><strong>${esc(note.client_name || '—')}</strong></div>
      ${note.client_address ? `<div>${esc(note.client_address)}</div>` : ''}
    </div>
  </div>`;

  html += `<table>
    <thead><tr><th style="width:28px">#</th><th>Položka</th><th class="num">Množství</th><th style="width:60px">Jedn.</th></tr></thead>
    <tbody>`;
  items.forEach((it, i) => {
    html += `<tr><td class="muted">${i + 1}</td><td>${esc(it.name)}</td><td class="num">${it.quantity.toLocaleString('cs-CZ')}</td><td>${esc(it.unit)}</td></tr>`;
  });
  html += `</tbody></table>`;

  if (note.note) {
    html += `<div class="note"><strong>Poznámka:</strong> ${esc(note.note)}</div>`;
  }

  html += `<div class="sigs">
    <div class="sig"><div class="line">Předal (dodavatel)</div></div>
    <div class="sig"><div class="line">Převzal (odběratel)</div></div>
  </div>`;

  html += `</body></html>`;

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
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm';
    document.body.appendChild(iframe);
    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iDoc) {
      iDoc.open();
      iDoc.write(html);
      iDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 600);
    }
    URL.revokeObjectURL(url);
  }
}
