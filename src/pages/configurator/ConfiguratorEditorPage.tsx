import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Printer, Save, Thermometer, Wind, Zap, Cable, Droplets,
  Brain, Shield, Flower2, KeyRound, Plus, Trash2, type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../hooks/usePermissions';
import { useConfiguratorConfig } from '../../hooks/useConfiguratorConfig';
import {
  createDefaultQuoteState, FIXTURE_LABELS, QUOTE_STATUS_LABELS,
} from '../../lib/configurator/defaults';
import { calculateQuoteTotals } from '../../lib/configurator/calc';
import { exportQuotePdf } from '../../lib/configurator/quotePdfExport';
import type {
  CatalogOption, CustomItem, QuoteState, SectionResult,
} from '../../lib/configurator/types';

function kc(n: number): string {
  return `${Math.round(n).toLocaleString('cs-CZ')} Kč`;
}

const inputCls = 'bg-navy-900/70 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400 w-full';

function Num({ label, value, onChange, w = 'w-16' }: {
  label: string; value: number; onChange: (v: number) => void; w?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${inputCls} ${w} text-right`}
      />
    </label>
  );
}

function Sel({ label, value, onChange, options }: {
  label?: string; value: number; onChange: (v: number) => void; options: CatalogOption[];
}) {
  return (
    <label className="block text-xs text-slate-300 space-y-1">
      {label && <span className="text-[10px] text-slate-500 font-semibold">{label}</span>}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputCls}>
        {options.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Chk({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-blue-500" />
      <span>{label}</span>
    </label>
  );
}

function CustomItemsEditor({ items, onChange }: {
  items: CustomItem[]; onChange: (items: CustomItem[]) => void;
}) {
  return (
    <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase">Vlastní položky</span>
        <button
          onClick={() => onChange([...items, { label: '', price: 0 }])}
          className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={item.label}
            onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
            placeholder="Název položky"
            className={`${inputCls} flex-1`}
          />
          <input
            type="number"
            value={item.price || ''}
            onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, price: Number(e.target.value) || 0 } : x))}
            placeholder="Kč"
            className={`${inputCls} w-24 text-right`}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-1 rounded text-slate-500 hover:text-red-400 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function SubsidyRow({ active, amount, onToggle, onAmount }: {
  active: boolean; amount: number; onToggle: (v: boolean) => void; onAmount: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
      <Chk label="Dotace (NZÚ)" checked={active} onChange={onToggle} />
      {active && (
        <input
          type="number"
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value) || 0)}
          className={`${inputCls} w-28 text-right`}
        />
      )}
    </div>
  );
}

function ManualPriceRow({ value, calculated, onChange }: {
  value: number | null; calculated: number; onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs text-slate-400">
      <span>Ruční cena <span className="text-slate-600">(auto: {kc(calculated)})</span></span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder="auto"
        className={`${inputCls} w-28 text-right`}
      />
    </div>
  );
}

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  color: string;
  active: boolean;
  onToggle: (v: boolean) => void;
  result: SectionResult;
  canSeeMargins: boolean;
  margin: number; onMargin: (v: number) => void;
  discount: number; onDiscount: (v: number) => void;
  surcharge: number; onSurcharge: (v: number) => void;
  children?: React.ReactNode;
}

function SectionCard(props: SectionCardProps) {
  const Icon = props.icon;
  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.06]">
        <input
          type="checkbox"
          checked={props.active}
          onChange={(e) => props.onToggle(e.target.checked)}
          className="w-4 h-4 accent-blue-500 shrink-0"
        />
        <Icon className={`w-4 h-4 shrink-0 ${props.color}`} />
        <span className="text-sm font-bold text-white flex-1">{props.title}</span>
        {props.active && props.canSeeMargins && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span title="Marže sekce v %">M</span>
            <input type="number" value={props.margin} onChange={(e) => props.onMargin(Number(e.target.value) || 0)} className={`${inputCls} w-12 text-right`} />
            <span title="Sleva v %">S</span>
            <input type="number" value={props.discount} onChange={(e) => props.onDiscount(Number(e.target.value) || 0)} className={`${inputCls} w-12 text-right`} />
            <span title="Přirážka v %">P</span>
            <input type="number" value={props.surcharge} onChange={(e) => props.onSurcharge(Number(e.target.value) || 0)} className={`${inputCls} w-12 text-right`} />
          </div>
        )}
        {props.active && (
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-white">{kc(props.result.final)}</div>
            {props.canSeeMargins && (
              <div className={`text-[10px] font-semibold ${props.result.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                zisk {kc(props.result.profit)}
              </div>
            )}
          </div>
        )}
      </div>
      {props.active && <div className="p-4 space-y-2.5">{props.children}</div>}
    </div>
  );
}

