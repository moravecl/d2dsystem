import { useMemo } from 'react';
import type { WorkflowStep } from '../components/editor/DesignWorkflowStepper';
import type { ProjectDesignElement } from '../types/designElements';
import type { Floor, Room } from './useProjectState';
import {
  resolveAssignmentForElement,
  type ResolvedAssignment,
} from '../lib/assignmentResolver';

interface ProductAssignment {
  id: string;
  scope: 'project' | 'room' | 'element';
  scope_ref_id: string | null;
  element_type_id: string | null;
  product_id: string | null;
}

export interface WorkflowStepStatus {
  isComplete: boolean;
  isAvailable: boolean;
  isBlocked: boolean;
  warningCount: number;
  missingCount: number;
  helperText: string;
  ctaLabel: string;
}

export interface WorkflowWarning {
  type: 'unassigned' | 'incompatible' | 'missing_mapping' | 'no_room';
  elementId?: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
}

export interface WorkflowBlocker {
  type: 'no_elements' | 'no_rooms' | 'critical_error';
  message: string;
}

export interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  canProceed: Record<WorkflowStep, boolean>;
  unassignedCount: number;
  totalElementCount: number;
  assignedCount: number;
  inheritedCount: number;
  directCount: number;
  hasDesignContent: boolean;
  hasQuotes: boolean;
  nextRecommendedStep: WorkflowStep | null;
  blockers: WorkflowBlocker[];
  warnings: WorkflowWarning[];
  stepStatuses: Record<WorkflowStep, WorkflowStepStatus>;
}

interface UseDesignWorkflowParams {
  floors: Floor[];
  designElements: ProjectDesignElement[];
  assignments: ProductAssignment[];
  quotesCount: number;
  productKindMap?: Map<string, string>;
}

export function useDesignWorkflow({
  floors,
  designElements,
  assignments,
  quotesCount,
  productKindMap,
}: UseDesignWorkflowParams): WorkflowState {
  return useMemo(() => {
    const hasRooms = floors.some((f) =>
      f.rooms && f.rooms.length > 0
    );
    const hasPlacements = floors.some((f) =>
      f.rooms?.some((r: Room) => r.placements && r.placements.length > 0)
    );
    const hasSchematicElements = designElements.length > 0;
    const hasDesignContent = hasRooms || hasPlacements || hasSchematicElements;

    const totalElementCount = designElements.length;
    const warnings: WorkflowWarning[] = [];
    const blockers: WorkflowBlocker[] = [];

    let assignedCount = 0;
    let inheritedCount = 0;
    let directCount = 0;
    const elementsWithoutRoom: string[] = [];

    for (const el of designElements) {
      const resolved = resolveAssignmentForElement({
        elementId: el.id,
        elementTypeId: el.element_type_id,
        roomId: el.room_id,
        assignments,
        productKindMap,
      });

      if (resolved.effectiveProductId) {
        assignedCount++;
        if (resolved.inherited) {
          inheritedCount++;
        } else {
          directCount++;
        }
      }

      if (!el.room_id) {
        elementsWithoutRoom.push(el.id);
      }
    }

    const unassignedCount = totalElementCount - assignedCount;

    if (unassignedCount > 0) {
      warnings.push({
        type: 'unassigned',
        message: `${unassignedCount} prvků nemá přiřazený produkt`,
        severity: 'warning',
      });
    }

    if (elementsWithoutRoom.length > 0) {
      warnings.push({
        type: 'no_room',
        message: `${elementsWithoutRoom.length} prvků není přiřazeno do místnosti`,
        severity: 'info',
      });
    }

    if (!hasSchematicElements && hasDesignContent) {
      blockers.push({
        type: 'no_elements',
        message: 'V návrhu nejsou žádné schematické prvky',
      });
    }

    const hasQuotes = quotesCount > 0;

    const completedSteps = new Set<WorkflowStep>();
    if (hasDesignContent) {
      completedSteps.add('design');
    }
    if (hasSchematicElements && assignedCount === totalElementCount && totalElementCount > 0) {
      completedSteps.add('assign');
    }
    if (completedSteps.has('assign')) {
      completedSteps.add('summary');
    }
    if (hasQuotes) {
      completedSteps.add('quote');
    }

    const canProceed: Record<WorkflowStep, boolean> = {
      design: true,
      assign: hasSchematicElements,
      summary: hasSchematicElements && assignedCount > 0,
      quote: hasSchematicElements,
    };

    let currentStep: WorkflowStep = 'design';
    if (hasSchematicElements && assignedCount > 0) {
      currentStep = 'assign';
    }
    if (completedSteps.has('assign')) {
      currentStep = 'summary';
    }
    if (hasQuotes) {
      currentStep = 'quote';
    }

    let nextRecommendedStep: WorkflowStep | null = null;
    if (!hasSchematicElements) {
      nextRecommendedStep = 'design';
    } else if (unassignedCount > 0) {
      nextRecommendedStep = 'assign';
    } else if (!completedSteps.has('summary')) {
      nextRecommendedStep = 'summary';
    } else if (!hasQuotes) {
      nextRecommendedStep = 'quote';
    }

    const stepStatuses: Record<WorkflowStep, WorkflowStepStatus> = {
      design: {
        isComplete: completedSteps.has('design'),
        isAvailable: true,
        isBlocked: false,
        warningCount: elementsWithoutRoom.length,
        missingCount: 0,
        helperText: hasSchematicElements
          ? `${totalElementCount} prvků rozmístěno`
          : 'Rozmístěte schematické značky',
        ctaLabel: 'Otevřít návrh',
      },
      assign: {
        isComplete: completedSteps.has('assign'),
        isAvailable: canProceed.assign,
        isBlocked: !hasSchematicElements,
        warningCount: 0,
        missingCount: unassignedCount,
        helperText: assignedCount === totalElementCount && totalElementCount > 0
          ? 'Všechny prvky mají přiřazení'
          : `${unassignedCount} z ${totalElementCount} prvků bez přiřazení`,
        ctaLabel: unassignedCount > 0 ? 'Přiřadit produkty' : 'Zkontrolovat přiřazení',
      },
      summary: {
        isComplete: completedSteps.has('summary'),
        isAvailable: canProceed.summary,
        isBlocked: !canProceed.summary,
        warningCount: warnings.length,
        missingCount: 0,
        helperText: completedSteps.has('assign')
          ? 'Zkontrolujte souhrn před vytvořením nabídky'
          : 'Nejprve dokončete přiřazení',
        ctaLabel: 'Zkontrolovat souhrn',
      },
      quote: {
        isComplete: completedSteps.has('quote'),
        isAvailable: canProceed.quote,
        isBlocked: false,
        warningCount: 0,
        missingCount: 0,
        helperText: hasQuotes
          ? `${quotesCount} ${quotesCount === 1 ? 'nabídka' : quotesCount < 5 ? 'nabídky' : 'nabídek'}`
          : 'Vytvořte cenovou nabídku',
        ctaLabel: hasQuotes ? 'Zobrazit nabídky' : 'Vytvořit nabídku',
      },
    };

    return {
      currentStep,
      completedSteps,
      canProceed,
      unassignedCount,
      totalElementCount,
      assignedCount,
      inheritedCount,
      directCount,
      hasDesignContent,
      hasQuotes,
      nextRecommendedStep,
      blockers,
      warnings,
      stepStatuses,
    };
  }, [floors, designElements, assignments, quotesCount, productKindMap]);
}
