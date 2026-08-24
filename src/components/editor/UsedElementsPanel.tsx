import { useState, useMemo } from 'react';
import { Trash2, Eye, Package, ChevronDown, ChevronRight } from 'lucide-react';
import type { Product, Category } from '../../types/database';
import type { SelectionState, Floor, Room, Placement } from '../../hooks/useProjectState';

interface UsedProductInRoom {
  product: Product;
  placements: Placement[];
}

interface Props {
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  floors?: Floor[];
  rooms?: Room[];
  activeFloorId?: string;
  onHighlightProduct: (productId: string) => void;
  onRemoveAll: (productId: string) => void;
}

export default function UsedElementsPanel({
  products,
  selected,
  floors,
  rooms = [],
  activeFloorId,
  onHighlightProduct,
  onRemoveAll,
}: Props) {
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set(['unassigned']));

  const groupedByRoom = useMemo(() => {
    const byRoom = new Map<string, UsedProductInRoom[]>();
    byRoom.set('unassigned', []);
    for (const room of rooms) {
      byRoom.set(room.id, []);
    }

    const productMap = new Map<string, Product>();
    for (const p of products) productMap.set(p.id, p);

    for (const productId of Object.keys(selected)) {
      const product = productMap.get(productId);
      if (!product) continue;

      const placementsByRoom = new Map<string, Placement[]>();
      for (const pl of selected[productId].placements) {
        if (activeFloorId && pl.floorId !== activeFloorId) continue;
        const roomKey = pl.room || 'unassigned';
        if (!placementsByRoom.has(roomKey)) placementsByRoom.set(roomKey, []);
        placementsByRoom.get(roomKey)!.push(pl);
      }

      for (const [roomKey, placements] of placementsByRoom) {
        if (!byRoom.has(roomKey)) byRoom.set(roomKey, []);
        byRoom.get(roomKey)!.push({ product, placements });
      }
    }

    if (floors) {
      for (const floor of floors) {
        if (activeFloorId && floor.id !== activeFloorId) continue;
        for (const obj of floor.objects ?? []) {
          const product = productMap.get(obj.productId);
          if (!product) continue;
          const roomKey = obj.roomId || 'unassigned';
          if (!byRoom.has(roomKey)) byRoom.set(roomKey, []);
          const existing = byRoom.get(roomKey)!.find(i => i.product.id === product.id);
          if (existing) {
            existing.placements.push({
              id: obj.id,
              x: obj.x,
              y: obj.y,
              note: '',
              ts: 0,
              floorId: floor.id,
              room: roomKey,
            });
          } else {
            byRoom.get(roomKey)!.push({
              product,
              placements: [{
                id: obj.id,
                x: obj.x,
                y: obj.y,
                note: '',
                ts: 0,
                floorId: floor.id,
                room: roomKey,
              }],
            });
          }
        }
      }
    }

    return byRoom;
  }, [selected, products, floors, rooms, activeFloorId]);

  const totalCount = useMemo(() => {
    let count = 0;
    for (const items of groupedByRoom.values()) {
      for (const item of items) {
        count += item.placements.length;
      }
    }
    return count;
  }, [groupedByRoom]);

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Package className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-xs font-extrabold text-slate-400 text-center">
          Zatím žádné umístěné prvky
        </p>
        <p className="text-[10px] text-slate-400 mt-1 text-center">
          Vyberte produkt z katalogu a kliknutím na půdorys ho umístěte
        </p>
      </div>
    );
  }

  const roomEntries = [
    { id: 'unassigned', name: 'Nepřiřazeno', color: '#64748b' },
    ...rooms.map(r => ({ id: r.id, name: r.name, color: (r as any).color || '#3b82f6' })),
  ].filter(r => {
    const items = groupedByRoom.get(r.id);
    return items && items.length > 0;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Použité prvky
          </span>
          <span className="bg-white/[0.06] px-2 py-0.5 rounded text-[10px] font-extrabold text-slate-400">
            {totalCount} ks
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        <div className="space-y-2">
          {roomEntries.map(room => {
            const items = groupedByRoom.get(room.id) || [];
            const isExpanded = expandedRooms.has(room.id);
            const roomQty = items.reduce((sum, i) => sum + i.placements.length, 0);

            return (
              <div key={room.id} className="rounded-xl overflow-hidden border border-white/[0.06]">
                <button
                  onClick={() => toggleRoom(room.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] transition"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded"
                      style={{ backgroundColor: room.color }}
                    />
                    <span className="text-[11px] font-extrabold text-white">
                      {room.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                      {roomQty}x
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-2 space-y-1 bg-white/[0.02]">
                    {items.map(({ product, placements }) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.06]"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">
                              {product.code}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-extrabold text-white truncate">
                            {product.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {product.brand} {product.code}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          <span className="text-[10px] font-extrabold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                            {placements.length}x
                          </span>
                          <button
                            onClick={() => onHighlightProduct(product.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                            title="Zobrazit na půdorysu"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Smazat všechny instance "${product.name}" (${placements.length}x)?`)) {
                                onRemoveAll(product.id);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                            title="Smazat všechny instance"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
