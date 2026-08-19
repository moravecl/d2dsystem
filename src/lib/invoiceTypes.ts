export const INVOICE_TYPES = {
  STANDARD: 'standard',
  CREDIT_NOTE: 'credit_note',
  DEPOSIT_INVOICE: 'deposit_invoice',
  TAX_DOCUMENT: 'tax_document',
  SETTLEMENT_INVOICE: 'settlement_invoice',
  CASH_RECEIPT: 'cash_receipt',
} as const;

export type InvoiceType = typeof INVOICE_TYPES[keyof typeof INVOICE_TYPES];

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  [INVOICE_TYPES.STANDARD]: 'Faktura',
  [INVOICE_TYPES.CREDIT_NOTE]: 'Dobropis',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'Zálohová faktura',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'Daňový doklad k přijaté platbě',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'Vyúčtovací faktura',
  [INVOICE_TYPES.CASH_RECEIPT]: 'Pokladní doklad',
};

export const INVOICE_TYPE_SHORT_LABELS: Record<string, string> = {
  [INVOICE_TYPES.STANDARD]: 'Faktura',
  [INVOICE_TYPES.CREDIT_NOTE]: 'Dobropis',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'Záloha',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'Daňový doklad',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'Vyúčtování',
  [INVOICE_TYPES.CASH_RECEIPT]: 'Pokladní doklad',
};

export const INVOICE_TYPE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  [INVOICE_TYPES.STANDARD]: { text: 'text-slate-300', bg: 'bg-white/[0.06]', border: 'border-white/10' },
  [INVOICE_TYPES.CREDIT_NOTE]: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  [INVOICE_TYPES.DEPOSIT_INVOICE]: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  [INVOICE_TYPES.TAX_DOCUMENT]: { text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  [INVOICE_TYPES.CASH_RECEIPT]: { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
};

export const INVOICE_TYPE_NUMBERING_PREFIX: Record<string, string> = {
  [INVOICE_TYPES.STANDARD]: '',
  [INVOICE_TYPES.CREDIT_NOTE]: 'D',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'Z',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'DD',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'V',
  [INVOICE_TYPES.CASH_RECEIPT]: 'P',
};

export const INVOICE_TYPE_PRINT_TITLE: Record<string, string> = {
  [INVOICE_TYPES.STANDARD]: 'FAKTURA',
  [INVOICE_TYPES.CREDIT_NOTE]: 'DOBROPIS',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'ZÁLOHOVÁ FAKTURA',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'DAŇOVÝ DOKLAD K PŘIJATÉ PLATBĚ',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'VYÚČTOVACÍ FAKTURA',
  [INVOICE_TYPES.CASH_RECEIPT]: 'POKLADNÍ DOKLAD',
};

export const INVOICE_TYPE_DESCRIPTIONS: Record<string, string> = {
  [INVOICE_TYPES.STANDARD]: 'Běžná faktura za dodané zboží nebo služby',
  [INVOICE_TYPES.CREDIT_NOTE]: 'Opravný daňový doklad – snížení nebo zrušení fakturované částky',
  [INVOICE_TYPES.DEPOSIT_INVOICE]: 'Faktura na zálohu před dodáním zboží nebo poskytnutím služby',
  [INVOICE_TYPES.TAX_DOCUMENT]: 'Daňový doklad vystavený po přijetí zálohy (potvrzení zálohy)',
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: 'Konečné vyúčtování s odečtením již zaplacených záloh',
  [INVOICE_TYPES.CASH_RECEIPT]: 'Doklad o příjmu nebo výdaji hotovosti z pokladny',
};

export const INVOICE_TYPES_REQUIRING_RELATED: InvoiceType[] = [
  INVOICE_TYPES.CREDIT_NOTE,
  INVOICE_TYPES.TAX_DOCUMENT,
  INVOICE_TYPES.SETTLEMENT_INVOICE,
];

export const INVOICE_TYPES_CASH_ONLY: InvoiceType[] = [
  INVOICE_TYPES.CASH_RECEIPT,
];

export const INVOICE_TYPES_NO_PAYMENT: InvoiceType[] = [
  INVOICE_TYPES.TAX_DOCUMENT,
];
