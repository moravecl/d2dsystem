import { supabase } from './supabase';

/** Naceněná materiálová položka z sections_data nabídky. */
export interface PlannedQuoteItem {
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  productId?: string | null;
  trade: string;
  sectionName: string;
  quoteId: string | null;
}

const TRADE_LABELS: Record<string, string> = {
  electric: 'Elektro', water: 'Voda', heating: 'Topení',
  recuperation: 'Rekuperace', lighting: 'Osvětlení',
};

/** Vytáhne naceněné položky ze sections_data nabídek (stejná logika jako MaterialModule). */
export function extractPlannedQuoteItems(
  quoteRows: { id?: string | null; sections_data?: unknown }[],
): PlannedQuoteItem[] {
  const items: PlannedQuoteItem[] = [];
  for (const quote of quoteRows) {
    const raw = quote?.sections_data as { sections?: unknown[] } | unknown[] | null;
    if (!raw) continue;
    const sections = Array.isArray(raw) ? raw : (Array.isArray(raw?.sections) ? raw.sections : []);
    for (const sec of sections as { trade?: string; name?: string; items?: unknown[] }[]) {
      if (!sec || !Array.isArray(sec.items)) continue;
      const sectionTrade = sec.trade || 'electric';
      const sectionName = sec.name || TRADE_LABELS[sectionTrade] || sectionTrade;
      for (const item of sec.items as { name?: string; unit?: string; quantity?: number; sellingPrice?: number; productId?: string | null }[]) {
        if (!item?.name) continue;
        items.push({
          name: item.name, unit: item.unit || 'ks', quantity: item.quantity || 0,
          sellingPrice: item.sellingPrice || 0, productId: item.productId,
          trade: sectionTrade, sectionName, quoteId: quote.id || null,
        });
      }
    }
  }
  return items;
}

/** Načte naceněné položky všech nabídek zahrnutých v zakázce (jobs.quote_id + included_quote_ids). */
export async function loadJobPlannedItems(jobId: string): Promise<PlannedQuoteItem[]> {
  const { data: job } = await supabase.from('jobs')
    .select('quote_id, included_quote_ids').eq('id', jobId).maybeSingle();
  if (!job) return [];
  const ids = [...new Set([...(job.included_quote_ids || []), job.quote_id].filter(Boolean))] as string[];
  if (ids.length === 0) return [];
  const { data: quotes } = await supabase.from('project_quotes')
    .select('id, sections_data').in('id', ids);
  return extractPlannedQuoteItems((quotes || []) as { id: string; sections_data: unknown }[]);
}

/** Najde naceněnou položku podle názvu — nejdřív přesně, pak bez ohledu na velikost písmen a mezery. */
export function matchPlannedItem(items: PlannedQuoteItem[], name: string): PlannedQuoteItem | undefined {
  const exact = items.find(p => p.name === name);
  if (exact) return exact;
  const norm = name.trim().toLowerCase();
  return items.find(p => p.name.trim().toLowerCase() === norm);
}
