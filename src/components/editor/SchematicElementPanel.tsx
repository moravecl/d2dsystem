import { useState, useMemo, useRef } from 'react';
import { Search, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import type { DesignElementType, ProjectDesignElement } from '../../types/designElements';
import { ELEMENT_CATEGORIES } from '../../types/designElements';
import { renderPinIcon } from '../catalog/floorplan/iconLibrary';
import { useCategoryColors } from '../../hooks/useCategoryColors';

interface Props {
  elementTypes: DesignElementType[];
  placedElements: ProjectDesignElement[];
  activeTypeId: string | null;
  onStartPlacing: (typeId: string) => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6b7280',
];

export default function SchematicElementPanel({
  elementTypes,
  placedElements,
  activeTypeId,
  onStartPlacing,
}: Props) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(ELEMENT_CATEGORIES.map((c) => c.id))
  );
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const { colorMap, updateColor } = useCategoryColors();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return elementTypes;
    return elementTypes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [elementTypes, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, DesignElementType[]>();
    for (const t of filtered) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return map;
  }, [filtered]);

  const countByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const el of placedElements) {
      counts.set(el.element_type_id, (counts.get(el.element_type_id) ?? 0) + el.quantity);
    }
    return counts;
  }, [placedElements]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat schematickou značku..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-xs font-extrabold text-slate-400">Nic nenalezeno</div>
          </div>
        ) : (
          <div className="space-y-2">
            {ELEMENT_CATEGORIES.map((cat) => {
              const items = grouped.get(cat.id);
              if (!items || items.length === 0) return null;
              const isExpanded = expandedCategories.has(cat.id);
              const totalInCategory = items.reduce(
                (sum, t) => sum + (countByType.get(t.id) ?? 0),
                0
              );

              const currentColor = colorMap[cat.id] ?? '#6b7280';
              const isColorPickerOpen = colorPickerOpen === cat.id;

              return (
                <div key={cat.id} className="rounded-xl overflow-hidden border border-white/[0.06]">
                  <div className="flex items-center bg-white/[0.04] hover:bg-white/[0.06] transition">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setColorPickerOpen(isColorPickerOpen ? null : cat.id);
                        }}
                        className="p-2.5 hover:bg-white/10 rounded-l-xl transition"
                        title="Změnit barvu kategorie"
                      >
                        <div
                          className="w-4 h-4 rounded-full ring-2 ring-white/20 hover:ring-white/40 transition cursor-pointer"
                          style={{ backgroundColor: currentColor }}
                        />
                      </button>
                      {isColorPickerOpen && (
                        <div
                          className="absolute left-0 top-full mt-1 z-50 bg-slate-800 border border-white/10 rounded-lg p-2 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid grid-cols-6 gap-1 mb-2">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => {
                                  updateColor(cat.id, color);
                                  setColorPickerOpen(null);
                                }}
                                className={`w-5 h-5 rounded-full hover:scale-110 transition ring-1 ring-white/10 ${
                                  currentColor === color ? 'ring-2 ring-white' : ''
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                            <input
                              ref={colorInputRef}
                              type="color"
                              value={currentColor}
                              onChange={(e) => updateColor(cat.id, e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={currentColor}
                              onChange={(e) => {
                                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                  updateColor(cat.id, e.target.value);
                                }
                              }}
                              className="flex-1 text-[10px] font-mono bg-white/10 border border-white/10 rounded px-1.5 py-1 w-16"
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="flex-1 flex items-center justify-between px-2 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white">
                          {cat.name}
                        </span>
                        {totalInCategory > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                            {totalInCategory}x
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-2 space-y-1 bg-white/[0.02]">
                      {items.map((type) => {
                        const isActive = type.id === activeTypeId;
                        const qty = countByType.get(type.id) ?? 0;

                        return (
                          <button
                            key={type.id}
                            onClick={() => onStartPlacing(type.id)}
                            className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition group ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white/[0.04] border border-white/[0.04] hover:border-blue-300/30'
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isActive ? 'bg-white/20' : 'bg-white/[0.06]'
                              }`}
                              style={{
                                borderLeft: `3px solid ${isActive ? '#fff' : colorMap[cat.id] ?? '#6b7280'}`,
                              }}
                            >
                              {renderPinIcon(
                                type.icon || 'dot',
                                16,
                                isActive ? 'text-white' : 'text-slate-300'
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-[11px] font-extrabold truncate ${
                                  isActive ? 'text-white' : 'text-white'
                                }`}
                              >
                                {type.name}
                              </div>
                              {type.subcategory && (
                                <div
                                  className={`text-[10px] ${
                                    isActive ? 'text-blue-100' : 'text-slate-500'
                                  }`}
                                >
                                  {type.subcategory}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {qty > 0 && (
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                    isActive
                                      ? 'bg-white/20 text-white'
                                      : 'bg-blue-500/10 text-blue-400'
                                  }`}
                                >
                                  {qty}x
                                </span>
                              )}
                              <MapPin
                                className={`w-3.5 h-3.5 ${
                                  isActive
                                    ? 'text-white'
                                    : 'text-slate-400 group-hover:text-blue-500'
                                }`}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
