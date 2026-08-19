function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface MeasuredValueField {
  key: string;
  label: string;
  unit: string;
}

interface ChecklistItemData {
  label: string;
  checked: boolean;
  note: string;
}

interface ExportParams {
  protocol: {
    protocol_number: string;
    protocol_type: string;
    title: string;
    protocol_date: string;
    valid_until: string;
    inspector_name: string;
    inspector_company: string;
    result: string;
    description: string;
    findings: string;
    recommendations: string;
    notes: string;
    measured_values: Record<string, string>;
    inspector_signature: string;
    client_signature: string;
    status: string;
  };
  checklist: ChecklistItemData[];
  mvTemplate: MeasuredValueField[];
  projectName: string;
  projectAddress: string;
  typeLabel: string;
  resultLabel: string;
  resultClass: string;
}

const RESULT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pass: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  conditional: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  fail: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export function exportProtocolPdf(params: ExportParams) {
  const { protocol, checklist, mvTemplate, projectName, projectAddress, typeLabel, resultLabel } = params;

  const dateStr = new Date(protocol.protocol_date + 'T00:00:00').toLocaleDateString('cs-CZ');
  const validStr = protocol.valid_until ? new Date(protocol.valid_until + 'T00:00:00').toLocaleDateString('cs-CZ') : '';
  const checkedCount = checklist.filter(c => c.checked).length;
  const rc = RESULT_COLORS[protocol.result] || RESULT_COLORS.pass;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(protocol.title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 20mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.55; padding: 24px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .brand-bar { height: 5px; background: linear-gradient(90deg, #2563eb, #0ea5e9); border-radius: 3px; margin-bottom: 20px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  h2 { font-size: 13px; font-weight: 700; margin: 20px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }
  .subtitle { font-size: 12px; color: #64748b; margin-bottom: 12px; }
  .result-badge { display: inline-block; padding: 4px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .meta-item { background: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid #f1f5f9; }
  .meta-item strong { display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
  th, td { padding: 7px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  th { background: #f8fafc; font-weight: 700; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  .check-row-ok { background: #f0fdf4; }
  .check-icon { font-size: 14px; width: 20px; display: inline-block; text-align: center; }
  .text-block { background: #f8fafc; padding: 10px 14px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; line-height: 1.6; border: 1px solid #f1f5f9; margin: 4px 0; }
  .sig-grid { display: flex; gap: 32px; margin-top: 24px; }
  .sig-box { flex: 1; text-align: center; }
  .sig-box img { max-width: 200px; max-height: 100px; }
  .sig-label { font-size: 10px; color: #94a3b8; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
  .mv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .mv-item { display: flex; justify-content: space-between; align-items: center; padding: 7px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9; }
  .mv-label { font-size: 11px; color: #475569; }
  .mv-value { font-size: 13px; font-weight: 700; color: #1e293b; }
  .mv-unit { font-size: 10px; font-weight: 400; color: #94a3b8; margin-left: 3px; }
  @media print { body { padding: 0; } .brand-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>`;

  html += `<div class="brand-bar"></div>`;

  html += `<div class="header">`;
  html += `<div><h1>${esc(protocol.title)}</h1>`;
  html += `<div class="subtitle">${esc(typeLabel)} &bull; ${esc(protocol.protocol_number)}</div></div>`;
  html += `<div class="result-badge" style="background:${rc.bg};color:${rc.color};border:1px solid ${rc.border}">${esc(resultLabel)}</div>`;
  html += `</div>`;

  html += `<div class="meta-grid">`;
  html += `<div class="meta-item"><strong>Datum protokolu</strong>${dateStr}</div>`;
  html += `<div class="meta-item"><strong>Platnost do</strong>${validStr || '—'}</div>`;
  html += `<div class="meta-item"><strong>Technik / Revizor</strong>${esc(protocol.inspector_name)}${protocol.inspector_company ? ' (' + esc(protocol.inspector_company) + ')' : ''}</div>`;
  html += `<div class="meta-item"><strong>Projekt</strong>${esc(projectName)}${projectAddress ? ', ' + esc(projectAddress) : ''}</div>`;
  html += `</div>`;

  if (protocol.description) {
    html += `<h2>Popis predmetu kontroly</h2>`;
    html += `<div class="text-block">${esc(protocol.description)}</div>`;
  }

  if (checklist.length > 0) {
    html += `<h2>Kontrolni body (${checkedCount}/${checklist.length})</h2>`;
    html += `<table><tr><th style="width:30px">#</th><th>Kontrolni bod</th><th style="width:40px;text-align:center">Stav</th><th>Poznamka</th></tr>`;
    checklist.forEach((c, i) => {
      const rowClass = c.checked ? ' class="check-row-ok"' : '';
      const icon = c.checked ? '<span class="check-icon" style="color:#059669">&#10003;</span>' : '<span class="check-icon" style="color:#dc2626">&#10007;</span>';
      html += `<tr${rowClass}><td>${i + 1}</td><td>${esc(c.label)}</td><td style="text-align:center">${icon}</td><td style="color:#64748b;font-size:11px">${esc(c.note || '')}</td></tr>`;
    });
    html += `</table>`;
  }

  const filledMv = mvTemplate.filter(mv => protocol.measured_values[mv.key]);
  if (filledMv.length > 0) {
    html += `<h2>Namerene hodnoty</h2>`;
    html += `<div class="mv-grid">`;
    filledMv.forEach(mv => {
      html += `<div class="mv-item"><span class="mv-label">${esc(mv.label)}</span><span><span class="mv-value">${esc(protocol.measured_values[mv.key])}</span><span class="mv-unit">${esc(mv.unit)}</span></span></div>`;
    });
    html += `</div>`;
  }

  if (protocol.findings) {
    html += `<h2>Zjisteni</h2>`;
    html += `<div class="text-block">${esc(protocol.findings)}</div>`;
  }

  if (protocol.recommendations) {
    html += `<h2>Doporuceni</h2>`;
    html += `<div class="text-block">${esc(protocol.recommendations)}</div>`;
  }

  if (protocol.notes) {
    html += `<h2>Poznamky</h2>`;
    html += `<div class="text-block">${esc(protocol.notes)}</div>`;
  }

  if (protocol.inspector_signature || protocol.client_signature) {
    html += `<div class="sig-grid">`;
    if (protocol.inspector_signature) {
      html += `<div class="sig-box"><img src="${esc(protocol.inspector_signature)}" /><div class="sig-label">Podpis technika</div></div>`;
    }
    if (protocol.client_signature) {
      html += `<div class="sig-box"><img src="${esc(protocol.client_signature)}" /><div class="sig-label">Podpis zakaznika</div></div>`;
    }
    html += `</div>`;
  }

  html += `<div class="footer">Vygenerovano ${new Date().toLocaleString('cs-CZ')} &bull; HouseSmart</div>`;
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
