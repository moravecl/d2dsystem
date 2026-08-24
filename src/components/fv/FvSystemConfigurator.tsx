import { useState, useMemo, useEffect } from 'react';
import { Zap, Battery, Car, Plus, Minus, Package, Check, Info, Sun } from 'lucide-react';
import type { FvCatalogData, FvInverter, FvBattery, FvAccessory } from '../../hooks/useFvCatalog';
import type { FvSystemConfig } from '../../hooks/useFvDesign';
import type { FvCalculationResult, RoofSurface } from '../../lib/fvCalculations';
import { calcConstructionCostBreakdown } from './fvQuoteBuilder';
import type { SubsidyProgram } from '../../hooks/useSubsidyPrograms';
import { computeSubsidy } from '../../hooks/useSubsidyPrograms';

interface Props {
  catalog: FvCatalogData;
  config: FvSystemConfig;
  result: FvCalculationResult | null;
  totalPowerKwp: number;
  evCount: number;
  roofs: RoofSurface[];
  subsidyPrograms: SubsidyProgram[];
  onChange: (config: FvSystemConfig) => void;
}

function InverterCard({ inverter, selected, onSelect }: { inverter: FvInverter; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition text-left ${
        selected ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.06] hover:border-orange-200'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-orange-500/20' : 'bg-white/[0.06]'}`}>
        <Zap className={`w-4 h-4 ${selected ? 'text-orange-600' : 'text-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-extrabold text-white truncate">{inverter.name}</div>
        <div className="text-[10px] font-extrabold text-slate-500 mt-0.5">
          {inverter.manufacturer} · {inverter.power_kw} kW · {inverter.phases}f · {inverter.mppt_count} MPPT
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="text-xs font-extrabold text-slate-300">{inverter.price.toLocaleString('cs-CZ')} Kč</div>
        {selected && <Check className="w-3.5 h-3.5 text-orange-500" />}
      </div>
    </button>
  );
}

