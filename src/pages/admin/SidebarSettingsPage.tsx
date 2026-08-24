import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GripVertical, Eye, EyeOff, RotateCcw, Save, Check, Loader2,
  ChevronDown, ChevronUp, Pencil, Plus, Trash2, FolderOpen,
} from 'lucide-react';
import { useSidebarSettings } from '../../hooks/useSidebarSettings';
import {
  ALL_SIDEBAR_ITEMS,
  DEFAULT_ORDER,
  DEFAULT_GROUPS,
  type SidebarItemSetting,
  type SidebarGroup,
} from '../../lib/sidebarConfig';
import Modal from '../../components/ui/Modal';

export default function SidebarSettingsPage() {
  const { settings, groups: savedGroups, loading, save } = useSidebarSettings();
  const [items, setItems] = useState<SidebarItemSetting[]>([]);
  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editingGroup, setEditingGroup] = useState<SidebarGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [showNewGroup, setShowNewGroup] = useState(false);

  const [dragItemKey, setDragItemKey] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ groupId: string; idx: number } | null>(null);

  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const dragGroupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setItems(settings);
      setGroups(savedGroups);
    }
  }, [loading, settings, savedGroups]);

  const getDef = (key: string) => ALL_SIDEBAR_ITEMS.find((i) => i.key === key);

  const getGroupItems = useCallback((groupId: string) => {
    return items.filter((i) => (i.groupId || '') === groupId);
  }, [items]);

  const handleItemDragStart = (key: string) => {
    setDragItemKey(key);
  };

  const handleItemDragOver = (e: React.DragEvent, groupId: string, idx: number) => {
    e.preventDefault();
    if (!dragItemKey) return;
    setDragOverTarget({ groupId, idx });
  };

  const handleItemDrop = (targetGroupId: string, targetIdx: number) => {
    if (!dragItemKey) return;

    setItems((prev) => {
      const next = prev.map((i) => ({ ...i }));
      const draggedIdx = next.findIndex((i) => i.key === dragItemKey);
      if (draggedIdx === -1) return prev;

      const [dragged] = next.splice(draggedIdx, 1);
      dragged.groupId = targetGroupId || null;

      const groupItems = next.filter((i) => (i.groupId || '') === targetGroupId);
      const insertAfterKey = groupItems[targetIdx - 1]?.key;

      if (insertAfterKey) {
        const insertAfterIdx = next.findIndex((i) => i.key === insertAfterKey);
        next.splice(insertAfterIdx + 1, 0, dragged);
      } else {
        const firstGroupItemIdx = next.findIndex((i) => (i.groupId || '') === targetGroupId);
        if (firstGroupItemIdx === -1) {
          next.push(dragged);
        } else {
          next.splice(firstGroupItemIdx, 0, dragged);
        }
      }

      return next;
    });

    setDragItemKey(null);
    setDragOverTarget(null);
  };

  const handleItemDragEnd = () => {
    setDragItemKey(null);
    setDragOverTarget(null);
  };

  const handleGroupDragStart = (groupId: string) => {
    dragGroupRef.current = groupId;
    setDragGroupId(groupId);
  };

  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (!dragGroupRef.current || dragGroupRef.current === groupId) return;
    setDragOverGroupId(groupId);
  };

  const handleGroupDrop = (targetGroupId: string) => {
    const fromId = dragGroupRef.current;
    if (!fromId || fromId === targetGroupId) {
      setDragGroupId(null);
      setDragOverGroupId(null);
      dragGroupRef.current = null;
      return;
    }

    setGroups((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((g) => g.id === fromId);
      const toIdx = next.findIndex((g) => g.id === targetGroupId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });

    setDragGroupId(null);
    setDragOverGroupId(null);
    dragGroupRef.current = null;
  };

  const handleGroupDragEnd = () => {
    setDragGroupId(null);
    setDragOverGroupId(null);
    dragGroupRef.current = null;
  };

  const toggleVisible = (key: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, visible: !i.visible } : i)));
  };

  const moveGroupUp = (groupId: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveGroupDown = (groupId: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const openEditGroup = (group: SidebarGroup) => {
    setEditingGroup(group);
    setGroupForm({ name: group.name, description: group.description });
  };

  const saveEditGroup = () => {
    if (!editingGroup || !groupForm.name.trim()) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === editingGroup.id
          ? { ...g, name: groupForm.name.trim(), description: groupForm.description.trim() }
          : g,
      ),
    );
    setEditingGroup(null);
  };

  const openNewGroup = () => {
    setGroupForm({ name: '', description: '' });
    setShowNewGroup(true);
  };

  const saveNewGroup = () => {
    if (!groupForm.name.trim()) return;
    const id = groupForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const uniqueId = groups.find((g) => g.id === id) ? `${id}-${Date.now()}` : id;
    setGroups((prev) => [...prev, { id: uniqueId, name: groupForm.name.trim(), description: groupForm.description.trim() }]);
    setShowNewGroup(false);
  };

  const deleteGroup = (groupId: string) => {
    setItems((prev) => prev.map((i) => (i.groupId === groupId ? { ...i, groupId: null } : i)));
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const moveItemUp = (key: string, groupId: string) => {
    setItems((prev) => {
      const next = [...prev];
      const groupItemKeys = next.filter((i) => (i.groupId || '') === groupId).map((i) => i.key);
      const posInGroup = groupItemKeys.indexOf(key);
      if (posInGroup <= 0) return prev;

      const prevKey = groupItemKeys[posInGroup - 1];
      const aIdx = next.findIndex((i) => i.key === key);
      const bIdx = next.findIndex((i) => i.key === prevKey);
      [next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]];
      return next;
    });
  };

  const moveItemDown = (key: string, groupId: string) => {
    setItems((prev) => {
      const next = [...prev];
      const groupItemKeys = next.filter((i) => (i.groupId || '') === groupId).map((i) => i.key);
      const posInGroup = groupItemKeys.indexOf(key);
      if (posInGroup === -1 || posInGroup >= groupItemKeys.length - 1) return prev;

      const nextKey = groupItemKeys[posInGroup + 1];
      const aIdx = next.findIndex((i) => i.key === key);
      const bIdx = next.findIndex((i) => i.key === nextKey);
      [next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await save(items, groups);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setItems(DEFAULT_ORDER);
    setGroups(DEFAULT_GROUPS);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const ungroupedItems = getGroupItems('');

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white">Nastavení sidebaru</h1>
        <p className="text-sm text-slate-500 mt-1">
          Organizujte položky do sekci, měňte jejich pořadí a viditelnost. Přetažením přesunete položky mezi sekcemi.
        </p>
      </div>

      {ungroupedItems.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
            Bez sekce
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-navy-800/60 overflow-hidden">
            <ItemList
              items={ungroupedItems}
              groupId=""
              getDef={getDef}
              dragItemKey={dragItemKey}
              dragOverTarget={dragOverTarget}
              onDragStart={handleItemDragStart}
              onDragOver={handleItemDragOver}
              onDrop={handleItemDrop}
              onDragEnd={handleItemDragEnd}
              onToggleVisible={toggleVisible}
              onMoveUp={moveItemUp}
              onMoveDown={moveItemDown}
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group, gIdx) => {
          const groupItems = getGroupItems(group.id);
          const isDragOver = dragOverGroupId === group.id && dragGroupId !== group.id;
          const isDragging = dragGroupId === group.id;

          return (
            <div
              key={group.id}
              draggable
              onDragStart={() => handleGroupDragStart(group.id)}
              onDragOver={(e) => handleGroupDragOver(e, group.id)}
              onDrop={() => handleGroupDrop(group.id)}
              onDragEnd={handleGroupDragEnd}
              className={`rounded-2xl border transition-all duration-150 ${
                isDragging
                  ? 'opacity-30 scale-[0.99] border-white/[0.06]'
                  : isDragOver
                    ? 'ring-2 ring-blue-500/30 border-blue-500/20 bg-blue-500/5'
                    : 'border-white/[0.08] bg-navy-800/60'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                <GripVertical className="w-4 h-4 text-slate-600 shrink-0 cursor-grab active:cursor-grabbing" />

                <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{group.name}</div>
                  {group.description && (
                    <div className="text-[11px] text-slate-500 truncate">{group.description}</div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-600 mr-1">
                    {groupItems.length}
                  </span>

                  <button
                    onClick={() => moveGroupUp(group.id)}
                    disabled={gIdx === 0}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-20"
                    title="Posunout sekci nahoru"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveGroupDown(group.id)}
                    disabled={gIdx === groups.length - 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-20"
                    title="Posunout sekci dolů"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditGroup(group)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition"
                    title="Upravit sekci"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Smazat sekci"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {groupItems.length === 0 ? (
                <div
                  className="py-6 text-center text-xs text-slate-600"
                  onDragOver={(e) => handleItemDragOver(e, group.id, 0)}
                  onDrop={() => handleItemDrop(group.id, 0)}
                >
                  Přetáhněte sem položky
                </div>
              ) : (
                <ItemList
                  items={groupItems}
                  groupId={group.id}
                  getDef={getDef}
                  dragItemKey={dragItemKey}
                  dragOverTarget={dragOverTarget}
                  onDragStart={handleItemDragStart}
                  onDragOver={handleItemDragOver}
                  onDrop={handleItemDrop}
                  onDragEnd={handleItemDragEnd}
                  onToggleVisible={toggleVisible}
                  onMoveUp={moveItemUp}
                  onMoveDown={moveItemDown}
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={openNewGroup}
        className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-400 border border-dashed border-white/10 rounded-xl hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5 transition w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        Přidat novou sekci
      </button>

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Uloženo' : 'Uložit'}
        </button>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/10 text-slate-400 text-sm font-semibold rounded-xl hover:bg-white/[0.04] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Výchozí nastavení
        </button>
      </div>

      <Modal
        open={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        title="Upravit sekci"
        size="sm"
        footer={
          <>
            <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
              Zrušit
            </button>
            <button
              onClick={saveEditGroup}
              disabled={!groupForm.name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název sekce *</label>
            <input
              type="text"
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <input
              type="text"
              value={groupForm.description}
              onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
              placeholder="Krátký popis sekce..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        title="Nová sekce"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowNewGroup(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
              Zrušit
            </button>
            <button
              onClick={saveNewGroup}
              disabled={!groupForm.name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              Vytvořit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název sekce *</label>
            <input
              type="text"
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <input
              type="text"
              value={groupForm.description}
              onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
              placeholder="Krátký popis sekce..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface ItemListProps {
  items: SidebarItemSetting[];
  groupId: string;
  getDef: (key: string) => typeof ALL_SIDEBAR_ITEMS[number] | undefined;
  dragItemKey: string | null;
  dragOverTarget: { groupId: string; idx: number } | null;
  onDragStart: (key: string) => void;
  onDragOver: (e: React.DragEvent, groupId: string, idx: number) => void;
  onDrop: (groupId: string, idx: number) => void;
  onDragEnd: () => void;
  onToggleVisible: (key: string) => void;
  onMoveUp: (key: string, groupId: string) => void;
  onMoveDown: (key: string, groupId: string) => void;
}

function ItemList({
  items,
  groupId,
  getDef,
  dragItemKey,
  dragOverTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
}: ItemListProps) {
  return (
    <div className="divide-y divide-white/[0.04]">
      {items.map((item, idx) => {
        const def = getDef(item.key);
        if (!def) return null;
        const Icon = def.icon;
        const isDragging = dragItemKey === item.key;
        const isOver = dragOverTarget?.groupId === groupId && dragOverTarget?.idx === idx && dragItemKey !== item.key;

        return (
          <div
            key={item.key}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(item.key);
            }}
            onDragOver={(e) => {
              e.stopPropagation();
              onDragOver(e, groupId, idx);
            }}
            onDrop={(e) => {
              e.stopPropagation();
              onDrop(groupId, idx);
            }}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
              isDragging ? 'opacity-30 scale-[0.98]' : ''
            } ${isOver ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/20' : 'hover:bg-white/[0.03]'}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-slate-600 shrink-0" />

            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                item.visible ? 'bg-white/[0.06] text-slate-400' : 'bg-white/[0.02] text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>

            <span
              className={`flex-1 text-sm font-medium transition-colors ${
                item.visible ? 'text-white' : 'text-slate-500 line-through'
              }`}
            >
              {def.label}
            </span>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onMoveUp(item.key, groupId); }}
                disabled={idx === 0}
                className="p-1 rounded text-slate-600 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-20"
                title="Posunout nahoru"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveDown(item.key, groupId); }}
                disabled={idx === items.length - 1}
                className="p-1 rounded text-slate-600 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-20"
                title="Posunout dolů"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisible(item.key); }}
                className={`p-1.5 rounded-lg transition-colors ${
                  item.visible
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                }`}
                title={item.visible ? 'Skryt' : 'Zobrazit'}
              >
                {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        );
      })}

      <div
        className="h-1"
        onDragOver={(e) => onDragOver(e, groupId, items.length)}
        onDrop={(e) => { e.stopPropagation(); onDrop(groupId, items.length); }}
      />
    </div>
  );
}
