import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Calendar, Loader2, ExternalLink, ZoomIn, ZoomOut, Locate, CalendarCheck, Truck, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';

interface MapItem {
  id: string;
  scheduleId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  isOverdue: boolean;
  isUpcoming: boolean;
  hasTicket: boolean;
  nextServiceDate: string | null;
  nextServiceType: string | null;
  projectId: string | null;
}

interface ScheduleForPlan {
  id: string;
  project_id: string;
  project_name: string;
  service_type_name: string;
  next_date: string;
  scheduled_date: string | null;
  scheduled_note: string;
}

const TILE_SIZE = 256;

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
}

export default function ServiceMapView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<ViewState>({ centerX: 0, centerY: 0, zoom: 7 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const [planMode, setPlanMode] = useState(false);
  const [planSelectedProjectIds, setPlanSelectedProjectIds] = useState<Set<string>>(new Set());
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planSchedules, setPlanSchedules] = useState<ScheduleForPlan[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planDate, setPlanDate] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [planSelectedSchedules, setPlanSelectedSchedules] = useState<Set<string>>(new Set());
  const [planSaving, setPlanSaving] = useState(false);

  const loadMapData = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const inMonth = new Date();
    inMonth.setDate(inMonth.getDate() + 30);
    const monthStr = inMonth.toISOString().slice(0, 10);

    const [schedRes, ticketRes, projectsRes, typesRes] = await Promise.all([
      supabase.from('service_schedules').select('id, project_id, service_type_id, next_date, client_name, client_address, address_lat, address_lon').eq('is_active', true),
      supabase.from('service_tickets').select('id, project_id').in('status', ['open', 'in_progress']),
      supabase.from('projects').select('id, project_name, address, address_lat, address_lon'),
      supabase.from('service_types').select('id, name'),
    ]);

    const schedules = (schedRes.data || []) as any[];
    const tickets = (ticketRes.data || []) as any[];
    const allProjects = (projectsRes.data || []) as any[];
    const typeMap = new Map((typesRes.data || []).map((t: any) => [t.id, t.name]));
    const projectMap = new Map(allProjects.map((p: any) => [p.id, p]));
    const ticketsByProject = new Map<string, number>();
    tickets.forEach((t: any) => {
      if (t.project_id) {
        ticketsByProject.set(t.project_id, (ticketsByProject.get(t.project_id) || 0) + 1);
      }
    });

    const mapItems: MapItem[] = [];

    for (const s of schedules) {
      let lat: number | null = null;
      let lon: number | null = null;
      let name = '';
      let address = '';

      if (s.address_lat && s.address_lon) {
        lat = Number(s.address_lat);
        lon = Number(s.address_lon);
        name = s.client_name || 'Servis';
        address = s.client_address || '';
      } else if (s.project_id) {
        const proj = projectMap.get(s.project_id);
        if (proj && proj.address_lat && proj.address_lon) {
          lat = Number(proj.address_lat);
          lon = Number(proj.address_lon);
          name = proj.project_name || 'Projekt';
          address = proj.address || '';
        }
      }

      if (lat && lon) {
        const isOverdue = s.next_date < today;
        const isUpcoming = s.next_date >= today && s.next_date <= monthStr;
        const hasTicket = s.project_id ? (ticketsByProject.get(s.project_id) || 0) > 0 : false;

        mapItems.push({
          id: `${s.id}`,
          scheduleId: s.id,
          name,
          address,
          lat,
          lon,
          isOverdue,
          isUpcoming,
          hasTicket,
          nextServiceDate: s.next_date,
          nextServiceType: typeMap.get(s.service_type_id) || null,
          projectId: s.project_id,
        });
      }
    }

    setItems(mapItems);
    setLoading(false);
  }, []);

  useEffect(() => { loadMapData(); }, [loadMapData]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const filteredItems = items.filter(p => {
    if (filter === 'overdue') return p.isOverdue;
    if (filter === 'upcoming') return p.isUpcoming;
    return true;
  });

  useEffect(() => {
    if (filteredItems.length === 0) return;
    const lats = filteredItems.map(p => p.lat);
    const lons = filteredItems.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const cLat = (minLat + maxLat) / 2;
    const cLon = (minLon + maxLon) / 2;

    let z = 14;
    for (let zz = 14; zz >= 3; zz--) {
      const xRange = lonToTileX(maxLon, zz) - lonToTileX(minLon, zz);
      const yRange = latToTileY(minLat, zz) - latToTileY(maxLat, zz);
      if (xRange * TILE_SIZE < containerSize.w * 0.7 && yRange * TILE_SIZE < containerSize.h * 0.7) {
        z = zz;
        break;
      }
    }

    setView({
      centerX: lonToTileX(cLon, z),
      centerY: latToTileY(cLat, z),
      zoom: z,
    });
  }, [filteredItems.length, containerSize.w, containerSize.h]);

  const getMarkerColor = (p: MapItem) => {
    if (planMode && planSelectedProjectIds.has(p.id)) return 'bg-cyan-500';
    if (p.isOverdue) return 'bg-red-500';
    if (p.isUpcoming) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const getMarkerRing = (p: MapItem) => {
    if (p.isOverdue) return 'ring-red-500/30';
    if (p.isUpcoming) return 'ring-orange-500/30';
    return 'ring-blue-500/30';
  };

  const itemToPixel = (p: MapItem) => {
    const px = lonToTileX(p.lon, view.zoom);
    const py = latToTileY(p.lat, view.zoom);
    const x = (px - view.centerX) * TILE_SIZE + containerSize.w / 2;
    const y = (py - view.centerY) * TILE_SIZE + containerSize.h / 2;
    return { x, y };
  };

  const tilesNeeded = () => {
    const halfW = containerSize.w / 2;
    const halfH = containerSize.h / 2;
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
        const x = (tx - view.centerX) * TILE_SIZE + containerSize.w / 2;
        const y = (ty - view.centerY) * TILE_SIZE + containerSize.h / 2;
        tiles.push({ tx: wrappedTx, ty, x, y });
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
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = prev.centerX + (mouseX - containerSize.w / 2) / TILE_SIZE;
      const worldY = prev.centerY + (mouseY - containerSize.h / 2) / TILE_SIZE;
      const newCenterX = worldX * factor - (mouseX - containerSize.w / 2) / TILE_SIZE;
      const newCenterY = worldY * factor - (mouseY - containerSize.h / 2) / TILE_SIZE;
      return { centerX: newCenterX, centerY: newCenterY, zoom: newZoom };
    });
  }, [containerSize.w, containerSize.h]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: view.centerX, cy: view.centerY };
  }, [view.centerX, view.centerY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setView(prev => ({
      ...prev,
      centerX: dragStart.current.cx - dx / TILE_SIZE,
      centerY: dragStart.current.cy - dy / TILE_SIZE,
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoom = (delta: number) => {
    setView(prev => {
      const newZoom = Math.max(3, Math.min(18, prev.zoom + delta));
      if (newZoom === prev.zoom) return prev;
      const factor = Math.pow(2, newZoom - prev.zoom);
      return { centerX: prev.centerX * factor, centerY: prev.centerY * factor, zoom: newZoom };
    });
  };

  const handleFitAll = () => {
    if (filteredItems.length === 0) return;
    const lats = filteredItems.map(p => p.lat);
    const lons = filteredItems.map(p => p.lon);
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    let z = 14;
    for (let zz = 14; zz >= 3; zz--) {
      const xR = lonToTileX(Math.max(...lons), zz) - lonToTileX(Math.min(...lons), zz);
      const yR = latToTileY(Math.min(...lats), zz) - latToTileY(Math.max(...lats), zz);
      if (xR * TILE_SIZE < containerSize.w * 0.7 && yR * TILE_SIZE < containerSize.h * 0.7) {
        z = zz;
        break;
      }
    }
    setView({ centerX: lonToTileX(cLon, z), centerY: latToTileY(cLat, z), zoom: z });
  };

  const focusItem = (p: MapItem) => {
    setSelectedItem(p);
    const z = Math.max(view.zoom, 12);
    setView({ centerX: lonToTileX(p.lon, z), centerY: latToTileY(p.lat, z), zoom: z });
  };

  const togglePlanItem = (p: MapItem) => {
    setPlanSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
  };

  const handleMarkerClick = (p: MapItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!planMode) {
      setSelectedItem(p);
      return;
    }
    togglePlanItem(p);
  };

  const openPlanModal = async () => {
    if (planSelectedProjectIds.size === 0) return;
    setShowPlanModal(true);
    setPlanLoading(true);
    setPlanDate(new Date().toISOString().slice(0, 10));
    setPlanNote('');

    const scheduleIds = [...planSelectedProjectIds];
    const { data: schedData } = await supabase
      .from('service_schedules')
      .select('id, project_id, service_type_id, next_date, scheduled_date, scheduled_note, client_name')
      .in('id', scheduleIds)
      .eq('is_active', true)
      .order('next_date');

    const schedRows = (schedData || []) as any[];
    const typeIds = [...new Set(schedRows.map((s: any) => s.service_type_id))];
    let typeMap = new Map<string, string>();
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from('service_types').select('id, name').in('id', typeIds);
      typeMap = new Map((types || []).map((t: any) => [t.id, t.name]));
    }

    const itemMap = new Map(items.map(p => [p.id, p.name]));

    const mapped: ScheduleForPlan[] = schedRows.map(s => ({
      id: s.id,
      project_id: s.project_id || s.id,
      project_name: itemMap.get(s.id) || s.client_name || 'Servis',
      service_type_name: typeMap.get(s.service_type_id) || 'Servis',
      next_date: s.next_date,
      scheduled_date: s.scheduled_date,
      scheduled_note: s.scheduled_note || '',
    }));

    setPlanSchedules(mapped);
    setPlanSelectedSchedules(new Set(mapped.map(s => s.id)));
    setPlanLoading(false);
  };

  const toggleScheduleSelection = (id: string) => {
    setPlanSelectedSchedules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSavePlan = async () => {
    if (!planDate || planSelectedSchedules.size === 0) return;
    setPlanSaving(true);

    const ids = [...planSelectedSchedules];
    const promises = ids.map(id =>
      supabase.from('service_schedules').update({
        scheduled_date: planDate,
        scheduled_note: planNote,
      }).eq('id', id)
    );

    const results = await Promise.all(promises);
    const anyError = results.some(r => r.error);
    setPlanSaving(false);

    if (anyError) {
      toast('Nektery termin se nepodarilo ulozit', 'error');
    } else {
      toast(`Naplanovan vyjezd na ${new Date(planDate).toLocaleDateString('cs-CZ')} pro ${ids.length} servis(u)`);
    }

    setShowPlanModal(false);
    setPlanMode(false);
    setPlanSelectedProjectIds(new Set());
    loadMapData();
  };

  const exitPlanMode = () => {
    setPlanMode(false);
    setPlanSelectedProjectIds(new Set());
    setShowPlanModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const tiles = tilesNeeded();
  const today = new Date().toISOString().slice(0, 10);
  const selectedPlanItems = items.filter(p => planSelectedProjectIds.has(p.id));
  const groupedSchedules = new Map<string, ScheduleForPlan[]>();
  planSchedules.forEach(s => {
    const arr = groupedSchedules.get(s.project_id) || [];
    arr.push(s);
    groupedSchedules.set(s.project_id, arr);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: `Vsechny (${items.length})` },
          { key: 'overdue' as const, label: `Po terminu (${items.filter(p => p.isOverdue).length})` },
          { key: 'upcoming' as const, label: `Blizici se (${items.filter(p => p.isUpcoming).length})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/[0.06] border-white/10 text-slate-400 hover:bg-white/[0.04]'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {planMode && planSelectedProjectIds.size > 0 && (
            <button
              onClick={openPlanModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 transition shadow-lg shadow-cyan-200 animate-fade-in"
            >
              <CalendarCheck className="w-4 h-4" />
              Potvrdit vyber ({planSelectedProjectIds.size})
            </button>
          )}
          <button
            onClick={() => planMode ? exitPlanMode() : setPlanMode(true)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border-2 transition ${
              planMode
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white/[0.06] text-cyan-700 border-cyan-300 hover:bg-cyan-500/10'
            }`}
          >
            {planMode ? <X className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            {planMode ? 'Zrusit' : 'Naplanovat vyjezd'}
          </button>
        </div>
      </div>

      {planMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-200">
          <CalendarCheck className="w-4 h-4 text-cyan-600 shrink-0" />
          <span className="text-sm text-cyan-800 font-medium">
            {planSelectedProjectIds.size === 0
              ? 'Klikejte na body na mape pro vyber projektu k servisnimu vyjezdu'
              : `Vybrano ${planSelectedProjectIds.size} projekt(u) - kliknete na dalsi body nebo potvrdte vyber`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.06] rounded-xl border border-white/10 overflow-hidden relative" style={{ minHeight: 500 }}>
          {planMode && (
            <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold shadow-lg flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              PLANOVANI
              {planSelectedProjectIds.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">
                  {planSelectedProjectIds.size}
                </span>
              )}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Zadne servisy na mape</p>
                <p className="text-xs text-slate-400 mt-1">Servisy musi mit vyplnenou adresu s GPS souradnicemi</p>
              </div>
            </div>
          ) : (
            <div
              ref={containerRef}
              className={`relative w-full overflow-hidden select-none ${planMode ? 'ring-2 ring-cyan-400 ring-inset' : ''}`}
              style={{ minHeight: 500, height: 500, cursor: isDragging ? 'grabbing' : planMode ? 'crosshair' : 'grab' }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {tiles.map(t => (
                <img
                  key={`${view.zoom}-${t.tx}-${t.ty}`}
                  src={`https://tile.openstreetmap.org/${view.zoom}/${t.tx}/${t.ty}.png`}
                  alt=""
                  className="absolute pointer-events-none"
                  style={{
                    left: Math.round(t.x),
                    top: Math.round(t.y),
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                  }}
                  draggable={false}
                />
              ))}

              {filteredItems.map(p => {
                const { x, y } = itemToPixel(p);
                const isSelected = selectedItem?.id === p.id;
                const isPlanSelected = planMode && planSelectedProjectIds.has(p.id);
                const markerSize = isPlanSelected ? 18 : isSelected ? 16 : 14;
                return (
                  <button
                    key={p.id}
                    className={`absolute z-10 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
                      isPlanSelected
                        ? 'ring-3 ring-cyan-300 scale-125'
                        : planMode
                          ? 'cursor-pointer hover:scale-125 hover:ring-2 hover:ring-cyan-300'
                          : isSelected
                            ? 'ring-2 scale-110 ' + getMarkerRing(p)
                            : 'hover:scale-125'
                    }`}
                    style={{
                      left: Math.round(x) - markerSize / 2,
                      top: Math.round(y) - markerSize / 2,
                      width: markerSize,
                      height: markerSize,
                      backgroundColor: isPlanSelected || (planMode && planSelectedProjectIds.has(p.id))
                        ? '#06b6d4'
                        : p.isOverdue
                          ? '#ef4444'
                          : p.isUpcoming
                            ? '#f97316'
                            : '#3b82f6',
                      boxShadow: '0 0 0 2px white, 0 2px 4px rgba(0,0,0,0.3)',
                    }}
                    onClick={(e) => handleMarkerClick(p, e)}
                    title={planMode ? (isPlanSelected ? `Odebrat: ${p.name}` : `Pridat: ${p.name}`) : p.name}
                  >
                    {isPlanSelected && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </button>
                );
              })}

              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
                <button onClick={() => handleZoom(1)} className="w-8 h-8 bg-navy-800/60 rounded-lg shadow border border-white/10 flex items-center justify-center hover:bg-white/[0.04] transition">
                  <ZoomIn className="w-4 h-4 text-slate-300" />
                </button>
                <button onClick={() => handleZoom(-1)} className="w-8 h-8 bg-navy-800/60 rounded-lg shadow border border-white/10 flex items-center justify-center hover:bg-white/[0.04] transition">
                  <ZoomOut className="w-4 h-4 text-slate-300" />
                </button>
                <button onClick={handleFitAll} className="w-8 h-8 bg-navy-800/60 rounded-lg shadow border border-white/10 flex items-center justify-center hover:bg-white/[0.04] transition" title="Zobrazit vse">
                  <Locate className="w-4 h-4 text-slate-300" />
                </button>
              </div>

              <div className="absolute bottom-1 right-1 z-20 text-[9px] text-slate-500 bg-white/80 px-1 rounded">
                &copy; OpenStreetMap
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {planMode ? (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-cyan-800">Planovani vyjezdu</h3>
              </div>

              {selectedPlanItems.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Klikejte na body v mape pro vyber servisu. Vybrane body zmeni barvu na azurovou.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Vybrane servisy ({selectedPlanItems.length})
                  </div>
                  {selectedPlanItems.map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/10 border border-cyan-100">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-300 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{p.address}</div>
                      </div>
                      <button
                        onClick={() => togglePlanItem(p)}
                        className="p-1 rounded hover:bg-cyan-200/50 text-slate-400 hover:text-red-500 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={openPlanModal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition mt-3"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    Naplanovat termin
                  </button>
                </div>
              )}
            </div>
          ) : selectedItem ? (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedItem.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedItem.address}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg p-2 text-center ${selectedItem.isOverdue ? 'bg-red-500/10' : 'bg-white/[0.04]'}`}>
                  <div className={`text-lg font-extrabold ${selectedItem.isOverdue ? 'text-red-400' : 'text-slate-300'}`}>{selectedItem.isOverdue ? 1 : 0}</div>
                  <div className="text-[10px] font-medium text-slate-500">Po terminu</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${selectedItem.isUpcoming ? 'bg-amber-500/10' : 'bg-white/[0.04]'}`}>
                  <div className={`text-lg font-extrabold ${selectedItem.isUpcoming ? 'text-amber-400' : 'text-slate-300'}`}>{selectedItem.isUpcoming ? 1 : 0}</div>
                  <div className="text-[10px] font-medium text-slate-500">Blizici se</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${selectedItem.hasTicket ? 'bg-cyan-500/10' : 'bg-white/[0.04]'}`}>
                  <div className={`text-lg font-extrabold ${selectedItem.hasTicket ? 'text-cyan-600' : 'text-slate-300'}`}>{selectedItem.hasTicket ? 1 : 0}</div>
                  <div className="text-[10px] font-medium text-slate-500">Tikety</div>
                </div>
              </div>

              {selectedItem.nextServiceDate && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10">
                  <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-blue-800">{selectedItem.nextServiceType}</div>
                    <div className="text-[11px] text-blue-400">{new Date(selectedItem.nextServiceDate).toLocaleDateString('cs-CZ')}</div>
                  </div>
                </div>
              )}

              {selectedItem.projectId && (
                <button
                  onClick={() => navigate(`/projekty/${selectedItem.projectId}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
                >
                  Otevrit projekt <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5">
              <p className="text-sm text-slate-400 text-center">Kliknete na bod na mape pro detail</p>
            </div>
          )}

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legenda</h4>
            <div className="space-y-1.5">
              {[
                { color: 'bg-red-500', label: 'Po terminu' },
                { color: 'bg-orange-500', label: 'Blizici se (30 dni)' },
                { color: 'bg-blue-500', label: 'V poradku' },
                ...(planMode ? [{ color: 'bg-cyan-500', label: 'Vybrano k planovani' }] : []),
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
            {filteredItems.map(p => {
              const isPlanSelected = planMode && planSelectedProjectIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => planMode ? togglePlanItem(p) : focusItem(p)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition ${
                    isPlanSelected ? 'bg-cyan-500/10' : selectedItem?.id === p.id && !planMode ? 'bg-blue-500/10' : ''
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getMarkerColor(p)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-300 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{p.address}</div>
                  </div>
                  {isPlanSelected && (
                    <Check className="w-4 h-4 text-cyan-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Modal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="Naplanovat servisni vyjezd"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrusit</button>
            <button
              onClick={handleSavePlan}
              disabled={planSaving || !planDate || planSelectedSchedules.size === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {planSaving ? 'Ukladam...' : (
                <>
                  <CalendarCheck className="w-4 h-4" />
                  Ulozit do kalendare
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPlanItems.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-100">
                <MapPin className="w-3 h-3 text-cyan-600" />
                <span className="text-xs font-semibold text-cyan-800">{p.name}</span>
              </div>
            ))}
          </div>

          {planLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-cyan-600 animate-spin" />
            </div>
          ) : planSchedules.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Vybrane projekty nemaji zadne aktivni servisy</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Servisy pro vyjezd</label>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {[...groupedSchedules.entries()].map(([projId, schedules]) => {
                    const projName = schedules[0]?.project_name || '';
                    return (
                      <div key={projId} className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {projName}
                        </div>
                        {schedules.map(s => {
                          const isSelected = planSelectedSchedules.has(s.id);
                          const overdue = s.next_date < today;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleScheduleSelection(s.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                                isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/[0.06] bg-white/[0.06] hover:border-white/10'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-cyan-500' : 'bg-white/[0.06]'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white">{s.service_type_name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[11px] font-medium ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                                    Termin: {new Date(s.next_date).toLocaleDateString('cs-CZ')}
                                  </span>
                                  {s.scheduled_date && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-700 font-semibold">
                                      Naplanovan: {new Date(s.scheduled_date).toLocaleDateString('cs-CZ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum vyjezdu *</label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={e => setPlanDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznamka</label>
                  <input
                    value={planNote}
                    onChange={e => setPlanNote(e.target.value)}
                    placeholder="Cas, technik..."
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  />
                </div>
              </div>

              {planDate && planSelectedSchedules.size > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-100">
                  <CalendarCheck className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span className="text-sm text-slate-300">
                    <span className="font-semibold">{planSelectedSchedules.size}</span> servis(u) z{' '}
                    <span className="font-semibold">{planSelectedProjectIds.size}</span> projekt(u) na{' '}
                    <span className="font-semibold text-cyan-700">{new Date(planDate).toLocaleDateString('cs-CZ')}</span>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
