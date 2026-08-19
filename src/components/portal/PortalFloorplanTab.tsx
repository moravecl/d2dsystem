import { useState, useEffect, useMemo, useCallback, Component, type ReactNode } from 'react';
import { Map as MapIcon, Loader2, GitBranch, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCatalogData } from '../../hooks/useCatalogData';
import { useMaterials } from '../../hooks/useMaterials';
import { useHeatingSystems } from '../../hooks/useHeatingSystems';
import { listAllPins, listAllPinsGlobal } from '../catalog/floorplan/pinUtils';
import type { SelectionState, Floor, Placement } from '../../hooks/useProjectState';
import SummaryFloorplanView from '../catalog/summary/SummaryFloorplanView';
import SummaryTradePrint from '../catalog/summary/SummaryTradePrint';
import SummaryHeatingPrint from '../catalog/summary/SummaryHeatingPrint';

interface DesignVersionOption {
  id: string;
  label: string;
  version_number: number;
  created_at: string;
}

function parseSelectionData(raw: unknown): SelectionState {
  const selected: SelectionState = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return selected;
  const sd = raw as Record<string, { placements: Record<string, unknown>[] }>;
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
  return selected;
}

function parseFloors(raw: unknown): Floor[] {
  if (Array.isArray(raw)) return raw as Floor[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Floor[];
    } catch { /* ignore */ }
  }
  return [];
}

class FloorplanErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400 mb-1">Chyba při zobrazení půdorysu</p>
          <p className="text-xs text-slate-400 mb-4">Data mohou být poškozená nebo neúplná</p>
          <button
            onClick={() => { this.setState({ hasError: false }); this.props.onRetry(); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.08] rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Zkusit znovu
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PortalFloorplanTab({ projectId }: { projectId: string }) {
  const { products, categories, loading: catalogLoading } = useCatalogData();
  const { materials, loading: materialsLoading } = useMaterials();
  const { systems: heatingSystems, loading: heatingLoading } = useHeatingSystems();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectionState>({});
  const [floors, setFloors] = useState<Floor[]>([]);
  const [versions, setVersions] = useState<DesignVersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    supabase
      .from('design_versions')
      .select('id, label, version_number, created_at')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as DesignVersionOption[]);
      });
  }, [projectId]);

  const loadProjectData = useCallback(async () => {
    try {
      const { data: proj, error: err } = await supabase
        .from('projects')
        .select('selection_data, floorplan_url')
        .eq('id', projectId)
        .maybeSingle();

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      if (proj) {
        setSelected(parseSelectionData(proj.selection_data));
        setFloors(parseFloors(proj.floorplan_url));
      }
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při načítání dat');
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadProjectData(); }, [loadProjectData]);

  const loadVersionData = useCallback(async (versionId: string) => {
    setVersionLoading(true);
    try {
      const { data } = await supabase
        .from('design_versions')
        .select('selection_data, floorplan_data')
        .eq('id', versionId)
        .maybeSingle();

      if (data) {
        setSelected(parseSelectionData(data.selection_data));
        setFloors(Array.isArray(data.floorplan_data) ? data.floorplan_data as Floor[] : []);
      }
    } catch { /* ignore */ }
    setVersionLoading(false);
  }, []);

  const handleVersionChange = (versionId: string | null) => {
    setSelectedVersionId(versionId);
    if (versionId) {
      loadVersionData(versionId);
    } else {
      setLoading(true);
      setError(null);
      loadProjectData();
    }
  };

  const floorsWithImages = useMemo(() => floors.filter(f => f.floorplanImg), [floors]);

  const roomIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const floor of floors) {
      for (const room of floor.rooms ?? []) map.set(room.id, room.name);
    }
    return (id: string) => map.get(id) ?? id;
  }, [floors]);

  const allPins = useMemo(() => listAllPinsGlobal(selected, products), [selected, products]);

  const hasCableData = useMemo(() => floors.some(f => (f.cables ?? []).length > 0), [floors]);

  const allLoading = loading || versionLoading || catalogLoading || materialsLoading || heatingLoading;

  if (allLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  if (floorsWithImages.length === 0) {
    return (
      <div className="space-y-4">
        {versions.length > 0 && (
          <VersionSelector
            versions={versions}
            selectedVersionId={selectedVersionId}
            onVersionChange={handleVersionChange}
          />
        )}
        <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
          <MapIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Půdorys není k dispozici</p>
        </div>
      </div>
    );
  }

  return (
    <FloorplanErrorBoundary key={retryKey} onRetry={() => { setRetryKey(k => k + 1); loadProjectData(); }}>
      <div className="space-y-6">
        {versions.length > 0 && (
          <VersionSelector
            versions={versions}
            selectedVersionId={selectedVersionId}
            onVersionChange={handleVersionChange}
          />
        )}

        {floorsWithImages.map((floor) => (
          <SummaryFloorplanView
            key={floor.id}
            floor={floor}
            floors={floors}
            floorPins={listAllPins(selected, products, floor.id)}
            products={products}
            categories={categories}
            heatingSystems={heatingSystems}
            roomIdToName={roomIdToName}
          />
        ))}

        {(hasCableData || allPins.length > 0) && (
          <SummaryTradePrint
            floors={floors}
            products={products}
            categories={categories}
            selected={selected}
            heatingSystems={heatingSystems}
            roomIdToName={roomIdToName}
            getWastePercent={() => 0}
            getMaterialPrice={(name) => materials.find(m => m.name === name)?.price_per_unit ?? 0}
            alwaysVisible
          />
        )}

        <SummaryHeatingPrint
          floors={floors}
          heatingSystems={heatingSystems}
          alwaysVisible
        />

        <p className="text-xs text-slate-400 text-center">
          Zobrazení pouze pro čtení. Pro úpravy kontaktujte svého projektanta.
        </p>
      </div>
    </FloorplanErrorBoundary>
  );
}

function VersionSelector({
  versions,
  selectedVersionId,
  onVersionChange,
}: {
  versions: DesignVersionOption[];
  selectedVersionId: string | null;
  onVersionChange: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.08]">
      <GitBranch className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-xs font-semibold text-slate-500">Verze:</span>
      <select
        value={selectedVersionId ?? ''}
        onChange={(e) => onVersionChange(e.target.value || null)}
        className="px-3 py-1.5 text-sm font-medium border border-white/10 rounded-lg bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
      >
        <option value="">Aktuální pracovní verze</option>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} (V{v.version_number})
          </option>
        ))}
      </select>
      {selectedVersionId && (
        <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold">
          Prohlížení uložené verze
        </span>
      )}
    </div>
  );
}
