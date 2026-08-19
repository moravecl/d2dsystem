import { supabase } from './supabase';
import type { QuoteSection, QuoteSourceMeta, QuoteAttachment, QuoteSystemSummary } from '../components/catalog/quoteHelpers';
import { calcSectionTotal, calcSectionCostTotal } from '../components/catalog/quoteHelpers';

interface UnassignedItem {
  elementId: string;
  elementTypeName: string;
  quantity: number;
  roomName: string | null;
}

interface SaveQuoteParams {
  projectId: string;
  userId: string | null;
  sections: QuoteSection[];
  globalDiscount?: number;
  note?: string;
  sourceType?: QuoteSourceMeta['sourceType'];
  sourceMeta?: QuoteSourceMeta;
  attachments?: QuoteAttachment[];
  summaries?: QuoteSystemSummary[];
  overwriteQuoteId?: string | null;
  unassignedItems?: UnassignedItem[];
}

export async function saveQuoteDirectly(params: SaveQuoteParams): Promise<{ error: string | null }> {
  const {
    projectId,
    userId,
    sections,
    globalDiscount = 0,
    note = '',
    sourceType = 'manual',
    sourceMeta,
    attachments = [],
    summaries = [],
    overwriteQuoteId,
    unassignedItems = [],
  } = params;

  const totalSelling = sections.reduce((s, sec) => {
    const secTotal = calcSectionTotal(sec);
    return s + secTotal;
  }, 0) * (1 - globalDiscount / 100);

  const totalCost = sections.reduce((s, sec) => s + calcSectionCostTotal(sec), 0);

  const payload = {
    note,
    sections_data: { sections, globalDiscount, unassignedItems },
    total_selling: Number.isFinite(totalSelling) ? totalSelling : 0,
    total_cost: Number.isFinite(totalCost) ? totalCost : 0,
    source_type: sourceType !== 'manual' ? sourceType : null,
    source_metadata: sourceMeta ?? null,
    attachments: (attachments.length > 0 || summaries.length > 0)
      ? { images: attachments, summaries }
      : null,
  };

  if (overwriteQuoteId) {
    const { error } = await supabase
      .from('project_quotes')
      .update({ ...payload, changelog: 'Aktualizace stavajici verze' })
      .eq('id', overwriteQuoteId);
    if (error) return { error: error.message };
    return { error: null };
  }

  let query = supabase
    .from('project_quotes')
    .select('version, quote_number')
    .eq('project_id', projectId);

  if (sourceType && sourceType !== 'manual') {
    query = query.eq('source_type', sourceType);
  } else {
    query = query.or('source_type.is.null,source_type.eq.manual');
  }

  const { data: existing } = await query
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;
  const prefixMap: Record<string, string> = { fve: 'FVE', camera: 'CAM', eps: 'EPS' };
  const prefix = (sourceType && prefixMap[sourceType]) || 'Q';
  const quoteNumber = existing?.quote_number || `${prefix}-${Date.now().toString(36).toUpperCase()}`;

  const { error } = await supabase.from('project_quotes').insert({
    ...payload,
    project_id: projectId,
    version: nextVersion,
    quote_number: quoteNumber,
    changelog: nextVersion === 1 ? 'Prvni verze nabidky' : `Verze ${nextVersion}`,
    created_by: userId,
  });

  if (error) return { error: error.message };
  return { error: null };
}
