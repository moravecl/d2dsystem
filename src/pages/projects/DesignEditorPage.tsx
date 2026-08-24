import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Trash2, RotateCcw, Redo2, Check, Plus, Pencil, X, Copy, DoorOpen, Image as ImageIcon, ArrowLeft, PanelRightOpen, ChevronDown, ChevronUp, Square, Sun, Layers, Package, Save, File as FileEdit } from 'lucide-react';
import { useDesignVersions } from '../../hooks/useDesignVersions';
import { useDesignElementTypes } from '../../hooks/useDesignElementTypes';
import { useProjectDesignElements } from '../../hooks/useProjectDesignElements';
import SchematicElementPanel from '../../components/editor/SchematicElementPanel';
import { useCategoryColors } from '../../hooks/useCategoryColors';
import type { DesignVersion } from '../../hooks/useDesignVersions';
import SaveVersionButton from '../../components/ui/SaveVersionButton';
import VersionHistoryDrawer from '../../components/ui/VersionHistoryDrawer';
import type { VersionItem } from '../../components/ui/VersionHistoryDrawer';
import VersionPickerModal from '../../components/ui/VersionPickerModal';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import { useCatalogData } from '../../hooks/useCatalogData';
import { useProjectState } from '../../hooks/useProjectState';
import { useMaterialSettings } from '../../hooks/useMaterialSettings';
import { useMaterials } from '../../hooks/useMaterials';
import { useHeatingSystems } from '../../hooks/useHeatingSystems';
import { useLightingNorms, calculateRequiredLumens } from '../../hooks/useLightingNorms';
import { loadProjectById } from '../../components/catalog/SaveLoadModals';
import type { Placement, CircuitType, Room } from '../../hooks/useProjectState';
import type { ToolMode } from '../../components/catalog/floorplan/FloorplanToolbar';
import FloorplanToolbar from '../../components/catalog/floorplan/FloorplanToolbar';
import FloorplanCanvas from '../../components/catalog/floorplan/FloorplanCanvas';
import ScaleCalibrator from '../../components/catalog/floorplan/ScaleCalibrator';
import RoomEditor from '../../components/catalog/floorplan/RoomEditor';
import CableEditor from '../../components/catalog/floorplan/CableEditor';
import DistributorEditor from '../../components/catalog/floorplan/DistributorEditor';
import HeatingSection from '../../components/catalog/floorplan/HeatingSection';
import LightingSection from '../../components/catalog/floorplan/LightingSection';
import VentilationSection from '../../components/catalog/floorplan/VentilationSection';
import FvSection from '../../components/fv/FvSection';
import DesignBuilder from '../../components/catalog/DesignBuilder';
import IconPicker from '../../components/catalog/floorplan/IconPicker';
import { listAllPins } from '../../components/catalog/floorplan/pinUtils';
import type { PinData } from '../../components/catalog/floorplan/pinUtils';
import { renderPinIcon } from '../../components/catalog/floorplan/iconLibrary';
import { findRoomAtPoint, polygonAreaM2, polygonCentroid, findClosestWall, closestPointOnSegment, distanceBetween, getNearestWallAngle } from '../../components/catalog/floorplan/geometry';
import EditorCatalogPanel from '../../components/editor/EditorCatalogPanel';
import UsedElementsPanel from '../../components/editor/UsedElementsPanel';
import UsedSchematicPanel from '../../components/editor/UsedSchematicPanel';
import ObjectDetailDrawer from '../../components/editor/ObjectDetailDrawer';
import PinDetailDrawer from '../../components/editor/PinDetailDrawer';
import SchematicElementDrawer from '../../components/editor/SchematicElementDrawer';
import { createDefaultObject, getObjectSizeNormalized } from '../../components/catalog/floorplan/floorplanObjects';
import type { FloorplanObjectData } from '../../components/catalog/floorplan/floorplanObjects';
import type { FloorplanSymbol } from '../../types/database';
import type { BathroomSymbol } from '../../components/catalog/floorplan/BathroomDesigner';
import { computeSnap, createDimensionsFromSnap } from '../../components/catalog/floorplan/snapEngine';
import type { SnapGuide } from '../../components/catalog/floorplan/snapEngine';
import DesignWorkflowStepper, { type WorkflowStep } from '../../components/editor/DesignWorkflowStepper';
import WorkflowCtaBanner, { type WorkflowContextStats } from '../../components/editor/WorkflowCtaBanner';
import { useDesignWorkflow } from '../../hooks/useDesignWorkflow';
import { useProductAssignments } from '../../hooks/useProductAssignments';
import { useMountingGroups } from '../../hooks/useMountingGroups';
import type { MountingOrientation } from '../../types/designElements';
import MountingGroupModal from '../../components/editor/MountingGroupModal';
import MountingGroupEditModal from '../../components/editor/MountingGroupEditModal';

const pendingSavePromise: Promise<void> | null = null;

type ScaleStep = 'idle' | 'point1' | 'point2' | 'input';
type RightTab = 'catalog' | 'schematic' | 'used' | 'rooms';
type DesignMode = 'catalog' | 'schematic';

interface DragState {
  productId: string;
  placementId: string;
  x: number;
  y: number;
}

interface ObjectDragState {
  objectId: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

interface UndoAction {
  type: 'add_placement' | 'remove_placement';
  payload: Record<string, unknown>;
}

export default function DesignEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const { toast } = useToast();

  const { categories, products, designModules, designPresets, productColors, loading: catalogLoading } = useCatalogData();
  const project = useProjectState();
  const materialSettings = useMaterialSettings();
  const { materials } = useMaterials();
  const { systems: heatingSystems } = useHeatingSystems();
  const { norms: lightingNorms } = useLightingNorms();

  const { types: elementTypes, getTypeById } = useDesignElementTypes();
  const { colorMap: categoryColorMap } = useCategoryColors();
  const {
    elements: designElements,
    addElement: addDesignElement,
    updateElement: updateDesignElement,
    removeElement: removeDesignElement,
    getElementsByFloor,
  } = useProjectDesignElements(id);

  const {
    assignments,
    productKindMap,
    assignProduct,
    resolveForElement,
  } = useProductAssignments(id);

  const [quotesCount, setQuotesCount] = useState(0);
  useEffect(() => {
    if (!id) return;
    supabase
      .from('project_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .then(({ count }) => setQuotesCount(count ?? 0));
  }, [id]);

  const workflow = useDesignWorkflow({
    floors: project.floors,
    designElements,
    assignments,
    quotesCount,
    productKindMap,
  });

  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('design');

  const [designerConfig, setDesignerConfig] = useState<{
    enableProducts: boolean;
    enableSchematic: boolean;
    defaultMode: 'products' | 'schematic';
    loaded: boolean;
  }>({ enableProducts: true, enableSchematic: true, defaultMode: 'products', loaded: false });

  const [designMode, setDesignMode] = useState<DesignMode>('catalog');
  const [placingElementTypeId, setPlacingElementTypeId] = useState<string | null>(null);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [draggingElement, setDraggingElement] = useState<{ id: string; x: number; y: number } | null>(null);
  const [placementDefaults, setPlacementDefaults] = useState<{ circuitId: string | null; mountingHeight: string | null }>({ circuitId: null, mountingHeight: null });
  const [bulkAssignDialog, setBulkAssignDialog] = useState<{ elementIds: string[]; productId: string; alreadyAssigned: string[] } | null>(null);

  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [showMountingGroupModal, setShowMountingGroupModal] = useState(false);
  const [activeMountingGroupId, setActiveMountingGroupId] = useState<string | null>(null);
  const [editingMountingGroupId, setEditingMountingGroupId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<{
    id: string;
    startX: number;
    startY: number;
    elementOffsets: Array<{ id: string; offsetX: number; offsetY: number }>;
  } | null>(null);

  const {
    groupsWithSlots: mountingGroups,
    getGroupsByFloor,
    getGroupForElement,
    createGroupFromElements,
    updateGroup: updateMountingGroup,
    updateSlot: updateMountingSlot,
    disbandGroup,
    removeElementFromSlot,
  } = useMountingGroups(id);

  const designContextStats = useMemo((): WorkflowContextStats => {
    const elementsWithoutRoom = designElements.filter((el) => !el.room_id).length;
    const elementsInGroupSet = new Set<string>();
    for (const group of mountingGroups) {
      for (const slot of group.slots) {
        if (slot.element_id) elementsInGroupSet.add(slot.element_id);
      }
    }
    return {
      totalElements: designElements.length,
      elementsWithoutRoom,
      elementsInGroup: elementsInGroupSet.size,
      elementsOutsideGroup: designElements.length - elementsInGroupSet.size,
      unassignedCount: workflow.unassignedCount,
      assignedCount: workflow.assignedCount,
      inheritedCount: workflow.inheritedCount,
    };
  }, [designElements, mountingGroups, workflow]);

  const [projectLoaded, setProjectLoaded] = useState(false);
  const projectLoadedRef = useRef(false);
  const [bathroomSymbols, setBathroomSymbols] = useState<BathroomSymbol[]>([]);

  useEffect(() => {
    supabase.from('bathroom_symbols').select('*').order('category').order('sort_order').then(({ data }) => {
      if (data) setBathroomSymbols(data as BathroomSymbol[]);
    });
  }, []);

  useEffect(() => {
    const loadDesignerConfig = async () => {
      const { data } = await supabase
        .from('designer_config')
        .select('enable_products, enable_schematic, default_mode')
        .maybeSingle();

      if (data) {
        setDesignerConfig({
          enableProducts: data.enable_products,
          enableSchematic: data.enable_schematic,
          defaultMode: data.default_mode,
          loaded: true,
        });
      } else {
        setDesignerConfig((prev) => ({ ...prev, loaded: true }));
      }
    };
    loadDesignerConfig();
  }, []);

  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (id && id !== loadedRef.current) {
      loadedRef.current = id;
      const doLoad = async () => {
        if (pendingSavePromise) {
          try { await pendingSavePromise; } catch { /* save failed, load anyway */ }
        }
        const result = await loadProjectById(id);
        if (result) {
          project.loadState(result.selected, result.meta, result.floorsOrFp);
        }
        setProjectLoaded(true);
        projectLoadedRef.current = true;
      };
      doLoad();
    }
  }, [id]);

  const hasProductPlacements = useMemo(() => {
    if (!project.floors || !Array.isArray(project.floors)) return false;
    return project.floors.some((floor) =>
      floor?.rooms?.some((room) => room?.placements && room.placements.length > 0)
    );
  }, [project.floors]);

  const hasSchematicElements = designElements.length > 0;

  const effectiveEnableProducts = designerConfig.enableProducts || hasProductPlacements;
  const effectiveEnableSchematic = designerConfig.enableSchematic || hasSchematicElements;

  const initialModeSetRef = useRef(false);
  useEffect(() => {
    if (!designerConfig.loaded || !projectLoaded || initialModeSetRef.current) return;
    initialModeSetRef.current = true;

    if (hasSchematicElements && !hasProductPlacements) {
      setDesignMode('schematic');
      setRightTab('schematic');
    } else if (hasProductPlacements && !hasSchematicElements) {
      setDesignMode('catalog');
      setRightTab('catalog');
    } else {
      const defaultMode = designerConfig.defaultMode === 'schematic' ? 'schematic' : 'catalog';
      if (defaultMode === 'schematic' && effectiveEnableSchematic) {
        setDesignMode('schematic');
        setRightTab('schematic');
      } else if (effectiveEnableProducts) {
        setDesignMode('catalog');
        setRightTab('catalog');
      } else if (effectiveEnableSchematic) {
        setDesignMode('schematic');
        setRightTab('schematic');
      }
    }
  }, [designerConfig.loaded, projectLoaded, hasSchematicElements, hasProductPlacements, designerConfig.defaultMode, effectiveEnableProducts, effectiveEnableSchematic]);

  const latestRef = useRef({ selected: project.selected, floors: project.floors });
  latestRef.current = { selected: project.selected, floors: project.floors };
  const savingRef = useRef(false);

