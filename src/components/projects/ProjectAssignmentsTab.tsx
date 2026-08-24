import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Layers, ChevronRight, AlertTriangle, Check, Info, ArrowRight, FileText, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProductAssignments } from '../../hooks/useProductAssignments';
import { useProjectDesignElements } from '../../hooks/useProjectDesignElements';
import WorkflowCtaBanner from '../editor/WorkflowCtaBanner';
import WorkflowProgressBadge from '../editor/WorkflowProgressBadge';
import type { WorkflowStep } from '../editor/DesignWorkflowStepper';
import type { WorkflowStepStatus } from '../../hooks/useDesignWorkflow';

interface Props {
  projectId: string;
}

export default function ProjectAssignmentsTab({ projectId }: Props) {
  const navigate = useNavigate();
  const [quotesCount, setQuotesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const { elements, loading: elementsLoading } = useProjectDesignElements(projectId);
  const { computeStats, loading: assignmentsLoading } = useProductAssignments(projectId);

  useEffect(() => {
    supabase
      .from('project_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .then(({ count }) => setQuotesCount(count ?? 0));
  }, [projectId]);

  useEffect(() => {
    setLoading(elementsLoading || assignmentsLoading);
  }, [elementsLoading, assignmentsLoading]);

  const stats = useMemo(() => {
    return computeStats(elements);
  }, [computeStats, elements]);

  const isComplete = stats.totalElements > 0 && stats.unassignedCount === 0;
  const hasUnassigned = stats.totalElements > 0 && stats.unassignedCount > 0;
  const hasElements = stats.totalElements > 0;

  const completedSteps = useMemo(() => {
    const set = new Set<WorkflowStep>();
    if (hasElements) set.add('design');
    if (isComplete) {
      set.add('assign');
      set.add('summary');
    }
    if (quotesCount > 0) set.add('quote');
    return set;
  }, [hasElements, isComplete, quotesCount]);

  const nextRecommendedStep: WorkflowStep | null = useMemo(() => {
    if (!hasElements) return 'design';
    if (hasUnassigned) return 'assign';
    if (!completedSteps.has('summary')) return 'summary';
    if (quotesCount === 0) return 'quote';
    return null;
  }, [hasElements, hasUnassigned, completedSteps, quotesCount]);

  const stepStatuses: Record<WorkflowStep, WorkflowStepStatus> = useMemo(() => ({
    design: {
      isComplete: hasElements,
      isAvailable: true,
      isBlocked: false,
      warningCount: 0,
      missingCount: 0,
      helperText: hasElements ? `${stats.totalElements} prvku` : 'Rozmistete prvky',
      ctaLabel: 'Otevrit navrh',
    },
    assign: {
      isComplete: isComplete,
      isAvailable: hasElements,
      isBlocked: !hasElements,
      warningCount: 0,
      missingCount: stats.unassignedCount,
      helperText: isComplete ? 'Vsechny prvky prirazeny' : `${stats.unassignedCount} neprirazeno`,
      ctaLabel: hasUnassigned ? 'Priradit produkty' : 'Zkontrolovat prirazeni',
    },
    summary: {
      isComplete: isComplete,
      isAvailable: hasElements && stats.assignedCount > 0,
      isBlocked: stats.assignedCount === 0,
      warningCount: 0,
      missingCount: 0,
      helperText: isComplete ? 'Pripraveno ke kontrole' : 'Nejprve dokoncete prirazeni',
      ctaLabel: 'Zkontrolovat souhrn',
    },
    quote: {
      isComplete: quotesCount > 0,
      isAvailable: hasElements,
      isBlocked: false,
      warningCount: 0,
      missingCount: 0,
      helperText: quotesCount > 0 ? `${quotesCount} nabidek` : 'Vytvorte nabidku',
      ctaLabel: quotesCount > 0 ? 'Zobrazit nabidky' : 'Vytvorit nabidku',
    },
  }), [hasElements, isComplete, hasUnassigned, stats, quotesCount]);

  const handleNavigateToStep = (step: WorkflowStep) => {
    switch (step) {
      case 'design':
        navigate(`/projekty/${projectId}/navrh`);
        break;
      case 'assign':
        navigate(`/projekty/${projectId}/prirazeni`);
        break;
      case 'summary':
        navigate(`/projekty/${projectId}?tab=selection`);
        break;
      case 'quote':
        navigate(`/projekty/${projectId}?tab=quotes`);
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Přiřazení produktu</h2>
          <p className="text-sm text-slate-400">
            Přiřaďte produkty z katalogu ke schematickym značkám umístěným v návrhu.
          </p>
        </div>
        <WorkflowProgressBadge
          completedSteps={completedSteps}
          unassignedCount={stats.unassignedCount}
          hasDesignContent={hasElements}
        />
      </div>

      {hasElements && (
        <div className="mb-6">
          <WorkflowCtaBanner
            nextRecommendedStep={nextRecommendedStep}
            stepStatuses={stepStatuses}
            onNavigateToStep={handleNavigateToStep}
          />
        </div>
      )}

      <div className="bg-navy-800/50 rounded-2xl border border-white/10 overflow-hidden mb-6">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Aktuální návrh</h3>
              <p className="text-xs text-slate-500">
                {stats.totalElements} prvku celkem
              </p>
            </div>
            {isComplete && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-400">Kompletní</span>
              </div>
            )}
            {hasUnassigned && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-400">
                  {stats.unassignedCount} nepřiřazeno
                </span>
              </div>
            )}
          </div>
        </div>

        {hasElements && (
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-white">{stats.totalElements}</div>
                <div className="text-xs text-slate-500">celkem</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-emerald-400">{stats.assignedCount}</div>
                <div className="text-xs text-slate-500">přiřazeno</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-extrabold ${stats.unassignedCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {stats.unassignedCount}
                </div>
                <div className="text-xs text-slate-500">nepřiřazeno</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-blue-400">{stats.inheritedCount}</div>
                <div className="text-xs text-slate-500">zděděno</div>
              </div>
            </div>
            {stats.inheritedCount > 0 && (
              <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs text-blue-300">
                  {stats.inheritedCount} prvku dědí přiřazení z projektu nebo místnosti
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate(`/projekty/${projectId}/prirazeni`)}
          className="w-full flex items-center gap-4 p-5 hover:bg-white/[0.03] transition text-left"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20">
            <Package className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Přiřadit produkty</div>
            <div className="text-xs text-slate-400">
              Přiřaďte konkrétní produkty ke schematickym značkám
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {hasElements && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => navigate(`/projekty/${projectId}?tab=quotes`)}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition text-left"
          >
            <div className="p-2 rounded-lg bg-slate-700/50">
              <ClipboardList className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Souhrn</div>
              <div className="text-xs text-slate-500">Zkontrolujte výběr</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => navigate(`/projekty/${projectId}?tab=quotes`)}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition text-left"
          >
            <div className="p-2 rounded-lg bg-slate-700/50">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Nabídky</div>
              <div className="text-xs text-slate-500">
                {quotesCount > 0 ? `${quotesCount} ${quotesCount === 1 ? 'nabidka' : quotesCount < 5 ? 'nabidky' : 'nabidek'}` : 'Zatim zadne'}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}

      {!hasElements && (
        <div className="text-center py-8 px-4 rounded-2xl border border-white/10 bg-white/[0.02]">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Žádné schematicke prvky</h3>
          <p className="text-xs text-slate-400 mb-4">
            Nejprve přidejte prvky ve schematickem návrhu
          </p>
          <button
            onClick={() => navigate(`/projekty/${projectId}/navrh`)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition"
          >
            Přejít na návrh
          </button>
        </div>
      )}
    </div>
  );
}
