import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard as EditIcon, Calendar, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import ProjectTabNav from '../../components/projects/ProjectTabNav';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete';
import ProjectTypeSelect from '../../components/ui/ProjectTypeSelect';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/auditLog';
import { useCatalogData } from '../../hooks/useCatalogData';
import { useMaterials } from '../../hooks/useMaterials';
import { useHeatingSystems } from '../../hooks/useHeatingSystems';
import { useProjectDesignElements } from '../../hooks/useProjectDesignElements';
import { useProductAssignments } from '../../hooks/useProductAssignments';
import { useMountingGroups } from '../../hooks/useMountingGroups';
import { useDesignSeriesLinks } from '../../hooks/useDesignSeriesLinks';
import { useDesignElementTypes } from '../../hooks/useDesignElementTypes';
import { resolveAllAssignments, computeAssignmentStats } from '../../lib/assignmentResolver';
import { loadProjectById } from '../../components/catalog/SaveLoadModals';
import ProjectHeader from '../../components/projects/ProjectHeader';
import ProjectOverviewTab from '../../components/projects/ProjectOverviewTab';
import ProjectDesignTab from '../../components/projects/ProjectDesignTab';
import ProjectSelectionTab from '../../components/projects/ProjectSelectionTab';
import ProjectQuotesTab from '../../components/projects/ProjectQuotesTab';
import QuoteBuilder from '../../components/catalog/QuoteBuilder';
import ExecutionTab from '../../components/execution/ExecutionTab';
import ProjectDocumentsTab from '../../components/documents/ProjectDocumentsTab';
import ProjectTasksTab from '../../components/projects/ProjectTasksTab';
import ProjectTimeTab from '../../components/projects/ProjectTimeTab';
import ProjectWarehouseTab from '../../components/projects/ProjectWarehouseTab';
import ProjectPhotosTab from '../../components/projects/ProjectPhotosTab';
import ProjectFilesTab from '../../components/projects/ProjectFilesTab';
import VicepraceTab from '../../components/projects/VicepraceTab';
import ProjectFinanceTab from '../../components/projects/ProjectFinanceTab';
import ProjectEmailTab from '../../components/projects/ProjectEmailTab';
import ProjectServiceTab from '../../components/projects/ProjectServiceTab';
import ProjectQuickJobsTab from '../../components/projects/ProjectQuickJobsTab';
import ProjectCustomFieldsTab from '../../components/projects/ProjectCustomFieldsTab';
import ProjectMeetingsTab from '../../components/projects/ProjectMeetingsTab';
import ProjectProtocolsTab from '../../components/protocols/ProjectProtocolsTab';
import ProjectRemarksTab from '../../components/projects/ProjectRemarksTab';
import ProjectAssignmentsTab from '../../components/projects/ProjectAssignmentsTab';
import type { SelectionState, ProjectMeta, Floor, Placement } from '../../hooks/useProjectState';
import type { Profile } from '../../types/database';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { WorkflowBadgeData } from '../../components/projects/ProjectTabNav';

interface ProjectTypeRow {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}


interface FvVersionOption {
  id: string;
  version_number: number;
  note: string;
  summary_panel_kwp: number;
  summary_panel_count: number;
  summary_inverter_kw: number;
  summary_battery_kwh: number;
  created_at: string;
}

interface CameraVersionOption {
  id: string;
  version_number: number;
  note: string;
  summary_camera_count: number;
  summary_total_price: number;
  created_at: string;
}

interface EpsVersionOption {
  id: string;
  version_number: number;
  note: string;
  summary_detector_count: number;
  summary_total_price: number;
  created_at: string;
}

export interface FvSummaryData {
  totalKwp: number;
  panelCount: number;
  inverterName: string;
  inverterKw: number;
  batteryName: string;
  batteryKwh: number;
  batteryCount: number;
  wallboxName: string;
  wallboxKw: number;
  totalInvestment: number;
  subsidy: number;
  annualProduction: number;
  selfConsumptionPct: number;
  roofCount: number;
  roofs: { name: string; panelCount: number; kwp: number; azimuth: number; tilt: number }[];
  accessories: { name: string; qty: number; price: number }[];
  laborCost: number;
  customItems: { name: string; qty: number; unit: string; unitPrice: number }[];
}

export interface CameraSummaryData {
  cameraCount: number;
  cameras: { modelName: string; count: number; price: number }[];
  nvrCount: number;
  nvrs: { name: string; count: number; price: number }[];
  switchCount: number;
  switches: { name: string; count: number; price: number }[];
  totalCableM: number;
  totalPrice: number;
  storageConfig: { codec: string; hoursPerDay: number; retentionDays: number };
  accessories: { name: string; qty: number; price: number }[];
}

export interface EpsSummaryData {
  detectorCount: number;
  totalElements: number;
  totalPrice: number;
  zones: number;
}

interface ProjectData {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  status: string;
  phase: string;
  address: string;
  address_lat: number | null;
  address_lon: number | null;
  description: string;
  deadline: string | null;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
}


