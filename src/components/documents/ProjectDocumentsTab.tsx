import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Upload, Search, Eye, Download, Copy, Lock, Trash2, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { TEMPLATE_TYPE_LABELS } from '../../lib/placeholderEngine';
import TemplateSelectionModal from './TemplateSelectionModal';
import type { ProjectDocument, DocumentTemplateType } from '../../types/database';

interface Props {
  projectId: string;
  prefilterType?: string;
  autoOpenModal?: boolean;
  onModalClosed?: () => void;
}

export default function ProjectDocumentsTab({ projectId, prefilterType, autoOpenModal, onModalClosed }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(prefilterType || '');
  const [showTemplateModal, setShowTemplateModal] = useState(autoOpenModal || false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const loadDocuments = async () => {
    const { data } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setDocuments((data || []) as ProjectDocument[]);
    setLoading(false);
  };

  useEffect(() => { loadDocuments(); }, [projectId]);

  useEffect(() => {
    if (autoOpenModal && !showTemplateModal) {
      setShowTemplateModal(true);
    }
  }, [autoOpenModal]);

  const generated = documents.filter(d => d.document_type !== 'upload');
  const uploads = documents.filter(d => d.document_type === 'upload');

  const filterDocs = (docs: ProjectDocument[]) => docs.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && d.document_type !== filterType) return false;
    return true;
  });

  const handleDocumentCreated = (docId: string) => {
    setShowTemplateModal(false);
    onModalClosed?.();
    navigate(`/projekty/${projectId}/dokument/${docId}`);
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (doc.status !== 'DRAFT') { toast('Nelze smazat finální dokument', 'error'); return; }
    if (!confirm('Opravdu smazat tento dokument?')) return;
    const { error } = await supabase.from('project_documents').delete().eq('id', doc.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Dokument smazán');
    setMenuOpenId(null);
    loadDocuments();
  };

  const handleLock = async (doc: ProjectDocument) => {
    const { error } = await supabase.from('project_documents')
      .update({ status: 'FINAL', updated_at: new Date().toISOString() })
      .eq('id', doc.id);
    if (error) { toast('Chyba', 'error'); return; }
    toast('Dokument uzamčen');
    setMenuOpenId(null);
    loadDocuments();
  };

  const handleDuplicate = async (doc: ProjectDocument) => {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('project_documents').insert({
      project_id: projectId,
      template_id: doc.template_id,
      template_version: doc.template_version,
      name: `${doc.name} (kopie)`,
      status: 'DRAFT',
      rendered_html: doc.rendered_html,
      render_context: doc.render_context,
      document_type: doc.document_type,
      created_by: user.user?.id,
    });
    if (error) { toast('Chyba při duplikaci', 'error'); return; }
    toast('Dokument duplikován');
    setMenuOpenId(null);
    loadDocuments();
  };

  const statusBadge = (status: string) => {
    if (status === 'FINAL') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-200">FINAL</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-200">DRAFT</span>;
  };

  const typeLabel = (type: string) => TEMPLATE_TYPE_LABELS[type as DocumentTemplateType] || type;

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat dokument..."
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
            <option value="upload">Nahraný soubor</option>
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 border border-white/10 rounded-xl hover:bg-white/[0.04] transition">
            <Upload className="w-4 h-4" />
            Nahrát soubor
          </button>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nový dokument ze šablony
          </button>
        </div>
      </div>

      {filterDocs(generated).length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vygenerované dokumenty</h3>
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
            {filterDocs(generated).map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition">
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{doc.name}</span>
                    {statusBadge(doc.status)}
                    <span className="text-[10px] text-slate-400">{typeLabel(doc.document_type)}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{new Date(doc.created_at).toLocaleDateString('cs-CZ')}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => navigate(`/projekty/${projectId}/dokument/${doc.id}`)}
                    className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition"
                    title="Otevřít"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpenId === doc.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-lg py-1 min-w-[160px]">
                          <button onClick={() => handleDuplicate(doc)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"><Copy className="w-3.5 h-3.5" />Duplikovat</button>
                          {doc.status === 'DRAFT' && (
                            <button onClick={() => handleLock(doc)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"><Lock className="w-3.5 h-3.5" />Uzamknout (FINAL)</button>
                          )}
                          {doc.status === 'DRAFT' && (
                            <button onClick={() => handleDelete(doc)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" />Smazat</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filterDocs(uploads).length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Nahrané soubory</h3>
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
            {filterDocs(uploads).map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition">
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white truncate">{doc.name}</span>
                  <div className="text-xs text-slate-400 mt-0.5">{doc.file_type} &middot; {new Date(doc.created_at).toLocaleDateString('cs-CZ')}</div>
                </div>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition">
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {generated.length === 0 && uploads.length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Zatím žádné dokumenty v tomto projektu</p>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Vytvořit první dokument
          </button>
        </div>
      )}

      {showTemplateModal && (
        <TemplateSelectionModal
          projectId={projectId}
          prefilterType={prefilterType}
          onClose={() => { setShowTemplateModal(false); onModalClosed?.(); }}
          onCreated={handleDocumentCreated}
        />
      )}
    </div>
  );
}
