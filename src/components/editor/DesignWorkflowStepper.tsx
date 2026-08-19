import { Check, AlertCircle, ClipboardList, FileText, Layers, Package } from 'lucide-react';

export type WorkflowStep = 'design' | 'assign' | 'summary' | 'quote';

interface StepConfig {
  id: WorkflowStep;
  label: string;
  description: string;
  icon: typeof Layers;
}

const STEPS: StepConfig[] = [
  { id: 'design', label: 'Návrh', description: 'Rozmístění značek', icon: Layers },
  { id: 'assign', label: 'Přiřazení', description: 'Výběr produktů', icon: Package },
  { id: 'summary', label: 'Souhrn', description: 'Kontrola a prezentace', icon: ClipboardList },
  { id: 'quote', label: 'Nabídka', description: 'Cenová kalkulace', icon: FileText },
];

interface Props {
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
  completedSteps: Set<WorkflowStep>;
  unassignedCount?: number;
  warningCount?: number;
  canProceed: Record<WorkflowStep, boolean>;
  compact?: boolean;
}

export default function DesignWorkflowStepper({
  currentStep,
  onStepClick,
  completedSteps,
  unassignedCount = 0,
  warningCount = 0,
  canProceed,
  compact = false,
}: Props) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isPast = index < currentIndex;
        const canClick = canProceed[step.id] || isCompleted || isPast;
        const showUnassigned = step.id === 'assign' && unassignedCount > 0 && !isCompleted;
        const showWarning = step.id === 'summary' && warningCount > 0 && !isCompleted;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => canClick && onStepClick(step.id)}
              disabled={!canClick}
              title={step.description}
              className={`
                flex items-center gap-1.5 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg transition-all
                ${isActive
                  ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
                  : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : canClick
                      ? 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-300'
                      : 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                }
              `}
            >
              <span className={`
                ${compact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full flex items-center justify-center text-[10px] font-bold
                ${isActive
                  ? 'bg-blue-500 text-white'
                  : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 text-slate-500'
                }
              `}>
                {isCompleted ? (
                  <Check className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                ) : (
                  <Icon className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                )}
              </span>
              <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium`}>{step.label}</span>
              {showUnassigned && (
                <span className={`flex items-center gap-0.5 ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'} rounded-full bg-amber-500/20 text-amber-400 font-semibold`}>
                  <AlertCircle className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                  {unassignedCount}
                </span>
              )}
              {showWarning && (
                <span className={`flex items-center gap-0.5 ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'} rounded-full bg-amber-500/20 text-amber-400 font-semibold`}>
                  <AlertCircle className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                  {warningCount}
                </span>
              )}
            </button>
            {index < STEPS.length - 1 && (
              <div className={`${compact ? 'w-4' : 'w-6'} h-px mx-0.5 ${
                isPast || isCompleted ? 'bg-emerald-500/40' : 'bg-white/10'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
