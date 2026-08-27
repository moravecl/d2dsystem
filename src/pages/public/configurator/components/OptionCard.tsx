import { CheckCircle2, type LucideIcon } from 'lucide-react';

interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  priceHint?: string;
}

export default function OptionCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
  priceHint,
}: OptionCardProps) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border-2 rounded-xl p-6 flex flex-col h-full bg-white relative overflow-hidden transition-all hover:shadow-md ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
          : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      {selected && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-bl font-bold">
          VYBRÁNO
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-3 rounded-full transition-colors ${
            selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <Icon size={24} />
        </div>
        {selected ? (
          <CheckCircle2 className="text-blue-500" size={24} />
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
        )}
      </div>
      <h3 className={`font-bold text-lg mb-2 ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
        {title}
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-grow">{description}</p>
      {priceHint && (
        <div className="text-xs font-bold text-slate-400 mt-auto pt-3 border-t border-slate-100 uppercase tracking-wide">
          {priceHint}
        </div>
      )}
    </div>
  );
}
