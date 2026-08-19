import { RotateCw, FlipHorizontal, FlipVertical, Trash2, X } from 'lucide-react';
import type { Product } from '../../types/database';
import type { Room } from '../../hooks/useProjectState';
import type { FloorplanObjectData } from '../catalog/floorplan/floorplanObjects';

interface Props {
  object: FloorplanObjectData;
  product: Product | null;
  rooms: Room[];
  onUpdate: (updates: Partial<FloorplanObjectData>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ObjectDetailDrawer({ object, product, rooms, onUpdate, onDelete, onClose }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 border border-slate-700/60 backdrop-blur-xl rounded-2xl shadow-2xl w-[420px] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold truncate">{product?.name ?? 'Neznámý produkt'}</p>
          {product?.code && (
            <p className="text-[10px] text-slate-400 truncate">{product.code}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdate({ rotation: (object.rotation + 90) % 360 })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.08] transition-colors"
        >
          <RotateCw size={14} />
          <span className="text-xs font-extrabold">{object.rotation}°</span>
        </button>
        <button
          onClick={() => onUpdate({ flipX: !object.flipX })}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
            object.flipX ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] hover:bg-white/[0.08]'
          }`}
        >
          <FlipHorizontal size={14} />
          <span className="text-xs font-extrabold">X</span>
        </button>
        <button
          onClick={() => onUpdate({ flipY: !object.flipY })}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
            object.flipY ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] hover:bg-white/[0.08]'
          }`}
        >
          <FlipVertical size={14} />
          <span className="text-xs font-extrabold">Y</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">Místnost</label>
          <select
            value={object.roomId}
            onChange={(e) => onUpdate({ roomId: e.target.value })}
            className="w-full text-xs rounded-lg border border-white/10 px-2 py-1.5 bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Žádná</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">Poznámka</label>
          <input
            type="text"
            value={object.note}
            onChange={(e) => onUpdate({ note: e.target.value })}
            placeholder="..."
            className="w-full text-xs rounded-lg border border-white/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase">Snap</label>
            <button
              onClick={() => onUpdate({ snapToWall: !object.snapToWall })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                object.snapToWall ? 'bg-blue-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white/[0.06] rounded-full shadow transition-transform ${
                  object.snapToWall ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {object.snapToWall && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase">Offset</label>
              <input
                type="number"
                value={object.wallOffsetMm}
                onChange={(e) => onUpdate({ wallOffsetMm: Number(e.target.value) })}
                className="w-16 text-xs rounded-lg border border-white/10 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={14} />
          <span className="text-xs font-extrabold">Smazat</span>
        </button>
      </div>
    </div>
  );
}
