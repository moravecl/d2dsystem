import type { CircuitType } from '../../../hooks/useProjectState';

export const CIRCUIT_TYPE_LABELS: Record<CircuitType, { label: string; shortLabel: string; color: string }> = {
  electric: { label: 'Elektro', shortLabel: 'E', color: '#eab308' },
  water: { label: 'Voda', shortLabel: 'V', color: '#3b82f6' },
  heating: { label: 'Topení', shortLabel: 'T', color: '#ef4444' },
  recuperation: { label: 'Rekuperace', shortLabel: 'R', color: '#22c55e' },
};

export const ALL_TRADES: CircuitType[] = ['electric', 'water', 'heating', 'recuperation'];
