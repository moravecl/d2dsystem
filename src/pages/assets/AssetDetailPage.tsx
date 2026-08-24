import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Car, Cpu, Building2, Wrench, MapPin, CreditCard as Edit2, Plus, Shield, CalendarClock, ClipboardList, FileText, Trash2, CheckCircle2, User, Upload, Download, Eye } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import Tabs from '../../components/ui/Tabs';
import { supabase } from '../../lib/supabase';
import { ASSET_TYPE_LABELS, EVENT_TYPE_LABELS, DUE_TYPE_LABELS, computeDueStatus, dueStatusColor, dueStatusLabel, BUILDING_TYPES } from '../../types/assets';
import AssetFormModal from '../../components/assets/AssetFormModal';
import DueItemFormModal from '../../components/assets/DueItemFormModal';
import CompleteDueItemModal from '../../components/assets/CompleteDueItemModal';
import EventFormModal from '../../components/assets/EventFormModal';
import type { Asset, AssetEvent, DueItem, AssetDocument, InsuranceCoverageType } from '../../types/assets';

const typeIcon = (t: string) => {
  switch (t) {
    case 'vehicle': return Car;
    case 'appliance': return Cpu;
    case 'building': return Building2;
    default: return Wrench;
  }
};

const typeGradient = (t: string) => {
  switch (t) {
    case 'vehicle': return 'from-blue-500 to-blue-600';
    case 'appliance': return 'from-emerald-500 to-emerald-600';
    case 'building': return 'from-amber-500 to-amber-600';
    default: return 'from-slate-500 to-slate-600';
  }
};

