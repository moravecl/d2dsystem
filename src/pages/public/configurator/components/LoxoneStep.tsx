import { Brain, Lightbulb, Thermometer, Blinds, Music, Camera, DoorOpen, Fan } from 'lucide-react';
import type { StepProps } from '../types';

const loxoneOptions = [
  {
    id: 'lighting',
    icon: Lightbulb,
    title: 'Inteligentní osvětlení',
    description: 'Automatické ovládání světel podle přítomnosti, denní doby a nálady. Scény (film, večeře, spánek).',
  },
  {
    id: 'heating',
    icon: Thermometer,
    title: 'Inteligentní vytápění',
    description: 'Učení se setrvačnosti, automatická regulace podle počasí a přítomnosti, zónové řízení.',
  },
  {
    id: 'shading',
    icon: Blinds,
    title: 'Automatické stínění',
    description: 'Žaluzie se pohybují podle slunce a teploty. Ochrana před přehřátím v létě.',
  },
  {
    id: 'audio',
    icon: Music,
    title: 'Multiroom audio',
    description: 'Hudba v každé místnosti. Ovládání jedním dotykem, propojení se streamovacími službami.',
  },
  {
    id: 'security',
    icon: Camera,
    title: 'Bezpečnostní integrace',
    description: 'Propojení s alarmem a kamerami. Simulace přítomnosti, notifikace na mobil.',
  },
  {
    id: 'access',
    icon: DoorOpen,
    title: 'Přístupový systém',
    description: 'Dveřní zámky, videovrátný, garáž. Otevření na dálku, přístupové kódy pro hosty.',
  },
  {
    id: 'ventilation',
    icon: Fan,
    title: 'Řízení vzduchotechniky',
    description: 'Automatická regulace výkonu podle CO2 a vlhkosti. Bypass v létě pro noční chlazení.',
  },
];

export default function LoxoneStep({ data, setData, prices }: StepProps) {
  const featurePrice = prices?.loxoneFeatureBase?.value ?? 15000;
  const toggleFeature = (featureId: string) => {
    const features = data.loxoneFeatures || [];
    const featureName = loxoneOptions.find(o => o.id === featureId)?.title || featureId;

    if (features.includes(featureName)) {
      setData({ ...data, loxoneFeatures: features.filter((f) => f !== featureName) });
    } else {
      setData({ ...data, loxoneFeatures: [...features, featureName] });
    }
  };

  const isSelected = (featureId: string) => {
    const featureName = loxoneOptions.find(o => o.id === featureId)?.title || featureId;
    return data.loxoneFeatures?.includes(featureName) || false;
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="text-center mb-6">
        <div className="inline-block p-3 rounded-full bg-blue-100 text-blue-600 mb-4">
          <Brain size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Jaké funkce chcete s Loxone řešit?</h2>
        <p className="text-slate-500">Vyberte všechny oblasti, které chcete automatizovat. Každá přidává +{featurePrice.toLocaleString('cs-CZ')} Kč.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {loxoneOptions.map((option) => {
          const Icon = option.icon;
          const selected = isSelected(option.id);

          return (
            <div
              key={option.id}
              onClick={() => toggleFeature(option.id)}
              className={`cursor-pointer border-2 rounded-xl p-5 flex items-start gap-4 bg-white transition-all hover:shadow-md ${
                selected
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex-shrink-0">
                <div
                  className={`p-3 rounded-full transition-colors ${
                    selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon size={24} />
                </div>
              </div>
              <div className="flex-grow">
                <h3 className={`font-bold mb-1 ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
                  {option.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{option.description}</p>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {}}
                  className="w-5 h-5 accent-blue-600"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-800 max-w-2xl mx-auto">
        <strong>Vybráno: {data.loxoneFeatures?.length || 0} funkcí</strong>
        {data.loxoneFeatures && data.loxoneFeatures.length > 0 && (
          <p className="mt-2">
            Přibližná cena za funkce: +{(data.loxoneFeatures.length * featurePrice).toLocaleString('cs-CZ')} Kč
          </p>
        )}
        {(!data.loxoneFeatures || data.loxoneFeatures.length === 0) && (
          <p className="mt-2 text-slate-600">
            Můžete pokračovat bez výběru funkcí a získáte základní Loxone systém.
          </p>
        )}
      </div>
    </div>
  );
}
