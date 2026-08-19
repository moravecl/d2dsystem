import { useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import type { ProjectDocument } from '../../types/database';

interface Props {
  doc: ProjectDocument;
  content: string;
  projectName: string;
  onClose: () => void;
  onLocked: () => void;
}

export default function PdfExportModal({ doc, content, projectName, onClose, onLocked }: Props) {
  const { toast } = useToast();
  const [filename, setFilename] = useState(`${doc.name.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').trim()}.pdf`);
  const [addHeader, setAddHeader] = useState(true);
  const [addFooter, setAddFooter] = useState(true);
  const [lockAfterExport, setLockAfterExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('Prohlizec zablokoval otevreni okna. Povolte vyskakovaci okna.', 'error');
      setExporting(false);
      return;
    }

    const headerHtml = addHeader ? `
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${doc.name}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Projekt: ${projectName}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>${new Date().toLocaleDateString('cs-CZ')}</div>
          </div>
        </div>
      </div>
    ` : '';

    const footerHtml = addFooter ? `
      <style>
        @media print {
          @page { margin: 20mm 15mm 25mm 15mm; }
        }
      </style>
    ` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${filename}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; padding: 40px; }
          h1 { font-size: 24px; margin-bottom: 12px; }
          h2 { font-size: 20px; margin-bottom: 10px; margin-top: 20px; }
          h3 { font-size: 16px; margin-bottom: 8px; margin-top: 16px; }
          p { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
          th { background: #f8fafc; font-weight: 600; }
          ul, ol { margin: 8px 0; padding-left: 24px; }
          @media print {
            body { padding: 0; }
            @page { margin: 20mm 15mm; }
          }
          ${footerHtml}
        </style>
      </head>
      <body>
        ${headerHtml}
        <div class="content">${content}</div>
      </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      setExporting(false);
    }, 500);

    await logAudit('project_document', doc.id, 'pdf_exported', { filename });

    if (lockAfterExport && doc.status === 'DRAFT') {
      const { error } = await supabase.from('project_documents')
        .update({ status: 'FINAL', updated_at: new Date().toISOString() })
        .eq('id', doc.id);
      if (!error) {
        await logAudit('project_document', doc.id, 'locked', {});
        onLocked();
        toast('PDF exportovano a dokument uzamcen');
      }
    } else {
      toast('PDF exportovano');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Export PDF</h2>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název souboru</label>
            <input
              value={filename}
              onChange={e => setFilename(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={addHeader} onChange={e => setAddHeader(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-300">Přidat hlavičku (projekt, klient, datum)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={addFooter} onChange={e => setAddFooter(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-300">Přidat patičku (číslo stránky)</span>
            </label>
            {doc.status === 'DRAFT' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={lockAfterExport} onChange={e => setLockAfterExport(e.target.checked)} className="rounded" />
                <span className="text-sm text-slate-300">Uzamknout jako FINAL po exportu</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.04]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition">Zrušit</button>
          <button
            onClick={handleExport}
            disabled={exporting || !filename.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generuji...' : 'Generovat PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
