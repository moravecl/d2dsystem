import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import type { WorkflowStep } from './DesignWorkflowStepper';

interface Props {
  completedSteps: Set<WorkflowStep>;
  unassignedCount: number;
  hasDesignContent: boolean;
  compact?: boolean;
}

const TOTAL_STEPS = 4;

export default function WorkflowProgressBadge({
  completedSteps,
  unassignedCount,
  hasDesignContent,
  compact = false,
}: Props) {
  const completedCount = completedSteps.size;
  const progressPercent = Math.round((completedCount / TOTAL_STEPS) * 100);

  const isComplete = completedCount === TOTAL_STEPS;
  const hasWarnings = unassignedCount > 0;
  const isInProgress = hasDesignContent && !isComplete;

  let status: 'complete' | 'warning' | 'in_progress' | 'not_started' = 'not_started';
  if (isComplete) {
    status = 'complete';
  } else if (hasWarnings && hasDesignContent) {
    status = 'warning';
  } else if (isInProgress) {
    status = 'in_progress';
  }

  const colors = {
    complete: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      icon: CheckCircle,
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: AlertCircle,
    },
    in_progress: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: Loader2,
    },
    not_started: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      text: 'text-slate-400',
      icon: Clock,
    },
  };

  const { bg, border, text, icon: Icon } = colors[status];

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${bg} border ${border}`}>
        <Icon className={`w-3.5 h-3.5 ${text} ${status === 'in_progress' ? 'animate-spin' : ''}`} />
        <span className={`text-xs font-bold ${text}`}>
          {completedCount}/{TOTAL_STEPS}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${bg} border ${border}`}>
      <div className="relative">
        <Icon className={`w-5 h-5 ${text} ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold ${text}`}>
            {status === 'complete' ? 'Kompletni' :
             status === 'warning' ? `${unassignedCount} neprirazeno` :
             status === 'in_progress' ? 'Rozpracovano' : 'Nezahajeno'}
          </span>
          <span className="text-xs text-slate-500">
            {progressPercent}%
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'complete' ? 'bg-emerald-500' :
              status === 'warning' ? 'bg-amber-500' :
              status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
