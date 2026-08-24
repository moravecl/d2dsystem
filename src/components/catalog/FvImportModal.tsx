import { useState, useEffect, useMemo } from 'react';
import { Sun, Loader2, ChevronRight, Battery, Zap, Calendar, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { QuoteSection, QuoteItem, QuoteAttachment, QuoteSystemSummary } from './quoteHelpers';
import type {
  FvPanel, FvInverter, FvBattery, FvWallbox, FvAccessory,
  FvRoofTile, FvHook, FvRailProfile, FvClamp,
} from '../../hooks/useFvCatalog';
import type { RoofSurface } from '../../lib/fvCalculations';
import { buildConstructionItems } from '../fv/fvQuoteBuilder';
import Modal from '../ui/Modal';

interface FvVersionRow {
  id: string;
  fv_design_id: string;
  version_number: number;
  note: string;
  summary_panel_kwp: number;
  summary_panel_count: number;
  summary_inverter_kw: number;
  summary_battery_kwh: number;
  system_config: Record<string, unknown>;
  roofs: Record<string, unknown>[];
  created_at: string;
}

interface FvDesignRow {
  id: string;
  name: string;
  system_config: Record<string, unknown>;
  roofs: Record<string, unknown>[];
  pvgis_results: Record<string, unknown> | null;
  input_params: Record<string, unknown> | null;
  updated_at: string;
}

export interface FvImportResult {
  section: QuoteSection;
  designId: string;
  versionId?: string;
  attachments: QuoteAttachment[];
  summary: QuoteSystemSummary;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  onImport: (section: QuoteSection, meta?: FvImportResult) => void;
}

interface CatalogState {
  panels: FvPanel[];
  inverters: FvInverter[];
  batteries: FvBattery[];
  wallboxes: FvWallbox[];
  accessories: FvAccessory[];
  roofTiles: FvRoofTile[];
  hooks: FvHook[];
  railProfiles: FvRailProfile[];
  clamps: FvClamp[];
}

const EMPTY_CATALOG: CatalogState = {
  panels: [], inverters: [], batteries: [], wallboxes: [], accessories: [],
  roofTiles: [], hooks: [], railProfiles: [], clamps: [],
};

const TECH_MAP: Record<string, string> = { mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jina' };

function buildFveSection(
  roofs: Record<string, unknown>[],
  config: Record<string, unknown>,
  cat: CatalogState,
): QuoteSection {
  const items: QuoteItem[] = [];

  for (const roof of (roofs || [])) {
    const panelCount = (roof as any).panelCount ?? 0;
    if (panelCount === 0) continue;
    const panelId = (roof as any).panelId;
    const panel = cat.panels.find(p => p.id === panelId);
    const roofName = (roof as any).name || 'Strecha';
    const panelPowerWp = (roof as any).panelPowerWp ?? 0;

    if (panel) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `FV panel ${panel.name} (${panel.power_wp} Wp, ${TECH_MAP[panel.technology] ?? panel.technology})`,
        unit: 'ks',
        quantity: panelCount,
        sellingPrice: panel.price,
        costPrice: panel.price * 0.75,
      });
    } else {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `FV panely ${roofName} (${panelPowerWp} Wp)`,
        unit: 'ks',
        quantity: panelCount,
        sellingPrice: 0,
        costPrice: 0,
      });
    }
  }

  const inverterId = (config as any).inverterId;
  const inverter = cat.inverters.find(i => i.id === inverterId);
  if (inverter) {
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: `Stridac ${inverter.name} (${inverter.power_kw} kW)`,
      unit: 'ks',
      quantity: 1,
      sellingPrice: inverter.price,
      costPrice: inverter.price * 0.75,
    });
  }

  const batteryId = (config as any).batteryId;
  const batteryCount = (config as any).batteryCount ?? 0;
  const battery = cat.batteries.find(b => b.id === batteryId);
  if (battery && batteryCount > 0) {
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: `Baterie master ${battery.name} (${battery.capacity_kwh} kWh)`,
      unit: 'ks',
      quantity: batteryCount,
      sellingPrice: battery.price,
      costPrice: battery.price * 0.75,
    });
  }

  const slaveBatteryId = (config as any).slaveBatteryId;
  const slaveBatteryCount = (config as any).slaveBatteryCount ?? 0;
  const slaveBattery = cat.batteries.find(b => b.id === slaveBatteryId);
  if (slaveBattery && slaveBatteryCount > 0) {
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: `Baterie slave ${slaveBattery.name} (${slaveBattery.capacity_kwh} kWh)`,
      unit: 'ks',
      quantity: slaveBatteryCount,
      sellingPrice: slaveBattery.price,
      costPrice: slaveBattery.price * 0.75,
    });
  }

  const wallboxId = (config as any).wallboxId;
  const wallbox = cat.wallboxes.find(w => w.id === wallboxId);
  if (wallbox) {
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: `Wallbox ${wallbox.name} (${wallbox.power_kw} kW)`,
      unit: 'ks',
      quantity: 1,
      sellingPrice: wallbox.price,
      costPrice: wallbox.price * 0.75,
    });
  }

  const configAccessories = (config as any).accessories ?? [];
  for (const a of configAccessories) {
    const acc = cat.accessories.find(x => x.id === a.accessoryId);
    if (!acc) continue;
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: acc.name,
      unit: acc.unit,
      quantity: a.quantity,
      sellingPrice: acc.price_per_unit,
      costPrice: acc.price_per_unit * 0.75,
    });
  }

  const constructionItems = buildConstructionItems(
    roofs as unknown as RoofSurface[],
    cat.roofTiles, cat.hooks, cat.railProfiles, cat.clamps,
  );
  items.push(...constructionItems);

  const laborCost = (config as any).laborCost ?? 0;
  if (laborCost > 0) {
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: 'Montaz FV systemu',
      unit: 'pausal',
      quantity: 1,
      sellingPrice: laborCost,
      costPrice: laborCost * 0.6,
    });
  }

  const subsidyCzk = (config as any).subsidyCzk ?? 0;
  if (subsidyCzk > 0) {
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: 'Dotace NZU (odpocet)',
      unit: 'pausal',
      quantity: 1,
      sellingPrice: -subsidyCzk,
      costPrice: 0,
    });
  }

  return {
    id: crypto.randomUUID(),
    name: 'Fotovoltaika',
    trade: 'fotovoltaika',
    icon: 'sun',
    items,
  };
}