/**
 * Editor předběžné nabídky — port konfigurátoru HouseSmart Manager.
 * Vlevo sekce s parametry, vpravo živý souhrn; marže a zisky vidí jen
 * uživatel s oprávněním „Zobrazit marže".
 */
export default function ConfiguratorEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { config, loading: configLoading } = useConfiguratorConfig();

  const [state, setState] = useState<QuoteState | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(id === 'novy' ? null : id ?? null);
  const [projectId, setProjectId] = useState<string | null>(searchParams.get('project'));
  const [projectName, setProjectName] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canSeeMargins = hasPermission('view_margins');

  useEffect(() => {
    if (configLoading) return;
    let cancelled = false;

    const loadProject = async (pid: string) => {
      const { data: proj } = await supabase
        .from('projects')
        .select('name, project_name, client_name, address')
        .eq('id', pid)
        .maybeSingle();
      if (!proj || cancelled) return null;
      setProjectName(proj.project_name || proj.name || '');
      return proj as { client_name?: string; address?: string };
    };

    const init = async () => {
      if (id && id !== 'novy') {
        const { data } = await supabase
          .from('preliminary_quotes')
          .select('state, status, project_id')
          .eq('id', id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.project_id) {
          setProjectId(data.project_id);
          await loadProject(data.project_id);
        }
        if (data?.state && Object.keys(data.state).length > 0) {
          const base = createDefaultQuoteState(config);
          setState({ ...base, ...(data.state as QuoteState) });
          setStatus(data.status ?? 'draft');
        } else {
          setState(createDefaultQuoteState(config));
        }
      } else {
        const base = createDefaultQuoteState(config);
        // nova nabidka z projektu: predvyplnit klienta a adresu
        const pid = searchParams.get('project');
        if (pid) {
          const proj = await loadProject(pid);
          if (proj && !cancelled) {
            const parts = (proj.client_name ?? '').trim().split(/\s+/).filter(Boolean);
            base.client.firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
            base.client.lastName = parts.length > 0 ? parts[parts.length - 1] : '';
            base.client.address = proj.address ?? '';
          }
        }
        if (!cancelled) setState(base);
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, config, configLoading]);

  const totals = useMemo(
    () => state ? calculateQuoteTotals(state, config) : null,
    [state, config],
  );

  const patch = useCallback(<K extends keyof QuoteState>(key: K, value: Partial<QuoteState[K]>) => {
    setState((prev) => prev ? {
      ...prev,
      [key]: typeof prev[key] === 'object' && prev[key] !== null && !Array.isArray(prev[key])
        ? { ...(prev[key] as object), ...(value as object) }
        : value,
    } as QuoteState : prev);
  }, []);

  const handleSave = async () => {
    if (!state || !totals) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const row = {
      name: `${state.client.firstName} ${state.client.lastName}`.trim() || 'Bez názvu',
      client: state.client,
      project_id: projectId,
      state,
      totals: {
        totalFinal: totals.totalFinal,
        totalWithVat: totals.totalWithVat,
        totalSubsidy: totals.totalSubsidy,
        finalPriceAfterSubsidy: totals.finalPriceAfterSubsidy,
      },
      status,
      updated_at: new Date().toISOString(),
    };
    if (quoteId) {
      const { error } = await supabase.from('preliminary_quotes').update(row).eq('id', quoteId);
      if (error) { toast('Uložení se nepodařilo', 'error'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase
        .from('preliminary_quotes')
        .insert({ ...row, created_by: user?.id ?? null })
        .select('id')
        .single();
      if (error || !data) { toast('Uložení se nepodařilo', 'error'); setSaving(false); return; }
      setQuoteId(data.id);
      navigate(`/konfigurator/${data.id}`, { replace: true });
    }
    toast('Nabídka uložena');
    setSaving(false);
  };

  const handlePrint = () => {
    if (!state || !totals) return;
    exportQuotePdf({ state, totals, config });
  };

  if (loading || configLoading || !state || !totals) {
    return <div className="p-6 py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  const C = config.catalog;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(projectId ? `/projekty/${projectId}?tab=konfigurator` : '/projekty')}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">
              {quoteId ? 'Předběžná nabídka' : 'Nová předběžná nabídka'}
            </h1>
            <p className="text-xs text-slate-500">
              {projectName ? `Projekt: ${projectName}` : 'Konfigurátor technologií'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-36`}>
            {Object.entries(QUOTE_STATUS_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" /> Tisk / PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
        <div className="space-y-4">
          {/* Zakladni udaje */}
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 space-y-2.5">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Základní údaje</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={state.client.firstName} onChange={(e) => patch('client', { firstName: e.target.value })} placeholder="Jméno" className={inputCls} />
              <input value={state.client.lastName} onChange={(e) => patch('client', { lastName: e.target.value })} placeholder="Příjmení" className={inputCls} />
            </div>
            <input value={state.client.address} onChange={(e) => patch('client', { address: e.target.value })} placeholder="Adresa stavby" className={inputCls} />
            <div className="grid grid-cols-3 gap-2">
              <Num label="Plocha (m²)" value={state.property.area} onChange={(v) => patch('property', { area: v })} w="w-20" />
              <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
                <span>Datum</span>
                <input type="date" value={state.client.date} onChange={(e) => patch('client', { date: e.target.value })} className={`${inputCls} w-32`} />
              </label>
              <Num label="DPH %" value={state.vatRate} onChange={(v) => setState((p) => p ? { ...p, vatRate: v } : p)} w="w-14" />
            </div>
          </div>

          {/* 1. Topeni */}
          <SectionCard
            icon={Thermometer} title="1. Topení & Zóny" color="text-red-400"
            active={state.heating.active} onToggle={(v) => patch('heating', { active: v })}
            result={totals.resHeating} canSeeMargins={canSeeMargins}
            margin={state.heating.margin} onMargin={(v) => patch('heating', { margin: v })}
            discount={state.heating.discountPercent} onDiscount={(v) => patch('heating', { discountPercent: v })}
            surcharge={state.heating.surcharge} onSurcharge={(v) => patch('heating', { surcharge: v })}
          >
            <Sel label="Zdroj tepla" value={state.heating.sourceIndex} onChange={(v) => patch('heating', { sourceIndex: v })} options={C.heatSources} />
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-navy-900/50 rounded-xl border border-white/[0.06] p-2.5 space-y-1.5">
                <div className="text-[10px] font-bold text-red-300">1.NP</div>
                <Num label="m²" value={state.heating.zone1Area} onChange={(v) => patch('heating', { zone1Area: v })} />
                <Sel value={state.heating.zone1TypeIndex} onChange={(v) => patch('heating', { zone1TypeIndex: v })} options={C.floorInstallationTypes} />
              </div>
              <div className="bg-navy-900/50 rounded-xl border border-white/[0.06] p-2.5 space-y-1.5">
                <div className="text-[10px] font-bold text-red-300">2.NP</div>
                <Num label="m²" value={state.heating.zone2Area} onChange={(v) => patch('heating', { zone2Area: v })} />
                <Sel value={state.heating.zone2TypeIndex} onChange={(v) => patch('heating', { zone2TypeIndex: v })} options={C.floorInstallationTypes} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Num label="Radiátory (ks)" value={state.heating.radiators} onChange={(v) => patch('heating', { radiators: v })} />
              <Chk label="Napojení krbové vložky do AKU" checked={state.heating.fireplaceExchanger} onChange={(v) => patch('heating', { fireplaceExchanger: v })} />
            </div>
            <CustomItemsEditor items={state.heating.customItems} onChange={(items) => patch('heating', { customItems: items })} />
            <SubsidyRow active={state.heating.subsidy} amount={state.heating.subsidyAmount}
              onToggle={(v) => patch('heating', { subsidy: v })} onAmount={(v) => patch('heating', { subsidyAmount: v })} />
            <ManualPriceRow value={state.heating.manualPrice} calculated={totals.resHeating.base} onChange={(v) => patch('heating', { manualPrice: v })} />
          </SectionCard>

          {/* 2. Vzduchotechnika */}
          <SectionCard
            icon={Wind} title="2. Rekuperace & Chlazení" color="text-sky-400"
            active={state.ventilation.active} onToggle={(v) => patch('ventilation', { active: v })}
            result={totals.resVent} canSeeMargins={canSeeMargins}
            margin={state.ventilation.margin} onMargin={(v) => patch('ventilation', { margin: v })}
            discount={state.ventilation.discountPercent} onDiscount={(v) => patch('ventilation', { discountPercent: v })}
            surcharge={state.ventilation.surcharge} onSurcharge={(v) => patch('ventilation', { surcharge: v })}
          >
            <Sel label="Jednotka" value={state.ventilation.unitIndex} onChange={(v) => patch('ventilation', { unitIndex: v })} options={C.recuperationUnits} />
            <div className="grid grid-cols-2 gap-2.5">
              <Num label="Přívody" value={state.ventilation.inlets} onChange={(v) => patch('ventilation', { inlets: v })} />
              <Num label="Odtahy" value={state.ventilation.outlets} onChange={(v) => patch('ventilation', { outlets: v })} />
            </div>
            <Chk label="Elektrický předehřev" checked={state.ventilation.preheat} onChange={(v) => patch('ventilation', { preheat: v })} />
            <label className="block text-xs text-slate-300 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold">Chlazení</span>
              <select
                value={state.ventilation.coolingType}
                onChange={(e) => patch('ventilation', { coolingType: e.target.value })}
                className={inputCls}
              >
                {C.coolingTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            {state.ventilation.coolingType === 'ac' && (
              <Num label="Počet klimatizací (ks)" value={state.ventilation.acCount} onChange={(v) => patch('ventilation', { acCount: v })} />
            )}
            <CustomItemsEditor items={state.ventilation.customItems} onChange={(items) => patch('ventilation', { customItems: items })} />
            <SubsidyRow active={state.ventilation.subsidy} amount={state.ventilation.subsidyAmount}
              onToggle={(v) => patch('ventilation', { subsidy: v })} onAmount={(v) => patch('ventilation', { subsidyAmount: v })} />
            <ManualPriceRow value={state.ventilation.manualPrice} calculated={totals.resVent.base} onChange={(v) => patch('ventilation', { manualPrice: v })} />
          </SectionCard>

          {/* 3. FVE */}
          <SectionCard
            icon={Zap} title="3. Fotovoltaika" color="text-yellow-400"
            active={state.fve.active} onToggle={(v) => patch('fve', { active: v })}
            result={totals.resFve} canSeeMargins={canSeeMargins}
            margin={state.fve.margin} onMargin={(v) => patch('fve', { margin: v })}
            discount={state.fve.discountPercent} onDiscount={(v) => patch('fve', { discountPercent: v })}
            surcharge={state.fve.surcharge} onSurcharge={(v) => patch('fve', { surcharge: v })}
          >
            <div className="grid grid-cols-[1fr_90px] gap-2.5 items-end">
              <Sel label="Panel" value={state.fve.panelTypeIndex} onChange={(v) => patch('fve', { panelTypeIndex: v })} options={C.pvPanels} />
              <Num label="ks" value={state.fve.panelCount} onChange={(v) => patch('fve', { panelCount: v })} w="w-14" />
            </div>
            <div className="text-[10px] text-slate-500">Výkon: <span className="text-yellow-300 font-bold">{totals.kwp.toFixed(2)} kWp</span></div>
            <Sel label="Střídač" value={state.fve.inverterIndex} onChange={(v) => patch('fve', { inverterIndex: v })} options={C.pvInverters} />
            <div className="grid grid-cols-[1fr_90px] gap-2.5 items-end">
              <Sel label="Baterie" value={state.fve.batteryTypeIndex} onChange={(v) => patch('fve', { batteryTypeIndex: v })} options={C.pvBatteries} />
              <Num label="mod" value={state.fve.batteryModules} onChange={(v) => patch('fve', { batteryModules: v })} w="w-14" />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2.5 items-end">
              <Sel label="Optimizéry" value={state.fve.optimizerTypeIndex} onChange={(v) => patch('fve', { optimizerTypeIndex: v })} options={C.optimizerTypes} />
              <Num label="ks" value={state.fve.optimizerCount} onChange={(v) => patch('fve', { optimizerCount: v })} w="w-14" />
            </div>
            <Chk label="Wallbox" checked={state.fve.wallbox} onChange={(v) => patch('fve', { wallbox: v })} />
            <CustomItemsEditor items={state.fve.customItems} onChange={(items) => patch('fve', { customItems: items })} />
            <SubsidyRow active={state.fve.subsidy} amount={state.fve.subsidyAmount}
              onToggle={(v) => patch('fve', { subsidy: v })} onAmount={(v) => patch('fve', { subsidyAmount: v })} />
            <ManualPriceRow value={state.fve.manualPrice} calculated={totals.resFve.base} onChange={(v) => patch('fve', { manualPrice: v })} />
          </SectionCard>

          {/* 4. Elektro */}
          <SectionCard
            icon={Cable} title="4. Elektroinstalace" color="text-orange-400"
            active={state.electro.active} onToggle={(v) => patch('electro', { active: v })}
            result={totals.resElectro} canSeeMargins={canSeeMargins}
            margin={state.electro.margin} onMargin={(v) => patch('electro', { margin: v })}
            discount={state.electro.discountPercent} onDiscount={(v) => patch('electro', { discountPercent: v })}
            surcharge={state.electro.surcharge} onSurcharge={(v) => patch('electro', { surcharge: v })}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Num label="Zásuvky 230V" value={state.electro.sockets230} onChange={(v) => patch('electro', { sockets230: v })} />
              <Num label="Zásuvky Data" value={state.electro.socketsData} onChange={(v) => patch('electro', { socketsData: v })} />
              <Num label="Vývody 400V" value={state.electro.sockets400V} onChange={(v) => patch('electro', { sockets400V: v })} />
              <Num label="Světelné okruhy" value={state.electro.lightCircuits} onChange={(v) => patch('electro', { lightCircuits: v })} />
            </div>
            <CustomItemsEditor items={state.electro.customItems} onChange={(items) => patch('electro', { customItems: items })} />
            <ManualPriceRow value={state.electro.manualPrice} calculated={totals.resElectro.base} onChange={(v) => patch('electro', { manualPrice: v })} />
          </SectionCard>

          {/* 5. Voda */}
          <SectionCard
            icon={Droplets} title="5. Voda & Odpady" color="text-cyan-400"
            active={state.water.active} onToggle={(v) => patch('water', { active: v })}
            result={totals.resWater} canSeeMargins={canSeeMargins}
            margin={state.water.margin} onMargin={(v) => patch('water', { margin: v })}
            discount={state.water.discountPercent} onDiscount={(v) => patch('water', { discountPercent: v })}
            surcharge={state.water.surcharge} onSurcharge={(v) => patch('water', { surcharge: v })}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Sel label="Materiál" value={state.water.materialIndex} onChange={(v) => patch('water', { materialIndex: v })} options={C.waterMaterials} />
              <Sel label="Baterie" value={state.water.faucetTypeIndex} onChange={(v) => patch('water', { faucetTypeIndex: v })} options={C.faucetTypes} />
            </div>
            <div className="bg-navy-900/50 rounded-xl border border-white/[0.06] p-2.5">
              <div className="text-[10px] font-bold text-cyan-300 mb-1.5">Sanita & Kuchyně (ks)</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.keys(state.water.fixtures).map((key) => (
                  <Num
                    key={key}
                    label={FIXTURE_LABELS[key] ?? key}
                    value={state.water.fixtures[key]}
                    onChange={(v) => patch('water', { fixtures: { ...state.water.fixtures, [key]: v } })}
                    w="w-12"
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Chk label="Cirkulace TUV" checked={state.water.circulation} onChange={(v) => patch('water', { circulation: v })} />
              <Chk label="Smart Valve (ochrana)" checked={state.water.smartValve} onChange={(v) => patch('water', { smartValve: v })} />
            </div>
            <CustomItemsEditor items={state.water.customItems} onChange={(items) => patch('water', { customItems: items })} />
            <ManualPriceRow value={state.water.manualPrice} calculated={totals.resWater.base} onChange={(v) => patch('water', { manualPrice: v })} />
          </SectionCard>

          {/* 6. Loxone */}
          <SectionCard
            icon={Brain} title="6. Chytrá domácnost Loxone" color="text-green-400"
            active={state.loxone.active} onToggle={(v) => patch('loxone', { active: v })}
            result={totals.resLoxone} canSeeMargins={canSeeMargins}
            margin={state.loxone.margin} onMargin={(v) => patch('loxone', { margin: v })}
            discount={state.loxone.discountPercent} onDiscount={(v) => patch('loxone', { discountPercent: v })}
            surcharge={state.loxone.surcharge} onSurcharge={(v) => patch('loxone', { surcharge: v })}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Chk label="Osvětlení" checked={state.loxone.intLighting} onChange={(v) => patch('loxone', { intLighting: v })} />
              {state.loxone.intLighting && <Num label="Stmívané okruhy" value={state.loxone.dimmableCount} onChange={(v) => patch('loxone', { dimmableCount: v })} />}
              <Chk label="Topení" checked={state.loxone.intHeating} onChange={(v) => patch('loxone', { intHeating: v })} />
              {state.loxone.intHeating && <Num label="Zóny topení" value={state.loxone.heatingZones} onChange={(v) => patch('loxone', { heatingZones: v })} />}
              <Chk label="Stínění" checked={state.loxone.intShading} onChange={(v) => patch('loxone', { intShading: v })} />
              {state.loxone.intShading && <Num label="Okna" value={state.loxone.windowCount} onChange={(v) => patch('loxone', { windowCount: v })} />}
              <Chk label="Audio Multiroom" checked={state.loxone.intAudio} onChange={(v) => patch('loxone', { intAudio: v })} />
              {state.loxone.intAudio && <Num label="Audio zóny" value={state.loxone.audioZones} onChange={(v) => patch('loxone', { audioZones: v })} />}
              <Chk label="Meteostanice" checked={state.loxone.weatherStation} onChange={(v) => patch('loxone', { weatherStation: v })} />
              <Chk label="Integrace alarmu" checked={state.loxone.alarmIntegration} onChange={(v) => patch('loxone', { alarmIntegration: v })} />
            </div>
            <CustomItemsEditor items={state.loxone.customItems} onChange={(items) => patch('loxone', { customItems: items })} />
            <ManualPriceRow value={state.loxone.manualPrice} calculated={totals.resLoxone.base} onChange={(v) => patch('loxone', { manualPrice: v })} />
          </SectionCard>

          {/* 7. Zabezpeceni */}
          <SectionCard
            icon={Shield} title="7. Zabezpečení & Kamery" color="text-red-400"
            active={state.security.active} onToggle={(v) => patch('security', { active: v })}
            result={totals.resSec} canSeeMargins={canSeeMargins}
            margin={state.security.margin} onMargin={(v) => patch('security', { margin: v })}
            discount={state.security.discountPercent} onDiscount={(v) => patch('security', { discountPercent: v })}
            surcharge={state.security.surcharge} onSurcharge={(v) => patch('security', { surcharge: v })}
          >
            <Chk label="Alarm Jablotron 100+" checked={state.security.jablotron} onChange={(v) => patch('security', { jablotron: v })} />
            {state.security.jablotron && (
              <div className="grid grid-cols-2 gap-2.5 bg-navy-900/50 rounded-xl border border-white/[0.06] p-2.5">
                <Num label="PIR čidla" value={state.security.jabPir} onChange={(v) => patch('security', { jabPir: v })} />
                <Num label="Mag. kontakty" value={state.security.jabMag} onChange={(v) => patch('security', { jabMag: v })} />
                <Num label="Klávesnice" value={state.security.jabKeypad} onChange={(v) => patch('security', { jabKeypad: v })} />
                <Num label="Sirény" value={state.security.jabSiren} onChange={(v) => patch('security', { jabSiren: v })} />
              </div>
            )}
            <label className="block text-xs text-slate-300 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold">Kamery</span>
              <select
                value={state.security.cameraMode}
                onChange={(e) => patch('security', { cameraMode: e.target.value as 'yes' | 'prep' | 'no' })}
                className={inputCls}
              >
                <option value="yes">Komplet</option>
                <option value="prep">Příprava</option>
                <option value="no">Ne</option>
              </select>
            </label>
            {state.security.cameraMode !== 'no' && (
              <Num label="Počet kamer" value={state.security.cameraCount} onChange={(v) => patch('security', { cameraCount: v })} />
            )}
            {state.security.cameraMode === 'yes' && (
              <div className="grid grid-cols-2 gap-2.5">
                <Sel label="NVR" value={state.security.nvrIndex} onChange={(v) => patch('security', { nvrIndex: v })} options={C.nvrTypes} />
                <Sel label="HDD" value={state.security.hddSizeIndex} onChange={(v) => patch('security', { hddSizeIndex: v })} options={C.hddSizes} />
              </div>
            )}
            <CustomItemsEditor items={state.security.customItems} onChange={(items) => patch('security', { customItems: items })} />
            <ManualPriceRow value={state.security.manualPrice} calculated={totals.resSec.base} onChange={(v) => patch('security', { manualPrice: v })} />
          </SectionCard>

          {/* 8. Exterier */}
          <SectionCard
            icon={Flower2} title="8. Exteriér" color="text-emerald-400"
            active={state.exterior.active} onToggle={(v) => patch('exterior', { active: v })}
            result={totals.resExt} canSeeMargins={canSeeMargins}
            margin={state.exterior.margin} onMargin={(v) => patch('exterior', { margin: v })}
            discount={state.exterior.discountPercent} onDiscount={(v) => patch('exterior', { discountPercent: v })}
            surcharge={state.exterior.surcharge} onSurcharge={(v) => patch('exterior', { surcharge: v })}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Chk label="Bazén" checked={state.exterior.pool} onChange={(v) => patch('exterior', { pool: v })} />
              <Chk label="Sauna" checked={state.exterior.sauna} onChange={(v) => patch('exterior', { sauna: v })} />
              <Num label="Venkovní zásuvky" value={state.exterior.switchedSockets} onChange={(v) => patch('exterior', { switchedSockets: v })} />
              <Num label="Zahradní světla" value={state.exterior.lightPoints} onChange={(v) => patch('exterior', { lightPoints: v })} />
            </div>
            <Chk label="Ovládání brány" checked={state.exterior.gateControl} onChange={(v) => patch('exterior', { gateControl: v })} />
            <CustomItemsEditor items={state.exterior.customItems} onChange={(items) => patch('exterior', { customItems: items })} />
            <ManualPriceRow value={state.exterior.manualPrice} calculated={totals.resExt.base} onChange={(v) => patch('exterior', { manualPrice: v })} />
          </SectionCard>

          {/* 9. Vstup & Sit */}
          <SectionCard
            icon={KeyRound} title="9. Vstup & Datová síť" color="text-indigo-400"
            active={state.access.active}
            onToggle={(v) => { patch('access', { active: v }); patch('network', { active: v }); }}
            result={{
              ...totals.resAccess,
              final: totals.resAccess.final + totals.resNet.final,
              profit: totals.resAccess.profit + totals.resNet.profit,
              base: totals.resAccess.base + totals.resNet.base,
            }}
            canSeeMargins={canSeeMargins}
            margin={state.access.margin}
            onMargin={(v) => { patch('access', { margin: v }); patch('network', { margin: v }); }}
            discount={state.access.discountPercent}
            onDiscount={(v) => { patch('access', { discountPercent: v }); patch('network', { discountPercent: v }); }}
            surcharge={state.access.surcharge}
            onSurcharge={(v) => { patch('access', { surcharge: v }); patch('network', { surcharge: v }); }}
          >
            <Sel label="Interkom" value={state.access.intercomTypeIndex} onChange={(v) => patch('access', { intercomTypeIndex: v })} options={C.accessTypes} />
            <div className="grid grid-cols-2 gap-2.5">
              <Num label="Interkomy (ks)" value={state.access.intercomCount} onChange={(v) => patch('access', { intercomCount: v })} />
              <Num label="NFC Code (ks)" value={state.access.nfcCount} onChange={(v) => patch('access', { nfcCount: v })} />
            </div>
            <Chk label="Elektrozámek" checked={state.access.electricStrike} onChange={(v) => patch('access', { electricStrike: v })} />
            <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
              <div className="text-[10px] font-bold text-indigo-300 uppercase">Datová síť</div>
              <Num label="WiFi AP (ks)" value={state.network.apCount} onChange={(v) => patch('network', { apCount: v })} />
              <div className="grid grid-cols-2 gap-2.5">
                <Sel label="Rack" value={state.network.rackIndex} onChange={(v) => patch('network', { rackIndex: v })} options={C.rackSizes} />
                <Sel label="Switch" value={state.network.switchTypeIndex} onChange={(v) => patch('network', { switchTypeIndex: v })} options={C.switchTypes} />
              </div>
            </div>
            <CustomItemsEditor items={state.access.customItems} onChange={(items) => patch('access', { customItems: items })} />
            <ManualPriceRow value={state.access.manualPrice} calculated={totals.resAccess.base + totals.resNet.base}
              onChange={(v) => patch('access', { manualPrice: v })} />
          </SectionCard>

          {/* Uvodni text */}
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 space-y-2">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Úvodní text nabídky</div>
            <textarea
              value={state.introText}
              onChange={(e) => setState((p) => p ? { ...p, introText: e.target.value } : p)}
              rows={4}
              placeholder="Volitelný úvod pro klienta — shrnutí navrženého řešení…"
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>

        {/* SOUHRN */}
        <div className="xl:sticky xl:top-6 space-y-4">
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 space-y-2 text-sm">
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-1">Souhrn nabídky</div>
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Ceníková cena celkem</span><span>{kc(totals.totalBase)}</span>
            </div>
            {totals.totalDiscountCombined > 0.5 && (
              <div className="flex justify-between text-emerald-400 text-xs font-semibold">
                <span>Celková sleva</span><span>−{kc(totals.totalDiscountCombined)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-200 font-semibold border-t border-white/[0.08] pt-2">
              <span>Cena bez DPH</span><span>{kc(totals.totalFinal)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-xs">
              <span>DPH {state.vatRate} %</span><span>{kc(totals.vat)}</span>
            </div>
            <div className="flex justify-between text-white font-extrabold text-base border-t border-white/[0.08] pt-2">
              <span>Cena s DPH</span><span>{kc(totals.totalWithVat)}</span>
            </div>
            {totals.totalSubsidy > 0 && (
              <>
                <div className="flex justify-between text-amber-300 text-xs font-semibold">
                  <span>Možné dotace</span><span>−{kc(totals.totalSubsidy)}</span>
                </div>
                <div className="flex justify-between text-emerald-300 font-bold">
                  <span>Po odečtu dotací</span><span>{kc(totals.finalPriceAfterSubsidy)}</span>
                </div>
              </>
            )}
            <div className="text-[10px] text-slate-500 pt-2 border-t border-white/[0.06]">
              Běžná tržní cena po částech: {kc(totals.marketPrice)} · úspora {kc(totals.totalSavings)}
            </div>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 space-y-2.5">
            <div className="text-xs font-bold text-white uppercase tracking-wider">Poplatky & slevy</div>
            <Num label="Projekt a koordinace (Kč)" value={state.fees.project} onChange={(v) => patch('fees', { project: v })} w="w-24" />
            <Num label="Bonus za komplet (Kč)" value={state.fees.coordinationDiscount} onChange={(v) => patch('fees', { coordinationDiscount: v })} w="w-24" />
            <Num label="Obchodní sleva (Kč)" value={state.fees.manualDiscount} onChange={(v) => patch('fees', { manualDiscount: v })} w="w-24" />
            <Num label="Celková sleva (%)" value={state.fees.globalDiscountPercent} onChange={(v) => patch('fees', { globalDiscountPercent: v })} w="w-24" />
          </div>

          {canSeeMargins && (
            <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-4 space-y-1.5">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Ziskovost</div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Celkový zisk</span>
                <span className={`font-extrabold ${totals.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kc(totals.totalProfit)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                Odhad dle marží sekcí; vidí jen role s oprávněním „Zobrazit marže".
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
