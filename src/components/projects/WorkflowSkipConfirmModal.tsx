import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { PROJECT_WORKFLOW_LABELS, type ProjectWorkflowStep } from '../../hooks/useProjectWorkflow';

interface Props {
  open: boolean;
  targetStep: ProjectWorkflowStep;
  missingSteps: ProjectWorkflowStep[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Režim „confirm": při přeskočení nesplněných kroků workflow se uživatel
 * musí výslovně potvrdit — a přeskok se zapíše do audit logu (řeší volající).
 */
export default function WorkflowSkipConfirmModal({ open, targetStep, missingSteps, onConfirm, onCancel }: Props) {
  return (
    <Modal open={open} onClose={onCancel} title="Přeskočit kroky workflow?">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Chystáte se na krok <strong className="text-white">{PROJECT_WORKFLOW_LABELS[targetStep]}</strong>,
            ale předchozí kroky ještě nejsou splněné:
          </p>
        </div>
        <ul className="space-y-1.5 pl-1">
          {missingSteps.map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {PROJECT_WORKFLOW_LABELS[s]}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition"
          >
            Zpět
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition"
          >
            Pokračovat i tak
          </button>
        </div>
      </div>
    </Modal>
  );
}
