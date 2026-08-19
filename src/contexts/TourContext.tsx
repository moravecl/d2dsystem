import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

export interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  action?: string;
}

export interface Tour {
  id: string;
  steps: TourStep[];
}

interface TourState {
  activeTour: Tour | null;
  currentStepIndex: number;
  toursEnabled: boolean;
  isRunning: boolean;
  startTour: (tour: Tour) => void;
  stopTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  isTourCompleted: (tourId: string) => boolean;
  resetTour: (tourId: string) => Promise<void>;
  loading: boolean;
}

const TourContext = createContext<TourState | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [toursEnabled, setToursEnabled] = useState(true);
  const [completedTours, setCompletedTours] = useState<Record<string, { finished: boolean; skipped: boolean; steps: string[] }>>({});
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization) {
      setToursEnabled(organization.onboarding_tours_enabled !== false);
    }
  }, [organization?.id, (organization as any)?.onboarding_tours_enabled]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadProgress();
  }, [user?.id]);

  const loadProgress = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', user.id);

    const map: typeof completedTours = {};
    for (const row of data ?? []) {
      map[row.tour_id] = {
        finished: row.finished,
        skipped: row.skipped,
        steps: row.completed_steps ?? [],
      };
    }
    setCompletedTours(map);
    setLoading(false);
  };

  const saveProgress = async (tourId: string, stepId: string, finished: boolean, skipped: boolean) => {
    if (!user) return;

    const existing = completedTours[tourId];
    const steps = existing ? [...new Set([...existing.steps, stepId])] : [stepId];

    setCompletedTours(prev => ({
      ...prev,
      [tourId]: { finished, skipped, steps },
    }));

    await supabase.from('onboarding_progress').upsert({
      user_id: user.id,
      tour_id: tourId,
      completed_steps: steps,
      finished,
      skipped,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tour_id' });
  };

  const isTourCompleted = useCallback((tourId: string): boolean => {
    const prog = completedTours[tourId];
    return !!(prog?.finished || prog?.skipped);
  }, [completedTours]);

  const startTour = useCallback((tour: Tour) => {
    if (!toursEnabled) return;
    if (isTourCompleted(tour.id)) return;
    setActiveTour(tour);
    setCurrentStepIndex(0);
  }, [toursEnabled, isTourCompleted]);

  const stopTour = useCallback(() => {
    setActiveTour(null);
    setCurrentStepIndex(0);
  }, []);

  const skipTour = useCallback(async () => {
    if (!activeTour) return;
    const currentStep = activeTour.steps[currentStepIndex];
    await saveProgress(activeTour.id, currentStep?.id ?? '', false, true);
    setActiveTour(null);
    setCurrentStepIndex(0);
  }, [activeTour, currentStepIndex]);

  const nextStep = useCallback(async () => {
    if (!activeTour) return;
    const step = activeTour.steps[currentStepIndex];
    if (step) await saveProgress(activeTour.id, step.id, false, false);

    if (currentStepIndex >= activeTour.steps.length - 1) {
      await saveProgress(activeTour.id, step?.id ?? '', true, false);
      setActiveTour(null);
      setCurrentStepIndex(0);
    } else {
      setCurrentStepIndex(i => i + 1);
    }
  }, [activeTour, currentStepIndex]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex(i => Math.max(0, i - 1));
  }, []);

  const resetTour = useCallback(async (tourId: string) => {
    if (!user) return;
    await supabase.from('onboarding_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('tour_id', tourId);
    setCompletedTours(prev => {
      const n = { ...prev };
      delete n[tourId];
      return n;
    });
  }, [user]);

  return (
    <TourContext.Provider value={{
      activeTour,
      currentStepIndex,
      toursEnabled,
      isRunning: activeTour !== null,
      startTour,
      stopTour,
      skipTour,
      nextStep,
      prevStep,
      isTourCompleted,
      resetTour,
      loading,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
