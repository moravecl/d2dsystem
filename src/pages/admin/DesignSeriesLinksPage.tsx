import { useState, useMemo } from 'react';
import { Search, Plus, X, Check, Star, Trash2, AlertTriangle, ChevronRight, Package, Grid2x2 as Grid, Layers } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useCatalogData } from '../../hooks/useCatalogData';
import { useDesignSeriesLinks } from '../../hooks/useDesignSeriesLinks';
import type { Product } from '../../types/database';

const FRAME_ROLES = [
  { key: 'frame_1', label: 'Ramecek 1R' },
  { key: 'frame_2_horizontal', label: 'Ramecek 2R (vodorovny)' },
  { key: 'frame_2_vertical', label: 'Ramecek 2R (svisly)' },
  { key: 'frame_3_horizontal', label: 'Ramecek 3R (vodorovny)' },
  { key: 'frame_3_vertical', label: 'Ramecek 3R (svisly)' },
  { key: 'frame_4_horizontal', label: 'Ramecek 4R (vodorovny)' },
  { key: 'frame_4_vertical', label: 'Ramecek 4R (svisly)' },
  { key: 'frame_5_horizontal', label: 'Ramecek 5R (vodorovny)' },
  { key: 'frame_5_vertical', label: 'Ramecek 5R (svisly)' },
];

const COMMON_MODULE_ROLES = [
  { key: 'switch_single', label: 'Jednoduchy vypinac' },
  { key: 'switch_double', label: 'Dvojity vypinac' },
  { key: 'switch_dimmer', label: 'Stmivac' },
  { key: 'socket_single', label: 'Zasuvka jednoducha' },
  { key: 'socket_double', label: 'Zasuvka dvojita' },
  { key: 'socket_usb', label: 'Zasuvka USB' },
  { key: 'socket_data', label: 'Datova zasuvka' },
  { key: 'socket_tv', label: 'TV zasuvka' },
  { key: 'thermostat', label: 'Termostat' },
  { key: 'blind_control', label: 'Ovladani zaluzii' },
];

