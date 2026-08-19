import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

export interface SortOption {
  key: string;
  label: string;
}

interface SortControlProps {
  options: SortOption[];
  sortKey: string;
  sortDir: SortDir;
  onChange: (key: string, dir: SortDir) => void;
}

export default function SortControl({ options, sortKey, sortDir, onChange }: SortControlProps) {
  const handleSelect = (key: string) => {
    if (key === sortKey) {
      onChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onChange(key, 'asc');
    }
  };

  const active = options.find(o => o.key === sortKey);

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-300 bg-white/[0.07] border border-white/10 rounded-xl hover:bg-white/[0.12] transition shrink-0">
        {sortDir === 'asc'
          ? <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
          : <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
        }
        <span className="hidden sm:inline">{active?.label ?? 'Řadit'}</span>
        <ArrowUpDown className="w-3 h-3 text-slate-500" />
      </button>
      <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[160px] bg-navy-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 py-1 opacity-0 pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleSelect(opt.key)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition hover:bg-white/[0.07] ${
              sortKey === opt.key ? 'text-white font-semibold' : 'text-slate-400'
            }`}
          >
            <span>{opt.label}</span>
            {sortKey === opt.key && (
              sortDir === 'asc'
                ? <ArrowUp className="w-3.5 h-3.5 text-blue-500" />
                : <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function sortItems<T>(items: T[], key: string, dir: SortDir): T[] {
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), 'cs');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}
