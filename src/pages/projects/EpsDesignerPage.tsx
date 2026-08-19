import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEpsCatalog } from '../../hooks/useEpsCatalog';
import { useEpsDesign } from '../../hooks/useEpsDesign';
import type { EpsDesignData, EpsDesignLayer, PlacedDetector, PlacedPanel, PlacedSiren, PlacedMotionSensor, PlacedKeypad, PlacedControlDevice, EpsCableRoute } from '../../hooks/useEpsDesign';
import { useEpsDesignVersions } from '../../hooks/useEpsDesignVersions';
import { calcTotalPrice } from '../../lib/epsCalculations';
import EpsCanvas from '../../components/eps/EpsCanvas';
import EpsToolbar from '../../components/eps/EpsToolbar';
import type { EpsCanvasMode } from '../../components/eps/EpsToolbar';
import EpsSidebar from '../../components/eps/EpsSidebar';
import SaveVersionButton from '../../components/ui/SaveVersionButton';
import VersionHistoryDrawer from '../../components/ui/VersionHistoryDrawer';
import VersionPickerModal from '../../components/ui/VersionPickerModal';

export default function EpsDesignerPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const catalog = useEpsCatalog();
  const { design, loading, saving, fetched, createDesign, saveDesign, updateDesignData, getDesignData } = useEpsDesign(projectId);
  const { versions, createVersion, loadVersion } = useEpsDesignVersions(design?.id);

  const [projectName, setProjectName] = useState('');
  const [mode, setMode] = useState<EpsCanvasMode>('navigate');
  const [showCoverage, setShowCoverage] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [selectedDetectorModelId, setSelectedDetectorModelId] = useState<string | null>(null);
  const [selectedCableTypeId, setSelectedCableTypeId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedSirenId, setSelectedSirenId] = useState<string | null>(null);
  const [selectedMotionSensorId, setSelectedMotionSensorId] = useState<string | null>(null);
  const [selectedKeypadId, setSelectedKeypadId] = useState<string | null>(null);
  const [selectedControlDeviceId, setSelectedControlDeviceId] = useState<string | null>(null);
  const [selectedPlacedDetectorId, setSelectedPlacedDetectorId] = useState<string | null>(null);
  const [selectedPlacedMotionSensorId, setSelectedPlacedMotionSensorId] = useState<string | null>(null);
  const [drawingRoute, setDrawingRoute] = useState<{ x: number; y: number }[]>([]);
  const [scalePoints, setScalePoints] = useState<{ x: number; y: number }[]>([]);
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleDistance, setScaleDistance] = useState('');
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('name').eq('id', projectId).maybeSingle().then(({ data }) => {
      if (data) setProjectName((data as { name: string }).name);
    });
  }, [projectId]);

  useEffect(() => {
    if (fetched && !design && projectId) {
      createDesign();
    }
  }, [fetched, design, projectId, createDesign]);

  const designData = design?.design_data ?? {
    layers: [], detectors: [], panels: [], sirens: [], motionSensors: [], keypads: [], controlDevices: [], routes: [], accessoryItems: [], zones: [],
  };

  const activeLayer = designData.layers.find(l => l.id === activeLayerId) ?? designData.layers[0] ?? null;
  const activeLayerIndex = activeLayer ? designData.layers.indexOf(activeLayer) : 0;
  const effectiveScale = activeLayer?.scale ?? designData.scale;

  const hasFloorplan = designData.layers.length > 0;
  const scaleLocked = !!activeLayer && !effectiveScale;

  const layerDetectors = designData.detectors.filter(d => d.layerIndex === activeLayerIndex);
  const layerPanels = designData.panels.filter(p => p.layerIndex === activeLayerIndex);
  const layerSirens = designData.sirens.filter(s => s.layerIndex === activeLayerIndex);
  const layerMotionSensors = (designData.motionSensors ?? []).filter(ms => ms.layerIndex === activeLayerIndex);
  const layerKeypads = (designData.keypads ?? []).filter(kp => kp.layerIndex === activeLayerIndex);
  const layerControlDevices = (designData.controlDevices ?? []).filter(cd => cd.layerIndex === activeLayerIndex);
  const layerRoutes = designData.routes.filter(r => r.layerIndex === activeLayerIndex);

  useEffect(() => {
    if (designData.layers.length > 0 && !activeLayerId) {
      setActiveLayerId(designData.layers[0].id);
    }
  }, [designData.layers, activeLayerId]);

  const handlePlaceDetector = useCallback((x: number, y: number) => {
    if (!selectedDetectorModelId) return;
    const id = crypto.randomUUID();
    updateDesignData(prev => ({
      ...prev,
      detectors: [...prev.detectors, { id, modelId: selectedDetectorModelId, x, y, rotationDeg: 0, label: '', layerIndex: activeLayerIndex }],
    }));
  }, [selectedDetectorModelId, activeLayerIndex, updateDesignData]);

  const handleMoveDetector = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      detectors: prev.detectors.map(d => d.id === id ? { ...d, x, y } : d),
    }));
  }, [updateDesignData]);

  const handleMovePanel = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === id ? { ...p, x, y } : p),
    }));
  }, [updateDesignData]);

  const handleMoveSiren = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      sirens: prev.sirens.map(s => s.id === id ? { ...s, x, y } : s),
    }));
  }, [updateDesignData]);

  const handleMoveMotionSensor = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      motionSensors: (prev.motionSensors ?? []).map(ms => ms.id === id ? { ...ms, x, y } : ms),
    }));
  }, [updateDesignData]);

  const handleMoveKeypad = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      keypads: (prev.keypads ?? []).map(kp => kp.id === id ? { ...kp, x, y } : kp),
    }));
  }, [updateDesignData]);

  const handleMoveControlDevice = useCallback((id: string, x: number, y: number) => {
    updateDesignData(prev => ({
      ...prev,
      controlDevices: (prev.controlDevices ?? []).map(cd => cd.id === id ? { ...cd, x, y } : cd),
    }));
  }, [updateDesignData]);

  const handleRotateMotionSensor = useCallback((id: string, deg: number) => {
    updateDesignData(prev => ({
      ...prev,
      motionSensors: (prev.motionSensors ?? []).map(ms => ms.id === id ? { ...ms, rotationDeg: deg } : ms),
    }));
  }, [updateDesignData]);

  const handleDeletePlacedDetector = useCallback((id: string) => {
    updateDesignData(prev => ({
      ...prev,
      detectors: prev.detectors.filter(d => d.id !== id),
      zones: prev.zones.map(z => ({ ...z, detectorIds: z.detectorIds.filter(did => did !== id) })),
    }));
    if (selectedPlacedDetectorId === id) setSelectedPlacedDetectorId(null);
  }, [updateDesignData, selectedPlacedDetectorId]);

  const handleAddRoutePoint = useCallback((x: number, y: number) => {
    setDrawingRoute(prev => [...prev, { x, y }]);
  }, []);

  const handleFinishRoute = useCallback(() => {
    if (drawingRoute.length < 2) { setDrawingRoute([]); return; }
    const id = crypto.randomUUID();
    const cableId = selectedCableTypeId || catalog.cables[0]?.id || '';
    updateDesignData(prev => ({
      ...prev,
      routes: [...prev.routes, { id, points: drawingRoute, cableTypeId: cableId, layerIndex: activeLayerIndex, label: '' }],
    }));
    setDrawingRoute([]);
  }, [drawingRoute, selectedCableTypeId, catalog.cables, activeLayerIndex, updateDesignData]);

  const handleDeleteRoute = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, routes: prev.routes.filter(r => r.id !== id) }));
  }, [updateDesignData]);

  const handlePlacePanel = useCallback((x: number, y: number) => {
    if (!selectedPanelId && catalog.panels.length === 0) return;
    const panelId = selectedPanelId || catalog.panels[0]?.id || '';
    const id = crypto.randomUUID();
    updateDesignData(prev => ({
      ...prev,
      panels: [...prev.panels, { id, panelId, x, y, layerIndex: activeLayerIndex }],
    }));
    setMode('navigate');
  }, [selectedPanelId, catalog.panels, activeLayerIndex, updateDesignData]);

  const handleDeletePanel = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, panels: prev.panels.filter(p => p.id !== id) }));
  }, [updateDesignData]);

  const handlePlaceSiren = useCallback((x: number, y: number) => {
    if (!selectedSirenId && catalog.sirens.length === 0) return;
    const sirenId = selectedSirenId || catalog.sirens[0]?.id || '';
    const id = crypto.randomUUID();
    updateDesignData(prev => ({
      ...prev,
      sirens: [...prev.sirens, { id, sirenId, x, y, layerIndex: activeLayerIndex }],
    }));
    setMode('navigate');
  }, [selectedSirenId, catalog.sirens, activeLayerIndex, updateDesignData]);

  const handleDeleteSiren = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, sirens: prev.sirens.filter(s => s.id !== id) }));
  }, [updateDesignData]);

  const handlePlaceMotionSensor = useCallback((x: number, y: number) => {
    if (!selectedMotionSensorId && catalog.motionSensors.length === 0) return;
    const sensorId = selectedMotionSensorId || catalog.motionSensors[0]?.id || '';
    const id = crypto.randomUUID();
    updateDesignData(prev => ({
      ...prev,
      motionSensors: [...(prev.motionSensors ?? []), { id, sensorId, x, y, rotationDeg: 0, label: '', layerIndex: activeLayerIndex }],
    }));
    setMode('navigate');
  }, [selectedMotionSensorId, catalog.motionSensors, activeLayerIndex, updateDesignData]);

  const handleDeleteMotionSensor = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, motionSensors: (prev.motionSensors ?? []).filter(ms => ms.id !== id) }));
    if (selectedPlacedMotionSensorId === id) setSelectedPlacedMotionSensorId(null);
  }, [updateDesignData, selectedPlacedMotionSensorId]);

  const handlePlaceKeypad = useCallback((x: number, y: number) => {
    if (!selectedKeypadId && catalog.keypads.length === 0) return;
    const keypadId = selectedKeypadId || catalog.keypads[0]?.id || '';
    const id = crypto.randomUUID();
    updateDesignData(prev => ({
      ...prev,
      keypads: [...(prev.keypads ?? []), { id, keypadId, x, y, layerIndex: activeLayerIndex }],
    }));
    setMode('navigate');
  }, [selectedKeypadId, catalog.keypads, activeLayerIndex, updateDesignData]);

  const handleDeleteKeypad = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, keypads: (prev.keypads ?? []).filter(kp => kp.id !== id) }));
  }, [updateDesignData]);

  const handlePlaceControlDevice = useCallback((x: number, y: number) => {
    if (!selectedControlDeviceId && catalog.controlDevices.length === 0) return;
    const deviceId = selectedControlDeviceId || catalog.controlDevices[0]?.id || '';
    const id = crypto.randomUUID();
    updateDesignData(prev => ({
      ...prev,
      controlDevices: [...(prev.controlDevices ?? []), { id, deviceId, x, y, layerIndex: activeLayerIndex }],
    }));
    setMode('navigate');
  }, [selectedControlDeviceId, catalog.controlDevices, activeLayerIndex, updateDesignData]);

  const handleDeleteControlDevice = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, controlDevices: (prev.controlDevices ?? []).filter(cd => cd.id !== id) }));
  }, [updateDesignData]);

  const handleScalePoint = useCallback((x: number, y: number) => {
    setScalePoints(prev => {
      const next = [...prev, { x, y }];
      if (next.length >= 2) {
        setScaleModalOpen(true);
        return [next[0], next[1]];
      }
      return next;
    });
  }, []);

  const handleConfirmScale = useCallback(() => {
    if (scalePoints.length < 2) return;
    const dist = parseFloat(scaleDistance);
    if (!dist || dist <= 0) return;
    const scaleObj = { p1: scalePoints[0], p2: scalePoints[1], realDistanceM: dist };
    updateDesignData(prev => ({
      ...prev,
      layers: prev.layers.map((l, i) => i === activeLayerIndex ? { ...l, scale: scaleObj } : l),
    }));
    setScalePoints([]);
    setScaleModalOpen(false);
    setScaleDistance('');
    setMode('navigate');
  }, [scalePoints, scaleDistance, activeLayerIndex, updateDesignData]);

  const handleAddLayer = useCallback((layer: EpsDesignLayer) => {
    updateDesignData(prev => ({ ...prev, layers: [...prev.layers, layer] }));
  }, [updateDesignData]);

  const handleDeleteLayer = useCallback((id: string) => {
    updateDesignData(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== id) }));
    if (activeLayerId === id) setActiveLayerId(null);
  }, [updateDesignData, activeLayerId]);

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
      const items = prev.accessoryItems.filter(i => i.accessoryId !== accessoryId);
      if (quantity > 0) items.push({ accessoryId, quantity });
      return { ...prev, accessoryItems: items };
    });
  }, [updateDesignData]);

  const handleSaveVersion = useCallback(async (note: string) => {
    const data = getDesignData();
    if (!data) return;
    const prices = calcTotalPrice(data, catalog.detectors, catalog.panels, catalog.sirens, catalog.cables, catalog.accessories, catalog.motionSensors, catalog.keypads, catalog.controlDevices);
    await createVersion({
      note,
      designData: data as unknown as Record<string, unknown>,
      summaryDetectorCount: data.detectors.length,
      summaryTotalPrice: prices.totalCost,
    });
  }, [getDesignData, catalog, createVersion]);

  const handleLoadVersion = useCallback(async (versionId: string) => {
    const ver = await loadVersion(versionId);
    if (!ver) return;
    updateDesignData(() => ver.design_data as unknown as EpsDesignData);
    setVersionPickerOpen(false);
  }, [loadVersion, updateDesignData]);

  const handleImageLayerNeedsScale = useCallback(() => {
    setMode('set_scale');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (key === 'V' || key === 'ESCAPE') setMode('navigate');
      else if (key === 'D') setMode('place_detector');
      else if (key === 'R') setMode('draw_route');
      else if (key === 'U') setMode('place_panel');
      else if (key === 'S') setMode('place_siren');
      else if (key === 'P') setMode('place_motion_sensor');
      else if (key === 'K') setMode('place_keypad');
      else if (key === 'O') setMode('place_control_device');
      else if (key === 'M') setMode('set_scale');
      else if (key === 'DELETE' || key === 'BACKSPACE') {
        if (selectedPlacedDetectorId) handleDeletePlacedDetector(selectedPlacedDetectorId);
        if (selectedPlacedMotionSensorId) handleDeleteMotionSensor(selectedPlacedMotionSensorId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPlacedDetectorId, selectedPlacedMotionSensorId, handleDeletePlacedDetector, handleDeleteMotionSensor]);

  if (loading || catalog.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 border-b border-slate-700/50">
        <button
          onClick={() => navigate(`/projekty/${projectId}`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Zpet
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-extrabold text-white truncate">EPS / EZS Navrhar — {projectName}</h1>
          <p className="text-[10px] text-slate-500 font-medium">Elektronicka pozarni signalizace a zabezpeceni · Jablotron 100+</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><Loader2 className="w-3 h-3 animate-spin" /> Ukladani...</span>}
          <SaveVersionButton
            onSave={handleSaveVersion}
            onOpenHistory={() => setVersionDrawerOpen(true)}
            versionCount={versions.length}
            accentColor="red"
          />
          <button
            onClick={async () => { await saveDesign(); navigate(`/projekty/${projectId}/eps-navrh/kalkulace`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
          >
            <Calculator className="w-3.5 h-3.5" /> Kalkulace
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-1.5 bg-slate-900/80 border-b border-slate-800/50">
        <EpsToolbar
          mode={mode}
          onModeChange={setMode}
          showCoverage={showCoverage}
          showZones={showZones}
          onToggleCoverage={() => setShowCoverage(v => !v)}
          onToggleZones={() => setShowZones(v => !v)}
          scaleLocked={scaleLocked}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <EpsCanvas
            layer={activeLayer}
            detectors={layerDetectors}
            routes={layerRoutes}
            panels={layerPanels}
            sirens={layerSirens}
            motionSensors={layerMotionSensors}
            keypads={layerKeypads}
            controlDevices={layerControlDevices}
            detectorModels={catalog.detectors}
            motionSensorModels={catalog.motionSensors}
            keypadModels={catalog.keypads}
            controlDeviceModels={catalog.controlDevices}
            zones={designData.zones}
            mode={mode}
            selectedDetectorModelId={selectedDetectorModelId}
            selectedCableTypeId={selectedCableTypeId}
            selectedPanelId={selectedPanelId}
            selectedSirenId={selectedSirenId}
            selectedMotionSensorId={selectedMotionSensorId}
            selectedKeypadId={selectedKeypadId}
            selectedControlDeviceId={selectedControlDeviceId}
            selectedPlacedDetectorId={selectedPlacedDetectorId}
            selectedPlacedMotionSensorId={selectedPlacedMotionSensorId}
            scale={effectiveScale}
            onPlaceDetector={handlePlaceDetector}
            onMoveDetector={handleMoveDetector}
            onMovePanel={handleMovePanel}
            onMoveSiren={handleMoveSiren}
            onMoveMotionSensor={handleMoveMotionSensor}
            onMoveKeypad={handleMoveKeypad}
            onMoveControlDevice={handleMoveControlDevice}
            onSelectPlacedDetector={setSelectedPlacedDetectorId}
            onSelectPlacedMotionSensor={setSelectedPlacedMotionSensorId}
            onRotateMotionSensor={handleRotateMotionSensor}
            onAddRoutePoint={handleAddRoutePoint}
            onFinishRoute={handleFinishRoute}
            onPlacePanel={handlePlacePanel}
            onPlaceSiren={handlePlaceSiren}
            onPlaceMotionSensor={handlePlaceMotionSensor}
            onPlaceKeypad={handlePlaceKeypad}
            onPlaceControlDevice={handlePlaceControlDevice}
            onScalePoint={handleScalePoint}
            drawingRoute={drawingRoute}
            scalePoints={scalePoints}
            showCoverage={showCoverage}
            showZones={showZones}
            scaleLocked={scaleLocked}
          />
        </div>
        <EpsSidebar
          catalog={catalog}
          designData={designData}
          selectedDetectorModelId={selectedDetectorModelId}
          selectedPlacedDetectorId={selectedPlacedDetectorId}
          canvasMode={mode}
          onSelectDetectorModel={(id) => { setSelectedDetectorModelId(id); if (id) setMode('place_detector'); }}
          onSelectPanel={(id) => { setSelectedPanelId(id); if (id) setMode('place_panel'); }}
          onSelectSiren={(id) => { setSelectedSirenId(id); if (id) setMode('place_siren'); }}
          onSelectMotionSensor={(id) => { setSelectedMotionSensorId(id); if (id) setMode('place_motion_sensor'); }}
          onSelectKeypad={(id) => { setSelectedKeypadId(id); if (id) setMode('place_keypad'); }}
          onSelectControlDevice={(id) => { setSelectedControlDeviceId(id); if (id) setMode('place_control_device'); }}
          onDeletePlacedDetector={handleDeletePlacedDetector}
          onDeleteRoute={handleDeleteRoute}
          onDeletePanel={handleDeletePanel}
          onDeleteSiren={handleDeleteSiren}
          onDeleteMotionSensor={handleDeleteMotionSensor}
          onDeleteKeypad={handleDeleteKeypad}
          onDeleteControlDevice={handleDeleteControlDevice}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          onSelectLayer={setActiveLayerId}
          onRenameLayer={handleRenameLayer}
          activeLayerId={activeLayerId}
          onUpdateAccessory={handleUpdateAccessory}
          onImageLayerNeedsScale={handleImageLayerNeedsScale}
        />
      </div>

      {scaleModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white mb-3">Nastavit meritko</h3>
            <p className="text-xs text-slate-400 mb-4">Zadejte skutecnou vzdalenost mezi dvema body (v metrech).</p>
            <input
              autoFocus
              type="number"
              value={scaleDistance}
              onChange={e => setScaleDistance(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmScale(); }}
              placeholder="napr. 5"
              step="0.1"
              min="0.1"
              className="w-full px-3 py-2.5 text-sm font-medium bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setScaleModalOpen(false); setScalePoints([]); setMode('navigate'); }}
                className="flex-1 px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/[0.06] rounded-xl transition"
              >
                Zrusit
              </button>
              <button
                onClick={handleConfirmScale}
                className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
              >
                Potvrdit
              </button>
            </div>
          </div>
        </div>
      )}

      <VersionHistoryDrawer
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        versions={versions.map(v => ({
          id: v.id,
          version_number: v.version_number,
          note: v.note,
          created_at: v.created_at,
          summary: `${v.summary_detector_count} detektoru · ${v.summary_total_price.toLocaleString('cs-CZ')} Kc`,
        }))}
        onLoadVersion={handleLoadVersion}
        accentColor="red"
      />

      <VersionPickerModal
        open={versionPickerOpen}
        onClose={() => setVersionPickerOpen(false)}
        versions={versions.map(v => ({
          id: v.id,
          version_number: v.version_number,
          note: v.note,
          created_at: v.created_at,
        }))}
        onSelect={handleLoadVersion}
      />
    </div>
  );
}
