import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sun, Loader2, RefreshCw, AlertCircle, Plus, FileText, Battery, Zap, AlertTriangle } from 'lucide-react';
import { useFvCatalog } from '../../hooks/useFvCatalog';
import { useFvDesign } from '../../hooks/useFvDesign';
import { useFvDesignVersions } from '../../hooks/useFvDesignVersions';
import type { FvDesignVersion } from '../../hooks/useFvDesignVersions';
import { calculateFvSystem } from '../../lib/fvCalculations';
import type { FvInputParams, RoofSurface, FvCalculationResult } from '../../lib/fvCalculations';
import type { FvSystemConfig } from '../../hooks/useFvDesign';
import type { QuoteSection } from '../catalog/quoteHelpers';
import FvInputForm from './FvInputForm';
import RoofDesigner from './RoofDesigner';
import FvOutputCharts from './FvOutputCharts';
import FvSystemConfigurator from './FvSystemConfigurator';
import FvPdfExportModal from './FvPdfExportModal';
import FvQuoteTab from './FvQuoteTab';
import SaveVersionButton from '../ui/SaveVersionButton';
import VersionHistoryDrawer from '../ui/VersionHistoryDrawer';
import type { VersionItem } from '../ui/VersionHistoryDrawer';
import VersionPickerModal from '../ui/VersionPickerModal';
import { exportFvProposalPdf } from './fvPdfExport';
import type { PdfSectionFlags } from './fvPdfExport';
import { useSubsidyPrograms } from '../../hooks/useSubsidyPrograms';
import { loadQuoteClientInfo, loadQuoteCompanyInfo, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';

export interface CalculationSignature {
  totalPanelCount: number;
  totalPowerKwp: number;
  roofSignatures: { id: string; panelCount: number; powerWp: number; azimuth: number; tilt: number }[];
  lat: number;
  lon: number;
  batteryKwh: number;
  annualConsumptionKwh: number;
  timestamp: number;
}

function createCalculationSignature(
  params: FvInputParams | null,
  roofs: RoofSurface[],
  batteryKwh: number
): CalculationSignature | null {
  if (!params) return null;
  const roofSignatures = roofs.map(r => ({
    id: r.id,
    panelCount: r.panelCount,
    powerWp: r.panelPowerWp,
    azimuth: r.azimuthDeg,
    tilt: r.tiltDeg,
  }));
  const totalPanelCount = roofs.reduce((s, r) => s + r.panelCount, 0);
  const totalPowerKwp = Math.round(roofs.reduce((s, r) => s + (r.panelCount * r.panelPowerWp) / 1000, 0) * 100) / 100;
  return {
    totalPanelCount,
    totalPowerKwp,
    roofSignatures,
    lat: params.lat,
    lon: params.lon,
    batteryKwh,
    annualConsumptionKwh: params.annualConsumptionKwh,
    timestamp: Date.now(),
  };
}

function signaturesMatch(a: CalculationSignature | null, b: CalculationSignature | null): boolean {
  if (!a || !b) return false;
  if (a.totalPanelCount !== b.totalPanelCount) return false;
  if (Math.abs(a.totalPowerKwp - b.totalPowerKwp) > 0.01) return false;
  if (Math.abs(a.lat - b.lat) > 0.0001 || Math.abs(a.lon - b.lon) > 0.0001) return false;
  if (Math.abs(a.batteryKwh - b.batteryKwh) > 0.01) return false;
  if (a.annualConsumptionKwh !== b.annualConsumptionKwh) return false;
  if (a.roofSignatures.length !== b.roofSignatures.length) return false;
  for (let i = 0; i < a.roofSignatures.length; i++) {
    const ra = a.roofSignatures[i];
    const rb = b.roofSignatures.find(r => r.id === ra.id);
    if (!rb) return false;
    if (ra.panelCount !== rb.panelCount || ra.powerWp !== rb.powerWp) return false;
    if (ra.azimuth !== rb.azimuth || ra.tilt !== rb.tilt) return false;
  }
  return true;
}

type Step = 'params' | 'roofs' | 'system' | 'results' | 'quote';

const STEPS: { id: Step; label: string }[] = [
  { id: 'params', label: 'Lokace & Spotřeba' },
  { id: 'roofs', label: 'Střechy & Panely' },
  { id: 'system', label: 'Konfigurace' },
  { id: 'results', label: 'Výpočty' },
  { id: 'quote', label: 'Nabídka' },
];

interface Props {
  projectId?: string;
  projectAddress?: string;
  onExportToQuote?: (sections: QuoteSection[]) => void;
}

export default function FvSection({ projectId, projectAddress, onExportToQuote }: Props) {
  const catalog = useFvCatalog();
  const { programs: subsidyPrograms } = useSubsidyPrograms();
  const { design, loading, saving, createDesign, saveDesign, autoSave } = useFvDesign(projectId);
  const [step, setStep] = useState<Step>('params');
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [localParams, setLocalParams] = useState<FvInputParams | null>(null);
  const [localRoofs, setLocalRoofs] = useState<RoofSurface[]>([]);
  const [localConfig, setLocalConfig] = useState<FvSystemConfig>({});
  const [localResult, setLocalResult] = useState<FvCalculationResult | null>(null);
  const [lastCalcSignature, setLastCalcSignature] = useState<CalculationSignature | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [roofSnapshots, setRoofSnapshots] = useState<Record<string, string>>({});
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [showQuickVersionSave, setShowQuickVersionSave] = useState(false);
  const [quickVersionNote, setQuickVersionNote] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showVersionPicker, setShowVersionPicker] = useState(true);
  const [fvClient, setFvClient] = useState<QuoteClientInfo | null>(null);
  const [fvCompany, setFvCompany] = useState<QuoteCompanyInfo | null>(null);
  const { versions, loading: versionsLoading, fetched: versionsFetched, createVersion } = useFvDesignVersions(design?.id);

  const skipAutoSave = useRef(true);

  useEffect(() => {
    if (projectId) loadQuoteClientInfo(projectId).then(setFvClient);
    loadQuoteCompanyInfo().then(setFvCompany);
  }, [projectId]);

  useEffect(() => {
    if (loading || initialized) return;
    if (design) {
      setLocalParams(design.input_params);
      setLocalRoofs(design.roofs ?? []);
      setLocalConfig(design.system_config ?? {});
      setLocalResult(design.pvgis_results ?? null);
      setInitialized(true);
      skipAutoSave.current = true;
      requestAnimationFrame(() => { skipAutoSave.current = false; });
    }
  }, [design, loading, initialized]);

  useEffect(() => {
    if (!initialized || skipAutoSave.current || !localParams) return;
    autoSave({ input_params: localParams });
  }, [localParams, initialized, autoSave]);

  useEffect(() => {
    if (!initialized || skipAutoSave.current) return;
    autoSave({ roofs: localRoofs });
  }, [localRoofs, initialized, autoSave]);

  useEffect(() => {
    if (!initialized || skipAutoSave.current) return;
    autoSave({ system_config: localConfig });
  }, [localConfig, initialized, autoSave]);

  const handleCreate = useCallback(async () => {
    const d = await createDesign();
    if (d) {
      setLocalParams(d.input_params);
      setLocalRoofs([]);
      setLocalConfig({});
      setLocalResult(null);
      setInitialized(true);
    }
  }, [createDesign]);

  const handleSave = async () => {
    if (!localParams) return;
    await saveDesign({
      input_params: localParams,
      roofs: localRoofs,
      system_config: localConfig,
      pvgis_results: localResult,
    });
  };

  const handleCalculate = async () => {
    if (!localParams || localRoofs.length === 0) {
      setCalcError('Přidejte alespoň jednu střešní plochu s panely.');
      return;
    }
    const totalPanels = localRoofs.reduce((s, r) => s + r.panelCount, 0);
    if (totalPanels === 0) {
      setCalcError('Přidejte panely na střešní plochy.');
      return;
    }
    setCalculating(true);
    setCalcError('');
    captureRoofSnapshots();
    try {
      const result = await calculateFvSystem(localParams, localRoofs, currentBatteryKwh);
      setLocalResult(result);
      setLastCalcSignature(createCalculationSignature(localParams, localRoofs, currentBatteryKwh));
      setStep('results');
    } catch (e) {
      setCalcError('Výpočet selhal. Zkontrolujte připojení k internetu.');
    } finally {
      setCalculating(false);
    }
  };

  const captureRoofSnapshots = useCallback(() => {
    const snapshots: Record<string, string> = {};
    for (const roof of localRoofs) {
      const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-roof-id="${roof.id}"]`);
      if (canvas) {
        try {
          snapshots[roof.id] = canvas.toDataURL('image/png');
        } catch {
          // noop
        }
      }
    }
    if (Object.keys(snapshots).length > 0) {
      setRoofSnapshots(prev => ({ ...prev, ...snapshots }));
    }
  }, [localRoofs]);

  const prevStepRef = useCallback((newStep: Step) => {
    if (step === 'roofs' && newStep !== 'roofs') {
      captureRoofSnapshots();
    }
    setStep(newStep);
  }, [step, captureRoofSnapshots]);

  const totalPowerKwp = localRoofs.reduce((s, r) => s + (r.panelCount * r.panelPowerWp) / 1000, 0);

  const currentBatteryKwh = useMemo(() => {
    const masterKwh = localConfig.batteryId
      ? (catalog.batteries.find(b => b.id === localConfig.batteryId)?.capacity_kwh ?? 0) * (localConfig.batteryCount ?? 0)
      : 0;
    const slaveKwh = localConfig.slaveBatteryId
      ? (catalog.batteries.find(b => b.id === localConfig.slaveBatteryId)?.capacity_kwh ?? 0) * (localConfig.slaveBatteryCount ?? 0)
      : 0;
    return masterKwh + slaveKwh;
  }, [localConfig.batteryId, localConfig.batteryCount, localConfig.slaveBatteryId, localConfig.slaveBatteryCount, catalog.batteries]);

  const currentSignature = useMemo(
    () => createCalculationSignature(localParams, localRoofs, currentBatteryKwh),
    [localParams, localRoofs, currentBatteryKwh]
  );

  const resultsStale = localResult !== null && !signaturesMatch(currentSignature, lastCalcSignature);

  const handleSaveVersion = async (note: string) => {
    if (!localParams) return;
    const masterBat = catalog.batteries.find(b => b.id === localConfig.batteryId);
    const slaveBat = catalog.batteries.find(b => b.id === localConfig.slaveBatteryId);
    const inv = catalog.inverters.find(i => i.id === localConfig.inverterId);
    const batteryKwh = (masterBat ? masterBat.capacity_kwh * (localConfig.batteryCount ?? 0) : 0) +
      (slaveBat ? slaveBat.capacity_kwh * (localConfig.slaveBatteryCount ?? 0) : 0);
    const panelCount = localRoofs.reduce((s, r) => s + r.panelCount, 0);

    await handleSave();
    await createVersion({
      note,
      inputParams: localParams as unknown as Record<string, unknown>,
      roofs: localRoofs as unknown as Record<string, unknown>[],
      systemConfig: localConfig as unknown as Record<string, unknown>,
      pvgisResults: localResult as unknown as Record<string, unknown> | null,
      summaryBatteryKwh: Math.round(batteryKwh * 100) / 100,
      summaryInverterKw: inv?.power_kw ?? 0,
      summaryPanelKwp: Math.round(totalPowerKwp * 100) / 100,
      summaryPanelCount: panelCount,
    });
  };

  const handleRestoreVersion = (version: FvDesignVersion) => {
    setLocalParams(version.input_params as unknown as FvInputParams);
    setLocalRoofs(version.roofs as unknown as RoofSurface[]);
    setLocalConfig(version.system_config as unknown as FvSystemConfig);
    setLocalResult(version.pvgis_results as unknown as FvCalculationResult | null);
  };

  const getRoofCanvasDataUrls = useCallback((): string[] => {
    return localRoofs.map(roof => {
      const live = document.querySelector<HTMLCanvasElement>(`canvas[data-roof-id="${roof.id}"]`);
      if (live) {
        try { return live.toDataURL('image/png'); } catch { /* noop */ }
      }
      return roofSnapshots[roof.id] || roof.snapshotDataUrl || '';
    });
  }, [localRoofs, roofSnapshots]);

  const handleExportPdf = (sections?: PdfSectionFlags) => {
    if (!localParams || !localResult) return;

    exportFvProposalPdf({
      projectName: projectAddress ?? 'FV Projekt',
      result: localResult,
      inputParams: localParams,
      roofs: localRoofs,
      systemConfig: localConfig,
      catalog,
      roofCanvasDataUrls: getRoofCanvasDataUrls(),
      totalInvestmentCzk: localConfig.totalInvestmentCzk ?? 0,
      subsidyCzk: localConfig.subsidyCzk ?? 0,
      sections,
      client: fvClient,
      company: fvCompany,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!design && !initialized) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
          <Sun className="w-7 h-7 text-orange-500" />
        </div>
        <div>
          <div className="text-sm font-extrabold text-white mb-1">Fotovoltaický návrhář</div>
          <div className="text-xs text-slate-500 max-w-xs">
            Navrhněte FV systém s výpočty z PVGIS, vizuálním editorem střechy a exportem do nabídky.
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition"
        >
          <Plus className="w-4 h-4" /> Nový FV návrh
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="shrink-0 px-4 pt-4 pb-3 bg-white/[0.06] border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Sun className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-sm font-extrabold text-white">FV Designer</span>
            {totalPowerKwp > 0 && (
              <span className={`text-xs font-extrabold rounded-full px-2.5 py-0.5 flex items-center gap-1 ${
                resultsStale ? 'text-amber-500 bg-amber-500/10' : 'text-orange-600 bg-orange-500/10'
              }`}>
                {resultsStale && <AlertTriangle className="w-3 h-3" />}
                {Math.round(totalPowerKwp * 100) / 100} kWp
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {localResult && (
              <button
                onClick={() => setShowPdfModal(true)}
                className="px-3 py-1.5 bg-slate-700 text-white rounded-xl font-extrabold text-xs hover:bg-slate-800 transition flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            )}
            <SaveVersionButton
              onSave={handleSave}
              onOpenVersions={() => setVersionDrawerOpen(true)}
              onSaveAsNewVersion={() => { setQuickVersionNote(''); setShowQuickVersionSave(true); }}
              saving={saving}
              disabled={!localParams}
              versionCount={versions.length}
              variant="light"
            />
          </div>
        </div>

        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] p-0.5 gap-0.5">
          {STEPS.map(s => (
            <button
              key={s.id}
              onClick={() => prevStepRef(s.id)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-extrabold transition leading-tight ${
                step === s.id
                  ? 'bg-white/[0.06] text-orange-600 '
                  : 'text-slate-400 hover:text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4">
        {step === 'params' && localParams && (
          <div className="max-w-2xl mx-auto">
            <FvInputForm
              params={localParams}
              onChange={p => setLocalParams(p)}
              projectAddress={projectAddress}
            />
          </div>
        )}

        {step === 'roofs' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <RoofDesigner
              roofs={localRoofs}
              panels={catalog.panels}
              roofTiles={catalog.roofTiles}
              hooks={catalog.hooks}
              railProfiles={catalog.railProfiles}
              clamps={catalog.clamps}
              onChange={r => setLocalRoofs(r)}
              onSnapshotChange={(roofId, dataUrl) => {
                setRoofSnapshots(prev => ({ ...prev, [roofId]: dataUrl }));
              }}
            />
          </div>
        )}

        {step === 'system' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <FvSystemConfigurator
              catalog={catalog}
              config={localConfig}
              result={localResult}
              totalPowerKwp={Math.round(totalPowerKwp * 100) / 100}
              evCount={localParams?.evCount ?? 0}
              roofs={localRoofs}
              subsidyPrograms={subsidyPrograms}
              onChange={cfg => setLocalConfig(cfg)}
            />
            <div>
              {calcError && (
                <div className="mb-3 flex items-start gap-2 text-xs font-extrabold text-red-400 bg-red-500/10 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {calcError}
                </div>
              )}
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {calculating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Počítám přes PVGIS...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> {localResult ? 'Přepočítat PVGIS' : 'Spustit výpočet PVGIS'}</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'results' && (
          <div className="max-w-4xl mx-auto">
            {localResult ? (
              <FvOutputCharts
                result={localResult}
                totalInvestmentCzk={localConfig.totalInvestmentCzk}
                subsidyCzk={localConfig.subsidyCzk}
                roofs={localRoofs}
                roofSnapshots={roofSnapshots}
                resultsStale={resultsStale}
                currentPowerKwp={totalPowerKwp}
                lastCalcSignature={lastCalcSignature}
              />
            ) : (
              <div className="py-16 text-center">
                <div className="text-sm text-slate-400 font-extrabold mb-3">Zatím žádné výsledky</div>
                <button
                  onClick={() => setStep('system')}
                  className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition"
                >
                  Přejít na konfiguraci
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'quote' && (
          <div className="max-w-4xl mx-auto">
            <FvQuoteTab
              catalog={catalog}
              config={localConfig}
              roofs={localRoofs}
              result={localResult}
              roofSnapshots={roofSnapshots}
              subsidyPrograms={subsidyPrograms}
              onConfigChange={cfg => setLocalConfig(cfg)}
              onExportToQuote={onExportToQuote}
              projectId={projectId}
              resultsStale={resultsStale}
            />
          </div>
        )}
      </div>

      {showPdfModal && (
        <FvPdfExportModal
          roofs={localRoofs}
          roofSnapshots={roofSnapshots}
          onClose={() => setShowPdfModal(false)}
          onExport={(sectionFlags) => {
            handleExportPdf(sectionFlags);
            setShowPdfModal(false);
          }}
        />
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
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition"
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
                className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition"
              >
                Uložit verzi
              </button>
            </div>
          </div>
        </>
      )}

      <VersionHistoryDrawer<FvDesignVersion & VersionItem>
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        versions={versions as (FvDesignVersion & VersionItem)[]}
        loading={versionsLoading}
        onSaveVersion={handleSaveVersion}
        onRestore={handleRestoreVersion}
        saving={saving}
        title="Historie verzí FV"
        renderSummary={(v) => (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-orange-600">
              <Sun className="w-2.5 h-2.5" /> {v.summary_panel_kwp} kWp ({v.summary_panel_count} ks)
            </span>
            {v.summary_inverter_kw > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-blue-400">
                <Zap className="w-2.5 h-2.5" /> {v.summary_inverter_kw} kW
              </span>
            )}
            {v.summary_battery_kwh > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-400">
                <Battery className="w-2.5 h-2.5" /> {v.summary_battery_kwh} kWh
              </span>
            )}
          </div>
        )}
      />

      <VersionPickerModal<FvDesignVersion & VersionItem>
        open={showVersionPicker && initialized}
        onClose={() => setShowVersionPicker(false)}
        versions={versions as (FvDesignVersion & VersionItem)[]}
        loading={!versionsFetched}
        onSelectVersion={(version) => {
          handleRestoreVersion(version);
          setShowVersionPicker(false);
        }}
        onStartNew={() => setShowVersionPicker(false)}
        title="FV Návrhář - vyberte verzi"
        variant="fv"
        renderSummary={(v) => (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-orange-600">
              <Sun className="w-2.5 h-2.5" /> {v.summary_panel_kwp} kWp ({v.summary_panel_count} ks)
            </span>
            {v.summary_inverter_kw > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-blue-400">
                <Zap className="w-2.5 h-2.5" /> {v.summary_inverter_kw} kW
              </span>
            )}
            {v.summary_battery_kwh > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-400">
                <Battery className="w-2.5 h-2.5" /> {v.summary_battery_kwh} kWh
              </span>
            )}
          </div>
        )}
      />
    </div>
  );
}
