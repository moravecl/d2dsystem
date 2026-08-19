export interface BankAccount {
  id: string;
  org_id: string;
  name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  current_balance: number;
  is_default: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  org_id: string;
  account_id: string | null;
  date: string;
  amount: number;
  description: string;
  counterparty_name: string;
  counterparty_account: string;
  reference: string;
  vs: string;
  ks: string;
  ss: string;
  raw_note: string;
  type: 'credit' | 'debit';
  status: 'new' | 'matched' | 'ignored';
  import_batch: string;
  created_at: string;
  updated_at: string;
  matches?: BankTransactionMatch[];
}

export interface BankTransactionMatch {
  id: string;
  org_id: string;
  transaction_id: string;
  match_type: 'issued_invoice' | 'received_invoice' | 'manual_cost' | 'manual_income';
  match_id: string | null;
  matched_amount: number;
  note: string;
  created_at: string;
}

export interface ParsedBankRow {
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  counterparty_name: string;
  counterparty_account: string;
  vs: string;
  ks: string;
  ss: string;
  reference: string;
  raw_note: string;
}
