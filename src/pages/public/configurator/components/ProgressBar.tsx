interface ProgressBarProps {
  current: number;
  total: number;
  steps: { title: string }[];
  onStepClick?: (stepIndex: number) => void;
}

export default function ProgressBar({ current, total, steps, onStepClick }: ProgressBarProps) {
  const wizardSteps = steps.slice(1, -1);
  const wizardIndex = current - 1;
  const progress = (current / (total - 1)) * 100;

  return (
    <div className="mb-8">
      <div className="hidden md:flex items-center justify-between mb-3 px-2">
        {wizardSteps.map((step, idx) => {
          const isClickable = onStepClick && idx < wizardIndex;
          const isCurrent = idx === wizardIndex;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => isClickable && onStepClick(idx + 1)}
              disabled={!isClickable}
              className={`flex flex-col items-center group ${
                isClickable ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-default'
              }`}
              style={{ flex: 1 }}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  idx < wizardIndex
                    ? 'bg-blue-600 group-hover:scale-150 group-hover:ring-4 group-hover:ring-blue-100'
                    : isCurrent
                    ? 'bg-blue-600 scale-150 ring-4 ring-blue-100'
                    : 'bg-slate-300'
                }`}
              />
              <span
                className={`text-[10px] mt-1.5 font-medium text-center leading-tight transition-colors duration-300 ${
                  idx < wizardIndex
                    ? 'text-blue-700 group-hover:text-blue-900 group-hover:font-bold'
                    : isCurrent
                    ? 'text-blue-700'
                    : 'text-slate-400'
                }`}
              >
                {step.title}
              </span>
            </button>
          );
        })}
      </div>
      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
