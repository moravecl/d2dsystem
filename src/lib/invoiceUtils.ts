import { supabase } from './supabase';
import { INVOICE_TYPES } from './invoiceTypes';

export interface InvoiceSettings {
  id: string;
  number_prefix: string;
  number_format: string;
  next_number: number;
  default_due_days: number;
  default_vat_rate: number;
  default_payment_method: string;
  footer_text: string;
  reset_yearly: boolean;
  current_year: number;
  prefix_standard?: string;
  prefix_deposit_invoice?: string;
  prefix_tax_document?: string;
  prefix_credit_note?: string;
  prefix_settlement_invoice?: string;
  prefix_cash_receipt?: string;
  next_number_deposit_invoice?: number;
  next_number_tax_document?: number;
  next_number_credit_note?: number;
  next_number_settlement_invoice?: number;
  next_number_cash_receipt?: number;
}

export interface CompanyInfo {
  company_name: string;
  company_id: string;
  tax_id: string;
  address: string;
  city: string;
  zip: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  iban: string;
  swift: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  vat_rate: number;
  vat_amount: number;
  sort_order: number;
  section_name?: string;
}

export interface VatBreakdown {
  rate: number;
  base: number;
  vat: number;
  total: number;
}

export function calcItemTotals(item: InvoiceItem): InvoiceItem {
  const total_price = item.quantity * item.unit_price;
  const vat_amount = Math.round(total_price * (item.vat_rate / 100) * 100) / 100;
  return { ...item, total_price, vat_amount };
}

export function calcVatBreakdown(items: InvoiceItem[]): VatBreakdown[] {
  const map = new Map<number, VatBreakdown>();
  for (const item of items) {
    const existing = map.get(item.vat_rate);
    if (existing) {
      existing.base += item.total_price;
      existing.vat += item.vat_amount;
      existing.total += item.total_price + item.vat_amount;
    } else {
      map.set(item.vat_rate, {
        rate: item.vat_rate,
        base: item.total_price,
        vat: item.vat_amount,
        total: item.total_price + item.vat_amount,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
}

export function calcTotals(items: InvoiceItem[]) {
  const subtotal = items.reduce((s, i) => s + i.total_price, 0);
  const taxTotal = items.reduce((s, i) => s + i.vat_amount, 0);
  const total = subtotal + taxTotal;
  return { subtotal, taxTotal, total };
}

export async function loadInvoiceSettings(): Promise<InvoiceSettings | null> {
  const { data } = await supabase
    .from('invoice_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  return data as InvoiceSettings | null;
}

export async function loadCompanyInfo(): Promise<CompanyInfo | null> {
  const { data } = await supabase
    .from('company_info')
    .select('company_name, company_id, tax_id, address, city, zip, phone, email, bank_name, bank_account, iban, swift')
    .limit(1)
    .maybeSingle();
  return data as CompanyInfo | null;
}

type TypePrefixKey = 'prefix_standard' | 'prefix_deposit_invoice' | 'prefix_tax_document' | 'prefix_credit_note' | 'prefix_settlement_invoice' | 'prefix_cash_receipt';
type TypeNextKey = 'next_number' | 'next_number_deposit_invoice' | 'next_number_tax_document' | 'next_number_credit_note' | 'next_number_settlement_invoice' | 'next_number_cash_receipt';

const TYPE_PREFIX_FIELD: Record<string, TypePrefixKey> = {
  [INVOICE_TYPES.STANDARD]: 'prefix_standard',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'prefix_deposit_invoice',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'prefix_tax_document',
  [INVOICE_TYPES.CREDIT_NOTE]: 'prefix_credit_note',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'prefix_settlement_invoice',
  [INVOICE_TYPES.CASH_RECEIPT]: 'prefix_cash_receipt',
};

const TYPE_NEXT_FIELD: Record<string, TypeNextKey> = {
  [INVOICE_TYPES.STANDARD]: 'next_number',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'next_number_deposit_invoice',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'next_number_tax_document',
  [INVOICE_TYPES.CREDIT_NOTE]: 'next_number_credit_note',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'next_number_settlement_invoice',
  [INVOICE_TYPES.CASH_RECEIPT]: 'next_number_cash_receipt',
};

export function generateInvoiceNumber(settings: InvoiceSettings, invoiceType?: string): string {
  const type = invoiceType || INVOICE_TYPES.STANDARD;
  const prefixField = TYPE_PREFIX_FIELD[type] || 'prefix_standard';
  const nextField = TYPE_NEXT_FIELD[type] || 'next_number';

  const prefix = (settings[prefixField] as string) || settings.number_prefix || 'FV';
  const nextNum = (settings[nextField] as number) ?? settings.next_number ?? 1;

  const year = new Date().getFullYear();
  const num = String(nextNum).padStart(3, '0');
  return settings.number_format
    .replace('{PREFIX}', prefix)
    .replace('{YYYY}', String(year))
    .replace('{NNN}', num)
    .replace('{NN}', String(nextNum).padStart(2, '0'));
}

export async function incrementInvoiceNumber(settingsId: string, currentNext: number, invoiceType?: string) {
  const type = invoiceType || INVOICE_TYPES.STANDARD;
  const nextField = TYPE_NEXT_FIELD[type] || 'next_number';
  await supabase
    .from('invoice_settings')
    .update({ [nextField]: currentNext + 1, updated_at: new Date().toISOString() })
    .eq('id', settingsId);
}

export function convertCzAccountToIban(accountNumber: string): string {
  const clean = accountNumber.replace(/\s/g, '');
  const match = clean.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!match) return '';
  const prefix = (match[1] || '').padStart(6, '0');
  const number = match[2].padStart(10, '0');
  const bankCode = match[3];
  const bban = bankCode + prefix + number;
  const numeric = bban.split('').map(c => {
    const n = parseInt(c, 10);
    return isNaN(n) ? (c.charCodeAt(0) - 55).toString() : c;
  }).join('');
  const checkStr = numeric + '123500';
  let remainder = 0;
  for (const ch of checkStr) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  const checkDigits = String(98 - remainder).padStart(2, '0');
  return `CZ${checkDigits}${bban}`;
}

export function generateSpayd(
  iban: string,
  amount: number,
  vs: string,
  currency = 'CZK',
  accountNumber = ''
): string {
  let cleanIban = (iban || '').replace(/\s/g, '');
  if (!cleanIban && accountNumber) {
    cleanIban = convertCzAccountToIban(accountNumber);
  }
  if (!cleanIban) return '';
  const parts = [
    'SPD*1.0',
    `ACC:${cleanIban}`,
    `AM:${amount.toFixed(2)}`,
    `CC:${currency}`,
  ];
  if (vs) parts.push(`X-VS:${vs}`);
  return parts.join('*');
}

export function formatCZK(n: number): string {
  return Math.round(n).toLocaleString('cs-CZ');
}

export function formatDate(d: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('cs-CZ');
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
