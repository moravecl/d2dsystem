import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import IntroStep from './components/IntroStep';
import PropertyStep from './components/PropertyStep';
import HeatingStep from './components/HeatingStep';
import WaterStep from './components/WaterStep';
import AirStep from './components/AirStep';
import EnergyStep from './components/EnergyStep';
import SmartStep from './components/SmartStep';
import LoxoneStep from './components/LoxoneStep';
import SecurityStep from './components/SecurityStep';
import ContactStep from './components/ContactStep';
import ResultStep from './components/ResultStep';
import Navigation from './components/Navigation';
import ProgressBar from './components/ProgressBar';
import PricePreview from './components/PricePreview';
import type { ConfigurationData, PriceMap, SubsidySetting } from './types';
import { calculateEstimate } from './priceCalculator';

/**
 * Veřejný konfigurátor (port prototypu z Boltu). Ceny a dotace se
 * načítají z ceníku organizace přes edge funkci public-configurator
 * (identifikace veřejným tokenem v URL); odeslání vytvoří lead.
 */

const DEFAULT_DATA: ConfigurationData = {
  area: 150,
  floors: '1',
  occupants: 4,
  heatSource: 'heat_pump',
  groundFloorHeating: 'floor_wet',
  upperFloorHeating: 'floor_wet',
  heatingExtras: { tank: false, fireplaceInsert: false },
  recuperation: 'yes',
  recuperationCooling: false,
  fve: 'optimum',
  smart: 'loxone',
  loxoneFeatures: [],
  alarm: 'prep',
  cameras: 'prep',
  waterExtras: {
    waterSoftener: false,
    smartValve: false,
    circulationPump: false,
  },
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  clientRegion: '',
  gdprConsent: false,
};

interface PublicConfig {
  prices: PriceMap;
  subsidies: SubsidySetting[];
  show_live_prices: boolean;
  show_result_prices: boolean;
}

