import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertTriangle, Package, Layers, ChevronDown, ChevronRight, Search, X, ArrowRight, FileText, ClipboardList, Info, Star, Filter, Grid2x2 as Grid } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { useCatalogData } from '../../hooks/useCatalogData';
import { useDesignElementTypes } from '../../hooks/useDesignElementTypes';
import { useProjectDesignElements } from '../../hooks/useProjectDesignElements';
import { useProductAssignments } from '../../hooks/useProductAssignments';
import { useElementTypeCompatibility } from '../../hooks/useElementTypeCompatibility';
import { useMountingGroups } from '../../hooks/useMountingGroups';
import type { ProjectDesignElement } from '../../types/designElements';
import type { Product } from '../../types/database';
import { getCategoryColor, getCategoryName } from '../../types/designElements';
import { renderPinIcon } from '../../components/catalog/floorplan/iconLibrary';
import {
  buildQuoteSectionsFromAssignments,
  buildQuoteSectionsFromMountingGroups,
  mergeQuoteSections,
  aggregateFramePreview,
  type MountingGroupQuoteInput,
} from '../../components/catalog/quoteHelpers';
import { useDesignSeriesLinks } from '../../hooks/useDesignSeriesLinks';
import { saveQuoteDirectly } from '../../lib/quoteDirectSave';
import DesignWorkflowStepper from '../../components/editor/DesignWorkflowStepper';
import WorkflowCtaBanner, { type WorkflowContextStats } from '../../components/editor/WorkflowCtaBanner';
import { useDesignWorkflow } from '../../hooks/useDesignWorkflow';
import type { Floor } from '../../hooks/useProjectState';

interface ProjectInfo {
  id: string;
  name: string;
  client_name: string | null;
}

type GroupMode = 'type' | 'room' | 'category';

