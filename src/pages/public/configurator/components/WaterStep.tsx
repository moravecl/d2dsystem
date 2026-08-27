import { Droplets, ShieldCheck, Filter, Zap } from 'lucide-react';
import type { StepProps } from '../types';
import OptOutBanner from './OptOutBanner';

function fmtPrice(prices: StepProps['prices'], key: string, showPrices?: boolean): string {
  if (!showPrices) return '';
  const item = prices?.[key];
  if (!item) return '';
  return `+ ${item.value.toLocaleString('cs-CZ')} Kc`;
}

export default function WaterStep({ data, setData, prices, showPrices }: StepProps) {
  return (
    <div className="space-y-6 animate-in pb-32">
      <h2 className="text-2xl font-bold text-center mb-2">Voda a odpady</h2>
      <p className="text-center text-slate-500 mb-6 max-w-lg mx-auto">
        Důležitá infrastruktura pro komfortní bydlení.
      </p>

      <OptOutBanner
        optedOut={data.wantWater === false}
        onChange={(v) => setData({ ...data, wantWater: !v })}
        label="Vodu a odpady si zajistím sám — nenaceňovat"
        note="Sekce se do nabídky nezapočítá; v poptávce bude označena jako vlastní řešení."
      />

      {data.wantWater !== false && (<>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
            <Droplets size={24} className="text-blue-500" />
            Vodní instalace
          </h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={data.waterExtras?.waterSoftener || false}
                onChange={(e) =>
                  setData({
                    ...data,
                    waterExtras: { ...data.waterExtras, waterSoftener: e.target.checked },
                  })
                }
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <div className="flex-grow">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Filter size={20} className="text-blue-500" />
                  Změkčovač vody
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Chrání spotřebiče před vodním kamenem. Šetří náklady na opravy a údržbu.
                </p>
                {showPrices && <div className="text-xs font-bold text-blue-600 mt-2">{fmtPrice(prices, 'waterSoftener', showPrices)}</div>}
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={data.waterExtras?.smartValve || false}
                onChange={(e) =>
                  setData({
                    ...data,
                    waterExtras: { ...data.waterExtras, smartValve: e.target.checked },
                  })
                }
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <div className="flex-grow">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <ShieldCheck size={20} className="text-green-500" />
                  Smart Valve - automatické uzavření přívodu vody
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Inteligentní ventil automaticky uzavře přívod vody při detekci netěsnosti. Ochrana proti zaplavení.
                </p>
                {showPrices && <div className="text-xs font-bold text-blue-600 mt-2">{fmtPrice(prices, 'smartValve', showPrices)}</div>}
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={data.waterExtras?.circulationPump || false}
                onChange={(e) =>
                  setData({
                    ...data,
                    waterExtras: { ...data.waterExtras, circulationPump: e.target.checked },
                  })
                }
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <div className="flex-grow">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Zap size={20} className="text-orange-500" />
                  Cirkulace teplé vody
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Okamžitá teplá voda na každém kohoutku. Žádné čekání, komfort a úspora vody.
                </p>
                {showPrices && <div className="text-xs font-bold text-blue-600 mt-2">{fmtPrice(prices, 'circulationPump', showPrices)}</div>}
              </div>
            </label>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-800">
          <strong>Co je zahrnuto vždy:</strong>
          <ul className="mt-2 space-y-1 text-xs">
            <li>✓ Kompletní vodovodní rozvody studenou a teplou vodou</li>
            <li>✓ Kanalizační rozvody včetně ventilace</li>
            <li>✓ Přípojka vody a kanalizace</li>
            <li>✓ Základní vybavení (baterie, umyvadla, WC, vany/sprchy)</li>
          </ul>
        </div>
      </div>
      </>)}
    </div>
  );
}
