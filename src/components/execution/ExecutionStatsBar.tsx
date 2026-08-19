import { HardHat, Clock, Banknote, AlertTriangle } from 'lucide-react';
import type { ExecutionProject } from '../../hooks/useExecutionProjects';

interface Props {
  projects: ExecutionProject[];
}

export default function ExecutionStatsBar({ projects }: Props) {
  const totalProjects = projects.length;
  const totalHours = Math.round(projects.reduce((sum, p) => sum + p.total_work_minutes, 0) / 60);
  const totalBudget = projects.reduce((sum, p) => sum + p.approved_budget, 0);
  const openDefects = projects.reduce((sum, p) => sum + p.open_defects, 0);
  const activeTimers = projects.reduce((sum, p) => sum + p.active_timers, 0);

  const stats = [
    {
      icon: <HardHat className="w-5 h-5" />,
      label: 'Aktivnich zakazek',
      value: totalProjects.toString(),
      sub: activeTimers > 0 ? `${activeTimers} bezici timer${activeTimers > 1 ? 'y' : ''}` : undefined,
      color: 'from-teal-500 to-teal-600',
      textColor: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/20',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: 'Celkem hodin',
      value: `${totalHours}h`,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      icon: <Banknote className="w-5 h-5" />,
      label: 'Celkovy rozpocet',
      value: totalBudget >= 1000000
        ? `${(totalBudget / 1000000).toFixed(1)}M Kc`
        : totalBudget >= 1000
          ? `${Math.round(totalBudget / 1000)}k Kc`
          : `${Math.round(totalBudget)} Kc`,
      color: 'from-emerald-500 to-emerald-600',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: 'Otevrenych vad',
      value: openDefects.toString(),
      color: openDefects > 0 ? 'from-red-500 to-red-600' : 'from-slate-400 to-slate-500',
      textColor: openDefects > 0 ? 'text-red-400' : 'text-slate-400',
      bgColor: openDefects > 0 ? 'bg-red-500/10' : 'bg-white/[0.04]',
      borderColor: openDefects > 0 ? 'border-red-500/20' : 'border-white/[0.06]',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, idx) => (
        <div
          key={stat.label}
          className={`relative overflow-hidden bg-gradient-to-br ${stat.color} rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 group animate-count-up`}
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div className="absolute inset-0 bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />
          <svg className="absolute bottom-0 left-0 right-0 h-[55%] opacity-[0.15] pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
            <path d="M0,160L48,138.7C96,117,192,75,288,74.7C384,75,480,117,528,138.7L576,160L576,160L0,160Z" fill="white" />
          </svg>
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/[0.08] rounded-full blur-2xl translate-x-1/3 translate-y-1/3" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg shadow-black/10">
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{stat.value}</p>
              <p className="text-[11px] text-white/70 font-medium">{stat.label}</p>
            </div>
          </div>
          {stat.sub && (
            <div className="relative mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot" />
              <span className="text-[11px] font-medium text-white/80">{stat.sub}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
