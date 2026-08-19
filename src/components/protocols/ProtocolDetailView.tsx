import { useState, useEffect } from 'react';
import { X, Printer, Download, CheckSquare, Square, Calendar, User, Building2, FileCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProjectProtocol, ChecklistItem } from './protocolTypes';
import { PROTOCOL_TYPES, RESULT_OPTIONS, STATUS_OPTIONS, MEASURED_VALUE_TEMPLATES } from './protocolTypes';
import { exportProtocolPdf } from './protocolPdfExport';

interface Props {
  open: boolean;
  onClose: () => void;
  protocolId: string;
  projectId: string;
}

export default function ProtocolDetailView({ open, onClose, protocolId, projectId }: Props) {
  const [protocol, setProtocol] = useState<ProjectProtocol | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !protocolId) return;
    setLoading(true);
    Promise.all([
      supabase.from('project_protocols').select('*').eq('id', protocolId).maybeSingle(),
      supabase.from('protocol_checklist_items').select('*').eq('protocol_id', protocolId).order('sort_order'),
      supabase.from('projects').select('project_name, address').eq('id', projectId).maybeSingle(),
    ]).then(([protoRes, checkRes, projRes]) => {
      setProtocol(protoRes.data as ProjectProtocol | null);
      setChecklist((checkRes.data || []) as ChecklistItem[]);
      setProjectName(projRes.data?.project_name || '');
      setProjectAddress(projRes.data?.address || '');
      setLoading(false);
    });
  }, [open, protocolId, projectId]);

  if (!open) return null;

  const typeConf = PROTOCOL_TYPES.find(t => t.key === protocol?.protocol_type);
  const resultConf = RESULT_OPTIONS.find(r => r.key === protocol?.result);
  const statusConf = STATUS_OPTIONS.find(s => s.key === protocol?.status);
  const mvTemplate = MEASURED_VALUE_TEMPLATES[protocol?.protocol_type || ''] || [];
  const checkedCount = checklist.filter(c => c.checked).length;

  const handlePrint = () => {
    if (!protocol) return;
    exportProtocolPdf({
      protocol,
      checklist,
      mvTemplate,
      projectName,
      projectAddress,
      typeLabel: typeConf?.label || protocol.protocol_type,
      resultLabel: resultConf?.label || protocol.result,
      resultClass: protocol.result,
    });
  };

  const handleCsvExport = () => {
    if (!protocol) return;
    const BOM = '\uFEFF';
    const rows: string[] = [
      ['Protokol', protocol.protocol_number].join(';'),
      ['Typ', typeConf?.label || ''].join(';'),
      ['Název', protocol.title].join(';'),
      ['Datum', protocol.protocol_date].join(';'),
      ['Výsledek', resultConf?.label || ''].join(';'),
      ['Technik', protocol.inspector_name].join(';'),
      ['Společnost', protocol.inspector_company].join(';'),
      ['Projekt', projectName].join(';'),
      '',
      'Kontrolní body',
      ['Bod', 'Stav', 'Poznámka'].join(';'),
      ...checklist.map(c => [c.label, c.checked ? 'OK' : 'NE', c.note].join(';')),
      '',
      'Naměřené hodnoty',
      ...mvTemplate.filter(mv => protocol.measured_values[mv.key]).map(mv =>
        [mv.label, protocol.measured_values[mv.key], mv.unit].join(';')
      ),
    ];
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${protocol.protocol_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-modal-enter">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{protocol?.title || 'Protokol'}</h2>
            <p className="text-xs text-slate-400">{protocol?.protocol_number} | {typeConf?.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCsvExport} className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-400 transition" title="Export CSV">
              <Download className="w-4.5 h-4.5" />
            </button>
            <button onClick={handlePrint} className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-400 transition" title="Tisk">
              <Printer className="w-4.5 h-4.5" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-400 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}
            </div>
          ) : protocol ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                {resultConf && (
                  <span className={`px-4 py-1.5 rounded-xl text-xs font-bold border ${resultConf.color}`}>
                    {resultConf.label}
                  </span>
                )}
                {statusConf && (
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusConf.color}`}>
                    {statusConf.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetaCard icon={<Calendar className="w-4 h-4" />} label="Datum" value={new Date(protocol.protocol_date).toLocaleDateString('cs-CZ')} />
                <MetaCard icon={<Calendar className="w-4 h-4" />} label="Platnost do" value={protocol.valid_until ? new Date(protocol.valid_until).toLocaleDateString('cs-CZ') : '—'} />
                <MetaCard icon={<User className="w-4 h-4" />} label="Technik" value={protocol.inspector_name || '—'} />
                <MetaCard icon={<Building2 className="w-4 h-4" />} label="Společnost" value={protocol.inspector_company || '—'} />
                <MetaCard icon={<FileCheck className="w-4 h-4" />} label="Projekt" value={projectName || '—'} />
                <MetaCard icon={<FileCheck className="w-4 h-4" />} label="Adresa" value={projectAddress || '—'} />
              </div>

              {protocol.description && (
                <Section title="Popis">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{protocol.description}</p>
                </Section>
              )}

              {checklist.length > 0 && (
                <Section title={`Kontrolní body (${checkedCount}/${checklist.length})`}>
                  <div className="space-y-1">
                    {checklist.map((c, i) => (
                      <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg ${c.checked ? 'bg-emerald-500/10' : 'bg-white/[0.04]'}`}>
                        {c.checked
                          ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          : <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        }
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${c.checked ? 'text-emerald-800' : 'text-slate-300'}`}>{c.label}</p>
                          {c.note && <p className="text-xs text-slate-400 mt-0.5">{c.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {mvTemplate.length > 0 && mvTemplate.some(mv => protocol.measured_values[mv.key]) && (
                <Section title="Naměřené hodnoty">
                  <div className="grid grid-cols-2 gap-2">
                    {mvTemplate.filter(mv => protocol.measured_values[mv.key]).map(mv => (
                      <div key={mv.key} className="flex items-center justify-between p-2.5 bg-white/[0.04] rounded-lg">
                        <span className="text-xs text-slate-400">{mv.label}</span>
                        <span className="text-sm font-bold text-white">{protocol.measured_values[mv.key]} <span className="text-xs font-normal text-slate-400">{mv.unit}</span></span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {protocol.findings && (
                <Section title="Zjištění">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{protocol.findings}</p>
                </Section>
              )}

              {protocol.recommendations && (
                <Section title="Doporučení">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{protocol.recommendations}</p>
                </Section>
              )}

              {protocol.notes && (
                <Section title="Poznámky">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{protocol.notes}</p>
                </Section>
              )}

              {(protocol.inspector_signature || protocol.client_signature) && (
                <Section title="Podpisy">
                  <div className="grid grid-cols-2 gap-6">
                    {protocol.inspector_signature && (
                      <div className="text-center">
                        <img src={protocol.inspector_signature} alt="Podpis technika" className="max-h-32 mx-auto border border-white/10 rounded-lg" />
                        <p className="text-[10px] text-slate-400 mt-2">Podpis technika</p>
                      </div>
                    )}
                    {protocol.client_signature && (
                      <div className="text-center">
                        <img src={protocol.client_signature} alt="Podpis zákazníka" className="max-h-32 mx-auto border border-white/10 rounded-lg" />
                        <p className="text-[10px] text-slate-400 mt-2">Podpis zákazníka</p>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-sm text-slate-400">Protokol nenalezen.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl">
      <div className="text-slate-400">{icon}</div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase font-bold">{label}</p>
        <p className="text-sm font-semibold text-slate-300">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-white/[0.06]">{title}</h3>
      {children}
    </div>
  );
}
