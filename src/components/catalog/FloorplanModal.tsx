import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Upload, Trash2, RotateCcw, Redo2, Check, Plus, Pencil, Image as ImageIcon, PackagePlus, ArrowLeft, PanelRightOpen, Ruler } from 'lucide-react';
import type { Product, Category, DesignModule, DesignPreset, ProductColor, Material, LightingNorm } from '../../types/database';
import type { Placement, ProjectState, CircuitType } from '../../hooks/useProjectState';
import type { BathroomSymbol } from './floorplan/BathroomDesigner';
import { supabase } from '../../lib/supabase';
import type { HeatingSystemFull } from '../../hooks/useHeatingSystems';
import type { MaterialSettingsState } from '../../hooks/useMaterialSettings';
import DesignBuilder from './DesignBuilder';
import ProductPicker from './ProductPicker';
import FloorplanToolbar from './floorplan/FloorplanToolbar';
import type { ToolMode } from './floorplan/FloorplanToolbar';
import ScaleCalibrator from './floorplan/ScaleCalibrator';
import RoomEditor from './floorplan/RoomEditor';
import CableEditor from './floorplan/CableEditor';
import DistributorEditor from './floorplan/DistributorEditor';
import HeatingSection from './floorplan/HeatingSection';
import LightingSection from './floorplan/LightingSection';
import CatalogBrowser from './CatalogBrowser';
import IconPicker from './floorplan/IconPicker';
import FloorplanCanvas from './floorplan/FloorplanCanvas';
import FloorplanLegend from './floorplan/FloorplanLegend';
import { listAllPins } from './floorplan/pinUtils';
import type { PinData } from './floorplan/pinUtils';
import { renderPinIcon } from './floorplan/iconLibrary';
import { findRoomAtPoint, polygonAreaM2 } from './floorplan/geometry';

export { listAllPins, describeConfig } from './floorplan/pinUtils';
export { listAllPinsGlobal } from './floorplan/pinUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  designModules: DesignModule[];
  designPresets: DesignPreset[];
  productColors: ProductColor[];
  project: ProjectState;
  placingProductId: string | null;
  onStopPlacing: () => void;
  onStartPlacing: (productId: string) => void;
  materialSettings: MaterialSettingsState;
  materials: Material[];
  onToggleProduct: (product: Product) => void;
  heatingSystems: HeatingSystemFull[];
  lightingNorms: LightingNorm[];
}

type ScaleStep = 'idle' | 'point1' | 'point2' | 'input';

interface DragState {
  productId: string;
  placementId: string;
  x: number;
  y: number;
}

interface UndoAction {
  type: 'add_placement' | 'remove_placement' | 'add_room' | 'remove_room' | 'add_cable' | 'remove_cable';
  payload: Record<string, unknown>;
}

const SNAP_STEP_DEG = 15;

