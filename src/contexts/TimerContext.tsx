import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const LS_KEY = 'housesmart_timer';

interface TimerState {
  running: boolean;
  paused: boolean;
  startEpoch: number;
  pausedAt: number;
  accumulatedSeconds: number;
  projectId: string;
  description: string;
}

const EMPTY_STATE: TimerState = {
  running: false,
  paused: false,
  startEpoch: 0,
  pausedAt: 0,
  accumulatedSeconds: 0,
  projectId: '',
  description: '',
};

function readLS(): TimerState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function writeLS(state: TimerState | null) {
  if (state && (state.running || state.paused)) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

function computeElapsed(state: TimerState): number {
  if (!state.running && !state.paused) return 0;
  if (state.paused) return state.accumulatedSeconds;
  return state.accumulatedSeconds + Math.floor((Date.now() - state.startEpoch) / 1000);
}

interface TimerCtxValue {
  running: boolean;
  paused: boolean;
  active: boolean;
  elapsed: number;
  projectId: string;
  description: string;
  setProjectId: (id: string) => void;
  setDescription: (desc: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  discard: () => void;
}

const TimerCtx = createContext<TimerCtxValue | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [timerState, setTimerState] = useState<TimerState>(() => {
    const ls = readLS();
    if (ls && (ls.running || ls.paused)) return ls;
    return EMPTY_STATE;
  });

  const [elapsed, setElapsed] = useState(() => {
    const ls = readLS();
    if (ls && (ls.running || ls.paused)) return computeElapsed(ls);
    return 0;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerState.running && !timerState.paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setElapsed(timerState.accumulatedSeconds + Math.floor((Date.now() - timerState.startEpoch) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState.running, timerState.paused, timerState.startEpoch, timerState.accumulatedSeconds]);

  const setState = (next: TimerState) => {
    setTimerState(next);
    writeLS(next);
    setElapsed(computeElapsed(next));
  };

  const start = () => {
    const next: TimerState = {
      ...EMPTY_STATE,
      running: true,
      paused: false,
      startEpoch: Date.now(),
      accumulatedSeconds: 0,
      projectId: timerState.projectId,
      description: timerState.description,
    };
    setState(next);
  };

  const pause = () => {
    if (!timerState.running || timerState.paused) return;
    const acc = timerState.accumulatedSeconds + Math.floor((Date.now() - timerState.startEpoch) / 1000);
    const next: TimerState = {
      ...timerState,
      paused: true,
      pausedAt: Date.now(),
      accumulatedSeconds: acc,
    };
    setState(next);
  };

  const resume = () => {
    if (!timerState.paused) return;
    const next: TimerState = {
      ...timerState,
      paused: false,
      startEpoch: Date.now(),
    };
    setState(next);
  };

  const stop = async () => {
    if ((!timerState.running && !timerState.paused) || !user) return;
    const seconds = computeElapsed(timerState);
    const minutes = Math.max(1, Math.round(seconds / 60));
    const savedState = { ...timerState };

    setState(EMPTY_STATE);

    await supabase.from('time_entries').insert({
      user_id: user.id,
      project_id: savedState.projectId || null,
      date: new Date().toISOString().split('T')[0],
      duration_minutes: minutes,
      description: savedState.description || 'Časovač',
      billable: true,
    });
  };

  const discard = () => {
    setState(EMPTY_STATE);
  };

  const update = (patch: Partial<TimerState>) => {
    const next = { ...timerState, ...patch };
    setTimerState(next);
    writeLS(next);
  };

  return (
    <TimerCtx.Provider
      value={{
        running: timerState.running,
        paused: timerState.paused,
        active: timerState.running || timerState.paused,
        elapsed,
        projectId: timerState.projectId,
        description: timerState.description,
        setProjectId: (id) => update({ projectId: id }),
        setDescription: (desc) => update({ description: desc }),
        start,
        pause,
        resume,
        stop,
        discard,
      }}
    >
      {children}
    </TimerCtx.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerCtx);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
