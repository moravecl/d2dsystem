import { useEffect, useState } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { FileText, Plus, CreditCard as Edit2, Trash2, Search, Copy, Code, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { PLACEHOLDER_REGISTRY } from '../../lib/placeholderEngine';

interface EmailTemplate {
 id: string;
 name: string;
 subject: string;
 body_html: string;
 body_text: string;
 category: string;
 placeholders_used: string[];
 is_active: boolean;
 created_at: string;
}

const CATEGORIES = [
 { value: 'general', label: 'Obecne' },
 { value: 'project', label: 'Projekt' },
 { value: 'invoice', label: 'Fakturace' },
 { value: 'client', label: 'Klient' },
 { value: 'notification', label: 'Notifikace' },
];

const CATEGORY_COLORS: Record<string, string> = {
 general: 'bg-white/[0.04]0/15 text-slate-300 border-slate-500/25',
 project: 'bg-blue-500/100/15 text-blue-300 border-blue-500/25',
 invoice: 'bg-emerald-500/100/15 text-emerald-300 border-emerald-500/25',
 client: 'bg-amber-500/100/15 text-amber-300 border-amber-500/25',
 notification: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
};

const EMPTY_FORM = {
 name: '',
 subject: '',
 body_html: '',
 body_text: '',
 category: 'general',
};

export default function EmailTemplatesPage() {
 const { toast } = useToast();
 const { user } = useAuth();
 const [templates, setTemplates] = useState<EmailTemplate[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [filterCategory, setFilterCategory] = useState('');
 const [showModal, setShowModal] = useState(false);
 const [editing, setEditing] = useState<EmailTemplate | null>(null);
 const [form, setForm] = useState(EMPTY_FORM);
 const [saving, setSaving] = useState(false);
 const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
 const [showPlaceholders, setShowPlaceholders] = useState(false);

 const loadTemplates = async () => {
 const { data } = await supabase
 .from('email_templates')
 .select('*')
 .order('updated_at', { ascending: false });
 setTemplates(data || []);
 setLoading(false);
 };

 useEffect(() => { loadTemplates(); }, []);

 const openCreate = () => {
 setEditing(null);
 setForm(EMPTY_FORM);
 setShowModal(true);
 };

 const openEdit = (tpl: EmailTemplate) => {
 setEditing(tpl);
 setForm({
 name: tpl.name,
 subject: tpl.subject,
 body_html: tpl.body_html,
 body_text: tpl.body_text,
 category: tpl.category,
 });
 setShowModal(true);
 };

 const extractPlaceholders = (text: string): string[] => {
 const matches = text.match(/\{\{(\w+\.\w+|\w+)\}\}/g) || [];
 return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
 };

 const handleSave = async () => {
 if (!form.name || !form.subject) {
 toast('Vyplňte název a předmět', 'error');
 return;
 }
 setSaving(true);

 const placeholders = extractPlaceholders(form.subject + form.body_html + form.body_text);

 if (editing) {
 const { error } = await supabase
 .from('email_templates')
 .update({
 ...form,
 placeholders_used: placeholders,
 updated_at: new Date().toISOString(),
 })
 .eq('id', editing.id);
 if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
 toast('Šablona aktualizována');
 } else {
 const { error } = await supabase
 .from('email_templates')
 .insert({
 ...form,
 placeholders_used: placeholders,
 created_by: user!.id,
 });
 if (error) { toast('Chyba při vytváření', 'error'); setSaving(false); return; }
 toast('Šablona vytvořena');
 }

 setSaving(false);
 setShowModal(false);
 loadTemplates();
 };

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu smazat tuto šablonu?')) return;
 const { error } = await supabase.from('email_templates').delete().eq('id', id);
 if (error) { toast('Chyba při mazání', 'error'); return; }
 toast('Šablona smazána');
 loadTemplates();
 };

 const handleDuplicate = async (tpl: EmailTemplate) => {
 const { error } = await supabase.from('email_templates').insert({
 name: `${tpl.name} (kopie)`,
 subject: tpl.subject,
 body_html: tpl.body_html,
 body_text: tpl.body_text,
 category: tpl.category,
 placeholders_used: tpl.placeholders_used,
 created_by: user!.id,
 });
 if (error) { toast('Chyba při duplikaci', 'error'); return; }
 toast('Šablona duplikována');
 loadTemplates();
 };

 const insertPlaceholder = (key: string) => {
 const tag = `{{${key}}}`;
 setForm(prev => ({ ...prev, body_html: prev.body_html + tag }));
 };

 const filtered = templates.filter(t => {
 if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
 if (filterCategory && t.category !== filterCategory) return false;
 return true;
 });

 if (loading) {
 return (
 <div className="p-6 space-y-4">
 {[1, 2, 3].map(i => <div key={i} className="h-16 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse"/>)}
 </div>
 );
 }

 return (
 <div className="p-6 space-y-6">
 <div className="flex items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-3 mb-1">
 <FileText className="w-6 h-6 text-slate-300"/>
 <h1 className="text-xl font-bold text-white">Emailové šablony</h1>
 </div>
 <p className="text-sm text-slate-400">Připravte si šablony emailu s podporou zástupných znaku</p>
 </div>
 <button
 onClick={openCreate}
 className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500/100/100 transition"
 >
 <Plus className="w-4 h-4"/>
 Nová šablona
 </button>
 </div>

 <div className="flex items-center gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Hledat šablony..."
 className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition"
 />
 </div>
 <select
 value={filterCategory}
 onChange={(e) => setFilterCategory(e.target.value)}
 className="px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition"
 >
 <option value="">Všechny kategorie</option>
 {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
 </select>
 </div>

 {filtered.length === 0 ? (
 <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-12 text-center">
 <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3"/>
 <p className="text-sm font-semibold text-slate-500">Zatím žádné šablony</p>
 <p className="text-xs text-slate-500 mt-1">Vytvořte emailovou šablonu s podporou zástupných znaku</p>
 </div>
 ) : (
 <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
 <table className="w-full">
 <thead>
 <tr className="bg-white/[0.06]/[0.04]">
 <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Název</th>
 <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Předmět</th>
 <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Kategorie</th>
 <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Placeholdery</th>
 <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">Akce</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-white/[0.06]">
 {filtered.map((tpl) => (
 <tr key={tpl.id} className="hover:bg-white/[0.06]/[0.04] transition">
 <td className="px-5 py-3">
 <span className="text-sm font-semibold text-white">{tpl.name}</span>
 </td>
 <td className="px-5 py-3">
 <span className="text-sm text-slate-400 truncate block max-w-[200px]">{tpl.subject}</span>
 </td>
 <td className="px-5 py-3">
 <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.general}`}>
 {CATEGORIES.find(c => c.value === tpl.category)?.label || tpl.category}
 </span>
 </td>
 <td className="px-5 py-3">
 <span className="text-xs text-slate-400">{tpl.placeholders_used.length} použitých</span>
 </td>
 <td className="px-5 py-3">
 <div className="flex items-center justify-end gap-1">
 <button onClick={() => setPreviewTemplate(tpl)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.07] text-slate-400 hover:text-slate-300 transition"title="Náhled">
 <Eye className="w-4 h-4"/>
 </button>
 <button onClick={() => handleDuplicate(tpl)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.07] text-slate-400 hover:text-slate-300 transition"title="Duplikovat">
 <Copy className="w-4 h-4"/>
 </button>
 <button onClick={() => openEdit(tpl)} className="p-1.5 rounded-lg hover:bg-blue-500/100/100/15 text-slate-400 hover:text-blue-400 transition"title="Upravit">
 <Edit2 className="w-4 h-4"/>
 </button>
 <button onClick={() => handleDelete(tpl.id)} className="p-1.5 rounded-lg hover:bg-red-500/100/100/15 text-slate-400 hover:text-red-400 transition"title="Smazat">
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 <Modal
 open={showModal}
 onClose={() => setShowModal(false)}
 title={editing ? 'Upravit šablonu' : 'Nová e-mailová šablona'}
 size="xl"
 footer={
 <>
 <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-xl transition">
 Zrušit
 </button>
 <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-500/100/100 transition disabled:opacity-50">
 {saving ? 'Ukládám...' : editing ? 'Uložit změny' : 'Vytvořit'}
 </button>
 </>
 }
 >
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název šablony</label>
 <input
 value={form.name}
 onChange={(e) => setForm({ ...form, name: e.target.value })}
 placeholder="Např. Potvrzení objednávky"
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie</label>
 <select
 value={form.category}
 onChange={(e) => setForm({ ...form, category: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition"
 >
 {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
 </select>
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1.5">Předmět emailu</label>
 <input
 value={form.subject}
 onChange={(e) => setForm({ ...form, subject: e.target.value })}
 placeholder="Předmět s podporou {{zástupných_znaku}}"
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition"
 />
 </div>

 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label className="text-xs font-semibold text-slate-400">Tělo emailu (HTML)</label>
 <button
 onClick={() => setShowPlaceholders(!showPlaceholders)}
 className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
 >
 <Code className="w-3.5 h-3.5"/>
 {showPlaceholders ? 'Skryt zastupne znaky' : 'Zobrazit zastupne znaky'}
 </button>
 </div>

 {showPlaceholders && (
 <div className="mb-3 p-3 bg-white/[0.06]/[0.04] rounded-xl border border-white/[0.08]">
 <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Kliknutím vložíte do těla emailu</div>
 <div className="flex flex-wrap gap-1.5">
 {PLACEHOLDER_REGISTRY.map((p) => (
 <button
 key={p.key}
 onClick={() => insertPlaceholder(p.key)}
 className="text-[11px] font-mono px-2 py-1 rounded-lg bg-white/[0.06]/[0.06] border border-white/10 text-slate-400 hover:bg-blue-500/100/100/15 hover:border-blue-500/25 hover:text-blue-300 transition"
 title={p.description}
 >
 {`{{${p.key}}}`}
 </button>
 ))}
 </div>
 </div>
 )}

 <textarea
 value={form.body_html}
 onChange={(e) => setForm({ ...form, body_html: e.target.value })}
 rows={12}
 placeholder="<h1>Dobrý den {{client.name}},</h1><p>Váš projekt {{project.name}} ...</p>"
 className="w-full px-3.5 py-2.5 text-sm font-mono border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition resize-y"
 />
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1.5">Textová verze (nepovinné)</label>
 <textarea
 value={form.body_text}
 onChange={(e) => setForm({ ...form, body_text: e.target.value })}
 rows={4}
 placeholder="Plaintext verze emailu..."
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition resize-y"
 />
 </div>
 </div>
 </Modal>

 <Modal
 open={!!previewTemplate}
 onClose={() => setPreviewTemplate(null)}
 title={`Náhled: ${previewTemplate?.name || ''}`}
 size="xl"
 >
 {previewTemplate && (
 <div className="space-y-4">
 <div className="p-3 bg-white/[0.06]/[0.04] rounded-xl border border-white/[0.08]">
 <div className="text-xs font-semibold text-slate-500 mb-1">Předmět:</div>
 <div className="text-sm font-medium text-white">{previewTemplate.subject}</div>
 </div>
 <div className="border border-white/[0.08] rounded-xl overflow-hidden">
 <div className="bg-white/[0.06]/[0.04] px-4 py-2 border-b border-white/[0.08]">
 <span className="text-xs font-semibold text-slate-500">HTML náhled</span>
 </div>
 <div
 className="p-4 prose prose-sm max-w-none"
 dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewTemplate.body_html) }}
 />
 </div>
 {previewTemplate.placeholders_used.length > 0 && (
 <div className="p-3 bg-white/[0.06]/[0.04] rounded-xl">
 <div className="text-xs font-semibold text-slate-500 mb-2">Použité zástupné znaky:</div>
 <div className="flex flex-wrap gap-1.5">
 {previewTemplate.placeholders_used.map(p => (
 <span key={p} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06]/[0.06] border border-white/10 text-slate-400">
 {`{{${p}}}`}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </Modal>
 </div>
 );
}