function buildFveSummary(
  roofs: Record<string, unknown>[],
  config: Record<string, unknown>,
  pvgis: Record<string, unknown> | null,
  cat: CatalogState,
): QuoteSystemSummary {
  const totalPanels = (roofs || []).reduce((s: number, r: any) => s + (r.panelCount ?? 0), 0);
  const totalKwp = (roofs || []).reduce((s: number, r: any) => s + ((r.panelCount ?? 0) * (r.panelPowerWp ?? 0)) / 1000, 0);

  const inverterId = (config as any).inverterId;
  const inverter = cat.inverters.find(i => i.id === inverterId);

  const batteryId = (config as any).batteryId;
  const batteryCount = (config as any).batteryCount ?? 0;
  const battery = cat.batteries.find(b => b.id === batteryId);
  const slaveBatteryId = (config as any).slaveBatteryId;
  const slaveBatteryCount = (config as any).slaveBatteryCount ?? 0;
  const slaveBattery = cat.batteries.find(b => b.id === slaveBatteryId);
  const totalBatteryKwh = (battery ? battery.capacity_kwh * batteryCount : 0) + (slaveBattery ? slaveBattery.capacity_kwh * slaveBatteryCount : 0);

  const annualProduction = (pvgis as any)?.annualProductionKwh ?? 0;
  const annualSavings = (pvgis as any)?.totalAnnualBenefitCzk ?? 0;
  const co2 = (pvgis as any)?.co2SavedKg ?? 0;

  const data: Record<string, string | number> = {
    'Celkový výkon': `${totalKwp.toFixed(1)} kWp`,
    'Počet panelů': totalPanels,
    'Počet střech': (roofs || []).length,
  };
  if (inverter) data['Střídač'] = `${inverter.name} (${inverter.power_kw} kW)`;
  if (totalBatteryKwh > 0) data['Baterie'] = `${totalBatteryKwh.toFixed(1)} kWh`;
  if (annualProduction > 0) data['Roční produkce'] = `${Math.round(annualProduction)} kWh`;
  if (annualSavings > 0) data['Roční úspora'] = `${Math.round(annualSavings).toLocaleString('cs-CZ')} Kč`;
  if (co2 > 0) data['Úspora CO2'] = `${Math.round(co2)} kg/rok`;

  return { type: 'fve', data };
}

function buildRoofAttachments(roofs: Record<string, unknown>[]): QuoteAttachment[] {
  const attachments: QuoteAttachment[] = [];
  for (const roof of roofs || []) {
    const r = roof as any;
    if (r.imageUrl) {
      attachments.push({
        id: crypto.randomUUID(),
        type: 'roof_snapshot',
        label: r.name || 'Střecha',
        imageData: r.imageUrl,
        annotation: `${r.panelCount ?? 0} panelů, ${r.azimuthDeg ?? 0}° azimut, ${r.tiltDeg ?? 0}° sklon`,
      });
    }
  }
  return attachments;
}