export default function ProductAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [floors, setFloors] = useState<{ id: string; name: string; rooms: { id: string; name: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { products, loading: catalogLoading } = useCatalogData();
  const { types: elementTypes, getTypeById } = useDesignElementTypes();
  const { elements: designElements } = useProjectDesignElements(id);
  const {
    assignments,
    assignProduct,
    resolveForElement,
    productKindMap,
    refetch: refetchAssignments,
  } = useProductAssignments(id);
  const { compatibilityMap } = useElementTypeCompatibility();
  const { groupsWithSlots, getSlotForElement } = useMountingGroups(id);
  const { links: designSeriesLinks } = useDesignSeriesLinks();

  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [filterMode, setFilterMode] = useState<'all' | 'unassigned' | 'assigned' | 'inherited' | 'in_group'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<{
    scope: 'type' | 'room' | 'element';
    typeId?: string;
    roomId?: string;
    elementIds?: string[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: proj } = await supabase
        .from('projects')
        .select('id, name, client_name, floorplan_url')
        .eq('id', id)
        .maybeSingle();
      if (proj) {
        setProject({ id: proj.id, name: proj.name, client_name: proj.client_name });
        try {
          const parsed = JSON.parse(proj.floorplan_url || '[]');
          if (Array.isArray(parsed)) {
            setFloors(parsed.map((f: { id: string; name: string; rooms?: { id: string; name: string }[] }) => ({
              id: f.id,
              name: f.name,
              rooms: f.rooms ?? [],
            })));
          }
        } catch {
          setFloors([]);
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const [quotesCount, setQuotesCount] = useState(0);
  useEffect(() => {
    if (!id) return;
    supabase
      .from('project_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .then(({ count }) => setQuotesCount(count ?? 0));
  }, [id]);

  const workflowFloors = useMemo(() => {
    return floors.map((f) => ({
      ...f,
      floorplanImg: null,
      scale: undefined,
      rooms: f.rooms.map((r) => ({ ...r, points: [], placements: [] })),
      circuits: [],
      cables: [],
      dimensions: [],
      distributors: [],
      objects: [],
    })) as Floor[];
  }, [floors]);

  const workflow = useDesignWorkflow({
    floors: workflowFloors,
    designElements,
    assignments,
    quotesCount,
    productKindMap,
  });

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Projekty', href: '/projekty' },
        { label: project?.name || '...', href: id ? `/projekty/${id}` : undefined },
        { label: 'Přiřazení produktů' },
      ],
    });
    return () => setConfig({ breadcrumbs: [] });
  }, [setConfig, project?.name, id]);

  const roomMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const floor of floors) {
      for (const room of floor.rooms) {
        map.set(room.id, room.name);
      }
    }
    return map;
  }, [floors]);

  const filteredElements = useMemo(() => {
    if (filterMode === 'all') return designElements;

    return designElements.filter((el) => {
      const resolved = resolveForElement(el.id, el.element_type_id, el.room_id);
      const hasProduct = !!resolved.effectiveProductId;
      const isInherited = resolved.inherited;
      const slotInfo = getSlotForElement(el.id);

      switch (filterMode) {
        case 'unassigned':
          return !hasProduct;
        case 'assigned':
          return hasProduct;
        case 'inherited':
          return hasProduct && isInherited;
        case 'in_group':
          return !!slotInfo;
        default:
          return true;
      }
    });
  }, [designElements, filterMode, resolveForElement, getSlotForElement]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; elements: ProjectDesignElement[]; color: string }>();

    for (const el of filteredElements) {
      let key: string;
      let label: string;
      let color: string;

      if (groupMode === 'type') {
        const elType = getTypeById(el.element_type_id);
        key = el.element_type_id;
        label = elType?.name ?? 'Neznamy typ';
        color = elType ? getCategoryColor(elType.category) : '#6b7280';
      } else if (groupMode === 'room') {
        key = el.room_id ?? '__no_room__';
        label = el.room_id ? (roomMap.get(el.room_id) ?? 'Neznama mistnost') : 'Bez mistnosti';
        color = '#14b8a6';
      } else {
        const elType = getTypeById(el.element_type_id);
        key = elType?.category ?? 'other';
        label = getCategoryName(key);
        color = getCategoryColor(key);
      }

      if (!groups.has(key)) {
        groups.set(key, { label, elements: [], color });
      }
      groups.get(key)!.elements.push(el);
    }

    return Array.from(groups.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filteredElements, groupMode, getTypeById, roomMap]);

  const getResolvedAssignment = useCallback(
    (el: ProjectDesignElement) => {
      return resolveForElement(el.id, el.element_type_id, el.room_id);
    },
    [resolveForElement]
  );

  const getEffectiveProductId = useCallback(
    (el: ProjectDesignElement): string | null => {
      const resolved = getResolvedAssignment(el);
      return resolved.effectiveProductId;
    },
    [getResolvedAssignment]
  );

  const assignmentStats = useMemo(() => {
    let assigned = 0;
    let unassigned = 0;
    let inherited = 0;
    let direct = 0;

    for (const el of designElements) {
      const resolved = getResolvedAssignment(el);
      if (resolved.effectiveProductId) {
        assigned++;
        if (resolved.inherited) inherited++;
        else direct++;
      } else {
        unassigned++;
      }
    }

    return { assigned, unassigned, inherited, direct, total: designElements.length };
  }, [designElements, getResolvedAssignment]);

  const assignContextStats = useMemo((): WorkflowContextStats => {
    const elementsInGroupSet = new Set<string>();
    for (const group of groupsWithSlots) {
      for (const slot of group.slots) {
        if (slot.element_id) elementsInGroupSet.add(slot.element_id);
      }
    }
    const groupsWithoutSeries = groupsWithSlots.filter((g) => !g.design_series_id).length;
    return {
      totalElements: assignmentStats.total,
      assignedCount: assignmentStats.assigned,
      inheritedCount: assignmentStats.inherited,
      directCount: assignmentStats.direct,
      unassignedCount: assignmentStats.unassigned,
      warningCount: groupsWithoutSeries,
      elementsInGroup: elementsInGroupSet.size,
      mountingGroupWarnings: groupsWithoutSeries,
    };
  }, [assignmentStats, groupsWithSlots]);

  const framePreview = useMemo(() => {
    if (groupsWithSlots.length === 0) return { frames: [], warnings: [] };

    const mountingGroupsInput: MountingGroupQuoteInput[] = groupsWithSlots.map((group) => ({
      id: group.id,
      frameSize: group.frame_size,
      orientation: group.orientation ?? 'horizontal',
      designSeriesId: group.design_series_id,
      colorName: group.color_name,
      label: group.label,
      roomName: group.room_id ? roomMap.get(group.room_id) ?? null : null,
      modules: group.slots.map((slot) => slot.module_name ?? ''),
    }));

    return aggregateFramePreview(mountingGroupsInput, products, designSeriesLinks);
  }, [groupsWithSlots, products, designSeriesLinks, roomMap]);

  const unassignedCount = assignmentStats.unassigned;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(grouped.map(([key]) => key)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const handleBulkAssignByType = (typeId: string) => {
    setBulkAssignTarget({ scope: 'type', typeId });
    setShowProductPicker(true);
  };

  const handleBulkAssignByRoom = (roomId: string) => {
    setBulkAssignTarget({ scope: 'room', roomId });
    setShowProductPicker(true);
  };

  const handleAssignSingle = (elementId: string) => {
    setBulkAssignTarget({ scope: 'element', elementIds: [elementId] });
    setShowProductPicker(true);
  };

  const handleSelectProduct = async (product: Product) => {
    if (!bulkAssignTarget) return;

    if (bulkAssignTarget.scope === 'type' && bulkAssignTarget.typeId) {
      await assignProduct({
        scope: 'project',
        scopeRefId: null,
        elementTypeId: bulkAssignTarget.typeId,
        productId: product.id,
        assignmentType: 'manual',
      });
      toast(`Produkt přiřazen všem prvkům typu`);
    } else if (bulkAssignTarget.scope === 'room' && bulkAssignTarget.roomId) {
      await assignProduct({
        scope: 'room',
        scopeRefId: bulkAssignTarget.roomId,
        elementTypeId: null,
        productId: product.id,
        assignmentType: 'manual',
      });
      toast(`Produkt přiřazen všem prvkům v místnosti`);
    } else if (bulkAssignTarget.scope === 'element' && bulkAssignTarget.elementIds) {
      for (const elId of bulkAssignTarget.elementIds) {
        await assignProduct({
          scope: 'element',
          scopeRefId: elId,
          elementTypeId: null,
          productId: product.id,
          assignmentType: 'manual',
        });
      }
      toast('Produkt přiřazen');
    }

    await refetchAssignments();
    setShowProductPicker(false);
    setBulkAssignTarget(null);
  };

  const currentPickerElementTypeId = useMemo(() => {
    if (!bulkAssignTarget) return null;
    if (bulkAssignTarget.scope === 'type' && bulkAssignTarget.typeId) {
      return bulkAssignTarget.typeId;
    }
    if (bulkAssignTarget.scope === 'element' && bulkAssignTarget.elementIds?.length === 1) {
      const el = designElements.find((e) => e.id === bulkAssignTarget.elementIds![0]);
      return el?.element_type_id ?? null;
    }
    return null;
  }, [bulkAssignTarget, designElements]);

  const sortedAndFilteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    let filtered = products;

    if (q) {
      filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }

    if (!currentPickerElementTypeId) return filtered;

    return [...filtered].sort((a, b) => {
      const aCompat = compatibilityMap.getCompatibility(currentPickerElementTypeId, a.id);
      const bCompat = compatibilityMap.getCompatibility(currentPickerElementTypeId, b.id);

      const getPriority = (compat: string | null) => {
        if (compat === 'recommended') return 0;
        if (compat === 'compatible') return 1;
        if (compat === null) return 2;
        if (compat === 'incompatible') return 3;
        return 2;
      };

      return getPriority(aCompat) - getPriority(bCompat);
    });
  }, [products, productSearch, currentPickerElementTypeId, compatibilityMap]);

  const [showUnassignedWarning, setShowUnassignedWarning] = useState(false);

  const handleCreateQuote = async (includeUnassigned = false) => {
    if (!id) return;

    if (unassignedCount > 0 && !includeUnassigned && !showUnassignedWarning) {
      setShowUnassignedWarning(true);
      return;
    }

    setShowUnassignedWarning(false);
    setSaving(true);

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id ?? null;

    const elementsInGroups = new Set<string>();
    for (const group of groupsWithSlots) {
      for (const slot of group.slots) {
        if (slot.element_id) {
          elementsInGroups.add(slot.element_id);
        }
      }
    }

    const assignedElements = designElements.filter((el) =>
      getEffectiveProductId(el) && !elementsInGroups.has(el.id)
    );
    const unassignedElements = designElements.filter((el) =>
      !getEffectiveProductId(el) && !elementsInGroups.has(el.id)
    );

    const baseSections = buildQuoteSectionsFromAssignments(
      assignedElements,
      assignments,
      elementTypes,
      products,
      roomMap
    );

    const mountingGroupsInput: MountingGroupQuoteInput[] = groupsWithSlots.map((group) => ({
      id: group.id,
      frameSize: group.frame_size,
      orientation: group.orientation ?? 'horizontal',
      designSeriesId: group.design_series_id,
      colorName: group.color_name,
      label: group.label,
      roomName: group.room_id ? roomMap.get(group.room_id) ?? null : null,
      modules: group.slots.map((slot) => {
        if (slot.element_id) {
          const el = designElements.find((e) => e.id === slot.element_id);
          if (el) {
            const elType = elementTypes.find((t) => t.id === el.element_type_id);
            return elType?.slug ?? slot.module_name ?? '';
          }
        }
        return slot.module_name ?? '';
      }),
    }));

    const { sections: mountingGroupSections, warnings: mountingGroupWarnings } =
      buildQuoteSectionsFromMountingGroups(mountingGroupsInput, products, designSeriesLinks);

    const sections = mergeQuoteSections(baseSections, mountingGroupSections);

    if (mountingGroupWarnings.length > 0) {
      const warningMessages = mountingGroupWarnings.map((w) => w.message).join('; ');
      console.warn('Mounting group warnings:', warningMessages);
    }

    const unassignedItems = unassignedElements.map((el) => {
      const elType = getTypeById(el.element_type_id);
      return {
        elementId: el.id,
        elementTypeName: elType?.name ?? 'Neznámý prvek',
        quantity: el.quantity,
        roomName: el.room_id ? (roomMap.get(el.room_id) ?? null) : null,
      };
    });

    const { error } = await saveQuoteDirectly({
      projectId: id,
      userId,
      sections,
      globalDiscount: 0,
      note: unassignedItems.length > 0
        ? `Nabídka vygenerována ze schematického návrhu. ${unassignedItems.length} položek bez přiřazení.`
        : 'Nabídka vygenerována ze schematického návrhu',
      sourceType: 'manual',
      unassignedItems: unassignedItems.length > 0 ? unassignedItems : undefined,
    });

    setSaving(false);

    if (error) {
      toast(`Chyba: ${error}`);
    } else {
      toast('Nabídka vytvořena');
      navigate(`/projekty/${id}?tab=quotes`);
    }
  };

  if (loading || catalogLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/projekty/${id}/navrh`)}
                className="p-2 rounded-lg hover:bg-white/[0.06] transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-white">Přiřazení produktů</h1>
                <p className="text-xs text-slate-400">{project?.name}</p>
              </div>
            </div>

            <div className="hidden lg:block">
              <DesignWorkflowStepper
                currentStep="assign"
                onStepClick={(step) => {
                  if (step === 'design') {
                    navigate(`/projekty/${id}/navrh`);
                  } else if (step === 'summary') {
                    navigate(`/projekty/${id}?tab=assignments`);
                  } else if (step === 'quote') {
                    navigate(`/projekty/${id}?tab=quotes`);
                  }
                }}
                completedSteps={workflow.completedSteps}
                unassignedCount={workflow.unassignedCount}
                warningCount={workflow.warnings.length}
                canProceed={workflow.canProceed}
                compact
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/projekty/${id}?tab=assignments`)}
                disabled={designElements.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ClipboardList className="w-4 h-4" />
                Přejít do souhrnu
              </button>
              <button
                onClick={() => handleCreateQuote()}
                disabled={saving || designElements.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-slate-300 font-extrabold text-sm hover:bg-white/[0.08] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Vytvořit nabídku
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {designElements.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-700/50">
                  <Package className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-white">{assignmentStats.total}</div>
                  <div className="text-xs text-slate-500">prvků celkem</div>
                </div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <div className="text-2xl font-extrabold text-emerald-400">{assignmentStats.assigned}</div>
                <div className="text-xs text-slate-500">přiřazeno</div>
              </div>
              {assignmentStats.inherited > 0 && (
                <div className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-blue-400">{assignmentStats.inherited} zděděno</span>
                </div>
              )}
              <div className="h-10 w-px bg-white/10" />
              <div>
                <div className={`text-2xl font-extrabold ${assignmentStats.unassigned > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {assignmentStats.unassigned}
                </div>
                <div className="text-xs text-slate-500">nepřiřazeno</div>
              </div>
              {assignmentStats.unassigned === 0 && assignmentStats.total > 0 && (
                <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-400">Kompletni</span>
                </div>
              )}
            </div>
          </div>
        )}

        {designElements.length > 0 && (
          <div className="mb-6">
            <WorkflowCtaBanner
              nextRecommendedStep={workflow.nextRecommendedStep}
              stepStatuses={workflow.stepStatuses}
              currentStep="assign"
              contextStats={assignContextStats}
              onNavigateToStep={(step) => {
                if (step === 'design') navigate(`/projekty/${id}/navrh`);
                else if (step === 'assign') navigate(`/projekty/${id}/prirazeni`);
                else if (step === 'summary') navigate(`/projekty/${id}?tab=selection`);
                else if (step === 'quote') navigate(`/projekty/${id}?tab=quotes`);
              }}
              secondaryAction={
                assignmentStats.assigned > 0
                  ? {
                      label: 'Vytvorit nabidku',
                      onClick: () => navigate(`/projekty/${id}?tab=quotes`),
                    }
                  : undefined
              }
            />
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seskupit:</span>
            {(['type', 'room', 'category'] as GroupMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  groupMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {mode === 'type' ? 'Typ' : mode === 'room' ? 'Mistnost' : 'Kategorie'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtr:</span>
            {([
              { key: 'all', label: 'Vse' },
              { key: 'unassigned', label: 'Neprirazene' },
              { key: 'assigned', label: 'Prirazene' },
              { key: 'inherited', label: 'Zdedene' },
              { key: 'in_group', label: 'Ve viceramecku' },
            ] as { key: typeof filterMode; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === f.key
                    ? 'bg-slate-600 text-white'
                    : 'bg-white/[0.04] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <button onClick={expandAll} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
              Rozbalit vse
            </button>
            <span className="text-slate-600">|</span>
            <button onClick={collapseAll} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
              Sbalit vse
            </button>
          </div>
        </div>

        {designElements.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Žádné schematické prvky</h3>
            <p className="text-sm text-slate-400 mb-6">Nejprve přidejte prvky ve schematickém návrhu</p>
            <button
              onClick={() => navigate(`/projekty/${id}/navrh`)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition"
            >
              Přejít na návrh
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([key, group]) => {
              const isExpanded = expandedGroups.has(key);
              const assignedInGroup = group.elements.filter((el) => !!getEffectiveProductId(el)).length;

              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="font-extrabold text-white">{group.label}</span>
                      <span className="text-xs font-bold text-slate-500">
                        {assignedInGroup}/{group.elements.length} přiřazeno
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {groupMode === 'type' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkAssignByType(key); }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-bold hover:bg-blue-600/30 transition"
                        >
                          Přiřadit všem
                        </button>
                      )}
                      {groupMode === 'room' && key !== '__no_room__' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkAssignByRoom(key); }}
                          className="px-2.5 py-1 rounded-lg bg-teal-600/20 text-teal-400 text-xs font-bold hover:bg-teal-600/30 transition"
                        >
                          Přiřadit všem
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5">
                      {group.elements.map((el) => {
                        const elType = getTypeById(el.element_type_id);
                        const assignedProductId = getEffectiveProductId(el);
                        const assignedProduct = assignedProductId ? products.find((p) => p.id === assignedProductId) : null;
                        const roomName = el.room_id ? roomMap.get(el.room_id) : null;

                        return (
                          <div
                            key={el.id}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition border-b border-white/5 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: elType ? getCategoryColor(elType.category) : '#6b7280' }}
                              >
                                {renderPinIcon(elType?.icon || 'dot', 16, 'text-white')}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white">
                                  {elType?.name ?? 'Neznámý typ'}
                                  {el.quantity > 1 && <span className="ml-1 text-slate-400">x{el.quantity}</span>}
                                </div>
                                {roomName && groupMode !== 'room' && (
                                  <div className="text-xs text-slate-500">{roomName}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {assignedProduct ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-xs font-bold text-emerald-400">
                                      {assignedProduct.name}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleAssignSingle(el.id)}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                                  >
                                    Změnit
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAssignSingle(el.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  Přiřadit produkt
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {framePreview.frames.length > 0 && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center">
                <Grid className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white">Automaticky generovane ramecky</h3>
                <p className="text-xs text-slate-400">Na zaklade viceramecku a designovych rad</p>
              </div>
            </div>

            {framePreview.warnings.length > 0 && (
              <div className="mb-4 space-y-1">
                {framePreview.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-300">{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {framePreview.frames.map((frame, i) => {
                const orientLabel = frame.frameSize > 1 ? (frame.orientation === 'horizontal' ? 'vodorovny' : 'svisly') : '';
                const brandLabel = frame.seriesBrand ? `${frame.seriesBrand} ` : '';
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition ${
                      frame.hasMapping
                        ? 'bg-white/[0.02] border-white/5'
                        : 'bg-amber-500/5 border-amber-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">
                        {brandLabel}{frame.seriesName}
                      </span>
                      <span className="text-xs text-slate-400">
                        {frame.frameSize}R {orientLabel}
                      </span>
                      {frame.colorName && (
                        <span className="text-xs text-slate-500">({frame.colorName})</span>
                      )}
                      {!frame.hasMapping && frame.frameSize > 1 && (
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                          fallback
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{frame.count}x</span>
                      {frame.hasMapping ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Info className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showUnassignedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowUnassignedWarning(false)} />
          <div className="relative bg-slate-800 rounded-2xl border border-white/10 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-white">Nepřiřazené položky</h3>
                <p className="text-sm text-slate-400">{unassignedCount} prvků nemá přiřazený produkt</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              Chcete pokračovat a vytvořit nabídku? Nepřiřazené položky budou uvedeny pod čarou jako poznámka bez ceny. Zákazník si je může vybrat později.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnassignedWarning(false)}
                className="flex-1 px-4 py-2 rounded-xl bg-white/[0.06] text-slate-300 font-bold text-sm hover:bg-white/[0.08] transition"
              >
                Zpět k přiřazení
              </button>
              <button
                onClick={() => handleCreateQuote(true)}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition"
              >
                Pokračovat
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowProductPicker(false); setBulkAssignTarget(null); }} />
          <div className="relative bg-slate-800 rounded-2xl border border-white/10 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="font-extrabold text-white">Vyberte produkt</h3>
              <button
                onClick={() => { setShowProductPicker(false); setBulkAssignTarget(null); }}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Hledat produkt..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
              {sortedAndFilteredProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">Zadne produkty nenalezeny</div>
              ) : (
                <div className="space-y-1">
                  {sortedAndFilteredProducts.slice(0, 50).map((product) => {
                    const compat = currentPickerElementTypeId
                      ? compatibilityMap.getCompatibility(currentPickerElementTypeId, product.id)
                      : null;
                    const isRecommended = compat === 'recommended';
                    const isCompatible = compat === 'compatible';
                    const isIncompatible = compat === 'incompatible';

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
                          isIncompatible
                            ? 'opacity-50 hover:opacity-70 hover:bg-red-500/10'
                            : isRecommended
                            ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20'
                            : 'hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/[0.06] overflow-hidden shrink-0 relative">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                              {product.code.slice(0, 3)}
                            </div>
                          )}
                          {isRecommended && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Star className="w-2.5 h-2.5 text-white fill-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">{product.name}</span>
                            {isRecommended && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                Doporuceno
                              </span>
                            )}
                            {isCompatible && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
                                Kompatibilni
                              </span>
                            )}
                            {isIncompatible && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">
                                Nekompatibilni
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{product.brand} | {product.code}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-white">
                            {product.price?.toLocaleString('cs-CZ')} Kc
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
