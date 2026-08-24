export interface ProjectBudget {
  id: string;
  org_id: string;
  project_id: string;
  title: string;
  total_gross: number;
  total_net: number;
  vat_amount: number;
  status: 'draft' | 'approved' | 'rejected';
  note?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SalesInvoice {
  id: string;
  org_id: string;
  invoice_number: string;
  customer_name: string;
  customer_id?: string;
  project_id?: string;
  issue_date: string;
  due_date: string;
  paid_date?: string;
  amount_gross: number;
  amount_net: number;
  vat_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'canceled';
  note?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  allocated_amount?: number;
}

export interface InvoiceProjectAllocation {
  id: string;
  org_id: string;
  sales_invoice_id: string;
  project_id: string;
  allocated_amount_gross: number;
  created_at: string;
}

export interface CashflowManualEntry {
  id: string;
  org_id: string;
  date: string;
  /** Starsi zaznamy v DB maji 'in'/'out', nove 'inflow'/'outflow'. */
  type: 'inflow' | 'outflow' | 'in' | 'out';
  amount_gross: number;
  title: string;
  note?: string;
  project_id?: string;
  created_by?: string;
  created_at: string;
}

export interface VatRefund {
  id: string;
  org_id: string;
  date: string;
  amount_gross: number;
  note?: string;
  created_by?: string;
  created_at: string;
}

export interface CashflowSettings {
  id: string;
  org_id: string;
  granularity: 'month' | 'week';
  default_payment_terms_days: number;
  invoice_date_field: 'due_date' | 'issue_date';
  bank_balance_correction: number;
  created_at: string;
  updated_at: string;
}

export type CashflowSource =
  | 'project_forecast'
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'recurring'
  | 'manual'
  | 'vat_refund';

export interface CashflowItem {
  id: string;
  date: string;
  type: 'inflow' | 'outflow';
  source: CashflowSource;
  project_id?: string;
  project_name?: string;
  title: string;
  amount_gross: number;
  status?: string;
  source_ref_id?: string;
  budget_approved?: number;
  invoiced_allocated?: number;
  remaining_forecast?: number;
}

export interface MonthRow {
  key: string;
  label: string;
  year: number;
  month: number;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
  items: CashflowItem[];
}
