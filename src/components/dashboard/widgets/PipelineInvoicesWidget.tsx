import { Link } from 'react-router-dom';
import { TrendingUp, DollarSign } from 'lucide-react';
import type { DashboardData } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

const PIPELINE_STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-slate-500' },
  { key: 'design', label: 'Návrh', color: 'bg-blue-500' },
  { key: 'quote', label: 'Nabídka', color: 'bg-cyan-500' },
  { key: 'approval', label: 'Schválení', color: 'bg-amber-500' },
  { key: 'in_progress', label: 'Realizace', color: 'bg-emerald-500' },
  { key: 'completed', label: 'Hotovo', color: 'bg-slate-400' },
];

export default function PipelineInvoicesWidget({ data, editMode }: Props) {
  const { stats, pipeline, monthlyInvoices } = data;
  const totalPipeline = pipeline.reduce((s, p) => s + p.count, 0) || 1;
  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
  const maxInvoice = Math.max(1, ...monthlyInvoices.map(m => m.amount));
  const monthLabel = (m: string) => {
    const [, mo] = m.split('-');
    const labels = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
    return labels[parseInt(mo) - 1] || mo;
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950 rounded-2xl p-1' : ''}`}>
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400" />Pipeline</h2>
          <span className="text-xs text-slate-500 font-medium">{stats.projects} projektů celkem</span>
        </div>
        <div className="flex rounded-xl overflow-hidden h-9 bg-white/[0.06]">
          {PIPELINE_STAGES.map(stage => {
            const found = pipeline.find(p => p.status === stage.key);
            const count = found?.count || 0;
            const pct = (count / totalPipeline) * 100;
            if (pct === 0) return null;
            return (
              <div key={stage.key} className={`${stage.color} flex items-center justify-center transition-all duration-500 relative group`} style={{ width: `${pct}%`, minWidth: count > 0 ? '2rem' : '0' }}>
                <span className="text-[10px] font-extrabold text-white">{count}</span>
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-navy-700 border border-white/10 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">{stage.label}: {count}</div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {PIPELINE_STAGES.map(stage => {
            const found = pipeline.find(p => p.status === stage.key);
            if (!found) return null;
            return (
              <div key={stage.key} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-[10px] text-slate-500 font-medium">{stage.label} ({found.count})</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Měsíční fakturace</h2>
          <Link to="/finance" className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">Detail</Link>
        </div>
        {monthlyInvoices.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">Žádná data</div>
        ) : (
          <div className="flex items-end gap-2 h-28">
            {monthlyInvoices.map((m, idx) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 animate-count-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="w-full relative group flex justify-center">
                  <div
                    className="w-full max-w-[40px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-500 hover:to-blue-300 opacity-90"
                    style={{ height: `${Math.max(4, (m.amount / maxInvoice) * 96)}px` }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-navy-700 border border-white/10 text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">{fmt(m.amount)} Kč</div>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.07]">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Fakturováno</div>
            <div className="text-sm font-extrabold text-white">{fmt(stats.totalInvoiced)} Kč</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Zaplaceno</div>
            <div className="text-sm font-extrabold text-emerald-400">{fmt(stats.totalPaid)} Kč</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Po splatnosti</div>
            <div className={`text-sm font-extrabold ${stats.totalOverdue > 0 ? 'text-red-400' : 'text-white'}`}>{fmt(stats.totalOverdue)} Kč</div>
          </div>
        </div>
      </div>
    </div>
  );
}
