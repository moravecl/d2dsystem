import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, Search, Filter, CheckCircle2, AlertTriangle, Clock, CreditCard as Edit2 } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import {
  computeDueStatus, dueStatusColor, dueStatusLabel,
  ASSET_TYPE_LABELS, DUE_TYPE_LABELS,
} from '../../types/assets';
import CompleteDueItemModal from '../../components/assets/CompleteDueItemModal';
import DueItemFormModal from '../../components/assets/DueItemFormModal';
import type { DueItem, Asset, DueStatus, DueType } from '../../types/assets';

interface DueWithAsset extends DueItem {
  asset?: Asset;
}

export default function DueItemsPage() {
  const { setConfig } = useHeader();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<DueWithAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterType, setFilterType] = useState('');
  const [completeItem, setCompleteItem] = useState<DueWithAsset | null>(null);
  const [editItem, setEditItem] = useState<DueWithAsset | null>(null);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Majetek', href: '/majetek' }, { label: 'Revize & Termíny' }] });
  }, [setConfig]);

  const loadItems = async () => {
    const { data } = await supabase
      .from('due_items')
      .select('*, assets(id, name, asset_type, code, license_plate)')
      .order('due_date', { ascending: true });

    const mapped = ((data || []) as unknown as (DueItem & { assets: Asset })[]).map(d => ({
      ...d,
      asset: d.assets,
    }));
    setItems(mapped);
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, []);

  const filtered = items.filter(item => {
    const status = computeDueStatus(item);

    if (filterStatus === 'overdue' && status !== 'overdue') return false;
    if (filterStatus === 'upcoming' && status !== 'upcoming') return false;
    if (filterStatus === 'ok' && status !== 'ok') return false;
    if (filterStatus === 'completed' && status !== 'completed') return false;
    if (!filterStatus && status === 'completed') return false;

    if (filterType && item.due_type !== filterType) return false;

    if (search) {
      const q = search.toLowerCase();
      if (
        !item.label.toLowerCase().includes(q) &&
        !(item.asset?.name || '').toLowerCase().includes(q) &&
        !(item.asset?.code || '').toLowerCase().includes(q)
      ) return false;
    }

    return true;
  });

  const countByStatus = (s: DueStatus) => items.filter(i => computeDueStatus(i) === s).length;

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => { setFilterStatus(filterStatus === 'overdue' ? '' : 'overdue'); }}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${filterStatus === 'overdue' ? 'border-red-300 bg-red-500/10 ring-2 ring-red-500/20' : 'border-white/10 bg-white/[0.06] '}`}
        >
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div className="text-left">
            <div className="text-xl font-extrabold text-white">{countByStatus('overdue')}</div>
            <div className="text-xs text-slate-500">Po termínu</div>
          </div>
        </button>
        <button
          onClick={() => { setFilterStatus(filterStatus === 'upcoming' ? '' : 'upcoming'); }}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${filterStatus === 'upcoming' ? 'border-amber-300 bg-amber-500/10 ring-2 ring-amber-500/20' : 'border-white/10 bg-white/[0.06] '}`}
        >
          <Clock className="w-5 h-5 text-amber-500" />
          <div className="text-left">
            <div className="text-xl font-extrabold text-white">{countByStatus('upcoming')}</div>
            <div className="text-xs text-slate-500">Blíží se (30 dní)</div>
          </div>
        </button>
        <button
          onClick={() => { setFilterStatus(filterStatus === 'ok' ? '' : 'ok'); }}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${filterStatus === 'ok' ? 'border-emerald-300 bg-emerald-500/10 ring-2 ring-emerald-200' : 'border-white/10 bg-white/[0.06] '}`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div className="text-left">
            <div className="text-xl font-extrabold text-white">{countByStatus('ok')}</div>
            <div className="text-xs text-slate-500">V pořádku</div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat termín nebo majetek..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Všechny typy</option>
          {Object.entries(DUE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {filterStatus === 'completed' ? null : (
          <button
            onClick={() => setFilterStatus('completed')}
            className="px-3 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:bg-white/[0.04] transition"
          >
            Zobrazit splněné
          </button>
        )}
        {(filterStatus || filterType || search) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterType(''); setSearch(''); }}
            className="px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/100/10 transition"
          >
            Zrušit filtry
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Žádné termíny odpovídající filtru</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {filtered.map(item => {
            const status = computeDueStatus(item);
            return (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04]/50 transition group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueStatusColor(status)}`}>
                      {dueStatusLabel(status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <Link to={`/majetek/${item.asset_id}`} className="font-semibold text-blue-400 hover:text-blue-400">
                      {item.asset?.name || 'Majetek'}
                    </Link>
                    <span>{DUE_TYPE_LABELS[item.due_type] || item.due_type}</span>
                    {item.asset && <span>{ASSET_TYPE_LABELS[item.asset.asset_type]}</span>}
                    {item.due_date && <span>Platnost do: {new Date(item.due_date).toLocaleDateString('cs-CZ')}</span>}
                    {item.interval_months && <span>Interval: {item.interval_months} měs.</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setEditItem(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Upravit
                  </button>
                  {status !== 'completed' && (
                    <button
                      onClick={() => setCompleteItem(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Splnit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completeItem && (
        <CompleteDueItemModal
          item={completeItem}
          assetName={completeItem.asset?.name || ''}
          onClose={() => setCompleteItem(null)}
          onCompleted={() => { setCompleteItem(null); loadItems(); }}
        />
      )}

      {editItem && (
        <DueItemFormModal
          assetId={editItem.asset_id}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); loadItems(); }}
        />
      )}
    </div>
  );
}
