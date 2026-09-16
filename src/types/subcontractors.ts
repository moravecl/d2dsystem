export type SubcontractorType = 'company' | 'individual';

export interface Subcontractor {
  id: string;
  organization_id: string;
  sub_type: SubcontractorType;
  name: string;
  ico: string;
  dic: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  trades: string[];
  hourly_rate: number;
  rating: number | null;
  note: string;
  is_active: boolean;
  created_at: string;
}

export type SubDocType = 'pojisteni' | 'opravneni' | 'bozp' | 'smlouva' | 'jine';

export interface SubcontractorDocument {
  id: string;
  subcontractor_id: string;
  doc_type: SubDocType;
  name: string;
  file_url: string;
  valid_until: string | null;
  note: string;
  created_at: string;
}

export type JobSubStatus = 'assigned' | 'contract_generated' | 'contract_signed' | 'completed' | 'cancelled';

export interface JobSubcontractor {
  id: string;
  job_id: string;
  subcontractor_id: string;
  trade: string;
  scope: string;
  agreed_price: number;
  date_from: string | null;
  date_to: string | null;
  status: JobSubStatus;
  contract_document_id: string | null;
  note: string;
  created_at: string;
  subcontractors?: Subcontractor;
}

/** Řemesla subdodavatelů: řemesla návrháře + stavební/ostatní profese. */
export const SUB_TRADE_LABELS: Record<string, string> = {
  electric: 'Elektro',
  water: 'Voda',
  heating: 'Topení',
  recuperation: 'Rekuperace',
  stavba: 'Stavební práce',
  strecha: 'Střecha / klempíř',
  zemni: 'Zemní práce',
  ostatni: 'Ostatní',
};

export const SUB_DOC_TYPE_LABELS: Record<SubDocType, string> = {
  pojisteni: 'Pojištění odpovědnosti',
  opravneni: 'Odborné oprávnění',
  bozp: 'BOZP školení',
  smlouva: 'Rámcová smlouva',
  jine: 'Jiné',
};

export const JOB_SUB_STATUS_LABELS: Record<JobSubStatus, { label: string; cls: string }> = {
  assigned: { label: 'Přiřazen', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  contract_generated: { label: 'Smlouva vygenerována', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  contract_signed: { label: 'Smlouva podepsána', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  completed: { label: 'Dokončeno', cls: 'text-slate-300 bg-white/[0.06] border-white/[0.08]' },
  cancelled: { label: 'Zrušeno', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

/** Stav platnosti dokumentu: expirovaný / brzy vyprší (30 dní) / platný. */
export function docValidity(validUntil: string | null): 'expired' | 'expiring' | 'valid' | 'none' {
  if (!validUntil) return 'none';
  const due = new Date(validUntil);
  const now = new Date();
  if (due < now) return 'expired';
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  if (due <= soon) return 'expiring';
  return 'valid';
}
