import { useState, useEffect } from 'react';
import { MapPin, Zap, Car, Info, Home, Droplets, BarChart3, CheckCircle2 } from 'lucide-react';
import type { FvInputParams } from '../../lib/fvCalculations';
import { getMonthlyConsumptionProfile } from '../../lib/fvCalculations';
import AddressAutocomplete from '../ui/AddressAutocomplete';

interface Props {
  params: FvInputParams;
  onChange: (params: FvInputParams) => void;
  projectAddress?: string;
}

const CONSUMPTION_PRESETS = [
  { label: '1-2 osoby', kwh: 2500 },
  { label: '3-4 osoby', kwh: 4500 },
  { label: '5+ osob', kwh: 7000 },
  { label: 'Firma malá', kwh: 10000 },
  { label: 'Firma střední', kwh: 25000 },
];

const EV_CONSUMPTION_KWH_PER_100KM = 18;

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

function ConsumptionProfileChart({ params }: { params: FvInputParams }) {
  const profile = getMonthlyConsumptionProfile(params.heatingSource, params.hotWaterSource);
  const total = profile.reduce((s, v) => s + v, 0);
  const monthlyKwh = profile.map(w => Math.round(params.annualConsumptionKwh * (w / total)));
  const maxKwh = Math.max(...monthlyKwh, 1);

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 mt-2">
      <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-2 flex items-center gap-1">
        <BarChart3 className="w-3 h-3" /> Rozložení spotřeby v roce
      </div>
      <div className="flex items-end gap-0.5 h-16">
        {monthlyKwh.map((kwh, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div
              className="w-full rounded-t-sm bg-slate-400 transition-all"
              style={{ height: `${(kwh / maxKwh) * 100}%`, minHeight: kwh > 0 ? '2px' : '0' }}
              title={`${MONTH_LABELS[i]}: ${kwh} kWh`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 mt-0.5">
        {MONTH_LABELS.map(l => (
          <div key={l} className="flex-1 text-center text-[7px] font-extrabold text-slate-400">{l}</div>
        ))}
      </div>
      {(params.heatingSource === 'heat_pump' || params.heatingSource === 'electric_boiler') && (
        <div className="mt-2 text-[10px] font-extrabold text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          Elektrické vytápění výrazně zvyšuje zimní spotřebu
        </div>
      )}
    </div>
  );
}

export default function FvInputForm({ params, onChange, projectAddress }: Props) {
  const [evKmInput, setEvKmInput] = useState(String(params.evKmPerYear || 15000));

  const update = (patch: Partial<FvInputParams>) => onChange({ ...params, ...patch });

  useEffect(() => {
    if (projectAddress && !params.address && !params.lat) {
      update({ address: projectAddress });
    }
  }, []);

  const handleAddressChange = (address: string, lat: number | null, lon: number | null) => {
    update({
      address: address,
      lat: lat ?? 0,
      lon: lon ?? 0,
    });
  };

  const evKwh = Math.round((params.evCount * parseInt(evKmInput || '0') * EV_CONSUMPTION_KWH_PER_100KM) / 100);
  const hasValidCoords = params.lat !== 0 && params.lon !== 0;

  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Lokace instalace
        </div>
        <AddressAutocomplete
          value={params.address || ''}
          lat={params.lat || null}
          lon={params.lon || null}
          onChange={handleAddressChange}
          placeholder="Zadejte adresu instalace..."
        />
        {hasValidCoords && (
          <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-extrabold text-emerald-400">Poloha potvrzena</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Lat:</span>
                <span className="font-extrabold text-slate-300">{params.lat.toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Lon:</span>
                <span className="font-extrabold text-slate-300">{params.lon.toFixed(5)}</span>
              </div>
            </div>
          </div>
        )}
        {!hasValidCoords && params.address && (
          <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-extrabold text-amber-400">Vyberte adresu ze seznamu pro potvrzení GPS</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Roční spotřeba elektřiny
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {CONSUMPTION_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => update({ annualConsumptionKwh: p.kwh })}
              className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold transition border ${
                params.annualConsumptionKwh === p.kwh
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white/[0.06] text-slate-400 border-white/10 hover:border-orange-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="100"
            className="flex-1 border border-white/10 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
            value={params.annualConsumptionKwh}
            onChange={e => update({ annualConsumptionKwh: parseInt(e.target.value) || 0 })}
          />
          <span className="text-sm font-extrabold text-slate-400 shrink-0">kWh/rok</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Cena el. (Kč/kWh)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="w-full border border-white/10 rounded-xl px-3 py-1.5 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06] mt-0.5"
              value={params.electricityPriceCzkPerKwh}
              onChange={e => update({ electricityPriceCzkPerKwh: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Přetoky (Kč/kWh)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="w-full border border-white/10 rounded-xl px-3 py-1.5 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06] mt-0.5"
              value={params.gridFeedInPriceCzkPerKwh}
              onChange={e => update({ gridFeedInPriceCzkPerKwh: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Home className="w-3 h-3" /> Zdroj vytápění
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { value: 'heat_pump', label: 'Tepelné čerpadlo' },
            { value: 'electric_boiler', label: 'El. kotel' },
            { value: 'gas', label: 'Plyn' },
            { value: 'other', label: 'Jiný' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ heatingSource: opt.value as FvInputParams['heatingSource'] })}
              className={`px-2.5 py-2 rounded-xl text-[10px] font-extrabold transition border ${
                params.heatingSource === opt.value
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white/[0.06] text-slate-400 border-white/10 hover:border-orange-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Droplets className="w-3 h-3" /> Ohřev TUV
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { value: 'electric', label: 'Elektrický bojler' },
            { value: 'gas', label: 'Plynový' },
            { value: 'heat_pump', label: 'TČ / solár' },
            { value: 'other', label: 'Jiný' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ hotWaterSource: opt.value as FvInputParams['hotWaterSource'] })}
              className={`px-2.5 py-2 rounded-xl text-[10px] font-extrabold transition border ${
                params.hotWaterSource === opt.value
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white/[0.06] text-slate-400 border-white/10 hover:border-orange-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ConsumptionProfileChart params={params} />

      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Car className="w-3 h-3" /> Elektromobilita
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-extrabold text-slate-400">Počet EV:</span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => update({ evCount: n })}
                className={`w-8 h-8 rounded-xl font-extrabold text-sm transition ${
                  params.evCount === n
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/[0.06] text-slate-400 hover:bg-orange-500/20'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {params.evCount > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1000"
              className="flex-1 border border-white/10 rounded-xl px-3 py-1.5 text-sm font-extrabold text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
              value={evKmInput}
              onChange={e => {
                setEvKmInput(e.target.value);
                update({ evKmPerYear: parseInt(e.target.value) || 0 });
              }}
            />
            <span className="text-xs font-extrabold text-slate-400 shrink-0">km/rok/auto</span>
          </div>
        )}
        {params.evCount > 0 && evKwh > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-orange-600 font-extrabold bg-orange-500/10 rounded-lg px-2.5 py-1.5">
            <Info className="w-3 h-3 shrink-0" />
            +{evKwh.toLocaleString('cs-CZ')} kWh/rok z nabíjení EV (zahrnuto ve spotřebě)
          </div>
        )}
      </div>
    </div>
  );
}
