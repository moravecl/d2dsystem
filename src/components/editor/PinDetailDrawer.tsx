import { useState } from 'react';
import { Trash2, X, Palette, RefreshCw, ChevronDown } from 'lucide-react';
import type { Room, Circuit } from '../../hooks/useProjectState';
import type { PinData } from '../catalog/floorplan/pinUtils';
import type { Product } from '../../types/database';

interface Props {
  pin: PinData;
  rooms: Room[];
  circuits: Circuit[];
  products: Product[];
  onUpdateNote: (note: string) => void;
  onUpdateRoom: (room: string | undefined) => void;
  onUpdateCircuit: (circuitId: string | undefined) => void;
  onUpdateMountingHeight: (height: string | undefined) => void;
  onChangeIcon: () => void;
  onReplaceProduct: (newProductId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PinDetailDrawer({
  pin, rooms, circuits, products,
  onUpdateNote, onUpdateRoom, onUpdateCircuit, onUpdateMountingHeight,
  onChangeIcon, onReplaceProduct, onDelete, onClose,
}: Props) {
  const [showReplace, setShowReplace] = useState(false);

  const alternatives = products.filter(
    (p) => p.category_id === pin.product.category_id && p.id !== pin.product.id && p.show_in_catalog !== false
  );

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 border border-slate-700/60 backdrop-blur-xl rounded-2xl shadow-2xl w-[440px] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold truncate">{pin.product.name}</p>
          <p className="text-[10px] text-slate-400 truncate">
            {pin.product.brand} {pin.product.code} | {pin.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">
            Místnost
          </label>
          <select
            value={pin.placement.room || ''}
            onChange={(e) => onUpdateRoom(e.target.value || undefined)}
            className="w-full text-xs rounded-lg border border-white/10 px-2 py-1.5 bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Nezařazeno</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">
            Okruh
          </label>
          <select
            value={pin.placement.circuitId || ''}
            onChange={(e) => onUpdateCircuit(e.target.value || undefined)}
            className="w-full text-xs rounded-lg border border-white/10 px-2 py-1.5 bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Žádný</option>
            {circuits.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">
            Poznámka
          </label>
          <input
            type="text"
            value={pin.placement.note}
            onChange={(e) => onUpdateNote(e.target.value)}
            placeholder="..."
            className="w-full text-xs rounded-lg border border-white/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">
            Výška montáže
          </label>
          <input
            type="text"
            value={pin.placement.mountingHeight || ''}
            onChange={(e) => onUpdateMountingHeight(e.target.value || undefined)}
            placeholder="např. 30 cm"
            className="w-full text-xs rounded-lg border border-white/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {showReplace && alternatives.length > 0 && (
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 block">
            Nahradit produktem
          </label>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/[0.06]">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => { onReplaceProduct(alt.id); setShowReplace(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-blue-500/10 transition text-left"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
                  {alt.image_url ? (
                    <img src={alt.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">
                      {alt.code}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-white truncate">{alt.name}</div>
                  <div className="text-[10px] text-slate-400">{alt.brand} {alt.code}</div>
                </div>
                {alt.price > 0 && (
                  <span className="text-[10px] font-extrabold text-blue-400 shrink-0">
                    {alt.price.toLocaleString('cs-CZ')} Kč
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onChangeIcon}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.08] transition-colors"
          >
            <Palette size={14} />
            <span className="text-xs font-extrabold">Změnit ikonu</span>
          </button>
          {alternatives.length > 0 && (
            <button
              onClick={() => setShowReplace(!showReplace)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
                showReplace ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] hover:bg-white/[0.08]'
              }`}
            >
              <RefreshCw size={14} />
              <span className="text-xs font-extrabold">Nahradit</span>
              <ChevronDown size={12} className={`transition-transform ${showReplace ? 'rotate-180' : ''}`} />
            </button>
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
