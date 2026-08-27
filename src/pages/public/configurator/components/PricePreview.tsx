import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { calculateEstimate, getIncludedLabels } from '../priceCalculator';
import type { ConfigurationData } from '../types';
import type { PriceMap, SubsidySetting } from '../types';

interface PricePreviewProps {
  data: ConfigurationData;
  prices: PriceMap;
  currentStepId: string;
  subsidies?: SubsidySetting[];
  showPrices?: boolean;
}

export default function PricePreview({ data, prices, currentStepId, subsidies, showPrices = true }: PricePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const estimate = calculateEstimate(data, prices, subsidies);
  const includedLabels = getIncludedLabels(currentStepId);

  const visibleDetails = estimate.details.filter(d => includedLabels.has(d.label));
  const progressiveTotal = visibleDetails.reduce((sum, d) => sum + d.price, 0);
  const progressiveTotalWithVat = progressiveTotal * 1.12;

  if (progressiveTotal === 0 || !showPrices) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl mb-6 shadow-sm animate-in overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-lg">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div className="text-left">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Průběžný odhad ({visibleDetails.length} {visibleDetails.length === 1 ? 'položka' : visibleDetails.length < 5 ? 'položky' : 'položek'})
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {Math.round(progressiveTotalWithVat).toLocaleString('cs-CZ')} Kč
              <span className="text-xs font-normal text-slate-400 ml-1.5">s DPH</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {estimate.subsidyEstimate > 0 && (
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-green-600 font-semibold uppercase tracking-wider">
                Možná dotace
              </div>
              <div className="text-sm font-bold text-green-700 tabular-nums">
                -{estimate.subsidyEstimate.toLocaleString('cs-CZ')} Kč
              </div>
            </div>
          )}
          {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4">
          <div className="divide-y divide-slate-50">
            {visibleDetails.map((detail, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5">
                <span className="text-sm text-slate-600">{detail.label}</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {detail.price.toLocaleString('cs-CZ')} Kč
                </span>
              </div>
            ))}
          </div>
          {visibleDetails.length < estimate.details.length && (
            <div className="text-xs text-slate-400 mt-2 text-center">
              Zbývající položky se doplní v dalších krocích
            </div>
          )}
        </div>
      )}
    </div>
  );
}
