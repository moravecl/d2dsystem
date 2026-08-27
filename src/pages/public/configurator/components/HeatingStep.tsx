import { Thermometer, Zap, Flame, SquareStack, Battery, ArrowDown, TreePine } from 'lucide-react';
import type { StepProps, HeatSource, HeatingDistribution } from '../types';

const HEAT_SOURCES: { id: HeatSource; icon: typeof Thermometer; title: string; desc: string; hint: string }[] = [
  {
    id: 'heat_pump',
    icon: Thermometer,
    title: 'Tepelné čerpadlo',
    desc: 'Standard dnešní doby. Nejvyšší úspora, možnost chlazení v létě.',
    hint: 'Investice: Vyšší / Provoz: Nízký',
  },
  {
    id: 'electroboiler',
    icon: Zap,
    title: 'Elektrokotel',
    desc: 'Nízká investice, vhodný jako záloha nebo pro pasivní domy.',
    hint: 'Investice: Nízká / Provoz: Vyšší',
  },
  {
    id: 'gas_boiler',
    icon: Flame,
    title: 'Plynový kotel',
    desc: 'Ověřená technologie, dostupné palivo, rychlý ohřev.',
    hint: 'Investice: Střední / Provoz: Střední',
  },
  {
    id: 'solid_fuel',
    icon: TreePine,
    title: 'Tuhá paliva',
    desc: 'Krb nebo kotel na dřevo/uhlí. Nezávislost na energetické síti.',
    hint: 'Investice: Střední / Provoz: Nízký',
  },
  {
    id: 'electric_mats',
    icon: SquareStack,
    title: 'Elektrické rohože',
    desc: 'Doplňkové podlahové topení. Nízká investice, ideální do koupelen.',
    hint: 'Investice: Nízká / Provoz: Vysoký',
  },
];

const DISTRIBUTION_OPTIONS: { id: HeatingDistribution; title: string; desc: string }[] = [
  { id: 'floor_wet', title: 'Podlahové topení (mokrá)', desc: 'Klasický systém zality v betonu. Nejvyšší účinnost.' },
  { id: 'floor_dry', title: 'Podlahové topení (suchá)', desc: 'Suchá montáž bez mokrého procesu. Nižší tloušťka.' },
  { id: 'radiators', title: 'Radiátory', desc: 'Deskové radiátory s termostatickými hlavicemi.' },
];

function DistributionPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HeatingDistribution;
  onChange: (v: HeatingDistribution) => void;
}) {
  return (
    <div>
      <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">{label}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {DISTRIBUTION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-sm ${
              value === opt.id
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                : 'border-slate-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className={`font-semibold text-sm ${value === opt.id ? 'text-blue-700' : 'text-slate-800'}`}>
              {opt.title}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HeatingStep({ data, setData }: StepProps) {
  const showDistribution = data.heatSource !== 'electric_mats';
  const showUpperFloor = data.floors !== '1';

  const handleSourceChange = (source: HeatSource) => {
    setData({ ...data, heatSource: source });
  };

  return (
    <div className="space-y-8 animate-in pb-32">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Čím budeme topit?</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          Vyberte hlavní zdroj tepla a způsob distribuce po domě.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {HEAT_SOURCES.map((source) => {
          const Icon = source.icon;
          const selected = data.heatSource === source.id;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => handleSourceChange(source.id)}
              className={`text-left border-2 rounded-xl p-5 flex flex-col bg-white relative overflow-hidden transition-all hover:shadow-md ${
                selected
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              {selected && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-bl font-bold">
                  VYBRÁNO
                </div>
              )}
              <div
                className={`p-2.5 rounded-full w-fit mb-3 transition-colors ${
                  selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Icon size={22} />
              </div>
              <h3 className={`font-bold mb-1 ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
                {source.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-3 flex-grow">{source.desc}</p>
              <div className="text-[10px] font-bold text-slate-400 pt-2 border-t border-slate-100 uppercase tracking-wide">
                {source.hint}
              </div>
            </button>
          );
        })}
      </div>

      {showDistribution && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-2 justify-center text-slate-400">
            <ArrowDown size={18} />
            <span className="text-sm font-medium">Distribuce tepla</span>
            <ArrowDown size={18} />
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6">
            <DistributionPicker
              label="Přízemí"
              value={data.groundFloorHeating}
              onChange={(v) => setData({ ...data, groundFloorHeating: v })}
            />

            {showUpperFloor && (
              <DistributionPicker
                label="Patro"
                value={data.upperFloorHeating}
                onChange={(v) => setData({ ...data, upperFloorHeating: v })}
              />
            )}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="font-bold text-lg mb-4 text-slate-800">Doplňkové možnosti</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={data.heatingExtras.fireplaceInsert}
              onChange={(e) =>
                setData({
                  ...data,
                  heatingExtras: {
                    ...data.heatingExtras,
                    fireplaceInsert: e.target.checked,
                    tank: e.target.checked ? data.heatingExtras.tank : false,
                  },
                })
              }
              className="mt-1 w-5 h-5 accent-blue-600"
            />
            <div className="flex-grow">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Flame size={20} className="text-orange-500" />
                Krbová vložka s výměníkem
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Doplňkový zdroj tepla napojený do topného systému. Snížení provozních nákladů.
              </p>
            </div>
          </label>

          {data.heatingExtras.fireplaceInsert && (
            <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 cursor-pointer transition-all ml-8">
              <input
                type="checkbox"
                checked={data.heatingExtras.tank}
                onChange={(e) =>
                  setData({
                    ...data,
                    heatingExtras: { ...data.heatingExtras, tank: e.target.checked },
                  })
                }
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <div className="flex-grow">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Battery size={20} className="text-blue-500" />
                  Akumulační nádrž
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Zásobník tepla pro efektivnější provoz krbové vložky. Doporučeno při kombinaci s FVE.
                </p>
              </div>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