  const saveToDb = useCallback(async () => {
    if (!id || savingRef.current || !projectLoadedRef.current) return;
    savingRef.current = true;
    const { selected: sel, floors: fls } = latestRef.current;

    try {
      await supabase.from('projects').update({
        floorplan_url: JSON.stringify(fls),
        selection_data: sel,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    } finally {
      savingRef.current = false;
    }
  }, [id]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Projekty', href: '/projekty' },
        { label: project.meta.project || '...', href: id ? `/projekty/${id}` : undefined },
        { label: 'Návrh' },
      ],
      fullBleed: true,
      hideHeader: true,
    });
    return () => {
      setConfig({ breadcrumbs: [], fullBleed: false, hideHeader: false });
    };
  }, [setConfig, project.meta.project, id]);

  const [designBuilderState, setDesignBuilderState] = useState({ frameSize: 1, modules: ['Zasuvka'] });
  const [designColor, setDesignColor] = useState<{ name: string; hex: string } | null>(null);
  const [regularProductColor, setRegularProductColor] = useState<{ name: string; hex: string } | null>(null);
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
  const [showGrid, setShowGrid] = useState(false);
  const [dimTempPoints, setDimTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [isPlacingDistributor, setIsPlacingDistributor] = useState(false);
  const [showHeatingPipes, setShowHeatingPipes] = useState(true);
  const { pinSize, setPinSize, schematicSymbolScale, setSchematicSymbolScale } = project;
  const [zoom, setZoom] = useState(1);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const [placingProductId, setPlacingProductId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('catalog');

  const handleDesignModeChange = useCallback((mode: DesignMode) => {
    setDesignMode(mode);
    setPlacingProductId(null);
    setPlacingElementTypeId(null);
    setToolMode('pointer');
    if (mode === 'catalog') {
      setRightTab('catalog');
    } else {
      setRightTab('schematic');
    }
  }, []);

  const handleStartPlacingElement = useCallback((typeId: string) => {
    if (typeId !== placingElementTypeId) {
      setPlacementDefaults({ circuitId: null, mountingHeight: null });
    }
    setPlacingElementTypeId(typeId);
    setPlacingProductId(null);
    setToolMode('place');
    setActiveElementId(null);
    setSelectedElementIds(new Set());
  }, [placingElementTypeId]);

  const handleElementSelect = useCallback((elementId: string, shiftKey: boolean) => {
    if (shiftKey) {
      setSelectedElementIds((prev) => {
        const next = new Set(prev);
        if (next.has(elementId)) {
          next.delete(elementId);
        } else {
          next.add(elementId);
        }
        return next;
      });
    } else {
      setSelectedElementIds(new Set());
      setActiveElementId(elementId);
    }
  }, []);

  const currentFloorGroups = useMemo(() => {
    if (!activeFloorId) return [];
    return getGroupsByFloor(activeFloorId);
  }, [activeFloorId, getGroupsByFloor]);

  const currentFloorElements = useMemo(() => {
    if (!activeFloorId) return [];
    return getElementsByFloor(activeFloorId);
  }, [activeFloorId, getElementsByFloor]);

  const handleCreateMountingGroup = useCallback(
    async (params: { orientation: MountingOrientation; label?: string }) => {
      if (!activeFloorId || selectedElementIds.size < 2) return;

      const selectedElements = currentFloorElements.filter((el) => selectedElementIds.has(el.id));
      if (selectedElements.length < 2) return;

      const avgX = selectedElements.reduce((sum, el) => sum + el.x, 0) / selectedElements.length;
      const avgY = selectedElements.reduce((sum, el) => sum + el.y, 0) / selectedElements.length;
      const roomId = selectedElements[0]?.room_id ?? undefined;

      const result = await createGroupFromElements({
        elementIds: Array.from(selectedElementIds),
        floorId: activeFloorId,
        roomId,
        x: avgX,
        y: avgY,
        orientation: params.orientation,
        label: params.label,
      });

      if (result.error) {
        toast(`Chyba: ${result.error}`);
      } else {
        toast('Vícenásobný rámeček vytvořen');
        setSelectedElementIds(new Set());
        setShowMountingGroupModal(false);
      }
    },
    [activeFloorId, selectedElementIds, currentFloorElements, createGroupFromElements, toast]
  );

  const handleDisbandGroup = useCallback(
    async (groupId: string) => {
      const result = await disbandGroup(groupId);
      if (result.error) {
        toast(`Chyba: ${result.error}`);
      } else {
        toast('Rámeček byl zrušen');
        setActiveMountingGroupId(null);
      }
    },
    [disbandGroup, toast]
  );
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [draggingObject, setDraggingObject] = useState<ObjectDragState | null>(null);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Record<CircuitType, boolean>>({
    electric: true, water: true, heating: true, recuperation: true,
  });
  const [hiddenCircuitIds, setHiddenCircuitIds] = useState<Set<string>>(new Set());
  const [doorWidthM, setDoorWidthM] = useState(0.8);
  const [isPlacingDoor, setIsPlacingDoor] = useState(false);
  const [draggingDoor, setDraggingDoor] = useState<{ roomId: string; doorId: string; x: number; y: number } | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<{ roomId: string; startX: number; startY: number; origOffX: number; origOffY: number } | null>(null);
  const [showFvDesigner, setShowFvDesigner] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [showQuickVersionSave, setShowQuickVersionSave] = useState(false);
  const [quickVersionNote, setQuickVersionNote] = useState('');
  const [showVersionPicker, setShowVersionPicker] = useState(true);
  const { versions, loading: versionsLoading, fetched: versionsFetched, createVersion, updateVersion } = useDesignVersions(id);

  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [saveVersionNote, setSaveVersionNote] = useState('');
  const initialDataRef = useRef<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canvasAspectRatio, setCanvasAspectRatio] = useState(1);
  const [baseImageSize, setBaseImageSize] = useState<{ w: number; h: number } | null>(null);
  const [snappedMousePos, setSnappedMousePos] = useState<{ x: number; y: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const { selected, floors } = project;
  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0];

  useEffect(() => {
    if (activeFloor && activeFloor.id !== activeFloorId) {
      setActiveFloorId(activeFloor.id);
    }
  }, [activeFloor, activeFloorId]);

  useEffect(() => {
    if (activePinId && toolMode === 'place') {
      const timer = setTimeout(() => setActivePinId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [activePinId, toolMode]);

  useEffect(() => {
    if (highlightProductId) {
      const timer = setTimeout(() => setHighlightProductId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightProductId]);

  useEffect(() => {
    if (placingProductId) setToolMode('place');
  }, [placingProductId]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth && img.naturalHeight) {
      setCanvasAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  }, [activeFloor?.floorplanImg]);

  useEffect(() => {
    if (canvasAspectRatio === 1) return;
    if (!activeFloor?.scale) return;
    if (activeFloor.scale.aspectRatio) return;
    project.setFloorScale(activeFloor.id, { ...activeFloor.scale, aspectRatio: canvasAspectRatio });
  }, [canvasAspectRatio, activeFloor?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (placingProductId) { setPlacingProductId(null); setToolMode('pointer'); }
        if (placingElementTypeId) { setPlacingElementTypeId(null); setToolMode('pointer'); setPlacementDefaults({ circuitId: null, mountingHeight: null }); }
        if (activeObjectId) setActiveObjectId(null);
        if (activeElementId) setActiveElementId(null);
        if (selectedElementIds.size > 0) setSelectedElementIds(new Set());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(z => Math.min(4, +(z * 1.25).toFixed(2)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom(z => Math.max(0.25, +(z / 1.25).toFixed(2)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
      if (selectedElementIds.size >= 2 && e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowMountingGroupModal(true);
      }
      if (activeObjectId && activeFloor) {
        const obj = (activeFloor.objects ?? []).find(o => o.id === activeObjectId);
        if (obj) {
          if (e.key === 'r' || e.key === 'R') {
            project.updateFloorObject(obj.floorId, obj.id, { rotation: (obj.rotation + 90) % 360 });
          }
          if (e.key === 'f' || e.key === 'F') {
            project.updateFloorObject(obj.floorId, obj.id, { flipX: !obj.flipX });
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            project.removeFloorObject(obj.floorId, obj.id);
            setActiveObjectId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack, placingProductId, activeObjectId, activeFloor, project, selectedElementIds]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const container = scrollContainerRef.current;
      if (!container) return;

      const oldZoom = zoom;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(4, Math.max(0.25, +(oldZoom * factor).toFixed(2)));

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + container.scrollLeft;
      const mouseY = e.clientY - rect.top + container.scrollTop;
      const ratio = newZoom / oldZoom;

      setZoom(newZoom);
      requestAnimationFrame(() => {
        container.scrollLeft = mouseX * ratio - (e.clientX - rect.left);
        container.scrollTop = mouseY * ratio - (e.clientY - rect.top);
      });
    }
  }, [zoom]);

  const allFloorPins = listAllPins(selected, products, activeFloor?.id);
  const rooms = activeFloor?.rooms ?? [];

  const roomLighting = useMemo(() => {
    const result: Record<string, { required: number; current: number; deficit: number }> = {};
    if (!activeFloor?.scale) return result;
    for (const room of rooms) {
      if (!room.requiredLux || room.requiredLux <= 0) continue;
      const areaM2 = polygonAreaM2(room.points, activeFloor.scale);
      const totalRequired = calculateRequiredLumens(room.requiredLux, areaM2);
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
          if (existing) existing.count++;
          else lightMap.set(pin.product.id, { productName: pin.product.name, lumens: pin.product.lumens, count: 1 });
        }
      }
      if (total > 0 || room.requiredLux) {
        result[room.id] = { currentLumens: total, lightsInRoom: Array.from(lightMap.values()) };
      }
    }
    return result;
  }, [rooms, allFloorPins]);

  const placingProduct = placingProductId ? products.find((p) => p.id === placingProductId) : null;
  const isDesignSeries = placingProduct?.kind === 'design_series';
  const floorPins = allFloorPins.filter((pin) => {
    const trade = (pin.product.trade || 'electric') as CircuitType;
    return visibleLayers[trade];
  });
  const cables = activeFloor?.cables ?? [];
  const circuits = activeFloor?.circuits ?? [];
  const dimensions = activeFloor?.dimensions ?? [];

  const floorplanObjects = activeFloor?.objects ?? [];

  const visibleFloorObjects = useMemo(() => {
    if (!activeFloor) return [];
    return floorplanObjects.filter(o => {
      const prod = products.find(p => p.id === o.productId);
      const trade = (prod?.trade || 'electric') as CircuitType;
      return visibleLayers[trade];
    });
  }, [floorplanObjects, activeFloor, products, visibleLayers]);

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
    if (!activeFloor?.floorplanImg || dragging) return;
    const pt = getClickCoords(e);
    if (!pt) return;

    if (toolMode === 'scale') {
      if (scaleStep === 'point1') { setScaleTempPoints([pt]); setScaleStep('point2'); }
      else if (scaleStep === 'point2') { setScaleTempPoints((prev) => [...prev, pt]); setScaleStep('input'); }
      return;
    }
    if (toolMode === 'room' && isPlacingDistributor && activeFloor) {
      project.addDistributor(activeFloor.id, { id: crypto.randomUUID(), x: pt.x, y: pt.y, name: `Rozdělovač ${(activeFloor.distributors ?? []).length + 1}` });
      setIsPlacingDistributor(false);
      return;
    }
    if (toolMode === 'room' && isDrawingRoom) { const s = snappedMousePos ?? pt; setRoomDrawingPoints((prev) => [...prev, s]); return; }
    if (toolMode === 'cable' && isDrawingCable) { const s = snappedMousePos ?? pt; setCableDrawingPoints((prev) => [...prev, s]); return; }
    if (toolMode === 'dimension') {
      if (dimTempPoints.length === 0) setDimTempPoints([pt]);
      else if (dimTempPoints.length === 1 && activeFloor) {
        project.addDimension(activeFloor.id, { id: crypto.randomUUID(), p1: dimTempPoints[0], p2: pt });
        setDimTempPoints([]);
      }
      return;
    }
    if (toolMode === 'room' && isPlacingDoor && activeFloor && rooms.length > 0) {
      const hit = findClosestWall(pt, rooms);
      if (hit) {
        project.addRoomDoor(activeFloor.id, hit.roomId, {
          id: crypto.randomUUID(),
          wallIndex: hit.wallIndex,
          position: hit.position,
          widthM: doorWidthM,
        });
      }
      return;
    }

    if (toolMode === 'place' && placingElementTypeId && designMode === 'schematic') {
      handlePlaceSchematicElement(pt.x, pt.y);
      return;
    }

    if (toolMode === 'place' && placingProductId) {
      const sym = placingProduct?.floorplan_symbol as FloorplanSymbol | null;
      if (sym && sym.type !== 'pin' && activeFloor) {
        const obj = createDefaultObject(placingProductId, activeFloor.id, pt.x, pt.y, sym);
        const roomId = findRoomAtPoint(pt, rooms);
        if (roomId) obj.roomId = roomId;
        project.addFloorObject(activeFloor.id, obj);
        setActiveObjectId(obj.id);
        setActivePinId(null);
        setToolMode('pointer');
        setPlacingProductId(null);
      } else {
        const isLight = placingProduct ? placingProduct.lumens > 0 : false;
        const otherPins = floorPins
          .filter(p => !isLight || p.product.lumens > 0)
          .map(p => ({ x: p.placement.x, y: p.placement.y }));
        const snap = computeSnap(pt, {
          wallThreshold: 0.03,
          alignThreshold: isLight ? 0.012 : 0.008,
          rooms,
          otherPins,
          lightMode: isLight,
          scale: activeFloor?.scale,
        });
        const sp = snap.snapped;
        const placement: Placement = { id: crypto.randomUUID(), x: sp.x, y: sp.y, note: '', ts: Date.now(), floorId: activeFloor.id };
        if (isDesignSeries) {
          placement.config = { frameSize: designBuilderState.frameSize, modules: [...designBuilderState.modules], ...(designColor ? { colorName: designColor.name, colorHex: designColor.hex } : {}) };
        } else if (regularProductColor) {
          placement.colorName = regularProductColor.name;
          placement.colorHex = regularProductColor.hex;
        }
        const roomId = findRoomAtPoint(sp, rooms);
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
        setActiveObjectId(null);

        if (activeFloor) {
          const newDims = createDimensionsFromSnap(sp, rooms, activeFloor.scale);
          for (const dim of newDims) {
            project.addDimension(activeFloor.id, { id: crypto.randomUUID(), p1: dim.p1, p2: dim.p2 });
          }
        }
      }
      return;
    }

    setActivePinId(null);
    setActiveObjectId(null);
  };

  const handlePinPointerDown = (e: React.PointerEvent, pin: PinData) => {
    if (toolMode === 'cable' && isDrawingCable) {
      e.preventDefault(); e.stopPropagation();
      setCableDrawingPoints((prev) => [...prev, { x: pin.placement.x, y: pin.placement.y }]);
      if (activeCircuitId) project.updatePlacementCircuit(pin.productId, pin.placement.id, activeCircuitId);
      return;
    }
    if (toolMode !== 'pointer') { e.stopPropagation(); setActivePinId(pin.placement.id); setActiveObjectId(null); return; }
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ productId: pin.productId, placementId: pin.placement.id, x: pin.placement.x, y: pin.placement.y });
    setActivePinId(pin.placement.id);
    setActiveObjectId(null);
  };

  const handlePinPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const dragProduct = products.find(p => p.id === dragging.productId);
    const isLight = dragProduct ? dragProduct.lumens > 0 : false;
    const otherPins = floorPins
      .filter(p => p.placement.id !== dragging.placementId)
      .filter(p => !isLight || p.product.lumens > 0)
      .map(p => ({ x: p.placement.x, y: p.placement.y }));

    const snap = computeSnap({ x: rawX, y: rawY }, {
      wallThreshold: 0.03,
      alignThreshold: isLight ? 0.012 : 0.008,
      rooms,
      otherPins,
      lightMode: isLight,
      scale: activeFloor?.scale,
    });

    setDragging(prev => prev ? { ...prev, x: snap.snapped.x, y: snap.snapped.y } : null);
    setSnapGuides(snap.guides);
  };

  const handlePinPointerUp = () => {
    if (!dragging) return;
    project.updatePlacementPosition(dragging.productId, dragging.placementId, dragging.x, dragging.y);
    project.updatePlacementRoom(dragging.productId, dragging.placementId, findRoomAtPoint({ x: dragging.x, y: dragging.y }, rooms));

    if (activeFloor) {
      const newDims = createDimensionsFromSnap({ x: dragging.x, y: dragging.y }, rooms, activeFloor.scale);
      const existingDims = activeFloor.dimensions ?? [];
      for (const dim of newDims) {
        const alreadyExists = existingDims.some(d =>
          distanceBetween(d.p1, dim.p1) < 0.005 && distanceBetween(d.p2, dim.p2) < 0.005
        );
        if (!alreadyExists) {
          project.addDimension(activeFloor.id, { id: crypto.randomUUID(), p1: dim.p1, p2: dim.p2 });
        }
      }
    }

    setDragging(null);
    setSnapGuides([]);
  };

  const handleObjectPointerDown = (e: React.PointerEvent, obj: FloorplanObjectData) => {
    if (toolMode !== 'pointer') { e.stopPropagation(); setActiveObjectId(obj.id); return; }
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingObject({ objectId: obj.id, x: obj.x, y: obj.y, startX: obj.x, startY: obj.y });
  };

  const handleObjectPointerMove = (e: React.PointerEvent) => {
    if (!draggingObject) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setDraggingObject((prev) => prev ? {
      ...prev,
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    } : null);
  };

  const handleObjectPointerUp = () => {
    if (!draggingObject) return;
    const dx = Math.abs(draggingObject.x - draggingObject.startX);
    const dy = Math.abs(draggingObject.y - draggingObject.startY);
    const wasClick = dx < 0.003 && dy < 0.003;
    if (activeFloor) {
      project.updateFloorObject(activeFloor.id, draggingObject.objectId, { x: draggingObject.x, y: draggingObject.y });
    }
    if (wasClick) {
      setActiveObjectId(prev => prev === draggingObject.objectId ? null : draggingObject.objectId);
    } else {
      setActiveObjectId(draggingObject.objectId);
    }
    setActivePinId(null);
    setDraggingObject(null);
  };

  const handleElementPointerMove = (e: React.PointerEvent) => {
    if (!draggingElement) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const snap = computeSnap({ x: rawX, y: rawY }, {
      wallThreshold: 0.025,
      alignThreshold: 0.01,
      rooms,
      otherPins: currentFloorElements.filter(el => el.id !== draggingElement.id).map(el => ({ x: el.x, y: el.y })),
      lightMode: false,
      scale: activeFloor?.scale,
    });
    setDraggingElement(prev => prev ? { ...prev, x: snap.snapped.x, y: snap.snapped.y } : null);
    setSnapGuides(snap.guides);
  };

  const handleElementPointerUp = async () => {
    if (!draggingElement) return;
    const roomId = findRoomAtPoint({ x: draggingElement.x, y: draggingElement.y }, rooms);
    const wallAngle = getNearestWallAngle({ x: draggingElement.x, y: draggingElement.y }, rooms);
    await updateDesignElement(draggingElement.id, {
      x: draggingElement.x,
      y: draggingElement.y,
      room_id: roomId ?? null,
      rotation: wallAngle,
    });
    setDraggingElement(null);
    setSnapGuides([]);
  };

  const handleDoorPointerDown = (e: React.PointerEvent, roomId: string, doorId: string, x: number, y: number) => {
    if (toolMode !== 'pointer' && toolMode !== 'room') return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingDoor({ roomId, doorId, x, y });
  };

  const handleDoorPointerMove = (e: React.PointerEvent) => {
    if (!draggingDoor) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setDraggingDoor((prev) => prev ? {
      ...prev,
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    } : null);
  };

  const handleDoorPointerUp = () => {
    if (!draggingDoor || !activeFloor) { setDraggingDoor(null); return; }
    const room = rooms.find((r) => r.id === draggingDoor.roomId);
    if (!room) { setDraggingDoor(null); return; }
    const pt = { x: draggingDoor.x, y: draggingDoor.y };
    let bestWall = 0;
    let bestT = 0.5;
    let bestDist = Infinity;
    for (let i = 0; i < room.points.length; i++) {
      const a = room.points[i];
      const b = room.points[(i + 1) % room.points.length];
      const r = closestPointOnSegment(pt, a, b);
      if (r.dist < bestDist) { bestDist = r.dist; bestWall = i; bestT = r.t; }
    }
    project.updateRoomDoor(activeFloor.id, draggingDoor.roomId, draggingDoor.doorId, { wallIndex: bestWall, position: bestT });
    setDraggingDoor(null);
  };

  const handleLabelPointerDown = (e: React.PointerEvent, room: Room) => {
    if (toolMode !== 'pointer') return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    setDraggingLabel({ roomId: room.id, startX: sx, startY: sy, origOffX: room.labelOffsetX ?? 0, origOffY: room.labelOffsetY ?? 0 });
  };

  const handleLabelPointerMove = (e: React.PointerEvent) => {
    if (!draggingLabel) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    setDraggingLabel((prev) => prev ? { ...prev, origOffX: prev.origOffX + (cx - prev.startX), origOffY: prev.origOffY + (cy - prev.startY), startX: cx, startY: cy } : null);
  };

  const handleLabelPointerUp = () => {
    if (!draggingLabel || !activeFloor) { setDraggingLabel(null); return; }
    project.updateRoomLabel(activeFloor.id, draggingLabel.roomId, { labelOffsetX: draggingLabel.origOffX, labelOffsetY: draggingLabel.origOffY });
    setDraggingLabel(null);
  };

  const handleToolModeChange = (mode: ToolMode | 'fv') => {
    if (mode === 'fv') {
      setShowFvDesigner(true);
      return;
    }
    setToolMode(mode);
    setScaleStep('idle'); setScaleTempPoints([]);
    setIsDrawingRoom(false); setRoomDrawingPoints([]);
    setIsPlacingDistributor(false);
    setIsPlacingDoor(false);
    setIsDrawingCable(false); setCableDrawingPoints([]);
    setDimTempPoints([]);
    if (mode !== 'place') setPlacingProductId(null);
  };

  const handleStartScale = () => { setToolMode('scale'); setScaleStep('point1'); setScaleTempPoints([]); };
  const handleSetScaleDistance = (meters: number) => {
    if (scaleTempPoints.length >= 2 && activeFloor) {
      const ar = imgRef.current ? imgRef.current.naturalWidth / imgRef.current.naturalHeight : canvasAspectRatio;
      project.setFloorScale(activeFloor.id, { p1: scaleTempPoints[0], p2: scaleTempPoints[1], realDistanceM: meters, aspectRatio: ar });
    }
    setScaleStep('idle'); setScaleTempPoints([]); setToolMode('pointer');
  };
  const handleClearScale = () => { if (activeFloor) project.setFloorScale(activeFloor.id, undefined); };
  const handleCancelScale = () => { setScaleStep('idle'); setScaleTempPoints([]); setToolMode('pointer'); };

  const SNAP_STEP_DEG = 15;

  const snapToAngle = useCallback((from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } => {
    const ar = canvasAspectRatio;
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
  }, [canvasAspectRatio]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const raw = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };

    if (toolMode === 'place' && placingProductId) {
      const isLight = placingProduct ? placingProduct.lumens > 0 : false;
      const otherPins = floorPins
        .filter(p => !isLight || p.product.lumens > 0)
        .map(p => ({ x: p.placement.x, y: p.placement.y }));
      const snap = computeSnap(raw, {
        wallThreshold: 0.03,
        alignThreshold: isLight ? 0.012 : 0.008,
        rooms,
        otherPins,
        lightMode: isLight,
        scale: activeFloor?.scale,
      });
      setSnapGuides(snap.guides);
      setSnappedMousePos(snap.snapped);
      return;
    }

    if (!isDrawingCable && !isDrawingRoom) { setSnappedMousePos(null); setSnapGuides([]); return; }

    const drawnPoints = isDrawingCable ? cableDrawingPoints : roomDrawingPoints;
    if (drawnPoints.length > 0) {
      const last = drawnPoints[drawnPoints.length - 1];
      setSnappedMousePos(snapToAngle(last, raw));
    } else {
      setSnappedMousePos(raw);
    }
  }, [isDrawingCable, isDrawingRoom, cableDrawingPoints, roomDrawingPoints, snapToAngle, toolMode, placingProductId, placingProduct, floorPins, rooms, activeFloor]);

  const handleStartRoomDraw = () => { setToolMode('room'); setIsDrawingRoom(true); setRoomDrawingPoints([]); setIsPlacingDoor(false); setIsPlacingDistributor(false); };
  const handleFinishRoomDraw = (name: string) => {
    if (roomDrawingPoints.length >= 3 && activeFloor) project.addRoom(activeFloor.id, { id: crypto.randomUUID(), name, points: [...roomDrawingPoints] });
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

  const handleStartPlacing = useCallback((productId: string, color?: { name: string; hex: string }) => {
    setPlacingProductId(productId);
    setPlacingElementTypeId(null);
    setToolMode('place');
    const prod = products.find(p => p.id === productId);
    if (prod?.kind !== 'design_series') {
      if (color) {
        setRegularProductColor(color);
      } else {
        const colors = productColors.filter(c => c.product_id === productId);
        if (colors.length > 0) {
          setRegularProductColor({ name: colors[0].name, hex: colors[0].hex_code });
        } else {
          setRegularProductColor(null);
        }
      }
    }
  }, [products, productColors]);

  const handlePlaceSchematicElement = useCallback(async (x: number, y: number) => {
    if (!placingElementTypeId || !activeFloor || !id) return;
    const roomId = findRoomAtPoint({ x, y }, rooms) ?? null;
    const wallAngle = getNearestWallAngle({ x, y }, rooms);
    const result = await addDesignElement({
      project_id: id,
      element_type_id: placingElementTypeId,
      floor_id: activeFloor.id,
      room_id: roomId,
      x,
      y,
      rotation: wallAngle,
      label: null,
      note: null,
      circuit_id: placementDefaults.circuitId || activeCircuitId,
      mounting_height: placementDefaults.mountingHeight,
      quantity: 1,
      params: {},
      sort_order: currentFloorElements.length,
    });
    if (result.error) {
      console.error('Failed to add design element:', result.error);
      toast(`Chyba: ${result.error}`);
    }
  }, [placingElementTypeId, activeFloor, id, rooms, activeCircuitId, placementDefaults, currentFloorElements.length, addDesignElement, toast]);

  const assignProductToElement = useCallback(async (elementId: string, productId: string | null) => {
    if (!productId) {
      return;
    }
    await assignProduct({
      scope: 'element',
      scopeRefId: elementId,
      elementTypeId: null,
      productId,
      assignmentType: 'manual',
    });
  }, [assignProduct]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFloor) return;
    const reader = new FileReader();
    reader.onload = () => { project.setFloorImage(activeFloor.id, reader.result as string); e.target.value = ''; };
    reader.readAsDataURL(file);
  };

  const handleFrameSize = (n: number) => {
    const clamped = Math.max(1, Math.min(5, n));
    const mods = [...designBuilderState.modules];
    while (mods.length < clamped) mods.push(designModules[0]?.name ?? 'Zasuvka');
    setDesignBuilderState({ frameSize: clamped, modules: mods.slice(0, clamped) });
  };
  const handleSlotChange = (idx: number, val: string) => {
    const mods = [...designBuilderState.modules];
    mods[idx] = val;
    setDesignBuilderState({ ...designBuilderState, modules: mods });
  };
  const applyPreset = (preset: { frame_size: number; modules: unknown }) => {
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
    if (toolMode === 'room' && (isDrawingRoom || isPlacingDistributor || isPlacingDoor)) return 'crosshair';
    if (toolMode === 'cable' && isDrawingCable) return 'crosshair';
    if (toolMode === 'dimension') return 'crosshair';
    if (toolMode === 'place' && placingProductId) return 'crosshair';
    return 'default';
  };

  const handleHighlightProduct = (productId: string) => {
    setHighlightProductId(productId);
  };

  const handleRemoveAll = (productId: string) => {
    project.removeAllPlacements(productId);
    toast('Všechny instance smazány');
  };

  const handleSaveVersion = useCallback(async (note: string) => {
    await saveToDb();
    const { selected: sel, floors: fls } = latestRef.current;
    const newVersion = await createVersion({
      note,
      selectionData: sel as unknown as Record<string, unknown>,
      floorplanData: fls as unknown as unknown[],
    });
    if (newVersion) {
      setActiveVersionId(newVersion.id);
    }
    initialDataRef.current = JSON.stringify({ selected: sel, floors: fls });
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    toast('Verze byla uložena');
  }, [saveToDb, createVersion, toast]);

  const handleSaveCurrentVersion = useCallback(async () => {
    await saveToDb();
    const { selected: sel, floors: fls } = latestRef.current;

    if (activeVersionId) {
      await updateVersion(activeVersionId, {
        selectionData: sel as unknown as Record<string, unknown>,
        floorplanData: fls as unknown as unknown[],
      });
      toast('Verze byla aktualizována');
    } else {
      const newVersion = await createVersion({
        note: `Verze ${versions.length + 1}`,
        selectionData: sel as unknown as Record<string, unknown>,
        floorplanData: fls as unknown as unknown[],
      });
      if (newVersion) {
        setActiveVersionId(newVersion.id);
      }
      toast('Nová verze byla uložena');
    }

    initialDataRef.current = JSON.stringify({ selected: sel, floors: fls });
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
  }, [saveToDb, activeVersionId, updateVersion, createVersion, versions.length, toast]);

  const handleRestoreVersion = useCallback((version: DesignVersion) => {
    project.restoreFromSnapshot(
      version.selection_data,
      version.floorplan_data,
    );
    setActiveVersionId(version.id);
    initialDataRef.current = JSON.stringify({ selected: version.selection_data, floors: version.floorplan_data });
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
  }, [project]);

  const handleStartNewConfig = useCallback(() => {
    initialDataRef.current = JSON.stringify({ selected: project.selected, floors: project.floors });
    setActiveVersionId(null);
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    setShowVersionPicker(false);
  }, [project.selected, project.floors]);

  const activeVersion = useMemo(() => {
    return versions.find(v => v.id === activeVersionId) ?? null;
  }, [versions, activeVersionId]);

  useEffect(() => {
    if (!projectLoaded) return;
    if (!initialDataRef.current) return;
    const currentData = JSON.stringify({ selected: project.selected, floors: project.floors });
    const changed = currentData !== initialDataRef.current;
    console.log('[DesignEditor] Change detection:', { changed, hasInitial: !!initialDataRef.current, projectLoaded, refValue: hasUnsavedChangesRef.current });
    if (changed && !hasUnsavedChangesRef.current) {
      console.log('[DesignEditor] Setting hasUnsavedChanges to TRUE');
      setHasUnsavedChanges(true);
      hasUnsavedChangesRef.current = true;
    }
  }, [project.selected, project.floors, projectLoaded]);

  const handleNavigateAway = useCallback((callback: () => void) => {
    console.log('[DesignEditor] handleNavigateAway called, hasUnsavedChangesRef:', hasUnsavedChangesRef.current, 'hasUnsavedChanges state:', hasUnsavedChanges);
    if (hasUnsavedChangesRef.current) {
      console.log('[DesignEditor] Showing exit confirm modal');
      setPendingNavigation(() => callback);
      setShowExitConfirm(true);
    } else {
      console.log('[DesignEditor] No unsaved changes, navigating directly');
      callback();
    }
  }, [hasUnsavedChanges]);

  const handleSaveAndExit = useCallback(async (mode: 'overwrite' | 'new') => {
    await saveToDb();
    const { selected: sel, floors: fls } = latestRef.current;

    if (mode === 'overwrite' && activeVersionId) {
      await updateVersion(activeVersionId, {
        selectionData: sel as unknown as Record<string, unknown>,
        floorplanData: fls as unknown as unknown[],
      });
      toast('Verze byla aktualizována');
    } else {
      const newVersion = await createVersion({
        note: saveVersionNote || `Verze ${versions.length + 1}`,
        selectionData: sel as unknown as Record<string, unknown>,
        floorplanData: fls as unknown as unknown[],
      });
      if (newVersion) {
        setActiveVersionId(newVersion.id);
        toast('Nová verze byla uložena');
      }
    }

    initialDataRef.current = JSON.stringify({ selected: sel, floors: fls });
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    setShowExitConfirm(false);
    setSaveVersionNote('');

    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [saveToDb, activeVersionId, updateVersion, createVersion, versions.length, saveVersionNote, pendingNavigation, toast]);

  const handleDiscardAndExit = useCallback(() => {
    setShowExitConfirm(false);
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (catalogLoading || !projectLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Načítám editor...</p>
        </div>
      </div>
    );
  }

  const rightPanelToolContent = () => {
    if (toolMode === 'scale') return <ScaleCalibrator scale={activeFloor?.scale} scaleStep={scaleStep} onStart={handleStartScale} onSetDistance={handleSetScaleDistance} onClear={handleClearScale} onCancel={handleCancelScale} />;
    if (toolMode === 'room') {
      const allDoors = rooms.flatMap((r) => (r.doors ?? []).map((d) => ({ door: d, room: r })));
      return (
        <>
          <RoomEditor rooms={rooms} drawingPoints={roomDrawingPoints} isDrawing={isDrawingRoom} scale={activeFloor?.scale} onStartDraw={handleStartRoomDraw} onFinishDraw={handleFinishRoomDraw} onCancelDraw={handleCancelRoomDraw} onRemoveRoom={(roomId) => { if (activeFloor) project.removeRoom(activeFloor.id, roomId); }} onRenameRoom={(roomId, name) => { if (activeFloor) project.renameRoom(activeFloor.id, roomId, name); }} onUpdateBathroomLayout={(roomId, layout) => { if (activeFloor) project.updateRoomBathroomLayout(activeFloor.id, roomId, layout); }} onUpdateRoomLabel={(roomId, updates) => { if (activeFloor) project.updateRoomLabel(activeFloor.id, roomId, updates); }} />
          <div className="border-t border-white/10 p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <DoorOpen className="w-3.5 h-3.5" />
              Dveře {allDoors.length > 0 && <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{allDoors.length}</span>}
            </div>
            {!isPlacingDoor ? (
              <button
                onClick={() => { setIsPlacingDoor(true); setIsDrawingRoom(false); setIsPlacingDistributor(false); }}
                className="w-full bg-amber-500/10 text-amber-400 border border-amber-200 py-2 rounded-xl font-extrabold text-xs hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3" /> Umístit dveře
              </button>
            ) : (
              <div>
                <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-2.5 mb-3 text-xs text-amber-400">
                  Klikni na stěnu místnosti pro umístění dveří.
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-[11px] font-extrabold text-slate-400">Šířka:</label>
                  <div className="flex items-center gap-1">
                    {[0.6, 0.7, 0.8, 0.9, 1.0].map((w) => (
                      <button
                        key={w}
                        onClick={() => setDoorWidthM(w)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition ${
                          doorWidthM === w ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                        }`}
                      >
                        {w}m
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setIsPlacingDoor(false)}
                  className="w-full bg-white/[0.06] text-slate-400 py-1.5 rounded-xl font-extrabold text-xs hover:bg-white/[0.08] transition"
                >
                  Hotovo
                </button>
              </div>
            )}
            {allDoors.length > 0 && (
              <div className="space-y-1 mt-3">
                {allDoors.map(({ door, room }) => (
                  <div key={door.id} className="flex items-center gap-2 text-[11px] bg-navy-800/60 rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
                    <DoorOpen className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="font-extrabold text-slate-300 truncate flex-1">{room.name}</span>
                    <span className="text-slate-400">{door.widthM}m</span>
                    <button
                      onClick={() => { if (activeFloor) project.removeRoomDoor(activeFloor.id, room.id, door.id); }}
                      className="p-0.5 rounded text-slate-400 hover:text-red-500 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DistributorEditor distributors={activeFloor?.distributors ?? []} isPlacing={isPlacingDistributor} onStartPlace={() => { setIsPlacingDistributor(true); setIsPlacingDoor(false); setIsDrawingRoom(false); }} onCancelPlace={() => setIsPlacingDistributor(false)} onRemove={(distId) => { if (activeFloor) project.removeDistributor(activeFloor.id, distId); }} />
        </>
      );
    }
    if (toolMode === 'heating') return <HeatingSection rooms={rooms} scale={activeFloor?.scale} heatingSystems={heatingSystems} onUpdateRoomHeating={(roomId, sysId, cfg) => { if (activeFloor) project.updateRoomHeating(activeFloor.id, roomId, sysId, cfg); }} onUpdateRoomHeatingConfig={(roomId, key, val) => { if (activeFloor) project.updateRoomHeatingConfig(activeFloor.id, roomId, key, val); }} onAddRoomDoor={(roomId, door) => { if (activeFloor) project.addRoomDoor(activeFloor.id, roomId, door); }} onRemoveRoomDoor={(roomId, doorId) => { if (activeFloor) project.removeRoomDoor(activeFloor.id, roomId, doorId); }} />;
    if (toolMode === 'lighting') return <LightingSection rooms={rooms} scale={activeFloor?.scale} lightingNorms={lightingNorms} roomLightingData={roomLightingData} onUpdateRoomLighting={(roomId, roomType, requiredLux) => { if (!activeFloor) return; project.setFloors(prev => prev.map(f => { if (f.id !== activeFloor.id) return f; return { ...f, rooms: (f.rooms ?? []).map(r => r.id === roomId ? { ...r, roomType, requiredLux } : r) }; })); }} />;
    if (toolMode === 'ventilation') return <VentilationSection rooms={rooms} scale={activeFloor?.scale} onUpdateRoomVentilation={(roomId, updates) => { if (activeFloor) project.updateRoomVentilation(activeFloor.id, roomId, updates); }} />;
    if (toolMode === 'cable') return <CableEditor circuits={circuits} cables={cables} scale={activeFloor?.scale} activeCircuitId={activeCircuitId} isDrawing={isDrawingCable} drawingPoints={cableDrawingPoints} materials={materials} hiddenCircuitIds={hiddenCircuitIds} onToggleCircuitVisibility={(circuitId) => { setHiddenCircuitIds(prev => { const next = new Set(prev); if (next.has(circuitId)) next.delete(circuitId); else next.add(circuitId); return next; }); }} onAddCircuit={(circuit) => { if (activeFloor) { project.addCircuit(activeFloor.id, circuit); setActiveCircuitId(circuit.id); } }} onRemoveCircuit={(circuitId) => { if (activeFloor) project.removeCircuit(activeFloor.id, circuitId); }} onUpdateCircuit={(circuitId, updates) => { if (activeFloor) project.updateCircuit(activeFloor.id, circuitId, updates); }} onSelectCircuit={setActiveCircuitId} onStartDraw={handleStartCableDraw} onFinishCable={handleFinishCable} onCancelDraw={handleCancelCableDraw} onRemoveCable={(cableId) => { if (activeFloor) project.removeCable(activeFloor.id, cableId); }} />;
    if (toolMode === 'dimension') return (
      <div className="p-4 border-b border-white/10">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          Kóty {dimensions.length > 0 && <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">{dimensions.length}</span>}
        </div>
        {dimTempPoints.length === 1 && <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-2.5 mb-3 text-xs font-extrabold text-blue-400">Klikni na druhý bod kóty.</div>}
        {dimTempPoints.length === 0 && dimensions.length === 0 && <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-slate-500">Klikni na půdorys pro první bod kóty.</div>}
        {dimensions.length > 0 && (
          <div className="space-y-1">
            {dimensions.map((dim) => {
              const s = activeFloor?.scale;
              let label = '—';
              if (s) {
                const dx = dim.p2.x - dim.p1.x; const dy = dim.p2.y - dim.p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const calibDist = Math.sqrt((s.p2.x - s.p1.x) ** 2 + (s.p2.y - s.p1.y) ** 2);
                if (calibDist > 0) label = `${((dist / calibDist) * s.realDistanceM).toFixed(2)} m`;
              }
              return (
                <div key={dim.id} className="flex items-center justify-between text-[11px] bg-navy-800/60 rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
                  <span className="font-extrabold text-blue-400">{label}</span>
                  <button onClick={() => { if (activeFloor) project.removeDimension(activeFloor.id, dim.id); }} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition"><X className="w-3 h-3" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
    return null;
  };

  const toolContent = rightPanelToolContent();
  const fullPanelTool = toolContent && ['ventilation', 'heating', 'lighting', 'cable', 'dimension', 'scale'].includes(toolMode);
  const showTabbedPanel = !fullPanelTool;

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 bg-white/[0.06] border-b flex items-center px-3 gap-2 shrink-0  relative z-30">
        <button onClick={() => handleNavigateAway(() => navigate(id ? `/projekty/${id}` : '/projekty'))} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition px-2 py-1.5 rounded-xl hover:bg-white/[0.06] shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-extrabold hidden sm:inline">Zpět</span>
        </button>
        <div className="w-px h-7 bg-white/[0.08]" />

        <div className="flex items-center gap-1 overflow-x-auto py-1 min-w-0">
          {floors.map((floor) => (
            <div key={floor.id} className="flex items-center gap-0.5 shrink-0">
              {editingFloorId === floor.id ? (
                <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); }} className="px-2 py-1 rounded-lg border border-blue-300 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-20" />
              ) : (
                <button onClick={() => setActiveFloorId(floor.id)} className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${activeFloor?.id === floor.id ? 'bg-slate-900 text-white shadow' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'}`}>
                  {floor.name}
                  {floor.floorplanImg && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                </button>
              )}
              <button onClick={() => startRename(floor)} className="p-0.5 rounded text-slate-400 hover:text-slate-400 transition" title="Přejmenovat"><Pencil className="w-2.5 h-2.5" /></button>
              <button onClick={() => { const newId = project.duplicateFloor(floor.id); if (newId) setActiveFloorId(newId); }} className="p-0.5 rounded text-slate-400 hover:text-blue-500 transition" title="Kopírovat patro"><Copy className="w-2.5 h-2.5" /></button>
              {floors.length > 1 && (
                <button onClick={() => { if (confirm(`Smazat "${floor.name}"?`)) project.removeFloor(floor.id); }} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition" title="Smazat"><X className="w-2.5 h-2.5" /></button>
              )}
            </div>
          ))}
          <button onClick={project.addFloor} className="px-2 py-1.5 rounded-xl bg-white/[0.06] text-slate-400 hover:bg-white/[0.08] transition flex items-center gap-1 text-xs font-extrabold shrink-0">
            <Plus className="w-3 h-3" /> Patro
          </button>
        </div>

        <div className="flex-1" />

        <div className="shrink-0">
          <DesignWorkflowStepper
            currentStep={workflowStep}
            onStepClick={(step) => {
              if (step === 'assign' || step === 'quote') {
                handleNavigateAway(() => {
                  setWorkflowStep(step);
                  if (step === 'assign') {
                    navigate(`/projekty/${id}/prirazeni`);
                  } else if (step === 'quote') {
                    navigate(`/projekty/${id}?tab=quotes`);
                  }
                });
              } else {
                setWorkflowStep(step);
              }
            }}
            completedSteps={workflow.completedSteps}
            unassignedCount={workflow.unassignedCount}
            canProceed={workflow.canProceed}
          />
        </div>

        <div className="flex-1 hidden lg:block" />

        {toolMode === 'place' && placingProduct && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-200 rounded-xl px-3 py-1.5 shrink-0">
            <span className="text-xs font-extrabold text-blue-400 truncate max-w-[140px]">{placingProduct.name}</span>
            {!isDesignSeries && regularProductColor && (
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-400 bg-navy-800/60 border border-white/[0.08] px-1.5 py-0.5 rounded">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: regularProductColor.hex }} />
                {regularProductColor.name}
              </span>
            )}
            <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
              {project.qtyOf(placingProductId!) || 0}x
            </span>
            <button onClick={() => { setPlacingProductId(null); setToolMode('pointer'); }} className="bg-white/[0.06] border border-blue-200 text-blue-400 px-2 py-1 rounded-lg font-extrabold text-[11px] hover:bg-blue-500/100/10 transition flex items-center gap-1">
              <Check className="w-3 h-3" /> Hotovo
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={handleUndo} disabled={undoStack.length === 0} className={`bg-navy-800/60 border border-white/[0.08] p-2 rounded-xl transition ${undoStack.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-white/[0.04]'}`} title="Zpět (Ctrl+Z)">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} className={`bg-navy-800/60 border border-white/[0.08] p-2 rounded-xl transition ${redoStack.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-white/[0.04]'}`} title="Znovu (Ctrl+Y)">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <label className="bg-navy-800/60 border border-white/[0.08] text-slate-500 p-2 rounded-xl hover:bg-white/[0.04] transition cursor-pointer" title="Nahrát půdorys">
            <Upload className="w-3.5 h-3.5" />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={() => { if (activeFloor && confirm('Smazat půdorys?')) project.setFloorImage(activeFloor.id, null); }} className="bg-navy-800/60 border border-white/[0.08] text-slate-500 p-2 rounded-xl hover:bg-white/[0.04] transition" title="Smazat půdorys">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-6 bg-white/[0.08]" />
          <SaveVersionButton
            onSave={handleSaveCurrentVersion}
            onOpenVersions={() => setVersionDrawerOpen(true)}
            onSaveAsNewVersion={() => { setQuickVersionNote(''); setShowQuickVersionSave(true); }}
            versionCount={versions.length}
            variant="light"
          />
          <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden bg-navy-800/60 border border-white/[0.08] text-slate-500 p-2 rounded-xl hover:bg-white/[0.04] transition">
            <PanelRightOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <FloorplanToolbar
          mode={toolMode}
          onModeChange={handleToolModeChange}
          hasScale={!!activeFloor?.scale}
          hasImage={!!activeFloor?.floorplanImg}
          visibleLayers={visibleLayers}
          onToggleLayer={(type) => setVisibleLayers((prev) => ({ ...prev, [type]: !prev[type] }))}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((prev) => !prev)}
          showHeatingPipes={showHeatingPipes}
          onToggleHeatingPipes={() => setShowHeatingPipes((prev) => !prev)}
          pinSize={pinSize}
          onPinSizeChange={setPinSize}
          schematicSymbolScale={schematicSymbolScale}
          onSchematicSymbolScaleChange={setSchematicSymbolScale}
          isSchematicMode={designMode === 'schematic'}
        />

        <div ref={scrollContainerRef} className="flex-1 bg-white/[0.06] overflow-auto relative" onWheel={handleWheel}>
          {designElements.length > 0 && workflow.nextRecommendedStep && workflow.nextRecommendedStep !== 'design' && (
            <div className="px-3 pt-3">
              <WorkflowCtaBanner
                nextRecommendedStep={workflow.nextRecommendedStep}
                stepStatuses={workflow.stepStatuses}
                currentStep="design"
                contextStats={designContextStats}
                onNavigateToStep={(step) => {
                  handleNavigateAway(() => {
                    if (step === 'assign') navigate(`/projekty/${id}/prirazeni`);
                    else if (step === 'summary') navigate(`/projekty/${id}?tab=selection`);
                    else if (step === 'quote') navigate(`/projekty/${id}?tab=quotes`);
                  });
                }}
                variant="compact"
              />
            </div>
          )}
          <div className="p-3">
            {!activeFloor?.floorplanImg ? (
              <div className="bg-navy-800/60 border border-white/[0.08] rounded-3xl p-10 text-center ">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.06] mx-auto flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-lg font-extrabold text-white">Nahraj půdorys</div>
                <div className="text-sm text-slate-500 mt-1">PNG/JPG pro {activeFloor?.name ?? 'toto patro'}.</div>
                <label className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition cursor-pointer">
                  <Upload className="w-4 h-4" /> Vybrat soubor
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <div
                style={baseImageSize && zoom !== 1 ? {
                  width: baseImageSize.w * zoom + 24,
                  height: baseImageSize.h * zoom + 24,
                } : undefined}
              >
              <div
                ref={canvasRef}
                className="relative inline-block"
                style={zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: '0 0' } : undefined}
              >
                <img
                  ref={imgRef}
                  src={activeFloor.floorplanImg}
                  alt={`Půdorys ${activeFloor.name}`}
                  className="max-w-full h-auto rounded-2xl shadow border-2 border-white/10 select-none"
                  draggable={false}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => { setSnappedMousePos(null); setSnapGuides([]); }}
                  style={{ cursor: cursorForMode() }}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setCanvasAspectRatio(img.naturalWidth / img.naturalHeight);
                    }
                    requestAnimationFrame(() => {
                      setBaseImageSize({ w: img.clientWidth, h: img.clientHeight });
                    });
                  }}
                />

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
                  floorplanObjects={visibleFloorObjects}
                  products={products}
                  activeObjectId={activeObjectId}
                  draggingObject={draggingObject}
                  canvasAspectRatio={canvasAspectRatio}
                  bathroomSymbols={bathroomSymbols}
                  snappedMousePos={snappedMousePos}
                  snapGuides={snapGuides}
                />

                <div className="absolute inset-0 pointer-events-none">
                  {rooms.map((room) => {
                    if (room.labelHidden) return null;
                    const c = polygonCentroid(room.points);
                    const dl = draggingLabel?.roomId === room.id ? draggingLabel : null;
                    const ox = dl ? dl.origOffX : (room.labelOffsetX ?? 0);
                    const oy = dl ? dl.origOffY : (room.labelOffsetY ?? 0);
                    const lx = c.x + ox;
                    const ly = c.y + oy;
                    return (
                      <div
                        key={`label-${room.id}`}
                        className="absolute pointer-events-auto flex items-center justify-center select-none"
                        style={{
                          left: `${lx * 100}%`,
                          top: `${ly * 100}%`,
                          transform: 'translate(-50%,-50%)',
                          cursor: toolMode === 'pointer' ? (dl ? 'grabbing' : 'grab') : 'default',
                          zIndex: dl ? 60 : 2,
                          touchAction: 'none',
                        }}
                        onPointerDown={(e) => handleLabelPointerDown(e, room)}
                        onPointerMove={handleLabelPointerMove}
                        onPointerUp={handleLabelPointerUp}
                      >
                        <span
                          className="px-1 py-0.5 rounded bg-teal-500/10 text-teal-700 font-extrabold whitespace-nowrap"
                          style={{ fontSize: `${Math.max(8, (room.labelSize ?? 0.018) * 700)}px` }}
                        >
                          {room.name}
                        </span>
                      </div>
                    );
                  })}
                  {activeFloor?.scale && visibleFloorObjects.map((obj) => {
                      const prod = products.find(p => p.id === obj.productId);
                      const sym = prod?.floorplan_symbol as FloorplanSymbol | null;
                      if (!sym || !activeFloor.scale) return null;
                      const size = getObjectSizeNormalized(sym, activeFloor.scale, obj.rotation, canvasAspectRatio);
                      const isActive = activeObjectId === obj.id;
                      const isDragObj = draggingObject?.objectId === obj.id;
                      const ox = isDragObj ? draggingObject.x : obj.x;
                      const oy = isDragObj ? draggingObject.y : obj.y;
                      return (
                        <div
                          key={obj.id}
                          className="absolute pointer-events-auto"
                          style={{
                            left: `${(ox - size.w / 2) * 100}%`,
                            top: `${(oy - size.h / 2) * 100}%`,
                            width: `${size.w * 100}%`,
                            height: `${size.h * 100}%`,
                            cursor: isDragObj ? 'grabbing' : toolMode === 'pointer' ? 'grab' : 'default',
                            zIndex: isDragObj ? 50 : isActive ? 15 : 5,
                            touchAction: 'none',
                          }}
                          onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                          onPointerMove={handleObjectPointerMove}
                          onPointerUp={handleObjectPointerUp}
                        />
                      );
                    })}
                  {floorPins.map((pin) => {
                    const isActive = activePinId === pin.placement.id;
                    const isDragging = dragging?.placementId === pin.placement.id;
                    const isHighlighted = highlightProductId === pin.productId;
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
                          className={`rounded-full shadow-lg transition-shadow relative ${
                            isDragging ? 'ring-4 ring-blue-400/50 cursor-grabbing'
                            : isHighlighted ? 'ring-4 ring-amber-400 shadow-xl animate-pulse'
                            : isActive ? 'ring-[3px] ring-white shadow-xl'
                            : `ring-2 ring-white/90 hover:ring-white hover:shadow-xl ${toolMode === 'pointer' ? 'cursor-grab' : 'cursor-pointer'}`
                          }`}
                          style={{ backgroundColor: circuitColor ?? '#1e293b', width: pinSize, height: pinSize, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {hasIcon ? (
                            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
                              {renderPinIcon(pin.placement.icon, Math.round(pinSize * 0.75))}
                            </span>
                          ) : (
                            <span className="font-extrabold text-white leading-none" style={{ fontSize: Math.max(7, Math.round(pinSize * 0.3)) }}>{pin.label}</span>
                          )}
                        </div>
                        <div className="mt-0.5 bg-slate-900/90 backdrop-blur-sm px-1 py-px rounded font-extrabold text-white whitespace-nowrap leading-tight border border-slate-600/50" style={{ fontSize: Math.max(8, Math.round(pinSize * 0.28)) }}>
                          {pin.label}
                        </div>
                      </div>
                    );
                  })}
                  {currentFloorGroups.map((group) => {
                    const groupElements = currentFloorElements.filter((el) =>
                      group.slots.some((s) => s.element_id === el.id)
                    );
                    if (groupElements.length < 2) return null;
                    const isDraggingThisGroup = draggingGroup?.id === group.id;
                    let displayElements = groupElements;
                    if (isDraggingThisGroup && draggingGroup) {
                      displayElements = groupElements.map((el) => {
                        const offset = draggingGroup.elementOffsets.find((o) => o.id === el.id);
                        if (!offset) return el;
                        return { ...el, x: el.x, y: el.y };
                      });
                    }
                    const minX = Math.min(...displayElements.map((el) => el.x));
                    const maxX = Math.max(...displayElements.map((el) => el.x));
                    const minY = Math.min(...displayElements.map((el) => el.y));
                    const maxY = Math.max(...displayElements.map((el) => el.y));
                    const padding = 0.025;
                    const isActiveGroup = activeMountingGroupId === group.id;
                    return (
                      <div
                        key={`group-${group.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDraggingThisGroup) {
                            setActiveMountingGroupId(isActiveGroup ? null : group.id);
                          }
                        }}
                        onPointerDown={(e) => {
                          if (toolMode === 'pointer' && e.button === 0 && isActiveGroup) {
                            e.stopPropagation();
                            e.preventDefault();
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const startX = (e.clientX - rect.left) / rect.width;
                            const startY = (e.clientY - rect.top) / rect.height;
                            const elementOffsets = groupElements.map((el) => ({
                              id: el.id,
                              offsetX: el.x - startX,
                              offsetY: el.y - startY,
                            }));
                            setDraggingGroup({
                              id: group.id,
                              startX,
                              startY,
                              elementOffsets,
                            });
                          }
                        }}
                        onPointerMove={(e) => {
                          if (draggingGroup?.id === group.id && canvasRef.current) {
                            const rect = canvasRef.current.getBoundingClientRect();
                            const currentX = (e.clientX - rect.left) / rect.width;
                            const currentY = (e.clientY - rect.top) / rect.height;
                            const clampedX = Math.max(0, Math.min(1, currentX));
                            const clampedY = Math.max(0, Math.min(1, currentY));
                            setDraggingGroup((prev) => prev ? { ...prev, startX: clampedX, startY: clampedY } : null);
                          }
                        }}
                        onPointerUp={async () => {
                          if (draggingGroup?.id === group.id) {
                            for (const offset of draggingGroup.elementOffsets) {
                              const newX = Math.max(0, Math.min(1, draggingGroup.startX + offset.offsetX));
                              const newY = Math.max(0, Math.min(1, draggingGroup.startY + offset.offsetY));
                              await updateDesignElement(offset.id, { x: newX, y: newY });
                            }
                            setDraggingGroup(null);
                          }
                        }}
                        className={`absolute pointer-events-auto transition-all ${
                          isActiveGroup ? 'z-[5] cursor-move' : 'z-[1] cursor-pointer'
                        }`}
                        style={{
                          left: `${(minX - padding) * 100}%`,
                          top: `${(minY - padding) * 100}%`,
                          width: `${(maxX - minX + padding * 2) * 100}%`,
                          height: `${(maxY - minY + padding * 2) * 100}%`,
                        }}
                      >
                        <div
                          className={`w-full h-full rounded-xl border-2 transition-all ${
                            isActiveGroup
                              ? 'border-teal-400 bg-teal-500/15 border-solid shadow-lg shadow-teal-500/20'
                              : 'border-slate-400/40 bg-slate-500/5 border-dashed hover:border-teal-400/60 hover:bg-teal-500/5'
                          }`}
                        />
                        <div
                          className={`absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 shadow ${
                            isActiveGroup
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-800/90 text-slate-300'
                          }`}
                        >
                          <span>{group.frame_size}x</span>
                          <span className="opacity-70">{group.orientation === 'horizontal' ? 'H' : 'V'}</span>
                          {group.label && <span className="border-l border-white/20 pl-1.5">{group.label}</span>}
                        </div>
                        {isActiveGroup && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMountingGroupId(group.id);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-500 text-white flex items-center gap-1.5 hover:bg-teal-600 transition shadow-lg text-[11px] font-bold"
                              title="Upravit rámeček"
                            >
                              <Pencil className="w-3 h-3" />
                              Upravit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDisbandGroup(group.id);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/90 text-white flex items-center gap-1.5 hover:bg-red-600 transition shadow-lg text-[11px] font-bold"
                              title="Zrušit rámeček"
                            >
                              <X className="w-3 h-3" />
                              Zrušit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {currentFloorElements.map((el) => {
                    const elType = getTypeById(el.element_type_id);
                    if (!elType) return null;
                    const isActive = activeElementId === el.id;
                    const isSelected = selectedElementIds.has(el.id);
                    const isDrag = draggingElement?.id === el.id;
                    const elementGroup = getGroupForElement(el.id);
                    const isInDraggingGroup = draggingGroup && elementGroup?.id === draggingGroup.id;
                    let pos = { x: el.x, y: el.y };
                    if (isDrag && draggingElement) {
                      pos = { x: draggingElement.x, y: draggingElement.y };
                    } else if (isInDraggingGroup && draggingGroup) {
                      const offset = draggingGroup.elementOffsets.find((o) => o.id === el.id);
                      if (offset) {
                        pos = {
                          x: Math.max(0, Math.min(1, draggingGroup.startX + offset.offsetX)),
                          y: Math.max(0, Math.min(1, draggingGroup.startY + offset.offsetY)),
                        };
                      }
                    }
                    const rotation = el.rotation || 0;
                    const symSize = schematicSymbolScale;
                    return (
                      <div
                        key={el.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleElementSelect(el.id, e.shiftKey);
                        }}
                        onPointerDown={(e) => {
                          if (toolMode === 'pointer' && e.button === 0 && !e.shiftKey) {
                            e.stopPropagation();
                            e.preventDefault();
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            setDraggingElement({ id: el.id, x: el.x, y: el.y });
                            setActiveElementId(el.id);
                          }
                        }}
                        onPointerMove={handleElementPointerMove}
                        onPointerUp={handleElementPointerUp}
                        className="absolute pointer-events-auto cursor-pointer"
                        style={{
                          left: `${pos.x * 100}%`,
                          top: `${pos.y * 100}%`,
                          transform: `translate(-50%, -50%)`,
                          touchAction: 'none',
                          zIndex: isDrag ? 50 : isActive ? 10 : isSelected ? 8 : 2,
                        }}
                        title={`${elType.name}${el.quantity > 1 ? ` x${el.quantity}` : ''}${elementGroup ? ` (v rámečku)` : ''}\nShift+klik pro výběr více prvků`}
                      >
                        <div
                          className={`flex items-center justify-center transition-all ${
                            isActive ? 'scale-125' : isSelected ? 'scale-115' : 'hover:scale-110'
                          }`}
                          style={{
                            width: symSize,
                            height: symSize,
                            transform: `rotate(${rotation}deg)`,
                            color: categoryColorMap[elType.category] ?? '#6b7280',
                          }}
                        >
                          {renderPinIcon(elType.icon || 'dot', Math.round(symSize * 0.9), 'currentColor', categoryColorMap[elType.category] ?? '#6b7280')}
                        </div>
                        {el.quantity > 1 && (
                          <div
                            className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-blue-600 text-white font-extrabold shadow-sm"
                            style={{ width: 14, height: 14, fontSize: 9 }}
                          >
                            {el.quantity}
                          </div>
                        )}
                        {isActive && (
                          <div className="absolute inset-0 ring-2 ring-blue-500 ring-offset-1 ring-offset-navy-900/50" style={{ width: symSize + 4, height: symSize + 4, left: -2, top: -2 }} />
                        )}
                        {isSelected && !isActive && (
                          <div className="absolute inset-0 ring-2 ring-teal-400 ring-offset-1 ring-offset-navy-900/50" style={{ width: symSize + 4, height: symSize + 4, left: -2, top: -2 }} />
                        )}
                        {(el.mounting_height || el.note) && (
                          <div
                            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-slate-900 text-[9px] font-bold"
                            style={{ top: symSize + 2 }}
                          >
                            {el.mounting_height && el.note ? `${el.mounting_height} | ${el.note}` : (el.mounting_height || el.note)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {rooms.map((room) => (room.doors ?? []).map((door) => {
                    const pts = room.points;
                    const isDrag = draggingDoor?.doorId === door.id;
                    let dx: number, dy: number;
                    if (isDrag) {
                      dx = draggingDoor.x;
                      dy = draggingDoor.y;
                    } else {
                      const a = pts[door.wallIndex];
                      const b = pts[(door.wallIndex + 1) % pts.length];
                      dx = a.x + (b.x - a.x) * door.position;
                      dy = a.y + (b.y - a.y) * door.position;
                    }
                    return (
                      <div
                        key={door.id}
                        onPointerDown={(e) => handleDoorPointerDown(e, room.id, door.id, dx, dy)}
                        onPointerMove={handleDoorPointerMove}
                        onPointerUp={handleDoorPointerUp}
                        className="absolute pointer-events-auto flex items-center justify-center"
                        style={{
                          left: `${dx * 100}%`,
                          top: `${dy * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          touchAction: 'none',
                          zIndex: isDrag ? 50 : 2,
                          cursor: isDrag ? 'grabbing' : (toolMode === 'pointer' || toolMode === 'room') ? 'grab' : 'default',
                        }}
                      >
                        <div className={`rounded-full flex items-center justify-center shadow ${isDrag ? 'ring-2 ring-amber-400' : 'ring-1 ring-white'}`}
                          style={{ width: 20, height: 20, backgroundColor: '#d97706' }}>
                          <DoorOpen className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>
              </div>
            )}
          </div>

          {activeFloor?.floorplanImg && (
            <div className="sticky bottom-3 left-3 z-30 flex items-center gap-1 pointer-events-none" style={{ marginTop: -40, paddingBottom: 8, paddingLeft: 12 }}>
              <div className="pointer-events-auto flex items-center gap-1 bg-white/[0.06]/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 px-2 py-1.5">
                <button
                  onClick={() => setZoom(z => Math.max(0.25, +(z / 1.25).toFixed(2)))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition"
                  title="Oddálit"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="min-w-[44px] h-7 rounded-lg flex items-center justify-center text-xs font-extrabold text-slate-400 hover:bg-white/[0.06] transition tabular-nums"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => setZoom(z => Math.min(4, +(z * 1.25).toFixed(2)))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition"
                  title="Přiblížit"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 xl:w-96 border-l bg-white/[0.06] overflow-hidden flex flex-col shrink-0 hidden md:flex">
          {toolContent && !showTabbedPanel ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">{toolContent}</div>
          ) : (
            <>
              {toolContent && <div className="shrink-0 border-b border-white/10">{toolContent}</div>}
              {(effectiveEnableProducts && effectiveEnableSchematic) && (
                <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 shrink-0">
                  <button
                    onClick={() => handleDesignModeChange('catalog')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition ${
                      designMode === 'catalog'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    Produkty
                  </button>
                  <button
                    onClick={() => handleDesignModeChange('schematic')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition ${
                      designMode === 'schematic'
                        ? 'bg-teal-600 text-white'
                        : 'bg-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Schémá
                  </button>
                  {designMode === 'schematic' && designElements.length > 0 && (
                    <button
                      onClick={() => handleNavigateAway(() => navigate(`/projekty/${id}/prirazeni`))}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      Přiřazení
                    </button>
                  )}
                </div>
              )}
              {(!effectiveEnableProducts || !effectiveEnableSchematic) && designMode === 'schematic' && designElements.length > 0 && (
                <div className="flex items-center justify-end px-3 py-2 border-b border-white/10 shrink-0">
                  <button
                    onClick={() => handleNavigateAway(() => navigate(`/projekty/${id}/prirazeni`))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                  >
                    Přiřazení produktu
                  </button>
                </div>
              )}
              <div className="flex border-b border-white/10 shrink-0">
                {(designMode === 'catalog' ? ['catalog', 'used', 'rooms'] : ['schematic', 'used', 'rooms'] as RightTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab as RightTab)}
                    className={`flex-1 px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider transition border-b-2 ${
                      rightTab === tab
                        ? 'text-blue-400 border-blue-600 bg-blue-500/10/50'
                        : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    {tab === 'catalog' ? 'Katalog' : tab === 'schematic' ? 'Značky' : tab === 'used' ? 'Použité' : 'Místnosti'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {rightTab === 'catalog' && (
                  <EditorCatalogPanel
                    products={products}
                    categories={categories}
                    selected={selected}
                    activeProductId={placingProductId}
                    onStartPlacing={handleStartPlacing}
                  />
                )}
                {rightTab === 'schematic' && (
                  <SchematicElementPanel
                    elementTypes={elementTypes}
                    placedElements={designElements}
                    activeTypeId={placingElementTypeId}
                    onStartPlacing={handleStartPlacingElement}
                  />
                )}
                {rightTab === 'used' && designMode === 'schematic' && (
                  <UsedSchematicPanel
                    elements={currentFloorElements}
                    elementTypes={elementTypes}
                    rooms={rooms}
                    products={products}
                    assignments={assignments}
                    productKindMap={productKindMap}
                    categoryColorMap={categoryColorMap}
                    onSelectElement={(elId) => { setActiveElementId(elId); setToolMode('pointer'); }}
                    onDeleteElement={async (elId) => {
                      await removeDesignElement(elId);
                      if (activeElementId === elId) setActiveElementId(null);
                    }}
                    onAssignProduct={assignProductToElement}
                    onBulkAssignProduct={(elementIds, productId) => {
                      if (!productId) return;
                      const alreadyAssigned = elementIds.filter(elId => {
                        const resolved = resolveForElement(elId, designElements.find(e => e.id === elId)?.element_type_id || '', designElements.find(e => e.id === elId)?.room_id || null);
                        return resolved.sourceLevel === 'element' && resolved.effectiveProductId;
                      });
                      if (alreadyAssigned.length > 0) {
                        setBulkAssignDialog({ elementIds, productId, alreadyAssigned });
                      } else {
                        for (const elId of elementIds) {
                          assignProductToElement(elId, productId);
                        }
                      }
                    }}
                    activeElementId={activeElementId}
                  />
                )}
                {rightTab === 'used' && designMode === 'catalog' && (
                  <UsedElementsPanel
                    products={products}
                    categories={categories}
                    selected={selected}
                    floors={floors}
                    rooms={rooms}
                    activeFloorId={activeFloorId}
                    onHighlightProduct={handleHighlightProduct}
                    onRemoveAll={handleRemoveAll}
                  />
                )}
                {rightTab === 'rooms' && (
                  <div className="overflow-auto h-full">
                    <div className="border-b border-white/10">
                      <button
                        onClick={() => setRoomsExpanded(!roomsExpanded)}
                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/[0.04] transition"
                      >
                        <Square className="w-3.5 h-3.5 text-teal-500" />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex-1 text-left">
                          Místnosti
                        </span>
                        {rooms.length > 0 && (
                          <span className="text-[10px] font-extrabold bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded">
                            {rooms.length}
                            {activeFloor?.scale && (
                              <span className="ml-1 text-teal-600">
                                {rooms.reduce((sum, r) => sum + polygonAreaM2(r.points, activeFloor.scale!), 0).toFixed(0)} m2
                              </span>
                            )}
                          </span>
                        )}
                        {roomsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                      {!roomsExpanded && !isDrawingRoom && (
                        <div className="px-4 pb-3">
                          <button
                            onClick={handleStartRoomDraw}
                            className="w-full bg-white/[0.06] text-slate-300 py-2 rounded-xl font-extrabold text-xs hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3 h-3" /> Nakreslit místnost
                          </button>
                        </div>
                      )}
                      {(roomsExpanded || isDrawingRoom) && (
                        <RoomEditor
                          rooms={rooms}
                          drawingPoints={roomDrawingPoints}
                          isDrawing={isDrawingRoom}
                          scale={activeFloor?.scale}
                          onStartDraw={handleStartRoomDraw}
                          onFinishDraw={handleFinishRoomDraw}
                          onCancelDraw={handleCancelRoomDraw}
                          onRemoveRoom={(roomId) => { if (activeFloor) project.removeRoom(activeFloor.id, roomId); }}
                          onRenameRoom={(roomId, name) => { if (activeFloor) project.renameRoom(activeFloor.id, roomId, name); }}
                          onUpdateBathroomLayout={(roomId, layout) => { if (activeFloor) project.updateRoomBathroomLayout(activeFloor.id, roomId, layout); }}
                          onUpdateRoomLabel={(roomId, updates) => { if (activeFloor) project.updateRoomLabel(activeFloor.id, roomId, updates); }}
                        />
                      )}
                    </div>
                    <CableEditor
                      circuits={circuits}
                      cables={cables}
                      scale={activeFloor?.scale}
                      activeCircuitId={activeCircuitId}
                      isDrawing={isDrawingCable}
                      drawingPoints={cableDrawingPoints}
                      materials={materials}
                      hiddenCircuitIds={hiddenCircuitIds}
                      onToggleCircuitVisibility={(circuitId) => {
                        setHiddenCircuitIds(prev => {
                          const next = new Set(prev);
                          if (next.has(circuitId)) next.delete(circuitId);
                          else next.add(circuitId);
                          return next;
                        });
                      }}
                      onAddCircuit={(circuit) => { if (activeFloor) { project.addCircuit(activeFloor.id, circuit); setActiveCircuitId(circuit.id); } }}
                      onRemoveCircuit={(circuitId) => { if (activeFloor) project.removeCircuit(activeFloor.id, circuitId); }}
                      onUpdateCircuit={(circuitId, updates) => { if (activeFloor) project.updateCircuit(activeFloor.id, circuitId, updates); }}
                      onSelectCircuit={setActiveCircuitId}
                      onStartDraw={handleStartCableDraw}
                      onFinishCable={handleFinishCable}
                      onCancelDraw={handleCancelCableDraw}
                      onRemoveCable={(cableId) => { if (activeFloor) project.removeCable(activeFloor.id, cableId); }}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {isDesignSeries && placingProduct && toolMode === 'place' && (
            <div className="border-t border-white/10 shrink-0">
              <DesignBuilder
                product={placingProduct}
                designModules={designModules}
                designPresets={designPresets}
                productColors={productColors}
                frameSize={designBuilderState.frameSize}
                modules={designBuilderState.modules}
                designColor={designColor}
                onFrameSize={handleFrameSize}
                onSlotChange={handleSlotChange}
                onColorChange={setDesignColor}
                onApplyPreset={applyPreset}
              />
            </div>
          )}

          {!isDesignSeries && placingProduct && toolMode === 'place' && (() => {
            const colors = productColors.filter(c => c.product_id === placingProductId);
            if (colors.length === 0) return null;
            return (
              <div className="border-t border-white/10 shrink-0 px-3 py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Barva</div>
                <div className="flex flex-wrap gap-1.5">
                  {colors.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setRegularProductColor({ name: c.name, hex: c.hex_code })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 transition text-[11px] font-extrabold ${
                        regularProductColor?.name === c.name
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400 '
                          : 'border-white/10 bg-white/[0.06] text-slate-400 hover:border-white/[0.12]'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: c.hex_code }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[90] md:hidden flex">
          <div className="flex-1 bg-black/30" onClick={() => setMobileSidebarOpen(false)} />
          <div className="w-80 bg-white/[0.06] overflow-hidden flex flex-col shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <span className="text-sm font-extrabold text-white">Panel</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            {(effectiveEnableProducts && effectiveEnableSchematic) && (
              <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 shrink-0">
                <button
                  onClick={() => handleDesignModeChange('catalog')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition ${
                    designMode === 'catalog' ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Produkty
                </button>
                <button
                  onClick={() => handleDesignModeChange('schematic')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition ${
                    designMode === 'schematic' ? 'bg-teal-600 text-white' : 'bg-white/[0.06] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Schémá
                </button>
              </div>
            )}
            <div className="flex border-b border-white/10 shrink-0">
              {(designMode === 'catalog' ? ['catalog', 'used', 'rooms'] : ['schematic', 'used', 'rooms'] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab as RightTab)}
                  className={`flex-1 px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider transition border-b-2 ${
                    rightTab === tab
                      ? 'text-blue-400 border-blue-600 bg-blue-500/10/50'
                      : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {tab === 'catalog' ? 'Katalog' : tab === 'schematic' ? 'Značky' : tab === 'used' ? 'Použité' : 'Místnosti'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              {rightTab === 'catalog' && (
                <EditorCatalogPanel
                  products={products}
                  categories={categories}
                  selected={selected}
                  activeProductId={placingProductId}
                  onStartPlacing={handleStartPlacing}
                />
              )}
              {rightTab === 'schematic' && (
                <SchematicElementPanel
                  elementTypes={elementTypes}
                  placedElements={designElements}
                  activeTypeId={placingElementTypeId}
                  onStartPlacing={handleStartPlacingElement}
                />
              )}
              {rightTab === 'used' && designMode === 'schematic' && (
                <UsedSchematicPanel
                  elements={currentFloorElements}
                  elementTypes={elementTypes}
                  rooms={rooms}
                  products={products}
                  assignments={assignments}
                  productKindMap={productKindMap}
                  categoryColorMap={categoryColorMap}
                  onSelectElement={(elId) => { setActiveElementId(elId); setToolMode('pointer'); }}
                  onDeleteElement={async (elId) => {
                    await removeDesignElement(elId);
                    if (activeElementId === elId) setActiveElementId(null);
                  }}
                  onAssignProduct={assignProductToElement}
                  onBulkAssignProduct={(elementIds, productId) => {
                    if (!productId) return;
                    const alreadyAssigned = elementIds.filter(elId => {
                      const resolved = resolveForElement(elId, designElements.find(e => e.id === elId)?.element_type_id || '', designElements.find(e => e.id === elId)?.room_id || null);
                      return resolved.sourceLevel === 'element' && resolved.effectiveProductId;
                    });
                    if (alreadyAssigned.length > 0) {
                      setBulkAssignDialog({ elementIds, productId, alreadyAssigned });
                    } else {
                      for (const elId of elementIds) {
                        assignProductToElement(elId, productId);
                      }
                    }
                  }}
                  activeElementId={activeElementId}
                />
              )}
              {rightTab === 'used' && designMode === 'catalog' && (
                <UsedElementsPanel
                  products={products}
                  categories={categories}
                  selected={selected}
                  floors={floors}
                  rooms={rooms}
                  activeFloorId={activeFloorId}
                  onHighlightProduct={handleHighlightProduct}
                  onRemoveAll={handleRemoveAll}
                />
              )}
              {rightTab === 'rooms' && (
                <div>
                  <div className="border-b border-white/10">
                    <button
                      onClick={() => setRoomsExpanded(!roomsExpanded)}
                      className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/[0.04] transition"
                    >
                      <Square className="w-3.5 h-3.5 text-teal-500" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex-1 text-left">Místnosti</span>
                      {rooms.length > 0 && (
                        <span className="text-[10px] font-extrabold bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded">{rooms.length}</span>
                      )}
                      {roomsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {!roomsExpanded && !isDrawingRoom && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={handleStartRoomDraw}
                          className="w-full bg-white/[0.06] text-slate-300 py-2 rounded-xl font-extrabold text-xs hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3 h-3" /> Nakreslit místnost
                        </button>
                      </div>
                    )}
                    {(roomsExpanded || isDrawingRoom) && (
                      <RoomEditor
                        rooms={rooms}
                        drawingPoints={roomDrawingPoints}
                        isDrawing={isDrawingRoom}
                        scale={activeFloor?.scale}
                        onStartDraw={handleStartRoomDraw}
                        onFinishDraw={handleFinishRoomDraw}
                        onCancelDraw={handleCancelRoomDraw}
                        onRemoveRoom={(roomId) => { if (activeFloor) project.removeRoom(activeFloor.id, roomId); }}
                        onRenameRoom={(roomId, name) => { if (activeFloor) project.renameRoom(activeFloor.id, roomId, name); }}
                        onUpdateBathroomLayout={(roomId, layout) => { if (activeFloor) project.updateRoomBathroomLayout(activeFloor.id, roomId, layout); }}
                        onUpdateRoomLabel={(roomId, updates) => { if (activeFloor) project.updateRoomLabel(activeFloor.id, roomId, updates); }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
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

      {activeObjectId && (() => {
        const obj = floorplanObjects.find(o => o.id === activeObjectId);
        if (!obj) return null;
        const prod = products.find(p => p.id === obj.productId) ?? null;
        return (
          <ObjectDetailDrawer
            object={obj}
            product={prod}
            rooms={rooms}
            onUpdate={(updates) => {
              if (activeFloor) project.updateFloorObject(activeFloor.id, activeObjectId, updates);
            }}
            onDelete={() => {
              if (activeFloor) project.removeFloorObject(activeFloor.id, activeObjectId);
              setActiveObjectId(null);
            }}
            onClose={() => setActiveObjectId(null)}
          />
        );
      })()}

      {activePinId && !activeObjectId && toolMode === 'pointer' && (() => {
        const pin = allFloorPins.find(p => p.placement.id === activePinId);
        if (!pin) return null;
        return (
          <PinDetailDrawer
            pin={pin}
            rooms={rooms}
            circuits={circuits}
            products={products}
            onUpdateNote={(note) => project.updatePlacementNote(pin.productId, pin.placement.id, note)}
            onUpdateRoom={(room) => project.updatePlacementRoom(pin.productId, pin.placement.id, room)}
            onUpdateCircuit={(circuitId) => project.updatePlacementCircuit(pin.productId, pin.placement.id, circuitId)}
            onUpdateMountingHeight={(h) => project.updatePlacementMountingHeight(pin.productId, pin.placement.id, h)}
            onChangeIcon={() => setIconPickerPin(pin)}
            onReplaceProduct={(newId) => {
              project.replacePlacement(pin.productId, pin.placement.id, newId);
              setActivePinId(null);
            }}
            onDelete={() => {
              project.removePlacement(pin.productId, pin.placement.id);
              setActivePinId(null);
            }}
            onClose={() => setActivePinId(null)}
          />
        );
      })()}

      {activeElementId && !activePinId && !activeObjectId && toolMode === 'pointer' && (() => {
        const el = designElements.find(e => e.id === activeElementId);
        const elType = el ? getTypeById(el.element_type_id) : null;
        if (!el || !elType) return null;
        return (
          <SchematicElementDrawer
            element={el}
            elementType={elType}
            rooms={rooms}
            circuits={circuits}
            categoryColorMap={categoryColorMap}
            onUpdate={async (updates) => {
              await updateDesignElement(el.id, updates);
            }}
            onDelete={async () => {
              await removeDesignElement(el.id);
              setActiveElementId(null);
            }}
            onClose={() => setActiveElementId(null)}
            onAddCircuit={(name, color) => {
              project.addCircuit(activeFloorId, { id: crypto.randomUUID(), name, color, type: 'electric' });
            }}
            onDefaultsChange={setPlacementDefaults}
          />
        );
      })()}

      {showFvDesigner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-800/60 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '95vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Sun className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-sm font-extrabold text-white">FV Designer</span>
              </div>
              <button onClick={() => setShowFvDesigner(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <FvSection
                projectId={id}
                projectAddress={project.meta.client}
                onExportToQuote={(_sections) => {
                  toast('FV sekce přidána do nabídky.', 'success');
                  setShowFvDesigner(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

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
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
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
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
              >
                Uložit verzi
              </button>
            </div>
          </div>
        </>
      )}

      <VersionHistoryDrawer<DesignVersion & VersionItem>
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        versions={versions as (DesignVersion & VersionItem)[]}
        loading={versionsLoading}
        onSaveVersion={handleSaveVersion}
        onRestore={handleRestoreVersion}
        title="Historie verzí návrhu"
        renderSummary={(v) => {
          const sel = v.selection_data as Record<string, { placements?: unknown[] }>;
          const productCount = Object.keys(sel).length;
          const pinCount = Object.values(sel).reduce((s, p) => s + (p.placements?.length ?? 0), 0);
          const floorCount = Array.isArray(v.floorplan_data) ? v.floorplan_data.length : 0;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-extrabold text-blue-400">
                {pinCount} pinů
              </span>
              <span className="text-[9px] font-extrabold text-slate-500">
                {productCount} produktů
              </span>
              <span className="text-[9px] font-extrabold text-emerald-400">
                {floorCount} pater
              </span>
            </div>
          );
        }}
      />

      <VersionPickerModal<DesignVersion & { note?: string }>
        open={showVersionPicker && projectLoaded}
        onClose={() => {
          if (!initialDataRef.current) {
            initialDataRef.current = JSON.stringify({ selected: project.selected, floors: project.floors });
          }
          setShowVersionPicker(false);
        }}
        versions={versions.map(v => ({ ...v, note: v.label }))}
        loading={!versionsFetched}
        onSelectVersion={(version) => {
          handleRestoreVersion(version);
          setShowVersionPicker(false);
        }}
        onStartNew={handleStartNewConfig}
        title="Návrhář - vyberte verzi"
        variant="design"
        renderSummary={(v) => {
          const sel = v.selection_data as Record<string, { placements?: unknown[] }>;
          const productCount = Object.keys(sel).length;
          const pinCount = Object.values(sel).reduce((s, p) => s + (p.placements?.length ?? 0), 0);
          const floorCount = Array.isArray(v.floorplan_data) ? v.floorplan_data.length : 0;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-extrabold text-blue-400">
                {pinCount} pinů
              </span>
              <span className="text-[9px] font-extrabold text-slate-500">
                {productCount} produktů
              </span>
              <span className="text-[9px] font-extrabold text-emerald-400">
                {floorCount} pater
              </span>
            </div>
          );
        }}
      />

      {bulkAssignDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Hromadné přiřazení produktu</h3>
            <p className="text-sm text-slate-400 mb-4">
              {bulkAssignDialog.alreadyAssigned.length} z {bulkAssignDialog.elementIds.length} prvku
              již má přiřazeny produkt. Jak chcete postupovat?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  for (const elId of bulkAssignDialog.elementIds) {
                    assignProductToElement(elId, bulkAssignDialog.productId);
                  }
                  setBulkAssignDialog(null);
                }}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition"
              >
                Přepsat všechny
              </button>
              <button
                onClick={() => {
                  const unassigned = bulkAssignDialog.elementIds.filter(
                    elId => !bulkAssignDialog.alreadyAssigned.includes(elId)
                  );
                  for (const elId of unassigned) {
                    assignProductToElement(elId, bulkAssignDialog.productId);
                  }
                  setBulkAssignDialog(null);
                }}
                className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition"
              >
                Ponechat již přiřazené ({bulkAssignDialog.elementIds.length - bulkAssignDialog.alreadyAssigned.length} nových)
              </button>
              <button
                onClick={() => setBulkAssignDialog(null)}
                className="w-full px-4 py-2 text-slate-400 hover:text-white transition text-sm"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Save className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Neuložené změny</h3>
                  <p className="text-xs text-slate-400">
                    {activeVersion ? `Pracujete s verzi ${activeVersion.version_number}: ${activeVersion.label || 'Bez nazvu'}` : 'Novy navrh - zatim bez ulozene verze'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-300 mb-4">
                Máte neuložen změny v návrhu. Jak chcete postupovat?
              </p>

              <div className="space-y-3">
                {activeVersion && (
                  <button
                    onClick={() => handleSaveAndExit('overwrite')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition"
                  >
                    <Save className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-sm">Přepsat aktuální verzi</div>
                      <div className="text-xs opacity-70">V{activeVersion.version_number}: {activeVersion.label || 'Bez nazvu'}</div>
                    </div>
                  </button>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    value={saveVersionNote}
                    onChange={(e) => setSaveVersionNote(e.target.value)}
                    placeholder="Název nové verze (volitelné)"
                    className="w-full px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    onClick={() => handleSaveAndExit('new')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition"
                  >
                    <FileEdit className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-sm">Uložit jako novou verzi</div>
                      <div className="text-xs opacity-70">Vytvoří verzi {versions.length + 1}</div>
                    </div>
                  </button>
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2">
                  <button
                    onClick={handleDiscardAndExit}
                    className="flex-1 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-xl transition text-sm font-medium"
                  >
                    Zahodit změny
                  </button>
                  <button
                    onClick={() => { setShowExitConfirm(false); setPendingNavigation(null); }}
                    className="flex-1 px-4 py-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition text-sm font-medium"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedElementIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl px-5 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Layers className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {selectedElementIds.size} vybráno
                </div>
                <div className="text-[10px] text-slate-400">
                  Shift+klik pro přidání
                </div>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <button
              onClick={() => setShowMountingGroupModal(true)}
              disabled={selectedElementIds.size < 2}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${
                selectedElementIds.size >= 2
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Layers className="w-4 h-4" />
              Vytvořit rámeček
            </button>
            <button
              onClick={() => setSelectedElementIds(new Set())}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition"
              title="Zrušit výběr (Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showMountingGroupModal && (
        <MountingGroupModal
          selectedElements={currentFloorElements.filter((el) => selectedElementIds.has(el.id))}
          elementTypes={elementTypes}
          onConfirm={handleCreateMountingGroup}
          onCancel={() => setShowMountingGroupModal(false)}
        />
      )}

      {editingMountingGroupId && (() => {
        const editGroup = mountingGroups.find((g) => g.id === editingMountingGroupId);
        if (!editGroup) return null;
        const designSeriesProducts = products.filter((p) => p.kind === 'design_series');
        const colorOptions = productColors
          .map((pc) => ({ name: pc.name, hex: pc.hex_code }))
          .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);

        return (
          <MountingGroupEditModal
            group={editGroup}
            elements={designElements}
            elementTypes={elementTypes}
            designSeriesProducts={designSeriesProducts}
            productColors={colorOptions}
            onUpdateGroup={async (params) => {
              const result = await updateMountingGroup(editGroup.id, params);
              if (result.error) {
                toast(`Chyba: ${result.error}`);
                return { error: result.error };
              }
              toast('Vícerámeček upraven');
              return {};
            }}
            onReorderSlot={async (slotId, newIndex) => {
              const slot = editGroup.slots.find((s) => s.id === slotId);
              if (!slot) return { error: 'Slot nenalezen' };
              const otherSlot = editGroup.slots.find((s) => s.slot_index === newIndex);
              if (!otherSlot) return { error: 'Cilovy slot nenalezen' };

              await updateMountingSlot(slot.id, { elementId: otherSlot.element_id });
              await updateMountingSlot(otherSlot.id, { elementId: slot.element_id });
              return {};
            }}
            onRemoveElementFromSlot={async (slotIndex) => {
              const result = await removeElementFromSlot(editGroup.id, slotIndex);
              if (result.error) {
                toast(`Chyba: ${result.error}`);
                return { error: result.error };
              }
              return {};
            }}
            onDisbandGroup={async () => {
              const result = await disbandGroup(editGroup.id);
              if (result.error) {
                toast(`Chyba: ${result.error}`);
                return { error: result.error };
              }
              toast('Vícerámeček byl rozpuštěn');
              return {};
            }}
            onClose={() => setEditingMountingGroupId(null)}
          />
        );
      })()}
    </div>
  );
}
