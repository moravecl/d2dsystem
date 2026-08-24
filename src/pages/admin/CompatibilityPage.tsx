import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, X, Check, Star, AlertTriangle, HelpCircle, Trash2, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useDesignElementTypes } from '../../hooks/useDesignElementTypes';
import { useCatalogData } from '../../hooks/useCatalogData';
import { getCategoryColor } from '../../types/designElements';
import { renderPinIcon } from '../../components/catalog/floorplan/iconLibrary';
import type { Product } from '../../types/database';

interface CompatibilityRecord {
  id: string;
  element_type_id: string;
  product_id: string;
  compatibility_type: 'recommended' | 'compatible' | 'incompatible';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const COMPATIBILITY_OPTIONS = [
  { value: 'recommended', label: 'Doporuceno', icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  { value: 'compatible', label: 'Kompatibilni', icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { value: 'incompatible', label: 'Nekompatibilni', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
] as const;

export default function CompatibilityPage() {
  const { toast } = useToast();
  const { types: elementTypes, loading: typesLoading } = useDesignElementTypes();
  const { products, loading: productsLoading } = useCatalogData();

  const [records, setRecords] = useState<CompatibilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [filterCompat, setFilterCompat] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    productId: '',
    compatibilityType: 'compatible' as 'recommended' | 'compatible' | 'incompatible',
    notes: '',
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('element_type_product_compatibility')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast(`Chyba: ${error.message}`);
    } else {
      setRecords(data as CompatibilityRecord[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filteredTypes = useMemo(() => {
    if (!typeSearch.trim()) return elementTypes;
    const q = typeSearch.toLowerCase();
    return elementTypes.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    );
  }, [elementTypes, typeSearch]);

  const selectedType = useMemo(
    () => elementTypes.find((t) => t.id === selectedTypeId),
    [elementTypes, selectedTypeId]
  );

  const selectedTypeRecords = useMemo(() => {
    if (!selectedTypeId) return [];
    let filtered = records.filter((r) => r.element_type_id === selectedTypeId);
    if (filterCompat) {
      filtered = filtered.filter((r) => r.compatibility_type === filterCompat);
    }
    return filtered;
  }, [records, selectedTypeId, filterCompat]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const getProductById = (id: string): Product | undefined => products.find((p) => p.id === id);

  const handleAddCompatibility = async () => {
    if (!selectedTypeId || !addForm.productId) {
      toast('Vyberte produkt');
      return;
    }

    const existing = records.find(
      (r) => r.element_type_id === selectedTypeId && r.product_id === addForm.productId
    );
    if (existing) {
      toast('Tato kombinace jiz existuje');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('element_type_product_compatibility')
      .insert({
        element_type_id: selectedTypeId,
        product_id: addForm.productId,
        compatibility_type: addForm.compatibilityType,
        notes: addForm.notes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast(`Chyba: ${error.message}`);
    } else {
      setRecords((prev) => [data as CompatibilityRecord, ...prev]);
      setShowAddModal(false);
      setAddForm({ productId: '', compatibilityType: 'compatible', notes: '' });
      toast('Kompatibilita pridana');
    }
    setSaving(false);
  };

  const handleUpdateCompatibility = async (
    recordId: string,
    newType: 'recommended' | 'compatible' | 'incompatible'
  ) => {
    const { error } = await supabase
      .from('element_type_product_compatibility')
      .update({ compatibility_type: newType, updated_at: new Date().toISOString() })
      .eq('id', recordId);

    if (error) {
      toast(`Chyba: ${error.message}`);
    } else {
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, compatibility_type: newType } : r))
      );
      toast('Aktualizovano');
    }
  };

  const handleDeleteCompatibility = async (recordId: string) => {
    const { error } = await supabase
      .from('element_type_product_compatibility')
      .delete()
      .eq('id', recordId);

    if (error) {
      toast(`Chyba: ${error.message}`);
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      toast('Odebrano');
    }
  };

  const compatCounts = useMemo(() => {
    const counts: Record<string, { recommended: number; compatible: number; incompatible: number }> = {};
    for (const r of records) {
      if (!counts[r.element_type_id]) {
        counts[r.element_type_id] = { recommended: 0, compatible: 0, incompatible: 0 };
      }
      counts[r.element_type_id][r.compatibility_type]++;
    }
    return counts;
  }, [records]);

  if (typesLoading || productsLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Kompatibilita prvku a produktu</h1>
        <p className="text-sm text-slate-400 mt-1">
          Nastavte doporucene, kompatibilni a nekompatibilni produkty pro jednotlive typy schematickych prvku
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  placeholder="Hledat typ prvku..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredTypes.map((type) => {
                const catColor = getCategoryColor(type.category);
                const counts = compatCounts[type.id];
                const isSelected = selectedTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedTypeId(type.id)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition flex items-center gap-3 ${
                      isSelected ? 'bg-blue-600/20' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: catColor }}
                    >
                      {renderPinIcon(type.icon || 'dot', 18, 'text-white')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">{type.name}</div>
                      <div className="text-xs text-slate-500">{type.category}</div>
                    </div>
                    {counts && (
                      <div className="flex items-center gap-1">
                        {counts.recommended > 0 && (
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                            {counts.recommended}
                          </span>
                        )}
                        {counts.compatible > 0 && (
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                            {counts.compatible}
                          </span>
                        )}
                        {counts.incompatible > 0 && (
                          <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold">
                            {counts.incompatible}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-8">
          {selectedType ? (
            <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: getCategoryColor(selectedType.category) }}
                  >
                    {renderPinIcon(selectedType.icon || 'dot', 22, 'text-white')}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedType.name}</h2>
                    <p className="text-xs text-slate-400">
                      {selectedTypeRecords.length} produktu s nastavenou kompatibilitou
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Pridat produkt
                </button>
              </div>

              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mr-2">Filtr:</span>
                <button
                  onClick={() => setFilterCompat(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterCompat === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.06] text-slate-400 hover:text-white'
                  }`}
                >
                  Vse
                </button>
                {COMPATIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterCompat(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      filterCompat === opt.value
                        ? `${opt.bg} ${opt.color}`
                        : 'bg-white/[0.06] text-slate-400 hover:text-white'
                    }`}
                  >
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {selectedTypeRecords.length === 0 ? (
                <div className="py-16 text-center">
                  <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Zadne produkty s nastavenou kompatibilitou</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
                  >
                    Pridat prvni produkt
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {selectedTypeRecords.map((record) => {
                    const product = getProductById(record.product_id);
                    if (!product) return null;
                    return (
                      <div
                        key={record.id}
                        className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/[0.06] overflow-hidden flex items-center justify-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500 text-xs font-bold">{product.code.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm truncate">{product.name}</div>
                          <div className="text-xs text-slate-500">
                            {product.brand && <span>{product.brand} / </span>}
                            <span>{product.code}</span>
                            {product.kind === 'design_series' && (
                              <span className="ml-2 px-1.5 py-0.5 bg-teal-500/20 text-teal-400 rounded text-[9px] font-bold">
                                Designova rada
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {COMPATIBILITY_OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              onClick={() => handleUpdateCompatibility(record.id, o.value)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                                record.compatibility_type === o.value
                                  ? `${o.bg} ${o.color}`
                                  : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.08]'
                              }`}
                              title={o.label}
                            >
                              <o.icon className="w-4 h-4" />
                            </button>
                          ))}
                          <button
                            onClick={() => handleDeleteCompatibility(record.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition"
                            title="Odebrat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-navy-800/30 rounded-2xl border border-white/5 py-24 text-center">
              <HelpCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Vyberte typ prvku v levem panelu</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-900 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Pridat kompatibilni produkt</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-white/[0.06] transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Vyhledat produkt
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Nazev, kod nebo vyrobce..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.04]">
                  {filteredProducts.slice(0, 50).map((p) => {
                    const isSelected = addForm.productId === p.id;
                    const alreadyAdded = records.some(
                      (r) => r.element_type_id === selectedTypeId && r.product_id === p.id
                    );
                    return (
                      <button
                        key={p.id}
                        onClick={() => !alreadyAdded && setAddForm((f) => ({ ...f, productId: p.id }))}
                        disabled={alreadyAdded}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                          isSelected
                            ? 'bg-blue-600/20'
                            : alreadyAdded
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-500 text-[9px] font-bold">{p.code.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {p.brand && `${p.brand} / `}{p.code}
                            {alreadyAdded && <span className="ml-2 text-amber-400">Jiz pridano</span>}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Typ kompatibility
                </label>
                <div className="flex gap-2">
                  {COMPATIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAddForm((f) => ({ ...f, compatibilityType: opt.value }))}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition ${
                        addForm.compatibilityType === opt.value
                          ? `${opt.bg} ${opt.color} border-current`
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <opt.icon className="w-4 h-4" />
                      <span className="text-xs font-bold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Poznamka (volitelne)
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Napiste poznamku k teto kombinaci..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-sm font-bold text-slate-400 hover:bg-white/[0.06] transition"
              >
                Zrusit
              </button>
              <button
                onClick={handleAddCompatibility}
                disabled={!addForm.productId || saving}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Ukladam...' : 'Pridat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
