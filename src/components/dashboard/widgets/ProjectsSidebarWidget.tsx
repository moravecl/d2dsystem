import { Link } from 'react-router-dom';
import {
  Clock, FolderKanban, ArrowRight, Calendar, MapPin,
  FileText, CheckCircle2, AlertCircle, CalendarClock,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import StatusBadge from '../../ui/StatusBadge';
import { computeDueStatus, dueStatusColor, dueStatusLabel } from '../../../types/assets';
import type { DashboardData } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

export default function ProjectsSidebarWidget({ data, editMode }: Props) {
  const { stats, recentProjects, dueAlerts } = data;
  const fmtH = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;
  const hoursTrend = stats.hoursLastMonth > 0 ? ((stats.hoursThisMonth - stats.hoursLastMonth) / stats.hoursLastMonth) * 100 : 0;

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950 rounded-2xl p-1' : ''}`}>
      <div className="lg:col-span-2 glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />Poslední projekty</h2>
          <Link to="/projekty" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group transition-colors">Zobrazit vše<ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></Link>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {recentProjects.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Žádné projekty</p>
            </div>
          ) : recentProjects.map(p => (
            <Link key={p.id} to={`/projekty/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.04] transition-colors group">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{p.project_name || p.client_name}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>{p.client_name}</span>
                  {p.address && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {p.address}</span>}
                  {p.deadline && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> {new Date(p.deadline).toLocaleDateString('cs-CZ')}</span>}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 shrink-0 ml-3">{new Date(p.updated_at).toLocaleDateString('cs-CZ')}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />Čas tento měsíc</h3>
          <div className="text-2xl font-extrabold text-white">{fmtH(stats.hoursThisMonth)}</div>
          {stats.hoursLastMonth > 0 && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${hoursTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {hoursTrend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(Math.round(hoursTrend))}% vs minulý měsíc
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-amber-400" />Nabídky</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white">{stats.pendingQuotes}</div>
                  <div className="text-[10px] text-amber-400 font-medium">Čekající</div>
                </div>
              </div>
            </div>
            <div className="flex items-center p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white">{stats.approvedQuotes}</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Schválené</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {dueAlerts.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2"><CalendarClock className="w-4 h-4 text-amber-400" />Termíny majetku</h3>
              <Link to="/majetek/terminy" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group transition-colors">Vše <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></Link>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {dueAlerts.map(d => {
                const dStatus = computeDueStatus(d);
                return (
                  <Link key={d.id} to={`/majetek/${d.asset_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{d.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{d.asset?.name}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${dueStatusColor(dStatus)}`}>{dueStatusLabel(dStatus)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
