import { useState } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { getAllIcons, useCustomIcons, renderPinIcon } from './iconLibrary';

interface Props {
  currentIcon?: string;
  onSelect: (iconId: string | undefined) => void;
  onClose: () => void;
}

const CUSTOM_COLORS = ['#1e293b', '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d'];

export default function IconPicker({ currentIcon, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLetter, setNewLetter] = useState('');
  const [newColor, setNewColor] = useState(CUSTOM_COLORS[0]);
  const { icons: customIcons, add, remove } = useCustomIcons();

  const allIcons = getAllIcons();
  const q = search.toLowerCase();
  const filtered = q
    ? allIcons.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    : allIcons;

  const grouped = new Map<string, typeof allIcons>();
  for (const icon of filtered) {
    if (!grouped.has(icon.category)) grouped.set(icon.category, []);
    grouped.get(icon.category)!.push(icon);
  }

  const handleAddCustom = () => {
    if (!newName.trim() || !newLetter.trim()) return;
    add({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newName.trim(),
      category: 'Vlastní',
      letter: newLetter.trim().slice(0, 3).toUpperCase(),
      color: newColor,
    });
    setNewName('');
    setNewLetter('');
    setShowAdd(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-md max-h-[70vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b bg-white/[0.04] flex items-center justify-between">
          <div className="text-sm font-extrabold text-white">Vybrat ikonu</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className={`p-1.5 rounded-xl transition flex items-center gap-1 text-xs font-extrabold ${
                showAdd ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vlastní</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/[0.08] transition">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="p-3 border-b bg-blue-500/10 space-y-2">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">Nová vlastní ikona</div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Název"
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/20"
              />
              <input
                value={newLetter}
                onChange={(e) => setNewLetter(e.target.value)}
                placeholder="Písmeno"
                maxLength={3}
                className="w-16 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-extrabold text-center focus:outline-none focus:ring-1 focus:ring-blue-500/20 uppercase"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {CUSTOM_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition ${newColor === c ? 'ring-2 ring-offset-1 ring-blue-500' : 'ring-1 ring-slate-200'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold"
                style={{ backgroundColor: newColor }}
              >
                {newLetter.trim().slice(0, 3).toUpperCase() || '?'}
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!newName.trim() || !newLetter.trim()}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 transition disabled:opacity-40"
              >
                Přidat
              </button>
            </div>
          </div>
        )}

        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat ikonu..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {currentIcon && (
            <button
              onClick={() => onSelect(undefined)}
              className="w-full px-3 py-2 rounded-xl border border-red-200 bg-red-500/10 text-xs font-extrabold text-red-400 hover:bg-red-500/20 transition"
            >
              Odebrat ikonu
            </button>
          )}

          {customIcons.length > 0 && !q && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 mb-2">
                Vlastní ikony
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {customIcons.map((ci) => {
                  const isActive = currentIcon === ci.id;
                  return (
                    <div key={ci.id} className="relative group">
                      <button
                        onClick={() => onSelect(ci.id)}
                        className={`w-full flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                          isActive
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-white/[0.06] bg-white/[0.06] text-slate-400 hover:border-blue-200 hover:bg-blue-500/10'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-extrabold"
                          style={{ backgroundColor: ci.color }}
                        >
                          {ci.letter}
                        </div>
                        <span className="text-[9px] font-extrabold truncate w-full text-center">{ci.name}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(ci.id); }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Array.from(grouped.entries()).map(([category, icons]) => (
            <div key={category}>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                {category}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {icons.map((icon) => {
                  const isActive = currentIcon === icon.id;
                  if (icon.custom) {
                    return (
                      <button
                        key={icon.id}
                        onClick={() => onSelect(icon.id)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                          isActive
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-white/[0.06] bg-white/[0.06] text-slate-400 hover:border-blue-200 hover:bg-blue-500/10'
                        }`}
                      >
                        {renderPinIcon(icon.id, 20, 'text-slate-400')}
                        <span className="text-[9px] font-extrabold truncate w-full text-center">{icon.name}</span>
                      </button>
                    );
                  }
                  const Icon = icon.Icon;
                  return (
                    <button
                      key={icon.id}
                      onClick={() => onSelect(icon.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-white/[0.06] bg-white/[0.06] text-slate-400 hover:border-blue-200 hover:bg-blue-500/10'
                      }`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={2} />
                      <span className="text-[9px] font-extrabold truncate w-full text-center">{icon.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && customIcons.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400 font-extrabold">Nic nenalezeno</div>
          )}
        </div>
      </div>
    </div>
  );
}
