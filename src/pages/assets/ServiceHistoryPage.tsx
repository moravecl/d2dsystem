import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, Calendar, CreditCard as Edit2, Trash2 } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import { EVENT_TYPE_LABELS, ASSET_TYPE_LABELS } from '../../types/assets';
import EventFormModal from '../../components/assets/EventFormModal';
import { useToast } from '../../components/ui/Toast';
import type { AssetEvent, Asset } from '../../types/assets';

interface EventWithAsset extends AssetEvent {
  asset?: Asset;
}

export default function ServiceHistoryPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventWithAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editEvent, setEditEvent] = useState<EventWithAsset | null>(null);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Majetek', href: '/majetek' }, { label: 'Servisní historie' }] });
  }, [setConfig]);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('asset_events')
      .select('*, assets(id, name, asset_type, code)')
      .order('event_date', { ascending: false })
      .limit(200);

    const mapped = ((data || []) as unknown as (AssetEvent & { assets: Asset })[]).map(e => ({
      ...e,
      asset: e.assets,
    }));
    setEvents(mapped);
    setLoading(false);
  };

  useEffect(() => { loadEvents(); }, []);

  const handleDeleteEvent = async (ev: EventWithAsset) => {
    if (!confirm(`Opravdu chcete smazat "${ev.title}"?`)) return;
    const { error } = await supabase.from('asset_events').delete().eq('id', ev.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Událost smazána');
    loadEvents();
  };

  const filtered = events.filter(ev => {
    if (filterType && ev.event_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !ev.title.toLowerCase().includes(q) &&
        !(ev.asset?.name || '').toLowerCase().includes(q) &&
        !ev.supplier.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalCost = filtered.reduce((s, e) => s + (e.cost || 0), 0);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat událost, majetek, dodavatele..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Všechny typy</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {totalCost > 0 && (
          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Celkové náklady</div>
            <div className="text-lg font-extrabold text-white">{totalCost.toLocaleString('cs-CZ')} Kč</div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Zatím žádné servisní záznamy</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {filtered.map(ev => {
            const typeColorMap: Record<string, string> = {
              service: 'bg-emerald-500/20 text-emerald-400',
              revision: 'bg-blue-500/20 text-blue-400',
              damage: 'bg-red-500/20 text-red-400',
              insurance: 'bg-cyan-500/20 text-cyan-700',
              warranty_claim: 'bg-amber-500/20 text-amber-400',
              stk: 'bg-orange-500/20 text-orange-700',
              calibration: 'bg-white/[0.06] text-slate-300',
            };
            const typeColor = typeColorMap[ev.event_type] || 'bg-white/[0.06] text-slate-300';

            return (
              <div key={ev.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04]/50 transition group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeColor}`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{ev.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColor}`}>
                      {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <Link to={`/majetek/${ev.asset_id}`} className="font-semibold text-blue-400 hover:text-blue-400">
                      {ev.asset?.name || 'Majetek'}
                    </Link>
                    {ev.asset && <span>{ASSET_TYPE_LABELS[ev.asset.asset_type]}</span>}
                    <span>{new Date(ev.event_date).toLocaleDateString('cs-CZ')}</span>
                    {ev.supplier && <span>{ev.supplier}</span>}
                    {ev.odometer_km && <span>{ev.odometer_km.toLocaleString('cs-CZ')} km</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ev.cost > 0 && (
                    <div className="text-right shrink-0 mr-2">
                      <div className="text-sm font-bold text-white">{ev.cost.toLocaleString('cs-CZ')} Kč</div>
                    </div>
                  )}
                  <button
                    onClick={() => setEditEvent(ev)}
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                    title="Upravit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(ev)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                    title="Smazat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editEvent && (
        <EventFormModal
          assetId={editEvent.asset_id}
          event={editEvent}
          onClose={() => setEditEvent(null)}
          onSaved={() => { setEditEvent(null); loadEvents(); }}
        />
      )}
    </div>
  );
}
