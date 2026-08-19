import { useState } from 'react';
import { TrendingUp, Sun, Zap, Leaf, Clock, DollarSign, Battery, Home, ChevronDown, ChevronUp, Database, MapPin, AlertTriangle } from 'lucide-react';
import type { FvCalculationResult, RoofSurface } from '../../lib/fvCalculations';
import { calculatePayback } from '../../lib/fvCalculations';
import type { CalculationSignature } from './FvSection';

interface Props {
  result: FvCalculationResult;
  totalInvestmentCzk?: number;
  subsidyCzk?: number;
  roofs?: RoofSurface[];
  roofSnapshots?: Record<string, string>;
  resultsStale?: boolean;
  currentPowerKwp?: number;
  lastCalcSignature?: CalculationSignature | null;
}

function BarChart({ data }: { data: { label: string; production: number; consumption: number }[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.production, d.consumption]), 1);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5 h-32">
        {data.map(d => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '100%' }}>
              <div
                className="w-full rounded-t-sm bg-orange-400 transition-all"
                style={{ height: `${(d.production / maxVal) * 100}%` }}
                title={`Výroba: ${d.production} kWh`}
              />
              <div
                className="w-full rounded-t-sm bg-slate-300 transition-all"
                style={{ height: `${(d.consumption / maxVal) * 100}%` }}
                title={`Spotřeba: ${d.consumption} kWh`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-0.5">
        {data.map(d => (
          <div key={d.label} className="flex-1 text-center text-[8px] font-extrabold text-slate-400">{d.label}</div>
        ))}
      </div>
      <div className="flex items-center gap-3 justify-center mt-1">
        <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500">
          <span className="w-3 h-2 bg-orange-400 rounded-sm inline-block" /> Výroba
        </span>
        <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500">
          <span className="w-3 h-2 bg-slate-300 rounded-sm inline-block" /> Spotřeba
        </span>
      </div>
    </div>
  );
}