export default function DesignSeriesLinksPage() {
  const { toast } = useToast();
  const { products, loading: productsLoading } = useCatalogData();
  const { links, loading: linksLoading, addLink, updateLink, removeLink } = useDesignSeriesLinks();

  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesSearch, setSeriesSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addForm, setAddForm] = useState({
    roleKey: '',
    productId: '',
    isDefault: true,
    priority: 0,
    notes: '',
  });

  const designSeriesProducts = useMemo(() => {
    return products.filter((p) => p.kind === 'design_series');
  }, [products]);

  const filteredSeries = useMemo(() => {
    if (!seriesSearch.trim()) return designSeriesProducts;
    const q = seriesSearch.toLowerCase();
    return designSeriesProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
  }, [designSeriesProducts, seriesSearch]);

  const selectedSeries = useMemo(
    () => designSeriesProducts.find((p) => p.id === selectedSeriesId),
    [designSeriesProducts, selectedSeriesId]
  );

  const selectedSeriesLinks = useMemo(() => {
    if (!selectedSeriesId) return [];
    return links.filter((l) => l.design_series_id === selectedSeriesId);
  }, [links, selectedSeriesId]);

  const linksByRole = useMemo(() => {
    const map = new Map<string, typeof selectedSeriesLinks>();
    for (const link of selectedSeriesLinks) {
      if (!map.has(link.role_key)) {
        map.set(link.role_key, []);
      }
      map.get(link.role_key)!.push(link);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return b.priority - a.priority;
      });
    }
    return map;
  }, [selectedSeriesLinks]);

  const allRoleKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const link of selectedSeriesLinks) {
      keys.add(link.role_key);
    }
    return Array.from(keys).sort();
  }, [selectedSeriesLinks]);

  const normalProducts = useMemo(() => {
    return products.filter((p) => p.kind !== 'design_series');
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return normalProducts;
    const q = productSearch.toLowerCase();
    return normalProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
  }, [normalProducts, productSearch]);

  const getProductById = (id: string): Product | undefined => products.find((p) => p.id === id);

  const missingFrameRoles = useMemo(() => {
    const existing = new Set(allRoleKeys);
    return FRAME_ROLES.filter((r) => !existing.has(r.key));
  }, [allRoleKeys]);

  const missingModuleRoles = useMemo(() => {
    const existing = new Set(allRoleKeys);
    return COMMON_MODULE_ROLES.filter((r) => !existing.has(r.key));
  }, [allRoleKeys]);

  const validationSummary = useMemo(() => {
    const warnings: { type: 'frame' | 'module'; label: string; key: string }[] = [];
    for (const r of missingFrameRoles) {
      warnings.push({ type: 'frame', label: r.label, key: r.key });
    }
    for (const r of missingModuleRoles) {
      warnings.push({ type: 'module', label: r.label, key: r.key });
    }
    return warnings;
  }, [missingFrameRoles, missingModuleRoles]);

  const linkCountBySeries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.design_series_id, (counts.get(link.design_series_id) ?? 0) + 1);
    }
    return counts;
  }, [links]);

  const handleAddLink = async () => {
    if (!selectedSeriesId || !addForm.roleKey || !addForm.productId) {
      toast('Vyplnte vsechna pole');
      return;
    }

    setSaving(true);
    const result = await addLink({
      designSeriesId: selectedSeriesId,
      productId: addForm.productId,
      roleKey: addForm.roleKey,
      isDefault: addForm.isDefault,
      priority: addForm.priority,
      notes: addForm.notes.trim() || undefined,
    });

    if (result.error) {
      toast(`Chyba: ${result.error}`);
    } else {
      setShowAddModal(false);
      setAddForm({ roleKey: '', productId: '', isDefault: true, priority: 0, notes: '' });
      toast('Mapovani pridano');
    }
    setSaving(false);
  };

  const handleToggleDefault = async (linkId: string, currentDefault: boolean) => {
    const result = await updateLink(linkId, { isDefault: !currentDefault });
    if (result.error) {
      toast(`Chyba: ${result.error}`);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    const result = await removeLink(linkId);
    if (result.error) {
      toast(`Chyba: ${result.error}`);
    } else {
      toast('Mapovani odebrano');
    }
  };

  if (productsLoading || linksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mapovani designovych rad</h1>
        <p className="text-sm text-slate-400 mt-1">
          Prirazujte produkty k rolim (ramecky, moduly) v jednotlivych designovych radach
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={seriesSearch}
                  onChange={(e) => setSeriesSearch(e.target.value)}
                  placeholder="Hledat designovou radu..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredSeries.length === 0 ? (
                <div className="py-12 text-center">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Zadne designove rady</p>
                </div>
              ) : (
                filteredSeries.map((series) => {
                  const isSelected = selectedSeriesId === series.id;
                  const linkCount = linkCountBySeries.get(series.id) ?? 0;
                  return (
                    <button
                      key={series.id}
                      onClick={() => setSelectedSeriesId(series.id)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 transition flex items-center gap-3 ${
                        isSelected ? 'bg-teal-600/20' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-teal-500/20 overflow-hidden flex items-center justify-center shrink-0">
                        {series.image_url ? (
                          <img src={series.image_url} alt={series.name} className="w-full h-full object-cover" />
                        ) : (
                          <Grid className="w-5 h-5 text-teal-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{series.name}</div>
                        <div className="text-xs text-slate-500">
                          {series.brand && `${series.brand} / `}{series.code}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {linkCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold">
                            {linkCount} mapovani
                          </span>
                        )}
                        <ChevronRight className={`w-4 h-4 transition ${isSelected ? 'text-teal-400' : 'text-slate-600'}`} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="col-span-8">
          {selectedSeries ? (
            <div className="space-y-4">
              <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 overflow-hidden flex items-center justify-center">
                      {selectedSeries.image_url ? (
                        <img src={selectedSeries.image_url} alt={selectedSeries.name} className="w-full h-full object-cover" />
                      ) : (
                        <Grid className="w-6 h-6 text-teal-400" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedSeries.name}</h2>
                      <p className="text-xs text-slate-400">
                        {selectedSeries.brand && `${selectedSeries.brand} / `}{selectedSeries.code}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Pridat mapovani
                  </button>
                </div>

                {validationSummary.length > 0 && (
                  <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-amber-400">
                          Chybi mapovani ({validationSummary.length})
                        </div>
                        {missingFrameRoles.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider mb-1">
                              Ramecky ({missingFrameRoles.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {missingFrameRoles.map((r) => (
                                <button
                                  key={r.key}
                                  onClick={() => {
                                    setAddForm((f) => ({ ...f, roleKey: r.key }));
                                    setShowAddModal(true);
                                  }}
                                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/30 transition"
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {missingModuleRoles.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider mb-1">
                              Moduly ({missingModuleRoles.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {missingModuleRoles.map((r) => (
                                <button
                                  key={r.key}
                                  onClick={() => {
                                    setAddForm((f) => ({ ...f, roleKey: r.key }));
                                    setShowAddModal(true);
                                  }}
                                  className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 text-[10px] font-bold hover:bg-slate-500/30 transition"
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {allRoleKeys.length === 0 ? (
                  <div className="py-16 text-center">
                    <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Zadne mapovani pro tuto designovou radu</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition"
                    >
                      Pridat prvni mapovani
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {allRoleKeys.map((roleKey) => {
                      const roleLinks = linksByRole.get(roleKey) || [];
                      const frameRole = FRAME_ROLES.find((r) => r.key === roleKey);
                      const moduleRole = COMMON_MODULE_ROLES.find((r) => r.key === roleKey);
                      const roleLabel = frameRole?.label || moduleRole?.label || roleKey;
                      const isFrame = !!frameRole;
                      return (
                        <div key={roleKey} className="px-5 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isFrame ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'
                              }`}
                            >
                              {isFrame ? 'Ramecek' : 'Modul'}
                            </span>
                            <span className="text-sm font-bold text-white">{roleLabel}</span>
                            <code className="text-[10px] text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                              {roleKey}
                            </code>
                          </div>
                          <div className="space-y-1">
                            {roleLinks.map((link) => {
                              const product = getProductById(link.product_id);
                              if (!product) return null;
                              return (
                                <div
                                  key={link.id}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] transition"
                                >
                                  <div className="w-8 h-8 rounded bg-white/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                                    {product.image_url ? (
                                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-slate-500 text-[9px] font-bold">{product.code.slice(0, 2)}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white truncate">{product.name}</div>
                                    <div className="text-[10px] text-slate-500">{product.code}</div>
                                  </div>
                                  <button
                                    onClick={() => handleToggleDefault(link.id, link.is_default)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${
                                      link.is_default
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.08]'
                                    }`}
                                  >
                                    <Star className="w-3 h-3" />
                                    {link.is_default ? 'Vychozi' : 'Alternativa'}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveLink(link.id)}
                                    className="w-7 h-7 rounded flex items-center justify-center bg-white/[0.04] text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-navy-800/30 rounded-2xl border border-white/5 py-24 text-center">
              <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Vyberte designovou radu v levem panelu</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-900 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Pridat mapovani produktu</h3>
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
                  Role (klic)
                </label>
                <select
                  value={addForm.roleKey}
                  onChange={(e) => setAddForm((f) => ({ ...f, roleKey: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                >
                  <option value="">-- Vyberte roli --</option>
                  <optgroup label="Ramecky">
                    {FRAME_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Bezne moduly">
                    {COMMON_MODULE_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </optgroup>
                </select>
                <div className="mt-2">
                  <input
                    type="text"
                    value={addForm.roleKey}
                    onChange={(e) => setAddForm((f) => ({ ...f, roleKey: e.target.value }))}
                    placeholder="Nebo zadejte vlastni klic..."
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
              </div>

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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.04]">
                  {filteredProducts.slice(0, 30).map((p) => {
                    const isSelected = addForm.productId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setAddForm((f) => ({ ...f, productId: p.id }))}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                          isSelected ? 'bg-teal-600/20' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="w-7 h-7 rounded bg-white/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-500 text-[8px] font-bold">{p.code.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500">{p.brand && `${p.brand} / `}{p.code}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.isDefault}
                    onChange={(e) => setAddForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/20 bg-white/[0.06] text-teal-500 focus:ring-teal-500/30"
                  />
                  <span className="text-sm text-slate-300">Nastavit jako vychozi</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Priorita:</label>
                  <input
                    type="number"
                    value={addForm.priority}
                    onChange={(e) => setAddForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-2 py-1 rounded border border-white/10 bg-white/[0.04] text-sm text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Poznamka (volitelne)
                </label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Napiste poznamku..."
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
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
                onClick={handleAddLink}
                disabled={!addForm.roleKey || !addForm.productId || saving}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