const assetTabs = [
  { key: 'overview', label: 'Přehled' },
  { key: 'deadlines', label: 'Termíny & Revize' },
  { key: 'services', label: 'Servisní historie' },
  { key: 'documents', label: 'Dokumenty' },
];

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [coverageTypes, setCoverageTypes] = useState<InsuranceCoverageType[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDueForm, setShowDueForm] = useState(false);
  const [editDueItem, setEditDueItem] = useState<DueItem | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editEvent, setEditEvent] = useState<AssetEvent | null>(null);
  const [completeItem, setCompleteItem] = useState<DueItem | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    const [assetRes, eventsRes, dueRes, docsRes, covRes] = await Promise.all([
      supabase.from('assets').select('*').eq('id', id).maybeSingle(),
      supabase.from('asset_events').select('*').eq('asset_id', id).order('event_date', { ascending: false }),
      supabase.from('due_items').select('*').eq('asset_id', id).order('due_date', { ascending: true }),
      supabase.from('asset_documents').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
      supabase.from('insurance_coverage_types').select('*').order('sort_order'),
    ]);
    if (assetRes.data) setAsset(assetRes.data as Asset);
    setEvents((eventsRes.data || []) as AssetEvent[]);
    setDueItems((dueRes.data || []) as DueItem[]);
    setDocuments((docsRes.data || []) as AssetDocument[]);
    setCoverageTypes((covRes.data || []) as InsuranceCoverageType[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Majetek', href: '/majetek' },
        { label: asset?.name || '...' },
      ],
    });
  }, [setConfig, asset]);

  const handleDeactivate = async () => {
    if (!id || !confirm('Opravdu chcete tento majetek deaktivovat?')) return;
    const { error } = await supabase.from('assets')
      .update({ is_active: false, status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast('Chyba', 'error'); return; }
    toast('Majetek deaktivován');
    navigate('/majetek');
  };

  const handleDeleteDueItem = async (item: DueItem) => {
    if (!confirm(`Opravdu chcete smazat termín "${item.label}"?`)) return;
    const { error } = await supabase.from('due_items').delete().eq('id', item.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Termín smazán');
    loadData();
  };

  const handleDeleteEvent = async (ev: AssetEvent) => {
    if (!confirm(`Opravdu chcete smazat událost "${ev.title}"?`)) return;
    const { error } = await supabase.from('asset_events').delete().eq('id', ev.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Událost smazána');
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
        <div className="h-64 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
      </div>
    );
  }

  if (!asset) {
    return <div className="text-center py-12 text-slate-400">Majetek nenalezen</div>;
  }

  const Icon = typeIcon(asset.asset_type);
  const activeDues = dueItems.filter(d => d.status !== 'completed');
  const completedDues = dueItems.filter(d => d.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${typeGradient(asset.asset_type)} flex items-center justify-center shrink-0`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-white truncate">{asset.name}</h1>
              {asset.code && <span className="text-xs font-mono text-slate-400">{asset.code}</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/10">
                {ASSET_TYPE_LABELS[asset.asset_type]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              {asset.manufacturer && <span>{asset.manufacturer} {asset.model}</span>}
              {asset.asset_type === 'vehicle' && asset.license_plate && <span className="font-semibold text-slate-300">{asset.license_plate}</span>}
              {asset.location_address && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{asset.location_address}</span>
              )}
              {asset.owner_type === 'client' && (
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Klient</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowEditForm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 border border-white/10 rounded-xl hover:bg-white/[0.04] transition"
            >
              <Edit2 className="w-4 h-4" />
              Upravit
            </button>
            <button
              onClick={handleDeactivate}
              className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/100/10 transition"
              title="Deaktivovat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
        <Tabs tabs={assetTabs} active={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'overview' && (
            <OverviewTab asset={asset} activeDues={activeDues} onComplete={setCompleteItem} />
          )}

          {activeTab === 'deadlines' && (
            <DeadlinesTab
              activeDues={activeDues}
              completedDues={completedDues}
              assetName={asset.name}
              coverageTypes={coverageTypes}
              onAddDue={() => setShowDueForm(true)}
              onComplete={setCompleteItem}
              onDelete={handleDeleteDueItem}
              onEdit={(d) => setEditDueItem(d)}
            />
          )}

          {activeTab === 'services' && (
            <ServicesTab
              events={events}
              onAddEvent={() => setShowEventForm(true)}
              onDeleteEvent={handleDeleteEvent}
              onEditEvent={(ev) => setEditEvent(ev)}
            />
          )}

          {activeTab === 'documents' && id && (
            <DocumentsTab assetId={id} documents={documents} onRefresh={loadData} />
          )}
        </div>
      </div>

      {showEditForm && (
        <AssetFormModal
          asset={asset}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); loadData(); }}
        />
      )}

      {(showDueForm || editDueItem) && id && (
        <DueItemFormModal
          assetId={id}
          item={editDueItem}
          onClose={() => { setShowDueForm(false); setEditDueItem(null); }}
          onSaved={() => { setShowDueForm(false); setEditDueItem(null); loadData(); }}
        />
      )}

      {(showEventForm || editEvent) && id && (
        <EventFormModal
          assetId={id}
          event={editEvent}
          onClose={() => { setShowEventForm(false); setEditEvent(null); }}
          onSaved={() => { setShowEventForm(false); setEditEvent(null); loadData(); }}
        />
      )}

      {completeItem && (
        <CompleteDueItemModal
          item={completeItem}
          assetName={asset.name}
          onClose={() => setCompleteItem(null)}
          onCompleted={() => { setCompleteItem(null); loadData(); }}
        />
      )}
    </div>
  );
}

function OverviewTab({ asset, activeDues, onComplete }: { asset: Asset; activeDues: DueItem[]; onComplete: (d: DueItem) => void }) {
  const infoRows: [string, string][] = [
    ['Výrobce', asset.manufacturer || '-'],
    ['Model', asset.model || '-'],
    ['Sériové číslo', asset.serial_number || '-'],
    ['Datum pořízení', asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('cs-CZ') : '-'],
    ['Dodavatel', asset.supplier || '-'],
    ['Záruka do', asset.warranty_until ? new Date(asset.warranty_until).toLocaleDateString('cs-CZ') : '-'],
  ];

  if (asset.asset_type === 'vehicle') {
    infoRows.push(
      ['SPZ', asset.license_plate || '-'],
      ['VIN', asset.vin || '-'],
      ['Palivo', asset.fuel_type || '-'],
      ['Stav km', asset.odometer_km ? `${asset.odometer_km.toLocaleString('cs-CZ')} km` : '-'],
    );
  }

  if (asset.asset_type === 'appliance') {
    infoRows.push(['Typ zařízení', asset.device_type || '-']);
  }

  if (asset.asset_type === 'building') {
    const bt = BUILDING_TYPES.find(b => b.value === asset.building_type);
    infoRows.push(
      ['Typ budovy', bt?.label || asset.building_type || '-'],
      ['Hlavní jistič', asset.main_breaker || '-'],
      ['Vytápění', asset.heating_type || '-'],
      ['FVE', asset.has_fve ? 'Ano' : 'Ne'],
      ['Rekuperace', asset.has_recuperation ? 'Ano' : 'Ne'],
    );
  }

  if (asset.location_room) infoRows.push(['Místnost', asset.location_room]);
  if (asset.location_address) infoRows.push(['Adresa', asset.location_address]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Základní údaje</h3>
          <div className="grid grid-cols-2 gap-3">
            {infoRows.map(([label, value], i) => (
              <div key={i} className="p-3 rounded-lg bg-white/[0.04]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {asset.note && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Poznámka</h3>
            <p className="text-sm text-slate-300 bg-white/[0.04] rounded-lg p-3">{asset.note}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          Aktivní termíny ({activeDues.length})
        </h3>
        {activeDues.length === 0 ? (
          <p className="text-sm text-slate-400">Žádné aktivní termíny</p>
        ) : (
          <div className="space-y-2">
            {activeDues.slice(0, 6).map(d => {
              const status = computeDueStatus(d);
              return (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] group">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{d.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {DUE_TYPE_LABELS[d.due_type] || d.due_type}
                      {d.due_date && <> &middot; {new Date(d.due_date).toLocaleDateString('cs-CZ')}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueStatusColor(status)}`}>
                      {dueStatusLabel(status)}
                    </span>
                    <button
                      onClick={() => onComplete(d)}
                      className="p-1 rounded-md text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition opacity-0 group-hover:opacity-100"
                      title="Splnit"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DeadlinesTab({
  activeDues, completedDues, coverageTypes, onAddDue, onComplete, onDelete, onEdit,
}: {
  activeDues: DueItem[];
  completedDues: DueItem[];
  assetName: string;
  coverageTypes: InsuranceCoverageType[];
  onAddDue: () => void;
  onComplete: (d: DueItem) => void;
  onDelete: (d: DueItem) => void;
  onEdit: (d: DueItem) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Aktivní termíny</h3>
        <button
          onClick={onAddDue}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Přidat termín
        </button>
      </div>

      {activeDues.length === 0 ? (
        <div className="text-center py-12">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Žádné aktivní termíny</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {activeDues.map(d => {
            const status = computeDueStatus(d);
            return (
              <div key={d.id} className="px-5 py-4 hover:bg-white/[0.04]/50 transition group">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{d.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueStatusColor(status)}`}>
                        {dueStatusLabel(status)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {DUE_TYPE_LABELS[d.due_type] || d.due_type}
                      {d.due_date && <> &middot; Platnost do: {new Date(d.due_date).toLocaleDateString('cs-CZ')}</>}
                      {d.interval_months && <> &middot; Interval: {d.interval_months} měs.</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => onEdit(d)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Upravit
                    </button>
                    <button
                      onClick={() => onComplete(d)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Splnit
                    </button>
                    <button
                      onClick={() => onDelete(d)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {d.due_type === 'insurance' && (d.insurance_company || d.insurance_policy_number || d.insurance_price || (d.insurance_coverages && d.insurance_coverages.length > 0)) && (
                  <div className="mt-2 ml-0 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
                      {d.insurance_company && (
                        <span><span className="text-slate-500">Pojišťovna:</span> <span className="text-white font-medium">{d.insurance_company}</span></span>
                      )}
                      {d.insurance_policy_number && (
                        <span><span className="text-slate-500">Č. smlouvy:</span> <span className="text-white font-medium">{d.insurance_policy_number}</span></span>
                      )}
                      {d.insurance_price != null && d.insurance_price > 0 && (
                        <span>
                          <span className="text-slate-500">Cena:</span>{' '}
                          <span className="text-emerald-400 font-semibold">
                            {d.insurance_price.toLocaleString('cs-CZ')} Kč/{d.insurance_payment_frequency === 'quarterly' ? 'čtvrtletí' : d.insurance_payment_frequency === 'semi_annual' ? 'pololetí' : 'rok'}
                          </span>
                          {d.insurance_payment_frequency && d.insurance_payment_frequency !== 'annual' && (
                            <span className="text-slate-500 ml-1">
                              ({(d.insurance_price * (d.insurance_payment_frequency === 'quarterly' ? 4 : 2)).toLocaleString('cs-CZ')} Kč/rok)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {d.insurance_coverages && d.insurance_coverages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {d.insurance_coverages.map((c: string) => {
                          const ct = coverageTypes.find(t => t.code === c);
                          return (
                            <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                              {ct?.name || c.replace(/_/g, ' ')}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completedDues.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-500 mt-6">Splněné ({completedDues.length})</h3>
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
            {completedDues.slice(0, 20).map(d => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-3 opacity-60 group">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-300 line-through">{d.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {DUE_TYPE_LABELS[d.due_type] || d.due_type}
                    {d.completed_at && <> &middot; Splněno: {new Date(d.completed_at).toLocaleDateString('cs-CZ')}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueStatusColor('completed')}`}>
                    {dueStatusLabel('completed')}
                  </span>
                  <button
                    onClick={() => onDelete(d)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                    title="Smazat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ServicesTab({ events, onAddEvent, onDeleteEvent, onEditEvent }: { events: AssetEvent[]; onAddEvent: () => void; onDeleteEvent: (ev: AssetEvent) => void; onEditEvent: (ev: AssetEvent) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Servisní historie</h3>
        <button
          onClick={onAddEvent}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Přidat událost
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Zatím žádné záznamy</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.08]" />
          <div className="space-y-0">
            {events.map(ev => {
              const typeColor = ev.event_type === 'damage' ? 'bg-red-500' : ev.event_type === 'revision' ? 'bg-blue-500' : 'bg-emerald-500';
              return (
                <div key={ev.id} className="relative flex gap-4 pl-10 py-4 group">
                  <div className={`absolute left-[14px] top-[22px] w-3 h-3 rounded-full ${typeColor} border-2 border-white`} />
                  <div className="flex-1 bg-white/[0.04] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{ev.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy-800/60 border border-white/[0.08] text-slate-400">
                          {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{new Date(ev.event_date).toLocaleDateString('cs-CZ')}</span>
                        <button
                          onClick={() => onEditEvent(ev)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title="Upravit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteEvent(ev)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title="Smazat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {ev.description && <p className="text-xs text-slate-400 mb-2">{ev.description}</p>}
                    <div className="flex items-center gap-4 text-[10px] text-slate-400">
                      {ev.cost > 0 && <span className="font-semibold text-slate-400">{ev.cost.toLocaleString('cs-CZ')} Kč</span>}
                      {ev.supplier && <span>{ev.supplier}</span>}
                      {ev.odometer_km && <span>{ev.odometer_km.toLocaleString('cs-CZ')} km</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ assetId, documents, onRefresh }: { assetId: string; documents: AssetDocument[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `assets/${assetId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(path, file);
      if (uploadError) {
        toast(`Chyba při nahrávání ${file.name}`, 'error');
        continue;
      }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      await supabase.from('asset_documents').insert({
        asset_id: assetId,
        name: file.name,
        file_url: urlData.publicUrl,
        file_type: ext || 'unknown',
        uploaded_by: userId,
      });
    }

    setUploading(false);
    toast('Soubory nahrány');
    onRefresh();
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (doc: AssetDocument) => {
    if (!confirm(`Opravdu chcete smazat "${doc.name}"?`)) return;
    const path = doc.file_url.split('/uploads/')[1];
    if (path) await supabase.storage.from('uploads').remove([path]);
    await supabase.from('asset_documents').delete().eq('id', doc.id);
    toast('Dokument smazán');
    onRefresh();
  };

  const fileIcon = (type: string) => {
    if (['pdf'].includes(type.toLowerCase())) return 'text-red-400';
    if (['doc', 'docx'].includes(type.toLowerCase())) return 'text-blue-400';
    if (['xls', 'xlsx'].includes(type.toLowerCase())) return 'text-emerald-400';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type.toLowerCase())) return 'text-amber-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Dokumenty ({documents.length})</h3>
        <label className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition cursor-pointer">
          <Upload className="w-4 h-4" />
          {uploading ? 'Nahrávám...' : 'Nahrát soubor'}
          <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Zatím žádné dokumenty</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition group">
              <div className={`w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0`}>
                <FileText className={`w-5 h-5 ${fileIcon(doc.file_type)}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">{doc.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {doc.file_type.toUpperCase()} &middot; {new Date(doc.created_at).toLocaleDateString('cs-CZ')}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                  title="Zobrazit"
                >
                  <Eye className="w-4 h-4" />
                </a>
                <a
                  href={doc.file_url}
                  download={doc.name}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                  title="Stáhnout"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  title="Smazat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
