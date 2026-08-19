import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Category, Subcategory } from '../../types/database';

const ICON_OPTIONS = ['cpu', 'lightbulb', 'zap', 'plug-zap', 'wind', 'layers', 'home', 'settings', 'wrench', 'cable'];
const COLOR_OPTIONS = [
 { pill: 'bg-emerald-600', soft: 'bg-emerald-500/10', text: 'text-emerald-900', border: 'border-emerald-200', label: 'Zelená' },
 { pill: 'bg-yellow-500/100', soft: 'bg-yellow-500/10', text: 'text-yellow-900', border: 'border-yellow-200', label: 'Žlutá' },
 { pill: 'bg-amber-600', soft: 'bg-amber-500/10', text: 'text-amber-900', border: 'border-amber-200', label: 'Oranžová' },
 { pill: 'bg-blue-600', soft: 'bg-blue-500/10', text: 'text-blue-900', border: 'border-blue-200', label: 'Modrá' },
 { pill: 'bg-cyan-600', soft: 'bg-cyan-50', text: 'text-cyan-900', border: 'border-cyan-200', label: 'Cyan' },
 { pill: 'bg-red-600', soft: 'bg-red-500/10', text: 'text-red-900', border: 'border-red-200', label: 'Červená' },
 { pill: 'bg-slate-800', soft: 'bg-white/[0.04]', text: 'text-white', border: 'border-white/10', label: 'Šedá' },
];

const emptyForm = { name: '', slug: '', icon: 'layers', colorIdx: 6 };
const emptySubForm = { name: '', slug: '' };

