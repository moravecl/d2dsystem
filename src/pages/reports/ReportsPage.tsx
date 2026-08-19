import { useEffect, useState } from 'react';
import {
  DollarSign, FolderKanban,
  Clock, Package, Download,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/csvExport';
import Tabs from '../../components/ui/Tabs';
import type { Profile } from '../../types/database';

interface ProjectStats {
  total: number;
  byStatus: Record<string, number>;
  totalQuoteValue: number;
  avgProjectDuration: number;
}

interface FinancialStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOverdue: number;
  invoiceCount: number;
}

interface TimeStats {
  totalMinutes: number;
  billableMinutes: number;
  byProject: { name: string; minutes: number }[];
  byUser: { name: string; minutes: number }[];
}

const tabs = [
  { key: 'overview', label: 'Přehled' },
  { key: 'projects', label: 'Projekty' },
  { key: 'financial', label: 'Finance' },
  { key: 'time', label: 'Čas' },
  { key: 'warehouse', label: 'Sklad' },
];

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', design: 'Návrh', quote: 'Nabídka', approval: 'Schválení',
  in_progress: 'Realizace', completed: 'Hotovo', cancelled: 'Zrušeno',
};
const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-white/[0.04]0', design: 'bg-blue-500/100', quote: 'bg-cyan-500/100',
  approval: 'bg-amber-500/100', in_progress: 'bg-emerald-500/100', completed: 'bg-slate-400', cancelled: 'bg-red-400',
};

