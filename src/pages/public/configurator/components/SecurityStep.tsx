import { Shield, Camera } from 'lucide-react';
import type { StepProps } from '../types';
import OptionCard from './OptionCard';

function fmtPrice(prices: StepProps['prices'], key: string, showPrices?: boolean): string {
  if (!showPrices) return '';
  const item = prices?.[key];
  if (!item) return '';
  return `+ ${item.value.toLocaleString('cs-CZ')} Kc`;
}

export default function SecurityStep({ data, setData, prices, showPrices }: StepProps) {
  return (
    <div className="space-y-8 animate-in pb-32">
      <h2 className="text-2xl font-bold text-center mb-2">Bezpečnost</h2>
      <p className="text-center text-slate-500 mb-6 max-w-lg mx-auto">
        Ochraňte svůj dům moderním zabezpečením.
      </p>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
            <Shield size={24} className="text-blue-600" />
            Alarm
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OptionCard
              icon={Shield}
              title="Jen příprava"
              description="Natáhneme kabely a přípojky pro budoucí instalaci."
              priceHint={fmtPrice(prices, 'alarmPrep', showPrices)}
              selected={data.alarm === 'prep'}
              onClick={() => setData({ ...data, alarm: 'prep' })}
            />
            <OptionCard
              icon={Shield}
              title="Realizace"
              description="Jablotron - čidla pohybu, siréna, ovládání mobilem."
              priceHint={fmtPrice(prices, 'alarmBase', showPrices) || (showPrices ? 'Cena dle velikosti' : '')}
              selected={data.alarm === 'full'}
              onClick={() => setData({ ...data, alarm: 'full' })}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
            <Camera size={24} className="text-blue-600" />
            Kamerový systém
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OptionCard
              icon={Camera}
              title="Jen příprava"
              description="Natáhneme síťové kabely pro budoucí kamery."
              priceHint={fmtPrice(prices, 'cameraPrep', showPrices)}
              selected={data.cameras === 'prep'}
              onClick={() => setData({ ...data, cameras: 'prep' })}
            />
            <OptionCard
              icon={Camera}
              title="Realizace"
              description="4x IP kamera Full HD + NVR + 2TB HDD pro záznamy."
              priceHint={fmtPrice(prices, 'cameraFull', showPrices)}
              selected={data.cameras === 'full'}
              onClick={() => setData({ ...data, cameras: 'full' })}
            />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-800">
          <strong>Tip:</strong> I když nyní neplánujete alarm nebo kamery, doporučujeme investovat alespoň do přípravy.
          Dodatečné vedení kabelů po dokončení stavby je velmi drahé a komplikované.
        </div>
      </div>
    </div>
  );
}
