import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Car, Cpu, Building2, Wrench, ArrowRight, List } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import { computeDueStatus, dueStatusColor, dueStatusLabel, ASSET_TYPE_LABELS, DUE_TYPE_LABELS } from '../../types/assets';
import type { DueItem, Asset, DueStatus } from '../../types/assets';

interface DueWithAsset extends DueItem {
  asset?: Asset;
}

export default function AssetDashboardPage() {
  const { setConfig } = useHeader();
  const [counts, setCounts] = useState({ vehicle: 0, appliance: 0, building: 0, tool: 0 });
  const [upcomingItems, setUpcomingItems] = useState<DueWithAsset[]>([]);
  const [overdueItems, setOverdueItems] = useState<DueWithAsset[]>([]);
  const [allDueItems, setAllDueItems] = useState<DueWithAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setConfig({ breadcrumbs: [{ label: 'Majetek' }] }); }, [setConfig]);

  useEffect(() => {
    async function load() {
      const [vehicleRes, applianceRes, buildingRes, toolRes, dueRes] = await Promise.all([
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('asset_type', 'vehicle').eq('is_active', true),
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('asset_type', 'appliance').eq('is_active', true),
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('asset_type', 'building').eq('is_active', true),
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('asset_type', 'tool').eq('is_active', true),
        supabase.from('due_items').select('*, assets(id, name, asset_type)').neq('status', 'completed').order('due_date', { ascending: true }),
      ]);

      setCounts({
        vehicle: vehicleRes.count || 0,
        appliance: applianceRes.count || 0,
        building: buildingRes.count || 0,
        tool: toolRes.count || 0,
      });

      const items = ((dueRes.data || []) as unknown as (DueItem & { assets: Asset })[]).map(d => ({
        ...d,
        asset: d.assets,
      }));

      const upcoming: DueWithAsset[] = [];
      const overdue: DueWithAsset[] = [];

      items.forEach(item => {
        const status = computeDueStatus(item);
        if (status === 'overdue') overdue.push(item);
        else if (status === 'upcoming') upcoming.push(item);
      });

      setUpcomingItems(upcoming.slice(0, 10));
      setOverdueItems(overdue.slice(0, 10));
      setAllDueItems(items);
      setLoading(false);
    }
    load();
  }, []);

  const typeCards = [
    { key: 'vehicle', icon: Car, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', href: '/majetek/vozidla' },
    { key: 'appliance', icon: Cpu, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10', href: '/majetek/zarizeni' },
    { key: 'building', icon: Building2, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-500/10', href: '/majetek/budovy' },
    { key: 'tool', icon: Wrench, gradient: 'from-slate-500 to-slate-600', bg: 'bg-white/[0.04]', href: '#' },
  ] as const;

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {typeCards.map(card => (
          <Link key={card.key} to={card.href} className="group bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-extrabold text-white">{counts[card.key]}</div>
            <div className="text-xs text-slate-500">{ASSET_TYPE_LABELS[card.key]}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Po termínu ({overdueItems.length})
            </h2>
            <Link to="/majetek/terminy?status=overdue" className="text-xs text-blue-400 hover:text-blue-400 font-semibold flex items-center gap-1">
              Zobrazit vše <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {overdueItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Žádné položky po termínu</div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {overdueItems.map(item => (
                <DueRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              Blíží se (do 30 dni) ({upcomingItems.length})
            </h2>
            <Link to="/majetek/terminy?status=upcoming" className="text-xs text-blue-400 hover:text-blue-400 font-semibold flex items-center gap-1">
              Zobrazit vše <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {upcomingItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Žádné blížící se termíny</div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {upcomingItems.map(item => (
                <DueRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <List className="w-4 h-4 text-blue-400" />
            Všechny termíny ({allDueItems.length})
          </h2>
          <Link to="/majetek/terminy" className="text-xs text-blue-400 hover:text-blue-400 font-semibold flex items-center gap-1">
            Zobrazit vše <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {allDueItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Žádné aktivní termíny</div>
        ) : (
          <div className="divide-y divide-white/[0.06] max-h-[400px] overflow-y-auto">
            {allDueItems.map(item => (
              <DueRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DueRow({ item }: { item: DueWithAsset }) {
  const status: DueStatus = computeDueStatus(item);
  return (
    <Link to={`/majetek/${item.asset_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white truncate">{item.label}</div>
        <div className="text-xs text-slate-400 mt-0.5">
          {item.asset?.name} &middot; {DUE_TYPE_LABELS[item.due_type as keyof typeof DUE_TYPE_LABELS] || item.due_type}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueStatusColor(status)}`}>
          {dueStatusLabel(status)}
        </span>
        {item.due_date && <div className="text-[10px] text-slate-400 mt-1">{new Date(item.due_date).toLocaleDateString('cs-CZ')}</div>}
      </div>
    </Link>
  );
}
