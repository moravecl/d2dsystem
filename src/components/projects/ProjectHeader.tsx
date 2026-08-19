import {
  MapPin, Calendar, UserCircle, Clock, ChevronRight,
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { getTypeSoftClass } from '../ui/ProjectTypeSelect';

interface ProjectTypeRow {
  id: string;
  name: string;
  color: string;
}

interface ProjectData {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  status: string;
  address: string;
  description: string;
  deadline: string | null;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const pipelineSteps = [
  { key: 'lead', label: 'Lead' },
  { key: 'design', label: 'Návrh' },
  { key: 'quote', label: 'Nabídka' },
  { key: 'approval', label: 'Schválení' },
  { key: 'in_progress', label: 'Realizace' },
  { key: 'completed', label: 'Dokončeno' },
];

const statusColors: Record<string, { gradient: string; dot: string }> = {
  lead: { gradient: 'from-slate-500 to-slate-600', dot: 'bg-slate-400' },
  design: { gradient: 'from-sky-500 to-sky-600', dot: 'bg-sky-400' },
  quote: { gradient: 'from-cyan-500 to-cyan-600', dot: 'bg-cyan-400' },
  approval: { gradient: 'from-amber-500 to-amber-600', dot: 'bg-amber-400' },
  in_progress: { gradient: 'from-emerald-500 to-emerald-600', dot: 'bg-emerald-400' },
  completed: { gradient: 'from-green-500 to-green-600', dot: 'bg-green-400' },
  cancelled: { gradient: 'from-red-500 to-red-600', dot: 'bg-red-400' },
};

interface Props {
  project: ProjectData;
  responsibleName: string;
  assignedTypes?: ProjectTypeRow[];
  onStatusClick: () => void;
  onClientClick: () => void;
}

export default function ProjectHeader({ project, responsibleName, assignedTypes = [], onStatusClick, onClientClick }: Props) {
  const colors = statusColors[project.status] || statusColors.lead;
  const currentStepIndex = pipelineSteps.findIndex(s => s.key === project.status);
  const isCancelled = project.status === 'cancelled';

  const daysUntilDeadline = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy-800/60 backdrop-blur-sm border border-white/[0.08] shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${colors.gradient}`} />

      <div className="p-6 pt-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3 mb-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight truncate">
                {project.project_name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={project.status} onClick={onStatusClick} />
                {assignedTypes.map(t => (
                  <span key={t.id} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${getTypeSoftClass(t.color)}`}>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {project.client_name && (
                <button
                  onClick={onClientClick}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors group"
                >
                  <UserCircle className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  <span>{project.client_name}</span>
                </button>
              )}
              {project.address && (
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  {project.address}
                </span>
              )}
              {project.deadline && (
                <span className={`flex items-center gap-1.5 text-sm ${
                  daysUntilDeadline !== null && daysUntilDeadline < 0
                    ? 'text-red-400'
                    : daysUntilDeadline !== null && daysUntilDeadline <= 7
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}>
                  <Calendar className="w-4 h-4" />
                  {new Date(project.deadline).toLocaleDateString('cs-CZ')}
                  {daysUntilDeadline !== null && (
                    <span className="text-xs opacity-75">
                      ({daysUntilDeadline < 0 ? `${Math.abs(daysUntilDeadline)}d po termínu` : `za ${daysUntilDeadline}d`})
                    </span>
                  )}
                </span>
              )}
              {responsibleName && (
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Clock className="w-4 h-4 text-slate-500" />
                  {responsibleName}
                </span>
              )}
            </div>
          </div>
        </div>

        {!isCancelled && (
          <div className="mt-5 pt-5 border-t border-white/[0.08]">
            <div className="flex items-center gap-1">
              {pipelineSteps.map((step, i) => {
                const isActive = step.key === project.status;
                const isPast = i < currentStepIndex;
                const isFuture = i > currentStepIndex;

                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <div className="flex items-center w-full">
                        <div
                          className={`w-full h-1.5 rounded-full transition-all duration-500 ${
                            isPast
                              ? `bg-gradient-to-r ${colors.gradient} opacity-80`
                              : isActive
                              ? `bg-gradient-to-r ${colors.gradient}`
                              : 'bg-white/[0.08]'
                          }`}
                        />
                      </div>
                      <span className={`mt-2 text-[11px] font-medium truncate max-w-full px-1 transition-colors ${
                        isActive
                          ? 'text-white'
                          : isPast
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {i < pipelineSteps.length - 1 && (
                      <ChevronRight className={`w-3 h-3 shrink-0 mx-0.5 mb-5 ${
                        isPast ? 'text-slate-500' : isFuture ? 'text-slate-600' : 'text-slate-500'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
