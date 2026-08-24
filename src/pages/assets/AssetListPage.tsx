import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Car, Cpu, Building2, Wrench, MapPin, User } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import { ASSET_TYPE_LABELS, computeDueStatus, dueStatusColor, dueStatusLabel } from '../../types/assets';
import AssetFormModal from '../../components/assets/AssetFormModal';
import type { Asset, AssetType, DueItem } from '../../types/assets';

interface Props {
  assetType: AssetType;
}

const typeIcon = (t: AssetType) => {
  switch (t) {
    case 'vehicle': return Car;
    case 'appliance': return Cpu;
    case 'building': return Building2;
    default: return Wrench;
  }
};

const typeGradient = (t: AssetType) => {
  switch (t) {
    case 'vehicle': return 'from-blue-500 to-blue-600';
    case 'appliance': return 'from-emerald-500 to-emerald-600';
    case 'building': return 'from-amber-500 to-amber-600';
    default: return 'from-slate-500 to-slate-600';
  }
};

export default function AssetListPage({ assetType }: Props) {
  const { setConfig } = useHeader();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<(Asset & { nextDue?: DueItem })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const label = ASSET_TYPE_LABELS[assetType];
  const Icon = typeIcon(assetType);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Majetek', href: '/majetek' }, { label }] });
  }, [setConfig, label]);

  const loadAssets = async () => {
    const { data } = await supabase.from('assets').select('*')
      .eq('asset_type', assetType).eq('is_active', true)
      .order('name');
    const list = (data || []) as Asset[];

    if (list.length > 0) {
      const ids = list.map(a => a.id);
      const { data: dues } = await supabase.from('due_items').select('*')
        .in('asset_id', ids).neq('status', 'completed')
        .order('due_date', { ascending: true });

      const dueMap = new Map<string, DueItem>();
      ((dues || []) as DueItem[]).forEach(d => {
        if (!dueMap.has(d.asset_id)) dueMap.set(d.asset_id, d);
      });

      setAssets(list.map(a => ({ ...a, nextDue: dueMap.get(a.id) })));
    } else {
      setAssets([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadAssets(); }, [assetType]);

  const filtered = assets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
    a.license_plate.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          <Plus className="w-4 h-4" />
          Nový {label.toLowerCase()}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">{assets.length === 0 ? 'Zatím žádný majetek. Přidejte první!' : 'Nic nenalezeno'}</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {filtered.map(asset => {
            const dueStatus = asset.nextDue ? computeDueStatus(asset.nextDue) : null;
            return (
              <Link key={asset.id} to={`/majetek/${asset.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04]/70 transition group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeGradient(assetType)} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{asset.name}</span>
                    {asset.code && <span className="text-[10px] font-mono text-slate-400">{asset.code}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    {asset.manufacturer && <span>{asset.manufacturer} {asset.model}</span>}
                    {assetType === 'vehicle' && asset.license_plate && <span className="font-semibold text-slate-400">{asset.license_plate}</span>}
                    {assetType === 'appliance' && asset.device_type && <span>{asset.device_type}</span>}
                    {asset.location_address && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{asset.location_address}</span>}
                    {asset.owner_type === 'client' && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" />Klient</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {asset.warranty_until && (
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Záruka do</div>
                      <div className="text-xs font-medium text-slate-400">{new Date(asset.warranty_until).toLocaleDateString('cs-CZ')}</div>
                    </div>
                  )}
                  {dueStatus && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueStatusColor(dueStatus)}`}>
                      {dueStatusLabel(dueStatus)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showForm && (
        <AssetFormModal
          defaultType={assetType}
          onClose={() => setShowForm(false)}
          onSaved={(id) => { setShowForm(false); navigate(`/majetek/${id}`); }}
        />
      )}
    </div>
  );
}
