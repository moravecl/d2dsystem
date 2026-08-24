import { Check, Ticket, Calendar, MapPin, Wrench, FileText, FileCheck, Receipt, CheckCircle2 } from 'lucide-react';

export type WorkflowStatus =
  | 'new'
  | 'scheduled'
  | 'confirmed'
  | 'en_route'
  | 'on_site'
  | 'awaiting_report'
  | 'report_completed'
  | 'protocol_created'
  | 'to_bill'
  | 'invoiced'
  | 'closed';

interface WorkflowStep {
  key: WorkflowStatus;
  label: string;
  shortLabel: string;
  icon: typeof Ticket;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { key: 'new', label: 'Nový', shortLabel: 'Nový', icon: Ticket },
  { key: 'scheduled', label: 'Naplánovaný', shortLabel: 'Naplán.', icon: Calendar },
  { key: 'confirmed', label: 'Potvrzený', shortLabel: 'Potvr.', icon: Check },
  { key: 'en_route', label: 'Na cestě', shortLabel: 'Cesta', icon: MapPin },
  { key: 'on_site', label: 'Na místě', shortLabel: 'Místo', icon: Wrench },
  { key: 'awaiting_report', label: 'Čeká na výkaz', shortLabel: 'Výkaz', icon: FileText },
  { key: 'report_completed', label: 'Výkaz vyplněn', shortLabel: 'Hotovo', icon: FileCheck },
  { key: 'protocol_created', label: 'Protokol vytvořen', shortLabel: 'Prot.', icon: FileCheck },
  { key: 'to_bill', label: 'K fakturaci', shortLabel: 'Fakt.', icon: Receipt },
  { key: 'invoiced', label: 'Vyfakturováno', shortLabel: 'Vyf.', icon: Receipt },
  { key: 'closed', label: 'Uzavřeno', shortLabel: 'Uzav.', icon: CheckCircle2 },
];

const SIMPLIFIED_STEPS: WorkflowStep[] = [
  { key: 'new', label: '1. Zadání', shortLabel: 'Zadání', icon: Ticket },
  { key: 'scheduled', label: '2. Servis', shortLabel: 'Servis', icon: Wrench },
  { key: 'awaiting_report', label: '3. Výkaz', shortLabel: 'Výkaz', icon: FileText },
  { key: 'protocol_created', label: '4. Protokol', shortLabel: 'Protokol', icon: FileCheck },
  { key: 'to_bill', label: '5. Fakturace', shortLabel: 'Fakturace', icon: Receipt },
];

function getSimplifiedStep(status: WorkflowStatus): number {
  if (['new'].includes(status)) return 0;
  if (['scheduled', 'confirmed', 'en_route', 'on_site'].includes(status)) return 1;
  if (['awaiting_report', 'report_completed'].includes(status)) return 2;
  if (['protocol_created'].includes(status)) return 3;
  if (['to_bill', 'invoiced', 'closed'].includes(status)) return 4;
  return 0;
}

interface Props {
  currentStatus: WorkflowStatus;
  hasScheduledDate?: boolean;
  hasReport?: boolean;
  hasLockedReport?: boolean;
  hasProtocol?: boolean;
  isBilled?: boolean;
  simplified?: boolean;
  className?: string;
}

export default function ServiceWorkflowStepper({
  currentStatus,
  hasScheduledDate,
  hasLockedReport,
  hasProtocol,
  isBilled,
  simplified = true,
  className = '',
}: Props) {
  const steps = simplified ? SIMPLIFIED_STEPS : WORKFLOW_STEPS;

  let currentIdx = 0;
  if (simplified) {
    if (isBilled) {
      currentIdx = 4;
    } else if (hasProtocol) {
      currentIdx = 3;
    } else if (hasLockedReport) {
      currentIdx = 2;
    } else if (hasScheduledDate || ['scheduled', 'confirmed', 'en_route', 'on_site', 'awaiting_report'].includes(currentStatus)) {
      currentIdx = 1;
    } else {
      currentIdx = getSimplifiedStep(currentStatus);
    }
  } else {
    currentIdx = WORKFLOW_STEPS.findIndex(s => s.key === currentStatus);
  }

  return (
    <div className={`bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          let statusColor = 'bg-slate-700 text-slate-500';
          let lineColor = 'bg-slate-700';

          if (isComplete) {
            statusColor = 'bg-emerald-500 text-white';
            lineColor = 'bg-emerald-500';
          } else if (isCurrent) {
            statusColor = 'bg-orange-500 text-white';
          }

          return (
            <div key={step.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColor} transition-colors`}>
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-[10px] font-semibold mt-1.5 text-center max-w-[60px] ${
                  isCurrent ? 'text-orange-400' : isComplete ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {step.shortLabel}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isComplete ? lineColor : 'bg-slate-700'} transition-colors`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  new: 'Nový',
  scheduled: 'Naplánovaný',
  confirmed: 'Potvrzený zákazníkem',
  en_route: 'Na cestě',
  on_site: 'Na místě',
  awaiting_report: 'Čeká na výkaz',
  report_completed: 'Výkaz vyplněn',
  protocol_created: 'Protokol vytvořen',
  to_bill: 'K fakturaci',
  invoiced: 'Vyfakturováno',
  closed: 'Uzavřeno',
};

export const SERVICE_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  warranty: { label: 'Záruční', color: 'bg-blue-500/15 text-blue-400' },
  out_of_warranty: { label: 'Mimo záruku', color: 'bg-slate-500/15 text-slate-400' },
  claim: { label: 'Reklamace', color: 'bg-red-500/15 text-red-400' },
  service_contract: { label: 'Servisní smlouva', color: 'bg-emerald-500/15 text-emerald-400' },
  paid_visit: { label: 'Placený výjezd', color: 'bg-amber-500/15 text-amber-400' },
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  new: 'Nový',
  in_progress: 'V řešení',
  waiting_customer: 'Čeká na zákazníka',
  requires_visit: 'Vyžaduje výjezd',
  converted_to_service: 'Převeden na servis',
  resolved_remote: 'Vyřešen vzdáleně',
  closed: 'Uzavřen',
};
