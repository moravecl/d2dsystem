import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, ArrowUp, ArrowDown, Image, CircleDot } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import IconPicker from '../../components/catalog/floorplan/IconPicker';
import { renderPinIcon } from '../../components/catalog/floorplan/iconLibrary';
import type { DesignModule } from '../../types/database';

export default function DesignModulesPage() {
 const [modules, setModules] = useState<DesignModule[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editId, setEditId] = useState<string | null>(null);
 const [name, setName] = useState('');
 const [price, setPrice] = useState('');
 const [iconUrl, setIconUrl] = useState('');
 const [saving, setSaving] = useState(false);
 const [showIconPicker, setShowIconPicker] = useState(false);
 const { toast } = useToast();

 const load = async () => {
 const { data } = await supabase.from('design_modules').select('*').order('sort_order');
 setModules(data ?? []);
 setLoading(false);
 };

 useEffect(() => { load(); }, []);

 const openNew = () => {
 setEditId(null);
 setName('');
 setPrice('');
 setIconUrl('');
 setShowForm(true);
 };

 const openEdit = (m: DesignModule) => {
 setEditId(m.id);
 setName(m.name);
 setPrice(m.price > 0 ? String(m.price) : '');
 setIconUrl(m.icon_url ?? '');
 setShowForm(true);
 };

 const handleSave = async () => {
 if (!name.trim()) { toast('Vyplňte název modulu', 'error'); return; }
 setSaving(true);
 const priceNum = parseFloat(price.replace(',', '.'));
 const payload = {
 name,
 price: isNaN(priceNum) ? 0 : priceNum,
 icon_url: iconUrl.trim() || null,
 };

 if (editId) {
 const { error } = await supabase.from('design_modules').update(payload).eq('id', editId);
 if (error) toast(error.message, 'error'); else toast('Modul upraven');
 } else {
 const maxOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.sort_order)) + 1 : 1;
 const { error } = await supabase.from('design_modules').insert({ ...payload, sort_order: maxOrder });
 if (error) toast(error.message, 'error'); else toast('Modul přidán');
 }
 setSaving(false);
 setShowForm(false);
 load();
 };

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu smazat modul?')) return;
 const { error } = await supabase.from('design_modules').delete().eq('id', id);
 if (error) toast(error.message, 'error'); else { toast('Smazano'); load(); }
 };

 const moveOrder = async (mod: DesignModule, dir: -1 | 1) => {
 const idx = modules.findIndex((m) => m.id === mod.id);
 const swapIdx = idx + dir;
 if (swapIdx < 0 || swapIdx >= modules.length) return;
 const other = modules[swapIdx];
 await Promise.all([
 supabase.from('design_modules').update({ sort_order: other.sort_order }).eq('id', mod.id),
 supabase.from('design_modules').update({ sort_order: mod.sort_order }).eq('id', other.id),
 ]);
 load();
 };

 if (loading) return <div className="p-8 text-slate-400">Načítám...</div>;

 return (
 <div className="p-8">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-extrabold text-white">Design moduly</h1>
 <p className="text-sm text-slate-400 mt-1">Typy vložek pro designové řady (zásuvka, vypínač, atd.) s cenami a ikonami</p>
 </div>
 <button onClick={openNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition flex items-center gap-2">
 <Plus className="w-4 h-4"/> Přidat modul
 </button>
 </div>

 {showForm && (
 <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-extrabold text-white">{editId ? 'Upravit modul' : 'Nový modul'}</h3>
 <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-300 transition"><X className="w-5 h-5"/></button>
 </div>
 <div className="space-y-3">
 <div className="grid grid-cols-[1fr_160px] gap-3">
 <div>
 <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Název</label>
 <input
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="např. Zásuvka, Vypínač č.6"
 />
 </div>
 <div>
 <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Cena (Kč)</label>
 <input
 value={price}
 onChange={(e) => setPrice(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="0"
 />
 </div>
 </div>
 <div>
 <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Ikona (nepovinné)</label>
 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={() => setShowIconPicker(true)}
 className="w-10 h-10 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.06]/[0.06] flex items-center justify-center shrink-0 hover:border-blue-500/50 hover:bg-blue-500/100/100/10 transition group"
 >
 {iconUrl ? (
 renderPinIcon(iconUrl, 20, 'text-slate-300') ?? <CircleDot className="w-4 h-4 text-slate-500"/>
 ) : (
 <CircleDot className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition"/>
 )}
 </button>
 <span className="text-sm text-slate-400">{iconUrl || 'Vyberte ikonu'}</span>
 {iconUrl && (
 <button type="button"onClick={() => setIconUrl('')} className="text-xs text-red-400 hover:text-red-300 font-semibold transition">
 Odebrat
 </button>
 )}
 </div>
 </div>
 <div className="flex justify-end">
 <button onClick={handleSave} disabled={saving}
 className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition disabled:opacity-60 flex items-center gap-2">
 <Check className="w-4 h-4"/> {saving ? 'Ukládám...' : 'Uložit'}
 </button>
 </div>
 </div>
 </div>
 )}

 <div className="space-y-2">
 {modules.map((mod, idx) => (
 <div key={mod.id} className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 flex items-center gap-4 hover:bg-white/[0.06]/[0.04] transition">
 <div className="w-10 h-10 rounded-xl bg-amber-500/100/15 text-amber-300 flex items-center justify-center font-extrabold text-sm shrink-0 overflow-hidden">
 {mod.icon_url ? (
 renderPinIcon(mod.icon_url, 20, 'text-amber-300') ?? mod.sort_order
 ) : (
 mod.sort_order
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-extrabold text-white">{mod.name}</div>
 {mod.price > 0 && (
 <div className="text-xs font-semibold text-blue-400">{mod.price.toLocaleString('cs-CZ')} Kč</div>
 )}
 </div>
 <div className="flex items-center gap-1">
 <button onClick={() => moveOrder(mod, -1)} disabled={idx === 0} className="p-2 rounded-lg hover:bg-white/[0.06]/[0.07] disabled:opacity-30 transition"><ArrowUp className="w-4 h-4 text-slate-400"/></button>
 <button onClick={() => moveOrder(mod, 1)} disabled={idx === modules.length - 1} className="p-2 rounded-lg hover:bg-white/[0.06]/[0.07] disabled:opacity-30 transition"><ArrowDown className="w-4 h-4 text-slate-400"/></button>
 <button onClick={() => openEdit(mod)} className="p-2 rounded-lg hover:bg-blue-500/100/100/15 transition"><Pencil className="w-4 h-4 text-blue-400"/></button>
 <button onClick={() => handleDelete(mod.id)} className="p-2 rounded-lg hover:bg-red-500/100/100/15 transition"><Trash2 className="w-4 h-4 text-red-400"/></button>
 </div>
 </div>
 ))}
 {modules.length === 0 && (
 <div className="text-center py-16 text-slate-500">
 <div className="w-16 h-16 rounded-2xl bg-white/[0.06]/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
 <Image className="w-7 h-7 text-slate-400"/>
 </div>
 <p className="font-extrabold text-slate-500">Zatím žádné moduly</p>
 </div>
 )}
 </div>

 {showIconPicker && (
 <IconPicker
 currentIcon={iconUrl || undefined}
 onSelect={(id) => { setIconUrl(id ?? ''); setShowIconPicker(false); }}
 onClose={() => setShowIconPicker(false)}
 />
 )}
 </div>
 );
}