export default function ReportsPage() {
  const { setConfig } = useHeader();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [projectStats, setProjectStats] = useState<ProjectStats>({ total: 0, byStatus: {}, totalQuoteValue: 0, avgProjectDuration: 0 });
  const [financialStats, setFinancialStats] = useState<FinancialStats>({ totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, invoiceCount: 0 });
  const [timeStats, setTimeStats] = useState<TimeStats>({ totalMinutes: 0, billableMinutes: 0, byProject: [], byUser: [] });
  const [_profiles, setProfiles] = useState<Profile[]>([]);
  const [warehouseValue, setWarehouseValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Reporty' }] });
  }, [setConfig]);

  useEffect(() => {
    (async () => {
      const [projectsRes, quotesRes, invoicesRes, paymentsRes, timeRes, profilesRes, warehouseRes] = await Promise.all([
        supabase.from('projects').select('id, status, created_at, updated_at'),
        supabase.from('project_quotes').select('total_selling, status'),
        supabase.from('invoices').select('*'),
        supabase.from('payments').select('amount'),
        supabase.from('time_entries').select('user_id, project_id, duration_minutes, billable'),
        supabase.from('profiles').select('*'),
        supabase.from('warehouse_items').select('quantity, min_quantity, price_per_unit').eq('is_active', true),
      ]);

      const projects = projectsRes.data || [];
      const byStatus: Record<string, number> = {};
      projects.forEach((p: any) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
      const quotes = (quotesRes.data || []) as any[];
      const totalQuoteValue = quotes.filter(q => q.status === 'approved').reduce((s: number, q: any) => s + (q.total_selling || 0), 0);

      setProjectStats({ total: projects.length, byStatus, totalQuoteValue, avgProjectDuration: 0 });

      const invoices = (invoicesRes.data || []) as any[];
      const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.amount || 0), 0);
      const totalPaid = (paymentsRes.data || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const totalOverdue = invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + (i.amount || 0), 0);
      setFinancialStats({ totalInvoiced, totalPaid, totalOverdue, invoiceCount: invoices.length });

      const timeEntries = (timeRes.data || []) as any[];
      const totalMin = timeEntries.reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
      const billableMin = timeEntries.filter((e: any) => e.billable).reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);

      const byProjectMap: Record<string, number> = {};
      const byUserMap: Record<string, number> = {};
      timeEntries.forEach((e: any) => {
        const pk = e.project_id || 'none';
        byProjectMap[pk] = (byProjectMap[pk] || 0) + e.duration_minutes;
        byUserMap[e.user_id] = (byUserMap[e.user_id] || 0) + e.duration_minutes;
      });

      const profs = (profilesRes.data || []) as Profile[];
      setProfiles(profs);

      setTimeStats({
        totalMinutes: totalMin,
        billableMinutes: billableMin,
        byProject: Object.entries(byProjectMap).map(([k, v]) => ({ name: k, minutes: v })).sort((a, b) => b.minutes - a.minutes).slice(0, 10),
        byUser: Object.entries(byUserMap).map(([k, v]) => ({
          name: profs.find(p => p.id === k)?.display_name || k,
          minutes: v,
        })).sort((a, b) => b.minutes - a.minutes),
      });

      const items = (warehouseRes.data || []) as any[];
      setWarehouseValue(items.reduce((s: number, i: any) => s + (i.quantity * i.price_per_unit), 0));
      setLowStockCount(items.filter((i: any) => i.quantity <= i.min_quantity && i.min_quantity > 0).length);

      setLoading(false);
    })();
  }, []);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
  const fmtH = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;
  const maxBar = (items: { minutes: number }[]) => Math.max(1, ...items.map(i => i.minutes));

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div data-tour="reports-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Projekty" value={projectStats.total} color="blue" />
        <StatCard icon={DollarSign} label="Schválené nabídky" value={`${fmt(projectStats.totalQuoteValue)} Kč`} color="emerald" />
        <StatCard icon={Clock} label="Odpracováno" value={fmtH(timeStats.totalMinutes)} color="amber" />
        <StatCard icon={Package} label="Hodnota skladu" value={`${fmt(warehouseValue)} Kč`} color="cyan" />
      </div>

      <div data-tour="reports-main" className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
        <div className="flex items-center">
          <div className="flex-1"><Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} /></div>
          <button
            onClick={() => {
              if (activeTab === 'projects') {
                downloadCsv(Object.entries(projectStats.byStatus).map(([status, count]) => ({
                  Stav: STATUS_LABELS[status] || status, Pocet: count,
                })), `report_projekty_${new Date().toISOString().slice(0, 10)}`);
              } else if (activeTab === 'financial') {
                downloadCsv([{
                  Fakturováno: financialStats.totalInvoiced, Zaplaceno: financialStats.totalPaid,
                  Po_splatnosti: financialStats.totalOverdue, Pocet_faktur: financialStats.invoiceCount,
                }], `report_finance_${new Date().toISOString().slice(0, 10)}`);
              } else if (activeTab === 'time') {
                downloadCsv(timeStats.byUser.map(u => ({
                  Uživatel: u.name, Minuty: u.minutes, Hodiny: `${Math.floor(u.minutes / 60)}h ${u.minutes % 60}m`,
                })), `report_cas_${new Date().toISOString().slice(0, 10)}`);
              }
            }}
            className="mr-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-white/[0.06]/[0.06] hover:bg-white/[0.06]/[0.07] rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Pipeline projektu</h3>
                <div className="space-y-2">
                  {Object.entries(projectStats.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-400 w-24">{STATUS_LABELS[status] || status}</span>
                      <div className="flex-1 bg-white/[0.06]/[0.07] rounded-full h-6 overflow-hidden">
                        <div className={`h-full rounded-full ${STATUS_COLORS[status] || 'bg-slate-400'} flex items-center px-2 transition-all duration-500`}
                          style={{ width: `${Math.max(8, (count / projectStats.total) * 100)}%` }}>
                          <span className="text-[10px] font-extrabold text-white">{count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Finanční přehled</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/100/15 border border-blue-500/25">
                    <span className="text-sm text-blue-300">Fakturováno</span>
                    <span className="text-sm font-extrabold text-blue-200">{fmt(financialStats.totalInvoiced)} Kč</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/100/15 border border-emerald-500/25">
                    <span className="text-sm text-emerald-300">Zaplaceno</span>
                    <span className="text-sm font-extrabold text-emerald-200">{fmt(financialStats.totalPaid)} Kč</span>
                  </div>
                  {financialStats.totalOverdue > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/100/15 border border-red-500/25">
                      <span className="text-sm text-red-300">Po splatnosti</span>
                      <span className="text-sm font-extrabold text-red-200">{fmt(financialStats.totalOverdue)} Kč</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Rozložení projektů podle stavu</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(projectStats.byStatus).map(([status, count]) => (
                  <div key={status} className="bg-white/[0.06]/[0.04] rounded-xl p-4 border border-white/[0.06]">
                    <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-slate-400'} mb-2`} />
                    <div className="text-2xl font-extrabold text-white">{count}</div>
                    <div className="text-xs text-slate-500">{STATUS_LABELS[status] || status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-500/100/15 rounded-xl p-5 border border-blue-500/25">
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Fakturováno celkem</div>
                  <div className="text-2xl font-extrabold text-blue-200">{fmt(financialStats.totalInvoiced)} Kč</div>
                  <div className="text-xs text-blue-400 mt-1">{financialStats.invoiceCount} faktur</div>
                </div>
                <div className="bg-emerald-500/100/15 rounded-xl p-5 border border-emerald-500/25">
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Zaplaceno</div>
                  <div className="text-2xl font-extrabold text-emerald-200">{fmt(financialStats.totalPaid)} Kč</div>
                  <div className="text-xs text-emerald-400 mt-1">{financialStats.totalInvoiced > 0 ? Math.round((financialStats.totalPaid / financialStats.totalInvoiced) * 100) : 0}% uhrazeno</div>
                </div>
                <div className={`rounded-xl p-5 border ${financialStats.totalOverdue > 0 ? 'bg-red-500/100/15 border-red-500/25' : 'bg-white/[0.06]/[0.04] border-white/[0.06]'}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${financialStats.totalOverdue > 0 ? 'text-red-400' : 'text-slate-500'}`}>Po splatnosti</div>
                  <div className={`text-2xl font-extrabold ${financialStats.totalOverdue > 0 ? 'text-red-200' : 'text-white'}`}>{fmt(financialStats.totalOverdue)} Kč</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'time' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Čas podle uživatele</h3>
                <div className="space-y-2">
                  {timeStats.byUser.map((u) => (
                    <div key={u.name} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-400 w-28 truncate">{u.name}</span>
                      <div className="flex-1 bg-white/[0.06]/[0.07] rounded-full h-5 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500/100 flex items-center px-2" style={{ width: `${(u.minutes / maxBar(timeStats.byUser)) * 100}%` }}>
                          <span className="text-[9px] font-extrabold text-white whitespace-nowrap">{fmtH(u.minutes)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Souhrn</h3>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 rounded-xl bg-white/[0.06]/[0.04]">
                    <span className="text-sm text-slate-400">Celkový čas</span>
                    <span className="text-sm font-bold text-white">{fmtH(timeStats.totalMinutes)}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-white/[0.06]/[0.04]">
                    <span className="text-sm text-slate-400">Fakturovatelný</span>
                    <span className="text-sm font-bold text-emerald-400">{fmtH(timeStats.billableMinutes)}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-white/[0.06]/[0.04]">
                    <span className="text-sm text-slate-400">Nefakturovatelný</span>
                    <span className="text-sm font-bold text-slate-300">{fmtH(timeStats.totalMinutes - timeStats.billableMinutes)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'warehouse' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-blue-500/100/15 rounded-xl p-5 border border-blue-500/25">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Hodnota skladu</div>
                <div className="text-2xl font-extrabold text-blue-200">{fmt(warehouseValue)} Kč</div>
              </div>
              <div className={`rounded-xl p-5 border ${lowStockCount > 0 ? 'bg-amber-500/100/15 border-amber-500/25' : 'bg-emerald-500/100/15 border-emerald-500/25'}`}>
                <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Nízký stav</div>
                <div className={`text-2xl font-extrabold ${lowStockCount > 0 ? 'text-amber-200' : 'text-emerald-200'}`}>{lowStockCount} položek</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/100/15', icon: 'text-blue-400' },
    emerald: { bg: 'bg-emerald-500/100/15', icon: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/100/15', icon: 'text-amber-400' },
    cyan: { bg: 'bg-cyan-500/100/15', icon: 'text-cyan-400' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="text-lg font-extrabold text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}
