import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

import { mergeQuoteSections, type QuoteSection, type QuoteItem } from '../quoteHelpers';

const mkItem = (over: Partial<QuoteItem> = {}): QuoteItem => ({
  id: 'i1', code: 'K1', name: 'Kabel', unit: 'm', quantity: 10,
  sellingPrice: 20, costPrice: 12, productId: 'p1',
  ...over,
});

const mkSection = (over: Partial<QuoteSection> = {}): QuoteSection => ({
  id: 's1', name: 'Elektro', trade: 'elektro', items: [mkItem()],
  ...over,
});

describe('mergeQuoteSections (B6)', () => {
  it('sloučí množství stejných položek ve stejném trade', () => {
    const base = [mkSection()];
    const add = [mkSection({ id: 's2', items: [mkItem({ quantity: 5 })] })];
    const merged = mergeQuoteSections(base, add);
    expect(merged).toHaveLength(1);
    expect(merged[0].items[0].quantity).toBe(15);
  });

  it('NEmutuje vstupní pole — opakované volání nezdvojuje množství', () => {
    const base = [mkSection()];
    const add = [mkSection({ id: 's2', items: [mkItem({ quantity: 5 })] })];

    mergeQuoteSections(base, add);
    // původní state musí zůstat nedotčený
    expect(base[0].items[0].quantity).toBe(10);
    expect(base[0].items).toHaveLength(1);

    // druhé volání se stejným vstupem dá stejný výsledek (idempotence)
    const merged2 = mergeQuoteSections(base, add);
    expect(merged2[0].items[0].quantity).toBe(15);
  });

  it('přidá novou sekci pro neznámý trade', () => {
    const base = [mkSection()];
    const add = [mkSection({ id: 's3', trade: 'topeni', items: [mkItem({ id: 'i9', productId: 'p9' })] })];
    const merged = mergeQuoteSections(base, add);
    expect(merged).toHaveLength(2);
    // ani nová sekce nesdílí referenci se vstupem
    merged[1].items[0].quantity = 999;
    expect(add[0].items[0].quantity).toBe(10);
  });
});
