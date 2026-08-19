import { useState } from 'react';
import { X, Layers, Move, RotateCw } from 'lucide-react';
import type { ProjectDesignElement, MountingOrientation, DesignElementType } from '../../types/designElements';

interface Props {
  selectedElements: ProjectDesignElement[];
  elementTypes: DesignElementType[];
  onConfirm: (params: {
    orientation: MountingOrientation;
    label?: string;
  }) => void;
  onCancel: () => void;
}

export default function MountingGroupModal({
  selectedElements,
  elementTypes,
  onConfirm,
  onCancel,
}: Props) {
  const [orientation, setOrientation] = useState<MountingOrientation>('horizontal');
  const [label, setLabel] = useState('');

  const getTypeName = (typeId: string) => {
    return elementTypes.find((t) => t.id === typeId)?.name ?? 'Neznámý';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      orientation,
      label: label.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-900 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Vytvořit vícenásobný rámeček</h2>
              <p className="text-xs text-slate-400">{selectedElements.length} vybraných prvků</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Vybrané prvky
            </label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {selectedElements.map((el, idx) => (
                <div
                  key={el.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                >
                  <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-white">{getTypeName(el.element_type_id)}</span>
                  {el.quantity > 1 && (
                    <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                      {el.quantity}x
                    </span>
                  )}
                </div>
              ))}
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
                  {[1, 2, 3].map((i) => (
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
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-4 h-2 rounded-sm bg-current opacity-50" />
                  ))}
                </div>
              </button>
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
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-bold text-slate-400 hover:bg-white/[0.06] transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Vytvořit rámeček
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
