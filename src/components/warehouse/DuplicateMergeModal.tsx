import { useState, useMemo } from 'react';
import {
  GitMerge, Trash2, Check, ChevronDown, ChevronRight,
  AlertTriangle, Package, Loader2,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface WarehouseItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  price_per_unit: number;
  category: string;
  location: string;
  product_id: string | null;
  camera_product_id: string | null;
  eps_product_id: string | null;
  camera_table: string | null;
  eps_table: string | null;
  catalog_source: string;
}

interface DuplicateGroup {
  key: string;
  reason: string;
  items: WarehouseItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: WarehouseItem[];
  onRefresh: () => void;
}

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findDuplicates(items: WarehouseItem[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  const byName = new Map<string, WarehouseItem[]>();
  for (const item of items) {
    const key = normalize(item.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(item);
  }
  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    groups.push({
      key: `name:${key}`,
      reason: 'Shodny nazev',
      items: group,
    });
    group.forEach(i => used.add(i.id));
  }

  const byCameraKey = new Map<string, WarehouseItem[]>();
  for (const item of items) {
    if (!item.camera_product_id || !item.camera_table) continue;
    const key = `${item.camera_table}:${item.camera_product_id}`;
    if (!byCameraKey.has(key)) byCameraKey.set(key, []);
    byCameraKey.get(key)!.push(item);
  }
  for (const [key, group] of byCameraKey) {
    if (group.length < 2) continue;
    const ids = group.map(i => i.id).sort().join(',');
    if (groups.some(g => g.items.map(i => i.id).sort().join(',') === ids)) continue;
    groups.push({
      key: `camera:${key}`,
      reason: 'Stejna kamera',
      items: group,
    });
  }

  const byEpsKey = new Map<string, WarehouseItem[]>();
  for (const item of items) {
    if (!item.eps_product_id || !item.eps_table) continue;
    const key = `${item.eps_table}:${item.eps_product_id}`;
    if (!byEpsKey.has(key)) byEpsKey.set(key, []);
    byEpsKey.get(key)!.push(item);
  }
  for (const [key, group] of byEpsKey) {
    if (group.length < 2) continue;
    const ids = group.map(i => i.id).sort().join(',');
    if (groups.some(g => g.items.map(i => i.id).sort().join(',') === ids)) continue;
    groups.push({
      key: `eps:${key}`,
      reason: 'Stejny EPS prvek',
      items: group,
    });
  }

  const byProductId = new Map<string, WarehouseItem[]>();
  for (const item of items) {
    if (!item.product_id) continue;
    const key = item.product_id;
    if (!byProductId.has(key)) byProductId.set(key, []);
    byProductId.get(key)!.push(item);
  }
  for (const [key, group] of byProductId) {
    if (group.length < 2) continue;
    const ids = group.map(i => i.id).sort().join(',');
    if (groups.some(g => g.items.map(i => i.id).sort().join(',') === ids)) continue;
    groups.push({
      key: `product:${key}`,
      reason: 'Stejny katalogovy produkt',
      items: group,
    });
  }

  return groups;
}

export default function DuplicateMergeModal({ open, onClose, items, onRefresh }: Props) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [mergedGroups, setMergedGroups] = useState<Set<string>>(new Set());

  const duplicates = useMemo(() => findDuplicates(items), [items]);

  const pendingGroups = duplicates.filter(g => !mergedGroups.has(g.key));

  const toggleExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getPrimary = (group: DuplicateGroup) => {
    if (selectedPrimary[group.key]) return selectedPrimary[group.key];
    const withQty = group.items.filter(i => i.quantity > 0);
    if (withQty.length === 1) return withQty[0].id;
    const withLoc = group.items.filter(i => i.location);
    if (withLoc.length === 1) return withLoc[0].id;
    return group.items[0].id;
  };

  const handleMerge = async (group: DuplicateGroup) => {
    setProcessing(true);
    try {
      const primaryId = getPrimary(group);
      const primary = group.items.find(i => i.id === primaryId)!;
      const others = group.items.filter(i => i.id !== primaryId);

      const totalQuantity = group.items.reduce((sum, i) => sum + i.quantity, 0);
      const bestLocation = primary.location || others.find(i => i.location)?.location || '';
      const bestSku = primary.sku || others.find(i => i.sku)?.sku || '';
      const bestCategory = primary.category || others.find(i => i.category)?.category || '';
      const maxMinQty = Math.max(...group.items.map(i => i.min_quantity));
      const maxPrice = Math.max(...group.items.map(i => i.price_per_unit));

      const { error: updateErr } = await supabase.from('warehouse_items').update({
        quantity: totalQuantity,
        location: bestLocation,
        sku: bestSku,
        category: bestCategory,
        min_quantity: maxMinQty,
        price_per_unit: maxPrice,
        updated_at: new Date().toISOString(),
      }).eq('id', primaryId);

      if (updateErr) {
        toast('Chyba při slučování', 'error');
        setProcessing(false);
        return;
      }

      const otherIds = others.map(i => i.id);

      if (otherIds.length > 0) {
        await supabase.from('warehouse_transactions')
          .update({ item_id: primaryId })
          .in('item_id', otherIds);

        await supabase.from('warehouse_items')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', otherIds);
      }

      setMergedGroups(prev => new Set([...prev, group.key]));
      toast(`Sloučeno ${group.items.length} položek do jedné`);
      onRefresh();
    } catch {
      toast('Chyba při slučování', 'error');
    }
    setProcessing(false);
  };

  const handleMergeAll = async () => {
    for (const group of pendingGroups) {
      await handleMerge(group);
    }
  };

  const handleDeleteDuplicates = async (group: DuplicateGroup) => {
    setProcessing(true);
    try {
      const primaryId = getPrimary(group);
      const others = group.items.filter(i => i.id !== primaryId);
      const otherIds = others.map(i => i.id);

      if (otherIds.length > 0) {
        await supabase.from('warehouse_transactions')
          .update({ item_id: primaryId })
          .in('item_id', otherIds);

        await supabase.from('warehouse_items')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', otherIds);
      }

      setMergedGroups(prev => new Set([...prev, group.key]));
      toast(`Smazáno ${otherIds.length} duplicit`);
      onRefresh();
    } catch {
      toast('Chyba při mazání', 'error');
    }
    setProcessing(false);
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <Modal open={open} onClose={onClose} title="Správa duplicit" size="xl" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04] rounded-lg transition">
          Zavřít
        </button>
        {pendingGroups.length > 0 && (
          <button
            onClick={handleMergeAll}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            Sloučit vše ({pendingGroups.length})
          </button>
        )}
      </>
    }>
      <div className="space-y-4">
        {duplicates.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-14 h-14 text-emerald-400 mx-auto mb-4 opacity-60" />
            <p className="text-base font-semibold text-white mb-1">Žádné duplicity</p>
            <p className="text-sm text-slate-500">Ve skladu nebyly nalezeny žádné duplicitní položky.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs text-slate-300">
                Nalezeno <span className="font-bold text-amber-400">{pendingGroups.length}</span> skupin duplicit
                ({pendingGroups.reduce((s, g) => s + g.items.length, 0)} položek celkem).
                U každé skupiny vyberte hlavní položku a slučte nebo smažte duplicity.
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {duplicates.map(group => {
                const isMerged = mergedGroups.has(group.key);
                const isExpanded = expandedGroups.has(group.key);
                const primaryId = getPrimary(group);

                return (
                  <div
                    key={group.key}
                    className={`rounded-xl border transition ${
                      isMerged
                        ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60'
                        : 'bg-navy-800/40 border-white/[0.08] hover:border-white/[0.12]'
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(group.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {group.items[0].name}
                          </span>
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                            {group.items.length}x
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">
                            {group.reason}
                          </span>
                          {isMerged && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Check className="w-3 h-3" /> Sloučeno
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Celkem: {group.items.reduce((s, i) => s + i.quantity, 0)} {group.items[0].unit}
                          {' | '}Hodnota: {fmt(group.items.reduce((s, i) => s + i.quantity * i.price_per_unit, 0))} Kc
                        </div>
                      </div>
                    </button>

                    {isExpanded && !isMerged && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-1.5">
                          {group.items.map(item => (
                            <label
                              key={item.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${
                                primaryId === item.id
                                  ? 'bg-blue-500/10 border border-blue-500/30'
                                  : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`primary-${group.key}`}
                                checked={primaryId === item.id}
                                onChange={() => setSelectedPrimary(prev => ({ ...prev, [group.key]: item.id }))}
                                className="text-blue-500 focus:ring-blue-500/40"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white truncate">{item.name}</span>
                                  {primaryId === item.id && (
                                    <span className="text-[9px] font-bold text-blue-400 bg-blue-500/20 px-1 py-0.5 rounded">
                                      Hlavní
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                                  <span>Množství: <span className="text-slate-300 font-medium">{item.quantity} {item.unit}</span></span>
                                  <span>Cena: <span className="text-slate-300 font-medium">{fmt(item.price_per_unit)} Kc</span></span>
                                  {item.sku && <span>SKU: <span className="text-slate-300">{item.sku}</span></span>}
                                  {item.location && <span>Umístění: <span className="text-slate-300">{item.location}</span></span>}
                                  {item.catalog_source && (
                                    <span className="text-[10px] font-medium text-slate-400 bg-white/[0.06] px-1 py-0.5 rounded">
                                      {item.catalog_source === 'products' ? 'Katalog' : item.catalog_source === 'camera' ? 'Kamera' : item.catalog_source === 'eps' ? 'EPS' : 'Rucni'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleMerge(group)}
                            disabled={processing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition disabled:opacity-50"
                          >
                            <GitMerge className="w-3.5 h-3.5" /> Sloučit (sečíst množství)
                          </button>
                          <button
                            onClick={() => handleDeleteDuplicates(group)}
                            disabled={processing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Smazat duplicity (ponechat hlavní)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
