import { Play, Pause, CheckCircle2, Zap, RotateCcw } from 'lucide-react';

interface Job {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Props {
  job: Job;
  onStatusChange: (status: string) => void;
  runningTimerElapsed: number | null;
  runningTimerActivity: string | null;
}

const STATUS_THEMES: Record<string, {
  label: string;
  gradient: string;
  textColor: string;
  btnClass: string;
  accentDot: string;
}> = {
  ready: {
    label: 'Pripraveno',
    gradient: 'from-slate-700/60 to-slate-800/60 border-white/10',
    textColor: 'text-slate-300',
    btnClass: '',
    accentDot: 'bg-slate-400',
  },
  in_progress: {
    label: 'Probiha',
    gradient: 'from-teal-900/40 via-emerald-900/30 to-cyan-900/30 border-teal-500/25',
    textColor: 'text-teal-300',
    btnClass: '',
    accentDot: 'bg-emerald-500',
  },
  paused: {
    label: 'Pozastaveno',
    gradient: 'from-amber-900/30 via-yellow-900/20 to-orange-900/20 border-amber-500/25',
    textColor: 'text-amber-300',
    btnClass: '',
    accentDot: 'bg-amber-500',
  },
  completed: {
    label: 'Dokonceno',
    gradient: 'from-slate-800 to-slate-900 border-slate-700',
    textColor: 'text-white',
    btnClass: '',
    accentDot: 'bg-slate-400',
  },
};

function formatTimerElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function ExecutionHeroBanner({ job, onStatusChange, runningTimerElapsed, runningTimerActivity }: Props) {
  const theme = STATUS_THEMES[job.status] || STATUS_THEMES.ready;

  const daysFromStart = job.started_at
    ? Math.max(1, Math.ceil((Date.now() - new Date(job.started_at).getTime()) / 86400000))
    : null;

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-r ${theme.gradient} overflow-hidden`}>
      {job.status === 'in_progress' && (
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
            backgroundSize: '24px 24px',
          }} />
        </div>
      )}

      <div className="relative px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${theme.accentDot} ${job.status === 'in_progress' ? 'animate-pulse-dot' : ''}`} />
          <div>
            <div className="flex items-center gap-3">
              <h2 className={`text-lg sm:text-xl font-extrabold ${theme.textColor}`}>
                {theme.label}
              </h2>
              {daysFromStart && job.status !== 'completed' && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  'bg-white/[0.08] text-slate-300'
                }`}>
                  {daysFromStart}. den
                </span>
              )}
            </div>
            {job.started_at && (
              <p className="text-xs mt-0.5 text-slate-500">
                Zahajeno {new Date(job.started_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                {job.completed_at && ` \u2022 Dokonceno ${new Date(job.completed_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {runningTimerElapsed !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500 text-white animate-timer-glow">
              <div className="w-2 h-2 rounded-full bg-white/[0.06] animate-pulse-dot" />
              <span className="text-xs font-bold tabular-nums">{formatTimerElapsed(runningTimerElapsed)}</span>
              {runningTimerActivity && (
                <span className="text-xs text-red-100 hidden sm:inline">{runningTimerActivity}</span>
              )}
            </div>
          )}

          {job.status === 'ready' && (
            <button
              onClick={() => onStatusChange('in_progress')}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-extrabold hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95"
            >
              <Play className="w-4 h-4" /> Zahajit
            </button>
          )}
          {job.status === 'in_progress' && (
            <>
              <button
                onClick={() => onStatusChange('paused')}
                className="flex items-center gap-2 bg-white/[0.06] border border-amber-300 text-amber-400 px-4 py-2.5 rounded-xl text-sm font-extrabold hover:bg-amber-500/10 transition-all active:scale-95"
              >
                <Pause className="w-4 h-4" /> Pozastavit
              </button>
              <button
                onClick={() => onStatusChange('completed')}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-extrabold hover:bg-slate-900 transition-all hover:shadow-lg active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" /> Ukoncit
              </button>
            </>
          )}
          {job.status === 'paused' && (
            <button
              onClick={() => onStatusChange('in_progress')}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-extrabold hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95"
            >
              <Zap className="w-4 h-4" /> Pokracovat
            </button>
          )}
          {job.status === 'completed' && (
            <button
              onClick={() => {
                if (confirm('Opravdu chcete vrátit zakázku zpět do stavu "Probíhá"?')) {
                  onStatusChange('in_progress');
                }
              }}
              className="flex items-center gap-2 bg-white/[0.06] border border-slate-300 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-extrabold hover:bg-white/[0.06] hover:border-slate-400 transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> Vrátit do probíhá
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