export default function PublicConfiguratorPage() {
  const { token } = useParams();
  const storageKey = `hs_public_config_${token ?? ''}`;
  const storageStepKey = `${storageKey}_step`;

  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem(storageStepKey);
      if (saved) return Math.max(0, parseInt(saved, 10));
    } catch { /* ignore */ }
    return 0;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [data, setData] = useState<ConfigurationData>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return {
          ...DEFAULT_DATA,
          ...JSON.parse(saved),
          clientName: '', clientEmail: '', clientPhone: '', clientRegion: '',
          gdprConsent: false,
        };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_DATA };
  });

  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-configurator`;
  const fnHeaders = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${fnUrl}?token=${encodeURIComponent(token ?? '')}`, { headers: fnHeaders });
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setConfigError(result.error || 'Konfigurátor není dostupný');
          return;
        }
        setConfig({
          prices: result.prices,
          subsidies: result.subsidies ?? [],
          show_live_prices: result.show_live_prices ?? false,
          show_result_prices: result.show_result_prices ?? true,
        });
      } catch {
        setConfigError('Konfigurátor se nepodařilo načíst');
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const { clientName, clientEmail, clientPhone, clientRegion, gdprConsent, ...configOnly } = data;
    void clientName; void clientEmail; void clientPhone; void clientRegion; void gdprConsent;
    localStorage.setItem(storageKey, JSON.stringify(configOnly));
  }, [data, storageKey]);

  useEffect(() => {
    localStorage.setItem(storageStepKey, String(step));
  }, [step, storageStepKey]);

  const prices = config?.prices ?? null;
  const subsidies = config?.subsidies ?? [];

  const steps: { id: string; title: string; condition?: () => boolean }[] = [
    { id: 'intro', title: 'Úvod' },
    { id: 'property', title: 'Nemovitost' },
    { id: 'heating', title: 'Vytápění' },
    { id: 'water', title: 'Voda' },
    { id: 'air', title: 'Vzduch' },
    { id: 'energy', title: 'Energie' },
    { id: 'smart', title: 'Smart Home' },
    { id: 'loxone', title: 'Loxone', condition: () => data.smart === 'loxone' },
    { id: 'security', title: 'Bezpečnost' },
    { id: 'contact', title: 'Kontakt' },
    { id: 'result', title: 'Výsledek' },
  ];

  const MIDDLE_STEPS: Record<string, typeof PropertyStep> = {
    property: PropertyStep,
    heating: HeatingStep,
    water: WaterStep,
    air: AirStep,
    energy: EnergyStep,
    smart: SmartStep,
    loxone: LoxoneStep,
    security: SecurityStep,
    contact: ContactStep,
  };

  const visibleSteps = steps.filter((s) => !s.condition || s.condition());
  const currentStep = visibleSteps[Math.min(step, visibleSteps.length - 1)];

  const handleSubmit = async () => {
    if (!prices || !token) return;
    setIsSubmitting(true);
    try {
      const pricing = calculateEstimate(data, prices, subsidies);
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: fnHeaders,
        body: JSON.stringify({ token, data, pricing }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Odeslání selhalo');
      }
      setEmailSent(result.email_sent ?? null);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageStepKey);
      window.scrollTo(0, 0);
      setStep(visibleSteps.length - 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Neznámá chyba';
      alert(`Nastala chyba při odesílání: ${msg}. Zkuste to prosím znovu.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (step === visibleSteps.length - 2) {
      await handleSubmit();
    } else {
      window.scrollTo(0, 0);
      setStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
    }
  };

  const handleBack = () => {
    window.scrollTo(0, 0);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex < step) {
      window.scrollTo(0, 0);
      setStep(stepIndex);
    }
  };

  const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone: string): boolean => !phone || /^[\d\s+()-]{9,}$/.test(phone);

  if (configError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md shadow-sm">
          <AlertTriangle size={40} className="text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Konfigurátor není dostupný</h1>
          <p className="text-sm text-slate-600">{configError}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const isContactStep = step === visibleSteps.length - 2;
  const isResultStep = step === visibleSteps.length - 1;
  const showPricePreview = step > 1 && !isResultStep && !isContactStep && prices;

  const canProceed = !isContactStep || Boolean(
    data.clientName &&
    data.clientEmail &&
    validateEmail(data.clientEmail) &&
    validatePhone(data.clientPhone) &&
    data.gdprConsent &&
    prices !== null,
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/housesmartlogo.png" alt="HouseSmart" className="h-8 sm:h-9" />
          <span className="text-slate-400 font-normal text-sm hidden sm:inline">| Konfigurátor</span>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          Krok {step + 1} / {visibleSteps.length}
        </div>
      </div>

      <main className="flex-grow flex flex-col items-center justify-start pt-8 pb-28 px-4 w-full">
        <div className="w-full max-w-4xl">
          {step > 0 && !isResultStep && (
            <ProgressBar current={step} total={visibleSteps.length} steps={visibleSteps} onStepClick={handleStepClick} />
          )}

          {showPricePreview && prices && (
            <PricePreview
              data={data}
              prices={prices}
              currentStepId={currentStep.id}
              subsidies={subsidies}
              showPrices={config.show_live_prices}
            />
          )}

          <div className="transition-all duration-300">
            {step === 0 ? (
              <IntroStep onNext={handleNext} />
            ) : isResultStep ? (
              <ResultStep
                data={data}
                setData={setData}
                prices={prices}
                subsidies={subsidies}
                emailSent={emailSent}
                showResultPrices={config.show_result_prices}
              />
            ) : (() => {
              const StepComponent = MIDDLE_STEPS[currentStep.id];
              return StepComponent ? (
                <StepComponent
                  data={data}
                  setData={setData}
                  prices={prices}
                  showPrices={config.show_live_prices}
                />
              ) : null;
            })()}
          </div>
        </div>
      </main>

      {!isResultStep && step > 0 && (
        <Navigation
          onBack={handleBack}
          onNext={handleNext}
          canProceed={canProceed}
          isSubmitting={isSubmitting}
          isLastStep={isContactStep}
        />
      )}
    </div>
  );
}
