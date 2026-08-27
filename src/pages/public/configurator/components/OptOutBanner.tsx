import { CircleSlash, CheckCircle2 } from 'lucide-react';

interface OptOutBannerProps {
  /** true = oblast se NEŘEŠÍ (zákazník si ji zajistí sám) */
  optedOut: boolean;
  onChange: (optedOut: boolean) => void;
  label: string;
  note?: string;
}

/**
 * Přepínač „tuto oblast si zajistím sám" — umožňuje z nabídky vynechat
 * celé sekce (vytápění, vodu, elektroinstalaci…). Vynechaná sekce se
 * nenaceňuje a v poptávce se označí jako vlastní řešení zákazníka.
 */
export default function OptOutBanner({ optedOut, onChange, label, note }: OptOutBannerProps) {
  return (
    <div
      onClick={() => onChange(!optedOut)}
      className={`cursor-pointer max-w-3xl mx-auto rounded-xl border-2 p-4 flex items-center gap-3 transition-all ${
        optedOut
          ? 'border-slate-400 bg-slate-100'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className={`p-2 rounded-full ${optedOut ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
        {optedOut ? <CheckCircle2 size={20} /> : <CircleSlash size={20} />}
      </div>
      <div className="flex-1">
        <div className={`font-bold text-sm ${optedOut ? 'text-slate-800' : 'text-slate-600'}`}>{label}</div>
        {note && <div className="text-xs text-slate-500 mt-0.5">{note}</div>}
      </div>
      <input
        type="checkbox"
        checked={optedOut}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.checked); }}
        onClick={(e) => e.stopPropagation()}
        className="w-5 h-5 accent-slate-600"
      />
    </div>
  );
}
