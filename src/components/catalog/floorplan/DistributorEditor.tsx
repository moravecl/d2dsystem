import { Combine, Plus, Trash2 } from 'lucide-react';
import type { FloorDistributor } from '../../../hooks/useProjectState';

interface Props {
  distributors: FloorDistributor[];
  isPlacing: boolean;
  onStartPlace: () => void;
  onCancelPlace: () => void;
  onRemove: (id: string) => void;
}

export default function DistributorEditor({
  distributors,
  isPlacing,
  onStartPlace,
  onCancelPlace,
  onRemove,
}: Props) {
  return (
    <div className="p-4 border-b border-white/10">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Combine className="w-3.5 h-3.5" />
        Rozdělovače
        {distributors.length > 0 && (
          <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{distributors.length}</span>
        )}
      </div>

      {isPlacing ? (
        <div className="bg-red-500/10 border border-red-200 rounded-xl p-2.5 text-xs font-extrabold text-red-400">
          Klikni na půdorys pro umístění rozdělovače.
          <button onClick={onCancelPlace} className="ml-2 underline text-red-500">Zrušit</button>
        </div>
      ) : (
        <button
          onClick={onStartPlace}
          className="w-full bg-white/[0.06] text-slate-300 py-2 rounded-xl font-extrabold text-sm hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Umístit rozdělovač
        </button>
      )}

      {distributors.length > 0 && (
        <div className="mt-2 space-y-1">
          {distributors.map((dist) => (
            <div key={dist.id} className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-1.5 border border-white/[0.06]">
              <Combine className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="flex-1 text-xs font-extrabold text-slate-300">{dist.name}</span>
              <button onClick={() => onRemove(dist.id)} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
