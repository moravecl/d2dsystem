import { useState } from 'react';
import { Search, Plus, Hash } from 'lucide-react';
import { PLACEHOLDER_REGISTRY, PLACEHOLDER_CATEGORIES } from '../../lib/placeholderEngine';
import type { PlaceholderDef } from '../../lib/placeholderEngine';

interface Props {
  onInsert: (placeholder: string) => void;
}

export default function PlaceholderPanel({ onInsert }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const filtered = PLACEHOLDER_REGISTRY.filter(p => {
    if (search && !p.label.toLowerCase().includes(search.toLowerCase()) && !p.key.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeCategory && p.category !== activeCategory) return false;
    return true;
  });

  const grouped = PLACEHOLDER_CATEGORIES.map(cat => ({
    ...cat,
    items: filtered.filter(p => p.category === cat.key),
  })).filter(g => g.items.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/[0.06]">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Zástupné znaky</div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveCategory('')}
          className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${!activeCategory ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-white/[0.06]'}`}
        >
          Vše
        </button>
        {PLACEHOLDER_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(activeCategory === cat.key ? '' : cat.key)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${activeCategory === cat.key ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-white/[0.06]'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {grouped.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Nic nenalezeno</p>
        )}
        {grouped.map(group => (
          <div key={group.key}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{group.label}</div>
            <div className="space-y-1">
              {group.items.map((item: PlaceholderDef) => (
                <button
                  key={item.key}
                  onClick={() => onInsert(`{{${item.key}}}`)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-blue-500/10 text-left transition group"
                >
                  <Hash className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-300 group-hover:text-blue-400">{item.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{`{{${item.key}}}`}</div>
                  </div>
                  <Plus className="w-3 h-3 text-slate-300 group-hover:text-blue-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
