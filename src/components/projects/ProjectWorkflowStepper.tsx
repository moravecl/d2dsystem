import { Check, FileText, FileSignature, HardHat, NotebookPen, ClipboardCheck, Truck, Receipt } from 'lucide-react';
import {
  PROJECT_WORKFLOW_STEPS,
  PROJECT_WORKFLOW_LABELS,
  type ProjectWorkflowStep,
  type ProjectWorkflowStepState,
} from '../../hooks/useProjectWorkflow';

const STEP_ICONS: Record<ProjectWorkflowStep, typeof FileText> = {
  quote: FileText,
  contract: FileSignature,
  execution: HardHat,
  diary: NotebookPen,
  handover: ClipboardCheck,
  delivery: Truck,
  invoice: Receipt,
};

interface Props {
  steps: Record<ProjectWorkflowStep, ProjectWorkflowStepState>;
  completedSteps: Set<ProjectWorkflowStep>;
  nextStep: ProjectWorkflowStep | null;
  onStepClick: (step: ProjectWorkflowStep) => void;
  compact?: boolean;
}

export default function ProjectWorkflowStepper({
  steps, completedSteps, nextStep, onStepClick, compact = false,
}: Props) {
  return (
    <div className={`flex items-center flex-wrap ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {PROJECT_WORKFLOW_STEPS.map((step, index) => {
        const state = steps[step];
        const isCompleted = completedSteps.has(step);
        const isNext = step === nextStep;
        const Icon = STEP_ICONS[step];
        const showCount = typeof state.count === 'number' && state.count > 0 && !compact;

        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => onStepClick(step)}
              title={state.helperText}
              className={`
                flex items-center gap-1.5 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg transition-all
                ${isCompleted
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : isNext
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'}
              `}
            >
              <span className={`
                flex items-center justify-center rounded-full shrink-0
                ${compact ? 'w-4 h-4' : 'w-5 h-5'}
                ${isCompleted ? 'bg-emerald-500/20' : isNext ? 'bg-blue-500/25' : 'bg-white/[0.08]'}
              `}>
                {isCompleted
                  ? <Check className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={3} />
                  : <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
              </span>
              {!compact && (
                <span className="text-xs font-semibold whitespace-nowrap">
                  {PROJECT_WORKFLOW_LABELS[step]}
                  {showCount && <span className="ml-1 text-[10px] opacity-70">({state.count})</span>}
                </span>
              )}
            </button>
            {index < PROJECT_WORKFLOW_STEPS.length - 1 && (
              <div className={`
                h-px ${compact ? 'w-1.5' : 'w-3'}
                ${isCompleted ? 'bg-emerald-500/40' : 'bg-white/[0.10]'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}
