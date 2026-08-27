import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

interface NavigationProps {
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  isSubmitting: boolean;
  isLastStep: boolean;
}

export default function Navigation({ onBack, onNext, canProceed, isSubmitting, isLastStep }: NavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-30">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 sm:px-6 sm:py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Zpět</span>
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed || isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 sm:px-8 sm:py-3 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Odesílám...
            </>
          ) : (
            <>
              {isLastStep ? 'Odeslat poptávku' : 'Pokračovat'}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
