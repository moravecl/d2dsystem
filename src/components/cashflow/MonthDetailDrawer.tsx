import type { ReactNode } from 'react';
import { X, TrendingUp, TrendingDown, Building2, FileText, RefreshCw, Wrench, PlusCircle, ReceiptText, Banknote } from 'lucide-react';
import type { MonthRow, CashflowItem } from '../../types/cashflow';

const SOURCE_LABELS: Record<string, string> = {
  project_forecast: 'Projekty (forecast)',
  sales_invoice: 'Vystavené faktury',
  purchase_invoice: 'Přijaté faktury',
  recurring: 'Stálé náklady',
  manual: 'Ruční záznamy',
  vat_refund: 'Vratky DPH',
};

const SOURCE_ICONS: Record<string, ReactNode> = {
  project_forecast: <Building2 className="w-4 h-4" />,
  sales_invoice: <FileText className="w-4 h-4" />,
  purchase_invoice: <ReceiptText className="w-4 h-4" />,
  recurring: <RefreshCw className="w-4 h-4" />,
  manual: <PlusCircle className="w-4 h-4" />,
  vat_refund: <Wrench className="w-4 h-4" />,
};

const SOURCE_COLORS: Record<string, string> = {
  project_forecast: 'text-sky-400 bg-sky-500/10',
  sales_invoice: 'text-emerald-400 bg-emerald-500/10',
  purchase_invoice: 'text-red-400 bg-red-500/10',
  recurring: 'text-orange-400 bg-orange-500/10',
  manual: 'text-slate-300 bg-white/[0.06]',
  vat_refund: 'text-teal-400 bg-teal-500/10',
};

function fmt(n: number) {
  return Math.round(n).toLocaleString('cs-CZ') + ' Kč';
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('cs-CZ');
}

interface Props {
  month: MonthRow | null;
  onClose: () => void;
  cashBalance: number;
  bankBalance: number;
}

export default function MonthDetailDrawer({ month, onClose, cashBalance, bankBalance }: Props) {
  if (!month) return null;

  const inflows = month.items.filter(i => i.type === 'inflow');
  const outflows = month.items.filter(i => i.type === 'outflow');

  const groupBySource = (items: CashflowItem[]) => {
    const groups = new Map<string, CashflowItem[]>();
    items.forEach(item => {
      const key = item.source;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return groups;
  };

  const inflowGroups = groupBySource(inflows);
  const outflowGroups = groupBySource(outflows);

  const renderGroup = (source: string, items: CashflowItem[], type: 'inflow' | 'outflow') => {
    const total = items.reduce((s, i) => s + i.amount_gross, 0);
    const colorClass = SOURCE_COLORS[source] || 'text-slate-300 bg-white/[0.06]';
    const icon = SOURCE_ICONS[source] || <PlusCircle className="w-4 h-4" />;
    const label = SOURCE_LABELS[source] || source;

    return (
      <div key={`${type}_${source}`} className="space-y-2">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${colorClass} text-xs font-semibold`}>
            {icon}
            {label}
          </div>
          <span className={`text-sm font-bold ${type === 'inflow' ? 'text-emerald-400' : 'text-red-400'}`}>
            {type === 'inflow' ? '+' : '-'}{fmt(total)}
          </span>
        </div>

        <div className="space-y-1.5 pl-2">
          {items.map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{item.title}</div>
                {item.source === 'project_forecast' && item.budget_approved !== undefined && (
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                    <span>Schválený rozpočet: <span className="text-slate-400">{fmt(item.budget_approved)}</span></span>
                    <span>Vyfakturováno: <span className="text-slate-400">{fmt(item.invoiced_allocated || 0)}</span></span>
                    <span>Zbývá: <span className="text-sky-400 font-semibold">{fmt(item.remaining_forecast || 0)}</span></span>
                  </div>
                )}
                {item.status && item.status !== 'forecast' && item.status !== 'scheduled' && item.status !== 'manual' && (
                  <span className="text-[10px] text-slate-500">{item.status}</span>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-sm font-semibold ${type === 'inflow' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(item.amount_gross)}
                </div>
                <div className="text-[10px] text-slate-500">{fmtDate(item.date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const initialBalance = cashBalance + bankBalance;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-[#0b1222] border-l border-white/[0.08] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-bold text-white capitalize">{month.label}</h2>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="w-3 h-3" /> {fmt(month.inflow)}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <TrendingDown className="w-3 h-3" /> {fmt(month.outflow)}
              </span>
              <span className={`font-semibold ${month.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Saldo: {month.net >= 0 ? '+' : ''}{fmt(month.net)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {inflows.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                Příjmy
              </h3>
              <div className="space-y-5">
                {Array.from(inflowGroups.entries()).map(([source, items]) =>
                  renderGroup(source, items, 'inflow')
                )}
              </div>
            </div>
          )}

          {outflows.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                Výdaje
              </h3>
              <div className="space-y-5">
                {Array.from(outflowGroups.entries()).map(([source, items]) =>
                  renderGroup(source, items, 'outflow')
                )}
              </div>
            </div>
          )}

          {month.items.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm">V tomto měsíci nejsou žádné cashflow položky</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] space-y-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Počáteční zůstatek (vstupuje do kumulativu)</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Banknote className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Pokladna</div>
                  <div className={`text-sm font-bold ${cashBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {cashBalance >= 0 ? '+' : ''}{fmt(cashBalance)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Banka</div>
                  <div className={`text-sm font-bold ${bankBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {bankBalance >= 0 ? '+' : ''}{fmt(bankBalance)}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Celkem počáteční zůstatek</span>
              <span className={`text-xs font-bold ${initialBalance >= 0 ? 'text-slate-300' : 'text-red-400'}`}>
                {initialBalance >= 0 ? '+' : ''}{fmt(initialBalance)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Kumulativní saldo ke konci měsíce</span>
            <span className={`text-lg font-bold ${month.cumulative >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {month.cumulative >= 0 ? '+' : ''}{fmt(month.cumulative)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
