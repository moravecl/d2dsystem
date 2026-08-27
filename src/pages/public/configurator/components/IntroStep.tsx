import { Home, CheckCircle2, ArrowRight } from 'lucide-react';

interface IntroStepProps {
  onNext: () => void;
}

export default function IntroStep({ onNext }: IntroStepProps) {
  return (
    <div className="text-center py-12 animate-in">
      <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
        <Home size={48} className="text-blue-600" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
        Plánujete technologie do nového domu?
      </h1>
      <p className="text-lg text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
        Vyplňte náš jednoduchý konfigurátor a získejte okamžitou orientační cenovou nabídku na topení,
        fotovoltaiku, rekuperaci a smart home.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left mb-10">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <CheckCircle2 size={24} className="text-green-500 mb-2" />
          <strong className="block mb-1">Vše na jednom místě</strong>
          <p className="text-sm text-slate-500">Koordinace všech technologií.</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <CheckCircle2 size={24} className="text-green-500 mb-2" />
          <strong className="block mb-1">Okamžitý odhad</strong>
          <p className="text-sm text-slate-500">Žádné čekání na nacenění.</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <CheckCircle2 size={24} className="text-green-500 mb-2" />
          <strong className="block mb-1">Záruka funkčnosti</strong>
          <p className="text-sm text-slate-500">Garantujeme, že to bude fungovat spolu.</p>
        </div>
      </div>
      <button
        onClick={onNext}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-full text-lg shadow-lg hover:shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
      >
        Začít konfiguraci <ArrowRight size={20} />
      </button>
    </div>
  );
}
