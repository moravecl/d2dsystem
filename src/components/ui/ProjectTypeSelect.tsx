import { useEffect, useState } from 'react';
import { Tags } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProjectType {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

const COLOR_SOFT: Record<string, string> = {
  slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  red: 'bg-red-500/15 text-red-400 ring-red-500/30',
  orange: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
  lime: 'bg-lime-500/15 text-lime-400 ring-lime-500/30',
  green: 'bg-green-500/15 text-green-400 ring-green-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  teal: 'bg-teal-500/15 text-teal-400 ring-teal-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/30',
  sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  blue: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  pink: 'bg-pink-500/15 text-pink-400 ring-pink-500/30',
  rose: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
};

const COLOR_SELECTED: Record<string, string> = {
  slate: 'bg-slate-500 text-white ring-slate-500',
  red: 'bg-red-500 text-white ring-red-500',
  orange: 'bg-orange-500 text-white ring-orange-500',
  amber: 'bg-amber-500 text-white ring-amber-500',
  yellow: 'bg-yellow-400 text-white ring-yellow-400',
  lime: 'bg-lime-500 text-white ring-lime-500',
  green: 'bg-green-500 text-white ring-green-500',
  emerald: 'bg-emerald-500 text-white ring-emerald-500',
  teal: 'bg-teal-500 text-white ring-teal-500',
  cyan: 'bg-cyan-500 text-white ring-cyan-500',
  sky: 'bg-sky-500 text-white ring-sky-500',
  blue: 'bg-blue-500 text-white ring-blue-500',
  violet: 'bg-violet-500 text-white ring-violet-500',
  pink: 'bg-pink-500 text-white ring-pink-500',
  rose: 'bg-rose-500 text-white ring-rose-500',
};

export function getTypeSoftClass(color: string): string {
  return COLOR_SOFT[color] || COLOR_SOFT.slate;
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function ProjectTypeSelect({ selectedIds, onChange }: Props) {
  const [types, setTypes] = useState<ProjectType[]>([]);

  useEffect(() => {
    supabase
      .from('project_types')
      .select('id, name, color, is_active')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setTypes(data ?? []));
  }, []);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(s => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (types.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((t) => {
        const isSelected = selectedIds.includes(t.id);
        const cls = isSelected ? (COLOR_SELECTED[t.color] || COLOR_SELECTED.slate) : (COLOR_SOFT[t.color] || COLOR_SOFT.slate);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 transition-all hover:scale-105 active:scale-95 ${cls}`}
          >
            <Tags className="w-3 h-3" />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

export function ProjectTypeBadges({ typeIds, types }: { typeIds: string[]; types: ProjectType[] }) {
  const matched = types.filter(t => typeIds.includes(t.id));
  if (matched.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {matched.map(t => {
        const cls = COLOR_SOFT[t.color] || COLOR_SOFT.slate;
        return (
          <span key={t.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${cls}`}>
            {t.name}
          </span>
        );
      })}
    </div>
  );
}
