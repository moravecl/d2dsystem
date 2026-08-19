import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface SubsidyProgram {
  id: string;
  org_id: string;
  name: string;
  description: string;
  max_amount_czk: number;
  max_percentage: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function computeSubsidy(program: SubsidyProgram, totalInvestmentCzk: number): number {
  const fromPercentage = Math.round(totalInvestmentCzk * (program.max_percentage / 100));
  return Math.min(program.max_amount_czk, fromPercentage);
}

export function useSubsidyPrograms() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [programs, setPrograms] = useState<SubsidyProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from('fv_subsidy_programs')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setPrograms((data ?? []) as SubsidyProgram[]);
        setLoading(false);
      });
  }, [orgId, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);

  const createProgram = useCallback(async (program: Partial<SubsidyProgram>) => {
    if (!orgId) return null;
    const { data, error } = await supabase
      .from('fv_subsidy_programs')
      .insert({ ...program, org_id: orgId })
      .select()
      .single();
    if (error || !data) return null;
    setPrograms(prev => [...prev, data as SubsidyProgram]);
    return data as SubsidyProgram;
  }, [orgId]);

  const updateProgram = useCallback(async (id: string, updates: Partial<SubsidyProgram>) => {
    const { error } = await supabase
      .from('fv_subsidy_programs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setPrograms(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  }, []);

  const deleteProgram = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('fv_subsidy_programs')
      .delete()
      .eq('id', id);
    if (!error) {
      setPrograms(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  return { programs, loading, reload, createProgram, updateProgram, deleteProgram };
}
