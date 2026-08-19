import { useState } from 'react';
import { Plus, Trash2, GripVertical, Save, X, Tag, Loader2, ChevronDown, ChevronRight, Pencil, Download } from 'lucide-react';
import type { CatalogCategory, CategoryGroupDef } from '../../hooks/useCatalogCategories';

interface Props {
  groups: CategoryGroupDef[];
  getCategoriesForGroup: (group: string) => CatalogCategory[];
  hasCustomCategories: (group: string) => boolean;
  seedDefaults: (group: string) => Promise<void>;
  addCategory: (group: string, key: string, label: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Pick<CatalogCategory, 'key' | 'label' | 'sort_order' | 'is_active'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  accentColor?: 'blue' | 'red';
}

export default function CategoryManager({
  groups, getCategoriesForGroup, hasCustomCategories,
  seedDefaults, addCategory, updateCategory, deleteCategory,
  accentColor = 'blue',
}: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const accent = accentColor === 'red' ? {
    bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400',
    btn: 'bg-red-600 hover:bg-red-700', btnLight: 'bg-red-500/10 text-red-400 hover:bg-red-500/15',
    badge: 'bg-red-500/20 text-red-400',
  } : {
    bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-700', btnLight: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/15',
    badge: 'bg-blue-500/20 text-blue-400',
  };

  const handleSeedDefaults = async (group: string) => {
    setBusy(true);
    await seedDefaults(group);
    setBusy(false);
  };

  const handleAdd = async (group: string) => {
    if (!newKey.trim() || !newLabel.trim()) return;
    setBusy(true);
    await addCategory(group, newKey.trim().toLowerCase().replace(/\s+/g, '_'), newLabel.trim());
    setNewKey('');
    setNewLabel('');
    setAddingGroup(null);
    setBusy(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editKey.trim() || !editLabel.trim()) return;
    setBusy(true);
    await updateCategory(id, { key: editKey.trim().toLowerCase().replace(/\s+/g, '_'), label: editLabel.trim() });
    setEditingId(null);
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tuto kategorii?')) return;
    setBusy(true);
    await deleteCategory(id);
    setBusy(false);
  };

  const startEdit = (cat: CatalogCategory) => {
    setEditingId(cat.id);
    setEditKey(cat.key);
    setEditLabel(cat.label);
  };

  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isExpanded = expandedGroup === g.group;
        const cats = getCategoriesForGroup(g.group);
        const hasCustom = hasCustomCategories(g.group);

        return (
          <div key={g.group} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : g.group)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              <Tag className={`w-4 h-4 ${accent.text}`} />
              <span className="text-sm font-extrabold text-white flex-1">{g.label}</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${hasCustom ? accent.badge : 'bg-white/[0.08] text-slate-500'}`}>
                {hasCustom ? `${cats.filter(c => c.is_active).length} vlastnich` : `${g.defaults.length} vychozich`}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 pt-1 space-y-2 border-t border-white/[0.06]">
                {!hasCustom && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1">
                      <div className="text-xs text-slate-400 font-medium">
                        Pouzivaji se vychozi kategorie ({g.defaults.length}):
                        <span className="text-slate-500 ml-1">{g.defaults.map(([, l]) => l).join(', ')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSeedDefaults(g.group)}
                      disabled={busy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${accent.btnLight}`}
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      Nacist k uprave
                    </button>
                  </div>
                )}

                {hasCustom && (
                  <div className="space-y-1">
                    {cats.map(cat => (
                      <div key={cat.id}>
                        {editingId === cat.id ? (
                          <div className="flex items-center gap-2 py-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <input
                              value={editKey}
                              onChange={e => setEditKey(e.target.value)}
                              placeholder="klic"
                              className="w-28 px-2 py-1.5 text-xs font-medium bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                            />
                            <input
                              value={editLabel}
                              onChange={e => setEditLabel(e.target.value)}
                              placeholder="Popisek"
                              className="flex-1 px-2 py-1.5 text-xs font-medium bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                            />
                            <button onClick={() => handleSaveEdit(cat.id)} disabled={busy}
                              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-white/[0.06] transition">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-2 py-1.5 rounded-lg hover:bg-white/[0.03] px-1 group ${!cat.is_active ? 'opacity-40' : ''}`}>
                            <GripVertical className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                            <code className="text-[10px] font-bold text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">{cat.key}</code>
                            <span className="text-xs font-bold text-white flex-1">{cat.label}</span>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(cat)}
                                className="p-1 rounded text-slate-500 hover:text-blue-400 transition">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDelete(cat.id)}
                                className="p-1 rounded text-slate-500 hover:text-red-400 transition">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {hasCustom && addingGroup !== g.group && (
                  <button
                    onClick={() => { setAddingGroup(g.group); setNewKey(''); setNewLabel(''); }}
                    className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-slate-300 transition mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Pridat kategorii
                  </button>
                )}

                {addingGroup === g.group && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      placeholder="klic (napr. smoke)"
                      className="w-32 px-2 py-1.5 text-xs font-medium bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd(g.group); }}
                      placeholder="Popisek (napr. Kourovak)"
                      className="flex-1 px-2 py-1.5 text-xs font-medium bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                    />
                    <button onClick={() => handleAdd(g.group)} disabled={busy || !newKey.trim() || !newLabel.trim()}
                      className={`p-1.5 rounded-lg text-white transition disabled:opacity-30 ${accent.btn}`}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setAddingGroup(null)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white/[0.06] transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