export default function FloorplanModal({
  open,
  onClose,
  products,
  categories,
  designModules,
  designPresets,
  productColors,
  project,
  placingProductId,
  onStopPlacing,
  onStartPlacing,
  materialSettings,
  materials,
  onToggleProduct,
  heatingSystems,
  lightingNorms,
}: Props) {
  const [designBuilderState, setDesignBuilderState] = useState({ frameSize: 1, modules: ['Zásuvka'] });
  const [designColor, setDesignColor] = useState<{ name: string; hex: string } | null>(null);
  const [activeFloorId, setActiveFloorId] = useState(project.floors[0]?.id ?? '');
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('pointer');
  const [scaleStep, setScaleStep] = useState<ScaleStep>('idle');
  const [scaleTempPoints, setScaleTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [roomDrawingPoints, setRoomDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingRoom, setIsDrawingRoom] = useState(false);
  const [activeCircuitId, setActiveCircuitId] = useState<string | null>(null);
  const [isDrawingCable, setIsDrawingCable] = useState(false);
  const [cableDrawingPoints, setCableDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [iconPickerPin, setIconPickerPin] = useState<PinData | null>(null);
  const [activeMaterialName, setActiveMaterialName] = useState<string>('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [dimTempPoints, setDimTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [isPlacingDistributor, setIsPlacingDistributor] = useState(false);
  const [showHeatingPipes, setShowHeatingPipes] = useState(true);
  const [pinSize, setPinSize] = useState(28);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const [bathroomSymbols, setBathroomSymbols] = useState<BathroomSymbol[]>([]);

  useEffect(() => {
    supabase.from('bathroom_symbols').select('*').order('category').order('sort_order').then(({ data }) => {
      if (data) setBathroomSymbols(data as BathroomSymbol[]);
    });
  }, []);
  const [visibleLayers, setVisibleLayers] = useState<Record<CircuitType, boolean>>({
    electric: true,
    water: true,
    heating: true,
    recuperation: true,
  });
  const [hiddenCircuitIds, setHiddenCircuitIds] = useState<Set<string>>(new Set());

  const [imgAspectRatio, setImgAspectRatio] = useState(1);
  const [snappedMousePos, setSnappedMousePos] = useState<{ x: number; y: number } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activePinId) {
      const timer = setTimeout(() => setActivePinId(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [activePinId]);

  useEffect(() => {
    if (placingProductId) setToolMode('place');
  }, [placingProductId]);

  useEffect(() => {
    if (imgAspectRatio === 1) return;
    if (!activeFloor?.scale) return;
    if (activeFloor.scale.aspectRatio) return;
    project.setFloorScale(activeFloor.id, { ...activeFloor.scale, aspectRatio: imgAspectRatio });
  }, [imgAspectRatio]);

  const { selected, floors } = project;
  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0];
  if (activeFloor && activeFloor.id !== activeFloorId) {
    setActiveFloorId(activeFloor.id);
  }

  const allFloorPins = listAllPins(selected, products, activeFloor?.id);
  const rooms = activeFloor?.rooms ?? [];

  const roomLighting = useMemo(() => {
    const result: Record<string, { required: number; current: number; deficit: number }> = {};
    if (!activeFloor?.scale) return result;
    for (const room of rooms) {
      if (!room.requiredLux || room.requiredLux <= 0) continue;
      const areaM2 = polygonAreaM2(room.points, activeFloor.scale);
      const totalRequired = Math.round((room.requiredLux * areaM2) / (0.5 * 0.8));
      let currentLumens = 0;
      for (const pin of allFloorPins) {
        if (pin.placement.room === room.id && pin.product.lumens > 0) {
          currentLumens += pin.product.lumens;
        }
      }
      result[room.id] = { required: totalRequired, current: currentLumens, deficit: totalRequired - currentLumens };
    }
    return result;
  }, [activeFloor?.scale, rooms, allFloorPins]);

  const roomLightingData = useMemo(() => {
    const result: Record<string, { currentLumens: number; lightsInRoom: { productName: string; lumens: number; count: number }[] }> = {};
    for (const room of rooms) {
      const lightMap = new Map<string, { productName: string; lumens: number; count: number }>();
      let total = 0;
      for (const pin of allFloorPins) {
        if (pin.placement.room === room.id && pin.product.lumens > 0) {
          total += pin.product.lumens;
          const existing = lightMap.get(pin.product.id);
          if (existing) {
            existing.count++;
          } else {
            lightMap.set(pin.product.id, { productName: pin.product.name, lumens: pin.product.lumens, count: 1 });
          }
        }
      }
      if (total > 0 || room.requiredLux) {
        result[room.id] = { currentLumens: total, lightsInRoom: Array.from(lightMap.values()) };
      }
    }
    return result;
  }, [rooms, allFloorPins]);

  const snapToAngle = useCallback((from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } => {
    const ar = imgAspectRatio;
    const dx = to.x - from.x;
    const dy = (to.y - from.y) / ar;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return to;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const rawAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    const snapped = Math.round(rawAngleDeg / SNAP_STEP_DEG) * SNAP_STEP_DEG;
    const rad = snapped * (Math.PI / 180);
    return {
      x: from.x + dist * Math.cos(rad),
      y: from.y + dist * Math.sin(rad) * ar,
    };
  }, [imgAspectRatio]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDrawingCable && !isDrawingRoom) { setSnappedMousePos(null); return; }
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const raw = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
    const drawnPoints = isDrawingCable ? cableDrawingPoints : roomDrawingPoints;
    if (drawnPoints.length > 0) {
      const last = drawnPoints[drawnPoints.length - 1];
      setSnappedMousePos(snapToAngle(last, raw));
    } else {
      setSnappedMousePos(raw);
    }
  }, [isDrawingCable, isDrawingRoom, cableDrawingPoints, roomDrawingPoints, snapToAngle]);

  if (!open) return null;

  const placingProduct = placingProductId ? products.find((p) => p.id === placingProductId) : null;
  const isDesignSeries = placingProduct?.kind === 'design_series';
  const floorPins = allFloorPins.filter((pin) => {
    const trade = (pin.product.trade || 'electric') as CircuitType;
    return visibleLayers[trade];
  });
  const cables = activeFloor?.cables ?? [];
  const circuits = activeFloor?.circuits ?? [];
  const dimensions = activeFloor?.dimensions ?? [];

  const pushUndo = (action: UndoAction) => {
    setUndoStack(prev => [...prev.slice(-49), action]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    if (action.type === 'add_placement') {
      project.removePlacement(action.payload.productId as string, action.payload.placementId as string);
    } else if (action.type === 'remove_placement') {
      project.addPlacement(action.payload.productId as string, action.payload.placement as Placement);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    if (action.type === 'add_placement') {
      project.addPlacement(action.payload.productId as string, action.payload.placement as Placement);
    } else if (action.type === 'remove_placement') {
      project.removePlacement(action.payload.productId as string, action.payload.placementId as string);
    }
  };

  const getClickCoords = (e: React.MouseEvent<HTMLElement>): { x: number; y: number } | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeFloor?.floorplanImg) return;
    if (dragging) return;
    if (activeFloor.floorplanImg && !activeFloor.scale && toolMode !== 'scale') return;

    const pt = getClickCoords(e);
    if (!pt) return;

    if (toolMode === 'scale') {
      if (scaleStep === 'point1') {
        setScaleTempPoints([pt]);
        setScaleStep('point2');
      } else if (scaleStep === 'point2') {
        setScaleTempPoints((prev) => [...prev, pt]);
        setScaleStep('input');
      }
      return;
    }

    if (toolMode === 'room' && isPlacingDistributor && activeFloor) {
      const distCount = (activeFloor.distributors ?? []).length;
      project.addDistributor(activeFloor.id, {
        id: crypto.randomUUID(),
        x: pt.x,
        y: pt.y,
        name: `Rozdělovač ${distCount + 1}`,
      });
      setIsPlacingDistributor(false);
      return;
    }

    if (toolMode === 'room' && isDrawingRoom) {
      const snapped = snappedMousePos ?? pt;
      setRoomDrawingPoints((prev) => [...prev, snapped]);
      return;
    }

    if (toolMode === 'cable' && isDrawingCable) {
      const snapped = snappedMousePos ?? pt;
      setCableDrawingPoints((prev) => [...prev, snapped]);
      return;
    }

    if (toolMode === 'dimension') {
      if (dimTempPoints.length === 0) {
        setDimTempPoints([pt]);
      } else if (dimTempPoints.length === 1 && activeFloor) {
        project.addDimension(activeFloor.id, { id: crypto.randomUUID(), p1: dimTempPoints[0], p2: pt });
        setDimTempPoints([]);
      }
      return;
    }

    if (toolMode === 'place' && placingProductId) {
      const placement: Placement = {
        id: crypto.randomUUID(),
        x: pt.x,
        y: pt.y,
        note: '',
        ts: Date.now(),
        floorId: activeFloor.id,
      };
      if (isDesignSeries) {
        placement.config = {
          frameSize: designBuilderState.frameSize,
          modules: [...designBuilderState.modules],
          ...(designColor ? { colorName: designColor.name, colorHex: designColor.hex } : {}),
        };
      }
      const roomId = findRoomAtPoint(pt, rooms);
      if (roomId) placement.room = roomId;
      let resolvedIcon: string | undefined;
      if (isDesignSeries && designBuilderState.modules.length > 0) {
        const firstModuleName = designBuilderState.modules[0];
        const dm = designModules.find((m) => m.name === firstModuleName);
        if (dm?.icon_url) resolvedIcon = dm.icon_url;
      }
      if (!resolvedIcon) {
        resolvedIcon = materialSettings.defaultIcons[placingProductId] || placingProduct?.default_icon || undefined;
      }
      if (resolvedIcon) placement.icon = resolvedIcon;
      project.addPlacement(placingProductId, placement);
      pushUndo({ type: 'add_placement', payload: { productId: placingProductId, placementId: placement.id, placement } });
      setActivePinId(placement.id);
    }
  };

  const handlePinPointerDown = (e: React.PointerEvent, pin: PinData) => {
    if (toolMode === 'cable' && isDrawingCable) {
      e.preventDefault();
      e.stopPropagation();
      setCableDrawingPoints((prev) => [...prev, { x: pin.placement.x, y: pin.placement.y }]);
      if (activeCircuitId) {
        project.updatePlacementCircuit(pin.productId, pin.placement.id, activeCircuitId);
      }
      return;
    }
    if (toolMode !== 'pointer') {
      e.stopPropagation();
      setActivePinId(pin.placement.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ productId: pin.productId, placementId: pin.placement.id, x: pin.placement.x, y: pin.placement.y });
    setActivePinId(pin.placement.id);
  };

  const handlePinPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragging((prev) => prev ? { ...prev, x, y } : null);
  };

  const handlePinPointerUp = () => {
    if (!dragging) return;
    project.updatePlacementPosition(dragging.productId, dragging.placementId, dragging.x, dragging.y);
    const roomId = findRoomAtPoint({ x: dragging.x, y: dragging.y }, rooms);
    project.updatePlacementRoom(dragging.productId, dragging.placementId, roomId);
    setDragging(null);
  };

  const handleToolModeChange = (mode: ToolMode) => {
    setToolMode(mode);
    setScaleStep('idle');
    setScaleTempPoints([]);
    setIsDrawingRoom(false);
    setRoomDrawingPoints([]);
    setIsPlacingDistributor(false);
    setIsDrawingCable(false);
    setCableDrawingPoints([]);
    setDimTempPoints([]);
    if (mode !== 'place') onStopPlacing();
  };

  const handleStartScale = () => { setToolMode('scale'); setScaleStep('point1'); setScaleTempPoints([]); };
  const handleSetScaleDistance = (meters: number) => {
    if (scaleTempPoints.length >= 2 && activeFloor) {
      const ar = imgRef.current ? imgRef.current.naturalWidth / imgRef.current.naturalHeight : imgAspectRatio;
      project.setFloorScale(activeFloor.id, { p1: scaleTempPoints[0], p2: scaleTempPoints[1], realDistanceM: meters, aspectRatio: ar });
    }
    setScaleStep('idle'); setScaleTempPoints([]); setToolMode('pointer');
  };
  const handleClearScale = () => { if (activeFloor) project.setFloorScale(activeFloor.id, undefined); };
  const handleCancelScale = () => { setScaleStep('idle'); setScaleTempPoints([]); setToolMode('pointer'); };

  const handleStartRoomDraw = () => { setToolMode('room'); setIsDrawingRoom(true); setRoomDrawingPoints([]); };
  const handleFinishRoomDraw = (name: string) => {
    if (roomDrawingPoints.length >= 3 && activeFloor) {
      project.addRoom(activeFloor.id, { id: crypto.randomUUID(), name, points: [...roomDrawingPoints] });
    }
    setIsDrawingRoom(false); setRoomDrawingPoints([]);
  };
  const handleCancelRoomDraw = () => { setIsDrawingRoom(false); setRoomDrawingPoints([]); setToolMode('pointer'); };

  const handleStartCableDraw = (materialName: string) => {
    if (!activeCircuitId) return;
    setActiveMaterialName(materialName);
    setToolMode('cable'); setIsDrawingCable(true); setCableDrawingPoints([]);
  };
  const handleFinishCable = () => {
    if (cableDrawingPoints.length >= 2 && activeCircuitId && activeFloor) {
      project.addCable(activeFloor.id, { id: crypto.randomUUID(), circuitId: activeCircuitId, points: [...cableDrawingPoints], materialName: activeMaterialName || undefined });
    }
    setIsDrawingCable(false); setCableDrawingPoints([]);
  };
  const handleCancelCableDraw = () => { setIsDrawingCable(false); setCableDrawingPoints([]); setToolMode('pointer'); };

  const handlePickProduct = (productId: string) => { onStartPlacing(productId); setToolMode('place'); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFloor) return;
    const reader = new FileReader();
    reader.onload = () => {
      project.setFloorImage(activeFloor.id, reader.result as string);
      project.setFloorScale(activeFloor.id, undefined);
      e.target.value = '';
      handleStartScale();
    };
    reader.readAsDataURL(file);
  };

  const handleFrameSize = (n: number) => {
    const clamped = Math.max(1, Math.min(5, n));
    const mods = [...designBuilderState.modules];
    while (mods.length < clamped) mods.push(designModules[0]?.name ?? 'Zásuvka');
    setDesignBuilderState({ frameSize: clamped, modules: mods.slice(0, clamped) });
  };
  const handleSlotChange = (idx: number, val: string) => {
    const mods = [...designBuilderState.modules];
    mods[idx] = val;
    setDesignBuilderState({ ...designBuilderState, modules: mods });
  };
  const applyPreset = (preset: DesignPreset) => {
    const mods = Array.isArray(preset.modules) ? preset.modules as string[] : [];
    setDesignBuilderState({ frameSize: preset.frame_size, modules: [...mods] });
  };

  const startRename = (floor: typeof activeFloor) => {
    if (!floor) return;
    setEditingFloorId(floor.id); setEditingName(floor.name);
  };
  const commitRename = () => {
    if (editingFloorId && editingName.trim()) project.renameFloor(editingFloorId, editingName.trim());
    setEditingFloorId(null);
  };

  const getPinPos = (pin: PinData) => {
    if (dragging && dragging.placementId === pin.placement.id) return { x: dragging.x, y: dragging.y };
    return { x: pin.placement.x, y: pin.placement.y };
  };

  const cursorForMode = (): string => {
    if (toolMode === 'scale' && (scaleStep === 'point1' || scaleStep === 'point2')) return 'crosshair';
    if (toolMode === 'room' && (isDrawingRoom || isPlacingDistributor)) return 'crosshair';
    if (toolMode === 'cable' && isDrawingCable) return 'crosshair';
    if (toolMode === 'dimension') return 'crosshair';
    if (toolMode === 'place' && placingProductId) return 'crosshair';
    return 'default';
  };

  const showPlaceContext = toolMode === 'place';
  const showScaleContext = toolMode === 'scale';
  const showRoomContext = toolMode === 'room';
  const showCableContext = toolMode === 'cable';
  const showDimensionContext = toolMode === 'dimension';

  const sidebarContent = (
    <>
      {showPlaceContext && (
        <ProductPicker products={products} categories={categories} selected={selected} activeProductId={placingProductId} onPickProduct={handlePickProduct} visibleLayers={visibleLayers} />
      )}
      {showPlaceContext && isDesignSeries && placingProduct && (
        <DesignBuilder product={placingProduct} designModules={designModules} designPresets={designPresets} productColors={productColors} frameSize={designBuilderState.frameSize} modules={designBuilderState.modules} designColor={designColor} onFrameSize={handleFrameSize} onSlotChange={handleSlotChange} onColorChange={setDesignColor} onApplyPreset={applyPreset} />
      )}
      {showScaleContext && (
        <ScaleCalibrator scale={activeFloor?.scale} scaleStep={scaleStep} onStart={handleStartScale} onSetDistance={handleSetScaleDistance} onClear={handleClearScale} onCancel={handleCancelScale} />
      )}
      {showRoomContext && (
        <>
          <RoomEditor rooms={rooms} drawingPoints={roomDrawingPoints} isDrawing={isDrawingRoom} scale={activeFloor?.scale} onStartDraw={handleStartRoomDraw} onFinishDraw={handleFinishRoomDraw} onCancelDraw={handleCancelRoomDraw} onRemoveRoom={(roomId) => { if (activeFloor) project.removeRoom(activeFloor.id, roomId); }} onRenameRoom={(roomId, name) => { if (activeFloor) project.renameRoom(activeFloor.id, roomId, name); }} onUpdateBathroomLayout={(roomId, layout) => { if (activeFloor) project.updateRoomBathroomLayout(activeFloor.id, roomId, layout); }} />
          <DistributorEditor distributors={activeFloor?.distributors ?? []} isPlacing={isPlacingDistributor} onStartPlace={() => setIsPlacingDistributor(true)} onCancelPlace={() => setIsPlacingDistributor(false)} onRemove={(id) => { if (activeFloor) project.removeDistributor(activeFloor.id, id); }} />
        </>
      )}
      {toolMode === 'heating' && (
        <HeatingSection rooms={rooms} scale={activeFloor?.scale} heatingSystems={heatingSystems} onUpdateRoomHeating={(roomId, sysId, cfg) => { if (activeFloor) project.updateRoomHeating(activeFloor.id, roomId, sysId, cfg); }} onUpdateRoomHeatingConfig={(roomId, key, val) => { if (activeFloor) project.updateRoomHeatingConfig(activeFloor.id, roomId, key, val); }} onAddRoomDoor={(roomId, door) => { if (activeFloor) project.addRoomDoor(activeFloor.id, roomId, door); }} onRemoveRoomDoor={(roomId, doorId) => { if (activeFloor) project.removeRoomDoor(activeFloor.id, roomId, doorId); }} />
      )}
      {toolMode === 'lighting' && (
        <LightingSection rooms={rooms} scale={activeFloor?.scale} lightingNorms={lightingNorms} roomLightingData={roomLightingData} onUpdateRoomLighting={(roomId, roomType, requiredLux) => { if (!activeFloor) return; project.setFloors(prev => prev.map(f => { if (f.id !== activeFloor.id) return f; return { ...f, rooms: (f.rooms ?? []).map(r => r.id === roomId ? { ...r, roomType, requiredLux } : r) }; })); }} />
      )}
      {showCableContext && (
        <CableEditor circuits={circuits} cables={cables} scale={activeFloor?.scale} activeCircuitId={activeCircuitId} isDrawing={isDrawingCable} drawingPoints={cableDrawingPoints} materials={materials} hiddenCircuitIds={hiddenCircuitIds} onToggleCircuitVisibility={(circuitId) => { setHiddenCircuitIds(prev => { const next = new Set(prev); if (next.has(circuitId)) next.delete(circuitId); else next.add(circuitId); return next; }); }} onAddCircuit={(circuit) => { if (activeFloor) { project.addCircuit(activeFloor.id, circuit); setActiveCircuitId(circuit.id); } }} onRemoveCircuit={(circuitId) => { if (activeFloor) project.removeCircuit(activeFloor.id, circuitId); }} onUpdateCircuit={(circuitId, updates) => { if (activeFloor) project.updateCircuit(activeFloor.id, circuitId, updates); }} onSelectCircuit={setActiveCircuitId} onStartDraw={handleStartCableDraw} onFinishCable={handleFinishCable} onCancelDraw={handleCancelCableDraw} onRemoveCable={(cableId) => { if (activeFloor) project.removeCable(activeFloor.id, cableId); }} />
      )}
      {showDimensionContext && (
        <div className="p-4 border-b border-white/10">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            Kóty
            {dimensions.length > 0 && <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{dimensions.length}</span>}
          </div>
          {dimTempPoints.length === 1 && (
            <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-2.5 mb-3 text-xs font-extrabold text-blue-400">
              Klikni na druhý bod kóty.
            </div>
          )}
          {dimTempPoints.length === 0 && dimensions.length === 0 && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-slate-500">
              Klikni na půdorys pro první bod kóty.
            </div>
          )}
          {dimensions.length > 0 && (
            <div className="space-y-1">
              {dimensions.map((dim) => {
                const s = activeFloor?.scale;
                let label = '—';
                if (s) {
                  const dx = dim.p2.x - dim.p1.x;
                  const dy = dim.p2.y - dim.p1.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const calibDist = Math.sqrt((s.p2.x - s.p1.x) ** 2 + (s.p2.y - s.p1.y) ** 2);
                  if (calibDist > 0) label = `${((dist / calibDist) * s.realDistanceM).toFixed(2)} m`;
                }
                return (
                  <div key={dim.id} className="flex items-center justify-between text-[11px] bg-navy-800/60 rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
                    <span className="font-extrabold text-blue-400">{label}</span>
                    <button onClick={() => { if (activeFloor) project.removeDimension(activeFloor.id, dim.id); }} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition" aria-label="Smazat kótu">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {(toolMode === 'pointer' || toolMode === 'dimension' || toolMode === 'heating' || toolMode === 'lighting') && (
        <ProductPicker products={products} categories={categories} selected={selected} activeProductId={placingProductId} onPickProduct={handlePickProduct} visibleLayers={visibleLayers} />
      )}
      <FloorplanLegend
        floorPins={floorPins}
        rooms={rooms}
        circuits={circuits}
        activePinId={activePinId}
        floorName={activeFloor?.name ?? ''}
        project={project}
        materialSettings={materialSettings}
        onSetActivePinId={setActivePinId}
        onOpenIconPicker={setIconPickerPin}
      />
    </>
  );

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white/[0.04]" role="dialog" aria-label="Editor půdorysu">
      <div className="h-13 bg-white/[0.06] border-b flex items-center px-3 gap-2 shrink-0 ">
        <button onClick={onClose} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] shrink-0" aria-label="Zpět do katalogu">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-extrabold hidden sm:inline">Katalog</span>
        </button>
        <div className="w-px h-7 bg-white/[0.08]" />
        <div className="flex items-center gap-1 overflow-x-auto py-1 min-w-0">
          {floors.map((floor) => (
            <div key={floor.id} className="flex items-center gap-0.5 shrink-0">
              {editingFloorId === floor.id ? (
                <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); }} className="px-2 py-1 rounded-lg border border-blue-300 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-20" aria-label="Název patra" />
              ) : (
                <button onClick={() => setActiveFloorId(floor.id)} className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${activeFloor?.id === floor.id ? 'bg-slate-900 text-white shadow' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'}`}>
                  {floor.name}
                  {floor.floorplanImg && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                </button>
              )}
              <button onClick={() => startRename(floor)} className="p-0.5 rounded text-slate-400 hover:text-slate-400 transition" aria-label={`Přejmenovat ${floor.name}`}>
                <Pencil className="w-2.5 h-2.5" />
              </button>
              {floors.length > 1 && (
                <button onClick={() => { if (confirm(`Smazat "${floor.name}"?`)) project.removeFloor(floor.id); }} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition" aria-label={`Smazat ${floor.name}`}>
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={project.addFloor} className="px-2 py-1.5 rounded-xl bg-white/[0.06] text-slate-400 hover:bg-white/[0.08] transition flex items-center gap-1 text-xs font-extrabold shrink-0" aria-label="Přidat patro">
            <Plus className="w-3 h-3" /> Patro
          </button>
        </div>
        <div className="flex-1" />
        {toolMode === 'place' && placingProduct && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-200 rounded-xl px-3 py-1.5 shrink-0">
            <span className="text-xs font-extrabold text-blue-400 truncate max-w-[140px]">{placingProduct.name}</span>
            <button onClick={onStopPlacing} className="bg-white/[0.06] border border-blue-200 text-blue-400 px-2 py-1 rounded-lg font-extrabold text-[11px] hover:bg-blue-500/10 transition flex items-center gap-1">
              <Check className="w-3 h-3" /> Hotovo
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={handleUndo} disabled={undoStack.length === 0} aria-label="Zpět" className={`bg-navy-800/60 border border-white/[0.08] p-2 rounded-xl transition ${undoStack.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-white/[0.04]'}`}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} aria-label="Znovu" className={`bg-navy-800/60 border border-white/[0.08] p-2 rounded-xl transition ${redoStack.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-white/[0.04]'}`}>
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowCatalog(true)} className="bg-blue-600 text-white px-3 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition  flex items-center gap-1.5 text-xs" aria-label="Přidat z katalogu">
            <PackagePlus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Přidat</span>
          </button>
          <label className="bg-navy-800/60 border border-white/[0.08] text-slate-500 p-2 rounded-xl hover:bg-white/[0.04] transition cursor-pointer" aria-label="Nahrát obrázek půdorysu">
            <Upload className="w-3.5 h-3.5" />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={() => { if (activeFloor && confirm('Smazat půdorys?')) project.setFloorImage(activeFloor.id, null); }} aria-label="Smazat obrázek" className="bg-navy-800/60 border border-white/[0.08] text-slate-500 p-2 rounded-xl hover:bg-white/[0.04] transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden bg-navy-800/60 border border-white/[0.08] text-slate-500 p-2 rounded-xl hover:bg-white/[0.04] transition" aria-label="Otevřít panel">
            <PanelRightOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <FloorplanToolbar mode={toolMode} onModeChange={handleToolModeChange} hasScale={!!activeFloor?.scale} hasImage={!!activeFloor?.floorplanImg} visibleLayers={visibleLayers} onToggleLayer={(type) => setVisibleLayers((prev) => ({ ...prev, [type]: !prev[type] }))} showGrid={showGrid} onToggleGrid={() => setShowGrid((prev) => !prev)} showHeatingPipes={showHeatingPipes} onToggleHeatingPipes={() => setShowHeatingPipes((prev) => !prev)} pinSize={pinSize} onPinSizeChange={setPinSize} />

        <div className="flex-1 bg-white/[0.06] overflow-auto">
          <div className="p-3">
            {!activeFloor?.floorplanImg ? (
              <div className="bg-navy-800/60 border border-white/[0.08] rounded-3xl p-10 text-center ">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.06] mx-auto flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-lg font-extrabold text-white">Nahraj půdorys</div>
                <div className="text-sm text-slate-500 mt-1">PNG/JPG pro {activeFloor?.name ?? 'toto patro'}.</div>
              </div>
            ) : (
              <div className="relative inline-block">
                <img
                  ref={imgRef}
                  src={activeFloor.floorplanImg}
                  alt={`Půdorys ${activeFloor.name}`}
                  className="max-w-full h-auto rounded-2xl shadow border-2 border-white/10 select-none"
                  draggable={false}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setSnappedMousePos(null)}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setImgAspectRatio(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                  style={{ cursor: cursorForMode() }}
                />

                {activeFloor.floorplanImg && !activeFloor.scale && toolMode !== 'scale' && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center z-20">
                    <div className="bg-navy-800/60 rounded-2xl shadow-xl p-6 max-w-sm text-center">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/20 mx-auto flex items-center justify-center mb-3">
                        <Ruler className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-sm font-extrabold text-white mb-1">Nastavte meritko</div>
                      <div className="text-xs text-slate-500 mb-4">Pro spravnou praci s pudorysem je nutne nejprve zkalibrovat meritko.</div>
                      <button onClick={handleStartScale} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 transition flex items-center gap-2 mx-auto">
                        <Ruler className="w-4 h-4" /> Kalibrovat meritko
                      </button>
                    </div>
                  </div>
                )}

                <FloorplanCanvas
                  rooms={rooms}
                  cables={cables}
                  circuits={circuits}
                  dimensions={dimensions}
                  distributors={activeFloor?.distributors ?? []}
                  scale={activeFloor.scale}
                  roomLighting={roomLighting}
                  heatingSystems={heatingSystems}
                  showHeatingPipes={showHeatingPipes}
                  showGrid={showGrid}
                  visibleLayers={visibleLayers}
                  hiddenCircuitIds={hiddenCircuitIds}
                  isDrawingRoom={isDrawingRoom}
                  roomDrawingPoints={roomDrawingPoints}
                  isDrawingCable={isDrawingCable}
                  cableDrawingPoints={cableDrawingPoints}
                  activeCircuitId={activeCircuitId}
                  scaleTempPoints={scaleTempPoints}
                  dimTempPoints={dimTempPoints}
                  bathroomSymbols={bathroomSymbols}
                  snappedMousePos={snappedMousePos}
                />

                <div className="absolute inset-0 pointer-events-none">
                  {floorPins.map((pin) => {
                    const isActive = activePinId === pin.placement.id;
                    const isDragging = dragging?.placementId === pin.placement.id;
                    const pos = getPinPos(pin);
                    const hasIcon = !!pin.placement.icon;
                    const circuitColor = pin.placement.circuitId ? circuits.find((c) => c.id === pin.placement.circuitId)?.color : undefined;
                    return (
                      <div
                        key={pin.placement.id}
                        onPointerDown={(e) => handlePinPointerDown(e, pin)}
                        onPointerMove={handlePinPointerMove}
                        onPointerUp={handlePinPointerUp}
                        className="absolute pointer-events-auto flex flex-col items-center"
                        style={{
                          left: `${pos.x * 100}%`,
                          top: `${pos.y * 100}%`,
                          transform: `translate(-50%, -50%)${isActive && !isDragging ? ' scale(1.15)' : ''}`,
                          touchAction: 'none',
                          zIndex: isDragging ? 50 : isActive ? 10 : 1,
                        }}
                      >
                        <div
                          className={`rounded-full shadow-lg transition-shadow ${isDragging ? 'ring-4 ring-blue-400/50 cursor-grabbing' : isActive ? 'ring-[3px] ring-white shadow-xl' : `ring-2 ring-white/90 hover:ring-white hover:shadow-xl ${toolMode === 'pointer' ? 'cursor-grab' : 'cursor-pointer'}`}`}
                          style={{ backgroundColor: circuitColor ?? '#1e293b', width: pinSize, height: pinSize, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                        >
                          {hasIcon ? (
                            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
                              {renderPinIcon(pin.placement.icon, Math.round(pinSize * 0.75))}
                            </span>
                          ) : (
                            <span className="font-extrabold text-white leading-none" style={{ fontSize: Math.max(7, Math.round(pinSize * 0.3)) }}>{pin.label}</span>
                          )}
                        </div>
                        <div className="mt-0.5 bg-white/[0.06] backdrop-blur-sm px-1 py-px rounded font-extrabold text-slate-300  whitespace-nowrap leading-tight" style={{ fontSize: Math.max(8, Math.round(pinSize * 0.28)) }}>
                          {pin.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 xl:w-96 border-l bg-white/[0.06] overflow-y-auto flex-col shrink-0 hidden lg:flex h-full">
          {sidebarContent}
        </div>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden flex">
          <div className="flex-1 bg-black/30" onClick={() => setMobileSidebarOpen(false)} />
          <div className="w-80 bg-white/[0.06] overflow-auto flex flex-col shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <span className="text-sm font-extrabold text-white">Panel</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition" aria-label="Zavřít panel">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {iconPickerPin && (
        <IconPicker
          currentIcon={iconPickerPin.placement.icon}
          onSelect={(iconId) => { project.updatePlacementIcon(iconPickerPin.productId, iconPickerPin.placement.id, iconId); setIconPickerPin(null); }}
          onClose={() => setIconPickerPin(null)}
        />
      )}

      <CatalogBrowser
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        products={products}
        categories={categories}
        selected={selected}
        onToggleProduct={onToggleProduct}
        onPlaceProduct={(pid) => { setShowCatalog(false); handlePickProduct(pid); }}
      />
    </div>
  );
}