function BatterySelector({
  batteries,
  masterId,
  masterCount,
  slaveId,
  slaveCount,
  onChangeMaster,
  onChangeSlave,
}: {
  batteries: FvBattery[];
  masterId: string | undefined;
  masterCount: number;
  slaveId: string | undefined;
  slaveCount: number;
  onChangeMaster: (id: string | undefined, count: number) => void;
  onChangeSlave: (id: string | undefined, count: number) => void;
}) {
  const CHEMISTRY_LABELS: Record<string, string> = { lfp: 'LFP', nmc: 'NMC', lead: 'Olovo', other: 'Jiná' };
  const ROLE_LABELS: Record<string, string> = { master: 'Master', slave: 'Slave', bms: 'BMS', standalone: 'Samostatná' };

  const masterBatteries = batteries.filter(b =>
    b.battery_role === 'master' || b.battery_role === 'bms' || b.battery_role === 'standalone'
  );

  const selectedMaster = batteries.find(b => b.id === masterId);

  const compatibleSlaves = batteries.filter(b => {
    if (b.battery_role !== 'slave') return false;
    if (!selectedMaster) return false;
    if (!selectedMaster.compatibility_group) return true;
    return b.compatibility_group === selectedMaster.compatibility_group;
  });

  const maxSlaveUnits = selectedMaster?.max_slave_units ?? 99;

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] font-extrabold text-slate-500 mb-1.5 flex items-center gap-1">
          <Battery className="w-3 h-3" /> Master / BMS / Samostatná baterie
        </div>
        <div className="space-y-1.5">
          {masterBatteries.map(bat => {
            const isSelected = masterId === bat.id;
            return (
              <div
                key={bat.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition cursor-pointer ${
                  isSelected ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.06] hover:border-orange-200'
                }`}
                onClick={() => onChangeMaster(isSelected ? undefined : bat.id, isSelected ? 0 : 1)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500/20' : 'bg-white/[0.06]'}`}>
                  <Battery className={`w-4 h-4 ${isSelected ? 'text-orange-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold text-white truncate">{bat.name}</div>
                  <div className="text-[10px] font-extrabold text-slate-500 mt-0.5">
                    {bat.manufacturer} · {bat.capacity_kwh} kWh · {CHEMISTRY_LABELS[bat.chemistry] ?? bat.chemistry}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-extrabold text-emerald-400">{bat.price.toLocaleString('cs-CZ')} Kč</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                      bat.battery_role === 'master' ? 'bg-blue-500/20 text-blue-300' :
                      bat.battery_role === 'bms' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {ROLE_LABELS[bat.battery_role] ?? bat.battery_role}
                    </span>
                    {bat.compatibility_group && (
                      <span className="text-[9px] font-extrabold text-slate-400">
                        Skupina: {bat.compatibility_group}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); onChangeMaster(bat.id, Math.max(1, masterCount - 1)); }} className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-slate-500 hover:bg-white/[0.08] transition">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-extrabold text-slate-300">{masterCount}</span>
                    <button onClick={(e) => { e.stopPropagation(); onChangeMaster(bat.id, masterCount + 1); }} className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-slate-500 hover:bg-white/[0.08] transition">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {isSelected && <Check className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {masterId && selectedMaster && (selectedMaster.battery_role === 'master' || selectedMaster.battery_role === 'bms') && compatibleSlaves.length > 0 && (
        <div>
          <div className="text-[10px] font-extrabold text-slate-500 mb-1.5 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Slave (rozšiřující) baterie
            {selectedMaster.compatibility_group && (
              <span className="text-slate-400 font-normal">(kompatibilní: {selectedMaster.compatibility_group})</span>
            )}
            {maxSlaveUnits < 99 && (
              <span className="text-slate-400 font-normal ml-1">max. {maxSlaveUnits} ks</span>
            )}
          </div>
          <div className="space-y-1.5">
            {compatibleSlaves.map(bat => {
              const isSelected = slaveId === bat.id;
              const currentCount = isSelected ? slaveCount : 0;
              const canAddMore = currentCount < maxSlaveUnits;
              return (
                <div
                  key={`slave-${bat.id}`}
                  className={`flex items-start gap-2.5 p-2 rounded-xl border-2 transition cursor-pointer ${
                    isSelected ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 bg-white/[0.06] hover:border-teal-200'
                  }`}
                  onClick={() => {
                    if (isSelected) {
                      onChangeSlave(undefined, 0);
                    } else if (canAddMore || !slaveId) {
                      onChangeSlave(bat.id, 1);
                    }
                  }}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-teal-500/20' : 'bg-white/[0.06]'}`}>
                    <Battery className={`w-3.5 h-3.5 ${isSelected ? 'text-teal-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-extrabold text-white truncate">{bat.name}</div>
                    <div className="text-[10px] font-extrabold text-slate-500">{bat.capacity_kwh} kWh · {bat.price.toLocaleString('cs-CZ')} Kč</div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onChangeSlave(bat.id, Math.max(0, slaveCount - 1)); }} className="w-5 h-5 rounded bg-white/[0.06] flex items-center justify-center text-slate-500 hover:bg-white/[0.08] transition">
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-extrabold text-slate-300">{slaveCount}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (slaveCount < maxSlaveUnits) onChangeSlave(bat.id, slaveCount + 1); }}
                        disabled={slaveCount >= maxSlaveUnits}
                        className={`w-5 h-5 rounded bg-white/[0.06] flex items-center justify-center transition ${
                          slaveCount >= maxSlaveUnits ? 'text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:bg-white/[0.08]'
                        }`}
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AccessoryRow({ acc, qty, onChange }: { acc: FvAccessory; qty: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/[0.06] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-extrabold text-slate-300 truncate">{acc.name}</div>
        <div className="text-[10px] font-extrabold text-slate-400">{acc.price_per_unit.toLocaleString('cs-CZ')} Kč/{acc.unit}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onChange(Math.max(0, qty - 1))} className="w-5 h-5 rounded bg-white/[0.06] flex items-center justify-center text-slate-500 hover:bg-white/[0.08] transition">
          <Minus className="w-2.5 h-2.5" />
        </button>
        <span className="w-6 text-center text-xs font-extrabold text-slate-300">{qty}</span>
        <button onClick={() => onChange(qty + 1)} className="w-5 h-5 rounded bg-white/[0.06] flex items-center justify-center text-slate-500 hover:bg-white/[0.08] transition">
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}


export default function FvSystemConfigurator({ catalog, config, result, totalPowerKwp, evCount, roofs, subsidyPrograms, onChange }: Props) {
  const [laborCost, setLaborCost] = useState(String(config.laborCost ?? 15000));
  const [subsidyCustom, setSubsidyCustom] = useState(String(config.subsidyCzk ?? 0));
  const isCustomSubsidy = !config.subsidyProgramId && (config.subsidyCzk ?? 0) > 0;

  const update = (patch: Partial<FvSystemConfig>) => onChange({ ...config, ...patch });

  const getAccQty = (id: string) => config.accessories?.find(a => a.accessoryId === id)?.quantity ?? 0;
  const setAccQty = (id: string, qty: number) => {
    const existing = config.accessories ?? [];
    const next = qty === 0
      ? existing.filter(a => a.accessoryId !== id)
      : existing.some(a => a.accessoryId === id)
        ? existing.map(a => a.accessoryId === id ? { ...a, quantity: qty } : a)
        : [...existing, { accessoryId: id, quantity: qty }];
    update({ accessories: next });
  };

  const handleMasterChange = (id: string | undefined, count: number) => {
    if (!id || count === 0) {
      update({ batteryId: undefined, batteryCount: 0, slaveBatteryId: undefined, slaveBatteryCount: 0 });
    } else {
      update({ batteryId: id, batteryCount: count });
    }
  };

  const handleSlaveChange = (id: string | undefined, count: number) => {
    if (!id || count === 0) {
      update({ slaveBatteryId: undefined, slaveBatteryCount: 0 });
    } else {
      update({ slaveBatteryId: id, slaveBatteryCount: count });
    }
  };

  const selectedInverter = catalog.inverters.find(i => i.id === config.inverterId);
  const masterBattery = catalog.batteries.find(b => b.id === config.batteryId);
  const slaveBattery = catalog.batteries.find(b => b.id === config.slaveBatteryId);
  const masterCount = config.batteryCount ?? 0;
  const slaveCount = config.slaveBatteryCount ?? 0;
  const totalBatteryKwh = (masterBattery ? masterBattery.capacity_kwh * masterCount : 0) +
    (slaveBattery ? slaveBattery.capacity_kwh * slaveCount : 0);

  const suggestedInverters = useMemo(() =>
    catalog.inverters.filter(i => i.power_kw >= totalPowerKwp * 0.8 && i.power_kw <= totalPowerKwp * 1.3),
    [catalog.inverters, totalPowerKwp]
  );

  const inverterCost = selectedInverter?.price ?? 0;
  const masterBatteryCost = (masterBattery?.price ?? 0) * masterCount;
  const slaveBatteryCost = (slaveBattery?.price ?? 0) * slaveCount;
  const batteryCost = masterBatteryCost + slaveBatteryCost;
  const wallboxCost = catalog.wallboxes.find(w => w.id === config.wallboxId)?.price ?? 0;
  const accessoryCost = (config.accessories ?? []).reduce((sum, a) => {
    const acc = catalog.accessories.find(x => x.id === a.accessoryId);
    return sum + (acc?.price_per_unit ?? 0) * a.quantity;
  }, 0);
  const labor = parseFloat(laborCost) || 0;
  const subsidyCzk = config.subsidyCzk ?? 0;

  const panelLines = roofs.filter(r => r.panelCount > 0).map(r => {
    const panel = catalog.panels.find(p => p.id === r.panelId);
    return {
      roofName: r.name,
      panelName: panel?.name ?? `${r.panelPowerWp} Wp`,
      count: r.panelCount,
      unitPrice: panel?.price ?? 0,
      total: r.panelCount * (panel?.price ?? 0),
    };
  });
  const totalPanelCost = panelLines.reduce((s, l) => s + l.total, 0);

  const constructionBreakdown = calcConstructionCostBreakdown(
    roofs, catalog.roofTiles, catalog.hooks, catalog.railProfiles, catalog.clamps,
  );
  const constructionCost = constructionBreakdown.total;

  const totalInvestment = inverterCost + batteryCost + wallboxCost + accessoryCost + labor + totalPanelCost + constructionCost;
  const totalAfterSubsidy = Math.max(0, totalInvestment - subsidyCzk);

  const selectedProgram = subsidyPrograms.find(p => p.id === config.subsidyProgramId);
  const computedSubsidy = selectedProgram ? computeSubsidy(selectedProgram, totalInvestment) : null;

  useEffect(() => {
    const patches: Partial<FvSystemConfig> = {};
    if (config.totalInvestmentCzk !== totalInvestment) {
      patches.totalInvestmentCzk = totalInvestment;
    }
    if (computedSubsidy !== null && config.subsidyCzk !== computedSubsidy) {
      patches.subsidyCzk = computedSubsidy;
    }
    if (Object.keys(patches).length > 0) {
      onChange({ ...config, ...patches });
    }
  }, [totalInvestment, computedSubsidy]);

  const totalPanels = roofs.reduce((s, r) => s + r.panelCount, 0);

  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Sun className="w-3 h-3" /> Panely ze střech
        </div>
        {totalPanels === 0 ? (
          <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-3 text-xs text-amber-400 font-extrabold">
            Zatím nejsou umístěny žádné panely. Vraťte se do sekce "Střechy & Panely".
          </div>
        ) : (
          <div className="space-y-1.5">
            {roofs.filter(r => r.panelCount > 0).map(r => {
              const panel = catalog.panels.find(p => p.id === r.panelId);
              const roofKwp = Math.round((r.panelCount * r.panelPowerWp) / 10) / 100;
              return (
                <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-orange-200 bg-orange-500/10">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Sun className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">{r.name}</div>
                    <div className="text-[10px] font-extrabold text-slate-500">
                      {panel ? `${panel.name} (${panel.manufacturer})` : `${r.panelPowerWp} Wp`}
                      {' '}&middot; {r.panelCount} ks &middot; {roofKwp} kWp
                    </div>
                  </div>
                  <div className="text-xs font-extrabold text-slate-300 shrink-0">
                    {panel ? `${(r.panelCount * panel.price).toLocaleString('cs-CZ')} Kč` : (
                      <span className="text-amber-400">bez ceny</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Střídač
          {totalPowerKwp > 0 && <span className="text-[10px] font-normal text-slate-400 normal-case">(FV: {totalPowerKwp} kWp)</span>}
        </div>
        {suggestedInverters.length > 0 && !config.inverterId && (
          <div className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 rounded-lg px-2 py-1 mb-2">
            Doporučeno pro váš výkon: {suggestedInverters.length} střídač(ů)
          </div>
        )}
        {catalog.inverters.length === 0 ? (
          <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-extrabold">
            Žádné střídače v katalogu. Přidejte je v Admin → FV katalog.
          </div>
        ) : (
          <div className="space-y-1.5">
            {(suggestedInverters.length > 0 ? suggestedInverters : catalog.inverters).map(inv => (
              <InverterCard
                key={inv.id}
                inverter={inv}
                selected={config.inverterId === inv.id}
                onSelect={() => update({ inverterId: config.inverterId === inv.id ? undefined : inv.id })}
              />
            ))}
            {suggestedInverters.length > 0 && suggestedInverters.length < catalog.inverters.length && (
              <div className="text-[10px] font-extrabold text-slate-400 text-center pt-1">
                Zobrazeno {suggestedInverters.length} z {catalog.inverters.length} střídačů (filtrováno dle výkonu)
              </div>
            )}
          </div>
        )}
      </div>

      {result && result.recommendedBatteryKwh > 0 && (
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <Battery className="w-3 h-3" /> Bateriové úložiště
            <span className="text-[10px] font-normal text-orange-500 normal-case">(doporuč. {result.recommendedBatteryKwh} kWh)</span>
          </div>
          {catalog.batteries.length === 0 ? (
            <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-extrabold">
              Žádné baterie v katalogu.
            </div>
          ) : (
            <BatterySelector
              batteries={catalog.batteries}
              masterId={config.batteryId}
              masterCount={masterCount}
              slaveId={config.slaveBatteryId}
              slaveCount={slaveCount}
              onChangeMaster={handleMasterChange}
              onChangeSlave={handleSlaveChange}
            />
          )}
          {totalBatteryKwh > 0 && (
            <div className="mt-1.5 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 rounded-lg px-2 py-1 flex items-center gap-1.5">
              <Battery className="w-3 h-3" />
              Celkem: {totalBatteryKwh} kWh
              {masterCount > 0 && <span className="text-emerald-500">({masterCount}x master{slaveCount > 0 ? ` + ${slaveCount}x slave` : ''})</span>}
            </div>
          )}
        </div>
      )}

      {evCount > 0 && (
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <Car className="w-3 h-3" /> Wallbox
          </div>
          {catalog.wallboxes.length === 0 ? (
            <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-extrabold">
              Žádné wallboxy v katalogu.
            </div>
          ) : (
            <div className="space-y-1.5">
              {catalog.wallboxes.map(wb => (
                <button
                  key={wb.id}
                  onClick={() => update({ wallboxId: config.wallboxId === wb.id ? undefined : wb.id })}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition text-left ${
                    config.wallboxId === wb.id ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.06] hover:border-orange-200'
                  }`}
                >
                  <Car className={`w-4 h-4 shrink-0 ${config.wallboxId === wb.id ? 'text-orange-600' : 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">{wb.name}</div>
                    <div className="text-[10px] font-extrabold text-slate-500">
                      {wb.manufacturer} · {wb.power_kw} kW · {wb.phases}f · {wb.connector_type.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-xs font-extrabold text-slate-300 shrink-0">{wb.price.toLocaleString('cs-CZ')} Kč</div>
                  {config.wallboxId === wb.id && <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {catalog.accessories.length > 0 && (
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <Package className="w-3 h-3" /> Příslušenství a montáž
          </div>
          <div className="bg-navy-800/60 border border-white/[0.08] rounded-xl p-2">
            {catalog.accessories.map(acc => (
              <AccessoryRow
                key={acc.id}
                acc={acc}
                qty={getAccQty(acc.id)}
                onChange={n => setAccQty(acc.id, n)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
          Práce a montáž (Kč)
        </div>
        <input
          type="number"
          min="0"
          step="1000"
          className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
          value={laborCost}
          onChange={e => {
            setLaborCost(e.target.value);
            update({ laborCost: parseFloat(e.target.value) || 0 });
          }}
        />
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Info className="w-3 h-3" /> Dotace
        </div>
        {subsidyPrograms.length > 0 ? (
          <div className="space-y-1.5 mb-2">
            {subsidyPrograms.filter(p => p.is_active).map(prog => {
              const isSelected = config.subsidyProgramId === prog.id;
              const progSubsidy = computeSubsidy(prog, totalInvestment);
              return (
                <button
                  key={prog.id}
                  onClick={() => {
                    if (isSelected) {
                      update({ subsidyProgramId: undefined, subsidyCzk: 0 });
                      setSubsidyCustom('0');
                    } else {
                      update({ subsidyProgramId: prog.id, subsidyCzk: progSubsidy });
                      setSubsidyCustom(String(progSubsidy));
                    }
                  }}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition text-left ${
                    isSelected ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-white/[0.06] hover:border-emerald-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500/20' : 'bg-white/[0.06]'}`}>
                    <Info className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold text-white">{prog.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      max {prog.max_amount_czk.toLocaleString('cs-CZ')} Kc / max {prog.max_percentage}% z ceny
                    </div>
                    {prog.description && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{prog.description}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className={`text-xs font-extrabold ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                      -{progSubsidy.toLocaleString('cs-CZ')} Kc
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 mb-2">
            Zadne dotacni programy. Pridejte je v Admin &rarr; FV katalog &rarr; Dotace.
          </div>
        )}
        <button
          onClick={() => {
            if (isCustomSubsidy) {
              update({ subsidyProgramId: undefined, subsidyCzk: 0 });
              setSubsidyCustom('0');
            } else {
              update({ subsidyProgramId: undefined, subsidyCzk: parseInt(subsidyCustom) || 0 });
            }
          }}
          className={`w-full px-2 py-1.5 rounded-xl text-[10px] font-extrabold transition border text-left mb-1.5 ${
            isCustomSubsidy
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-white/[0.06] text-slate-400 border-white/10 hover:border-emerald-300'
          }`}
        >
          Vlastni castka
        </button>
        {isCustomSubsidy && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1000"
              className="flex-1 border border-emerald-300 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-emerald-400 bg-white/[0.06]"
              value={subsidyCustom}
              onChange={e => {
                setSubsidyCustom(e.target.value);
                update({ subsidyProgramId: undefined, subsidyCzk: parseInt(e.target.value) || 0 });
              }}
            />
            <span className="text-xs font-extrabold text-slate-400">Kc</span>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl p-3 space-y-1.5">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Kalkulace ceny</div>
        {panelLines.map(pl => (
          <div key={pl.roofName} className="flex justify-between text-[11px]">
            <span className="font-extrabold text-orange-400">{pl.panelName} ({pl.count}x) <span className="text-slate-500">- {pl.roofName}</span></span>
            <span className="font-extrabold text-orange-300">{pl.total.toLocaleString('cs-CZ')} Kč</span>
          </div>
        ))}
        {totalPanelCost === 0 && roofs.some(r => r.panelCount > 0) && (
          <div className="text-[10px] font-extrabold text-amber-400 bg-amber-900/30 rounded-lg px-2 py-1">
            Panely nemají přiřazenou cenu. Vyberte panel z katalogu v sekci "Střechy & Panely".
          </div>
        )}
        {[
          { label: 'Střídač', value: inverterCost },
          { label: `Baterie master (${masterCount}x)`, value: masterBatteryCost },
          { label: `Baterie slave (${slaveCount}x)`, value: slaveBatteryCost },
          { label: 'Wallbox', value: wallboxCost },
          { label: 'Příslušenství', value: accessoryCost },
          { label: 'Háky', value: constructionBreakdown.hooksCost },
          { label: 'Profily (lišty)', value: constructionBreakdown.profilesCost },
          { label: 'Středové příchytky', value: constructionBreakdown.midClampsCost },
          { label: 'Krajové příchytky', value: constructionBreakdown.endClampsCost },
          { label: 'Práce', value: labor },
        ].filter(r => r.value > 0).map(row => (
          <div key={row.label} className="flex justify-between text-[11px]">
            <span className="font-extrabold text-slate-400">{row.label}</span>
            <span className="font-extrabold text-slate-300">{row.value.toLocaleString('cs-CZ')} Kč</span>
          </div>
        ))}
        <div className="border-t border-slate-700 pt-1.5 flex justify-between">
          <span className="text-xs font-extrabold text-slate-300">Celkem</span>
          <span className="text-sm font-extrabold text-white">{totalInvestment.toLocaleString('cs-CZ')} Kč</span>
        </div>
        {subsidyCzk > 0 && (
          <>
            <div className="flex justify-between text-[11px]">
              <span className="font-extrabold text-emerald-400">Dotace</span>
              <span className="font-extrabold text-emerald-400">-{subsidyCzk.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="border-t border-slate-700 pt-1.5 flex justify-between">
              <span className="text-xs font-extrabold text-emerald-300">Po dotaci</span>
              <span className="text-sm font-extrabold text-emerald-400">{totalAfterSubsidy.toLocaleString('cs-CZ')} Kč</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
