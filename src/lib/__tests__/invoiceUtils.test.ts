import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import {
  calcItemTotals, calcVatBreakdown, calcTotals,
  generateInvoiceNumber, convertCzAccountToIban, addDays,
  type InvoiceItem, type InvoiceSettings,
} from '../invoiceUtils';

const item = (over: Partial<InvoiceItem> = {}): InvoiceItem => ({
  id: '1', description: 'x', quantity: 1, unit: 'ks', unit_price: 100,
  vat_rate: 21, total_price: 0, vat_amount: 0, sort_order: 0,
  ...over,
} as InvoiceItem);

describe('calcItemTotals', () => {
  it('spočítá cenu a DPH položky', () => {
    const r = calcItemTotals(item({ quantity: 3, unit_price: 100, vat_rate: 21 }));
    expect(r.total_price).toBe(300);
    expect(r.vat_amount).toBe(63);
  });

  it('zaokrouhlí DPH na haléře', () => {
    const r = calcItemTotals(item({ quantity: 1, unit_price: 99.99, vat_rate: 21 }));
    expect(r.vat_amount).toBe(21.0);
  });
});

describe('calcVatBreakdown + calcTotals', () => {
  it('rozdělí DPH podle sazeb a sečte celkem', () => {
    const items = [
      calcItemTotals(item({ quantity: 1, unit_price: 1000, vat_rate: 21 })),
      calcItemTotals(item({ id: '2', quantity: 2, unit_price: 500, vat_rate: 12 })),
    ];
    const breakdown = calcVatBreakdown(items);
    expect(breakdown).toHaveLength(2);
    const t = calcTotals(items);
    expect(t.subtotal).toBe(2000);
    expect(t.taxTotal).toBe(210 + 120);
    expect(t.total).toBe(2330);
  });
});

describe('generateInvoiceNumber', () => {
  const settings = {
    id: 's1', number_prefix: 'FV', number_format: '{PREFIX}{YYYY}{NNN}',
    next_number: 42, default_due_days: 14, default_vat_rate: 21,
    default_payment_method: 'bank_transfer', footer_text: '',
    reset_yearly: true, current_year: 2026,
    prefix_deposit_invoice: 'ZF', next_number_deposit_invoice: 7,
  } as InvoiceSettings;

  it('sestaví číslo podle formátu', () => {
    const year = new Date().getFullYear();
    expect(generateInvoiceNumber(settings)).toBe(`FV${year}042`);
  });

  it('použije čítač a prefix podle typu dokladu', () => {
    const year = new Date().getFullYear();
    expect(generateInvoiceNumber(settings, 'deposit_invoice')).toBe(`ZF${year}007`);
  });
});

describe('convertCzAccountToIban', () => {
  it('převede klasické číslo účtu na platný IBAN', () => {
    const iban = convertCzAccountToIban('19-2000145399/0800');
    expect(iban).toBe('CZ6508000000192000145399');
  });

  it('vrátí prázdný řetězec pro neplatný vstup', () => {
    expect(convertCzAccountToIban('nesmysl')).toBe('');
  });
});

describe('addDays', () => {
  it('přičte dny k datu', () => {
    expect(addDays('2026-01-31', 14)).toBe('2026-02-14');
  });
});
