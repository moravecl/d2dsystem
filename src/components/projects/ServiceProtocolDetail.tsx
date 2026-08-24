import { useState, useEffect } from 'react';
import { X, Download, Printer, Clock, Package, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WorkItem {
  id: string;
  type: 'labor' | 'material';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

interface ProtocolData {
  id: string;
  protocol_number: string;
  service_date: string;
  technician_name: string;
  description: string;
  findings: string;
  recommendations: string;
  status: string;
  created_at: string;
  project_name?: string;
  client_name?: string;
  address?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  protocolId: string;
  projectId?: string | null;
}

export default function ServiceProtocolDetail({ open, onClose, protocolId, projectId }: Props) {
  const [protocol, setProtocol] = useState<ProtocolData | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !protocolId) return;
    setLoading(true);
    (async () => {
      const [protoRes, itemsRes] = await Promise.all([
        supabase.from('service_protocols').select('*').eq('id', protocolId).maybeSingle(),
        supabase.from('service_work_items').select('*').eq('protocol_id', protocolId).order('sort_order'),
      ]);
      const protoData = protoRes.data as any;
      if (protoData) {
        const resolvedProjectId = projectId || protoData.project_id;
        let projectName = '';
        let resolvedClientName = protoData.client_name || '';
        let resolvedAddress = protoData.client_address || '';
        if (resolvedProjectId) {
          const projectRes = await supabase.from('projects').select('project_name, client_name, address').eq('id', resolvedProjectId).maybeSingle();
          projectName = projectRes.data?.project_name || '';
          if (!resolvedClientName) resolvedClientName = projectRes.data?.client_name || '';
          if (!resolvedAddress) resolvedAddress = projectRes.data?.address || '';
        }
        setProtocol({
          ...protoData,
          project_name: projectName,
          client_name: resolvedClientName,
          address: resolvedAddress,
        });
      }
      setWorkItems((itemsRes.data || []) as WorkItem[]);
      setLoading(false);
    })();
  }, [open, protocolId, projectId]);

  if (!open) return null;

  const laborItems = workItems.filter(i => i.type === 'labor');
  const materialItems = workItems.filter(i => i.type === 'material');
  const laborTotal = laborItems.reduce((s, i) => s + Number(i.total_price), 0);
  const materialTotal = materialItems.reduce((s, i) => s + Number(i.total_price), 0);
  const grandTotal = laborTotal + materialTotal;

  const handlePrint = () => {
    if (!protocol) return;

    const fmt = (n: number) => n.toLocaleString('cs-CZ');
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('cs-CZ');
    const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const workTableRows = (items: WorkItem[]) => items.map(i => `
      <tr>
        <td>${esc(i.description)}</td>
        <td class="num">${i.quantity}</td>
        <td style="text-align:center">${esc(i.unit)}</td>
        <td class="num">${fmt(Number(i.unit_price))} Kc</td>
        <td class="num">${fmt(Number(i.total_price))} Kc</td>
      </tr>`).join('');

    const laborSection = laborItems.length > 0 ? `
      <h2>Vykaz prace</h2>
      <table>
        <thead><tr><th>Popis</th><th style="text-align:right;width:70px">Mnozstvi</th><th style="text-align:center;width:60px">Jedn.</th><th style="text-align:right;width:90px">Cena/j.</th><th style="text-align:right;width:90px">Celkem</th></tr></thead>
        <tbody>${workTableRows(laborItems)}</tbody>
        <tfoot><tr class="total-row"><td colspan="4" style="text-align:right">Prace celkem:</td><td class="num">${fmt(laborTotal)} Kc</td></tr></tfoot>
      </table>` : '';

    const materialSection = materialItems.length > 0 ? `
      <h2>Vykaz materialu</h2>
      <table>
        <thead><tr><th>Popis</th><th style="text-align:right;width:70px">Mnozstvi</th><th style="text-align:center;width:60px">Jedn.</th><th style="text-align:right;width:90px">Cena/j.</th><th style="text-align:right;width:90px">Celkem</th></tr></thead>
        <tbody>${workTableRows(materialItems)}</tbody>
        <tfoot><tr class="total-row"><td colspan="4" style="text-align:right">Material celkem:</td><td class="num">${fmt(materialTotal)} Kc</td></tr></tfoot>
      </table>` : '';

    const grandTotalSection = grandTotal > 0 ? `
      <div class="grand-total">
        <span class="label">Celkova castka</span>
        <div style="display:flex;gap:24px;align-items:center">
          ${laborTotal > 0 ? `<span style="font-size:11px;color:#64748b">Prace: ${fmt(laborTotal)} Kc</span>` : ''}
          ${materialTotal > 0 ? `<span style="font-size:11px;color:#64748b">Material: ${fmt(materialTotal)} Kc</span>` : ''}
          <span class="value">${fmt(grandTotal)} Kc</span>
        </div>
      </div>` : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Servisni protokol ${esc(protocol.protocol_number)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #1e293b; padding: 32px; max-width: 800px; }
        h1 { font-size: 20px; font-weight: 800; margin-bottom: 2px; }
        h2 { font-size: 13px; font-weight: 700; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; color: #334155; }
        .subtitle { color: #64748b; font-size: 11px; margin-bottom: 20px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
        .meta-item label { font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 3px; }
        .meta-item span { font-size: 12px; color: #1e293b; font-weight: 600; }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px; }
        .section-body { font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }
        th { text-align: left; font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; padding: 7px 8px; border-bottom: 2px solid #e2e8f0; background: #f8fafc; }
        td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .total-row td { font-weight: 700; border-top: 2px solid #e2e8f0; border-bottom: none; background: #f8fafc; }
        .grand-total { margin-top: 20px; padding: 14px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .grand-total .label { font-size: 12px; color: #64748b; }
        .grand-total .value { font-size: 18px; font-weight: 800; color: #0f172a; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>
      <h1>Servisni protokol</h1>
      <div class="subtitle">${esc(protocol.protocol_number)} &bull; ${fmtDate(protocol.service_date)}</div>
      <div class="meta-grid">
        <div class="meta-item"><label>Datum servisu</label><span>${fmtDate(protocol.service_date)}</span></div>
        <div class="meta-item"><label>Technik</label><span>${esc(protocol.technician_name)}</span></div>
        <div class="meta-item"><label>${protocol.project_name ? 'Projekt' : 'Klient'}</label><span>${esc(protocol.project_name || protocol.client_name || '-')}</span></div>
        <div class="meta-item"><label>Adresa</label><span>${esc(protocol.address || '-')}</span></div>
      </div>
      <div class="section">
        <div class="section-title">Popis provedenych praci</div>
        <div class="section-body">${esc(protocol.description)}</div>
      </div>
      ${protocol.findings ? `<div class="section"><div class="section-title">Zjisteni pri kontrole</div><div class="section-body">${esc(protocol.findings)}</div></div>` : ''}
      ${protocol.recommendations ? `<div class="section"><div class="section-title">Doporuceni</div><div class="section-body">${esc(protocol.recommendations)}</div></div>` : ''}
      ${laborSection}
      ${materialSection}
      ${grandTotalSection}
      <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleExportCSV = () => {
    if (!protocol) return;
    const rows: string[][] = [
      ['Servisní protokol', protocol.protocol_number],
      ['Projekt', protocol.project_name || ''],
      ['Klient', protocol.client_name || ''],
      ['Datum servisu', new Date(protocol.service_date).toLocaleDateString('cs-CZ')],
      ['Technik', protocol.technician_name],
      [],
      ['Popis prací'],
      [protocol.description],
      [],
    ];
    if (protocol.findings) {
      rows.push(['Zjištění'], [protocol.findings], []);
    }
    if (protocol.recommendations) {
      rows.push(['Doporučení'], [protocol.recommendations], []);
    }
    if (laborItems.length > 0) {
      rows.push([''], ['VÝKAZ PRÁCE']);
      rows.push(['Popis', 'Množství', 'Jednotka', 'Cena/j.', 'Celkem']);
      laborItems.forEach(i => rows.push([i.description, String(i.quantity), i.unit, String(i.unit_price), String(i.total_price)]));
      rows.push(['', '', '', 'Práce celkem:', String(laborTotal)]);
      rows.push([]);
    }
    if (materialItems.length > 0) {
      rows.push([''], ['VÝKAZ MATERIÁLU']);
      rows.push(['Popis', 'Množství', 'Jednotka', 'Cena/j.', 'Celkem']);
      materialItems.forEach(i => rows.push([i.description, String(i.quantity), i.unit, String(i.unit_price), String(i.total_price)]));
      rows.push(['', '', '', 'Materiál celkem:', String(materialTotal)]);
      rows.push([]);
    }
    if (grandTotal > 0) {
      rows.push(['', '', '', 'CELKEM:', String(grandTotal)]);
    }
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protokol-${protocol.protocol_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{protocol?.protocol_number || 'Protokol'}</h2>
              {protocol && <p className="text-[11px] text-slate-400">{new Date(protocol.service_date).toLocaleDateString('cs-CZ')}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] rounded-lg transition border border-white/[0.08]" title="Export CSV">
              <Download className="w-3.5 h-3.5" />CSV
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] rounded-lg transition border border-white/[0.08]" title="Tisk">
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
          ) : protocol ? (
            <div id="protocol-print-area">
              <h1>{protocol.protocol_number}</h1>
              <div className="meta">{protocol.project_name} | {protocol.client_name}</div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Datum servisu</div>
                  <div className="text-sm font-semibold text-white">{new Date(protocol.service_date).toLocaleDateString('cs-CZ')}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Technik</div>
                  <div className="text-sm font-semibold text-white">{protocol.technician_name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{protocol.project_name ? 'Projekt' : 'Klient'}</div>
                  <div className="text-sm font-semibold text-white">{protocol.project_name || protocol.client_name || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Adresa</div>
                  <div className="text-sm font-semibold text-white">{protocol.address || '-'}</div>
                </div>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Popis provedených prací</div>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{protocol.description}</div>
                </div>
                {protocol.findings && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Zjištění při kontrole</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{protocol.findings}</div>
                  </div>
                )}
                {protocol.recommendations && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Doporučení</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{protocol.recommendations}</div>
                  </div>
                )}
              </div>

              {laborItems.length > 0 && (
                <div className="mb-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3 pb-2 border-b border-white/[0.06]">
                    <Clock className="w-4 h-4 text-blue-500" />Výkaz práce
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase">
                        <th className="text-left pb-2 pr-2">Popis</th>
                        <th className="text-right pb-2 px-2 w-20">Množství</th>
                        <th className="text-center pb-2 px-2 w-16">Jedn.</th>
                        <th className="text-right pb-2 px-2 w-24">Cena/j.</th>
                        <th className="text-right pb-2 pl-2 w-24">Celkem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {laborItems.map(i => (
                        <tr key={i.id}>
                          <td className="py-2 pr-2 text-slate-300">{i.description}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{i.quantity}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{i.unit}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{Number(i.unit_price).toLocaleString('cs-CZ')} Kc</td>
                          <td className="py-2 pl-2 text-right font-semibold text-white">{Number(i.total_price).toLocaleString('cs-CZ')} Kc</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/[0.08]">
                        <td colSpan={4} className="py-2 pr-2 text-right text-xs font-bold text-slate-500">Práce celkem:</td>
                        <td className="py-2 pl-2 text-right font-bold text-white">{laborTotal.toLocaleString('cs-CZ')} Kc</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {materialItems.length > 0 && (
                <div className="mb-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3 pb-2 border-b border-white/[0.06]">
                    <Package className="w-4 h-4 text-amber-500" />Výkaz materiálu
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase">
                        <th className="text-left pb-2 pr-2">Popis</th>
                        <th className="text-right pb-2 px-2 w-20">Množství</th>
                        <th className="text-center pb-2 px-2 w-16">Jedn.</th>
                        <th className="text-right pb-2 px-2 w-24">Cena/j.</th>
                        <th className="text-right pb-2 pl-2 w-24">Celkem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {materialItems.map(i => (
                        <tr key={i.id}>
                          <td className="py-2 pr-2 text-slate-300">{i.description}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{i.quantity}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{i.unit}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{Number(i.unit_price).toLocaleString('cs-CZ')} Kc</td>
                          <td className="py-2 pl-2 text-right font-semibold text-white">{Number(i.total_price).toLocaleString('cs-CZ')} Kc</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/[0.08]">
                        <td colSpan={4} className="py-2 pr-2 text-right text-xs font-bold text-slate-500">Materiál celkem:</td>
                        <td className="py-2 pl-2 text-right font-bold text-white">{materialTotal.toLocaleString('cs-CZ')} Kc</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {grandTotal > 0 && (
                <div className="grand-total flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <span className="text-sm text-slate-500">Celková částka</span>
                  <div className="flex items-center gap-4">
                    {laborTotal > 0 && <span className="text-xs text-slate-400">Práce: {laborTotal.toLocaleString('cs-CZ')} Kc</span>}
                    {materialTotal > 0 && <span className="text-xs text-slate-400">Materiál: {materialTotal.toLocaleString('cs-CZ')} Kc</span>}
                    <span className="text-lg font-extrabold text-white">{grandTotal.toLocaleString('cs-CZ')} Kc</span>
                  </div>
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
