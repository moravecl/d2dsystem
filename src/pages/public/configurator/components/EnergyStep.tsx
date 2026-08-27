import { X, Sun, Battery, Zap } from 'lucide-react';
import type { StepProps } from '../types';
import OptionCard from './OptionCard';

export default function EnergyStep({ data, setData }: StepProps) {
  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-2xl font-bold text-center mb-2">Energetická soběstačnost</h2>
      <p className="text-center text-slate-500 mb-6">
        Fotovoltaika s baterií Vám zajistí energii i večer a ochrání před výpadky.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <OptionCard
          icon={X}
          title="Bez FVE"
          description="Jen příprava (husí krky)."
          selected={data.fve === 'none'}
          onClick={() => setData({ ...data, fve: 'none' })}
        />
        <OptionCard
          icon={Sun}
          title="Základní (Ohřev vody)"
          description="Panely jen na spotřebu a TUV. Bez baterie."
          selected={data.fve === 'basic'}
          onClick={() => setData({ ...data, fve: 'basic' })}
        />
        <OptionCard
          icon={Battery}
          title="Optimální (S baterií)"
          description="Nejoblíbenější. 6-8 kWp + Baterie. Pokryje běžný provoz."
          priceHint="Nejprodávanější"
          selected={data.fve === 'optimum'}
          onClick={() => setData({ ...data, fve: 'optimum' })}
        />
        <OptionCard
          icon={Zap}
          title="Maximální výkon"
          description="Plná střecha panelů (10 kWp+) + Velká baterie. Pro elektromobilitu."
          selected={data.fve === 'max'}
          onClick={() => setData({ ...data, fve: 'max' })}
        />
      </div>
    </div>
  );
}