export default function CategoriesPage() {
 const [categories, setCategories] = useState<Category[]>([]);
 const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editId, setEditId] = useState<string | null>(null);
 const [form, setForm] = useState(emptyForm);
 const [saving, setSaving] = useState(false);
 const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
 const [subForm, setSubForm] = useState(emptySubForm);
 const [showSubForm, setShowSubForm] = useState<string | null>(null);
 const [editSubId, setEditSubId] = useState<string | null>(null);
 const [savingSub, setSavingSub] = useState(false);
 const { toast } = useToast();

 const load = async () => {
 const [{ data: cats }, { data: subs }] = await Promise.all([
 supabase.from('categories').select('*').order('sort_order'),
 supabase.from('subcategories').select('*').order('sort_order'),
 ]);
 setCategories(cats ?? []);
 setSubcategories(subs ?? []);
 setLoading(false);
 };

 useEffect(() => { load(); }, []);

 const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

 const toggleExpand = (catId: string) => {
 setExpandedCats(prev => {
 const next = new Set(prev);
 if (next.has(catId)) next.delete(catId);
 else next.add(catId);
 return next;
 });
 };

 const openNew = () => {
 setEditId(null);
 setForm(emptyForm);
 setShowForm(true);
 };

 const openEdit = (cat: Category) => {
 const cidx = COLOR_OPTIONS.findIndex((c) => c.pill === cat.pill_color);
 setEditId(cat.id);
 setForm({ name: cat.name, slug: cat.slug, icon: cat.icon, colorIdx: cidx >= 0 ? cidx : 6 });
 setShowForm(true);
 };

 const handleSave = async () => {
 if (!form.name.trim()) { toast('Vyplňte název', 'error'); return; }
 setSaving(true);
 const color = COLOR_OPTIONS[form.colorIdx];
 const slug = form.slug || slugify(form.name);

 if (editId) {
 const { error } = await supabase.from('categories').update({
 name: form.name, slug, icon: form.icon,
 pill_color: color.pill, soft_color: color.soft, text_color: color.text, border_color: color.border,
 }).eq('id', editId);
 if (error) toast(error.message, 'error');
 else toast('Kategorie upravena');
 } else {
 const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 1;
 const { error } = await supabase.from('categories').insert({
 name: form.name, slug, icon: form.icon,
 pill_color: color.pill, soft_color: color.soft, text_color: color.text, border_color: color.border,
 sort_order: maxOrder,
 });
 if (error) toast(error.message, 'error');
 else toast('Kategorie přidána');
 }
 setSaving(false);
 setShowForm(false);
 load();
 };

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu smazat kategorii? Smaže se i všechny položky v ní.')) return;
 const { error } = await supabase.from('categories').delete().eq('id', id);
 if (error) toast(error.message, 'error');
 else { toast('Smazano'); load(); }
 };

 const moveOrder = async (cat: Category, dir: -1 | 1) => {
 const idx = categories.findIndex((c) => c.id === cat.id);
 const swapIdx = idx + dir;
 if (swapIdx < 0 || swapIdx >= categories.length) return;
 const other = categories[swapIdx];
 await Promise.all([
 supabase.from('categories').update({ sort_order: other.sort_order }).eq('id', cat.id),
 supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', other.id),
 ]);
 load();
 };

 const subsForCat = (catId: string) => subcategories.filter(s => s.category_id === catId);

 const openNewSub = (catId: string) => {
 setEditSubId(null);
 setSubForm(emptySubForm);
 setShowSubForm(catId);
 setExpandedCats(prev => new Set(prev).add(catId));
 };

 const openEditSub = (sub: Subcategory) => {
 setEditSubId(sub.id);
 setSubForm({ name: sub.name, slug: sub.slug });
 setShowSubForm(sub.category_id);
 };

 const handleSaveSub = async (catId: string) => {
 if (!subForm.name.trim()) { toast('Vyplňte název podkategorie', 'error'); return; }
 setSavingSub(true);
 const slug = subForm.slug || slugify(subForm.name);

 if (editSubId) {
 const { error } = await supabase.from('subcategories').update({
 name: subForm.name, slug,
 }).eq('id', editSubId);
 if (error) toast(error.message, 'error');
 else toast('Podkategorie upravena');
 } else {
 const subs = subsForCat(catId);
 const maxOrder = subs.length > 0 ? Math.max(...subs.map(s => s.sort_order)) + 1 : 1;
 const { error } = await supabase.from('subcategories').insert({
 category_id: catId,
 name: subForm.name,
 slug,
 sort_order: maxOrder,
 });
 if (error) toast(error.message, 'error');
 else toast('Podkategorie přidána');
 }
 setSavingSub(false);
 setShowSubForm(null);
 setEditSubId(null);
 load();
 };

 const handleDeleteSub = async (id: string) => {
 if (!confirm('Opravdu smazat podkategorii?')) return;
 const { error } = await supabase.from('subcategories').delete().eq('id', id);
 if (error) toast(error.message, 'error');
 else { toast('Podkategorie smazána'); load(); }
 };

 if (loading) return <div className="p-8 text-slate-400">Načítám...</div>;

 return (
 <div className="p-8">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-extrabold text-white">Kategorie</h1>
 <p className="text-sm text-slate-400 mt-1">{categories.length} kategorii, {subcategories.length} podkategorii</p>
 </div>
 <button onClick={openNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition shadow-lg flex items-center gap-2">
 <Plus className="w-4 h-4"/> Přidat kategorii
 </button>
 </div>

 {showForm && (
 <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-extrabold text-white">{editId ? 'Upravit kategorii' : 'Nová kategorie'}</h3>
 <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-300"><X className="w-5 h-5"/></button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Název</label>
 <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
 className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"placeholder="např. Svítidla"/>
 </div>
 <div>
 <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Slug</label>
 <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
 className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-slate-400 placeholder:text-slate-500 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"/>
 </div>
 <div>
 <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Ikona</label>
 <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
 className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50">
 {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
 </select>
 </div>
 <div>
 <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Barva</label>
 <div className="flex flex-wrap gap-2 mt-1">
 {COLOR_OPTIONS.map((c, idx) => (
 <button key={idx} onClick={() => setForm({ ...form, colorIdx: idx })}
 className={`w-10 h-10 rounded-xl ${c.pill} ${form.colorIdx === idx ? 'ring-4 ring-blue-400/50 scale-110' : ''} transition`}
 title={c.label} />
 ))}
 </div>
 </div>
 </div>
 <div className="mt-4 flex gap-2">
 <button onClick={handleSave} disabled={saving}
 className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition disabled:opacity-60 flex items-center gap-2">
 <Check className="w-4 h-4"/> {saving ? 'Ukládám...' : 'Uložit'}
 </button>
 <button onClick={() => setShowForm(false)} className="text-slate-400 px-5 py-2.5 rounded-xl font-extrabold hover:bg-white/[0.06]/[0.07] transition">
 Zrušit
 </button>
 </div>
 </div>
 )}

 <div className="space-y-2">
 {categories.map((cat, idx) => {
 const subs = subsForCat(cat.id);
 const isExpanded = expandedCats.has(cat.id);

 return (
 <div key={cat.id}>
 <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 flex items-center gap-4 hover:bg-white/[0.06]/[0.04] transition">
 <button
 onClick={() => toggleExpand(cat.id)}
 className="p-1 rounded-lg hover:bg-white/[0.06]/[0.07] transition"
 >
 {isExpanded
 ? <ChevronDown className="w-4 h-4 text-slate-400"/>
 : <ChevronRight className="w-4 h-4 text-slate-400"/>
 }
 </button>
 <div className={`w-10 h-10 rounded-xl ${cat.pill_color} text-white flex items-center justify-center font-extrabold text-sm shadow`}>
 {cat.sort_order}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-extrabold text-white">{cat.name}</div>
 <div className="text-xs text-slate-400">
 {cat.slug} | ikona: {cat.icon}
 {subs.length > 0 && <span className="ml-2 text-blue-400">{subs.length} podkategorii</span>}
 </div>
 </div>
 <div className="flex items-center gap-1">
 <button onClick={() => openNewSub(cat.id)} title="Přidat podkategorii"
 className="p-2 rounded-lg hover:bg-emerald-500/100/10 transition">
 <Plus className="w-4 h-4 text-emerald-500"/>
 </button>
 <button onClick={() => moveOrder(cat, -1)} disabled={idx === 0}
 className="p-2 rounded-lg hover:bg-white/[0.06]/[0.07] disabled:opacity-30 transition">
 <ArrowUp className="w-4 h-4 text-slate-400"/>
 </button>
 <button onClick={() => moveOrder(cat, 1)} disabled={idx === categories.length - 1}
 className="p-2 rounded-lg hover:bg-white/[0.06]/[0.07] disabled:opacity-30 transition">
 <ArrowDown className="w-4 h-4 text-slate-400"/>
 </button>
 <button onClick={() => openEdit(cat)} className="p-2 rounded-lg hover:bg-blue-500/100/100/10 transition">
 <Pencil className="w-4 h-4 text-blue-500"/>
 </button>
 <button onClick={() => handleDelete(cat.id)} className="p-2 rounded-lg hover:bg-red-500/100/100/10 transition">
 <Trash2 className="w-4 h-4 text-red-500"/>
 </button>
 </div>
 </div>

 {isExpanded && (
 <div className="ml-14 mt-1 space-y-1">
 {subs.map((sub) => (
 <div key={sub.id} className="bg-navy-900/50 rounded-xl px-4 py-3 flex items-center gap-3 group hover:bg-white/[0.06]/[0.07] transition">
 <div className="w-6 h-6 rounded-lg bg-white/[0.06]/[0.07] text-slate-400 flex items-center justify-center text-[10px] font-extrabold">
 {sub.sort_order}
 </div>
 <div className="flex-1 min-w-0">
 <span className="font-extrabold text-slate-300 text-sm">{sub.name}</span>
 <span className="text-xs text-slate-500 ml-2">{sub.slug}</span>
 </div>
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
 <button onClick={() => openEditSub(sub)} className="p-1.5 rounded-lg hover:bg-blue-500/100/100/10 transition">
 <Pencil className="w-3.5 h-3.5 text-blue-500"/>
 </button>
 <button onClick={() => handleDeleteSub(sub.id)} className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 transition">
 <Trash2 className="w-3.5 h-3.5 text-red-500"/>
 </button>
 </div>
 </div>
 ))}

 {showSubForm === cat.id && (
 <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4">
 <div className="text-xs font-extrabold text-slate-400 mb-2">
 {editSubId ? 'Upravit podkategorii' : 'Nova podkategorie'}
 </div>
 <div className="flex gap-2 items-end">
 <div className="flex-1">
 <input
 value={subForm.name}
 onChange={(e) => setSubForm({ name: e.target.value, slug: slugify(e.target.value) })}
 className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
 placeholder="Nazev podkategorie"
 autoFocus
 />
 </div>
 <div className="w-32">
 <input
 value={subForm.slug}
 onChange={(e) => setSubForm({ ...subForm, slug: e.target.value })}
 className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06]/[0.06] text-slate-400 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
 placeholder="slug"
 />
 </div>
 <button
 onClick={() => handleSaveSub(cat.id)}
 disabled={savingSub}
 className="px-4 py-2 bg-blue-600 text-white rounded-lg font-extrabold text-sm hover:bg-blue-500/100/100 transition disabled:opacity-60"
 >
 <Check className="w-4 h-4"/>
 </button>
 <button
 onClick={() => { setShowSubForm(null); setEditSubId(null); }}
 className="px-3 py-2 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-white/[0.06]/[0.07] transition"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>
 </div>
 )}

 {subs.length === 0 && showSubForm !== cat.id && (
 <div className="text-xs text-slate-500 py-2 px-4">
 Zadne podkategorie
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 {categories.length === 0 && (
 <div className="text-center py-16 text-slate-500">
 <p className="font-extrabold">Zatím žádné kategorie</p>
 <p className="text-sm mt-1">Přidejte první kategorii tlačítkem výše.</p>
 </div>
 )}
 </div>
 </div>
 );
}
