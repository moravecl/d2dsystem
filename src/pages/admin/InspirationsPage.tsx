import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Inspiration } from '../../types/database';
import InspirationForm from '../../components/admin/InspirationForm';

export default function InspirationsPage() {
 const [items, setItems] = useState<Inspiration[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editItem, setEditItem] = useState<Inspiration | null>(null);
 const { toast } = useToast();

 const load = async () => {
 const { data } = await supabase
 .from('inspirations')
 .select('*')
 .order('created_at', { ascending: false });
 setItems(data ?? []);
 setLoading(false);
 };

 useEffect(() => { load(); }, []);

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu smazat článek?')) return;
 const { error } = await supabase.from('inspirations').delete().eq('id', id);
 if (error) toast(error.message, 'error');
 else { toast('Článek smazán'); load(); }
 };

 const togglePublish = async (item: Inspiration) => {
 const { error } = await supabase.from('inspirations').update({
 is_published: !item.is_published,
 published_at: !item.is_published ? new Date().toISOString() : null,
 }).eq('id', item.id);
 if (error) toast(error.message, 'error');
 else load();
 };

 const openNew = () => { setEditItem(null); setShowForm(true); };
 const openEdit = (item: Inspiration) => { setEditItem(item); setShowForm(true); };
 const handleSaved = () => { setShowForm(false); setEditItem(null); load(); };

 if (loading) return <div className="p-8 text-slate-400">Načítám...</div>;

 if (showForm) {
 return (
 <InspirationForm
 inspiration={editItem}
 onSave={handleSaved}
 onCancel={() => { setShowForm(false); setEditItem(null); }}
 />
 );
 }

 return (
 <div className="p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-extrabold text-white">Inspirace</h1>
 <p className="text-sm text-slate-400 mt-1">{items.length} článků celkem</p>
 </div>
 <button onClick={openNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition flex items-center gap-2">
 <Plus className="w-4 h-4"/> Nový článek
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
 {items.map((item) => (
 <div key={item.id} className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden group hover:bg-white/[0.06]/[0.04] transition">
 {item.cover_image ? (
 <img src={item.cover_image} alt=""className="w-full h-40 object-cover"/>
 ) : (
 <div className="w-full h-40 bg-white/[0.06]/[0.04] flex items-center justify-center">
 <span className="text-4xl font-extrabold text-slate-400">?</span>
 </div>
 )}
 <div className="p-5">
 <div className="flex items-center gap-2 mb-2">
 {item.is_published ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25">
 <Eye className="w-3 h-3"/> Publikováno
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/100/15 text-amber-300 border border-amber-500/25">
 <EyeOff className="w-3 h-3"/> Koncept
 </span>
 )}
 {item.published_at && (
 <span className="text-[10px] text-slate-500 font-semibold">
 {new Date(item.published_at).toLocaleDateString('cs-CZ')}
 </span>
 )}
 </div>
 <h3 className="font-extrabold text-white text-base mb-1 line-clamp-2">{item.title}</h3>
 {item.excerpt && <p className="text-xs text-slate-400 line-clamp-2">{item.excerpt}</p>}

 <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
 <button onClick={() => openEdit(item)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.06]/[0.04] text-sm font-extrabold text-slate-300 hover:bg-blue-500/100/100/15 hover:text-blue-300 transition">
 <Pencil className="w-3.5 h-3.5"/> Upravit
 </button>
 <button onClick={() => togglePublish(item)} className="p-2 rounded-xl hover:bg-white/[0.06]/[0.07] transition"title={item.is_published ? 'Skryt' : 'Publikovat'}>
 {item.is_published ? <EyeOff className="w-4 h-4 text-amber-400"/> : <Eye className="w-4 h-4 text-emerald-400"/>}
 </button>
 <button onClick={() => handleDelete(item.id)} className="p-2 rounded-xl hover:bg-red-500/100/100/15 transition">
 <Trash2 className="w-4 h-4 text-red-400"/>
 </button>
 </div>
 </div>
 </div>
 ))}

 {items.length === 0 && (
 <div className="col-span-full bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-12 text-center">
 <div className="text-lg font-extrabold text-slate-500 mb-1">Žádné články</div>
 <div className="text-sm text-slate-500">Vytvořte první článek s inspirací z vašich realizací.</div>
 </div>
 )}
 </div>
 </div>
 );
}
