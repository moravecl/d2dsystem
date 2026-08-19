import { useMemo, useState, useEffect, useCallback } from 'react';
import { Package, MapPin, Layers, DollarSign, FileDown, Loader2, GitBranch } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product, Category, Material } from '../../types/database';
import type { SelectionState, Floor, Placement } from '../../hooks/useProjectState';
import { useCatalogData } from '../../hooks/useCatalogData';
import { useMaterials } from '../../hooks/useMaterials';
import { useHeatingSystems } from '../../hooks/useHeatingSystems';
import { loadProjectById } from '../catalog/SaveLoadModals';
import { exportSelectionPdf } from '../projects/selectionPdfExport';
import { listAllPinsGlobal } from '../catalog/floorplan/pinUtils';
import { polylineLength, normalizedToMeters } from '../catalog/floorplan/geometry';
import { useCategoryColors } from '../../hooks/useCategoryColors';

interface DesignVersionOption {
  id: string;
  label: string;
  version_number: number;
  created_at: string;
}

interface Props {
  projectId: string;
}

export default function PortalSelectionTab({ projectId }: Props) {
  const { products, categories } = useCatalogData();
  const { materials } = useMaterials();
  const { systems: heatingSystems } = useHeatingSystems();
  const { colorMap: categoryColorMap } = useCategoryColors();
  const [loading, setLoading] = useState(true);
  const [designData, setDesignData] = useState<{ selected: SelectionState; floors: Floor[]; projectName: string; clientName: string } | null>(null);
  const [versions, setVersions] = useState<DesignVersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

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

  useEffect(() => {
    loadProjectById(projectId).then(async (result) => {
      if (result) {
        const { data: proj } = await supabase.from('projects').select('project_name, client_name').eq('id', projectId).maybeSingle();
        setDesignData({
          selected: result.selected,
          floors: Array.isArray(result.floorsOrFp) ? result.floorsOrFp : [],
          projectName: proj?.project_name || '',
          clientName: proj?.client_name || '',
        });
      } else {
        setDesignData({ selected: {}, floors: [], projectName: '', clientName: '' });
      }
      setLoading(false);
    });
  }, [projectId]);

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
      setDesignData((prev) => prev ? {
        ...prev,
        selected,
        floors: Array.isArray(data.floorplan_data) ? data.floorplan_data as Floor[] : [],
      } : null);
    }
    setVersionLoading(false);
  }, []);

  const handleVersionChange = (versionId: string | null) => {
    setSelectedVersionId(versionId);
    if (versionId) {
      loadVersionData(versionId);
    } else {
      setLoading(true);
      loadProjectById(projectId).then(async (result) => {
        if (result) {
          const { data: proj } = await supabase.from('projects').select('project_name, client_name').eq('id', projectId).maybeSingle();
          setDesignData({
            selected: result.selected,
            floors: Array.isArray(result.floorsOrFp) ? result.floorsOrFp : [],
            projectName: proj?.project_name || '',
            clientName: proj?.client_name || '',
          });
        }
        setLoading(false);
      });
    }
  };

  const selectedProducts = useMemo(() => {
    if (!designData) return [];
    return Object.keys(designData.selected)
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as Product[];
  }, [designData, products]);

  const allPins = useMemo(() => {
    if (!designData) return [];
    return listAllPinsGlobal(designData.selected, products);
  }, [designData, products]);

  const groupedByCat = useMemo(() => {
    return categories
      .map((cat) => ({
        cat,
        items: selectedProducts.filter((p) => p.category_id === cat.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [categories, selectedProducts]);

  const totalProductPrice = useMemo(() => {
    if (!designData) return 0;
    return selectedProducts.reduce(
      (sum, p) => sum + p.price * (designData.selected[p.id]?.placements?.length ?? 0),
      0
    );
  }, [selectedProducts, designData]);

  const allRooms = useMemo(() => {
    if (!designData) return [];
    const rooms: { id: string; name: string }[] = [];
    for (const floor of designData.floors) {
      for (const room of floor.rooms ?? []) rooms.push({ id: room.id, name: room.name });
    }
    return rooms;
  }, [designData]);

  const materialTotals = useMemo(() => {
    if (!designData) return [];
    const totals: Record<string, { name: string; rawLength: number; unit: string; pricePerUnit: number }> = {};
    for (const floor of designData.floors) {
      for (const cable of floor.cables ?? []) {
        if (!cable.materialName) continue;
        const normalized = polylineLength(cable.points);
        const lengthM = floor.scale ? normalizedToMeters(normalized, floor.scale) : 0;
        if (!totals[cable.materialName]) {
          const mat = materials.find((m) => m.name === cable.materialName);
          totals[cable.materialName] = {
            name: cable.materialName,
            rawLength: 0,
            unit: mat?.unit ?? 'm',
            pricePerUnit: mat?.price_per_unit ?? 0,
          };
        }
        totals[cable.materialName].rawLength += lengthM;
      }
    }
    return Object.values(totals);
  }, [designData, materials]);

  const totalMaterialPrice = useMemo(() => {
    return materialTotals.reduce((sum, mat) => sum + mat.rawLength * mat.pricePerUnit, 0);
  }, [materialTotals]);

  const grandTotal = totalProductPrice + totalMaterialPrice;

  const handleExportPdf = () => {
    if (!designData) return;
    exportSelectionPdf({
      selected: designData.selected,
      products,
      categories,
      floors: designData.floors,
      materials,
      heatingSystems,
      wastePercents: {},
      designModules: [],
      projectName: designData.projectName,
      clientName: designData.clientName,
      categoryColorMap,
    });
  };

  if (loading || versionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (selectedProducts.length === 0) {
    return (
      <div className="space-y-4">
        {versions.length > 0 && (
          <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.08]">
            <GitBranch className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-500">Verze:</span>
            <select
              value={selectedVersionId ?? ''}
              onChange={(e) => handleVersionChange(e.target.value || null)}
              className="px-3 py-1.5 text-sm font-medium border border-white/10 rounded-lg bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
            >
              <option value="">Aktuální pracovní verze</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} (V{v.version_number})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Zatím žádné vybrané produkty</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {versions.length > 0 && (
        <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.08]">
          <GitBranch className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500">Verze:</span>
          <select
            value={selectedVersionId ?? ''}
            onChange={(e) => handleVersionChange(e.target.value || null)}
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
      )}

      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Produktu</span>
            </div>
            <div className="text-xl font-extrabold text-white">{selectedProducts.length}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Umístěno</span>
            </div>
            <div className="text-xl font-extrabold text-white">{allPins.length}</div>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Místnosti</span>
            </div>
            <div className="text-xl font-extrabold text-white">{allRooms.length}</div>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Cena celkem</span>
            </div>
            <div className="text-xl font-extrabold text-white">
              {grandTotal > 0 ? `${grandTotal.toLocaleString('cs-CZ')} Kč` : '-'}
            </div>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-semibold"
        >
          <FileDown className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      <div className="space-y-4">
        {groupedByCat.map(({ cat, items }) => (
          <div key={cat.id} className="rounded-xl border border-white/10 overflow-hidden">
            <div className={`${cat.soft_color || 'bg-white/[0.04]'} px-4 py-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${cat.pill_color || 'bg-slate-400'} text-white flex items-center justify-center `}>
                  <span className="text-xs font-extrabold">{items.length}</span>
                </div>
                <span className={`text-sm font-extrabold ${cat.text_color || 'text-white'}`}>{cat.name}</span>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {items.reduce((s, p) => s + (designData?.selected[p.id]?.placements?.length ?? 0), 0)} ks
              </span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {items.map((p) => {
                const qty = designData?.selected[p.id]?.placements?.length ?? 0;
                return (
                  <div key={p.id} className="px-4 py-3 bg-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">
                            {p.code}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-white truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.brand} {p.code}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-sm font-extrabold text-white">{qty} ks</span>
                        {p.price > 0 && (
                          <span className="text-sm font-extrabold text-blue-400">
                            {(p.price * qty).toLocaleString('cs-CZ')} Kč
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {materialTotals.length > 0 && (
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Materiál</h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300">
                  <th className="px-4 py-2 text-left">Název</th>
                  <th className="px-4 py-2 text-right">Délka</th>
                  <th className="px-4 py-2 text-right">Cena/j.</th>
                  <th className="px-4 py-2 text-right">Celkem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {materialTotals.map((mat) => {
                  const totalPrice = mat.rawLength * mat.pricePerUnit;
                  return (
                    <tr key={mat.name} className="text-xs">
                      <td className="px-4 py-2 font-semibold text-white">{mat.name}</td>
                      <td className="px-4 py-2 text-right text-slate-400">
                        {mat.rawLength.toFixed(1)} {mat.unit}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-400">
                        {mat.pricePerUnit.toLocaleString('cs-CZ')} Kč
                      </td>
                      <td className="px-4 py-2 text-right font-extrabold text-blue-400">
                        {totalPrice.toLocaleString('cs-CZ')} Kč
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-white/[0.04] font-extrabold text-sm">
                  <td colSpan={3} className="px-4 py-2 text-white">Celkem materiál</td>
                  <td className="px-4 py-2 text-right text-blue-400">
                    {totalMaterialPrice.toLocaleString('cs-CZ')} Kč
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border-2 border-slate-900 overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 text-white font-extrabold text-sm">Celkem</div>
        <div className="divide-y divide-white/[0.06] bg-white/[0.06]">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">Produkty</span>
            <span className="text-sm font-extrabold text-white">
              {totalProductPrice.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">Materiál</span>
            <span className="text-sm font-extrabold text-white">
              {totalMaterialPrice.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between bg-white/[0.04]">
            <span className="text-base font-extrabold text-white">Celkem</span>
            <span className="text-xl font-extrabold text-blue-400">
              {grandTotal.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
