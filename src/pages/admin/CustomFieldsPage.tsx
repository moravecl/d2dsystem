import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, GripVertical, ToggleLeft, ToggleRight, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';

interface FieldDef {
 id: string;
 name: string;
 field_type: string;
 options: string[];
 is_required: boolean;
 section: string;
 position: number;
 is_active: boolean;
}

const FIELD_TYPES: { key: string; label: string }[] = [
 { key: 'text', label: 'Text' },
 { key: 'textarea', label: 'Dlouhý text' },
 { key: 'number', label: 'Číslo' },
 { key: 'date', label: 'Datum' },
 { key: 'select', label: 'Výběr z možností' },
 { key: 'checkbox', label: 'Zaškrtávátko (Ano/Ne)' },
 { key: 'url', label: 'URL odkaz' },
 { key: 'email', label: 'E-mail' },
];

export default function CustomFieldsPage() {
 const { organization } = useOrganization();
 const { toast } = useToast();
 const [fields, setFields] = useState<FieldDef[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editField, setEditField] = useState<FieldDef | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<FieldDef | null>(null);

 const [form, setForm] = useState({
 name: '',
 field_type: 'text',
 options: [] as string[],
 is_required: false,
 section: '',
 });
 const [optionInput, setOptionInput] = useState('');

 const orgId = organization?.id;

 const load = async () => {
 if (!orgId) return;
 const { data } = await supabase
 .from('custom_field_definitions')
 .select('*')
 .eq('organization_id', orgId)
 .order('section')
 .order('position');
 setFields((data || []) as FieldDef[]);
 setLoading(false);
 };

 useEffect(() => { load(); }, [orgId]);

 const openCreate = () => {
 setEditField(null);
 setForm({ name: '', field_type: 'text', options: [], is_required: false, section: '' });
 setOptionInput('');
 setModalOpen(true);
 };

 const openEdit = (f: FieldDef) => {
 setEditField(f);
 setForm({
 name: f.name,
 field_type: f.field_type,
 options: f.options || [],
 is_required: f.is_required,
 section: f.section,
 });
 setOptionInput('');
 setModalOpen(true);
 };

 const handleSave = async () => {
 if (!form.name.trim()) { toast('Zadejte název pole', 'error'); return; }
 if (!orgId) return;

 if (editField) {
 await supabase.from('custom_field_definitions').update({
 name: form.name.trim(),
 field_type: form.field_type,
 options: form.options,
 is_required: form.is_required,
 section: form.section.trim(),
 }).eq('id', editField.id);
 toast('Pole aktualizováno', 'success');
 } else {
 const position = fields.length;
 await supabase.from('custom_field_definitions').insert({
 organization_id: orgId,
 name: form.name.trim(),
 field_type: form.field_type,
 options: form.options,
 is_required: form.is_required,
 section: form.section.trim(),
 position,
 });
 toast('Pole vytvořeno', 'success');
 }
 setModalOpen(false);
 load();
 };

 const toggleActive = async (f: FieldDef) => {
 await supabase.from('custom_field_definitions').update({ is_active: !f.is_active }).eq('id', f.id);
 setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, is_active: !x.is_active } : x)));
 };

 const handleDelete = async () => {
 if (!deleteTarget) return;
 await supabase.from('custom_field_definitions').delete().eq('id', deleteTarget.id);
 setDeleteTarget(null);
 toast('Pole smazáno', 'success');
 load();
 };

 const addOption = () => {
 if (!optionInput.trim()) return;
 setForm((prev) => ({ ...prev, options: [...prev.options, optionInput.trim()] }));
 setOptionInput('');
 };

 const removeOption = (idx: number) => {
 setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
 };

 const sections = [...new Set(fields.map((f) => f.section).filter(Boolean))];
 const filtered = fields.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));

 const groupedBySection: Record<string, FieldDef[]> = {};
 filtered.forEach((f) => {
 const sec = f.section || 'Bez sekce';
 if (!groupedBySection[sec]) groupedBySection[sec] = [];
 groupedBySection[sec].push(f);
 });

 const typeLabel = (t: string) => FIELD_TYPES.find((ft) => ft.key === t)?.label || t;

 if (loading) {
 return (
 <div className="p-6 space-y-4">
 {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse"/>)}
 </div>
 );
 }

 return (
 <div className="p-6 space-y-6">
 <div className="flex items-center justify-between gap-4">
 <div>
 <h1 className="text-xl font-bold text-white">Vlastní pole projektů</h1>
 <p className="text-sm text-slate-500 mt-1">Definujte vlastní specifikace a parametry, které se zobrazí u každého projektu</p>
 </div>
 <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
 <Plus className="w-4 h-4"/>
 Nové pole
 </button>
 </div>

 <div className="relative max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Hledat pole..."
 className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 />
 </div>

 {filtered.length === 0 ? (
 <div className="text-center py-16">
 <Settings2 className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
 <p className="text-sm text-slate-400">
 {fields.length === 0 ? 'Zatím žádná vlastní pole. Vytvořte první!' : 'Žádná pole neodpovídají filtru'}
 </p>
 </div>
 ) : (
 <div className="space-y-6">
 {Object.entries(groupedBySection).map(([section, sectionFields]) => (
 <div key={section}>
 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{section}</h3>
 <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
 {sectionFields.map((f) => (
 <div key={f.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04]/50 transition ${!f.is_active ? 'opacity-50' : ''}`}>
 <GripVertical className="w-4 h-4 text-slate-300 shrink-0"/>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-semibold text-white">{f.name}</span>
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">{typeLabel(f.field_type)}</span>
 {f.is_required && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Povinné</span>}
 {f.field_type === 'select' && f.options.length > 0 && (
 <span className="text-[10px] text-slate-400">{f.options.length} možností</span>
 )}
 </div>
 {f.section && <p className="text-[11px] text-slate-400 mt-0.5">{f.section}</p>}
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <button onClick={() => toggleActive(f)} className="p-2 rounded-lg hover:bg-white/[0.06] transition"title={f.is_active ? 'Deaktivovat' : 'Aktivovat'}>
 {f.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500"/> : <ToggleLeft className="w-5 h-5 text-slate-300"/>}
 </button>
 <button onClick={() => openEdit(f)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition">
 <Edit2 className="w-4 h-4"/>
 </button>
 <button onClick={() => setDeleteTarget(f)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-red-400 transition">
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}

 {modalOpen && (
 <Modal open onClose={() => setModalOpen(false)} title={editField ? 'Upravit pole' : 'Nové vlastní pole'} size="md">
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-1">Název pole *</label>
 <input
 value={form.name}
 onChange={(e) => setForm({ ...form, name: e.target.value })}
 placeholder="např. Typ střechy, Plocha podlah..."
 className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-1">Typ pole</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {FIELD_TYPES.map((ft) => (
 <button
 key={ft.key}
 onClick={() => setForm({ ...form, field_type: ft.key })}
 className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
 form.field_type === ft.key
 ? 'bg-blue-500/10 border-blue-300 text-blue-400'
 : 'bg-white/[0.06] border-white/10 text-slate-400 hover:bg-white/[0.04]'
 }`}
 >
 {ft.label}
 </button>
 ))}
 </div>
 </div>

 {form.field_type === 'select' && (
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-1">Možnosti výběru</label>
 <div className="flex gap-2 mb-2">
 <input
 value={optionInput}
 onChange={(e) => setOptionInput(e.target.value)}
 placeholder="Přidejte možnost..."
 className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 onKeyDown={(e) => e.key === 'Enter' && addOption()}
 />
 <button onClick={addOption} className="px-3 py-2 bg-white/[0.06] rounded-lg text-sm font-bold text-slate-400 hover:bg-white/[0.08] transition">
 <Plus className="w-4 h-4"/>
 </button>
 </div>
 {form.options.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {form.options.map((opt, i) => (
 <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.06] rounded-lg text-xs font-semibold text-slate-300">
 {opt}
 <button onClick={() => removeOption(i)} className="text-slate-400 hover:text-red-500 transition">
 <Trash2 className="w-3 h-3"/>
 </button>
 </span>
 ))}
 </div>
 )}
 </div>
 )}

 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-1">Sekce (seskupení)</label>
 <input
 value={form.section}
 onChange={(e) => setForm({ ...form, section: e.target.value })}
 placeholder="např. Technické údaje, Rozměry..."
 className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 list="section-suggestions"
 />
 {sections.length > 0 && (
 <datalist id="section-suggestions">
 {sections.map((s) => <option key={s} value={s} />)}
 </datalist>
 )}
 </div>

 <label className="flex items-center gap-3 cursor-pointer">
 <input
 type="checkbox"
 checked={form.is_required}
 onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
 className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500"
 />
 <span className="text-sm font-semibold text-slate-300">Povinné pole</span>
 </label>

 <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
 <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/[0.06] rounded-xl transition">
 Zrušit
 </button>
 <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
 {editField ? 'Uložit změny' : 'Vytvořit pole'}
 </button>
 </div>
 </div>
 </Modal>
 )}

 <Modal
 open={!!deleteTarget}
 onClose={() => setDeleteTarget(null)}
 title="Smazat pole"
 size="sm"
 footer={
 <>
 <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
 <button onClick={handleDelete} className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition">Smazat</button>
 </>
 }
 >
 <p className="text-sm text-slate-400">
 Pole "{deleteTarget?.name}"a všechny jeho hodnoty budou trvale smazány. Tato akce je nevratná.
 </p>
 </Modal>
 </div>
 );
}