function CoverageBar({ selfPct, gridPct }: { selfPct: number; gridPct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex rounded-full overflow-hidden h-4">
        <div
          className="bg-orange-400 transition-all flex items-center justify-center"
          style={{ width: `${selfPct}%` }}
        >
          {selfPct > 15 && <span className="text-[9px] font-extrabold text-white">{selfPct}%</span>}
        </div>
        <div
          className="bg-white/[0.08] transition-all flex items-center justify-center"
          style={{ width: `${gridPct}%` }}
        >
          {gridPct > 15 && <span className="text-[9px] font-extrabold text-slate-500">{gridPct}%</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 justify-center">
        <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500">
          <span className="w-3 h-2 bg-orange-400 rounded-sm inline-block" /> FV pokryto
        </span>
        <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500">
          <span className="w-3 h-2 bg-white/[0.08] rounded-sm inline-block" /> Ze sítě
        </span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Sun;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-extrabold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-extrabold leading-tight">{value}</div>
      {sub && <div className="text-[10px] font-extrabold mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

export default function FvOutputCharts({ result, totalInvestmentCzk, subsidyCzk, roofs, roofSnapshots, resultsStale, currentPowerKwp, lastCalcSignature }: Props) {
  const [showPvgisDebug, setShowPvgisDebug] = useState(false);
  const [showSyncDebug, setShowSyncDebug] = useState(false);
  const effectiveInvestment = totalInvestmentCzk
    ? Math.max(0, totalInvestmentCzk - (subsidyCzk ?? 0))
    : undefined;
  const payback = effectiveInvestment && result.totalAnnualBenefitCzk > 0
    ? calculatePayback(effectiveInvestment, result.totalAnnualBenefitCzk)
    : null;

  const chartData = result.monthly.map(m => ({
    label: m.monthLabel,
    production: m.productionKwh,
    consumption: m.consumptionKwh,
  }));

  const gridPct = 100 - result.coveragePct;

  return (
    <div className="space-y-4 p-4">
      {resultsStale && (
        <div className="bg-amber-500/20 border border-amber-400/50 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-extrabold text-amber-300">Výsledek neodpovídá aktuálnímu návrhu</div>
            <div className="text-xs text-amber-400/80 mt-0.5">
              Návrh byl změněn od posledního výpočtu. Proveďte nový výpočet pro aktuální hodnoty.
            </div>
            {currentPowerKwp !== undefined && lastCalcSignature && (
              <div className="text-xs text-amber-400/80 mt-1">
                Aktuální výkon: <span className="font-extrabold">{Math.round(currentPowerKwp * 100) / 100} kWp</span>
                {' | '}
                Výpočet z: <span className="font-extrabold">{lastCalcSignature.totalPowerKwp} kWp</span>
              </div>
            )}
          </div>
        </div>
      )}

      {result.pvgisDebug && (() => {
        const fallbackRoofs = result.pvgisDebug.roofOutputs.filter(r => r.source === 'fallback');
        const allFallback = result.pvgisDebug.roofOutputs.length > 0 && fallbackRoofs.length === result.pvgisDebug.roofOutputs.length;
        const someFallback = fallbackRoofs.length > 0 && !allFallback;

        if (allFallback) {
          return (
            <div className="bg-red-500/20 border border-red-400/50 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-extrabold text-red-300">PVGIS API selhalo</div>
                <div className="text-xs text-red-400/80 mt-0.5">
                  Aktuální výroba NENÍ výstup PVGIS, ale interní odhad. Skutečná výroba se může značně lišit.
                </div>
                <div className="text-xs text-red-400/80 mt-1">
                  Chyby: {fallbackRoofs.map(r => r.errorMessage).filter(Boolean).join('; ') || 'Neznámá chyba'}
                </div>
              </div>
            </div>
          );
        }

        if (someFallback) {
          return (
            <div className="bg-amber-500/20 border border-amber-400/50 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-extrabold text-amber-300">PVGIS nebyl použit pro všechny střechy</div>
                <div className="text-xs text-amber-400/80 mt-0.5">
                  Pro {fallbackRoofs.length} z {result.pvgisDebug.roofOutputs.length} střech byl použit interní odhad místo PVGIS.
                </div>
                <div className="text-xs text-amber-400/80 mt-1">
                  Střechy s odhadem: {fallbackRoofs.map(r => r.roofName).join(', ')}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })()}

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={Sun}
          label="Roční výroba"
          value={`${result.annualProductionKwh.toLocaleString('cs-CZ')} kWh`}
          sub={`${result.totalPowerKwp} kWp instalovaný výkon`}
          color="bg-orange-500/10 text-orange-800"
        />
        <StatCard
          icon={Zap}
          label="Pokrytí spotřeby"
          value={`${result.coveragePct} %`}
          sub={`${result.selfConsumptionKwh.toLocaleString('cs-CZ')} kWh vlastní`}
          color="bg-emerald-500/10 text-emerald-800"
        />
        <StatCard
          icon={DollarSign}
          label="Roční úspory"
          value={`${result.annualSavingsCzk.toLocaleString('cs-CZ')} Kč`}
          sub={result.annualFeedInRevenueCzk > 0 ? `+${result.annualFeedInRevenueCzk.toLocaleString('cs-CZ')} Kč přetoky` : undefined}
          color="bg-blue-500/10 text-blue-800"
        />
        <StatCard
          icon={Leaf}
          label="Úspora CO₂"
          value={`${result.co2SavedKg.toLocaleString('cs-CZ')} kg`}
          sub="za rok"
          color="bg-teal-500/10 text-teal-800"
        />
      </div>

      {payback && effectiveInvestment && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Clock}
            label="Návratnost"
            value={payback.years < 99 ? `${payback.years} let` : '> 30 let'}
            sub={
              subsidyCzk && subsidyCzk > 0 && totalInvestmentCzk
                ? `${effectiveInvestment.toLocaleString('cs-CZ')} Kč po dotaci (z ${totalInvestmentCzk.toLocaleString('cs-CZ')} Kč)`
                : effectiveInvestment ? `Investice ${effectiveInvestment.toLocaleString('cs-CZ')} Kč` : undefined
            }
            color="bg-white/[0.04] text-slate-300"
          />
          <StatCard
            icon={TrendingUp}
            label="Zisk za 20 let"
            value={payback.npv20 >= 0 ? `+${payback.npv20.toLocaleString('cs-CZ')} Kč` : `${payback.npv20.toLocaleString('cs-CZ')} Kč`}
            color={payback.npv20 >= 0 ? 'bg-emerald-500/10 text-emerald-800' : 'bg-red-500/10 text-red-800'}
          />
        </div>
      )}

      {roofs && roofs.some(r => r.panelCount > 0 && (roofSnapshots?.[r.id] || r.snapshotDataUrl)) && (
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <Home className="w-3 h-3" /> Návrh střech
          </div>
          <div className="grid grid-cols-2 gap-2">
            {roofs.filter(r => r.panelCount > 0 && (roofSnapshots?.[r.id] || r.snapshotDataUrl)).map(roof => (
              <div key={roof.id} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.04]">
                <img
                  src={roofSnapshots?.[roof.id] || roof.snapshotDataUrl || ''}
                  alt={roof.name}
                  className="w-full h-32 object-contain bg-white/[0.06]"
                />
                <div className="px-2.5 py-2 border-t border-white/[0.06]">
                  <div className="text-[11px] font-extrabold text-slate-300 truncate">{roof.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {roof.panelCount} ks / {Math.round(roof.panelCount * roof.panelPowerWp / 10) / 100} kWp / {roof.azimuthDeg}° / {roof.tiltDeg}°
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
          Měsíční výroba vs spotřeba
        </div>
        <BarChart data={chartData} />
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
          Krytí spotřeby
        </div>
        <CoverageBar selfPct={result.coveragePct} gridPct={gridPct} />
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Battery className="w-3 h-3" /> Doporučená baterie
        </div>
        <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-3">
          <div className="text-xl font-extrabold text-orange-800">{result.recommendedBatteryKwh} kWh</div>
          <div className="text-[10px] font-extrabold text-orange-600 mt-0.5">
            Optimální kapacita pro maximalizaci vlastní spotřeby
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
          Energetická bilance (kWh/rok)
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/20">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-orange-500">Výroba z PVGIS (podle lokality)</div>
          </div>
          <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.06]">
            <span className="text-[11px] font-extrabold text-slate-400">Výroba FV</span>
            <span className="text-[11px] font-extrabold text-orange-600">
              {Math.round(result.pvgisDebug?.totalPvgisAnnualKwh ?? result.annualProductionKwh).toLocaleString('cs-CZ')} kWh
            </span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.06]">
            <span className="text-[11px] font-extrabold text-slate-400">Spotřeba</span>
            <span className="text-[11px] font-extrabold text-slate-300">
              {Math.round(result.annualConsumptionKwh).toLocaleString('cs-CZ')} kWh
            </span>
          </div>
          <div className="px-3 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-500">Vlastní spotřeba (detail)</div>
            <div className="text-[8px] text-slate-500 mt-0.5">Baterie má kontinuální SOC bez denního resetu</div>
          </div>
          <div className="space-y-0">
            {(() => {
              const totalDirectSelf = result.monthly.reduce((s, m) => s + (m.directSelfConsumptionKwh ?? 0), 0);
              const totalBatteryContrib = result.monthly.reduce((s, m) => s + (m.batteryContributionKwh ?? 0), 0);
              const hasBattery = totalBatteryContrib > 0;

              const rows = [
                { label: 'Přímá vlastní spotřeba', value: totalDirectSelf, color: 'text-emerald-500' },
                ...(hasBattery ? [{ label: 'Z baterie', value: totalBatteryContrib, color: 'text-violet-400' }] : []),
                { label: 'Vlastní spotřeba celkem', value: result.selfConsumptionKwh, color: 'text-emerald-400', bold: true },
                { label: 'Přetoky do sítě', value: result.gridFeedKwh, color: 'text-blue-400' },
                { label: 'Odběr ze sítě', value: result.gridDrawKwh, color: 'text-slate-500' },
              ];

              return rows.map(row => (
                <div key={row.label} className={`flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] last:border-0 ${row.bold ? 'bg-white/[0.02]' : ''}`}>
                  <span className={`text-[11px] font-extrabold text-slate-400 ${row.bold ? 'pl-2' : ''}`}>{row.label}</span>
                  <span className={`text-[11px] font-extrabold ${row.color}`}>
                    {Math.round(row.value).toLocaleString('cs-CZ')} kWh
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>

        {result.batteryContributionKwh !== undefined && result.batteryContributionKwh > 0 && (
          <div className="mt-2 bg-violet-500/10 border border-violet-400/30 rounded-xl p-3">
            <div className="text-[10px] font-extrabold text-violet-400 mb-1">Debug: Baterie (měsíční SOC)</div>
            <div className="grid grid-cols-6 gap-1 text-[8px]">
              {result.monthly.map((m, i) => (
                <div key={i} className="text-center">
                  <div className="text-slate-500">{MONTH_LABELS[i]}</div>
                  <div className="text-violet-400 font-extrabold">{m.batteryStartSocKwh?.toFixed(1) ?? '-'}</div>
                  <div className="text-slate-500 text-[7px]">
                    +{m.batteryChargeKwh ?? 0} / -{m.batteryDischargeKwh ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {result.pvgisDebug && (
        <div>
          <button
            onClick={() => setShowPvgisDebug(!showPvgisDebug)}
            className="w-full flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 hover:text-slate-300 transition"
          >
            <Database className="w-3 h-3" />
            <span className="flex-1 text-left">PVGIS Debug</span>
            {showPvgisDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showPvgisDebug && (
            <div className="space-y-3 bg-slate-800/50 rounded-xl p-3">
              {result.pvgisDebug.address && (
                <div className="flex items-start gap-2 text-[10px] text-slate-400">
                  <Home className="w-3 h-3 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-extrabold">Adresa:</span>
                    <span className="ml-1 text-slate-300">{result.pvgisDebug.address}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <MapPin className="w-3 h-3" />
                <span className="font-extrabold">Souřadnice:</span>
                <span>{result.pvgisDebug.lat.toFixed(4)}, {result.pvgisDebug.lon.toFixed(4)}</span>
              </div>

              {result.pvgisDebug.roofOutputs.map((roofOut, idx) => {
                const roofIn = result.pvgisDebug!.roofInputs[idx];
                return (
                  <div key={roofOut.roofId} className="border-t border-white/[0.06] pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-extrabold text-slate-300">{roofOut.roofName}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${roofOut.source === 'pvgis' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {roofOut.source === 'pvgis' ? 'PVGIS' : 'Odhad'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">peakpower:</span>
                        <span className="text-slate-300 font-extrabold">{roofIn.peakPowerKwp.toFixed(3)} kWp</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">aspect:</span>
                        <span className="text-slate-300 font-extrabold">{roofIn.aspect}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">angle:</span>
                        <span className="text-slate-300 font-extrabold">{roofIn.angle}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">loss:</span>
                        <span className="text-slate-300 font-extrabold">{roofIn.loss}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">mounting:</span>
                        <span className="text-slate-300 font-extrabold">{roofIn.mountingplace}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">roční:</span>
                        <span className={`font-extrabold ${roofOut.source === 'pvgis' ? 'text-orange-400' : 'text-red-400'}`}>{Math.round(roofOut.annualKwh).toLocaleString('cs-CZ')} kWh</span>
                      </div>
                    </div>
                    {roofOut.httpStatus && (
                      <div className="text-[9px] text-slate-500 mt-1">
                        HTTP Status: <span className={roofOut.httpStatus === 200 ? 'text-emerald-400' : 'text-red-400'}>{roofOut.httpStatus}</span>
                      </div>
                    )}
                    {roofOut.errorMessage && (
                      <div className="text-[9px] text-red-400 mt-1 break-all">{roofOut.errorMessage}</div>
                    )}
                    {roofOut.requestUrl && (
                      <div className="text-[8px] text-slate-600 mt-1 break-all font-mono">
                        URL: {roofOut.requestUrl}
                      </div>
                    )}
                    <div className="mt-1.5">
                      <div className="text-[9px] text-slate-500 mb-1">
                        Měsíční {roofOut.source === 'pvgis' ? 'PVGIS' : 'odhadovaná'} výroba (kWh):
                      </div>
                      <div className="grid grid-cols-12 gap-0.5 text-[8px]">
                        {MONTH_LABELS.map((m, i) => (
                          <div key={m} className="text-center">
                            <div className="text-slate-500">{m}</div>
                            <div className={`font-extrabold ${roofOut.source === 'pvgis' ? 'text-orange-400' : 'text-red-400'}`}>{Math.round(roofOut.monthlyKwh[i])}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="border-t border-white/[0.06] pt-2">
                <div className="flex justify-between text-[11px]">
                  <span className="font-extrabold text-slate-400">Celkem PVGIS výroba:</span>
                  <span className="font-extrabold text-orange-400">{Math.round(result.pvgisDebug.totalPvgisAnnualKwh).toLocaleString('cs-CZ')} kWh</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {lastCalcSignature && (
        <div>
          <button
            onClick={() => setShowSyncDebug(!showSyncDebug)}
            className="w-full flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 hover:text-slate-300 transition"
          >
            <Zap className="w-3 h-3" />
            <span className="flex-1 text-left">Synchronizace výpočtu</span>
            {showSyncDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSyncDebug && (
            <div className="space-y-2 bg-slate-800/50 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Aktuální výkon:</span>
                  <span className={`font-extrabold ${resultsStale ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {currentPowerKwp !== undefined ? `${Math.round(currentPowerKwp * 100) / 100} kWp` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Výpočet z:</span>
                  <span className="text-slate-300 font-extrabold">{lastCalcSignature.totalPowerKwp} kWp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Panelů aktuálně:</span>
                  <span className={`font-extrabold ${resultsStale ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {roofs?.reduce((s, r) => s + r.panelCount, 0) ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Panelů při výpočtu:</span>
                  <span className="text-slate-300 font-extrabold">{lastCalcSignature.totalPanelCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Baterie aktuálně:</span>
                  <span className="text-slate-300 font-extrabold">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Baterie při výpočtu:</span>
                  <span className="text-slate-300 font-extrabold">{lastCalcSignature.batteryKwh} kWh</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-slate-500">Čas výpočtu:</span>
                  <span className="text-slate-300 font-extrabold">
                    {new Date(lastCalcSignature.timestamp).toLocaleString('cs-CZ')}
                  </span>
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${resultsStale ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className={`text-[10px] font-extrabold ${resultsStale ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {resultsStale ? 'Výsledky neaktuální' : 'Výsledky odpovídají návrhu'}
                  </span>
                </div>
              </div>
              {lastCalcSignature.roofSignatures.length > 0 && (
                <div className="border-t border-white/[0.06] pt-2">
                  <div className="text-[9px] text-slate-500 mb-1 font-extrabold">Střechy při výpočtu:</div>
                  {lastCalcSignature.roofSignatures.map(rs => (
                    <div key={rs.id} className="text-[9px] text-slate-400">
                      {rs.panelCount} ks × {rs.powerWp} Wp = {Math.round(rs.panelCount * rs.powerWp / 10) / 100} kWp | {rs.azimuth}° / {rs.tilt}°
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
