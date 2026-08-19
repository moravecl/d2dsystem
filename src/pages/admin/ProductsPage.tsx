import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Eye, EyeOff, Copy, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Product, Category, Subcategory } from '../../types/database';
import ProductForm from '../../components/admin/ProductForm';
import ProductImport from '../../components/admin/ProductImport';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [subCatFilter, setSubCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const [{ data: prods }, { data: cats }, { data: subs }] = await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*').order('sort_order'),
    ]);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setSubcategories(subs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
    const matchesCat = !catFilter || p.category_id === catFilter;
    const matchesSubCat = !subCatFilter || p.subcategory_id === subCatFilter;
    return matchesSearch && matchesCat && matchesSubCat;
  });

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const subCatName = (id: string | null) => id ? subcategories.find((s) => s.id === id)?.name ?? '' : '';
  const filteredSubcategories = catFilter ? subcategories.filter(s => s.category_id === catFilter) : subcategories;

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat položku?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast(error.message, 'error');
    else { toast('Položka smazána'); load(); }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) toast(error.message, 'error');
    else load();
  };

  const openNew = () => { setEditProduct(null); setShowForm(true); };
  const openEdit = (p: Product) => { setEditProduct(p); setShowForm(true); };

  const handleDuplicate = async (p: Product) => {
    const { id, created_at, updated_at, ...rest } = p as Product & Record<string, unknown>;
    const { error } = await supabase.from('products').insert({
      ...rest,
      name: `${p.name} (kopie)`,
      code: `${p.code}-COPY`,
    });
    if (error) toast(error.message, 'error');
    else { toast('Položka duplikována'); load(); }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditProduct(null);
    load();
  };

  if (loading) return <div className="p-8 text-slate-400">Načítám...</div>;

  if (showImport) {
    return (
      <ProductImport
        categories={categories}
        onClose={() => setShowImport(false)}
        onDone={() => { setShowImport(false); load(); }}
      />
    );
  }

  if (showForm) {
    return (
      <ProductForm
        product={editProduct}
        categories={categories}
        subcategories={subcategories}
        onSave={handleSaved}
        onCancel={() => { setShowForm(false); setEditProduct(null); }}
      />
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Položky</h1>
          <p className="text-sm text-slate-400 mt-1">{products.length} položek celkem</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="bg-emerald-500/100/15 text-emerald-400 px-5 py-2.5 rounded-xl font-extrabold hover:bg-emerald-500/100/25 transition flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Import z XLS
          </button>
          <button onClick={openNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition shadow-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Přidat položku
          </button>
        </div>
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
            placeholder="Hledat dle názvu, kódu, značky..." />
        </div>
        <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setSubCatFilter(''); }}
          className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50">
          <option value="">Vše kategorie</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {filteredSubcategories.length > 0 && (
          <select value={subCatFilter} onChange={(e) => setSubCatFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50">
            <option value="">Vše podkategorie</option>
            {filteredSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-900/50 border-b border-white/[0.07]">
              <tr>
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Položka</th>
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Kód</th>
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Kategorie</th>
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Značka</th>
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Cena</th>
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Stav</th>
                <th className="text-right p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.06] hover:bg-white/[0.06]/[0.04] transition">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {p.image_url && (
                        <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/[0.08]" />
                      )}
                      <div className="min-w-0">
                        <div className="font-extrabold text-white truncate">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.kind === 'design_series' ? 'Design řada' : 'Normální'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-extrabold text-slate-300">{p.code}</td>
                  <td className="p-4 text-slate-400">
                    <div>{catName(p.category_id)}</div>
                    {subCatName(p.subcategory_id) && (
                      <div className="text-xs text-slate-500">{subCatName(p.subcategory_id)}</div>
                    )}
                  </td>
                  <td className="p-4 text-slate-400">{p.brand}</td>
                  <td className="p-4 font-extrabold text-slate-300">{p.price > 0 ? `${p.price} Kč` : '—'}</td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(p)} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${p.is_active ? 'bg-emerald-500/100/15 text-emerald-400' : 'bg-white/[0.06]/[0.07] text-slate-400'}`}>
                      {p.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {p.is_active ? 'Aktivní' : 'Skryto'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleDuplicate(p)} title="Duplikovat" className="p-2 rounded-lg hover:bg-emerald-500/100/10 transition">
                        <Copy className="w-4 h-4 text-emerald-500" />
                      </button>
                      <button onClick={() => openEdit(p)} title="Upravit" className="p-2 rounded-lg hover:bg-blue-500/100/100/10 transition">
                        <Pencil className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} title="Smazat" className="p-2 rounded-lg hover:bg-red-500/100/100/10 transition">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-extrabold">
                    Žádné položky nenalezeny
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
