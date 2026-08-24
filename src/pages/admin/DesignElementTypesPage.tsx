import { useEffect, useState, useMemo, useRef } from 'react';
import { sanitizeSvg } from '../../lib/sanitize';
import { Plus, Pencil, Trash2, X, Check, Search, GripVertical, ChevronDown, ChevronRight, Palette, RotateCcw, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { DesignElementType } from '../../types/designElements';
import { ELEMENT_CATEGORIES, getCategoryName } from '../../types/designElements';
import { renderPinIcon, FLOORPLAN_ICONS, ICON_CATEGORIES, addCustomIcon, getCustomIcons, updateCustomIcon, removeCustomIcon } from '../../components/catalog/floorplan/iconLibrary';
import { useCategoryColors } from '../../hooks/useCategoryColors';

const emptyForm = {
  name: '',
  slug: '',
  category: 'elektro',
  subcategory: '',
  icon: 'dot',
  layer: 'elektro',
  sort_order: 0,
};

export default function DesignElementTypesPage() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const [types, setTypes] = useState<DesignElementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [expandedIconCats, setExpandedIconCats] = useState<Set<string>>(new Set(ICON_CATEGORIES));
  const [editingColorCat, setEditingColorCat] = useState<string | null>(null);
  const [iconPickerTab, setIconPickerTab] = useState<'library' | 'svg'>('library');
  const [svgInput, setSvgInput] = useState('');
  const [svgName, setSvgName] = useState('');
  const [svgPreviewError, setSvgPreviewError] = useState('');
  const [customIcons, setCustomIcons] = useState(() => getCustomIcons().filter((c) => c.svgContent));
  const [svgScale, setSvgScale] = useState(1);
  const [svgOffsetX, setSvgOffsetX] = useState(0);
  const [svgOffsetY, setSvgOffsetY] = useState(0);
  const [editingCustomIconId, setEditingCustomIconId] = useState<string | null>(null);
  const svgFileRef = useRef<HTMLInputElement>(null);
  const { colorMap, updateColor, resetToDefault, getColor: getCategoryColor } = useCategoryColors();

  const load = async () => {
    const { data, error } = await supabase
      .from('design_element_types')
      .select('*')
      .order('category')
      .order('sort_order')
      .order('name');
    if (error) {
      toast('Chyba při načítání', 'error');
    } else {
      setTypes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = types;
    if (activeCategory) {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.subcategory && t.subcategory.toLowerCase().includes(q))
      );
    }
    return result;
  }, [types, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of types) {
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    }
    return counts;
  }, [types]);

  const openNew = () => {
    setEditId(null);
    setForm({
      ...emptyForm,
      category: activeCategory || 'elektro',
      layer: activeCategory || 'elektro',
    });
    setShowForm(true);
  };

  const openEdit = (t: DesignElementType) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      slug: t.slug,
      category: t.category,
      subcategory: t.subcategory || '',
      icon: t.icon || 'dot',
      layer: t.layer || t.category,
      sort_order: t.sort_order,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setShowIconPicker(false);
    setIconPickerTab('library');
    setSvgInput('');
    setSvgName('');
    setSvgPreviewError('');
    setSvgScale(1);
    setSvgOffsetX(0);
    setSvgOffsetY(0);
    setEditingCustomIconId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast('Vyplňte název a slug', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, '_'),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      icon: form.icon || 'dot',
      layer: form.layer || form.category,
      sort_order: form.sort_order,
      org_id: orgId,
    };

    if (editId) {
      const { error } = await supabase.from('design_element_types').update(payload).eq('id', editId);
      if (error) {
        toast('Chyba při ukládání', 'error');
      } else {
        toast('Uloženo', 'success');
        closeForm();
        load();
      }
    } else {
      const { error } = await supabase.from('design_element_types').insert(payload);
      if (error) {
        toast('Chyba při vytváření', 'error');
      } else {
        toast('Vytvořeno', 'success');
        closeForm();
        load();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tuto značku?')) return;
    const { error } = await supabase.from('design_element_types').delete().eq('id', id);
    if (error) {
      toast('Chyba při mazání', 'error');
    } else {
      toast('Smazáno', 'success');
      load();
    }
  };

  const filteredIcons = useMemo(() => {
    const q = iconSearch.toLowerCase().trim();
    if (!q) return FLOORPLAN_ICONS;
    return FLOORPLAN_ICONS.filter(
      (i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
    );
  }, [iconSearch]);

  const iconsByCategory = useMemo(() => {
    const map = new Map<string, typeof FLOORPLAN_ICONS>();
    for (const icon of filteredIcons) {
      if (!map.has(icon.category)) map.set(icon.category, []);
      map.get(icon.category)!.push(icon);
    }
    return map;
  }, [filteredIcons]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Schématické značky</h1>
          <p className="text-sm text-slate-400 mt-1">
            Databáze značek pro schématický návrh
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Přidat značku
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-56 shrink-0">
          <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kategorie</h3>
            </div>
            <div className="p-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                  activeCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <span>Všechny</span>
                <span className="text-xs opacity-70">{types.length}</span>
              </button>
              {ELEMENT_CATEGORIES.map((cat) => {
                const count = categoryCounts.get(cat.id) ?? 0;
                const currentColor = colorMap[cat.id] ?? '#6b7280';
                const isEditingColor = editingColorCat === cat.id;
                return (
                  <div key={cat.id} className="relative group">
                    <button
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        activeCategory === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingColorCat(isEditingColor ? null : cat.id);
                          }}
                          className="w-4 h-4 rounded-full ring-2 ring-white/20 hover:ring-white/40 transition shrink-0"
                          style={{ backgroundColor: currentColor }}
                          title="Klikni pro změnu barvy"
                        />
                        <span>{cat.name}</span>
                      </div>
                      <span className="text-xs opacity-70">{count}</span>
                    </button>
                    {isEditingColor && (
                      <div className="absolute left-full top-0 ml-2 z-50 bg-navy-800 border border-white/10 rounded-xl p-3 shadow-xl min-w-[180px]">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Barva kategorie</div>
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => updateColor(cat.id, e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={currentColor}
                            onChange={(e) => {
                              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                                updateColor(cat.id, e.target.value);
                              }
                            }}
                            className="flex-1 px-2 py-1 text-xs font-mono bg-white/[0.06] border border-white/10 rounded text-slate-300"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              resetToDefault(cat.id);
                              toast('Barva obnovena na výchozí', 'info');
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-300 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Výchozí
                          </button>
                          <button
                            onClick={() => setEditingColorCat(null)}
                            className="px-2 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Hotovo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat značku..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-navy-800/30 rounded-2xl border border-white/5">
              <p className="text-slate-400 text-sm">Žádné značky nenalezeny</p>
            </div>
          ) : (
            <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Ikona</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Název</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Slug</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Kategorie</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Vrstva</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const catColor = colorMap[t.category] ?? '#6b7280';
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition"
                      >
                        <td className="px-4 py-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: catColor }}
                          >
                            {renderPinIcon(t.icon || 'dot', 18, 'text-white')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{t.name}</div>
                          {t.subcategory && (
                            <div className="text-xs text-slate-500">{t.subcategory}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded">
                            {t.slug}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ backgroundColor: `${catColor}20`, color: catColor }}
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                            {getCategoryName(t.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-300">{t.layer || t.category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(t)}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] transition text-slate-400 hover:text-white"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-navy-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                {editId ? 'Upravit značku' : 'Nová značka'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="shrink-0">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Ikona</label>
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="w-14 h-14 rounded-xl flex items-center justify-center border-2 border-dashed border-white/20 hover:border-blue-500/50 transition"
                    style={{ backgroundColor: getCategoryColor(form.category) }}
                  >
                    {renderPinIcon(form.icon, 24, 'text-white')}
                  </button>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Název *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Zásuvka dvojitá"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              {showIconPicker && (
                <div className="bg-navy-800 rounded-xl border border-white/10 overflow-hidden">
                  <div className="flex border-b border-white/10">
                    <button
                      onClick={() => setIconPickerTab('library')}
                      className={`flex-1 py-2 text-xs font-bold transition ${iconPickerTab === 'library' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Knihovna
                    </button>
                    <button
                      onClick={() => setIconPickerTab('svg')}
                      className={`flex-1 py-2 text-xs font-bold transition ${iconPickerTab === 'svg' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Vlastní SVG
                    </button>
                  </div>

                  {iconPickerTab === 'library' && (
                    <div className="p-3 max-h-60 overflow-auto">
                      <input
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        placeholder="Hledat ikonu..."
                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-medium mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <div className="space-y-2">
                        {Array.from(iconsByCategory.entries()).map(([catName, icons]) => {
                          const isExpanded = expandedIconCats.has(catName);
                          return (
                            <div key={catName}>
                              <button
                                onClick={() => {
                                  setExpandedIconCats((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(catName)) next.delete(catName);
                                    else next.add(catName);
                                    return next;
                                  });
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-400 hover:text-white transition"
                              >
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                {catName}
                              </button>
                              {isExpanded && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {icons.map((icon) => (
                                    <button
                                      key={icon.id}
                                      onClick={() => {
                                        setForm({ ...form, icon: icon.id });
                                        setShowIconPicker(false);
                                        setIconSearch('');
                                      }}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                                        form.icon === icon.id
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]'
                                      }`}
                                      title={icon.name}
                                    >
                                      {renderPinIcon(icon.id, 16)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {iconPickerTab === 'svg' && (
                    <div className="p-3 space-y-3 max-h-[420px] overflow-auto">
                      {customIcons.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-2">Uložené SVG ikony</p>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {customIcons.map((ic) => (
                              <div key={ic.id} className="relative group">
                                <button
                                  onClick={() => {
                                    if (editingCustomIconId === ic.id) {
                                      setEditingCustomIconId(null);
                                      setSvgInput('');
                                      setSvgName('');
                                      setSvgScale(1);
                                      setSvgOffsetX(0);
                                      setSvgOffsetY(0);
                                    } else {
                                      setEditingCustomIconId(ic.id);
                                      setSvgInput(ic.svgContent || '');
                                      setSvgName(ic.name);
                                      setSvgScale(ic.scale ?? 1);
                                      setSvgOffsetX(ic.offsetX ?? 0);
                                      setSvgOffsetY(ic.offsetY ?? 0);
                                      setForm({ ...form, icon: ic.id });
                                    }
                                  }}
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition border-2 ${
                                    form.icon === ic.id ? 'border-blue-500 bg-blue-600/30' : 'border-transparent bg-white/[0.06] hover:bg-white/[0.12]'
                                  }`}
                                  title={ic.name}
                                >
                                  {renderPinIcon(ic.id, 18)}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCustomIcon(ic.id);
                                    const updated = getCustomIcons().filter((c) => c.svgContent);
                                    setCustomIcons(updated);
                                    if (form.icon === ic.id) setForm({ ...form, icon: 'dot' });
                                    if (editingCustomIconId === ic.id) {
                                      setEditingCustomIconId(null);
                                      setSvgInput('');
                                    }
                                  }}
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold hidden group-hover:flex items-center justify-center"
                                  title="Smazat"
                                >×</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-bold text-slate-400 mb-2">
                          {editingCustomIconId ? 'Upravit SVG ikonu' : 'Nahrát novou SVG ikonu'}
                        </p>
                        <input
                          ref={svgFileRef}
                          type="file"
                          accept=".svg,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const text = ev.target?.result as string;
                              if (!text.includes('<svg')) {
                                setSvgPreviewError('Soubor neobsahuje platné SVG');
                                return;
                              }
                              setSvgInput(text);
                              setSvgPreviewError('');
                              if (!svgName) setSvgName(file.name.replace('.svg', ''));
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => svgFileRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/20 hover:border-blue-500/50 text-xs font-bold text-slate-400 hover:text-blue-400 transition mb-2"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Vybrat SVG soubor
                        </button>
                        <textarea
                          value={svgInput}
                          onChange={(e) => { setSvgInput(e.target.value); setSvgPreviewError(''); }}
                          placeholder="...nebo vložte SVG kód přímo"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                        />
                        {svgPreviewError && <p className="text-xs text-red-400 mt-1">{svgPreviewError}</p>}

                        {svgInput && !svgPreviewError && (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-visible"
                                  style={{ backgroundColor: getCategoryColor(form.category) }}
                                >
                                  {(() => {
                                    const scaledSize = Math.round(24 * svgScale);
                                    const normalized = svgInput
                                      .replace(/\s+width="[^"]*"/, '')
                                      .replace(/\s+height="[^"]*"/, '')
                                      .replace('<svg', `<svg width="${scaledSize}" height="${scaledSize}"`);
                                    return (
                                      <span
                                        style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${svgOffsetX}px), calc(-50% + ${svgOffsetY}px))` }}
                                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(normalized) }}
                                      />
                                    );
                                  })()}
                                </div>
                                <span className="text-[10px] text-slate-500">Náhled</span>
                              </div>
                              <div className="flex-1 space-y-2">
                                <div>
                                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                                    <span>Velikost (scale)</span>
                                    <span className="font-mono">{svgScale.toFixed(2)}×</span>
                                  </div>
                                  <input
                                    type="range" min="0.2" max="3" step="0.05"
                                    value={svgScale}
                                    onChange={(e) => setSvgScale(parseFloat(e.target.value))}
                                    className="w-full h-1.5 accent-blue-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                                    <span>Posun X</span>
                                    <span className="font-mono">{svgOffsetX}px</span>
                                  </div>
                                  <input
                                    type="range" min="-16" max="16" step="1"
                                    value={svgOffsetX}
                                    onChange={(e) => setSvgOffsetX(parseInt(e.target.value))}
                                    className="w-full h-1.5 accent-blue-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                                    <span>Posun Y</span>
                                    <span className="font-mono">{svgOffsetY}px</span>
                                  </div>
                                  <input
                                    type="range" min="-16" max="16" step="1"
                                    value={svgOffsetY}
                                    onChange={(e) => setSvgOffsetY(parseInt(e.target.value))}
                                    className="w-full h-1.5 accent-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => { setSvgScale(1); setSvgOffsetX(0); setSvgOffsetY(0); }}
                              className="text-[10px] text-slate-500 hover:text-blue-400 transition"
                            >
                              Resetovat zarovnání
                            </button>
                          </div>
                        )}

                        <input
                          value={svgName}
                          onChange={(e) => setSvgName(e.target.value)}
                          placeholder="Název ikony"
                          className="w-full mt-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                          onClick={() => {
                            if (!svgInput.includes('<svg')) {
                              setSvgPreviewError('Vložte platný SVG kód');
                              return;
                            }
                            const name = svgName.trim() || 'Vlastní ikona';
                            if (editingCustomIconId) {
                              updateCustomIcon(editingCustomIconId, {
                                svgContent: svgInput, name,
                                scale: svgScale, offsetX: svgOffsetX, offsetY: svgOffsetY,
                              });
                              setCustomIcons(getCustomIcons().filter((c) => c.svgContent));
                              setForm({ ...form, icon: editingCustomIconId });
                            } else {
                              const id = `svg_custom_${Date.now()}`;
                              addCustomIcon({ id, name, category: 'Vlastní', letter: '', color: '', svgContent: svgInput, scale: svgScale, offsetX: svgOffsetX, offsetY: svgOffsetY });
                              setCustomIcons(getCustomIcons().filter((c) => c.svgContent));
                              setForm({ ...form, icon: id });
                            }
                            setShowIconPicker(false);
                            setSvgInput('');
                            setSvgName('');
                            setSvgScale(1);
                            setSvgOffsetX(0);
                            setSvgOffsetY(0);
                            setEditingCustomIconId(null);
                          }}
                          disabled={!svgInput}
                          className="w-full mt-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition"
                        >
                          {editingCustomIconId ? 'Uložit změny' : 'Použít tuto ikonu'}
                        </button>
                        {editingCustomIconId && (
                          <button
                            onClick={() => {
                              setEditingCustomIconId(null);
                              setSvgInput('');
                              setSvgName('');
                              setSvgScale(1);
                              setSvgOffsetX(0);
                              setSvgOffsetY(0);
                            }}
                            className="w-full mt-1 py-2 rounded-lg border border-white/10 text-xs font-bold text-slate-400 hover:text-white transition"
                          >
                            Zrušit úpravu
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Slug (identifikátor) *</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="zasuvka_dvojita"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Kategorie</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value, layer: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {ELEMENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Vrstva (pro zobrazení)</label>
                  <select
                    value={form.layer}
                    onChange={(e) => setForm({ ...form, layer: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {ELEMENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Podkategorie</label>
                <input
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                  placeholder="např. zásuvky, osvětlení..."
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Pořadí řazení</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition"
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editId ? 'Uložit' : 'Vytvořit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