export default function FvImportModal({ open, onClose, projectId, onImport }: Props) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [design, setDesign] = useState<FvDesignRow | null>(null);
  const [versions, setVersions] = useState<FvVersionRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG);

  useEffect(() => {
    if (!open || !organization?.id) return;
    setLoading(true);

    const orgId = organization.id;

    const loadDesign = projectId
      ? supabase.from('fv_designs').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as FvDesignRow[] });

    Promise.all([
      loadDesign,
      supabase.from('fv_panels').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_inverters').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_batteries').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_wallboxes').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_accessories').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_roof_tiles').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_hooks').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_rail_profiles').select('*').eq('org_id', orgId).eq('is_active', true),
      supabase.from('fv_clamps').select('*').eq('org_id', orgId).eq('is_active', true),
    ]).then(async ([designRes, panelsRes, invRes, batRes, wbRes, accRes, rtRes, hkRes, rpRes, clRes]) => {
      setCatalog({
        panels: (panelsRes.data ?? []) as FvPanel[],
        inverters: (invRes.data ?? []) as FvInverter[],
        batteries: (batRes.data ?? []) as FvBattery[],
        wallboxes: (wbRes.data ?? []) as FvWallbox[],
        accessories: (accRes.data ?? []) as FvAccessory[],
        roofTiles: (rtRes.data ?? []) as FvRoofTile[],
        hooks: (hkRes.data ?? []) as FvHook[],
        railProfiles: (rpRes.data ?? []) as FvRailProfile[],
        clamps: (clRes.data ?? []) as FvClamp[],
      });

      const d = (designRes.data ?? [])[0] as FvDesignRow | undefined;
      if (d) {
        setDesign(d);
        const { data: vers } = await supabase
          .from('fv_design_versions')
          .select('*')
          .eq('fv_design_id', d.id)
          .order('created_at', { ascending: false });
        setVersions((vers ?? []) as FvVersionRow[]);
      } else {
        setDesign(null);
        setVersions([]);
      }
      setLoading(false);
    });
  }, [open, projectId, organization?.id]);

  const handleImportCurrent = () => {
    if (!design) return;
    const roofs = Array.isArray(design.roofs) ? design.roofs : [];
    const config = design.system_config ?? {};
    const section = buildFveSection(roofs, config, catalog);
    const summary = buildFveSummary(roofs, config, design.pvgis_results, catalog);
    const attachments = buildRoofAttachments(roofs);
    onImport(section, {
      section,
      designId: design.id,
      attachments,
      summary,
    });
    onClose();
  };

  const handleImportVersion = (version: FvVersionRow) => {
    const roofs = Array.isArray(version.roofs) ? version.roofs : [];
    const config = version.system_config ?? {};
    const section = buildFveSection(roofs, config, catalog);
    const summary = buildFveSummary(roofs, config, null, catalog);
    const attachments = buildRoofAttachments(roofs);
    onImport(section, {
      section,
      designId: design?.id || '',
      versionId: version.id,
      attachments,
      summary,
    });
    onClose();
  };

  const currentPanelCount = useMemo(() => {
    if (!design?.roofs) return 0;
    return (Array.isArray(design.roofs) ? design.roofs : [])
      .reduce((s: number, r: any) => s + (r.panelCount ?? 0), 0);
  }, [design]);

  const currentKwp = useMemo(() => {
    if (!design?.roofs) return 0;
    return (Array.isArray(design.roofs) ? design.roofs : [])
      .reduce((s: number, r: any) => s + ((r.panelCount ?? 0) * (r.panelPowerWp ?? 0)) / 1000, 0);
  }, [design]);

  return (
    <Modal open={open} onClose={onClose} title="Importovat FVE do nabídky" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : !design ? (
        <div className="text-center py-10">
          <Sun className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-extrabold text-slate-300">Žádný FV návrh</div>
          <div className="text-xs text-slate-400 mt-1">
            Tento projekt nemá žádný fotovoltaický návrh. Nejprve jej vytvořte v záložce FVE.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={handleImportCurrent}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 hover:border-orange-400 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <Sun className="w-6 h-6 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-white">
                Aktuální konfigurace
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {currentPanelCount} panelu
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {currentKwp.toFixed(1)} kWp
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 transition shrink-0" />
          </button>

          {versions.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">
                Uložené verze ({versions.length})
              </div>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {versions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleImportVersion(v)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.06] hover:border-blue-300 hover:bg-blue-500/10 transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-xs font-extrabold text-slate-400">
                      v{v.version_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">
                        {v.note || `Verze ${v.version_number}`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5" /> {v.summary_panel_count} panelu / {v.summary_panel_kwp} kWp
                        </span>
                        {v.summary_inverter_kw > 0 && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> {v.summary_inverter_kw} kW střídač
                          </span>
                        )}
                        {v.summary_battery_kwh > 0 && (
                          <span className="flex items-center gap-1">
                            <Battery className="w-2.5 h-2.5" /> {v.summary_battery_kwh} kWh
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> {new Date(v.created_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
