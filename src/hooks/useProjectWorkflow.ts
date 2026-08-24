import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

/**
 * Workflow projektu: nabídka → smlouva/objednávka → realizace → zápisy
 * → předávací protokol → dodací list → faktura.
 *
 * Stavy kroků se ODVOZUJÍ z existujících dat (žádný paralelní stav,
 * který by se mohl rozjet). Hook dělá jen lehké count/head dotazy.
 */

export type ProjectWorkflowStep =
  | 'quote'
  | 'contract'
  | 'execution'
  | 'diary'
  | 'handover'
  | 'delivery'
  | 'invoice';

export const PROJECT_WORKFLOW_STEPS: ProjectWorkflowStep[] = [
  'quote', 'contract', 'execution', 'diary', 'handover', 'delivery', 'invoice',
];

export interface ProjectWorkflowStepState {
  isComplete: boolean;
  /** doplňková informace do tooltipů/badge (počty, částky) */
  helperText: string;
  /** počet pro badge (např. počet zápisů) */
  count?: number;
}

export interface ProjectWorkflowState {
  loading: boolean;
  enforcement: 'guide' | 'confirm';
  steps: Record<ProjectWorkflowStep, ProjectWorkflowStepState>;
  completedSteps: Set<ProjectWorkflowStep>;
  /** první nesplněný krok v pořadí */
  nextStep: ProjectWorkflowStep | null;
  /** nesplnění předchůdci daného kroku (pro confirm režim) */
  incompletePredecessors: (step: ProjectWorkflowStep) => ProjectWorkflowStep[];
  /** nevyúčtovaná práce+materiál (Kč) — badge „vyúčtováno vše" */
  unbilledTotal: number;
  refresh: () => void;
}

export const PROJECT_WORKFLOW_LABELS: Record<ProjectWorkflowStep, string> = {
  quote: 'Nabídka',
  contract: 'Smlouva / objednávka',
  execution: 'Realizace',
  diary: 'Zápisy',
  handover: 'Předávací protokol',
  delivery: 'Dodací list',
  invoice: 'Fakturace',
};

interface RawCounts {
  approvedQuotes: number;
  contractDocs: number;
  jobStatus: string | null;
  diaryCount: number;
  handoverDone: boolean;
  deliveryNotes: number;
  invoiceCount: number;
  unbilledWork: number;   // Kč
  unbilledMaterial: number; // Kč
}

const EMPTY_COUNTS: RawCounts = {
  approvedQuotes: 0, contractDocs: 0, jobStatus: null, diaryCount: 0,
  handoverDone: false, deliveryNotes: 0, invoiceCount: 0,
  unbilledWork: 0, unbilledMaterial: 0,
};

