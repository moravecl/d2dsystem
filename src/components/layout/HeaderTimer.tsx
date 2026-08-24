import { useState, useRef, useEffect } from 'react';
import { Play, Square, Trash2, Timer, ChevronDown, Pause } from 'lucide-react';
import { useTimer } from '../../contexts/TimerContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface ProjectRef {
  id: string;
  project_name: string;
}

function fmtTimer(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function HeaderTimer() {
  const { running, paused, active, elapsed, projectId, description, setProjectId, setDescription, start, pause, resume, stop, discard } = useTimer();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, project_name')
      .neq('status', 'cancelled')
      .then(({ data }) => {
        if (data) setProjects(data as ProjectRef[]);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleStop = async () => {
    await stop();
    toast('Čas zaznamenán');
    setOpen(false);
  };

  const handleDiscard = () => {
    discard();
    setOpen(false);
  };

  const buttonColor = running
    ? 'bg-emerald-500/10 border-emerald-200 text-emerald-400 hover:bg-emerald-500/20'
    : paused
    ? 'bg-amber-500/10 border-amber-200 text-amber-400 hover:bg-amber-500/20'
    : 'bg-white/[0.06] border-white/10 text-slate-400 hover:bg-white/[0.04] hover:border-white/[0.12]';

  const iconColor = running
    ? 'text-emerald-500 animate-pulse'
    : paused
    ? 'text-amber-500'
    : 'text-slate-400';

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 h-9 px-3 rounded-xl border transition-all text-xs font-semibold ${buttonColor}`}
      >
        <Timer className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
        {active ? (
          <span className={`font-mono tracking-tight ${paused ? 'text-amber-400' : ''}`}>
            {fmtTimer(elapsed)}
            {paused && <span className="ml-1 text-[10px] font-bold opacity-70">PAUZA</span>}
          </span>
        ) : (
          <span className="hidden sm:inline">Čas</span>
        )}
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${running ? 'text-emerald-500' : paused ? 'text-amber-500' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-xl shadow-slate-200/60 py-3 z-50">
          <div className="px-4 pb-2">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
              Sledování času
            </div>

            {active && (
              <div className={`border rounded-xl px-3 py-2.5 mb-3 ${paused ? 'bg-amber-500/10 border-amber-200' : 'bg-emerald-500/10 border-emerald-200'}`}>
                <div className={`text-2xl font-mono font-extrabold text-center tracking-tight ${paused ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {fmtTimer(elapsed)}
                </div>
                {paused && (
                  <div className="text-center text-xs font-semibold text-amber-400 mt-0.5">
                    Časovač pozastaven
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Popis práce..."
                className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-200 bg-white/[0.06]"
              />
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-200 bg-white/[0.06] text-slate-300"
              >
                <option value="">Bez projektu</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 px-4 pt-2 border-t border-white/[0.06] mt-1">
            {active ? (
              <>
                {paused ? (
                  <button
                    onClick={resume}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Pokračovat
                  </button>
                ) : (
                  <button
                    onClick={pause}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pauza
                  </button>
                )}
                <button
                  onClick={handleStop}
                  title="Uložit a ukončit"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition"
                >
                  <Square className="w-3.5 h-3.5" />
                  Uložit
                </button>
                <button
                  onClick={handleDiscard}
                  title="Zahodit"
                  className="w-9 flex items-center justify-center py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => { start(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
              >
                <Play className="w-3.5 h-3.5" />
                Spustit časovač
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
