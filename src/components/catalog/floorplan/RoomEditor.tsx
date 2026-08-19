import { useState } from 'react';
import { Square, Trash2, Pencil, Check, X, Plus, Bath, Eye, EyeOff, RotateCcw, Type } from 'lucide-react';
import type { Room, FloorScale, BathroomPlacement } from '../../../hooks/useProjectState';
import { polygonAreaM2 } from './geometry';
import BathroomDesigner from './BathroomDesigner';

const BATHROOM_KEYWORDS = ['koupelna', 'kúpeľňa', 'wc', 'toaleta', 'záchod', 'koupeln', 'lázeň', 'kúpeľ', 'bathroom', 'bath'];

function isBathroomRoom(name: string): boolean {
  const lower = name.toLowerCase();
  return BATHROOM_KEYWORDS.some((kw) => lower.includes(kw));
}

interface Props {
  rooms: Room[];
  drawingPoints: { x: number; y: number }[];
  isDrawing: boolean;
  scale?: FloorScale;
  onStartDraw: () => void;
  onFinishDraw: (name: string) => void;
  onCancelDraw: () => void;
  onRemoveRoom: (roomId: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onUpdateBathroomLayout?: (roomId: string, layout: BathroomPlacement[]) => void;
  onUpdateRoomLabel?: (roomId: string, updates: Partial<Pick<Room, 'labelHidden' | 'labelOffsetX' | 'labelOffsetY' | 'labelSize'>>) => void;
}

export default function RoomEditor({
  rooms,
  drawingPoints,
  isDrawing,
  scale,
  onStartDraw,
  onFinishDraw,
  onCancelDraw,
  onRemoveRoom,
  onRenameRoom,
  onUpdateBathroomLayout,
  onUpdateRoomLabel,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [bathroomRoom, setBathroomRoom] = useState<Room | null>(null);

  const startEdit = (room: Room) => {
    setEditingId(room.id);
    setEditingName(room.name);
  };

  const commitEdit = () => {
    if (editingId && editingName.trim()) {
      onRenameRoom(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleFinish = () => {
    const name = newRoomName.trim() || `Místnost ${rooms.length + 1}`;
    onFinishDraw(name);
    setNewRoomName('');
  };

  return (
    <>
      <div className="p-4 border-b border-white/10">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Square className="w-3.5 h-3.5" />
          Místnosti
          {rooms.length > 0 && (
            <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{rooms.length}</span>
          )}
        </div>

        {isDrawing ? (
          <div className="bg-teal-500/10 border border-teal-200 rounded-2xl p-3 space-y-2">
            <div className="text-sm font-extrabold text-teal-800">
              Kreslení místnosti ({drawingPoints.length} bodů)
            </div>
            <div className="text-xs text-teal-600">
              Klikej na půdorys pro přidání rohu. Min. 3 body.
            </div>
            {drawingPoints.length >= 3 && (
              <div className="space-y-2">
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFinish(); }}
                  placeholder="Název místnosti..."
                  className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-white/[0.06] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
                <div className="flex gap-2">
                  <button onClick={handleFinish} className="flex-1 bg-teal-600 text-white py-2 rounded-xl font-extrabold text-sm hover:bg-teal-700 transition flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Uzavrit
                  </button>
                  <button onClick={onCancelDraw} className="bg-white/[0.06] border border-teal-200 text-teal-700 py-2 px-3 rounded-xl font-extrabold text-sm hover:bg-teal-500/10 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            {drawingPoints.length < 3 && (
              <button onClick={onCancelDraw} className="text-xs font-extrabold text-teal-600 underline">Zrušit</button>
            )}
          </div>
        ) : (
          <button
            onClick={onStartDraw}
            className="w-full bg-white/[0.06] text-slate-300 py-2.5 rounded-2xl font-extrabold text-sm hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Nakreslit místnost
          </button>
        )}

        {rooms.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {rooms.map((room) => {
              const area = scale ? polygonAreaM2(room.points, scale) : null;
              const isBath = isBathroomRoom(room.name);
              const hasLayout = (room.bathroomLayout?.length ?? 0) > 0;
              return (
                <div key={room.id} className="bg-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Square className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    {editingId === room.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); }}
                        className="flex-1 px-2 py-1 rounded-lg border border-blue-300 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <span className="flex-1 text-xs font-extrabold text-slate-300 truncate">{room.name}</span>
                    )}
                    {area !== null && (
                      <span className="text-[10px] font-extrabold text-teal-600 bg-teal-500/10 px-1.5 py-0.5 rounded">{area.toFixed(1)} m2</span>
                    )}
                    <span className="text-[10px] text-slate-400">{room.points.length} bodů</span>
                    <button onClick={() => startEdit(room)} className="p-1 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onRemoveRoom(room.id)} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {onUpdateRoomLabel && (
                    <div className="flex items-center gap-1.5 px-3 pb-2">
                      <button
                        onClick={() => onUpdateRoomLabel(room.id, { labelHidden: !room.labelHidden })}
                        className={`p-1 rounded-lg transition ${room.labelHidden ? 'text-slate-500 hover:text-slate-300 bg-white/[0.04]' : 'text-teal-500 hover:text-teal-400'}`}
                        title={room.labelHidden ? 'Zobrazit název' : 'Skrýt název'}
                      >
                        {room.labelHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <Type className="w-3 h-3 text-slate-500 ml-1" />
                      <input
                        type="range"
                        min="0.008"
                        max="0.04"
                        step="0.002"
                        value={room.labelSize ?? 0.018}
                        onChange={(e) => onUpdateRoomLabel(room.id, { labelSize: parseFloat(e.target.value) })}
                        className="flex-1 h-1 accent-teal-500"
                        title="Velikost popisku"
                      />
                      {(room.labelOffsetX || room.labelOffsetY) ? (
                        <button
                          onClick={() => onUpdateRoomLabel(room.id, { labelOffsetX: 0, labelOffsetY: 0 })}
                          className="p-1 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 transition"
                          title="Vrátit název na střed"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                  {isBath && scale && onUpdateBathroomLayout && (
                    <div className="px-3 pb-2">
                      <button
                        onClick={() => setBathroomRoom(room)}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                          hasLayout
                            ? 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                            : 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-100 border border-cyan-200 border-dashed'
                        }`}
                      >
                        <Bath className="w-3.5 h-3.5" />
                        {hasLayout ? `Upravit koupelnu (${room.bathroomLayout!.length} prvků)` : 'Navrhnout koupelnu'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bathroomRoom && scale && (
        <BathroomDesigner
          room={bathroomRoom}
          scale={scale}
          onSave={(layout) => {
            onUpdateBathroomLayout?.(bathroomRoom.id, layout);
            setBathroomRoom(null);
          }}
          onClose={() => setBathroomRoom(null)}
        />
      )}
    </>
  );
}
