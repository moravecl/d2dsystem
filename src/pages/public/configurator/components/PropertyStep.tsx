import { Home, Building2 } from 'lucide-react';
import type { StepProps } from '../types';

export default function PropertyStep({ data, setData }: StepProps) {
  return (
    <div className="space-y-8 animate-in">
      <h2 className="text-2xl font-bold text-center mb-6">Jak velký bude Váš dům?</h2>
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <label className="block text-sm font-bold text-slate-700 mb-4 flex justify-between">
          <span>Užitná plocha</span>
          <span className="text-blue-600">{data.area} m²</span>
        </label>
        <input
          type="range"
          min="50"
          max="350"
          step="5"
          value={data.area}
          onChange={(e) => setData({ ...data, area: Number(e.target.value) })}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>50 m²</span>
          <span>350 m²</span>
        </div>
        <p className="text-xs text-slate-400 mt-6 text-center bg-slate-50 p-2 rounded">
          Tento údaj použijeme pro výpočet výkonu topení a délky kabelů.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <div
          onClick={() => setData({ ...data, floors: '1' })}
          className={`cursor-pointer border-2 rounded-xl p-6 flex flex-col h-full bg-white transition-all hover:shadow-md ${
            data.floors === '1'
              ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
              : 'border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div
              className={`p-3 rounded-full transition-colors ${
                data.floors === '1' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Home size={24} />
            </div>
          </div>
          <h3
            className={`font-bold text-lg mb-2 ${data.floors === '1' ? 'text-blue-700' : 'text-slate-800'}`}
          >
            Bungalov
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Přízemní dům, jednodušší rozvody.
          </p>
        </div>

        <div
          onClick={() => setData({ ...data, floors: '2' })}
          className={`cursor-pointer border-2 rounded-xl p-6 flex flex-col h-full bg-white transition-all hover:shadow-md ${
            data.floors === '2'
              ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
              : 'border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div
              className={`p-3 rounded-full transition-colors ${
                data.floors === '2' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Building2 size={24} />
            </div>
          </div>
          <h3
            className={`font-bold text-lg mb-2 ${data.floors === '2' ? 'text-blue-700' : 'text-slate-800'}`}
          >
            Patrový dům
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Více podlaží, stoupačky, zónová regulace.
          </p>
        </div>
      </div>
    </div>
  );
}
