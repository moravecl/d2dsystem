import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

const LS_KEY = 'housesmart_active_meeting';

interface ActiveMeetingState {
  meetingId: string;
  meetingTitle: string;
  startedAt: number;
}

interface ActiveMeetingCtxValue {
  active: boolean;
  meetingId: string;
  meetingTitle: string;
  elapsed: number;
  startMeeting: (id: string, title: string) => void;
  stopMeeting: () => void;
}

const ActiveMeetingCtx = createContext<ActiveMeetingCtxValue | undefined>(undefined);

function readLS(): ActiveMeetingState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveMeetingState;
  } catch {
    return null;
  }
}

function writeLS(state: ActiveMeetingState | null) {
  if (state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

export function ActiveMeetingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActiveMeetingState | null>(() => readLS());
  const [elapsed, setElapsed] = useState(() => {
    const s = readLS();
    return s ? Math.floor((Date.now() - s.startedAt) / 1000) : 0;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - state.startedAt) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const startMeeting = useCallback((id: string, title: string) => {
    const next: ActiveMeetingState = { meetingId: id, meetingTitle: title, startedAt: Date.now() };
    setState(next);
    writeLS(next);
  }, []);

  const stopMeeting = useCallback(() => {
    setState(null);
    writeLS(null);
  }, []);

  return (
    <ActiveMeetingCtx.Provider
      value={{
        active: !!state,
        meetingId: state?.meetingId || '',
        meetingTitle: state?.meetingTitle || '',
        elapsed,
        startMeeting,
        stopMeeting,
      }}
    >
      {children}
    </ActiveMeetingCtx.Provider>
  );
}

export function useActiveMeeting() {
  const ctx = useContext(ActiveMeetingCtx);
  if (!ctx) throw new Error('useActiveMeeting must be used within ActiveMeetingProvider');
  return ctx;
}
