import { useState, useRef } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { TEMPLATE_TYPE_LABELS, renderTemplate } from '../../lib/placeholderEngine';
import PlaceholderPanel from './PlaceholderPanel';
import type { DocumentTemplate, DocumentTemplateType } from '../../types/database';

interface Props {
  template: DocumentTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

const SAMPLE_CONTEXT = {
  company: { name: 'HouseSmart s.r.o.', ico: '12345678', dic: 'CZ12345678', address: 'Prikladna 123', city: 'Praha', zip: '110 00', phone: '+420 123 456 789', email: 'info@housesmart.cz' },
  project: { name: 'Ukázkový projekt', address: 'Pražská 123, Praha', status: 'in_progress', description: 'Popis projektu', deadline: '31.12.2026', created_at: '1.1.2026', responsible: 'Jan Novak' },
  client: { name: 'Karel Svoboda', email: 'karel@email.cz', phone: '+420 123 456 789', address: 'Hlavni 1, Brno', ico: '12345678', dic: 'CZ12345678' },
  quote: { name: 'Nabídka v1', version: '1', total: '250 000 Kč', status: 'sent' },
  job: { status: 'active', started_at: '1.2.2026' },
  currentUser: 'Admin',
};

export default function TemplateEditorModal({ template, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateType, setTemplateType] = useState<DocumentTemplateType>(template?.template_type as DocumentTemplateType || 'obecny');
  const [content, setContent] = useState(template?.content || '');
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');

  const handleInsertPlaceholder = (placeholder: string) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.substring(0, start) + placeholder + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + placeholder.length;
    }, 0);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast('Zadejte název šablony', 'error'); return; }
    setSaving(true);

    if (template) {
      const { error } = await supabase
        .from('document_templates')
        .update({
          name: name.trim(),
          description: description.trim(),
          template_type: templateType,
          content,
          version: template.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id);
      setSaving(false);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      toast('Šablona aktualizována');
    } else {
      const { error } = await supabase
        .from('document_templates')
        .insert({
          name: name.trim(),
          description: description.trim(),
          template_type: templateType,
          content,
          version: 1,
          is_active: true,
        });
      setSaving(false);
      if (error) { toast('Chyba při vytváření', 'error'); return; }
      toast('Šablona vytvořena');
    }

    onSaved();
  };

  const renderedPreview = renderTemplate(content, SAMPLE_CONTEXT, 'show_missing');

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-auto my-4 w-[95vw] max-w-7xl bg-navy-800/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{template ? 'Upravit šablonu' : 'Nová šablona'}</h2>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-white/[0.06] flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Název *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Typ</label>
            <select value={templateType} onChange={e => setTemplateType(e.target.value as DocumentTemplateType)} className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {Object.entries(TEMPLATE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Popis</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-white/10 shrink-0 overflow-hidden flex flex-col">
            <PlaceholderPanel onInsert={handleInsertPlaceholder} />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-1">
              <button
                onClick={() => setActiveView('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeView === 'edit' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-white/[0.06]'}`}
              >
                Editor
              </button>
              <button
                onClick={() => setActiveView('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeView === 'preview' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-white/[0.06]'}`}
              >
                Náhled
              </button>
            </div>

            {activeView === 'edit' ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="flex-1 p-4 text-sm font-mono text-white resize-none focus:outline-none"
                placeholder="Sem pište obsah šablony... použijte {{placeholder}} pro dynamická data."
              />
            ) : (
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-3xl mx-auto bg-navy-800/60 border border-white/[0.08] rounded-xl  p-8">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderedPreview) }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.04]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition">Zrušit</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : template ? 'Uložit změny' : 'Vytvořit šablonu'}
          </button>
        </div>
      </div>
    </div>
  );
}
