import { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, RefreshCw, Download, MoreHorizontal, Copy, Trash2, Lock, Edit3, ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { logAudit } from '../../lib/auditLog';
import { renderTemplate } from '../../lib/placeholderEngine';
import Modal from '../../components/ui/Modal';
import PlaceholderPanel from '../../components/documents/PlaceholderPanel';
import PdfExportModal from '../../components/documents/PdfExportModal';
import type { ProjectDocument, DocumentTemplate } from '../../types/database';

export default function DocumentEditorPage() {
  const { id: projectId, docId } = useParams<{ id: string; docId: string }>();
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [doc, setDoc] = useState<ProjectDocument | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activePanel, setActivePanel] = useState<'preview' | 'data'>('preview');
  const [projectName, setProjectName] = useState('');
  const [contextData, setContextData] = useState<Record<string, unknown>>({});

  const loadDocument = useCallback(async () => {
    if (!docId) return;
    const { data } = await supabase.from('project_documents').select('*').eq('id', docId).maybeSingle();
    if (!data) { navigate(`/projekty/${projectId}`); return; }
    const docData = data as ProjectDocument;
    setDoc(docData);
    setContent(docData.rendered_html);

    if (docData.template_id) {
      const { data: tpl } = await supabase.from('document_templates').select('*').eq('id', docData.template_id).maybeSingle();
      if (tpl) setTemplate(tpl as DocumentTemplate);
    }

    const { data: proj } = await supabase.from('projects').select('project_name').eq('id', docData.project_id).maybeSingle();
    if (proj) setProjectName(proj.project_name);

    setContextData(docData.render_context || {});
    setLoading(false);
  }, [docId, projectId, navigate]);

  useEffect(() => { loadDocument(); }, [loadDocument]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Projekty', href: '/projekty' },
        { label: projectName || '...', href: `/projekty/${projectId}` },
        { label: doc?.name || 'Dokument' },
      ],
    });
  }, [setConfig, projectId, projectName, doc?.name]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    const { error } = await supabase.from('project_documents')
      .update({ rendered_html: content, updated_at: new Date().toISOString() })
      .eq('id', doc.id);
    setSaving(false);
    if (error) { toast('Chyba při ukládání', 'error'); return; }
    await logAudit('project_document', doc.id, 'updated', { project_id: projectId });
    toast('Uloženo');
    setDoc(prev => prev ? { ...prev, rendered_html: content } : null);
  };

  const handleRegenerate = async () => {
    if (!doc || !template) return;
    setRegenerating(true);

    const { data: proj } = await supabase.from('projects').select('*').eq('id', doc.project_id).maybeSingle();
    const pData: Record<string, unknown> = {};
    if (proj) {
      pData.name = proj.project_name;
      pData.address = proj.address || '';
      pData.status = proj.status;
      pData.description = proj.description || '';
      pData.deadline = proj.deadline ? new Date(proj.deadline).toLocaleDateString('cs-CZ') : '';
      pData.created_at = new Date(proj.created_at).toLocaleDateString('cs-CZ');
    }

    const cData: Record<string, unknown> = {};
    if (proj?.client_id) {
      const { data: client } = await supabase.from('clients').select('*').eq('id', proj.client_id).maybeSingle();
      if (client) {
        cData.name = client.name;
        cData.email = client.email || '';
        cData.phone = client.phone || '';
        cData.address = client.address || '';
        cData.ico = client.ico || '';
        cData.dic = client.dic || '';
      }
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

    const ctx = { company: companyData, project: pData, client: cData, currentUser };
    const newHtml = renderTemplate(template.content, ctx, 'empty');

    const { error } = await supabase.from('project_documents')
      .update({ rendered_html: newHtml, updated_at: new Date().toISOString() })
      .eq('id', doc.id);

    setRegenerating(false);
    setShowRegenModal(false);
    setRegenConfirm(false);

    if (error) { toast('Chyba při přegenerování', 'error'); return; }
    setContent(newHtml);
    setDoc(prev => prev ? { ...prev, rendered_html: newHtml } : null);
    await logAudit('project_document', doc.id, 'regenerated', { template: template.name });
    toast('Dokument přegenerován');
  };

  const handleInsertPlaceholder = (placeholder: string) => {
    if (!editorRef.current || doc?.status === 'FINAL') return;
    const ta = editorRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.substring(0, start) + placeholder + content.substring(end);
    setContent(newContent);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + placeholder.length; }, 0);
  };

  const handleDelete = async () => {
    if (!doc || doc.status !== 'DRAFT') return;
    if (!confirm('Opravdu smazat tento dokument?')) return;
    await supabase.from('project_documents').delete().eq('id', doc.id);
    await logAudit('project_document', doc.id, 'deleted', {});
    toast('Dokument smazan');
    navigate(`/projekty/${projectId}`);
  };

  const handleLock = async () => {
    if (!doc) return;
    const { error } = await supabase.from('project_documents')
      .update({ status: 'FINAL', updated_at: new Date().toISOString() })
      .eq('id', doc.id);
    if (error) { toast('Chyba', 'error'); return; }
    setDoc(prev => prev ? { ...prev, status: 'FINAL' } : null);
    await logAudit('project_document', doc.id, 'locked', {});
    toast('Dokument uzamcen jako FINAL');
    setShowMenu(false);
  };

  const handleDuplicate = async () => {
    if (!doc) return;
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('project_documents').insert({
      project_id: doc.project_id,
      template_id: doc.template_id,
      template_version: doc.template_version,
      name: `${doc.name} (kopie)`,
      status: 'DRAFT',
      rendered_html: content,
      render_context: doc.render_context,
      document_type: doc.document_type,
      created_by: user.user?.id,
    }).select('id').maybeSingle();
    if (error || !data) { toast('Chyba při duplikaci', 'error'); return; }
    toast('Dokument duplikován');
    setShowMenu(false);
    navigate(`/projekty/${projectId}/dokument/${data.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
        <div className="h-96 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
      </div>
    );
  }

  if (!doc) return null;
  const isFinal = doc.status === 'FINAL';

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="bg-navy-800/60 border-b border-white/[0.08] px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate(`/projekty/${projectId}`)}
          className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <FileText className="w-5 h-5 text-slate-400" />
        <h1 className="text-sm font-bold text-white truncate">{doc.name}</h1>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFinal ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-200' : 'bg-amber-500/10 text-amber-400 border border-amber-200'}`}>
          {doc.status}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {template && !isFinal && (
            <button onClick={() => setShowRegenModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 border border-white/10 rounded-xl hover:bg-white/[0.04] transition">
              <RefreshCw className="w-3.5 h-3.5" />
              Přegenerovat
            </button>
          )}
          {!isFinal && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 border border-white/10 rounded-xl hover:bg-white/[0.04] transition disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          )}
          <button onClick={() => setShowPdfModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition">
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-lg py-1 min-w-[160px]">
                  <button onClick={handleDuplicate} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"><Copy className="w-3.5 h-3.5" />Duplikovat</button>
                  {!isFinal && (
                    <button onClick={handleLock} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"><Lock className="w-3.5 h-3.5" />Uzamknout (FINAL)</button>
                  )}
                  {!isFinal && (
                    <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/100/10"><Trash2 className="w-3.5 h-3.5" />Smazat</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-white/10 shrink-0 overflow-hidden flex flex-col bg-white/[0.06]">
          <PlaceholderPanel onInsert={handleInsertPlaceholder} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.04]">
          <div className="px-4 py-2 border-b border-white/10 bg-white/[0.06] flex items-center gap-2">
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isFinal ? 'Obsah (pouze pro cteni)' : 'Editor obsahu'}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <textarea
              ref={editorRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              readOnly={isFinal}
              className={`w-full h-full min-h-[600px] p-6 bg-navy-800/60 border border-white/[0.08] rounded-xl text-sm font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isFinal ? 'bg-white/[0.04] cursor-default' : ''}`}
              placeholder="Obsah dokumentu..."
            />
          </div>
        </div>

        <div className="w-80 border-l border-white/10 shrink-0 overflow-hidden flex flex-col bg-white/[0.06]">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActivePanel('preview')}
              className={`flex-1 px-3 py-2.5 text-xs font-bold transition ${activePanel === 'preview' ? 'text-blue-400 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Nahled
            </button>
            <button
              onClick={() => setActivePanel('data')}
              className={`flex-1 px-3 py-2.5 text-xs font-bold transition ${activePanel === 'data' ? 'text-blue-400 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Data
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {activePanel === 'preview' ? (
              <div className="p-4">
                <div className="bg-navy-800/60 border border-white/[0.08] rounded-xl p-6 ">
                  <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Dokument</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Stav</span><span className="font-medium text-slate-300">{doc.status}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Typ</span><span className="font-medium text-slate-300">{doc.document_type}</span></div>
                    {template && <div className="flex justify-between text-xs"><span className="text-slate-500">Šablona</span><span className="font-medium text-slate-300">{template.name} v{doc.template_version}</span></div>}
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Vytvoreno</span><span className="font-medium text-slate-300">{new Date(doc.created_at).toLocaleString('cs-CZ')}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Upraveno</span><span className="font-medium text-slate-300">{new Date(doc.updated_at).toLocaleString('cs-CZ')}</span></div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Pripojeny kontext</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Projekt</span><span className="font-medium text-slate-300">{projectName}</span></div>
                    {contextData.quote_id ? <div className="flex justify-between text-xs"><span className="text-slate-500">Nabídka</span><span className="font-medium text-blue-400">{String(contextData.quote_id).substring(0, 8)}...</span></div> : null}
                    {contextData.job_id ? <div className="flex justify-between text-xs"><span className="text-slate-500">Zakázka</span><span className="font-medium text-blue-400">{String(contextData.job_id).substring(0, 8)}...</span></div> : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showRegenModal}
        onClose={() => { setShowRegenModal(false); setRegenConfirm(false); }}
        title="Přegenerovat ze šablony"
        size="sm"
        footer={
          <>
            <button onClick={() => { setShowRegenModal(false); setRegenConfirm(false); }} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button
              onClick={handleRegenerate}
              disabled={!regenConfirm || regenerating}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
            >
              {regenerating ? 'Přegenerovávám...' : 'Přegenerovat'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Přegenerování přepíše obsah dokumentu daty ze šablony. Ruční úpravy budou ztraceny.</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={regenConfirm} onChange={e => setRegenConfirm(e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-300">Rozumím, že se přepíší ruční úpravy</span>
          </label>
        </div>
      </Modal>

      {showPdfModal && (
        <PdfExportModal
          doc={doc}
          content={content}
          projectName={projectName}
          onClose={() => setShowPdfModal(false)}
          onLocked={() => { setDoc(prev => prev ? { ...prev, status: 'FINAL' } : null); }}
        />
      )}
    </div>
  );
}
