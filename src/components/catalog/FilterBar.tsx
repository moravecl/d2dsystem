import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, X, SlidersHorizontal } from 'lucide-react';
import type { Category, Subcategory, Product } from '../../types/database';

export interface CustomFilter {
  field: string;
  value: string;
}

const FILTER_FIELDS: { key: string; label: string; getter: (p: Product) => string }[] = [
  { key: 'tag', label: 'Tag', getter: (p) => p.tag },
  { key: 'trade', label: 'Řemeslo', getter: (p) => p.trade },
  { key: 'kind', label: 'Typ', getter: (p) => p.kind },
  { key: 'code', label: 'Kód', getter: (p) => p.code },
];

interface Props {
  categories: Category[];
  subcategories: Subcategory[];
  products: Product[];
  currentCat: string;
  currentSubCat: string;
  search: string;
  brand: string;
  power: string;
  onCatChange: (slug: string) => void;
  onSubCatChange: (id: string) => void;
  onSearchChange: (val: string) => void;
  onBrandChange: (val: string) => void;
  onPowerChange: (val: string) => void;
  customFilters: CustomFilter[];
  onCustomFiltersChange: (filters: CustomFilter[]) => void;
}

function AddFilterDropdown({ products, onAdd, onClose }: { products: Product[]; onAdd: (f: CustomFilter) => void; onClose: () => void }) {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const fieldDef = FILTER_FIELDS.find((f) => f.key === field);
  const availableValues = fieldDef
    ? Array.from(new Set(products.map(fieldDef.getter).filter(Boolean))).sort()
    : [];

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1.5 bg-navy-800/60 border border-white/[0.08] rounded-xl shadow-xl z-50 p-3 w-72 animate-dropdown-enter">
      <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Nový filtr</div>
      <select
        value={field}
        onChange={(e) => { setField(e.target.value); setValue(''); }}
        className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-2"
      >
        <option value="">Výběr pole...</option>
        {FILTER_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>

      {field && (
        <>
          {availableValues.length > 0 ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-2"
            >
              <option value="">Výběr hodnotu...</option>
              {availableValues.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Zadej hodnotu..."
              className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-2"
            />
          )}

          <button
            onClick={() => { if (field && value) { onAdd({ field, value }); onClose(); } }}
            disabled={!value}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-extrabold text-sm hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Přidat filtr
          </button>
        </>
      )}
    </div>
  );
}

export default function FilterBar({
  categories,
  subcategories,
  products,
  currentCat,
  currentSubCat,
  search,
  brand,
  power,
  onCatChange,
  onSubCatChange,
  onSearchChange,
  onBrandChange,
  onPowerChange,
  customFilters,
  onCustomFiltersChange,
}: Props) {
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort();
  const [showAddFilter, setShowAddFilter] = useState(false);

  const activeCat = categories.find(c => c.slug === currentCat);
  const visibleSubcategories = useMemo(() => {
    if (!activeCat) return [];
    const subs = subcategories.filter(s => s.category_id === activeCat.id);
    const subIds = new Set(subs.map(s => s.id));
    const usedSubIds = new Set(
      products
        .filter(p => p.category_id === activeCat.id && p.subcategory_id && subIds.has(p.subcategory_id))
        .map(p => p.subcategory_id!)
    );
    return subs.filter(s => usedSubIds.has(s.id));
  }, [activeCat, subcategories, products]);

  const removeCustomFilter = (idx: number) => {
    onCustomFiltersChange(customFilters.filter((_, i) => i !== idx));
  };

  const addCustomFilter = (f: CustomFilter) => {
    const exists = customFilters.some((cf) => cf.field === f.field && cf.value === f.value);
    if (!exists) onCustomFiltersChange([...customFilters, f]);
  };

  return (
    <div className="bg-navy-800/60 rounded-3xl  border border-white/[0.06] p-5 mb-6 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => { onCatChange('vse'); onSubCatChange(''); }}
          className={`px-4 py-2 rounded-xl text-sm font-extrabold  transition ${
            currentCat === 'vse'
              ? 'bg-slate-900 text-white'
              : 'bg-navy-800/60 border border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'
          }`}
        >
          Vše
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { onCatChange(cat.slug); onSubCatChange(''); }}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold  transition ${
              currentCat === cat.slug
                ? 'bg-slate-900 text-white'
                : 'bg-navy-800/60 border border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {visibleSubcategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mr-1">Podkategorie:</span>
          <button
            onClick={() => onSubCatChange('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
              !currentSubCat
                ? 'bg-slate-800 text-white'
                : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
            }`}
          >
            Vše
          </button>
          {visibleSubcategories.map((sub) => (
            <button
              key={sub.id}
              onClick={() => onSubCatChange(sub.id === currentSubCat ? '' : sub.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                currentSubCat === sub.id
                  ? 'bg-slate-800 text-white'
                  : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-xl border border-white/10 bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-sm"
            placeholder="Hledat... (název, kód, značka)"
          />
        </div>

        <select
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-blue-500/20 font-extrabold text-sm w-full sm:w-auto"
        >
          <option value="vse">Značka: Vše</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={power}
          onChange={(e) => onPowerChange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-blue-500/20 font-extrabold text-sm w-full sm:w-auto"
        >
          <option value="vse">Napájení: Vše</option>
          <option value="24V">24V</option>
          <option value="230V">230V</option>
          <option value="Tree/Air">Tree/Air</option>
        </select>

        <div className="relative">
          <button
            onClick={() => setShowAddFilter(!showAddFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-extrabold transition ${
              customFilters.length > 0
                ? 'bg-blue-500/10 border-blue-200 text-blue-400 hover:bg-blue-500/20'
                : 'bg-white/[0.06] border-white/10 text-slate-500 hover:bg-white/[0.04]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <Plus className="w-3 h-3" />
          </button>
          {showAddFilter && (
            <AddFilterDropdown
              products={products}
              onAdd={addCustomFilter}
              onClose={() => setShowAddFilter(false)}
            />
          )}
        </div>
      </div>

      {customFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customFilters.map((cf, idx) => {
            const fieldDef = FILTER_FIELDS.find((f) => f.key === cf.field);
            return (
              <div
                key={`${cf.field}-${cf.value}-${idx}`}
                className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-xl text-xs font-extrabold"
              >
                <span className="text-blue-500">{fieldDef?.label || cf.field}:</span>
                <span>{cf.value}</span>
                <button
                  onClick={() => removeCustomFilter(idx)}
                  className="text-blue-400 hover:text-blue-400 transition ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={() => onCustomFiltersChange([])}
            className="text-xs font-extrabold text-slate-400 hover:text-slate-400 transition px-2 py-1.5"
          >
            Smazat vše
          </button>
        </div>
      )}
    </div>
  );
}
