import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, Trash2, Package, Link, Info } from 'lucide-react';
import type { ProjectDesignElement, DesignElementType, ProductAssignment } from '../../types/designElements';
import type { Room } from '../../hooks/useProjectState';
import type { Product } from '../../types/database';
import { renderPinIcon } from '../catalog/floorplan/iconLibrary';
import { resolveAssignmentForElement, type ResolvedAssignment } from '../../lib/assignmentResolver';

interface Props {
  elements: ProjectDesignElement[];
  elementTypes: DesignElementType[];
  rooms: Room[];
  products: Product[];
  assignments: ProductAssignment[];
  productKindMap?: Map<string, string>;
  categoryColorMap: Record<string, string>;
  onSelectElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onAssignProduct: (elementId: string, productId: string | null) => void;
  onBulkAssignProduct: (elementIds: string[], productId: string | null) => void;
  activeElementId: string | null;
}

interface GroupedElement {
  element: ProjectDesignElement;
  type: DesignElementType;
  resolved: ResolvedAssignment;
}

export default function UsedSchematicPanel({
  elements,
  elementTypes,
  rooms,
  products,
  assignments,
  productKindMap,
  categoryColorMap,
  onSelectElement,
  onDeleteElement,
  onAssignProduct,
  onBulkAssignProduct,
  activeElementId,
}: Props) {
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set(['unassigned']));
  const [assigningElementId, setAssigningElementId] = useState<string | null>(null);
  const [bulkAssigningRoom, setBulkAssigningRoom] = useState<string | null>(null);

  const typeMap = useMemo(() => {
    const map = new Map<string, DesignElementType>();
    for (const t of elementTypes) map.set(t.id, t);
    return map;
  }, [elementTypes]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const grouped = useMemo(() => {
    const byRoom = new Map<string, GroupedElement[]>();
    byRoom.set('unassigned', []);

    for (const room of rooms) {
      byRoom.set(room.id, []);
    }

    for (const el of elements) {
      const type = typeMap.get(el.element_type_id);
      if (!type) continue;

      const resolved = resolveAssignmentForElement({
        elementId: el.id,
        elementTypeId: el.element_type_id,
        roomId: el.room_id,
        assignments,
        productKindMap,
      });

      const roomKey = el.room_id || 'unassigned';
      if (!byRoom.has(roomKey)) byRoom.set(roomKey, []);
      byRoom.get(roomKey)!.push({ element: el, type, resolved });
    }

    return byRoom;
  }, [elements, rooms, typeMap, assignments, productKindMap]);

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const totalCount = elements.reduce((sum, el) => sum + el.quantity, 0);

  const relevantProducts = useMemo(() => {
    return products.filter(p => p.show_in_catalog !== false);
  }, [products]);

  if (elements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Package className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-xs font-extrabold text-slate-400 text-center">
          Zatím žádné umístěné prvky
        </p>
        <p className="text-[10px] text-slate-400 mt-1 text-center">
          Vyberte značku ze sekce Značky a kliknutím na půdorys ji umístěte
        </p>
      </div>
    );
  }

  const roomEntries = [
    { id: 'unassigned', name: 'Neprirazeno', color: '#64748b' },
    ...rooms.map(r => ({ id: r.id, name: r.name, color: '#3b82f6' })),
  ].filter(r => (grouped.get(r.id)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Použité značky
          </span>
          <span className="bg-white/[0.06] px-2 py-0.5 rounded text-[10px] font-extrabold text-slate-400">
            {totalCount} ks
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        <div className="space-y-2">
          {roomEntries.map(room => {
            const items = grouped.get(room.id) || [];
            const isExpanded = expandedRooms.has(room.id);
            const roomQty = items.reduce((sum, i) => sum + i.element.quantity, 0);

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
                  <div className="flex items-center gap-1">
                    {items.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBulkAssigningRoom(bulkAssigningRoom === room.id ? null : room.id);
                        }}
                        className={`p-1 rounded transition ${bulkAssigningRoom === room.id ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'}`}
                        title="Hromadné přiřazení produktu"
                      >
                        <Link className="w-3 h-3" />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {bulkAssigningRoom === room.id && (
                  <div className="px-3 py-2 bg-blue-500/5 border-b border-white/[0.06]">
                    <p className="text-[10px] text-slate-400 mb-1.5">Přiřadit produkt všem prvkům v místnosti:</p>
                    <select
                      className="w-full text-xs rounded border border-white/10 px-2 py-1.5 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onChange={(e) => {
                        const productId = e.target.value || null;
                        onBulkAssignProduct(items.map(i => i.element.id), productId);
                        setBulkAssigningRoom(null);
                      }}
                      defaultValue=""
                    >
                      <option value="">-- Vyberte produkt --</option>
                      {relevantProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {isExpanded && (
                  <div className="p-2 space-y-1 bg-white/[0.02]">
                    {items.map(({ element, type, resolved }) => {
                      const isActive = element.id === activeElementId;
                      const catColor = categoryColorMap[type.category] ?? '#6b7280';
                      const assignedProduct = resolved.effectiveProductId
                        ? productMap.get(resolved.effectiveProductId)
                        : null;
                      const isInherited = resolved.inherited;

                      return (
                        <div
                          key={element.id}
                          className={`rounded-lg transition ${isActive ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'bg-white/[0.04] border border-white/[0.04]'}`}
                        >
                          <div className="flex items-center gap-2 px-2 py-1.5">
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${catColor}20`, border: `2px solid ${catColor}` }}
                            >
                              {renderPinIcon(type.icon || 'dot', 14, 'text-slate-200')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-extrabold text-white truncate">
                                {type.name}
                              </div>
                              <div className="text-[9px] text-slate-500 flex items-center gap-1">
                                {element.mounting_height && <span>{element.mounting_height}</span>}
                                {element.note && <span>{element.note}</span>}
                                {element.quantity > 1 && <span className="text-blue-400">{element.quantity}x</span>}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-0.5">
                              {isInherited && (
                                <div className="p-1" title={`Zděděno z ${resolved.sourceLevel === 'room' ? 'mistnosti' : 'projektu'}`}>
                                  <Info className="w-3 h-3 text-blue-400" />
                                </div>
                              )}
                              <button
                                onClick={() => setAssigningElementId(assigningElementId === element.id ? null : element.id)}
                                className={`p-1 rounded transition ${assigningElementId === element.id ? 'bg-blue-500/20 text-blue-400' : assignedProduct ? 'text-green-400 bg-green-500/10' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'}`}
                                title={assignedProduct ? `Prirazeno: ${assignedProduct.name}` : 'Priradit produkt'}
                              >
                                <Link className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onSelectElement(element.id)}
                                className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                                title="Zobrazit na půdorysu"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onDeleteElement(element.id)}
                                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                                title="Smazat"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {assigningElementId === element.id && (
                            <div className="px-2 pb-2">
                              <select
                                className="w-full text-xs rounded border border-white/10 px-2 py-1.5 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={resolved.sourceLevel === 'element' ? (resolved.effectiveProductId || '') : ''}
                                onChange={(e) => {
                                  onAssignProduct(element.id, e.target.value || null);
                                  setAssigningElementId(null);
                                }}
                              >
                                <option value="">-- Nepřiřazeno / Zdědit --</option>
                                {relevantProducts.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                ))}
                              </select>
                              {assignedProduct && (
                                <div className={`mt-1.5 flex items-center gap-2 p-1.5 rounded border ${isInherited ? 'bg-blue-500/10 border-blue-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                                  {assignedProduct.image_url && (
                                    <img src={assignedProduct.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className={`text-[10px] font-bold truncate ${isInherited ? 'text-blue-300' : 'text-green-300'}`}>{assignedProduct.name}</div>
                                    <div className={`text-[9px] ${isInherited ? 'text-blue-400/70' : 'text-green-400/70'}`}>
                                      {assignedProduct.code}
                                      {isInherited && <span className="ml-1">(zděděno)</span>}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
