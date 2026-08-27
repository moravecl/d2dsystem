import { Wind, CheckCircle2, X, Info, Snowflake } from 'lucide-react';
import type { StepProps } from '../types';
import OptionCard from './OptionCard';

export default function AirStep({ data, setData, prices, showPrices }: StepProps) {
  const coolingPrice = prices?.recuperationCooling?.value;
  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-2xl font-bold text-center mb-2">Chcete doma čerstvý vzduch?</h2>
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 max-w-2xl mx-auto flex gap-3 shadow-sm">
        <Info className="flex-shrink-0" size={20} />
        <p>
          Moderní domy jsou velmi těsné. Bez řízeného větrání (rekuperace) se hromadí CO2 a vlhkost. Větrání
          okny v zimě vyhazuje drahé teplo ven.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OptionCard
          icon={Wind}
          title="Ano, chci rekuperaci"
          description="Centrální jednotka, která tiše mění vzduch a šetří teplo."
          priceHint="Doporučujeme"
          selected={data.recuperation === 'yes'}
          onClick={() => setData({ ...data, recuperation: 'yes' })}
        />
        <OptionCard
          icon={CheckCircle2}
          title="Prémiové řešení (Zehnder)"
          description="Švýcarská kvalita, entalpický výměník (nevysušuje vzduch), nejtišší provoz."
          priceHint="Pro náročné"
          selected={data.recuperation === 'premium'}
          onClick={() => setData({ ...data, recuperation: 'premium' })}
        />
        <OptionCard
          icon={X}
          title="Ne, budu větrat okny"
          description="Ušetříte na instalaci, ale přijdete o komfort a úspory tepla."
          priceHint="Úspora investice"
          selected={data.recuperation === 'no'}
          onClick={() => setData({ ...data, recuperation: 'no' })}
        />
      </div>

      {data.recuperation !== 'no' && (
        <div className="max-w-2xl mx-auto mt-8 bg-white p-6 rounded-xl border border-slate-200 animate-in">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Doplňková funkce</h3>
          <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={data.recuperationCooling}
              onChange={(e) => setData({ ...data, recuperationCooling: e.target.checked })}
              className="mt-1 w-5 h-5 accent-blue-600"
            />
            <div className="flex-grow">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Snowflake size={20} className="text-cyan-500" />
                Aktivní chlazení vzduchotechnikou
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Chladicí článek do vzduchotechniky pro aktivní chlazení domu v létě. Alternativa ke klimatizaci.
              </p>
              {showPrices && (
                <div className="text-xs font-bold text-blue-600 mt-2">
                  {coolingPrice ? `+ ${coolingPrice.toLocaleString('cs-CZ')} Kc` : ''}
                </div>
              )}
            </div>
          </label>
          <div className="mt-4 bg-blue-50 p-3 rounded-lg text-xs text-blue-800">
            <strong>Tip:</strong> Pokud máte tepelné čerpadlo, může chladit podlahovkou nebo fancoily. Aktivní
            chlazení rekuperací je vhodné jako doplněk.
          </div>
        </div>
      )}
    </div>
  );
}
