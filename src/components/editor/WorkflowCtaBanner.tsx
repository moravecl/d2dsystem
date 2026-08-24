import { ArrowRight, AlertTriangle, CheckCircle, Info, Layers, Package, ClipboardList, FileText, Users, MapPin } from 'lucide-react';
import type { WorkflowStep } from './DesignWorkflowStepper';
import type { WorkflowStepStatus } from '../../hooks/useDesignWorkflow';

export interface WorkflowContextStats {
  totalElements?: number;
  elementsWithoutRoom?: number;
  elementsInGroup?: number;
  elementsOutsideGroup?: number;
  unassignedCount?: number;
  assignedCount?: number;
  inheritedCount?: number;
  directCount?: number;
  warningCount?: number;
  fallbackCount?: number;
  quotesCount?: number;
  mountingGroupWarnings?: number;
}

interface Props {
  nextRecommendedStep: WorkflowStep | null;
  stepStatuses: Record<WorkflowStep, WorkflowStepStatus>;
  onNavigateToStep: (step: WorkflowStep) => void;
  variant?: 'compact' | 'full';
  currentStep?: WorkflowStep;
  contextStats?: WorkflowContextStats;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const STEP_ICONS: Record<WorkflowStep, typeof Layers> = {
  design: Layers,
  assign: Package,
  summary: ClipboardList,
  quote: FileText,
};

const STEP_LABELS: Record<WorkflowStep, string> = {
  design: 'Navrh',
  assign: 'Prirazeni',
  summary: 'Souhrn',
  quote: 'Nabidka',
};

function ContextStatBadge({ icon: Icon, value, label, color }: { icon: typeof Layers; value: number; label: string; color: 'blue' | 'amber' | 'emerald' | 'slate' | 'teal' }) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${colorClasses[color]}`}>
      <Icon className="w-3 h-3" />
      <span className="text-xs font-bold">{value}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  );
}

function DesignStepContext({ stats }: { stats: WorkflowContextStats }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {stats.totalElements !== undefined && stats.totalElements > 0 && (
        <ContextStatBadge icon={Layers} value={stats.totalElements} label="prvku" color="blue" />
      )}
      {stats.elementsWithoutRoom !== undefined && stats.elementsWithoutRoom > 0 && (
        <ContextStatBadge icon={MapPin} value={stats.elementsWithoutRoom} label="bez místnosti" color="amber" />
      )}
      {stats.elementsInGroup !== undefined && stats.elementsInGroup > 0 && (
        <ContextStatBadge icon={Users} value={stats.elementsInGroup} label="ve vícerámečku" color="teal" />
      )}
      {stats.unassignedCount !== undefined && stats.unassignedCount > 0 && (
        <ContextStatBadge icon={AlertTriangle} value={stats.unassignedCount} label="bez přiřazení" color="amber" />
      )}
    </div>
  );
}

function AssignStepContext({ stats }: { stats: WorkflowContextStats }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {stats.assignedCount !== undefined && (
        <ContextStatBadge icon={CheckCircle} value={stats.assignedCount} label="přiřazeno" color="emerald" />
      )}
      {stats.inheritedCount !== undefined && stats.inheritedCount > 0 && (
        <ContextStatBadge icon={Package} value={stats.inheritedCount} label="zděděno" color="blue" />
      )}
      {stats.unassignedCount !== undefined && stats.unassignedCount > 0 && (
        <ContextStatBadge icon={AlertTriangle} value={stats.unassignedCount} label="nepřiřazeno" color="amber" />
      )}
      {stats.warningCount !== undefined && stats.warningCount > 0 && (
        <ContextStatBadge icon={AlertTriangle} value={stats.warningCount} label="varování" color="amber" />
      )}
    </div>
  );
}

function SummaryStepContext({ stats }: { stats: WorkflowContextStats }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {stats.warningCount !== undefined && stats.warningCount > 0 && (
        <ContextStatBadge icon={AlertTriangle} value={stats.warningCount} label="varování" color="amber" />
      )}
      {stats.fallbackCount !== undefined && stats.fallbackCount > 0 && (
        <ContextStatBadge icon={Info} value={stats.fallbackCount} label="fallback" color="slate" />
      )}
      {stats.mountingGroupWarnings !== undefined && stats.mountingGroupWarnings > 0 && (
        <ContextStatBadge icon={Layers} value={stats.mountingGroupWarnings} label="viceram. varování" color="amber" />
      )}
    </div>
  );
}

function QuoteStepContext({ stats }: { stats: WorkflowContextStats }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {stats.quotesCount !== undefined && stats.quotesCount > 0 && (
        <ContextStatBadge icon={FileText} value={stats.quotesCount} label={stats.quotesCount === 1 ? 'nabidka' : stats.quotesCount < 5 ? 'nabidky' : 'nabidek'} color="emerald" />
      )}
      {stats.warningCount !== undefined && stats.warningCount > 0 && (
        <ContextStatBadge icon={AlertTriangle} value={stats.warningCount} label="neřešeno" color="amber" />
      )}
    </div>
  );
}

export default function WorkflowCtaBanner({
  nextRecommendedStep,
  stepStatuses,
  onNavigateToStep,
  variant = 'full',
  currentStep,
  contextStats,
  secondaryAction,
}: Props) {
  if (!nextRecommendedStep) {
    return (
      <div className={`flex items-center gap-3 ${variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'} rounded-xl bg-emerald-500/10 border border-emerald-500/20`}>
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className={`${variant === 'compact' ? 'text-xs' : 'text-sm'} font-medium text-emerald-300`}>
          Workflow dokončen - všechny kroky jsou kompletní
        </span>
      </div>
    );
  }

  const status = stepStatuses[nextRecommendedStep];
  const Icon = STEP_ICONS[nextRecommendedStep];
  const label = STEP_LABELS[nextRecommendedStep];

  const hasWarnings = status.warningCount > 0 || status.missingCount > 0;
  const bgColor = hasWarnings ? 'bg-amber-500/10' : 'bg-blue-500/10';
  const borderColor = hasWarnings ? 'border-amber-500/20' : 'border-blue-500/20';
  const iconColor = hasWarnings ? 'text-amber-400' : 'text-blue-400';
  const textColor = hasWarnings ? 'text-amber-300' : 'text-blue-300';
  const IndicatorIcon = hasWarnings ? AlertTriangle : Info;

  if (variant === 'compact') {
    return (
      <button
        onClick={() => onNavigateToStep(nextRecommendedStep)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${bgColor} ${borderColor} border hover:bg-opacity-20 transition group`}
      >
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className={`text-xs font-medium ${textColor}`}>
          {status.ctaLabel}
        </span>
        {status.missingCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
            {status.missingCount}
          </span>
        )}
        <ArrowRight className={`w-3 h-3 ${textColor} group-hover:translate-x-0.5 transition-transform`} />
      </button>
    );
  }

  const renderContextStats = () => {
    if (!contextStats || !currentStep) return null;

    switch (currentStep) {
      case 'design':
        return <DesignStepContext stats={contextStats} />;
      case 'assign':
        return <AssignStepContext stats={contextStats} />;
      case 'summary':
        return <SummaryStepContext stats={contextStats} />;
      case 'quote':
        return <QuoteStepContext stats={contextStats} />;
      default:
        return null;
    }
  };

  return (
    <div className={`rounded-xl ${bgColor} ${borderColor} border overflow-hidden`}>
      <div className="flex items-start gap-4 px-4 py-3">
        <div className={`p-2.5 rounded-xl bg-white/10 shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${textColor}`}>
              Doporučený další krok: {label}
            </span>
            {status.missingCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                <IndicatorIcon className="w-3 h-3" />
                {status.missingCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {status.helperText}
          </p>
          {renderContextStats()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/[0.06] transition text-sm font-medium text-slate-300"
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            onClick={() => onNavigateToStep(nextRecommendedStep)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-sm font-medium text-white"
          >
            {status.ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
