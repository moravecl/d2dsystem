import { useState, useMemo } from 'react';
import { X, Layers, Move, RotateCw, Trash2, ArrowUp, ArrowDown, Palette, Link2, Unlink, GripVertical, ChevronDown, Search, Check } from 'lucide-react';
import type { MountingOrientation, DesignElementType, ProjectDesignElement } from '../../types/designElements';
import type { MountingGroupWithSlots } from '../../hooks/useMountingGroups';
import type { MountingGroupSlot } from '../../types/designElements';
import type { Product } from '../../types/database';

interface Props {
  group: MountingGroupWithSlots;
  elements: ProjectDesignElement[];
  elementTypes: DesignElementType[];
  designSeriesProducts: Product[];
  productColors?: { name: string; hex: string }[];
  onUpdateGroup: (params: {
    orientation?: MountingOrientation;
    label?: string | null;
    designSeriesId?: string | null;
    colorName?: string | null;
  }) => Promise<{ error?: string }>;
  onReorderSlot: (slotId: string, newIndex: number) => Promise<{ error?: string }>;
  onRemoveElementFromSlot: (slotIndex: number) => Promise<{ error?: string }>;
  onDisbandGroup: () => Promise<{ error?: string }>;
  onClose: () => void;
}

export default function MountingGroupEditModal({
  group,
  elements,
  elementTypes,
  designSeriesProducts,
  productColors = [],
  onUpdateGroup,
  onReorderSlot,
  onRemoveElementFromSlot,
  onDisbandGroup,
  onClose,
}: Props) {
  const [orientation, setOrientation] = useState<MountingOrientation>(group.orientation);
  const [label, setLabel] = useState(group.label ?? '');
  const [designSeriesId, setDesignSeriesId] = useState<string | null>(group.design_series_id);
  const [colorName, setColorName] = useState<string | null>(group.color_name);
  const [saving, setSaving] = useState(false);
  const [showSeriesSearch, setShowSeriesSearch] = useState(false);
  const [seriesSearch, setSeriesSearch] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const sortedSlots = useMemo(() => {
    return [...group.slots].sort((a, b) => a.slot_index - b.slot_index);
  }, [group.slots]);

  const getElementForSlot = (slot: MountingGroupSlot): ProjectDesignElement | undefined => {
    if (!slot.element_id) return undefined;
    return elements.find((el) => el.id === slot.element_id);
  };

  const getTypeName = (typeId: string): string => {
    return elementTypes.find((t) => t.id === typeId)?.name ?? 'Neznamy';
  };

  const selectedSeries = useMemo(() => {
    if (!designSeriesId) return null;
    return designSeriesProducts.find((p) => p.id === designSeriesId);
  }, [designSeriesId, designSeriesProducts]);

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

  const handleSave = async () => {
    setSaving(true);
    const result = await onUpdateGroup({
      orientation,
      label: label.trim() || null,
      designSeriesId,
      colorName,
    });
    setSaving(false);
    if (!result.error) {
      onClose();
    }
  };

  const handleMoveSlot = async (slot: MountingGroupSlot, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? slot.slot_index - 1 : slot.slot_index + 1;
    if (newIndex < 0 || newIndex >= sortedSlots.length) return;
    await onReorderSlot(slot.id, newIndex);
  };

  const handleDisband = async () => {
    if (!confirm('Opravdu chcete rozpojit tento vícerámeček? Prvky zůstanou na místě.')) return;
    setSaving(true);
    await onDisbandGroup();
    setSaving(false);
    onClose();
  };

  const handleRemoveElement = async (slotIndex: number) => {
    if (!confirm('Odebrat prvek ze slotu? Prvek zůstane na místě, ale nebude součástí vícerámečku.')) return;
    await onRemoveElementFromSlot(slotIndex);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-900 rounded-2xl shadow-2xl w-full max-w-lg border border-white/10 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upravit vícerámeček</h2>
              <p className="text-xs text-slate-400">{group.frame_size} pozic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Sloty ({sortedSlots.length})
            </label>
            <div className="space-y-1.5">
              {sortedSlots.map((slot, idx) => {
                const element = getElementForSlot(slot);
                return (
                  <div
                    key={slot.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]"
                  >
                    <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {element ? (
                        <>
                          <div className="text-sm font-bold text-white truncate">
                            {getTypeName(element.element_type_id)}
                          </div>
                          {element.label && (
                            <div className="text-[10px] text-slate-500 truncate">{element.label}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-slate-500 italic">Prázdný slot</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveSlot(slot, 'up')}
                        disabled={idx === 0}
                        className={`p-1.5 rounded transition ${
                          idx === 0
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                        title="Posunout nahoru"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveSlot(slot, 'down')}
                        disabled={idx === sortedSlots.length - 1}
                        className={`p-1.5 rounded transition ${
                          idx === sortedSlots.length - 1
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                        title="Posunout dolů"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {element && (
                        <button
                          onClick={() => handleRemoveElement(slot.slot_index)}
                          className="p-1.5 rounded text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                          title="Odebrat ze slotu"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Orientace rámečku
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrientation('horizontal')}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition ${
                  orientation === 'horizontal'
                    ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20'
                }`}
              >
                <Move className="w-5 h-5" />
                <span className="text-xs font-bold">Horizontální</span>
                <div className="flex gap-1">
                  {[1, 2, 3].slice(0, Math.min(3, group.frame_size)).map((i) => (
                    <div key={i} className="w-4 h-3 rounded-sm bg-current opacity-50" />
                  ))}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setOrientation('vertical')}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition ${
                  orientation === 'vertical'
                    ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20'
                }`}
              >
                <RotateCw className="w-5 h-5" />
                <span className="text-xs font-bold">Vertikální</span>
                <div className="flex flex-col gap-1">
                  {[1, 2, 3].slice(0, Math.min(3, group.frame_size)).map((i) => (
                    <div key={i} className="w-4 h-2 rounded-sm bg-current opacity-50" />
                  ))}
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Designova řada
            </label>
            <div className="relative">
              <button
                onClick={() => setShowSeriesSearch(!showSeriesSearch)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium hover:bg-white/[0.06] transition"
              >
                {selectedSeries ? (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-teal-400" />
                    <span className="text-white">{selectedSeries.name}</span>
                    {selectedSeries.brand && (
                      <span className="text-[10px] text-slate-500">({selectedSeries.brand})</span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500">Nenastaveno</span>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition ${showSeriesSearch ? 'rotate-180' : ''}`} />
              </button>

              {showSeriesSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-navy-800 rounded-xl border border-white/10 shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={seriesSearch}
                        onChange={(e) => setSeriesSearch(e.target.value)}
                        placeholder="Hledat řadu..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        setDesignSeriesId(null);
                        setShowSeriesSearch(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${
                        !designSeriesId ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      Žádná řada
                    </button>
                    {filteredSeries.map((series) => (
                      <button
                        key={series.id}
                        onClick={() => {
                          setDesignSeriesId(series.id);
                          setShowSeriesSearch(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition ${
                          designSeriesId === series.id ? 'bg-teal-600/20' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{series.name}</div>
                          <div className="text-[10px] text-slate-500">{series.brand} / {series.code}</div>
                        </div>
                        {designSeriesId === series.id && (
                          <Check className="w-4 h-4 text-teal-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Barva
            </label>
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium hover:bg-white/[0.06] transition"
              >
                {colorName ? (
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-teal-400" />
                    <span className="text-white">{colorName}</span>
                  </div>
                ) : (
                  <span className="text-slate-500">Nenastaveno</span>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition ${showColorPicker ? 'rotate-180' : ''}`} />
              </button>

              {showColorPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-navy-800 rounded-xl border border-white/10 shadow-lg max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setColorName(null);
                      setShowColorPicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${
                      !colorName ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    Žádná barva
                  </button>
                  {productColors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setColorName(c.name);
                        setShowColorPicker(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition ${
                        colorName === c.name ? 'bg-teal-600/20' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-sm font-medium text-white">{c.name}</span>
                      {colorName === c.name && (
                        <Check className="w-4 h-4 text-teal-400 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Popis (volitelný)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="např. Rámeček u dveří"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handleDisband}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Rozpojit
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-bold text-slate-400 hover:bg-white/[0.06] transition"
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Ukladam...' : 'Ulozit zmeny'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