export function useProjectWorkflow(projectId: string | undefined): ProjectWorkflowState {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<RawCounts>(EMPTY_COUNTS);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }

    const [quotesRes, docsRes, jobsRes, protocolRes, deliveryRes, invoiceRes] = await Promise.all([
      supabase.from('project_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).eq('status', 'approved'),
      supabase.from('project_documents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('document_type', ['smlouva', 'objednavka'])
        .in('status', ['FINAL', 'SIGNED']),
      supabase.from('jobs')
        .select('id, status')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('project_protocols')
        .select('id, status, client_signature')
        .eq('project_id', projectId).eq('protocol_type', 'handover')
        .limit(5),
      supabase.from('delivery_notes')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).eq('status', 'issued'),
      supabase.from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).neq('status', 'cancelled'),
    ]);

    const job = (jobsRes.data ?? [])[0] as { id: string; status: string } | undefined;

    // deník + nevyúčtované položky jsou vázané na job
    let diaryCount = 0;
    let unbilledWork = 0;
    let unbilledMaterial = 0;
    if (job) {
      const [diaryRes, workRes, matRes] = await Promise.all([
        supabase.from('job_diary_entries')
          .select('id', { count: 'exact', head: true }).eq('job_id', job.id),
        supabase.from('job_worklogs')
          .select('duration_minutes, hourly_rate')
          .eq('job_id', job.id).is('billed_invoice_id', null).eq('is_running', false),
        supabase.from('job_material_entries')
          .select('actual_qty, unit_price')
          .eq('job_id', job.id).is('billed_invoice_id', null).gt('actual_qty', 0),
      ]);
      diaryCount = diaryRes.count ?? 0;
      for (const w of (workRes.data ?? []) as { duration_minutes: number; hourly_rate: number }[]) {
        unbilledWork += ((w.duration_minutes ?? 0) / 60) * (w.hourly_rate ?? 0);
      }
      for (const m of (matRes.data ?? []) as { actual_qty: number; unit_price: number }[]) {
        unbilledMaterial += (m.actual_qty ?? 0) * (m.unit_price ?? 0);
      }
    }

    const handoverDone = ((protocolRes.data ?? []) as { status: string; client_signature: string | null }[])
      .some((p) => p.status === 'completed' || !!p.client_signature);

    setCounts({
      approvedQuotes: quotesRes.count ?? 0,
      contractDocs: docsRes.count ?? 0,
      jobStatus: job?.status ?? null,
      diaryCount,
      handoverDone,
      deliveryNotes: deliveryRes.count ?? 0,
      invoiceCount: invoiceRes.count ?? 0,
      unbilledWork,
      unbilledMaterial,
    });
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  return useMemo(() => {
    const fmt = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`;
    const unbilledTotal = counts.unbilledWork + counts.unbilledMaterial;
    const jobStarted = counts.jobStatus === 'in_progress'
      || counts.jobStatus === 'paused' || counts.jobStatus === 'completed';

    const steps: Record<ProjectWorkflowStep, ProjectWorkflowStepState> = {
      quote: {
        isComplete: counts.approvedQuotes > 0,
        helperText: counts.approvedQuotes > 0
          ? `Schválené nabídky: ${counts.approvedQuotes}`
          : 'Zatím žádná schválená nabídka',
        count: counts.approvedQuotes,
      },
      contract: {
        isComplete: counts.contractDocs > 0,
        helperText: counts.contractDocs > 0
          ? 'Smlouva nebo objednávka je uzavřená'
          : 'Chybí smlouva nebo objednávka (FINAL/podepsaná)',
      },
      execution: {
        isComplete: jobStarted,
        helperText: counts.jobStatus === 'completed'
          ? 'Realizace dokončena'
          : jobStarted ? 'Realizace probíhá' : 'Realizace nezahájena',
      },
      diary: {
        isComplete: counts.diaryCount > 0,
        helperText: counts.diaryCount > 0
          ? `Zápisů v deníku: ${counts.diaryCount}`
          : 'Deník zatím bez zápisu',
        count: counts.diaryCount,
      },
      handover: {
        isComplete: counts.handoverDone,
        helperText: counts.handoverDone
          ? 'Předávací protokol podepsán'
          : 'Předávací protokol chybí nebo není podepsaný',
      },
      delivery: {
        isComplete: counts.deliveryNotes > 0,
        helperText: counts.deliveryNotes > 0
          ? `Vydané dodací listy: ${counts.deliveryNotes}`
          : 'Dodací list zatím nevydán',
        count: counts.deliveryNotes,
      },
      invoice: {
        isComplete: counts.invoiceCount > 0,
        helperText: counts.invoiceCount === 0
          ? 'Zatím nevyfakturováno'
          : unbilledTotal > 0
            ? `Nevyúčtováno ještě ${fmt(unbilledTotal)}`
            : 'Vyúčtováno vše',
        count: counts.invoiceCount,
      },
    };

    const completedSteps = new Set(
      PROJECT_WORKFLOW_STEPS.filter((s) => steps[s].isComplete),
    );
    const nextStep = PROJECT_WORKFLOW_STEPS.find((s) => !steps[s].isComplete) ?? null;

    const incompletePredecessors = (step: ProjectWorkflowStep) => {
      const idx = PROJECT_WORKFLOW_STEPS.indexOf(step);
      return PROJECT_WORKFLOW_STEPS.slice(0, idx).filter((s) => !steps[s].isComplete);
    };

    return {
      loading,
      enforcement: (organization?.workflow_enforcement === 'confirm' ? 'confirm' : 'guide') as 'guide' | 'confirm',
      steps,
      completedSteps,
      nextStep,
      incompletePredecessors,
      unbilledTotal,
      refresh: load,
    };
  }, [counts, loading, organization?.workflow_enforcement, load]);
}
