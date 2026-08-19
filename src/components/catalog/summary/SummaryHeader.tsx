import { ArrowLeft, FileText } from 'lucide-react';
import type { ProjectMeta } from '../../../hooks/useProjectState';
import type { PdfSections } from './summaryUtils';

interface Props {
  meta: ProjectMeta;
  onMetaChange: (meta: ProjectMeta) => void;
  pdfSections: PdfSections;
  onPdfSectionsChange: (sections: PdfSections) => void;
  onClose: () => void;
}

const SECTION_LABELS: { key: keyof PdfSections; label: string }[] = [
  { key: 'items', label: 'Položky' },
  { key: 'rooms', label: 'Místnosti' },
  { key: 'routes', label: 'Trasy' },
  { key: 'fittings', label: 'Jištění' },
  { key: 'summary', label: 'Souhrn' },
  { key: 'floorplans', label: 'Půdorysy' },
  { key: 'trades', label: 'Řemesla' },
  { key: 'heating', label: 'Topení' },
  { key: 'fv', label: 'Fotovoltaika' },
  { key: 'camera', label: 'Kamery' },
  { key: 'eps', label: 'EPS / EZS' },
];

export default function SummaryHeader({ meta, onMetaChange, pdfSections, onPdfSectionsChange, onClose }: Props) {
  return (
    <div className="px-5 py-4 bg-white/[0.06] border-b  print:hidden shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition px-2.5 py-1.5 -ml-2.5 rounded-xl hover:bg-white/[0.06] shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-extrabold hidden sm:inline">Katalog</span>
          </button>
          <div className="w-px h-7 bg-white/[0.08]" />
          <div>
            <h2 className="text-lg font-extrabold text-white">{`Souhrn \u2013 Půdorysný návrhář`}</h2>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-extrabold">{`Tabulka + půdorysy s piny`}</p>
          </div>
        </div>
        <button onClick={() => window.print()}
          className="bg-navy-800/60 border border-white/[0.08] py-2 px-4 rounded-xl font-extrabold hover:bg-white/[0.04] transition flex items-center gap-2 text-sm ">
          <FileText className="w-4 h-4" /> Export / Tisk
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Projekt</label>
          <input value={meta.project} onChange={(e) => onMetaChange({ ...meta, project: e.target.value })}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            placeholder={`např. RD Nový Bor`} />
        </div>
        <div>
          <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{`Zákazník`}</label>
          <input value={meta.client} onChange={(e) => onMetaChange({ ...meta, client: e.target.value })}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            placeholder={`např. Novák`} />
        </div>
        <div>
          <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Verze</label>
          <input value={meta.version} onChange={(e) => onMetaChange({ ...meta, version: e.target.value })}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            placeholder={`např. V1 \u2013 24V premium`} />
        </div>
      </div>

      <div className="mt-4 p-4 bg-white/[0.06] rounded-xl">
        <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3">Sekce v PDF</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SECTION_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pdfSections[key]} onChange={(e) => onPdfSectionsChange({ ...pdfSections, [key]: e.target.checked })} className="w-4 h-4 rounded border-slate-300" />
              <span className="text-sm font-semibold text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
