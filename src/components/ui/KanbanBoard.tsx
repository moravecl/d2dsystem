import { useState, useRef, type ReactNode, type DragEvent } from 'react';
import { Plus, X, Pencil, Check } from 'lucide-react';
import type { KanbanColumn } from '../../hooks/useKanbanColumns';

const COLOR_OPTIONS = [
  { key: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500', header: 'bg-blue-500/10 border-blue-200', ring: 'ring-blue-400' },
  { key: 'amber', bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500', header: 'bg-amber-500/10 border-amber-200', ring: 'ring-amber-400' },
  { key: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500', header: 'bg-emerald-500/10 border-emerald-200', ring: 'ring-emerald-400' },
  { key: 'green', bg: 'bg-green-100', text: 'text-green-400', dot: 'bg-emerald-500', header: 'bg-emerald-500/10 border-green-200', ring: 'ring-green-400' },
  { key: 'slate', bg: 'bg-white/[0.06]', text: 'text-slate-400', dot: 'bg-slate-400', header: 'bg-white/[0.04] border-white/10', ring: 'ring-slate-400' },
  { key: 'red', bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500', header: 'bg-red-500/10 border-red-200', ring: 'ring-red-400' },
  { key: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500', header: 'bg-cyan-500/10 border-cyan-200', ring: 'ring-cyan-400' },
  { key: 'rose', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', header: 'bg-rose-50 border-rose-200', ring: 'ring-rose-400' },
  { key: 'teal', bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500', header: 'bg-teal-500/10 border-teal-200', ring: 'ring-teal-400' },
  { key: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-700', dot: 'bg-orange-500', header: 'bg-orange-500/10 border-orange-200', ring: 'ring-orange-400' },
];

export function getColorConfig(colorKey: string) {
  return COLOR_OPTIONS.find((c) => c.key === colorKey) || COLOR_OPTIONS[4];
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn[];
  items: T[];
  getItemStatus: (item: T) => string;
  getItemId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMoveItem: (itemId: string, newStatus: string) => void;
  onAddColumn?: (label: string, color: string) => void;
  onUpdateColumn?: (id: string, updates: { label?: string; color?: string }) => void;
  onRemoveColumn?: (id: string) => void;
  canManageColumns?: boolean;
  emptyText?: string;
}

export default function KanbanBoard<T>({
  columns,
  items,
  getItemStatus,
  getItemId,
  renderCard,
  onMoveItem,
  onAddColumn,
  onUpdateColumn,
  onRemoveColumn,
  canManageColumns = false,
  emptyText = 'Žádné položky',
}: KanbanBoardProps<T>) {
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColColor, setNewColColor] = useState('blue');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const newColInputRef = useRef<HTMLInputElement>(null);

  const handleDragStart = (e: DragEvent, itemId: string) => {
    setDragItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOver = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const itemId = e.dataTransfer.getData('text/plain') || dragItemId;
    if (itemId) {
      onMoveItem(itemId, colKey);
    }
    setDragItemId(null);
  };

  const handleDragEnd = () => {
    setDragItemId(null);
    setDragOverCol(null);
  };

  const handleAddColumn = () => {
    if (!newColLabel.trim() || !onAddColumn) return;
    onAddColumn(newColLabel.trim(), newColColor);
    setNewColLabel('');
    setNewColColor('blue');
    setAddingColumn(false);
  };

  const startEditColumn = (col: KanbanColumn) => {
    setEditingColId(col.id);
    setEditLabel(col.label);
    setEditColor(col.color);
  };

  const saveEditColumn = () => {
    if (!editingColId || !onUpdateColumn) return;
    onUpdateColumn(editingColId, { label: editLabel.trim(), color: editColor });
    setEditingColId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {columns.map((col) => {
        const colColor = getColorConfig(col.color);
        const colItems = items.filter((item) => getItemStatus(item) === col.key);
        const isOver = dragOverCol === col.key;

        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-[300px] flex flex-col rounded-xl border transition-all ${
              isOver ? `border-2 ${colColor.ring.replace('ring', 'border')} bg-white/[0.04]` : 'border-white/10 bg-white/[0.06]'
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className={`px-3.5 py-3 rounded-t-xl border-b ${colColor.header} flex items-center justify-between gap-2`}>
              {editingColId === col.id ? (
                <div className="flex-1 space-y-2">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEditColumn()}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setEditColor(c.key)}
                        className={`w-5 h-5 rounded-full ${c.dot} ${editColor === c.key ? 'ring-2 ring-offset-1 ring-slate-800' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={saveEditColumn} className="px-2 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditingColId(null)} className="px-2 py-1 text-[11px] font-bold bg-white/[0.08] text-slate-400 rounded-lg">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colColor.dot}`} />
                    <span className="text-sm font-bold text-white truncate">{col.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colColor.bg} ${colColor.text}`}>
                      {colItems.length}
                    </span>
                  </div>
                  {canManageColumns && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => startEditColumn(col)}
                        className="p-1 rounded text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (colItems.length > 0) {
                            alert(`Nelze smazat sloupec "${col.label}" - obsahuje ${colItems.length} položek. Nejprve je přesuňte.`);
                            return;
                          }
                          if (confirm(`Smazat sloupec "${col.label}"?`)) onRemoveColumn?.(col.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-white/[0.06] transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 p-2 space-y-2 min-h-[60px] overflow-y-auto max-h-[calc(100vh-280px)]">
              {colItems.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">{emptyText}</div>
              )}
              {colItems.map((item) => {
                const itemId = getItemId(item);
                return (
                  <div
                    key={itemId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, itemId)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab active:cursor-grabbing transition-all ${
                      dragItemId === itemId ? 'opacity-40 scale-95' : ''
                    }`}
                  >
                    {renderCard(item)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {canManageColumns && (
        <div className="flex-shrink-0 w-[260px]">
          {addingColumn ? (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-3.5 space-y-3">
              <input
                ref={newColInputRef}
                value={newColLabel}
                onChange={(e) => setNewColLabel(e.target.value)}
                placeholder="Název sloupce..."
                className="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
              />
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setNewColColor(c.key)}
                    className={`w-6 h-6 rounded-full ${c.dot} transition ${
                      newColColor === c.key ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddColumn}
                  disabled={!newColLabel.trim()}
                  className="flex-1 px-3 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
                >
                  Přidat
                </button>
                <button
                  onClick={() => { setAddingColumn(false); setNewColLabel(''); }}
                  className="px-3 py-2 text-sm font-bold bg-white/[0.06] text-slate-400 rounded-lg hover:bg-white/[0.08] transition"
                >
                  Zrušit
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:border-white/[0.12] hover:text-slate-400 transition"
            >
              <Plus className="w-4 h-4" />
              Přidat sloupec
            </button>
          )}
        </div>
      )}
    </div>
  );
}
