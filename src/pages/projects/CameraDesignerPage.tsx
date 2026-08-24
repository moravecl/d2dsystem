import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FileDown, Camera, X, Cable, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCameraCatalog } from '../../hooks/useCameraCatalog';
import { useCameraDesign } from '../../hooks/useCameraDesign';
import { useCameraDesignVersions } from '../../hooks/useCameraDesignVersions';
import type { CameraDesignVersion } from '../../hooks/useCameraDesignVersions';
import SaveVersionButton from '../../components/ui/SaveVersionButton';
import VersionHistoryDrawer from '../../components/ui/VersionHistoryDrawer';
import type { VersionItem } from '../../components/ui/VersionHistoryDrawer';
import VersionPickerModal from '../../components/ui/VersionPickerModal';
import type { PlacedCamera, CableRoute, PlacedNvr, PlacedSwitch, DesignLayer, StorageConfig } from '../../hooks/useCameraDesign';
import CameraCanvas, { metersPerPixelAtZoom } from '../../components/camera/CameraCanvas';
import type { CanvasMode } from '../../components/camera/CameraCanvas';
import CameraToolbar from '../../components/camera/CameraToolbar';
import CameraSidebar from '../../components/camera/CameraSidebar';
import type { CatalogFilter } from '../../components/camera/CameraSidebar';
import { exportCameraProposalPdf } from '../../components/camera/cameraPdfExport';
import { useToast } from '../../components/ui/Toast';

interface RouteSetup {
  name: string;
  cableTypeId: string;
}

