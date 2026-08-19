import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Loader2, ZoomIn, ZoomOut, Locate, CalendarCheck, Truck, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import type { QuickJobRow } from './quickJobTypes';
import { PRIORITY_MAP } from './quickJobTypes';
import QuickJobDetailDrawer from './QuickJobDetailDrawer';
import QuickJobFormModal from './QuickJobFormModal';

interface MapJob {
  id: string;
  title: string;
  address: string;
  lat: number;
  lon: number;
  priority: string;
  status: string;
  client_name: string;
  scheduled_date: string | null;
}

const TILE_SIZE = 256;

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}
function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

interface ViewState { centerX: number; centerY: number; zoom: number; }

interface Props { refreshKey: number; }

export default function QuickJobsMapView({ refreshKey }: Props) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<MapJob | null>(null);
  const [detailJob, setDetailJob] = useState<QuickJobRow | null>(null);
  const [editJob, setEditJob] = useState<QuickJobRow | null>(null);
  const [filter, setFilter] = useState<'all' | 'pool' | 'scheduled' | 'urgent'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<ViewState>({ centerX: 0, centerY: 0, zoom: 7 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const [planMode, setPlanMode] = useState(false);
  const [planSelected, setPlanSelected] = useState<Set<string>>(new Set());
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planDate, setPlanDate] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  const loadMapData = useCallback(async () => {
    const { data } = await supabase
      .from('quick_jobs')
      .select('id, title, address, address_lat, address_lon, priority, status, client_name, client_id, scheduled_date')
      .not('address_lat', 'is', null)
      .not('address_lon', 'is', null)
      .neq('status', 'cancelled')
      .neq('status', 'done');

    const rows = (data || []) as any[];
    const clientIds = [...new Set(rows.filter(r => r.client_id).map(r => r.client_id))];
    let clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
      clientMap = new Map((clients || []).map((c: any) => [c.id, c.name]));
    }

    setJobs(rows.map(r => ({
      id: r.id,
      title: r.title,
      address: r.address || '',
      lat: r.address_lat,
      lon: r.address_lon,
      priority: r.priority,
      status: r.status,
      client_name: r.client_id ? clientMap.get(r.client_id) || r.client_name : r.client_name || '',
      scheduled_date: r.scheduled_date,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadMapData(); }, [loadMapData, refreshKey]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const filteredJobs = jobs.filter(j => {
    if (filter === 'pool') return j.status === 'pool';
    if (filter === 'scheduled') return !!j.scheduled_date;
    if (filter === 'urgent') return j.priority === 'urgent' || j.priority === 'high';
    return true;
  });

  useEffect(() => {
    if (filteredJobs.length === 0) return;
    const lats = filteredJobs.map(j => j.lat);
    const lons = filteredJobs.map(j => j.lon);
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    let z = 14;
    for (let zz = 14; zz >= 3; zz--) {
      const xR = lonToTileX(Math.max(...lons), zz) - lonToTileX(Math.min(...lons), zz);
      const yR = latToTileY(Math.min(...lats), zz) - latToTileY(Math.max(...lats), zz);
      if (xR * TILE_SIZE < containerSize.w * 0.7 && yR * TILE_SIZE < containerSize.h * 0.7) { z = zz; break; }
    }
    setView({ centerX: lonToTileX(cLon, z), centerY: latToTileY(cLat, z), zoom: z });
  }, [filteredJobs.length, containerSize.w, containerSize.h]);

  const getMarkerColor = (j: MapJob) => {
    if (planMode && planSelected.has(j.id)) return 'bg-cyan-500';
    if (j.priority === 'urgent') return 'bg-red-500';
    if (j.status === 'pool') return 'bg-amber-500';
    if (j.scheduled_date) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const jobToPixel = (j: MapJob) => {
    const px = lonToTileX(j.lon, view.zoom);
    const py = latToTileY(j.lat, view.zoom);
    return { x: (px - view.centerX) * TILE_SIZE + containerSize.w / 2, y: (py - view.centerY) * TILE_SIZE + containerSize.h / 2 };
  };

  const tilesNeeded = () => {
    const halfW = containerSize.w / 2; const halfH = containerSize.h / 2;
    const startTileX = Math.floor(view.centerX - halfW / TILE_SIZE);
    const endTileX = Math.ceil(view.centerX + halfW / TILE_SIZE);
    const startTileY = Math.floor(view.centerY - halfH / TILE_SIZE);
    const endTileY = Math.ceil(view.centerY + halfH / TILE_SIZE);
    const tiles: { tx: number; ty: number; x: number; y: number }[] = [];
    const maxTile = Math.pow(2, view.zoom);
    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
        tiles.push({ tx: wrappedTx, ty, x: (tx - view.centerX) * TILE_SIZE + containerSize.w / 2, y: (ty - view.centerY) * TILE_SIZE + containerSize.h / 2 });
      }
    }
    return tiles;
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setView(prev => {
      const newZoom = Math.max(3, Math.min(18, prev.zoom + (e.deltaY < 0 ? 1 : -1)));
      if (newZoom === prev.zoom) return prev;
      const factor = Math.pow(2, newZoom - prev.zoom);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, zoom: newZoom };
      const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
      const worldX = prev.centerX + (mouseX - containerSize.w / 2) / TILE_SIZE;
      const worldY = prev.centerY + (mouseY - containerSize.h / 2) / TILE_SIZE;
      return { centerX: worldX * factor - (mouseX - containerSize.w / 2) / TILE_SIZE, centerY: worldY * factor - (mouseY - containerSize.h / 2) / TILE_SIZE, zoom: newZoom };
    });
  }, [containerSize.w, containerSize.h]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: view.centerX, cy: view.centerY };
  }, [view.centerX, view.centerY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setView(prev => ({ ...prev, centerX: dragStart.current.cx - (e.clientX - dragStart.current.x) / TILE_SIZE, centerY: dragStart.current.cy - (e.clientY - dragStart.current.y) / TILE_SIZE }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleZoom = (d: number) => setView(prev => {
    const nz = Math.max(3, Math.min(18, prev.zoom + d));
    if (nz === prev.zoom) return prev;
    const f = Math.pow(2, nz - prev.zoom);
    return { centerX: prev.centerX * f, centerY: prev.centerY * f, zoom: nz };
  });

  const handleFitAll = () => {
    if (filteredJobs.length === 0) return;
    const lats = filteredJobs.map(j => j.lat); const lons = filteredJobs.map(j => j.lon);
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    let z = 14;
    for (let zz = 14; zz >= 3; zz--) {
      if ((lonToTileX(Math.max(...lons), zz) - lonToTileX(Math.min(...lons), zz)) * TILE_SIZE < containerSize.w * 0.7 &&
          (latToTileY(Math.min(...lats), zz) - latToTileY(Math.max(...lats), zz)) * TILE_SIZE < containerSize.h * 0.7) { z = zz; break; }
    }
    setView({ centerX: lonToTileX(cLon, z), centerY: latToTileY(cLat, z), zoom: z });
  };

  const togglePlan = (j: MapJob) => setPlanSelected(prev => { const n = new Set(prev); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; });

  const handleMarkerClick = (j: MapJob, e: React.MouseEvent) => {
    e.stopPropagation();
    if (planMode) { togglePlan(j); return; }
    setSelectedJob(j);
  };

  const openDetail = async (jobId: string) => {
    const { data } = await supabase.from('quick_jobs').select('*').eq('id', jobId).maybeSingle();
    if (data) setDetailJob(data as QuickJobRow);
  };

  const handleSavePlan = async () => {
    if (!planDate || planSelected.size === 0) return;
    setPlanSaving(true);
    const ids = [...planSelected];
    const updates: Record<string, unknown> = { scheduled_date: planDate, scheduled_note: planNote, status: 'scheduled', updated_at: new Date().toISOString() };
    await Promise.all(ids.map(id => supabase.from('quick_jobs').update(updates).eq('id', id)));
    toast(`Naplánováno ${ids.length} zakázek na ${new Date(planDate).toLocaleDateString('cs-CZ')}`);
    setPlanSaving(false);
    setShowPlanModal(false);
    setPlanMode(false);
    setPlanSelected(new Set());
    loadMapData();
  };

  const exitPlanMode = () => { setPlanMode(false); setPlanSelected(new Set()); setShowPlanModal(false); };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>;

  const tiles = tilesNeeded();
  const selectedPlanJobs = jobs.filter(j => planSelected.has(j.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all' as const, label: `Všechny (${jobs.length})` },
          { key: 'pool' as const, label: `Sběrník (${jobs.filter(j => j.status === 'pool').length})` },
          { key: 'scheduled' as const, label: `Naplánované (${jobs.filter(j => j.scheduled_date).length})` },
          { key: 'urgent' as const, label: `Urgentní (${jobs.filter(j => j.priority === 'urgent' || j.priority === 'high').length})` },
        ]).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/[0.06] border-white/10 text-slate-400 hover:bg-white/[0.04]'}`}>{f.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {planMode && planSelected.size > 0 && (
            <button onClick={() => { setShowPlanModal(true); setPlanDate(new Date().toISOString().slice(0, 10)); setPlanNote(''); }} className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 transition shadow-lg">
              <CalendarCheck className="w-4 h-4" />Potvrdit výběr ({planSelected.size})
            </button>
          )}
          <button onClick={() => planMode ? exitPlanMode() : setPlanMode(true)} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border-2 transition ${planMode ? 'bg-slate-700 text-white border-slate-700' : 'bg-white/[0.06] text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10'}`}>
            {planMode ? <X className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            {planMode ? 'Zrušit' : 'Naplánovat výjezd'}
          </button>
        </div>
      </div>

      {planMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <CalendarCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-sm text-cyan-300 font-medium">
            {planSelected.size === 0 ? 'Klikejte na body na mapě pro výběr zakázek' : `Vybráno ${planSelected.size} zakázek`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.06] rounded-xl border border-white/10 overflow-hidden relative" style={{ minHeight: 500 }}>
          {planMode && (
            <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold shadow-lg flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />PLÁNOVÁNÍ
              {planSelected.size > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">{planSelected.size}</span>}
            </div>
          )}

          {filteredJobs.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Žádné zakázky s GPS na mapě</p>
              </div>
            </div>
          ) : (
            <div
              ref={containerRef}
              className={`relative w-full overflow-hidden select-none ${planMode ? 'ring-2 ring-cyan-400 ring-inset' : ''}`}
              style={{ minHeight: 500, height: 500, cursor: isDragging ? 'grabbing' : planMode ? 'crosshair' : 'grab' }}
              onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            >
              {tiles.map(t => (
                <img key={`${view.zoom}-${t.tx}-${t.ty}`} src={`https://tile.openstreetmap.org/${view.zoom}/${t.tx}/${t.ty}.png`} alt="" className="absolute pointer-events-none" style={{ left: Math.round(t.x), top: Math.round(t.y), width: TILE_SIZE, height: TILE_SIZE }} draggable={false} />
              ))}
              {filteredJobs.map(j => {
                const { x, y } = jobToPixel(j);
                const isSelected = selectedJob?.id === j.id;
                const isPlanSel = planMode && planSelected.has(j.id);
                const markerSize = isPlanSel ? 20 : isSelected ? 18 : 14;
                return (
                  <button key={j.id} className={`absolute z-10 flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all duration-200 ${getMarkerColor(j)} ${isPlanSel ? 'scale-125 ring-4 ring-cyan-300' : planMode ? 'cursor-pointer hover:scale-125 hover:ring-4 hover:ring-cyan-300' : isSelected ? 'scale-110 ring-2 ring-blue-500/20' : 'hover:scale-125'}`}
                    style={{ left: Math.round(x) - markerSize / 2, top: Math.round(y) - markerSize / 2, width: markerSize, height: markerSize }}
                    onClick={e => handleMarkerClick(j, e)}
                  >
                    {isPlanSel ? <Check className="w-3 h-3 text-white" /> : <span className="text-[8px] font-bold text-white">{j.priority === 'urgent' ? '!' : ''}</span>}
                  </button>
                );
              })}
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
                <button onClick={() => handleZoom(1)} className="w-8 h-8 bg-navy-800/60 rounded-lg shadow border border-white/10 flex items-center justify-center hover:bg-white/[0.04] transition"><ZoomIn className="w-4 h-4 text-slate-300" /></button>
                <button onClick={() => handleZoom(-1)} className="w-8 h-8 bg-navy-800/60 rounded-lg shadow border border-white/10 flex items-center justify-center hover:bg-white/[0.04] transition"><ZoomOut className="w-4 h-4 text-slate-300" /></button>
                <button onClick={handleFitAll} className="w-8 h-8 bg-navy-800/60 rounded-lg shadow border border-white/10 flex items-center justify-center hover:bg-white/[0.04] transition" title="Zobrazit vše"><Locate className="w-4 h-4 text-slate-300" /></button>
              </div>
              <div className="absolute bottom-1 right-1 z-20 text-[9px] text-slate-500 bg-white/[0.06] px-1 rounded">&copy; OpenStreetMap</div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {planMode ? (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
              <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-cyan-400" /><h3 className="text-sm font-bold text-cyan-300">Plánování výjezdu</h3></div>
              {selectedPlanJobs.length === 0 ? (
                <p className="text-xs text-slate-500">Klikejte na body v mapě pro výběr zakázek.</p>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Vybrané zakázky ({selectedPlanJobs.length})</div>
                  {selectedPlanJobs.map(j => (
                    <div key={j.id} className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-300 truncate">{j.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{j.address}</div>
                      </div>
                      <button onClick={() => togglePlan(j)} className="p-1 rounded hover:bg-cyan-500/20 text-slate-400 hover:text-red-400 transition"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => { setShowPlanModal(true); setPlanDate(new Date().toISOString().slice(0, 10)); setPlanNote(''); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-sm shadow-cyan-500/20 transition mt-3">
                    <CalendarCheck className="w-4 h-4" />Naplánovat termín
                  </button>
                </div>
              )}
            </div>
          ) : selectedJob ? (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedJob.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedJob.address}</p>
                {selectedJob.client_name && <p className="text-xs text-slate-400 mt-0.5">{selectedJob.client_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg p-2 text-center ${selectedJob.priority === 'urgent' ? 'bg-red-500/10' : 'bg-white/[0.04]'}`}>
                  <div className={`text-sm font-extrabold ${selectedJob.priority === 'urgent' ? 'text-red-400' : 'text-slate-300'}`}>{PRIORITY_MAP[selectedJob.priority]?.label}</div>
                  <div className="text-[10px] font-medium text-slate-500">Priorita</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${selectedJob.scheduled_date ? 'bg-cyan-500/10' : 'bg-white/[0.04]'}`}>
                  <div className={`text-sm font-extrabold ${selectedJob.scheduled_date ? 'text-cyan-400' : 'text-slate-300'}`}>{selectedJob.scheduled_date ? new Date(selectedJob.scheduled_date).toLocaleDateString('cs-CZ') : '---'}</div>
                  <div className="text-[10px] font-medium text-slate-500">Termín</div>
                </div>
              </div>
              <button onClick={() => openDetail(selectedJob.id)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl shadow-sm shadow-blue-500/20 transition">Detail zakázky</button>
            </div>
          ) : (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5">
              <p className="text-sm text-slate-400 text-center">Klikněte na bod na mapě pro detail</p>
            </div>
          )}

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legenda</h4>
            <div className="space-y-1.5">
              {[
                { color: 'bg-red-500', label: 'Urgentní' },
                { color: 'bg-amber-500', label: 'Ve sběrníku' },
                { color: 'bg-blue-500', label: 'Naplánované' },
                { color: 'bg-emerald-500', label: 'Přiřazené' },
                ...(planMode ? [{ color: 'bg-cyan-500', label: 'Vybrané k plánování' }] : []),
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-xs text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
            {filteredJobs.map(j => {
              const isPlanSel = planMode && planSelected.has(j.id);
              return (
                <button key={j.id} onClick={() => planMode ? togglePlan(j) : setSelectedJob(j)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition ${isPlanSel ? 'bg-cyan-500/10' : selectedJob?.id === j.id && !planMode ? 'bg-blue-500/10' : ''}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getMarkerColor(j)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-300 truncate">{j.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{j.client_name || j.address}</div>
                  </div>
                  {isPlanSel && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={showPlanModal} onClose={() => setShowPlanModal(false)} title="Naplánovat výjezd" size="md"
        footer={<>
          <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSavePlan} disabled={planSaving || !planDate} className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
            {planSaving ? 'Ukládám...' : <><CalendarCheck className="w-4 h-4" />Uložit</>}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPlanJobs.map(j => (
              <div key={j.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-300">{j.title}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum výjezdu *</label>
              <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
              <input value={planNote} onChange={e => setPlanNote(e.target.value)} placeholder="Čas, technik..." className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30" />
            </div>
          </div>
        </div>
      </Modal>

      {detailJob && <QuickJobDetailDrawer job={detailJob as QuickJobRow} onClose={() => setDetailJob(null)} onUpdated={() => { setDetailJob(null); loadMapData(); }} onEdit={j => { setDetailJob(null); setEditJob(j); }} />}
      {editJob && <QuickJobFormModal open={!!editJob} onClose={() => setEditJob(null)} onSaved={() => { setEditJob(null); loadMapData(); }} editJob={editJob} />}
    </div>
  );
}
