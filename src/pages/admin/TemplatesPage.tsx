import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Edit2, Trash2, Eye, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import TemplateEditorModal from '../../components/documents/TemplateEditorModal';
import { TEMPLATE_TYPE_LABELS } from '../../lib/placeholderEngine';
import type { DocumentTemplate, DocumentTemplateType } from '../../types/database';

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    setTemplates((data || []) as DocumentTemplate[]);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('document_templates')
      .update({ is_active: false })
      .eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Šablona deaktivována');
    setDeleteTarget(null);
    loadTemplates();
  };

  const handleDuplicate = async (tpl: DocumentTemplate) => {
    const { error } = await supabase.from('document_templates').insert({
      name: `${tpl.name} (kopie)`,
      description: tpl.description,
      template_type: tpl.template_type,
      content: tpl.content,
      version: 1,
      is_active: true,
    });
    if (error) { toast('Chyba při duplikaci', 'error'); return; }
    toast('Šablona duplikována');
    loadTemplates();
  };

  const filtered = templates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && t.template_type !== filterType) return false;
    return true;
  });

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      zapis_stavba: 'bg-amber-500/10 text-amber-700 border-amber-200',
      predavaci_protokol: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      servisni_protokol: 'bg-blue-500/10 text-blue-400 border-blue-200',
      checklist: 'bg-orange-500/10 text-orange-700 border-orange-200',
      obecny: 'bg-white/[0.04] text-slate-400 border-white/10',
    };
    return map[type] || map.obecny;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-skeleton-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Šablony dokumentů</h1>
          <p className="text-sm text-slate-500 mt-1">Správa šablon pro generování dokumentů v projektech</p>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setEditorOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nová šablona
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat šablonu..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Všechny typy</option>
          {Object.entries(TEMPLATE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {templates.length === 0 ? 'Zatím žádné šablony. Vytvořte první!' : 'Žádné šablony neodpovídají filtru'}
          </p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {filtered.map(tpl => (
            <div key={tpl.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04]/50 transition">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{tpl.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColor(tpl.template_type)}`}>
                    {TEMPLATE_TYPE_LABELS[tpl.template_type as DocumentTemplateType] || tpl.template_type}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">v{tpl.version}</span>
                  {!tpl.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-200">Neaktivní</span>}
                </div>
                {tpl.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{tpl.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setPreviewTemplate(tpl)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition" title="Náhled">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditingTemplate(tpl); setEditorOpen(true); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition" title="Upravit">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDuplicate(tpl)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition" title="Duplikovat">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(tpl)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-red-400 transition" title="Smazat">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <TemplateEditorModal
          template={editingTemplate}
          onClose={() => { setEditorOpen(false); setEditingTemplate(null); }}
          onSaved={() => { setEditorOpen(false); setEditingTemplate(null); loadTemplates(); }}
        />
      )}

      <Modal
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={`Náhled: ${previewTemplate?.name || ''}`}
        size="lg"
      >
        {previewTemplate && (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTemplate.content }} />
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Deaktivovat šablonu"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleDelete} disabled={deleting} className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50">
              {deleting ? 'Mažem...' : 'Deaktivovat'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-400">Šablona "{deleteTarget?.name}" bude deaktivována a nebude k dispozici pro nové dokumenty.</p>
      </Modal>
    </div>
  );
}
