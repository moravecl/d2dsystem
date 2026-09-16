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

export type SubInquiryMode = 'fixed_price' | 'bid';
export type SubInquiryStatus = 'draft' | 'sent' | 'closed' | 'awarded' | 'cancelled';
export type SubRecipientStatus = 'sent' | 'viewed' | 'declined' | 'offered' | 'accepted';

export interface SubInquiry {
  id: string;
  organization_id: string;
  job_id: string;
  project_id: string | null;
  title: string;
  scope: string;
  trade: string;
  mode: SubInquiryMode;
  fixed_price: number;
  people_needed: number;
  reveal_client: boolean;
  place: string;
  date_from: string | null;
  date_to: string | null;
  response_deadline: string | null;
  status: SubInquiryStatus;
  note: string;
  created_at: string;
}

export interface SubInquiryRecipient {
  id: string;
  inquiry_id: string;
  subcontractor_id: string;
  status: SubRecipientStatus;
  offer_price: number | null;
  offer_note: string;
  people_offered: number | null;
  responded_at: string | null;
  confirmed_at: string | null;
  awarded_job_subcontractor_id: string | null;
  subcontractors?: Subcontractor;
  sub_inquiries?: SubInquiry;
}

export const SUB_INQUIRY_STATUS_LABELS: Record<SubInquiryStatus, { label: string; cls: string }> = {
  draft: { label: 'Koncept', cls: 'text-slate-400 bg-white/[0.06] border-white/[0.08]' },
  sent: { label: 'Otevřená', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  closed: { label: 'Uzavřená', cls: 'text-slate-300 bg-white/[0.06] border-white/[0.08]' },
  awarded: { label: 'Zadaná', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: 'Zrušená', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export const SUB_RECIPIENT_STATUS_LABELS: Record<SubRecipientStatus, { label: string; cls: string }> = {
  sent: { label: 'Odesláno', cls: 'text-slate-400 bg-white/[0.06] border-white/[0.08]' },
  viewed: { label: 'Zobrazeno', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  declined: { label: 'Odmítnuto', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  offered: { label: 'Nabídka', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  accepted: { label: 'Přijato', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
};
