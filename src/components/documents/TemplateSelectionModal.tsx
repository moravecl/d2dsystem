import { useState, useEffect } from 'react';
import { Search, FileText, ChevronRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { TEMPLATE_TYPE_LABELS, renderTemplate } from '../../lib/placeholderEngine';
import { logAudit } from '../../lib/auditLog';
import type { DocumentTemplate, DocumentTemplateType } from '../../types/database';

interface Props {
  projectId: string;
  prefilterType?: string;
  onClose: () => void;
  onCreated: (docId: string) => void;
}

export default function TemplateSelectionModal({ projectId, prefilterType, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(prefilterType || '');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  const [attachQuote, setAttachQuote] = useState(false);
  const [attachJob, setAttachJob] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [missingMode, setMissingMode] = useState<'empty' | 'show_missing'>('empty');
  const [docName, setDocName] = useState('');
  const [creating, setCreating] = useState(false);

  const [quotes, setQuotes] = useState<{ id: string; quote_number: string; version: number; total_selling?: number; status?: string }[]>([]);
  const [jobs, setJobs] = useState<{ id: string; status: string; started_at: string }[]>([]);
  const [projectData, setProjectData] = useState<Record<string, unknown>>({});
  const [clientData, setClientData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    supabase.from('document_templates').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { setTemplates((data || []) as DocumentTemplate[]); setLoading(false); });
  }, []);

  useEffect(() => {
    const loadProjectContext = async () => {
      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
      if (!proj) return;

      const pData: Record<string, unknown> = {
        name: proj.project_name,
        address: proj.address || '',
        status: proj.status,
        description: proj.description || '',
        deadline: proj.deadline ? new Date(proj.deadline).toLocaleDateString('cs-CZ') : '',
        created_at: new Date(proj.created_at).toLocaleDateString('cs-CZ'),
      };

      if (proj.responsible_user_id) {
        const { data: resp } = await supabase.from('profiles').select('display_name').eq('id', proj.responsible_user_id).maybeSingle();
        pData.responsible = resp?.display_name || '';
      }

      setProjectData(pData);

      if (proj.client_id) {
        const { data: client } = await supabase.from('clients').select('*').eq('id', proj.client_id).maybeSingle();
        if (client) {
          setClientData({
            name: client.name,
            email: client.email || '',
            phone: client.phone || '',
            address: client.address || '',
            ico: client.ico || '',
            dic: client.dic || '',
          });
        }
      }

      const { data: q } = await supabase.from('project_quotes').select('id, quote_number, version, total_selling, status').eq('project_id', projectId).order('created_at', { ascending: false });
      setQuotes((q || []) as { id: string; quote_number: string; version: number }[]);

      const { data: j } = await supabase.from('jobs').select('id, status, started_at').eq('project_id', projectId).order('created_at', { ascending: false });
      setJobs((j || []) as { id: string; status: string; started_at: string }[]);
    };
    loadProjectContext();
  }, [projectId]);

  const handleSelectTemplate = (tpl: DocumentTemplate) => {
    setSelectedTemplate(tpl);
    setDocName(`${tpl.name} - ${new Date().toLocaleDateString('cs-CZ')}`);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !docName.trim()) return;
    setCreating(true);

    const quoteData: Record<string, unknown> = {};
    if (attachQuote && selectedQuoteId) {
      const q = quotes.find(x => x.id === selectedQuoteId);
      if (q) {
        quoteData.name = q.quote_number;
        quoteData.version = `v${q.version}`;
        quoteData.total = `${Math.round(q.total_selling ?? 0).toLocaleString('cs-CZ')} Kč`;
        quoteData.status = q.status === 'approved' ? 'schválená' : q.status;
      }
    }

    const jobData: Record<string, unknown> = {};
    if (attachJob && selectedJobId) {
      const j = jobs.find(x => x.id === selectedJobId);
      if (j) { jobData.status = j.status; jobData.started_at = j.started_at ? new Date(j.started_at).toLocaleDateString('cs-CZ') : ''; }
    }

    const companyData: Record<string, unknown> = {};
    const { data: companyRow } = await supabase.from('company_info').select('*').limit(1).maybeSingle();
    if (companyRow) {
      companyData.name = companyRow.company_name || '';
      companyData.ico = companyRow.company_id || '';
      companyData.dic = companyRow.tax_id || '';
      companyData.address = companyRow.address || '';
      companyData.city = companyRow.city || '';
      companyData.zip = companyRow.zip || '';
      companyData.phone = companyRow.phone || '';
      companyData.email = companyRow.email || '';
    }

    const { data: user } = await supabase.auth.getUser();
    const currentUser = user.user?.user_metadata?.display_name || user.user?.email || '';

    const ctx = {
      company: companyData,
      project: projectData,
      client: clientData,
      quote: quoteData,
      job: jobData,
      currentUser,
    };

    const renderedHtml = renderTemplate(selectedTemplate.content, ctx, missingMode);

    const renderContext: Record<string, unknown> = { project_id: projectId };
    if (attachQuote && selectedQuoteId) renderContext.quote_id = selectedQuoteId;
    if (attachJob && selectedJobId) renderContext.job_id = selectedJobId;

    const { data, error } = await supabase.from('project_documents').insert({
      project_id: projectId,
      template_id: selectedTemplate.id,
      template_version: selectedTemplate.version,
      name: docName.trim(),
      status: 'DRAFT',
      rendered_html: renderedHtml,
      render_context: renderContext,
      document_type: selectedTemplate.template_type,
      created_by: user.user?.id,
    }).select('id').maybeSingle();

    setCreating(false);

    if (error || !data) {
      toast('Chyba při vytváření dokumentu', 'error');
      return;
    }

    await logAudit('project_document', data.id, 'created', { template: selectedTemplate.name, project_id: projectId });
    toast('Dokument vytvořen');
    onCreated(data.id);
  };

  const filtered = templates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && t.template_type !== filterType) return false;
    return true;
  });

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      zapis_stavba: 'bg-amber-500/10 text-amber-400',
      predavaci_protokol: 'bg-emerald-500/10 text-emerald-400',
      servisni_protokol: 'bg-blue-500/10 text-blue-400',
      checklist: 'bg-orange-500/10 text-orange-700',
      obecny: 'bg-white/[0.04] text-slate-400',
    };
    return map[type] || map.obecny;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">
              {step === 1 ? 'Vybrat šablonu' : 'Kontext dokumentu'}
            </h2>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-slate-300'}`} />
              <span className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-slate-300'}`} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 1 && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-3 flex items-center gap-3 border-b border-white/[0.06]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Hledat šablonu..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Všechny typy</option>
                {Object.entries(TEMPLATE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Žádné šablony. Vytvořte je v Administraci.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {filtered.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-blue-500/10 transition text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition">
                        <FileText className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{tpl.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColor(tpl.template_type)}`}>
                            {TEMPLATE_TYPE_LABELS[tpl.template_type as DocumentTemplateType]}
                          </span>
                          <span className="text-[10px] text-slate-400">v{tpl.version}</span>
                        </div>
                        {tpl.description && <p className="text-xs text-slate-500 mt-0.5">{tpl.description}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && selectedTemplate && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-xl">
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-blue-900">{selectedTemplate.name}</div>
                <div className="text-xs text-blue-400">
                  {TEMPLATE_TYPE_LABELS[selectedTemplate.template_type as DocumentTemplateType]} &middot; v{selectedTemplate.version}
                </div>
              </div>
              <button onClick={() => setStep(1)} className="ml-auto text-xs font-medium text-blue-400 hover:text-blue-800 transition">
                Změnit
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název dokumentu</label>
              <input
                value={docName}
                onChange={e => setDocName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-400">Připojit data</div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 cursor-default bg-white/[0.04]">
                <input type="checkbox" checked disabled className="rounded" />
                <span className="text-sm text-slate-300">Projekt + Klient (vždy)</span>
              </label>

              {quotes.length > 0 && (
                <div className="p-3 rounded-xl border border-white/10 space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={attachQuote} onChange={e => setAttachQuote(e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-300">Připojit nabídku</span>
                  </label>
                  {attachQuote && (
                    <select value={selectedQuoteId} onChange={e => setSelectedQuoteId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm">
                      <option value="">Vyberte nabídku...</option>
                      {quotes.map(q => <option key={q.id} value={q.id}>{q.quote_number} (v{q.version})</option>)}
                    </select>
                  )}
                </div>
              )}

              {jobs.length > 0 && (
                <div className="p-3 rounded-xl border border-white/10 space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={attachJob} onChange={e => setAttachJob(e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-300">Připojit zakázku</span>
                  </label>
                  {attachJob && (
                    <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm">
                      <option value="">Vyberte zakázku...</option>
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.status} - {j.started_at ? new Date(j.started_at).toLocaleDateString('cs-CZ') : 'bez data'}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1.5">Chybějící data</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="missing" checked={missingMode === 'empty'} onChange={() => setMissingMode('empty')} />
                  <span className="text-sm text-slate-300">Ponechat prázdné</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="missing" checked={missingMode === 'show_missing'} onChange={() => setMissingMode('show_missing')} />
                  <span className="text-sm text-slate-300">Zobrazit [MISSING: ...]</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition">
                Zpět
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !docName.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
              >
                {creating ? 'Vytvářím...' : 'Vytvořit dokument'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
