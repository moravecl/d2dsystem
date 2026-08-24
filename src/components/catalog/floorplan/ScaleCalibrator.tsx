import { useState } from 'react';
import { Ruler, Trash2, Check } from 'lucide-react';
import type { FloorScale } from '../../../hooks/useProjectState';

interface Props {
  scale?: FloorScale;
  scaleStep: 'idle' | 'point1' | 'point2' | 'input';
  onStart: () => void;
  onSetDistance: (meters: number) => void;
  onClear: () => void;
  onCancel: () => void;
}

export default function ScaleCalibrator({ scale, scaleStep, onStart, onSetDistance, onClear, onCancel }: Props) {
  const [distInput, setDistInput] = useState('');

  const handleSubmit = () => {
    const val = parseFloat(distInput.replace(',', '.'));
    if (val > 0) {
      onSetDistance(val);
      setDistInput('');
    }
  };

  return (
    <div className="p-4 border-b border-white/10">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Ruler className="w-3.5 h-3.5" />
        Kalibrace měřítka
      </div>

      {scale ? (
        <div className="bg-emerald-500/10 border border-emerald-200 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-emerald-800">Měřítko nastaveno</div>
              <div className="text-xs text-emerald-400 mt-0.5">{scale.realDistanceM} m mezi 2 body</div>
            </div>
            <button onClick={onClear} className="p-2 rounded-xl bg-white/[0.06] border border-emerald-200 text-red-500 hover:bg-red-500/10 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : scaleStep === 'idle' ? (
        <button
          onClick={onStart}
          className="w-full bg-slate-900 text-white py-3 rounded-2xl font-extrabold text-sm hover:bg-slate-800 transition flex items-center justify-center gap-2"
        >
          <Ruler className="w-4 h-4" /> Kalibrovat měřítko
        </button>
      ) : scaleStep === 'point1' ? (
        <div className="bg-blue-500/10 border border-blue-200 rounded-2xl p-3">
          <div className="text-sm font-extrabold text-blue-800">Klikni na PRVNÍ bod</div>
          <div className="text-xs text-blue-400 mt-1">Výběr začátek úsečky, jejíž skutečnou délku znáš.</div>
          <button onClick={onCancel} className="mt-2 text-xs font-extrabold text-blue-400 underline">Zrušit</button>
        </div>
      ) : scaleStep === 'point2' ? (
        <div className="bg-blue-500/10 border border-blue-200 rounded-2xl p-3">
          <div className="text-sm font-extrabold text-blue-800">Klikni na DRUHÝ bod</div>
          <div className="text-xs text-blue-400 mt-1">Úsečka se zobrazí na půdorysu.</div>
          <button onClick={onCancel} className="mt-2 text-xs font-extrabold text-blue-400 underline">Zrušit</button>
        </div>
      ) : scaleStep === 'input' ? (
        <div className="bg-blue-500/10 border border-blue-200 rounded-2xl p-3 space-y-2">
          <div className="text-sm font-extrabold text-blue-800">Zadej skutečnou vzdálenost</div>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={distInput}
              onChange={(e) => setDistInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="např. 5.2"
              className="flex-1 px-3 py-2 rounded-xl border border-blue-200 bg-white/[0.06] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="flex items-center text-sm font-extrabold text-blue-400">m</span>
            <button onClick={handleSubmit} className="bg-blue-600 text-white px-3 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition">
              <Check className="w-4 h-4" />
            </button>
          </div>
          <button onClick={onCancel} className="text-xs font-extrabold text-blue-400 underline">Zrušit</button>
        </div>
      ) : null}
    </div>
  );
}
