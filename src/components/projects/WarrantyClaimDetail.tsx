import { useState, useEffect } from 'react';
import { X, Download, Printer, AlertTriangle, Wrench, RefreshCw, PenTool, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { supabase } from '../../lib/supabase';

interface ClaimData {
  id: string;
  claim_number: string;
  claim_type: string;
  claim_date: string;
  original_device_type: string;
  original_device_name: string;
  original_serial_number: string;
  original_manufacturer: string;
  fault_description: string;
  resolution_description: string;
  replacement_device_name: string;
  replacement_serial_number: string;
  replacement_manufacturer: string;
  labor_cost: number;
  material_cost: number;
  total_cost: number;
  is_warranty: boolean;
  status: string;
  technician_name: string;
  customer_signature: string;
  customer_name: string;
  signed_at: string | null;
  technician_signature: string;
  technician_signed_at: string | null;
  notes: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  claimId: string;
  projectId: string;
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  stridac: 'Stridac',
  baterie: 'Baterie',
  wallbox: 'Wallbox',
  tepelne_cerpadlo: 'Tepelne cerpadlo',
  rekuperace: 'Rekuperace',
  other: 'Ostatni',
};

function buildPrintHtml(claim: ClaimData, project: { project_name: string; client_name: string; address: string }) {
  const date = new Date(claim.claim_date).toLocaleDateString('cs-CZ');
  const typeLabel = claim.claim_type === 'repair' ? 'Oprava' : 'Vymena';
  const devType = DEVICE_TYPE_LABELS[claim.original_device_type] || claim.original_device_type;

  let html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;max-width:700px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:20px;margin:0 0 4px;">REKLAMACNI PROTOKOL</h1>
        <div style="font-size:14px;font-weight:700;color:#334155;">${claim.claim_number}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
        <tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:25%;">Projekt</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${project.project_name}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:25%;">Klient</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${project.client_name}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Datum</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${date}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Technik</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${claim.technician_name}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Typ</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${typeLabel}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Zaruka</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${claim.is_warranty ? 'Ano' : 'Ne'}</td>
        </tr>
        ${project.address ? `<tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Adresa</td>
          <td colspan="3" style="padding:6px 8px;border:1px solid #e2e8f0;">${project.address}</td>
        </tr>` : ''}
      </table>

      <h2 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;">Puvodni zarizeni</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
        <tr>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:25%;">Typ</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;">${devType}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:25%;">Nazev</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;">${claim.original_device_name}</td>
        </tr>
        <tr>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Vyrobce</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;">${claim.original_manufacturer || '-'}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Vyrobni cislo</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-family:monospace;">${claim.original_serial_number || '-'}</td>
        </tr>
      </table>`;

  if (claim.claim_type === 'replacement' && claim.replacement_device_name) {
    html += `
      <h2 style="font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;border-bottom:2px solid #fde68a;padding-bottom:4px;margin:16px 0 8px;">Nahradni zarizeni</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
        <tr>
          <td style="padding:5px 8px;border:1px solid #fde68a;background:#fffbeb;font-weight:700;width:25%;">Nazev</td>
          <td style="padding:5px 8px;border:1px solid #fde68a;">${claim.replacement_device_name}</td>
          <td style="padding:5px 8px;border:1px solid #fde68a;background:#fffbeb;font-weight:700;width:25%;">Vyrobce</td>
          <td style="padding:5px 8px;border:1px solid #fde68a;">${claim.replacement_manufacturer || '-'}</td>
        </tr>
        <tr>
          <td style="padding:5px 8px;border:1px solid #fde68a;background:#fffbeb;font-weight:700;">Vyrobni cislo</td>
          <td colspan="3" style="padding:5px 8px;border:1px solid #fde68a;font-family:monospace;">${claim.replacement_serial_number || '-'}</td>
        </tr>
      </table>`;
  }

  html += `
    <h2 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;">Popis zavady</h2>
    <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;margin-bottom:12px;padding:8px;border:1px solid #e2e8f0;border-radius:4px;">${claim.fault_description}</div>`;

  if (claim.resolution_description) {
    html += `
      <h2 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;">Provedene reseni</h2>
      <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;margin-bottom:12px;padding:8px;border:1px solid #e2e8f0;border-radius:4px;">${claim.resolution_description}</div>`;
  }

  if (claim.notes) {
    html += `
      <h2 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;">Poznamky</h2>
      <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;margin-bottom:12px;padding:8px;border:1px solid #e2e8f0;border-radius:4px;">${claim.notes}</div>`;
  }

  if (Number(claim.total_cost) > 0) {
    html += `
      <h2 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;">Naklady</h2>
      <table style="width:50%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
        ${Number(claim.labor_cost) > 0 ? `<tr><td style="padding:4px 8px;">Prace</td><td style="padding:4px 8px;text-align:right;font-weight:600;">${Number(claim.labor_cost).toLocaleString('cs-CZ')} Kc</td></tr>` : ''}
        ${Number(claim.material_cost) > 0 ? `<tr><td style="padding:4px 8px;">Material</td><td style="padding:4px 8px;text-align:right;font-weight:600;">${Number(claim.material_cost).toLocaleString('cs-CZ')} Kc</td></tr>` : ''}
        <tr style="border-top:2px solid #1e293b;">
          <td style="padding:6px 8px;font-weight:800;">Celkem</td>
          <td style="padding:6px 8px;text-align:right;font-weight:800;font-size:14px;">${Number(claim.total_cost).toLocaleString('cs-CZ')} Kc</td>
        </tr>
      </table>
      ${claim.is_warranty ? '<div style="font-size:11px;color:#059669;font-weight:600;">Zarucni oprava - bez uctu zakaznikovi</div>' : ''}`;
  }

  html += `
    <div style="margin-top:32px;display:flex;gap:32px;">
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Technik</div>
        ${claim.technician_signature ? `<img src="${claim.technician_signature}" style="max-height:70px;margin-bottom:6px;" />` : '<div style="height:70px;"></div>'}
        <div style="border-top:1px solid #1e293b;padding-top:4px;">
          <div style="font-size:12px;font-weight:700;">${claim.technician_name}</div>
          ${claim.technician_signed_at ? `<div style="font-size:10px;color:#94a3b8;">${new Date(claim.technician_signed_at).toLocaleString('cs-CZ')}</div>` : ''}
        </div>
      </div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Zakaznik</div>
        ${claim.customer_signature ? `<img src="${claim.customer_signature}" style="max-height:70px;margin-bottom:6px;" />` : '<div style="height:70px;"></div>'}
        <div style="border-top:1px solid #1e293b;padding-top:4px;">
          <div style="font-size:12px;font-weight:700;">${claim.customer_name}</div>
          ${claim.signed_at ? `<div style="font-size:10px;color:#94a3b8;">${new Date(claim.signed_at).toLocaleString('cs-CZ')}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;

  return html;
}

export default function WarrantyClaimDetail({ open, onClose, claimId, projectId }: Props) {
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [projectInfo, setProjectInfo] = useState<{ project_name: string; client_name: string; address: string }>({ project_name: '', client_name: '', address: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !claimId) return;
    setLoading(true);
    (async () => {
      const [claimRes, projRes] = await Promise.all([
        supabase.from('warranty_claims').select('*').eq('id', claimId).maybeSingle(),
        supabase.from('projects').select('project_name, client_name, address').eq('id', projectId).maybeSingle(),
      ]);
      setClaim(claimRes.data as ClaimData | null);
      if (projRes.data) setProjectInfo(projRes.data as { project_name: string; client_name: string; address: string });
      setLoading(false);
    })();
  }, [open, claimId, projectId]);

  if (!open) return null;

  const printContent = (autoPrint: boolean) => {
    if (!claim) return;
    const html = buildPrintHtml(claim, projectInfo);
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reklamacni protokol ${claim.claim_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1e293b; }
        @media print { body { padding: 12px; } }
      </style></head><body>${html}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reklamace-${claim.claim_number}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(fullDoc);
    iframeDoc.close();

    if (autoPrint) {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 300);
    } else {
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  };

  const handlePrint = () => printContent(true);

  const handleExportPdf = () => {
    if (!claim) return;
    const html = buildPrintHtml(claim, projectInfo);

    const wrapper = document.createElement('div');
    wrapper.style.overflow = 'hidden';
    wrapper.style.height = '0';
    wrapper.style.width = '0';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.zIndex = '-1';
    document.body.appendChild(wrapper);

    const container = document.createElement('div');
    container.style.width = '700px';
    container.style.padding = '24px';
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    container.style.color = '#1e293b';
    container.style.background = '#ffffff';
    container.innerHTML = html;
    wrapper.appendChild(container);

    setTimeout(() => {
      html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `reklamace-${claim.claim_number}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 700 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container)
        .save()
        .then(() => {
          document.body.removeChild(wrapper);
        });
    }, 100);
  };

  const handleExportCSV = () => {
    if (!claim) return;
    const rows = [
      ['Reklamacni protokol', claim.claim_number],
      ['Projekt', projectInfo.project_name],
      ['Klient', projectInfo.client_name],
      ['Datum', new Date(claim.claim_date).toLocaleDateString('cs-CZ')],
      ['Technik', claim.technician_name],
      ['Typ', claim.claim_type === 'repair' ? 'Oprava' : 'Vymena'],
      ['Zarucni', claim.is_warranty ? 'Ano' : 'Ne'],
      [],
      ['Puvodni zarizeni'],
      ['Nazev', claim.original_device_name],
      ['Vyrobce', claim.original_manufacturer],
      ['Vyrobni cislo', claim.original_serial_number],
      [],
      ['Popis zavady'],
      [claim.fault_description],
      [],
      ['Reseni'],
      [claim.resolution_description],
    ];
    if (claim.claim_type === 'replacement') {
      rows.push([], ['Nahradni zarizeni']);
      rows.push(['Nazev', claim.replacement_device_name]);
      rows.push(['Vyrobce', claim.replacement_manufacturer]);
      rows.push(['Vyrobni cislo', claim.replacement_serial_number]);
    }
    rows.push([], ['Naklady']);
    rows.push(['Prace', String(claim.labor_cost)]);
    rows.push(['Material', String(claim.material_cost)]);
    rows.push(['Celkem', String(claim.total_cost)]);

    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reklamace-${claim.claim_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{claim?.claim_number || 'Protokol'}</h2>
              {claim && <p className="text-[11px] text-slate-400">{claim.claim_type === 'repair' ? 'Oprava' : 'Vymena'} | {new Date(claim.claim_date).toLocaleDateString('cs-CZ')}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] rounded-lg transition border border-white/[0.08]">
              <Download className="w-3.5 h-3.5" />CSV
            </button>
            <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] rounded-lg transition border border-white/[0.08]">
              <FileDown className="w-3.5 h-3.5" />PDF
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] rounded-lg transition border border-white/[0.08]">
              <Printer className="w-3.5 h-3.5" />Tisk
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}
            </div>
          ) : claim ? (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Datum</div>
                  <div className="text-sm font-semibold text-white">{new Date(claim.claim_date).toLocaleDateString('cs-CZ')}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Technik</div>
                  <div className="text-sm font-semibold text-white">{claim.technician_name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Typ</div>
                  <div className="flex items-center gap-1.5">
                    {claim.claim_type === 'repair'
                      ? <><Wrench className="w-3.5 h-3.5 text-blue-500" /><span className="text-sm font-semibold text-blue-400">Oprava</span></>
                      : <><RefreshCw className="w-3.5 h-3.5 text-amber-500" /><span className="text-sm font-semibold text-amber-400">Vymena</span></>
                    }
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Zaruka</div>
                  <div className={`text-sm font-semibold ${claim.is_warranty ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {claim.is_warranty ? 'Ano' : 'Ne'}
                  </div>
                </div>
              </div>

              <div className="mb-5 p-4 rounded-xl border border-white/[0.08]">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Puvodni zarizeni</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-400">Typ</div>
                    <div className="text-xs font-medium text-slate-300">{DEVICE_TYPE_LABELS[claim.original_device_type] || claim.original_device_type}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Nazev</div>
                    <div className="text-xs font-medium text-slate-300">{claim.original_device_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Vyrobce</div>
                    <div className="text-xs font-medium text-slate-300">{claim.original_manufacturer || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Vyrobni cislo</div>
                    <div className="text-xs font-medium text-slate-300 font-mono">{claim.original_serial_number || '-'}</div>
                  </div>
                </div>
              </div>

              {claim.claim_type === 'replacement' && claim.replacement_device_name && (
                <div className="mb-5 p-4 rounded-xl border-2 border-amber-500/20 bg-amber-500/10">
                  <div className="text-[10px] font-bold text-amber-400 uppercase mb-2 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" /> Nahradni zarizeni
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] text-amber-500">Nazev</div>
                      <div className="text-xs font-medium text-amber-400">{claim.replacement_device_name}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-amber-500">Vyrobce</div>
                      <div className="text-xs font-medium text-amber-400">{claim.replacement_manufacturer || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-amber-500">Vyrobni cislo</div>
                      <div className="text-xs font-medium text-amber-400 font-mono">{claim.replacement_serial_number || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-5">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Popis zavady</div>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{claim.fault_description}</div>
                </div>
                {claim.resolution_description && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Provedene reseni</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{claim.resolution_description}</div>
                  </div>
                )}
                {claim.notes && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Poznamky</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{claim.notes}</div>
                  </div>
                )}
              </div>

              {Number(claim.total_cost) > 0 && (
                <div className="mb-5 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Naklady</div>
                  <div className="space-y-1">
                    {Number(claim.labor_cost) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Prace</span>
                        <span className="font-medium text-slate-300">{Number(claim.labor_cost).toLocaleString('cs-CZ')} Kc</span>
                      </div>
                    )}
                    {Number(claim.material_cost) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Material</span>
                        <span className="font-medium text-slate-300">{Number(claim.material_cost).toLocaleString('cs-CZ')} Kc</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-white/[0.08]">
                      <span className="text-sm text-slate-500">Celkem</span>
                      <span className="text-lg font-extrabold text-white">{Number(claim.total_cost).toLocaleString('cs-CZ')} Kc</span>
                    </div>
                    {claim.is_warranty && (
                      <div className="text-[11px] text-emerald-400 font-medium text-right">Zarucni oprava - bez uctu</div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-white/[0.08]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                    <PenTool className="w-3 h-3" /> Technik
                  </div>
                  {claim.technician_signature ? (
                    <img src={claim.technician_signature} alt="Podpis technika" className="max-h-20 mb-2" />
                  ) : (
                    <div className="h-20 flex items-center justify-center text-xs text-slate-300">Bez podpisu</div>
                  )}
                  <div className="border-t border-white/[0.12] pt-1">
                    <div className="text-sm font-semibold text-slate-300">{claim.technician_name}</div>
                    {claim.technician_signed_at && (
                      <div className="text-[10px] text-slate-400">{new Date(claim.technician_signed_at).toLocaleString('cs-CZ')}</div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/10">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase mb-3 flex items-center gap-1.5">
                    <PenTool className="w-3 h-3" /> Zakaznik
                  </div>
                  {claim.customer_signature ? (
                    <img src={claim.customer_signature} alt="Podpis zakaznika" className="max-h-20 mb-2" />
                  ) : (
                    <div className="h-20 flex items-center justify-center text-xs text-slate-300">Bez podpisu</div>
                  )}
                  <div className="border-t border-emerald-500/30 pt-1">
                    <div className="text-sm font-semibold text-emerald-400">{claim.customer_name || '-'}</div>
                    {claim.signed_at && (
                      <div className="text-[10px] text-emerald-400">{new Date(claim.signed_at).toLocaleString('cs-CZ')}</div>
                    )}
                  </div>
                </div>
              </div>

              {claim.status === 'signed' && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <PenTool className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">Protokol podepsan</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-slate-400">Protokol nebyl nalezen</div>
          )}
        </div>
      </div>
    </div>
  );
}
