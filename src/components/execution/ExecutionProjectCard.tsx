import {
  ArrowRight,
  Clock,
  Banknote,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Calendar,
  Timer,
  Wrench,
} from 'lucide-react';
import type { ExecutionProject } from '../../hooks/useExecutionProjects';

interface Props {
  project: ExecutionProject;
  index: number;
  onClick: () => void;
}

const jobStatusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ready: { label: 'Připraveno', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  in_progress: { label: 'Probíhá', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/25' },
  paused: { label: 'Pozastaveno', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25' },
  completed: { label: 'Dokončeno', color: 'text-green-400', bg: 'bg-emerald-500/10', border: 'border-green-500/25' },
};

function formatHours(minutes: number): string {
  if (minutes === 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCurrency(amount: number): string {
  if (amount === 0) return '0 Kc';
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M Kc`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k Kc`;
  return `${Math.round(amount)} Kc`;
}

function getDeadlineStatus(deadline: string | null): 'ok' | 'warning' | 'overdue' | null {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'overdue';
  if (days < 7) return 'warning';
  return 'ok';
}

function getLeftBorderColor(jobStatus: string | null): string {
  if (!jobStatus) return 'border-l-slate-300';
  switch (jobStatus) {
    case 'ready': return 'border-l-amber-400';
    case 'in_progress': return 'border-l-teal-500';
    case 'paused': return 'border-l-orange-400';
    case 'completed': return 'border-l-green-500';
    default: return 'border-l-slate-300';
  }
}

export default function ExecutionProjectCard({ project, index, onClick }: Props) {
  const deadlineStatus = getDeadlineStatus(project.deadline);
  const taskProgress = project.total_tasks > 0
    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
    : null;
  const jobCfg = project.job_status ? jobStatusConfig[project.job_status] : null;
  const leftBorder = getLeftBorderColor(project.job_status);
  const initials = project.responsible_name
    ? project.responsible_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const daysRunning = project.execution_started_at
    ? Math.floor((Date.now() - new Date(project.execution_started_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <button
      onClick={onClick}
      className={`relative bg-navy-800/60 rounded-xl border border-white/[0.08] border-l-4 ${leftBorder} text-left hover:shadow-xl hover:shadow-black/30 hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300 group overflow-hidden card-gradient`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {project.active_timers > 0 && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/25 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
          <span className="text-[10px] font-semibold text-red-400">LIVE</span>
        </div>
      )}

      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors truncate">
              {project.project_name}
            </h3>
            {project.client_name && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">{project.client_name}</p>
            )}
          </div>
          {!project.active_timers && (
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0 mt-1" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          {jobCfg && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${jobCfg.bg} ${jobCfg.color} ${jobCfg.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${jobCfg.color.replace('text-', 'bg-').replace('700', '500')}`} />
              {jobCfg.label}
            </span>
          )}
          {daysRunning !== null && daysRunning > 0 && (
            <span className="text-[11px] text-slate-400 font-medium">
              {daysRunning}. den
            </span>
          )}
          {project.pending_extras > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <Wrench className="w-3 h-3" />
              {project.pending_extras} vícepráce
            </span>
          )}
        </div>

        {taskProgress !== null && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-500">Postup ukolu</span>
              <span className="text-[11px] font-bold text-slate-300">{taskProgress}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${taskProgress}%`,
                  background: taskProgress === 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #14b8a6, #0d9488)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricItem
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Čas"
          value={formatHours(project.total_work_minutes)}
          color="text-blue-400"
        />
        <MetricItem
          icon={<Banknote className="w-3.5 h-3.5" />}
          label="Rozpočet"
          value={formatCurrency(project.approved_budget)}
          color="text-emerald-400"
        />
        <MetricItem
          icon={<BookOpen className="w-3.5 h-3.5" />}
          label="Deník"
          value={`${project.diary_entries}`}
          color="text-slate-400"
        />
        {project.open_defects > 0 ? (
          <MetricItem
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="Vady"
            value={`${project.open_defects}`}
            color="text-red-400"
            highlight
          />
        ) : project.total_tasks > 0 ? (
          <MetricItem
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Úkoly"
            value={`${project.completed_tasks}/${project.total_tasks}`}
            color="text-teal-600"
          />
        ) : (
          <MetricItem
            icon={<Timer className="w-3.5 h-3.5" />}
            label="Materiál"
            value={formatCurrency(project.actual_material_cost)}
            color="text-slate-400"
          />
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-50 bg-white/[0.04] flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        {project.address && (
          <span className="flex items-center gap-1 truncate max-w-[180px]">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{project.address}</span>
          </span>
        )}
        {project.deadline && (
          <span className={`flex items-center gap-1 ${
            deadlineStatus === 'overdue' ? 'text-red-500 font-semibold' :
            deadlineStatus === 'warning' ? 'text-amber-500 font-semibold' : ''
          }`}>
            <Calendar className="w-3 h-3" />
            {new Date(project.deadline).toLocaleDateString('cs-CZ')}
          </span>
        )}
        {initials && (
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-[9px] font-bold text-white ">
              {initials}
            </span>
            <span className="text-slate-500 font-medium hidden sm:inline">{project.responsible_name.split(' ')[0]}</span>
          </span>
        )}
      </div>
    </button>
  );
}

function MetricItem({ icon, label, value, color, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${highlight ? 'animate-pulse-dot' : ''}`}>
      <span className={color}>{icon}</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
