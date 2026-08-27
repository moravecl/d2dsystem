import { Zap, Wifi, Brain, CheckCircle2 } from 'lucide-react';
import type { StepProps } from '../types';
import OptionCard from './OptionCard';

export default function SmartStep({ data, setData }: StepProps) {
  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-2xl font-bold text-center mb-2">Inteligence domu</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OptionCard
          icon={Zap}
          title="Klasická elektroinstalace"
          description="Hloupé vypínače. Každá technologie (topení, žaluzie) má vlastní ovládání."
          selected={data.smart === 'none'}
          onClick={() => setData({ ...data, smart: 'none', loxoneFeatures: [] })}
        />
        <OptionCard
          icon={Wifi}
          title="Základní (WiFi/Zigbee)"
          description="Ovládání světel mobilem. Nemá centrální logiku, závislé na cloudu."
          selected={data.smart === 'basic'}
          onClick={() => setData({ ...data, smart: 'basic', loxoneFeatures: [] })}
        />
        <OptionCard
          icon={Brain}
          title="Profesionální (Loxone)"
          description="Jeden systém řídí vše: teplo se učí setrvačnost, žaluzie stíní podle slunce, světla se tlumí v noci."
          priceHint="HouseSmart Standard"
          selected={data.smart === 'loxone'}
          onClick={() => setData({ ...data, smart: 'loxone' })}
        />
      </div>
      {data.smart === 'loxone' && (
        <div className="bg-green-50 p-4 rounded border border-green-200 text-sm text-green-800 animate-in flex items-center gap-2">
          <CheckCircle2 size={16} />
          <div>
            <strong>Tip:</strong> S Loxone ušetříte až 30% energie díky tomu, že topení, stínění a FVE spolupracují.
            <br />
            V dalším kroku si vyberete konkrétní funkce.
          </div>
        </div>
      )}
    </div>
  );
}
