import { useEffect, useState } from 'react';
import { Calculator, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useConfiguratorConfig } from '../../hooks/useConfiguratorConfig';
import { DEFAULT_CONFIGURATOR_CONFIG } from '../../lib/configurator/defaults';
import type { CatalogOption, ConfiguratorCatalog, ConfiguratorConfig } from '../../lib/configurator/types';

const inputCls = 'bg-navy-900/70 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400';

/** Ceny v katalozich: ktere ciselne pole ktera skupina pouziva. */
const CATALOG_GROUPS: { key: keyof ConfiguratorCatalog; title: string; priceField: 'basePrice' | 'price' | 'pricePerM2' | 'multiplier' | 'surchargePerPoint'; extraField?: 'power' | 'capacity' }[] = [
  { key: 'heatSources', title: 'Zdroje tepla', priceField: 'basePrice' },
  { key: 'floorInstallationTypes', title: 'Podlahové topení (Kč/m²)', priceField: 'pricePerM2' },
  { key: 'recuperationUnits', title: 'Rekuperační jednotky', priceField: 'price' },
  { key: 'pvPanels', title: 'FVE panely', priceField: 'price', extraField: 'power' },
  { key: 'pvInverters', title: 'FVE střídače', priceField: 'price' },
  { key: 'pvBatteries', title: 'FVE baterie', priceField: 'price', extraField: 'capacity' },
  { key: 'optimizerTypes', title: 'Optimizéry', priceField: 'price' },
  { key: 'coolingTypes', title: 'Chlazení', priceField: 'price' },
  { key: 'nvrTypes', title: 'Kamerové NVR', priceField: 'price' },
  { key: 'hddSizes', title: 'HDD pro kamery', priceField: 'price' },
  { key: 'rackSizes', title: 'Datové racky', priceField: 'price' },
  { key: 'switchTypes', title: 'Switche', priceField: 'price' },
  { key: 'accessTypes', title: 'Vstupní systémy', priceField: 'price' },
  { key: 'waterMaterials', title: 'Materiál rozvodů vody (násobitel)', priceField: 'multiplier' },
  { key: 'faucetTypes', title: 'Typy baterií (příplatek/bod)', priceField: 'surchargePerPoint' },
];

const PRICE_LABELS: Record<string, string> = {
  radiator: 'Radiátor (ks)',
  fireplaceExchangerConnection: 'Napojení krbové vložky',
  pvSystemBaseCost: 'FVE: projekt, revize, oživení',
  pvPanelInstall: 'FVE: montáž panelu (ks)',
  wallbox: 'Wallbox',
  recupOutlet: 'Rekuperace: výústka (ks)',
  recupPreheat: 'Rekuperace: předehřev',
  acUnit: 'Klimatizace Split (ks)',
  socket230: 'Zásuvka 230V (ks)',
  socketData: 'Zásuvka Data (ks)',
  socket400V: 'Vývod 400V (ks)',
  smartValve: 'Smart Valve',
  circulationPump: 'Cirkulace: čerpadlo',
  circulationLoopPrice: 'Cirkulace: smyčka',
  loxoneCore: 'Loxone: Miniserver + moduly',
  loxoneDimmerChannel: 'Loxone: stmívaný okruh',
  loxoneValve: 'Loxone: hlavice topení (zóna)',
  weatherStation: 'Meteostanice',
  jablotronCentral: 'Jablotron: ústředna',
  pirSensor: 'Jablotron: PIR čidlo',
  magContact: 'Jablotron: mag. kontakt',
  keypad: 'Jablotron: klávesnice',
  siren: 'Jablotron: siréna',
  camera: 'Kamera (ks)',
  cameraPrep: 'Příprava pro kameru (ks)',
  poolIntegration: 'Integrace bazénu',
  saunaIntegration: 'Integrace sauny',
  gardenSocket: 'Venkovní zásuvka (ks)',
  gardenLightPoint: 'Zahradní světlo (ks)',
  gateControl: 'Ovládání brány',
  electricStrike: 'Elektrozámek',
  wifiAp: 'WiFi AP (ks)',
  patchPanel: 'Patch panel (ks)',
  pdu: 'PDU (ks)',
  networkInstallBase: 'Síť: měření a konektorování',
  waterBaseCost: 'Voda: vodoměrná sestava',
  fixWC: 'Sanita: WC (bod)',
  fixWashbasin: 'Sanita: umyvadlo (bod)',
  fixShower: 'Sanita: sprcha (bod)',
  fixBath: 'Sanita: vana (bod)',
  fixSink: 'Sanita: dřez (bod)',
  fixDishwasher: 'Sanita: myčka (bod)',
  fixWasher: 'Sanita: pračka (bod)',
  fixGarden: 'Sanita: zahradní ventil (bod)',
  electroSwitchboard: 'Elektro: rozvaděč',
  electroWiringPerM2: 'Elektro: kabeláž (Kč/m²)',
  electroRevision: 'Elektro: revize',
  loxoneRelayBlock: 'Loxone: relé blok',
  loxoneRelayBlockCircuits: 'Loxone: okruhů na relé blok',
  loxoneShadingPerWindow: 'Loxone: žaluzie (okno)',
  loxoneAudioPerZone: 'Loxone: audio (zóna)',
  loxoneAlarmLogic: 'Loxone: logika alarmu',
  marketPriceMultiplier: 'Násobitel tržní ceny (srovnání)',
};