const allStatuses = [
  { value: 'lead', label: 'Lead / Poptávka' },
  { value: 'design', label: 'Návrh' },
  { value: 'quote', label: 'Nabídka' },
  { value: 'approval', label: 'Schválení' },
  { value: 'in_progress', label: 'Realizace' },
  { value: 'completed', label: 'Dokončeno' },
  { value: 'cancelled', label: 'Zrušeno' },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [designData, setDesignData] = useState<{ selected: SelectionState; meta: ProjectMeta; floors: Floor[] } | null>(null);
  const [designLoading, setDesignLoading] = useState(false);
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [quotesRefresh, setQuotesRefresh] = useState(0);
  const [loadQuoteId, setLoadQuoteId] = useState<string | null>(null);
  const [docPrefilterType, setDocPrefilterType] = useState<string | undefined>(undefined);
  const [docAutoOpen, setDocAutoOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionDesignData, setVersionDesignData] = useState<{ selected: SelectionState; floors: Floor[] } | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [showServiceSetupModal, setShowServiceSetupModal] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string; interval_months: number }[]>([]);
  const [serviceEntries, setServiceEntries] = useState<{ service_type_id: string; installation_date: string; interval_value: number; interval_unit: 'months' | 'years' }[]>([]);
  const [savingService, setSavingService] = useState(false);
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [fvVersions, setFvVersions] = useState<FvVersionOption[]>([]);
  const [cameraVersions, setCameraVersions] = useState<CameraVersionOption[]>([]);
  const [epsVersions, setEpsVersions] = useState<EpsVersionOption[]>([]);
  const [selectedFvVersionId, setSelectedFvVersionId] = useState<string | null>(null);
  const [selectedCameraVersionId, setSelectedCameraVersionId] = useState<string | null>(null);
  const [selectedEpsVersionId, setSelectedEpsVersionId] = useState<string | null>(null);
  const [fvIncluded, setFvIncluded] = useState(true);
  const [cameraIncluded, setCameraIncluded] = useState(true);
  const [epsIncluded, setEpsIncluded] = useState(true);
  const [fvSummary, setFvSummary] = useState<FvSummaryData | null>(null);
  const [cameraSummary, setCameraSummary] = useState<CameraSummaryData | null>(null);
  const [epsSummary, setEpsSummary] = useState<EpsSummaryData | null>(null);
  const [fvSummaryLoading, setFvSummaryLoading] = useState(false);
  const [cameraSummaryLoading, setCameraSummaryLoading] = useState(false);
  const [epsSummaryLoading, setEpsSummaryLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    project_name: '',
    address: '',
    address_lat: null as number | null,
    address_lon: null as number | null,
    description: '',
    deadline: '',
  });
  const [projectTypes, setProjectTypes] = useState<ProjectTypeRow[]>([]);
  const [assignedTypeIds, setAssignedTypeIds] = useState<string[]>([]);
  const [editTypeIds, setEditTypeIds] = useState<string[]>([]);
  const [workflowBadges, setWorkflowBadges] = useState<WorkflowBadgeData>({});

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type) {
        setDocPrefilterType(detail.type);
        setDocAutoOpen(true);
      }
      setActiveTab('documents');
    };
    window.addEventListener('open-document-modal', handler);
    return () => window.removeEventListener('open-document-modal', handler);
  }, []);

  const { products, categories, designModules } = useCatalogData();
  const { materials } = useMaterials();
  const { systems: heatingSystems } = useHeatingSystems();

  const { elements: designElements, loading: designElementsLoading } = useProjectDesignElements(id);
  const { assignments: productAssignments, productKindMap, loading: assignmentsLoading } = useProductAssignments(id);
  const { groupsWithSlots: mountingGroups, loading: mountingGroupsLoading } = useMountingGroups(id);
  const { links: designSeriesLinks, loading: linksLoading } = useDesignSeriesLinks();
  const { types: elementTypes, loading: elementTypesLoading } = useDesignElementTypes();

  const schematicDataLoading = designElementsLoading || assignmentsLoading || mountingGroupsLoading || linksLoading || elementTypesLoading;

  const resolvedAssignments = useMemo(() => {
    if (!designElements.length) return new Map();
    return resolveAllAssignments(designElements, productAssignments, productKindMap);
  }, [designElements, productAssignments, productKindMap]);

  const assignmentStats = useMemo(() => {
    return computeAssignmentStats(resolvedAssignments);
  }, [resolvedAssignments]);

  const loadData = useCallback(async () => {
    if (!id) return;
    const [projectRes, profilesRes, auditRes, typesRes, assignmentsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('profiles').select('*'),
      supabase.from('audit_log').select('*').eq('entity_type', 'project').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('project_types').select('id, name, color, is_active').order('sort_order'),
      supabase.from('project_project_types').select('project_type_id').eq('project_id', id),
    ]);
    if (projectRes.data) setProject(projectRes.data as ProjectData);
    setProfiles((profilesRes.data || []) as Profile[]);
    setAuditEntries((auditRes.data || []) as AuditEntry[]);
    setProjectTypes((typesRes.data || []) as ProjectTypeRow[]);
    const ids = (assignmentsRes.data || []).map((a: { project_type_id: string }) => a.project_type_id);
    setAssignedTypeIds(ids);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!id) return;
    const loadWorkflowBadges = async () => {
      const [elementsRes, assignmentsRes, quotesRes, groupsRes] = await Promise.all([
        supabase.from('project_design_elements').select('id, element_type_id, room_id').eq('project_id', id),
        supabase.from('product_assignments').select('id, scope, scope_ref_id, element_type_id, product_id').eq('project_id', id),
        supabase.from('project_quotes').select('id', { count: 'exact', head: true }).eq('project_id', id),
        supabase.from('mounting_groups').select('id, design_series_id').eq('project_id', id),
      ]);

      const elements = (elementsRes.data || []) as { id: string; element_type_id: string; room_id: string | null }[];
      const assignments = (assignmentsRes.data || []) as { id: string; scope: string; scope_ref_id: string | null; element_type_id: string | null; product_id: string | null }[];
      const quotesCount = quotesRes.count ?? 0;
      const groups = (groupsRes.data || []) as { id: string; design_series_id: string | null }[];

      let unassignedCount = 0;
      for (const el of elements) {
        const directAssignment = assignments.find(
          (a) => a.scope === 'element' && a.scope_ref_id === el.id && a.product_id
        );
        if (directAssignment) continue;

        const roomAssignment = el.room_id
          ? assignments.find(
              (a) => a.scope === 'room' && a.scope_ref_id === el.room_id && a.element_type_id === el.element_type_id && a.product_id
            )
          : null;
        if (roomAssignment) continue;

        const projectAssignment = assignments.find(
          (a) => a.scope === 'project' && a.element_type_id === el.element_type_id && a.product_id
        );
        if (!projectAssignment) unassignedCount++;
      }

      const groupsWithoutSeries = groups.filter((g) => !g.design_series_id).length;
      const warningCount = groupsWithoutSeries;

      setWorkflowBadges({
        designElementCount: elements.length,
        unassignedCount,
        warningCount,
        quotesCount,
      });
    };
    loadWorkflowBadges();
  }, [id]);

  useEffect(() => {
    if ((activeTab === 'selection' || activeTab === 'quotes') && !designLoading && id) {
      setDesignLoading(true);
      loadProjectById(id).then((result) => {
        if (result) {
          setDesignData({
            selected: result.selected,
            meta: result.meta,
            floors: Array.isArray(result.floorsOrFp) ? result.floorsOrFp : [],
          });
        } else {
          setDesignData({ selected: {}, meta: { project: '', client: '', version: '' }, floors: [] });
        }
        setDesignLoading(false);
      });
    }
  }, [activeTab, id]);

  const loadVersionData = useCallback(async (versionId: string) => {
    setVersionLoading(true);
    const { data } = await supabase
      .from('design_versions')
      .select('selection_data, floorplan_data')
      .eq('id', versionId)
      .maybeSingle();

    if (data) {
      const sd = (data.selection_data ?? {}) as Record<string, { placements: Record<string, unknown>[] }>;
      const selected: SelectionState = {};
      for (const [pid, entry] of Object.entries(sd)) {
        if (entry && Array.isArray(entry.placements)) {
          selected[pid] = {
            placements: entry.placements.map((pl) => ({
              id: (pl.id as string) || crypto.randomUUID(),
              x: Number(pl.x ?? 0),
              y: Number(pl.y ?? 0),
              note: (pl.note as string) || '',
              ts: Number(pl.ts ?? Date.now()),
              floorId: (pl.floorId as string) || 'floor-1',
              ...(pl.config ? { config: pl.config as Placement['config'] } : {}),
              ...(pl.icon ? { icon: pl.icon as string } : {}),
              ...(pl.room ? { room: pl.room as string } : {}),
              ...(pl.circuitId ? { circuitId: pl.circuitId as string } : {}),
              ...(pl.mountingHeight ? { mountingHeight: pl.mountingHeight as string } : {}),
            })),
          };
        }
      }
      setVersionDesignData({
        selected,
        floors: Array.isArray(data.floorplan_data) ? data.floorplan_data as Floor[] : [],
      });
    }
    setVersionLoading(false);
  }, []);

  const handleViewVersion = useCallback((versionId: string | null) => {
    setSelectedVersionId(versionId);
    if (versionId) {
      loadVersionData(versionId);
      setActiveTab('selection');
    } else {
      setVersionDesignData(null);
    }
  }, [loadVersionData]);

  const loadFvVersions = useCallback(async () => {
    if (!orgId || !id) return;
    const { data: fvDesign } = await supabase
      .from('fv_designs')
      .select('id')
      .eq('project_id', id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!fvDesign) return;
    const { data } = await supabase
      .from('fv_design_versions')
      .select('id, version_number, note, summary_panel_kwp, summary_panel_count, summary_inverter_kw, summary_battery_kwh, created_at')
      .eq('fv_design_id', fvDesign.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setFvVersions((data ?? []) as FvVersionOption[]);
  }, [id, orgId]);

  const loadCameraVersions = useCallback(async () => {
    if (!orgId || !id) return;
    const { data: camDesign } = await supabase
      .from('camera_designs')
      .select('id')
      .eq('project_id', id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!camDesign) return;
    const { data } = await supabase
      .from('camera_design_versions')
      .select('id, version_number, note, summary_camera_count, summary_total_price, created_at')
      .eq('camera_design_id', camDesign.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setCameraVersions((data ?? []) as CameraVersionOption[]);
  }, [id, orgId]);

  const loadEpsVersions = useCallback(async () => {
    if (!orgId || !id) return;
    const { data: epsDesign } = await supabase
      .from('eps_designs')
      .select('id')
      .eq('project_id', id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!epsDesign) return;
    const { data } = await supabase
      .from('eps_design_versions')
      .select('id, version_number, note, summary_detector_count, summary_total_price, created_at')
      .eq('eps_design_id', epsDesign.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setEpsVersions((data ?? []) as EpsVersionOption[]);
  }, [id, orgId]);

  useEffect(() => {
    if ((activeTab === 'selection' || activeTab === 'design') && orgId && id) {
      loadFvVersions();
      loadCameraVersions();
      loadEpsVersions();
    }
  }, [activeTab, orgId, id, loadFvVersions, loadCameraVersions, loadEpsVersions]);

  const loadFvSummary = useCallback(async () => {
    if (!orgId || !id || !fvIncluded) { setFvSummary(null); return; }
    setFvSummaryLoading(true);

    let fvData: Record<string, unknown> | null = null;

    if (selectedFvVersionId) {
      const { data } = await supabase
        .from('fv_design_versions')
        .select('input_params, roofs, system_config, pvgis_results')
        .eq('id', selectedFvVersionId)
        .maybeSingle();
      fvData = data;
    } else {
      const { data } = await supabase
        .from('fv_designs')
        .select('input_params, roofs, system_config, pvgis_results')
        .eq('project_id', id)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      fvData = data;
    }

    if (!fvData) { setFvSummary(null); setFvSummaryLoading(false); return; }

    const roofs = (Array.isArray(fvData.roofs) ? fvData.roofs : []) as { name?: string; panelCount?: number; panelPowerWp?: number; azimuthDeg?: number; tiltDeg?: number }[];
    const sysConfig = (fvData.system_config ?? {}) as Record<string, unknown>;
    const pvgis = (fvData.pvgis_results ?? {}) as Record<string, unknown>;

    let totalKwp = 0;
    let panelCount = 0;
    const roofSummaries: FvSummaryData['roofs'] = [];
    for (const r of roofs) {
      const pc = r.panelCount ?? 0;
      const wp = r.panelPowerWp ?? 0;
      const kwp = (pc * wp) / 1000;
      totalKwp += kwp;
      panelCount += pc;
      roofSummaries.push({ name: r.name ?? 'Strecha', panelCount: pc, kwp, azimuth: r.azimuthDeg ?? 0, tilt: r.tiltDeg ?? 0 });
    }

    let inverterName = '';
    let inverterKw = 0;
    if (sysConfig.inverterId) {
      const { data: inv } = await supabase.from('fv_inverters').select('name, power_kw').eq('id', sysConfig.inverterId as string).maybeSingle();
      if (inv) { inverterName = inv.name; inverterKw = inv.power_kw; }
    }

    let batteryName = '';
    let batteryKwh = 0;
    const batteryCount = (sysConfig.batteryCount as number) ?? 0;
    if (sysConfig.batteryId && batteryCount > 0) {
      const { data: bat } = await supabase.from('fv_batteries').select('name, capacity_kwh').eq('id', sysConfig.batteryId as string).maybeSingle();
      if (bat) { batteryName = bat.name; batteryKwh = bat.capacity_kwh * batteryCount; }
    }

    let wallboxName = '';
    let wallboxKw = 0;
    if (sysConfig.wallboxId) {
      const { data: wb } = await supabase.from('fv_wallboxes').select('name, power_kw').eq('id', sysConfig.wallboxId as string).maybeSingle();
      if (wb) { wallboxName = wb.name; wallboxKw = wb.power_kw; }
    }

    const accItems = (sysConfig.accessories as { accessoryId: string; quantity: number }[] | undefined) ?? [];
    const accessorySummaries: FvSummaryData['accessories'] = [];
    for (const a of accItems) {
      if (a.quantity > 0) {
        const { data: acc } = await supabase.from('fv_accessories').select('name, price_per_unit').eq('id', a.accessoryId).maybeSingle();
        if (acc) accessorySummaries.push({ name: acc.name, qty: a.quantity, price: acc.price_per_unit * a.quantity });
      }
    }

    const customItems = ((sysConfig.customItems as { id: string; name: string; qty: number; unit: string; unitPrice: number }[] | undefined) ?? [])
      .filter(ci => ci.qty > 0);

    setFvSummary({
      totalKwp: Math.round(totalKwp * 100) / 100,
      panelCount,
      inverterName,
      inverterKw,
      batteryName,
      batteryKwh,
      batteryCount,
      wallboxName,
      wallboxKw,
      totalInvestment: (sysConfig.totalInvestmentCzk as number) ?? 0,
      subsidy: (sysConfig.subsidyCzk as number) ?? 0,
      annualProduction: (pvgis.annualProductionKwh as number) ?? 0,
      selfConsumptionPct: (pvgis.selfConsumptionPct as number) ?? 0,
      roofCount: roofs.length,
      roofs: roofSummaries,
      accessories: accessorySummaries,
      laborCost: (sysConfig.laborOverride as number) ?? (sysConfig.laborCost as number) ?? 0,
      customItems,
    });
    setFvSummaryLoading(false);
  }, [orgId, id, fvIncluded, selectedFvVersionId]);

  const loadCameraSummary = useCallback(async () => {
    if (!orgId || !id || !cameraIncluded) { setCameraSummary(null); return; }
    setCameraSummaryLoading(true);

    let camData: Record<string, unknown> | null = null;

    if (selectedCameraVersionId) {
      const { data } = await supabase
        .from('camera_design_versions')
        .select('design_data')
        .eq('id', selectedCameraVersionId)
        .maybeSingle();
      camData = data ? { design_data: data.design_data } : null;
    } else {
      const { data } = await supabase
        .from('camera_designs')
        .select('design_data')
        .eq('project_id', id)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      camData = data;
    }

    if (!camData || !camData.design_data) { setCameraSummary(null); setCameraSummaryLoading(false); return; }

    const dd = camData.design_data as { cameras?: { modelId: string; label: string }[]; routes?: { points: { x: number; y: number }[]; cableTypeId: string }[]; nvrs?: { nvrId: string }[]; switches?: { switchId: string }[]; storageConfig?: { codec: string; recordingHoursPerDay: number; retentionDays: number }; accessoryItems?: { accessoryId: string; quantity: number }[] };

    const cameras = dd.cameras ?? [];
    const cameraModelCounts: Record<string, number> = {};
    for (const c of cameras) { cameraModelCounts[c.modelId] = (cameraModelCounts[c.modelId] ?? 0) + 1; }

    const cameraSummaries: CameraSummaryData['cameras'] = [];
    let totalCamPrice = 0;
    for (const [modelId, count] of Object.entries(cameraModelCounts)) {
      const { data: model } = await supabase.from('camera_models').select('name, price').eq('id', modelId).maybeSingle();
      const price = (model?.price ?? 0) * count;
      totalCamPrice += price;
      cameraSummaries.push({ modelName: model?.name ?? modelId, count, price });
    }

    const nvrIdCounts: Record<string, number> = {};
    for (const n of dd.nvrs ?? []) { nvrIdCounts[n.nvrId] = (nvrIdCounts[n.nvrId] ?? 0) + 1; }
    const nvrSummaries: CameraSummaryData['nvrs'] = [];
    let totalNvrPrice = 0;
    for (const [nvrId, count] of Object.entries(nvrIdCounts)) {
      const { data: nvr } = await supabase.from('camera_nvrs').select('name, price').eq('id', nvrId).maybeSingle();
      const price = (nvr?.price ?? 0) * count;
      totalNvrPrice += price;
      nvrSummaries.push({ name: nvr?.name ?? nvrId, count, price });
    }

    const swIdCounts: Record<string, number> = {};
    for (const s of dd.switches ?? []) { swIdCounts[s.switchId] = (swIdCounts[s.switchId] ?? 0) + 1; }
    const switchSummaries: CameraSummaryData['switches'] = [];
    let totalSwPrice = 0;
    for (const [swId, count] of Object.entries(swIdCounts)) {
      const { data: sw } = await supabase.from('camera_poe_switches').select('name, price').eq('id', swId).maybeSingle();
      const price = (sw?.price ?? 0) * count;
      totalSwPrice += price;
      switchSummaries.push({ name: sw?.name ?? swId, count, price });
    }

    let totalCableM = 0;
    for (const route of dd.routes ?? []) {
      let len = 0;
      for (let i = 1; i < route.points.length; i++) {
        const dx = route.points[i].x - route.points[i - 1].x;
        const dy = route.points[i].y - route.points[i - 1].y;
        len += Math.sqrt(dx * dx + dy * dy);
      }
      totalCableM += len * 100;
    }

    const accItems = dd.accessoryItems ?? [];
    const accessorySummaries: CameraSummaryData['accessories'] = [];
    let totalAccPrice = 0;
    for (const a of accItems) {
      if (a.quantity > 0) {
        const { data: acc } = await supabase.from('camera_accessories').select('name, price').eq('id', a.accessoryId).maybeSingle();
        if (acc) {
          const price = acc.price * a.quantity;
          totalAccPrice += price;
          accessorySummaries.push({ name: acc.name, qty: a.quantity, price });
        }
      }
    }

    setCameraSummary({
      cameraCount: cameras.length,
      cameras: cameraSummaries,
      nvrCount: (dd.nvrs ?? []).length,
      nvrs: nvrSummaries,
      switchCount: (dd.switches ?? []).length,
      switches: switchSummaries,
      totalCableM: Math.round(totalCableM * 10) / 10,
      totalPrice: totalCamPrice + totalNvrPrice + totalSwPrice + totalAccPrice,
      storageConfig: dd.storageConfig
        ? { codec: dd.storageConfig.codec, hoursPerDay: (dd.storageConfig as { recordingHoursPerDay?: number }).recordingHoursPerDay ?? 24, retentionDays: dd.storageConfig.retentionDays }
        : { codec: 'h265', hoursPerDay: 24, retentionDays: 14 },
      accessories: accessorySummaries,
    });
    setCameraSummaryLoading(false);
  }, [orgId, id, cameraIncluded, selectedCameraVersionId]);

  const loadEpsSummary = useCallback(async () => {
    if (!orgId || !id || !epsIncluded) { setEpsSummary(null); return; }
    setEpsSummaryLoading(true);

    let epsData: Record<string, unknown> | null = null;

    if (selectedEpsVersionId) {
      const { data } = await supabase
        .from('eps_design_versions')
        .select('design_data')
        .eq('id', selectedEpsVersionId)
        .maybeSingle();
      epsData = data ? { design_data: data.design_data } : null;
    } else {
      const { data } = await supabase
        .from('eps_designs')
        .select('design_data')
        .eq('project_id', id)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      epsData = data ? { design_data: data.design_data } : null;
    }

    if (!epsData || !epsData.design_data) { setEpsSummary(null); setEpsSummaryLoading(false); return; }

    const dd = epsData.design_data as {
      layers?: { detectors?: { id: string; zoneId?: string }[] }[];
      zones?: { id: string }[];
      panels?: { panelId: string }[];
      sirens?: { sirenId: string }[];
      motionSensors?: { sensorId: string }[];
      keypads?: { keypadId: string }[];
      controlDevices?: { deviceId: string }[];
      accessoryItems?: { accessoryId: string; quantity: number }[];
      quoteConfig?: { laborCost?: number };
    };

    const allDetectors = (dd.layers ?? []).flatMap(l => l.detectors ?? []);
    const detectorCount = allDetectors.length;
    const zones = (dd.zones ?? []).length;

    const panelIds = (dd.panels ?? []).map(p => p.panelId);
    const sirenIds = (dd.sirens ?? []).map(s => s.sirenId);
    const sensorIds = (dd.motionSensors ?? []).map(s => s.sensorId);
    const keypadIds = (dd.keypads ?? []).map(k => k.keypadId);
    const deviceIds = (dd.controlDevices ?? []).map(d => d.deviceId);

    let totalPrice = 0;
    let totalElements = detectorCount;

    const uniqueDetectorIds = [...new Set(allDetectors.map(d => d.id))];
    if (uniqueDetectorIds.length > 0) {
      const { data: models } = await supabase.from('eps_detector_models').select('id, price').in('id', uniqueDetectorIds);
      if (models) {
        for (const det of allDetectors) {
          const m = models.find(mod => mod.id === det.id);
          if (m) totalPrice += m.price ?? 0;
        }
      }
    }

    const fetchPrices = async (table: string, ids: string[]) => {
      if (ids.length === 0) return 0;
      const unique = [...new Set(ids)];
      const { data } = await supabase.from(table).select('id, price').in('id', unique);
      if (!data) return 0;
      let sum = 0;
      for (const itemId of ids) {
        const row = data.find(d => d.id === itemId);
        if (row) sum += row.price ?? 0;
      }
      return sum;
    };

    totalPrice += await fetchPrices('eps_panels', panelIds);
    totalPrice += await fetchPrices('eps_sirens', sirenIds);
    totalPrice += await fetchPrices('eps_motion_sensors', sensorIds);
    totalPrice += await fetchPrices('eps_keypads', keypadIds);
    totalPrice += await fetchPrices('eps_control_devices', deviceIds);

    totalElements += panelIds.length + sirenIds.length + sensorIds.length + keypadIds.length + deviceIds.length;

    const accItems = dd.accessoryItems ?? [];
    for (const a of accItems) {
      if (a.quantity > 0) {
        const { data: acc } = await supabase.from('eps_accessories').select('price').eq('id', a.accessoryId).maybeSingle();
        if (acc) totalPrice += (acc.price ?? 0) * a.quantity;
        totalElements += a.quantity;
      }
    }

    totalPrice += dd.quoteConfig?.laborCost ?? 0;

    setEpsSummary({ detectorCount, totalElements, totalPrice, zones });
    setEpsSummaryLoading(false);
  }, [orgId, id, epsIncluded, selectedEpsVersionId]);

  useEffect(() => {
    if (activeTab === 'selection') {
      loadFvSummary();
      loadCameraSummary();
      loadEpsSummary();
    }
  }, [activeTab, loadFvSummary, loadCameraSummary, loadEpsSummary]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Projekty', href: '/projekty' },
        { label: project?.project_name || '...' },
      ],
      primaryAction: {
        label: 'Upravit',
        icon: <EditIcon className="w-4 h-4" />,
        onClick: () => {
          if (project) {
            setEditForm({
              project_name: project.project_name || '',
              address: project.address || '',
              address_lat: project.address_lat,
              address_lon: project.address_lon,
              description: project.description || '',
              deadline: project.deadline || '',
            });
            setEditTypeIds([...assignedTypeIds]);
            setShowEditModal(true);
          }
        },
      },
    });
  }, [setConfig, project]);

  const getProfileName = (userId: string | null) => {
    if (!userId) return '';
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email || '';
  };

  const handleStatusChange = async () => {
    if (!newStatus || !id || !project) return;
    setSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);

    if (error) {
      toast('Chyba při změně stavu', 'error');
      return;
    }

    await logAudit('project', id, 'status_changed', { from: project.status, to: newStatus });
    toast('Stav změněn');
    setShowStatusModal(false);

    if (newStatus === 'completed' && project.status !== 'completed') {
      const { data: types } = await supabase.from('service_types').select('id, name, interval_months').eq('is_active', true).order('sort_order');
      setServiceTypes((types || []) as { id: string; name: string; interval_months: number }[]);
      const today = new Date().toISOString().slice(0, 10);
      setServiceEntries((types || []).map((t: any) => {
        const intervalMonths = t.interval_months as number;
        const unit: 'months' | 'years' = intervalMonths >= 12 && intervalMonths % 12 === 0 ? 'years' : 'months';
        const value = unit === 'years' ? intervalMonths / 12 : intervalMonths;
        return { service_type_id: t.id, installation_date: today, interval_value: value, interval_unit: unit };
      }));
      setShowServiceSetupModal(true);
      return;
    }

    if (newStatus === 'cancelled') {
      navigate('/archiv');
      return;
    }

    loadData();
  };

  const computeNextDate = (installDate: string, value: number, unit: 'months' | 'years') => {
    if (!installDate || !value) return '';
    const d = new Date(installDate);
    d.setMonth(d.getMonth() + (unit === 'years' ? value * 12 : value));
    return d.toISOString().slice(0, 10);
  };

  const handleSaveServiceSetup = async () => {
    if (!id || !user || serviceEntries.length === 0) return;
    setSavingService(true);
    const rows = serviceEntries
      .filter(e => e.service_type_id && e.installation_date && e.interval_value > 0)
      .map(e => {
        const intervalMonths = e.interval_unit === 'years' ? e.interval_value * 12 : e.interval_value;
        return {
          project_id: id,
          service_type_id: e.service_type_id,
          installation_date: e.installation_date,
          interval_months: intervalMonths,
          next_date: computeNextDate(e.installation_date, e.interval_value, e.interval_unit),
          created_by: user.id,
        };
      });
    if (rows.length > 0) {
      const { error } = await supabase.from('service_schedules').insert(rows);
      if (error) { toast('Chyba při ukládání servisů', 'error'); setSavingService(false); return; }
    }
    setSavingService(false);
    toast(`Naplánováno ${rows.length} servisů`);
    setShowServiceSetupModal(false);
    navigate('/archiv');
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({
        project_name: editForm.project_name,
        address: editForm.address,
        address_lat: editForm.address_lat,
        address_lon: editForm.address_lon,
        description: editForm.description,
        deadline: editForm.deadline || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      setSaving(false);
      toast('Chyba při ukládání', 'error');
      return;
    }

    await supabase.from('project_project_types').delete().eq('project_id', id);
    if (editTypeIds.length > 0) {
      await supabase.from('project_project_types').insert(
        editTypeIds.map(tid => ({ project_id: id, project_type_id: tid }))
      );
    }

    setSaving(false);
    await logAudit('project', id, 'updated', {});
    toast('Projekt aktualizován');
    setShowEditModal(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!id || !confirm('Opravdu chcete projekt smazat? Tato akce jej označí jako zrušený.')) return;
    setSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);

    if (error) {
      toast('Chyba při mazání', 'error');
      return;
    }

    await logAudit('project', id, 'deleted', {});
    toast('Projekt byl zrušen');
    navigate('/archiv');
  };

  const handlePermanentDelete = async () => {
    if (!id || !isAdmin) return;
    if (!confirm('TRVALE smazat projekt a VŠECHNA jeho data? Tuto akci nelze vrátit!')) return;
    if (!confirm('Jste si opravdu jisti? Všechny nabídky, zakázky, soubory a záznamy budou nenávratně ztraceny.')) return;
    setSaving(true);

    const { data: jobRows } = await supabase.from('jobs').select('id').eq('project_id', id);
    const jobIds = (jobRows || []).map((j: { id: string }) => j.id);

    if (jobIds.length > 0) {
      await Promise.all([
        supabase.from('job_worklogs').delete().in('job_id', jobIds),
        supabase.from('job_material_entries').delete().in('job_id', jobIds),
        supabase.from('job_diary_entries').delete().in('job_id', jobIds),
      ]);
    }

    await Promise.all([
      supabase.from('jobs').delete().eq('project_id', id),
      supabase.from('project_quotes').delete().eq('project_id', id),
      supabase.from('project_defects').delete().eq('project_id', id),
      supabase.from('tasks').delete().eq('project_id', id),
      supabase.from('execution_viceprace').delete().eq('project_id', id),
      supabase.from('project_documents').delete().eq('project_id', id),
      supabase.from('project_files').delete().eq('project_id', id),
      supabase.from('project_project_types').delete().eq('project_id', id),
      supabase.from('service_schedules').delete().eq('project_id', id),
      supabase.from('service_protocols').delete().eq('project_id', id),
      supabase.from('project_protocols').delete().eq('project_id', id),
      supabase.from('audit_log').delete().eq('entity_type', 'project').eq('entity_id', id),
    ]);

    const { error } = await supabase.from('projects').delete().eq('id', id);
    setSaving(false);

    if (error) {
      toast('Chyba při mazání projektu', 'error');
      return;
    }

    toast('Projekt byl trvale smazán');
    navigate('/projekty');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 bg-navy-800/60 rounded-2xl border border-white/[0.08] animate-skeleton" />
        <div className="h-72 bg-navy-800/60 rounded-2xl border border-white/[0.08] animate-skeleton" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 text-slate-200">404</div>
        <p className="text-slate-400">Projekt nenalezen</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProjectHeader
        project={project}
        responsibleName={getProfileName(project.responsible_user_id)}
        assignedTypes={projectTypes.filter(t => assignedTypeIds.includes(t.id))}
        onStatusClick={() => {
          setNewStatus(project.status);
          setShowStatusModal(true);
        }}
        onClientClick={() => project.client_id && navigate(`/crm/${project.client_id}`)}
      />

      <div data-tour="project-tabs-section" className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08]">
        <ProjectTabNav active={activeTab} onChange={setActiveTab} workflowBadges={workflowBadges} />

        <div className="p-5">
          {activeTab === 'overview' && (
            <ProjectOverviewTab
              project={project}
              auditEntries={auditEntries}
              getProfileName={getProfileName}
              onClientChange={(clientId, clientName) => {
                setProject(prev => prev ? { ...prev, client_id: clientId, client_name: clientName } : prev);
              }}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'specs' && (
            <ProjectCustomFieldsTab projectId={project.id} />
          )}

          {activeTab === 'design' && (
            <ProjectDesignTab
              projectId={project.id}
              onViewVersion={handleViewVersion}
            />
          )}

          {activeTab === 'assignments' && (
            <ProjectAssignmentsTab projectId={project.id} />
          )}

          {activeTab === 'selection' && (
            <ProjectSelectionTab
              selected={selectedVersionId && versionDesignData ? versionDesignData.selected : (designData?.selected ?? {})}
              products={products}
              categories={categories}
              floors={selectedVersionId && versionDesignData ? versionDesignData.floors : (designData?.floors ?? [])}
              materials={materials}
              heatingSystems={heatingSystems}
              designModules={designModules}
              loading={selectedVersionId ? versionLoading : designLoading}
              projectName={project.project_name}
              clientName={project.client_name}
              projectId={project.id}
              selectedVersionId={selectedVersionId}
              onVersionChange={handleViewVersion}
              fvVersions={fvVersions}
              cameraVersions={cameraVersions}
              selectedFvVersionId={selectedFvVersionId}
              selectedCameraVersionId={selectedCameraVersionId}
              onFvVersionChange={(vid) => { setSelectedFvVersionId(vid); if (vid === '__exclude') setFvIncluded(false); else setFvIncluded(true); }}
              onCameraVersionChange={(vid) => { setSelectedCameraVersionId(vid); if (vid === '__exclude') setCameraIncluded(false); else setCameraIncluded(true); }}
              fvIncluded={fvIncluded}
              cameraIncluded={cameraIncluded}
              fvSummary={fvSummary}
              cameraSummary={cameraSummary}
              fvSummaryLoading={fvSummaryLoading}
              cameraSummaryLoading={cameraSummaryLoading}
              epsVersions={epsVersions}
              selectedEpsVersionId={selectedEpsVersionId}
              onEpsVersionChange={(vid) => { setSelectedEpsVersionId(vid); if (vid === '__exclude') setEpsIncluded(false); else setEpsIncluded(true); }}
              epsIncluded={epsIncluded}
              epsSummary={epsSummary}
              epsSummaryLoading={epsSummaryLoading}
              designElements={designElements}
              productAssignments={productAssignments}
              mountingGroups={mountingGroups}
              designSeriesLinks={designSeriesLinks}
              elementTypes={elementTypes}
              resolvedAssignments={resolvedAssignments}
              assignmentStats={assignmentStats}
              productKindMap={productKindMap}
              schematicDataLoading={schematicDataLoading}
            />
          )}

          {activeTab === 'quotes' && (
            <ProjectQuotesTab
              projectId={project.id}
              profiles={profiles}
              onNewQuote={() => { setLoadQuoteId(null); setShowQuoteBuilder(true); }}
              onOpenQuote={(qId) => { setLoadQuoteId(qId); setShowQuoteBuilder(true); }}
              refreshTrigger={quotesRefresh}
            />
          )}

          {activeTab === 'execution' && (
            <ExecutionTab projectId={project.id} />
          )}

          {activeTab === 'viceprace' && (
            <VicepraceTab projectId={project.id} profiles={profiles} />
          )}

          {activeTab === 'quickjobs' && (
            <ProjectQuickJobsTab
              projectId={project.id}
              projectName={project.project_name}
              clientId={project.client_id ?? undefined}
              clientName={project.client_name}
              address={project.address}
              addressLat={project.address_lat}
              addressLon={project.address_lon}
            />
          )}

          {activeTab === 'documents' && (
            <ProjectDocumentsTab
              projectId={project.id}
              prefilterType={docPrefilterType}
              autoOpenModal={docAutoOpen}
              onModalClosed={() => { setDocAutoOpen(false); setDocPrefilterType(undefined); }}
            />
          )}

          {activeTab === 'tasks' && (
            <ProjectTasksTab projectId={project.id} />
          )}

          {activeTab === 'time' && (
            <ProjectTimeTab projectId={project.id} />
          )}

          {activeTab === 'finance' && (
            <ProjectFinanceTab projectId={project.id} />
          )}

          {activeTab === 'files' && (
            <ProjectFilesTab projectId={project.id} />
          )}

          {activeTab === 'warehouse' && (
            <ProjectWarehouseTab projectId={project.id} />
          )}

          {activeTab === 'photos' && (
            <ProjectPhotosTab projectId={project.id} />
          )}

          {activeTab === 'meetings' && (
            <ProjectMeetingsTab projectId={project.id} clientId={project.client_id} />
          )}

          {activeTab === 'email' && (
            <ProjectEmailTab projectId={project.id} clientId={project.client_id} />
          )}

          {activeTab === 'service' && (
            <ProjectServiceTab projectId={project.id} />
          )}
          {activeTab === 'protocols' && (
            <ProjectProtocolsTab projectId={project.id} />
          )}
          {activeTab === 'remarks' && (
            <ProjectRemarksTab projectId={project.id} />
          )}
        </div>
      </div>

      <Modal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Změnit stav projektu"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors">Zrušit</button>
            <button
              onClick={handleStatusChange}
              disabled={saving || newStatus === project.status}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Změnit stav'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {allStatuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setNewStatus(s.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                newStatus === s.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <StatusBadge status={s.value} />
              <span className="text-sm text-slate-300">{s.label}</span>
              {s.value === project.status && (
                <span className="ml-auto text-xs text-slate-400">aktuální</span>
              )}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Upravit projekt"
        size="lg"
        footer={
          <>
            <div className="mr-auto flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition"
              >
                Zrušit projekt
              </button>
              {isAdmin && (
                <button
                  onClick={handlePermanentDelete}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition"
                >
                  Trvale smazat
                </button>
              )}
            </div>
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editForm.project_name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název projektu *</label>
            <input
              value={editForm.project_name}
              onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Adresa stavby</label>
            <AddressAutocomplete
              value={editForm.address}
              lat={editForm.address_lat}
              lon={editForm.address_lon}
              onChange={(address, lat, lon) => setEditForm({ ...editForm, address, address_lat: lat, address_lon: lon })}
              placeholder="Vyhledejte adresu stavby..."
              includeClients
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Termín dokončení</label>
            <input
              type="date"
              value={editForm.deadline}
              onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            />
          </div>
          {projectTypes.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Typ projektu</label>
              <ProjectTypeSelect
                selectedIds={editTypeIds}
                onChange={setEditTypeIds}
              />
            </div>
          )}
        </div>
      </Modal>

      <QuoteBuilder
        open={showQuoteBuilder}
        onClose={() => setShowQuoteBuilder(false)}
        products={products}
        categories={categories}
        selected={designData?.selected ?? {}}
        meta={designData?.meta ?? { project: project.project_name || '', client: project.client_name || '', version: '' }}
        floors={designData?.floors ?? []}
        materials={materials}
        heatingSystems={heatingSystems}
        projectId={project.id}
        onSaved={() => setQuotesRefresh(r => r + 1)}
        loadQuoteId={loadQuoteId}
        designElements={designElements}
        elementTypes={elementTypes}
        productAssignments={productAssignments}
        mountingGroups={mountingGroups}
        designSeriesLinks={designSeriesLinks}
        productKindMap={productKindMap}
      />

      <Modal
        open={showServiceSetupModal}
        onClose={() => { setShowServiceSetupModal(false); navigate('/archiv'); }}
        title="Naplánovat servisy a revize"
        size="lg"
        footer={
          <>
            <button onClick={() => { setShowServiceSetupModal(false); navigate('/archiv'); }} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Přeskočit</button>
            <button
              onClick={handleSaveServiceSetup}
              disabled={savingService || serviceEntries.length === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {savingService ? 'Ukládám...' : `Naplánovat ${serviceEntries.length} servisů`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Projekt byl dokončen. Zadejte datum instalace a interval pro jednotlivé servisy.
          </p>

          <div className="space-y-3">
            {serviceEntries.map((entry, idx) => {
              const nextDate = computeNextDate(entry.installation_date, entry.interval_value, entry.interval_unit);
              return (
                <div key={idx} className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <select
                      value={entry.service_type_id}
                      onChange={e => {
                        const updated = [...serviceEntries];
                        const selType = serviceTypes.find(t => t.id === e.target.value);
                        const intMonths = selType?.interval_months || 12;
                        const unit: 'months' | 'years' = intMonths >= 12 && intMonths % 12 === 0 ? 'years' : 'months';
                        const value = unit === 'years' ? intMonths / 12 : intMonths;
                        updated[idx] = { ...updated[idx], service_type_id: e.target.value, interval_value: value, interval_unit: unit };
                        setServiceEntries(updated);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {serviceTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setServiceEntries(serviceEntries.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Datum instalace</label>
                      <input
                        type="date"
                        value={entry.installation_date}
                        onChange={e => {
                          const updated = [...serviceEntries];
                          updated[idx] = { ...updated[idx], installation_date: e.target.value };
                          setServiceEntries(updated);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Interval</label>
                      <input
                        type="number"
                        min={1}
                        value={entry.interval_value}
                        onChange={e => {
                          const updated = [...serviceEntries];
                          updated[idx] = { ...updated[idx], interval_value: Math.max(1, parseInt(e.target.value) || 1) };
                          setServiceEntries(updated);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">&nbsp;</label>
                      <select
                        value={entry.interval_unit}
                        onChange={e => {
                          const updated = [...serviceEntries];
                          updated[idx] = { ...updated[idx], interval_unit: e.target.value as 'months' | 'years' };
                          setServiceEntries(updated);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="months">měsíců</option>
                        <option value="years">let</option>
                      </select>
                    </div>
                    {nextDate && (
                      <div className="flex-1 min-w-[120px] text-right">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Příští servis</label>
                        <div className="text-sm font-semibold text-blue-400 py-1.5">
                          {new Date(nextDate).toLocaleDateString('cs-CZ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setServiceEntries([...serviceEntries, { service_type_id: serviceTypes[0]?.id || '', installation_date: new Date().toISOString().slice(0, 10), interval_value: 12, interval_unit: 'months' }])}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Přidat další servis
          </button>
        </div>
      </Modal>
    </div>
  );
}
