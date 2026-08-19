import { useState, useEffect } from 'react';
import { Trash2, X, RotateCw, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import type { ProjectDesignElement, DesignElementType } from '../../types/designElements';
import type { Room, Circuit } from '../../hooks/useProjectState';
import { renderPinIcon } from '../catalog/floorplan/iconLibrary';

interface Props {
  element: ProjectDesignElement;
  elementType: DesignElementType;
  rooms: Room[];
  circuits: Circuit[];
  categoryColorMap: Record<string, string>;
  onUpdate: (updates: Partial<ProjectDesignElement>) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  onAddCircuit?: (name: string, color: string) => void;
  onDefaultsChange?: (defaults: { circuitId: string | null; mountingHeight: string | null }) => void;
}

const CIRCUIT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export default function SchematicElementDrawer({
  element,
  elementType,
  rooms,
  circuits,
  categoryColorMap,
  onUpdate,
  onDelete,
  onClose,
  onAddCircuit,
  onDefaultsChange,
}: Props) {
  const [note, setNote] = useState(element.note || '');
  const [mountingHeight, setMountingHeight] = useState(element.mounting_height || '');
  const [quantity, setQuantity] = useState(element.quantity);
  const [rotation, setRotation] = useState(element.rotation);
  const [circuitId, setCircuitId] = useState(element.circuit_id || '');
  const [roomId, setRoomId] = useState(element.room_id || '');
  const [showNewCircuit, setShowNewCircuit] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState('');
  const [newCircuitColor, setNewCircuitColor] = useState(CIRCUIT_COLORS[0]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setNote(element.note || '');
    setMountingHeight(element.mounting_height || '');
    setQuantity(element.quantity);
    setRotation(element.rotation);
    setCircuitId(element.circuit_id || '');
    setRoomId(element.room_id || '');
  }, [element]);

  const handleSave = async (updates: Partial<ProjectDesignElement>) => {
    await onUpdate(updates);
    if ('circuit_id' in updates || 'mounting_height' in updates) {
      onDefaultsChange?.({
        circuitId: updates.circuit_id !== undefined ? (updates.circuit_id as string | null) : (element.circuit_id || null),
        mountingHeight: updates.mounting_height !== undefined ? (updates.mounting_height as string | null) : (element.mounting_height || null),
      });
    }
  };

  const handleAddCircuit = () => {
    if (!newCircuitName.trim() || !onAddCircuit) return;
    onAddCircuit(newCircuitName.trim(), newCircuitColor);
    setNewCircuitName('');
    setShowNewCircuit(false);
  };

  const catColor = categoryColorMap[elementType.category] ?? '#6b7280';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-900/95 border-t border-slate-700/60 backdrop-blur-xl shadow-2xl">
      <div className="max-w-5xl mx-auto px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${catColor}20`, border: `2px solid ${catColor}` }}
            >
              {renderPinIcon(elementType.icon || 'dot', 16, 'text-slate-200')}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">{elementType.name}</p>
              <p className="text-[9px] text-slate-500">{elementType.category}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Ks</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setQuantity(val);
                  handleSave({ quantity: val });
                }}
                className="w-12 text-xs rounded border border-white/10 px-1.5 py-1 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Rot</span>
              <input
                type="number"
                step={15}
                value={rotation}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setRotation(val);
                  handleSave({ rotation: val });
                }}
                className="w-14 text-xs rounded border border-white/10 px-1.5 py-1 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  const val = (rotation + 90) % 360;
                  setRotation(val);
                  handleSave({ rotation: val });
                }}
                className="p-1 rounded bg-white/[0.06] hover:bg-white/[0.1] transition"
                title="Otočit o 90"
              >
                <RotateCw size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Okruh</span>
              <select
                value={circuitId}
                onChange={(e) => {
                  setCircuitId(e.target.value);
                  handleSave({ circuit_id: e.target.value || null });
                }}
                className="w-28 text-xs rounded border border-white/10 px-1.5 py-1 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-</option>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowNewCircuit(!showNewCircuit)}
                className="p-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition"
                title="Nový okruh"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Výška</span>
              <input
                type="text"
                value={mountingHeight}
                onChange={(e) => setMountingHeight(e.target.value)}
                onBlur={() => handleSave({ mounting_height: mountingHeight || null })}
                placeholder="30 cm"
                className="w-16 text-xs rounded border border-white/10 px-1.5 py-1 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Pozn</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => handleSave({ note: note || null })}
                placeholder="..."
                className="w-20 text-xs rounded border border-white/10 px-1.5 py-1 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Míst</span>
              <select
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  handleSave({ room_id: e.target.value || null });
                }}
                className="w-24 text-xs rounded border border-white/10 px-1.5 py-1 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-slate-400"
              title={expanded ? 'Skrýt' : 'Více možností'}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              title="Smazat"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Zavřít (Esc)"
            >
              <X size={14} className="text-slate-500" />
            </button>
          </div>
        </div>

        {showNewCircuit && (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-white/[0.04] border border-white/10">
            <input
              value={newCircuitName}
              onChange={(e) => setNewCircuitName(e.target.value)}
              placeholder="Název okruhu"
              className="flex-1 text-xs rounded border border-white/10 px-2 py-1.5 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCircuit(); }}
            />
            <div className="flex gap-1">
              {CIRCUIT_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  onClick={() => setNewCircuitColor(c)}
                  className={`w-5 h-5 rounded-full ${newCircuitColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              onClick={handleAddCircuit}
              disabled={!newCircuitName.trim()}
              className="px-3 py-1 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              Přidat
            </button>
            <button
              onClick={() => setShowNewCircuit(false)}
              className="p-1 rounded hover:bg-white/[0.06] transition"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