/**
 * Administrace → Ceník konfigurátoru. Katalogy voleb a jednotkové ceny
 * per organizace; bez uložení platí výchozí ceník z aplikace.
 */
export default function ConfiguratorPricesPage() {
  const { toast } = useToast();
  const { config, loading, saving, save } = useConfiguratorConfig();
  const [draft, setDraft] = useState<ConfiguratorConfig | null>(null);

  useEffect(() => {
    if (!loading) setDraft(JSON.parse(JSON.stringify(config)) as ConfiguratorConfig);
  }, [loading, config]);

  if (loading || !draft) {
    return <div className="p-6 py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  const updateOption = (groupKey: keyof ConfiguratorCatalog, index: number, patch: Partial<CatalogOption>) => {
    setDraft((prev) => prev ? {
      ...prev,
      catalog: {
        ...prev.catalog,
        [groupKey]: prev.catalog[groupKey].map((o, i) => i === index ? { ...o, ...patch } : o),
      },
    } : prev);
  };

  const addOption = (groupKey: keyof ConfiguratorCatalog, priceField: string) => {
    setDraft((prev) => prev ? {
      ...prev,
      catalog: {
        ...prev.catalog,
        [groupKey]: [...prev.catalog[groupKey], { label: 'Nová položka', [priceField]: 0 } as CatalogOption],
      },
    } : prev);
  };

  const removeOption = (groupKey: keyof ConfiguratorCatalog, index: number) => {
    setDraft((prev) => prev ? {
      ...prev,
      catalog: {
        ...prev.catalog,
        [groupKey]: prev.catalog[groupKey].filter((_, i) => i !== index),
      },
    } : prev);
  };

  const handleSave = async () => {
    const err = await save(draft);
    if (err) toast(`Uložení se nepodařilo: ${err}`, 'error');
    else toast('Ceník konfigurátoru uložen');
  };

  const handleReset = () => {
    if (!confirm('Vrátit celý ceník na výchozí hodnoty? Změna se projeví až po uložení.')) return;
    setDraft(JSON.parse(JSON.stringify(DEFAULT_CONFIGURATOR_CONFIG)) as ConfiguratorConfig);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Calculator className="w-6 h-6 text-slate-300" />
            <h1 className="text-xl font-bold text-white">Ceník konfigurátoru</h1>
          </div>
          <p className="text-sm text-slate-500">
            Katalogy voleb a jednotkové ceny předběžných nabídek — platí pro celou organizaci
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 text-sm font-semibold transition"
          >
            <RotateCcw className="w-4 h-4" /> Výchozí
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit ceník
          </button>
        </div>
      </div>

      {/* Vychozi hodnoty */}
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4">
        <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Výchozí hodnoty nové nabídky</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ['vatRate', 'DPH (%)'],
            ['margin', 'Výchozí marže (%)'],
            ['projectFee', 'Projekt a koordinace (Kč)'],
            ['coordinationDiscount', 'Bonus za komplet (Kč)'],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-xs text-slate-400 space-y-1">
              <span>{label}</span>
              <input
                type="number"
                value={draft.defaults[key]}
                onChange={(e) => setDraft((p) => p ? {
                  ...p, defaults: { ...p.defaults, [key]: Number(e.target.value) || 0 },
                } : p)}
                className={`${inputCls} w-full text-right`}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Jednotkove ceny */}
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4">
        <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Jednotkové ceny (Kč)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1.5">
          {Object.keys(draft.prices).map((key) => (
            <label key={key} className="flex items-center justify-between gap-2 text-xs text-slate-300 py-0.5">
              <span className="min-w-0 truncate" title={key}>{PRICE_LABELS[key] ?? key}</span>
              <input
                type="number"
                step={key === 'marketPriceMultiplier' ? 0.01 : 1}
                value={draft.prices[key]}
                onChange={(e) => setDraft((p) => p ? {
                  ...p, prices: { ...p.prices, [key]: Number(e.target.value) || 0 },
                } : p)}
                className={`${inputCls} w-24 text-right shrink-0`}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Katalogy */}
      {CATALOG_GROUPS.map((group) => (
        <div key={group.key} className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">{group.title}</div>
            <button
              onClick={() => addOption(group.key, group.priceField)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.10] transition"
            >
              <Plus className="w-3.5 h-3.5" /> Přidat
            </button>
          </div>
          <div className="space-y-1.5">
            {draft.catalog[group.key].map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={option.label}
                  onChange={(e) => updateOption(group.key, i, { label: e.target.value })}
                  className={`${inputCls} flex-1`}
                />
                {group.extraField && (
                  <input
                    type="number"
                    step={group.extraField === 'capacity' ? 0.1 : 1}
                    value={option[group.extraField] ?? 0}
                    onChange={(e) => updateOption(group.key, i, { [group.extraField as string]: Number(e.target.value) || 0 })}
                    title={group.extraField === 'power' ? 'Výkon (Wp)' : 'Kapacita (kWh)'}
                    className={`${inputCls} w-20 text-right`}
                  />
                )}
                <input
                  type="number"
                  step={group.priceField === 'multiplier' ? 0.05 : 1}
                  value={option[group.priceField] ?? 0}
                  onChange={(e) => updateOption(group.key, i, { [group.priceField]: Number(e.target.value) || 0 })}
                  className={`${inputCls} w-28 text-right`}
                />
                <button
                  onClick={() => removeOption(group.key, i)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Odebrat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
