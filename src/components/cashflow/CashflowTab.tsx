import { useState } from 'react';
import { TrendingUp, TrendingDown, Plus, FileText, RefreshCw, ReceiptText, Wallet, ChevronRight, CreditCard as Edit2, Trash2, BarChart3, List, Receipt, Banknote, Building2, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useCashflowData } from '../../hooks/useCashflowData';
import type { MonthRow, SalesInvoice, CashflowManualEntry, VatRefund } from '../../types/cashflow';
import MonthDetailDrawer from './MonthDetailDrawer';
import SalesInvoiceModal from './SalesInvoiceModal';
import { ManualEntryModal, VatRefundModal } from './CashflowManualModal';

function fmt(n: number) {
  return Math.round(Math.abs(n)).toLocaleString('cs-CZ') + ' Kč';
}

type View = 'dashboard' | 'sales' | 'items';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/[0.06] text-slate-400',
  sent: 'bg-blue-500/10 text-blue-400',
  paid: 'bg-emerald-500/10 text-emerald-400',
  canceled: 'bg-red-500/10 text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  sent: 'Odeslaná',
  paid: 'Zaplacená',
  canceled: 'Zrušená',
};

function fmtAxis(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

function MiniBarChart({ months }: { months: MonthRow[] }) {
  if (months.length === 0) return null;
  const maxAbs = Math.max(...months.map(m => Math.max(Math.abs(m.inflow), Math.abs(m.outflow))), 1);
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const labelEvery = Math.max(1, Math.ceil(months.length / 7));

  return (
    <div className="flex gap-2">
      <div className="w-10 shrink-0 flex flex-col justify-between pb-5 text-right">
        <span className="text-[9px] text-slate-600">{fmtAxis(maxAbs)}</span>
        <span className="text-[9px] text-slate-600">{fmtAxis(maxAbs / 2)}</span>
        <span className="text-[9px] text-slate-600">0</span>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-0.5 h-20 w-full relative">
          <div className="absolute left-0 right-0 top-0 border-t border-white/[0.05]" />
          <div className="absolute left-0 right-0 top-1/2 border-t border-white/[0.05]" />
          <div className="absolute left-0 right-0 bottom-0 border-t border-white/[0.05]" />
          {months.map(m => {
            const inH = (m.inflow / maxAbs) * 100;
            const outH = (m.outflow / maxAbs) * 100;
            const isCurrent = m.key === curKey;
            return (
              <div key={m.key} className="flex-1 flex items-end gap-px h-full relative z-10">
                <div className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className={`w-full rounded-sm transition-all ${isCurrent ? 'bg-emerald-400' : 'bg-emerald-500/40'}`}
                    style={{ height: `${inH}%` }}
                  />
                </div>
                <div className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className={`w-full rounded-sm transition-all ${isCurrent ? 'bg-red-400' : 'bg-red-500/30'}`}
                    style={{ height: `${outH}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-start h-4 relative">
          {months.map((m, i) => {
            if (i % labelEvery !== 0 && i !== months.length - 1) return null;
            return (
              <div
                key={m.key}
                className="absolute text-[9px] text-slate-600 -translate-x-1/2 truncate"
                style={{ left: `${(i / (months.length - 1)) * 100}%` }}
              >
                {m.label.slice(0, 3)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CumulativeChart({ months }: { months: MonthRow[] }) {
  if (months.length < 2) return null;
  const vals = months.map(m => m.cumulative);
  const rawMin = Math.min(...vals, 0);
  const rawMax = Math.max(...vals, 0);
  const pad = (rawMax - rawMin) * 0.08 || 10000;
  const vMin = rawMin - pad;
  const vMax = rawMax + pad;
  const vRange = vMax - vMin;

  const toYPct = (v: number) => ((vMax - v) / vRange) * 100;
  const n = months.length;
  const toXPct = (i: number) => (i / (n - 1)) * 100;

  const points = months.map((m, i) => `${toXPct(i)},${toYPct(m.cumulative)}`).join(' ');
  const areaPoints = `${toXPct(0)},${toYPct(vMin)} ${points} ${toXPct(n - 1)},${toYPct(vMin)}`;
  const zeroY = toYPct(0);

  const numYTicks = 4;
  const yTicks = Array.from({ length: numYTicks }, (_, i) => vMin + (vRange * i) / (numYTicks - 1));

  const labelEvery = Math.max(1, Math.ceil(n / 7));

  return (
    <div className="flex gap-2">
      <div className="w-14 shrink-0 relative" style={{ height: 128 + 20 }}>
        {yTicks.map((tick, ti) => (
          <div
            key={ti}
            className="absolute right-0 text-[9px] text-slate-500 -translate-y-1/2 text-right leading-none whitespace-nowrap"
            style={{ top: `${(toYPct(tick) / 100) * 128}px` }}
          >
            {fmtAxis(tick)}
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative" style={{ height: 128 }}>
          {yTicks.map((tick, ti) => (
            <div
              key={ti}
              className="absolute left-0 right-0 border-t border-white/[0.05]"
              style={{ top: `${toYPct(tick)}%` }}
            />
          ))}
          {rawMin < 0 && rawMax >= 0 && (
            <div
              className="absolute left-0 right-0 border-t border-white/20"
              style={{ top: `${zeroY}%` }}
            />
          )}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#cfGrad)" />
            <polyline points={points} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="relative h-5">
          {months.map((m, i) => {
            if (i % labelEvery !== 0 && i !== n - 1) return null;
            return (
              <div
                key={m.key}
                className="absolute text-[9px] text-slate-600 -translate-x-1/2 truncate"
                style={{ left: `${toXPct(i)}%` }}
              >
                {m.label.slice(0, 6)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CashflowTab() {
  const { toast } = useToast();
  const { months, salesInvoices, manualEntries, vatRefunds, cashBalance, bankBalance: bankTxBalance, settings, loading, reload } = useCashflowData();
  const [view, setView] = useState<View>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<MonthRow | null>(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [editSales, setEditSales] = useState<SalesInvoice | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editManual, setEditManual] = useState<CashflowManualEntry | null>(null);
  const [showVatModal, setShowVatModal] = useState(false);
  const [editVat, setEditVat] = useState<VatRefund | null>(null);

  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curMonth = months.find(m => m.key === curKey);
  const nextMonths = months.filter(m => m.key > curKey).slice(0, 3);

  const totalInflow12 = months
    .filter(m => m.key >= `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}` && m.key <= curKey)
    .reduce((s, m) => s + m.inflow, 0);
  const totalOutflow12 = months
    .filter(m => m.key >= `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}` && m.key <= curKey)
    .reduce((s, m) => s + m.outflow, 0);
  const lastCumulative = months[months.length - 1]?.cumulative ?? 0;

  const bankCorrection = settings ? Number(settings.bank_balance_correction) || 0 : 0;
  const bankBalance = bankTxBalance !== 0 ? bankTxBalance : bankCorrection;


  const deleteSalesInvoice = async (id: string) => {
    if (!confirm('Smazat fakturu?')) return;
    await supabase.from('invoice_project_allocations').delete().eq('sales_invoice_id', id);
    await supabase.from('sales_invoices').delete().eq('id', id);
    toast('Faktura smazána');
    reload();
  };

  const deleteManual = async (id: string) => {
    if (!confirm('Smazat záznam?')) return;
    await supabase.from('cashflow_manual_entries').delete().eq('id', id);
    toast('Záznam smazán');
    reload();
  };

  const deleteVat = async (id: string) => {
    if (!confirm('Smazat vratku DPH?')) return;
    await supabase.from('vat_refunds').delete().eq('id', id);
    toast('Vratka smazána');
    reload();
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-white/[0.04] rounded-2xl" />
        <div className="h-48 bg-white/[0.04] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {([
            ['dashboard', <BarChart3 className="w-3.5 h-3.5" />, 'Přehled'] as const,
            ['sales', <FileText className="w-3.5 h-3.5" />, 'Vystavené faktury'] as const,
            ['items', <List className="w-3.5 h-3.5" />, 'Ruční záznamy'] as const,
          ]).map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                view === v ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {icon}{label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {view === 'sales' && (
            <button onClick={() => { setEditSales(null); setShowSalesModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition">
              <Plus className="w-3.5 h-3.5" /> Nová faktura
            </button>
          )}
          {view === 'items' && (
            <>
              <button onClick={() => { setEditManual(null); setShowManualModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition">
                <Plus className="w-3.5 h-3.5" /> Ruční záznam
              </button>
              <button onClick={() => { setEditVat(null); setShowVatModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl transition">
                <Receipt className="w-3.5 h-3.5" /> Vratka DPH
              </button>
            </>
          )}
        </div>
      </div>

      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stav pokladny</div>
                  <div className={`text-base font-extrabold ${cashBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{fmt(cashBalance)}</div>
                  <div className="text-[10px] text-slate-600">z pokladních dokladů</div>
                </div>
              </div>
            </div>
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stav účtu</div>
                    <>
                      <div className={`text-base font-extrabold ${bankBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(bankBalance)}</div>
                      <a href="/finance/banka" className="text-[10px] text-slate-600 hover:text-blue-400 flex items-center gap-0.5 transition">
                        <Settings2 className="w-2.5 h-2.5" />
                        spravovat bankovní pohyby
                      </a>
                    </>
                </div>
              </div>
            </div>
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Příjmy (12M)</div>
                  <div className="text-base font-extrabold text-emerald-400">{fmt(totalInflow12)}</div>
                </div>
              </div>
            </div>
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Výdaje (12M)</div>
                  <div className="text-base font-extrabold text-red-400">{fmt(totalOutflow12)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${curMonth && curMonth.net >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10'}`}>
                  <Wallet className={`w-5 h-5 ${curMonth && curMonth.net >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tento měsíc</div>
                  <div className={`text-base font-extrabold ${curMonth && curMonth.net >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                    {curMonth ? (curMonth.net >= 0 ? '+' : '') + fmt(curMonth.net) : '—'}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lastCumulative >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <BarChart3 className={`w-5 h-5 ${lastCumulative >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Kumulativ (konec)</div>
                  <div className={`text-base font-extrabold ${lastCumulative >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lastCumulative >= 0 ? '+' : ''}{fmt(lastCumulative)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {nextMonths.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Výhled na 3 měsíce</div>
              <div className="grid grid-cols-3 gap-3">
                {nextMonths.map(m => (
                  <div key={m.key} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                    <div className="text-xs font-semibold text-slate-400 capitalize mb-2">{m.label}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400">+{fmt(m.inflow)}</span>
                      <span className="text-red-400">-{fmt(m.outflow)}</span>
                    </div>
                    <div className={`text-sm font-bold mt-1 ${m.net >= 0 ? 'text-white' : 'text-orange-400'}`}>
                      {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Kumulativní cashflow</div>
            <CumulativeChart months={months} />
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Přehled po měsících</div>
            </div>
            <div className="p-4 mb-3">
              <MiniBarChart months={months} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="pb-3 px-5">Měsíc</th>
                    <th className="pb-3 pr-4 text-right text-emerald-500">Příjmy</th>
                    <th className="pb-3 pr-4 text-right text-red-500">Výdaje</th>
                    <th className="pb-3 pr-4 text-right">Saldo</th>
                    <th className="pb-3 pr-4 text-right">Kumulativ</th>
                    <th className="pb-3 pr-4 text-center">Položek</th>
                    <th className="pb-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {months.map(m => {
                    const isCur = m.key === curKey;
                    const isFuture = m.key > curKey;
                    return (
                      <tr
                        key={m.key}
                        className={`hover:bg-white/[0.04] transition cursor-pointer ${isCur ? 'bg-blue-500/5' : ''}`}
                        onClick={() => setSelectedMonth(m)}
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold capitalize ${isCur ? 'text-blue-300' : isFuture ? 'text-slate-400' : 'text-white'}`}>
                              {m.label}
                            </span>
                            {isCur && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Aktuální</span>}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right text-emerald-400 font-semibold">{m.inflow > 0 ? fmt(m.inflow) : '—'}</td>
                        <td className="py-3 pr-4 text-right text-red-400 font-semibold">{m.outflow > 0 ? fmt(m.outflow) : '—'}</td>
                        <td className={`py-3 pr-4 text-right font-bold ${m.net >= 0 ? 'text-white' : 'text-orange-400'}`}>
                          {m.net !== 0 ? (m.net >= 0 ? '+' : '') + fmt(m.net) : '—'}
                        </td>
                        <td className={`py-3 pr-4 text-right font-semibold ${m.cumulative >= 0 ? 'text-slate-300' : 'text-red-400'}`}>
                          {m.cumulative >= 0 ? '+' : ''}{fmt(m.cumulative)}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="text-xs text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded">{m.items.length}</span>
                        </td>
                        <td className="py-3 pr-2">
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'sales' && (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                  <th className="pb-3 px-5">Číslo / Zákazník</th>
                  <th className="pb-3 pr-4">Projekt</th>
                  <th className="pb-3 pr-4">Stav</th>
                  <th className="pb-3 pr-4 text-right">Celkem</th>
                  <th className="pb-3 pr-4 text-right">Alokováno</th>
                  <th className="pb-3 pr-4">Splatnost</th>
                  <th className="pb-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {salesInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/[0.04] transition">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-white">{inv.customer_name}</div>
                      {inv.invoice_number && <div className="text-xs text-slate-500">{inv.invoice_number}</div>}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{inv.project_id ? '—' : '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[inv.status] || ''}`}>
                        {STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-white">{fmt(inv.amount_gross)}</td>
                    <td className="py-3 pr-4 text-right text-xs">
                      {(inv.allocated_amount || 0) > 0 ? (
                        <div>
                          <span className="text-blue-400 font-semibold">{fmt(inv.allocated_amount || 0)}</span>
                          <div className="text-slate-500">zbývá: {fmt(inv.amount_gross - (inv.allocated_amount || 0))}</div>
                        </div>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">
                      {new Date(inv.due_date).toLocaleDateString('cs-CZ')}
                    </td>
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditSales(inv); setShowSalesModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteSalesInvoice(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {salesInvoices.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Žádné vystavené faktury</p>
                <button onClick={() => { setEditSales(null); setShowSalesModal(true); }}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition">
                  + Přidat první fakturu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'items' && (
        <div className="space-y-6">
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">Vratky DPH</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="pb-3 px-5">Datum</th>
                    <th className="pb-3 pr-4 text-right">Částka</th>
                    <th className="pb-3 pr-4">Poznámka</th>
                    <th className="pb-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {vatRefunds.map(v => (
                    <tr key={v.id} className="hover:bg-white/[0.04] transition">
                      <td className="py-3 px-5 text-slate-400">{new Date(v.date).toLocaleDateString('cs-CZ')}</td>
                      <td className="py-3 pr-4 text-right font-bold text-teal-400">{fmt(v.amount_gross)}</td>
                      <td className="py-3 pr-4 text-slate-500 text-xs">{v.note || '—'}</td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditVat(v); setShowVatModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteVat(v.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vatRefunds.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">Žádné vratky DPH</div>
              )}
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Ruční záznamy</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="pb-3 px-5">Datum</th>
                    <th className="pb-3 pr-4">Popis</th>
                    <th className="pb-3 pr-4">Typ</th>
                    <th className="pb-3 pr-4 text-right">Částka</th>
                    <th className="pb-3 pr-4">Poznámka</th>
                    <th className="pb-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {manualEntries.map(m => (
                    <tr key={m.id} className="hover:bg-white/[0.04] transition">
                      <td className="py-3 px-5 text-slate-400">{new Date(m.date).toLocaleDateString('cs-CZ')}</td>
                      <td className="py-3 pr-4 text-white font-medium">{m.title}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${(m.type === 'in' || m.type === 'inflow') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {(m.type === 'in' || m.type === 'inflow') ? 'Příjem' : 'Výdaj'}
                        </span>
                      </td>
                      <td className={`py-3 pr-4 text-right font-bold ${(m.type === 'in' || m.type === 'inflow') ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(m.type === 'in' || m.type === 'inflow') ? '+' : '-'}{fmt(m.amount_gross)}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 text-xs">{m.note || '—'}</td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditManual(m); setShowManualModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteManual(m.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {manualEntries.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">Žádné ruční záznamy</div>
              )}
            </div>
          </div>
        </div>
      )}

      <MonthDetailDrawer month={selectedMonth} onClose={() => setSelectedMonth(null)} cashBalance={cashBalance} bankBalance={bankBalance} />

      <SalesInvoiceModal
        open={showSalesModal}
        onClose={() => setShowSalesModal(false)}
        onSaved={reload}
        invoice={editSales}
      />

      <ManualEntryModal
        open={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSaved={reload}
        entry={editManual}
      />

      <VatRefundModal
        open={showVatModal}
        onClose={() => setShowVatModal(false)}
        onSaved={reload}
        refund={editVat}
      />
    </div>
  );
}