export default function CameraDesignerPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const catalog = useCameraCatalog();
  const { design, loading, saving, fetched, createDesign, saveDesign, updateDesignData, getDesignData } = useCameraDesign(projectId);

  const [mode, setMode] = useState<CanvasMode>('navigate');
  const [selectedCameraModelId, setSelectedCameraModelId] = useState<string | null>(null);
  const [selectedNvrId, setSelectedNvrId] = useState<string | null>(null);
  const [selectedSwitchId, setSelectedSwitchId] = useState<string | null>(null);
  const [selectedPlacedCameraId, setSelectedPlacedCameraId] = useState<string | null>(null);
  const [selectedPlacedNvrId, setSelectedPlacedNvrId] = useState<string | null>(null);
  const [selectedPlacedSwitchId, setSelectedPlacedSwitchId] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [drawingRoute, setDrawingRoute] = useState<{ x: number; y: number }[]>([]);
  const [scalePoints, setScalePoints] = useState<{ x: number; y: number }[]>([]);
  const [scaleDist, setScaleDist] = useState('');
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [showFov, setShowFov] = useState(true);
  const [showIrRange, setShowIrRange] = useState(false);
  const cameraCounterRef = useRef(1);
  const [pendingScaleForImage, setPendingScaleForImage] = useState(false);

  const [showRouteSetup, setShowRouteSetup] = useState(false);
  const [routeSetup, setRouteSetup] = useState<RouteSetup>({ name: '', cableTypeId: '' });
  const [activeRouteSetup, setActiveRouteSetup] = useState<RouteSetup | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>(null);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [showQuickVersionSave, setShowQuickVersionSave] = useState(false);
  const [quickVersionNote, setQuickVersionNote] = useState('');
  const [showVersionPicker, setShowVersionPicker] = useState(true);
  const { versions, loading: versionsLoading, fetched: versionsFetched, createVersion } = useCameraDesignVersions(design?.id);
  const [projectData, setProjectData] = useState<{ address: string | null; address_lat: number | null; address_lon: number | null } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('projects')
      .select('address, address_lat, address_lon')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProjectData(data as { address: string | null; address_lat: number | null; address_lon: number | null });
      });
  }, [projectId]);

  useEffect(() => {
    if (fetched && !design && projectId) {
      createDesign();
    }
  }, [fetched, design, projectId, createDesign]);

  useEffect(() => {
    if (design?.design_data?.layers?.length && !activeLayerId) {
      setActiveLayerId(design.design_data.layers[0].id);
    }
  }, [design, activeLayerId]);

  useEffect(() => {
    if (design?.design_data) {
      const cameras = design.design_data.cameras ?? [];
      if (cameras.length === 0) {
        cameraCounterRef.current = 1;
      } else {
        const maxNum = cameras.reduce((max, cam) => {
          const match = cam.label?.match(/CAM\s*(\d+)/i);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        cameraCounterRef.current = maxNum + 1;
      }
    }
  }, [design?.id, design?.design_data?.cameras?.length]);

  const dd = design?.design_data ?? {
    layers: [], cameras: [], routes: [], nvrs: [], switches: [],
    storageConfig: { codec: 'h265' as const, recordingHoursPerDay: 24, retentionDays: 14, motionOnlyPct: 50 },
    accessoryItems: [],
  };

  const activeLayer = dd.layers.find(l => l.id === activeLayerId && l.visible) ?? null;
  const activeLayerIndex = dd.layers.findIndex(l => l.id === activeLayerId);

  const activeLayerScale = activeLayer?.scale ?? (activeLayer?.type === 'image' ? dd.scale : undefined);
  const imageLayerNeedsScale = activeLayer?.type === 'image' && !activeLayerScale;

  const mapScale = activeLayer?.type === 'map' && activeLayer.mapCenter && activeLayer.mapZoom
    ? { metersPerPixel: metersPerPixelAtZoom(activeLayer.mapCenter.lat, activeLayer.mapZoom) }
    : undefined;

  const handleCanvasAspect = useCallback((aspect: number, w: number, h: number) => {
    if (!activeLayerId) return;
    updateDesignData(prev => {
      const layer = prev.layers.find(l => l.id === activeLayerId);
      if (!layer) return prev;
      if (
        Math.abs((layer.canvasAspect ?? 0) - aspect) < 0.01 &&
        Math.abs((layer.canvasWidth ?? 0) - w) < 2 &&
        Math.abs((layer.canvasHeight ?? 0) - h) < 2
      ) return prev;
      return {
        ...prev,
        layers: prev.layers.map(l =>
          l.id === activeLayerId ? { ...l, canvasAspect: aspect, canvasWidth: w, canvasHeight: h } : l
        ),
      };
    });
  }, [activeLayerId, updateDesignData]);

  const safeModeChange = useCallback((newMode: CanvasMode) => {
    if (newMode === 'draw_route') {
      setRouteSetup({ name: '', cableTypeId: catalog.cables.length > 0 ? catalog.cables[0].id : '' });
      setShowRouteSetup(true);
      return;
    }
    if (imageLayerNeedsScale && newMode !== 'navigate' && newMode !== 'set_scale') {
      toast('Nejdrive nastavte meritko pro obrazek', 'error');
      setMode('set_scale');
      return;
    }
    if (newMode === 'place_camera') {
      setCatalogFilter('cameras');
    } else if (newMode === 'place_nvr') {
      setCatalogFilter('nvrs');
    } else if (newMode === 'place_switch') {
      setCatalogFilter('switches');
    } else {
      setCatalogFilter(null);
    }
    setMode(newMode);
  }, [imageLayerNeedsScale, toast, catalog.cables]);

  const confirmRouteSetup = () => {
    if (!routeSetup.cableTypeId) {
      toast('Vyberte typ kabelu', 'error');
      return;
    }
    setActiveRouteSetup({ ...routeSetup });
    setShowRouteSetup(false);
    setDrawingRoute([]);
    setMode('draw_route');
  };

  const handlePlaceCamera = useCallback((x: number, y: number) => {
    if (!selectedCameraModelId) return;
    if (imageLayerNeedsScale) {
      toast('Nejdrive nastavte meritko', 'error');
      return;
    }
    const modelId = selectedCameraModelId;
    const layerIdx = activeLayerIndex >= 0 ? activeLayerIndex : 0;
    const num = cameraCounterRef.current;
    cameraCounterRef.current = num + 1;
    const newCam: PlacedCamera = {
      id: crypto.randomUUID(),
      modelId,
      x, y,
      rotationDeg: 0,
      label: `CAM ${num}`,
      layerIndex: layerIdx,
    };
    updateDesignData(prev => ({ ...prev, cameras: [...prev.cameras, newCam] }));
  }, [selectedCameraModelId, activeLayerIndex, updateDesignData, imageLayerNeedsScale, toast]);

  const handleUpdateCameraRotation = useCallback((id: string, deg: number) => {
    updateDesignData(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => c.id === id ? { ...c, rotationDeg: deg } : c),
    }));
  }, [updateDesignData]);

  const handleMoveCamera = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => c.id === id ? { ...c, x, y } : c),
    }));
  }, [updateDesignData]);

  const handleAddRoutePoint = useCallback((x: number, y: number) => {
    if (!activeRouteSetup?.cableTypeId) return;
    setDrawingRoute(prev => [...prev, { x, y }]);
  }, [activeRouteSetup]);

  const handleFinishRoute = useCallback(() => {
    if (drawingRoute.length < 2 || !activeRouteSetup) return;
    const route: CableRoute = {
      id: crypto.randomUUID(),
      points: drawingRoute,
      cableTypeId: activeRouteSetup.cableTypeId,
      layerIndex: activeLayerIndex >= 0 ? activeLayerIndex : 0,
      label: activeRouteSetup.name,
    };
    updateDesignData(prev => ({ ...prev, routes: [...prev.routes, route] }));
    setDrawingRoute([]);
    setActiveRouteSetup(null);
    setMode('navigate');
    toast('Trasa ulozena');
  }, [drawingRoute, activeRouteSetup, activeLayerIndex, updateDesignData, toast]);

  const handlePlaceNvr = useCallback((x: number, y: number) => {
    if (!selectedNvrId) return;
    const nvr: PlacedNvr = {
      id: crypto.randomUUID(),
      nvrId: selectedNvrId,
      x, y,
      layerIndex: activeLayerIndex >= 0 ? activeLayerIndex : 0,
    };
    updateDesignData(prev => ({ ...prev, nvrs: [...prev.nvrs, nvr] }));
  }, [selectedNvrId, activeLayerIndex, updateDesignData]);

  const handlePlaceSwitch = useCallback((x: number, y: number) => {
    if (!selectedSwitchId) return;
    const sw: PlacedSwitch = {
      id: crypto.randomUUID(),
      switchId: selectedSwitchId,
      x, y,
      layerIndex: activeLayerIndex >= 0 ? activeLayerIndex : 0,
    };
    updateDesignData(prev => ({ ...prev, switches: [...prev.switches, sw] }));
  }, [selectedSwitchId, activeLayerIndex, updateDesignData]);

  const handleScalePoint = useCallback((x: number, y: number) => {
    if (scalePoints.length === 0) {
      setScalePoints([{ x, y }]);
    } else if (scalePoints.length === 1) {
      setScalePoints(prev => [...prev, { x, y }]);
      setShowScaleInput(true);
    }
  }, [scalePoints.length]);

  const confirmScale = () => {
    const dist = parseFloat(scaleDist);
    if (!dist || dist <= 0 || scalePoints.length !== 2) return;
    const p1 = scalePoints[0];
    const p2 = scalePoints[1];
    const newScale = { p1, p2, realDistanceM: dist };
    updateDesignData(prev => ({
      ...prev,
      layers: prev.layers.map(l =>
        l.id === activeLayerId ? { ...l, scale: newScale } : l
      ),
    }));
    setScalePoints([]);
    setScaleDist('');
    setShowScaleInput(false);
    setPendingScaleForImage(false);
    setMode('navigate');
    toast('Meritko nastaveno');
  };

  const handleDeletePlacedCamera = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, cameras: prev.cameras.filter(c => c.id !== id) }));
    if (selectedPlacedCameraId === id) setSelectedPlacedCameraId(null);
  }, [selectedPlacedCameraId, updateDesignData]);

  const handleDeleteRoute = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, routes: prev.routes.filter(r => r.id !== id) }));
  }, [updateDesignData]);

  const handleDeleteNvr = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, nvrs: prev.nvrs.filter(n => n.id !== id) }));
  }, [updateDesignData]);

  const handleDeleteSwitch = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, switches: prev.switches.filter(s => s.id !== id) }));
  }, [updateDesignData]);

  const handleMoveNvr = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({ ...prev, nvrs: prev.nvrs.map(n => n.id === id ? { ...n, x, y } : n) }));
  }, [updateDesignData]);

  const handleMoveSwitch = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({ ...prev, switches: prev.switches.map(s => s.id === id ? { ...s, x, y } : s) }));
  }, [updateDesignData]);

  const handleUpdateStorageConfig = useCallback((config: StorageConfig) => {
    updateDesignData(prev => ({ ...prev, storageConfig: config }));
  }, [updateDesignData]);

  const handleAddLayer = useCallback((layer: DesignLayer) => {
    updateDesignData(prev => ({ ...prev, layers: [...prev.layers, layer] }));
    setActiveLayerId(layer.id);
  }, [updateDesignData]);

  const handleDeleteLayer = useCallback((id: string) => {
    updateDesignData(prev => {
      const layerIdx = prev.layers.findIndex(l => l.id === id);
      return {
        ...prev,
        layers: prev.layers.filter(l => l.id !== id),
        cameras: prev.cameras.filter(c => c.layerIndex !== layerIdx),
        routes: prev.routes.filter(r => r.layerIndex !== layerIdx),
      };
    });
    if (activeLayerId === id) {
      const remaining = dd.layers.filter(l => l.id !== id);
      setActiveLayerId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [activeLayerId, dd.layers, updateDesignData]);

  const handleToggleLayerVisibility = useCallback((id: string) => {
    updateDesignData(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l),
    }));
  }, [updateDesignData]);

  const handleRenameLayer = useCallback((id: string, name: string) => {
    updateDesignData(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, name } : l),
    }));
  }, [updateDesignData]);

  const handleUpdateAccessory = useCallback((accessoryId: string, quantity: number) => {
    updateDesignData(prev => {
      const items = prev.accessoryItems.filter(a => a.accessoryId !== accessoryId);
      if (quantity > 0) items.push({ accessoryId, quantity });
      return { ...prev, accessoryItems: items };
    });
  }, [updateDesignData]);

  const handleSelectCameraModel = useCallback((id: string | null) => {
    setSelectedCameraModelId(id);
    if (id) {
      if (imageLayerNeedsScale) {
        toast('Nejdrive nastavte meritko pro obrazek', 'error');
        setMode('set_scale');
        return;
      }
      setMode('place_camera');
      setCatalogFilter('cameras');
    }
  }, [imageLayerNeedsScale, toast]);

  const handleSelectNvr = useCallback((id: string | null) => {
    setSelectedNvrId(id);
    if (id) {
      if (imageLayerNeedsScale) {
        toast('Nejdrive nastavte meritko pro obrazek', 'error');
        setMode('set_scale');
        return;
      }
      setMode('place_nvr');
      setCatalogFilter('nvrs');
    }
  }, [imageLayerNeedsScale, toast]);

  const handleSelectSwitch = useCallback((id: string | null) => {
    setSelectedSwitchId(id);
    if (id) {
      if (imageLayerNeedsScale) {
        toast('Nejdrive nastavte meritko pro obrazek', 'error');
        setMode('set_scale');
        return;
      }
      setMode('place_switch');
      setCatalogFilter('switches');
    }
  }, [imageLayerNeedsScale, toast]);

  const handleImageLayerNeedsScale = useCallback(() => {
    setPendingScaleForImage(true);
    setMode('set_scale');
    toast('Nastavte meritko - kliknete na dva body se znamou vzdalenosti');
  }, [toast]);

  const handleExportPdf = () => {
    if (!design) return;
    exportCameraProposalPdf({
      projectName: `Projekt`,
      designData: dd,
      catalog,
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (key === 'v') { setMode('navigate'); setActiveRouteSetup(null); setDrawingRoute([]); }
      if (key === 'c') {
        if (imageLayerNeedsScale) {
          toast('Nejdrive nastavte meritko pro obrazek', 'error');
          setMode('set_scale');
        } else {
          setMode('place_camera');
        }
      }
      if (key === 'r') safeModeChange('draw_route');
      if (key === 'n') handleSelectNvr(selectedNvrId);
      if (key === 's' && !e.ctrlKey && !e.metaKey) handleSelectSwitch(selectedSwitchId);
      if (key === 'm') setMode('set_scale');
      if (key === 'escape') {
        setMode('navigate');
        setDrawingRoute([]);
        setScalePoints([]);
        setShowScaleInput(false);
        setShowRouteSetup(false);
        setActiveRouteSetup(null);
      }
      if (key === 'delete' && selectedPlacedCameraId) {
        handleDeletePlacedCamera(selectedPlacedCameraId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPlacedCameraId, handleDeletePlacedCamera, safeModeChange, imageLayerNeedsScale, toast, selectedNvrId, selectedSwitchId, handleSelectNvr, handleSelectSwitch]);


  const handleSaveVersion = useCallback(async (note: string) => {
    if (!design) {
      console.error('Cannot save version: design is null');
      return;
    }
    await saveDesign();
    const currentDesignData = getDesignData();
    if (!currentDesignData) {
      console.error('Cannot save version: designData is null');
      return;
    }
    const cameras = currentDesignData.cameras ?? [];
    const count = cameras.length;
    let price = 0;
    cameras.forEach(cam => {
      const m = catalog.cameras.find(c => c.id === cam.modelId);
      if (m) price += m.price;
    });
    (currentDesignData.nvrs ?? []).forEach(n => {
      const nv = catalog.nvrs.find(c => c.id === n.nvrId);
      if (nv) price += nv.price;
    });
    (currentDesignData.switches ?? []).forEach(s => {
      const sw = catalog.poeSwitches.find(c => c.id === s.switchId);
      if (sw) price += sw.price;
    });
    (currentDesignData.accessoryItems ?? []).forEach(ai => {
      const acc = catalog.accessories.find(a => a.id === ai.accessoryId);
      if (acc) price += acc.price * ai.quantity;
    });
    const result = await createVersion({
      note,
      designData: currentDesignData as unknown as Record<string, unknown>,
      summaryCameraCount: count,
      summaryTotalPrice: Math.round(price),
    });
    if (result) {
      toast('Verze ulozena');
    } else {
      toast('Chyba pri ukladani verze');
    }
  }, [design, saveDesign, createVersion, catalog, getDesignData, toast]);

  const handleRestoreVersion = useCallback((version: CameraDesignVersion) => {
    if (!design) return;
    saveDesign({ design_data: version.design_data as unknown as typeof design.design_data });
  }, [design, saveDesign]);

  if (loading || catalog.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <header className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-700/50">
        <button onClick={() => navigate(`/projekty/${projectId}`)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <h1 className="text-sm font-bold text-white">Kamerovy system</h1>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-2" />}

        <div className="flex-1 flex justify-center">
          <CameraToolbar
            mode={mode}
            onModeChange={safeModeChange}
            showFov={showFov}
            showIrRange={showIrRange}
            onToggleFov={() => setShowFov(p => !p)}
            onToggleIrRange={() => setShowIrRange(p => !p)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/projekty/${projectId}/kamerovy-system/kalkulace`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/80 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition"
          >
            <Calculator className="w-4 h-4" /> Kalkulace
          </button>
          <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/50 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 transition">
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <SaveVersionButton
            onSave={() => saveDesign()}
            onOpenVersions={() => setVersionDrawerOpen(true)}
            onSaveAsNewVersion={() => { setQuickVersionNote(''); setShowQuickVersionSave(true); }}
            saving={saving}
            versionCount={versions.length}
            variant="dark"
          />
        </div>
      </header>

      {showScaleInput && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-navy-800/60 rounded-xl shadow-2xl border border-white/10 p-4 flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-300">Realna vzdalenost:</span>
          <input
            type="number"
            step={0.1}
            min={0.1}
            autoFocus
            value={scaleDist}
            onChange={e => setScaleDist(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmScale(); }}
            className="w-24 border border-white/10 rounded-lg px-3 py-2 text-sm"
            placeholder="metry"
          />
          <span className="text-sm text-slate-500">m</span>
          <button onClick={confirmScale} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">OK</button>
          <button onClick={() => { setScalePoints([]); setShowScaleInput(false); setMode('navigate'); }} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-300">Zrusit</button>
        </div>
      )}

      {pendingScaleForImage && !showScaleInput && mode === 'set_scale' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500/10 rounded-xl shadow-lg border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-800">
          Kliknete na prvni bod meritka na obrazku
        </div>
      )}

      {showRouteSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-navy-800/60 rounded-2xl shadow-2xl border border-white/10 w-[420px] max-w-[95vw]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Cable className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-white">Nova trasa kabelu</h3>
              </div>
              <button onClick={() => setShowRouteSetup(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">Nazev trasy</label>
                <input
                  type="text"
                  value={routeSetup.name}
                  onChange={e => setRouteSetup(p => ({ ...p, name: e.target.value }))}
                  placeholder="napr. Hlavni trasa, Garaz, Vstup..."
                  className="w-full border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">Typ kabelu</label>
                {catalog.cables.length === 0 ? (
                  <p className="text-xs text-red-500 bg-red-500/10 border border-red-200 rounded-xl px-3 py-2">
                    Zadne kabely v katalogu. Pridejte je v Admin / Kamerovy katalog.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {catalog.cables.map(cable => (
                      <button
                        key={cable.id}
                        onClick={() => setRouteSetup(p => ({ ...p, cableTypeId: cable.id }))}
                        className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs transition ${
                          routeSetup.cableTypeId === cable.id
                            ? 'border-amber-400 bg-amber-500/10 ring-1 ring-amber-300'
                            : 'border-white/10 hover:border-white/[0.12] bg-white/[0.06]'
                        }`}
                      >
                        <Cable className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white">{cable.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">max {cable.max_length_m}m · {cable.price_per_m.toLocaleString('cs-CZ')} Kc/m</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] bg-white/[0.04]/50 rounded-b-2xl">
              <button onClick={() => setShowRouteSetup(false)} className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-300 transition">
                Zrusit
              </button>
              <button
                onClick={confirmRouteSetup}
                disabled={!routeSetup.cableTypeId}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/100 text-white rounded-xl text-xs font-bold hover:bg-amber-600 disabled:opacity-40 transition"
              >
                <Cable className="w-3.5 h-3.5" /> Zacit kreslit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <CameraCanvas
            layer={activeLayer}
            cameras={activeLayerIndex >= 0 ? dd.cameras.filter(c => c.layerIndex === activeLayerIndex) : dd.cameras}
            routes={activeLayerIndex >= 0 ? dd.routes.filter(r => r.layerIndex === activeLayerIndex) : dd.routes}
            nvrs={activeLayerIndex >= 0 ? dd.nvrs.filter(n => n.layerIndex === activeLayerIndex) : dd.nvrs}
            switches={activeLayerIndex >= 0 ? dd.switches.filter(s => s.layerIndex === activeLayerIndex) : dd.switches}
            cameraModels={catalog.cameras}
            mode={mode}
            selectedCameraModelId={selectedCameraModelId}
            selectedCableTypeId={activeRouteSetup?.cableTypeId ?? null}
            selectedNvrId={selectedNvrId}
            selectedSwitchId={selectedSwitchId}
            selectedPlacedCameraId={selectedPlacedCameraId}
            selectedPlacedNvrId={selectedPlacedNvrId}
            selectedPlacedSwitchId={selectedPlacedSwitchId}
            scale={activeLayerScale}
            mapScale={mapScale}
            onPlaceCamera={handlePlaceCamera}
            onUpdateCameraRotation={handleUpdateCameraRotation}
            onMoveCamera={handleMoveCamera}
            onMoveNvr={handleMoveNvr}
            onMoveSwitch={handleMoveSwitch}
            onSelectPlacedCamera={setSelectedPlacedCameraId}
            onSelectPlacedNvr={setSelectedPlacedNvrId}
            onSelectPlacedSwitch={setSelectedPlacedSwitchId}
            onDeletePlacedNvr={handleDeleteNvr}
            onDeletePlacedSwitch={handleDeleteSwitch}
            onAddRoutePoint={handleAddRoutePoint}
            onFinishRoute={handleFinishRoute}
            onPlaceNvr={handlePlaceNvr}
            onPlaceSwitch={handlePlaceSwitch}
            onScalePoint={handleScalePoint}
            drawingRoute={drawingRoute}
            scalePoints={scalePoints}
            showIrRange={showIrRange}
            showFov={showFov}
            onCanvasAspect={handleCanvasAspect}
          />

          {mode !== 'navigate' && (
            <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg font-medium border border-slate-700/50">
              {mode === 'place_camera' && 'Kliknete na mapu pro umisteni kamery'}
              {mode === 'draw_route' && activeRouteSetup && (
                <>
                  Klikejte pro body trasy
                  {activeRouteSetup.name && <span className="text-amber-400 ml-1">({activeRouteSetup.name})</span>}
                  <span className="text-slate-400 ml-1">
                    · {catalog.cables.find(c => c.id === activeRouteSetup.cableTypeId)?.name ?? 'kabel'}
                    · Dvojklik pro dokonceni
                  </span>
                </>
              )}
              {mode === 'place_nvr' && 'Kliknete na mapu pro umisteni NVR'}
              {mode === 'place_switch' && 'Kliknete na mapu pro umisteni switche'}
              {mode === 'set_scale' && `Kliknete na ${scalePoints.length === 0 ? 'prvni' : 'druhy'} bod meritka`}
              {mode === 'measure' && 'Kliknete na dva body pro mereni vzdalenosti'}
              <span className="text-slate-400 ml-2">· ESC pro zruseni</span>
            </div>
          )}
        </div>

        <CameraSidebar
          catalog={catalog}
          designData={dd}
          selectedCameraModelId={selectedCameraModelId}
          selectedPlacedCameraId={selectedPlacedCameraId}
          onSelectCameraModel={handleSelectCameraModel}
          onSelectNvr={handleSelectNvr}
          onSelectSwitch={handleSelectSwitch}
          onDeletePlacedCamera={handleDeletePlacedCamera}
          onDeleteRoute={handleDeleteRoute}
          onDeleteNvr={handleDeleteNvr}
          onDeleteSwitch={handleDeleteSwitch}
          onUpdateStorageConfig={handleUpdateStorageConfig}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          onRenameLayer={handleRenameLayer}
          onSelectLayer={setActiveLayerId}
          activeLayerId={activeLayerId}
          onUpdateAccessory={handleUpdateAccessory}
          onImageLayerNeedsScale={handleImageLayerNeedsScale}
          mapScale={mapScale}
          catalogFilter={catalogFilter}
          projectAddress={projectData?.address}
          projectLat={projectData?.address_lat}
          projectLon={projectData?.address_lon}
        />
      </div>

      {showQuickVersionSave && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50" onClick={() => setShowQuickVersionSave(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-navy-800/60 rounded-2xl shadow-2xl border border-white/10 w-[400px] max-w-[90vw] p-6">
            <h3 className="text-sm font-extrabold text-white mb-4">Uložit jako novou verzi</h3>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Poznámka k verzi</label>
              <input
                type="text"
                autoFocus
                value={quickVersionNote}
                onChange={(e) => setQuickVersionNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveVersion(quickVersionNote.trim() || `V${versions.length + 1}`);
                    setShowQuickVersionSave(false);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition"
                placeholder={`V${versions.length + 1}`}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowQuickVersionSave(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
              >
                Zrušit
              </button>
              <button
                onClick={() => {
                  handleSaveVersion(quickVersionNote.trim() || `V${versions.length + 1}`);
                  setShowQuickVersionSave(false);
                }}
                className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition"
              >
                Uložit verzi
              </button>
            </div>
          </div>
        </>
      )}

      <VersionHistoryDrawer<CameraDesignVersion & VersionItem>
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        versions={versions as (CameraDesignVersion & VersionItem)[]}
        loading={versionsLoading}
        onSaveVersion={handleSaveVersion}
        onRestore={handleRestoreVersion}
        saving={saving}
        title="Historie verzí kamery"
        renderSummary={(v) => (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-extrabold text-blue-400">
              {v.summary_camera_count} kamer
            </span>
            {v.summary_total_price > 0 && (
              <span className="text-[9px] font-extrabold text-emerald-400">
                {v.summary_total_price.toLocaleString('cs-CZ')} Kč
              </span>
            )}
          </div>
        )}
      />

      <VersionPickerModal<CameraDesignVersion & VersionItem>
        open={showVersionPicker}
        onClose={() => setShowVersionPicker(false)}
        versions={versions as (CameraDesignVersion & VersionItem)[]}
        loading={!versionsFetched}
        onSelectVersion={(version) => {
          handleRestoreVersion(version);
          setShowVersionPicker(false);
        }}
        onStartNew={() => setShowVersionPicker(false)}
        title="Kamerový systém - vyberte verzi"
        variant="camera"
        renderSummary={(v) => (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-extrabold text-sky-400">
              {v.summary_camera_count} kamer
            </span>
            {v.summary_total_price > 0 && (
              <span className="text-[9px] font-extrabold text-emerald-400">
                {v.summary_total_price.toLocaleString('cs-CZ')} Kc
              </span>
            )}
          </div>
        )}
      />
    </div>
  );
}
