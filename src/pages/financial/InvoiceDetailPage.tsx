import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, CreditCard as Edit2, Send, CreditCard, Ban, FileText, Loader2, CheckCircle2, Clock, AlertCircle, QrCode, Banknote, Building, Link2, ArrowRight, FileCheck, Receipt, ArrowDownCircle, Trash2, Plus } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import {
  calcVatBreakdown, formatCZK, formatDate, generateSpayd,
  type InvoiceItem, type VatBreakdown,
} from '../../lib/invoiceUtils';
import {
  INVOICE_TYPES, INVOICE_TYPE_LABELS, INVOICE_TYPE_COLORS, INVOICE_TYPE_PRINT_TITLE,
  INVOICE_TYPES_NO_PAYMENT, type InvoiceType,
} from '../../lib/invoiceTypes';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  taxable_date: string;
  due_date: string;
  status: string;
  client_id: string | null;
  project_id: string | null;
  client_name: string;
  client_ico: string;
  client_dic: string;
  client_address: string;
  issuer_name: string;
  issuer_ico: string;
  issuer_dic: string;
  issuer_address: string;
  variable_symbol: string;
  constant_symbol: string;
  payment_method: string;
  bank_account: string;
  iban: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  note: string;
  issued_by: string;
  paid_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  invoice_type: string;
  related_invoice_id: string | null;
  credit_reason: string | null;
  deposit_percent: number | null;
  quote_id: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  note: string;
  paid_at: string;
}

interface LinkedDoc {
  id: string;
  invoice_number: string;
  invoice_type: string;
  total: number;
  status: string;
  invoice_date: string;
  link_type: string;
  direction: 'outgoing' | 'incoming';
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  draft: { label: 'Koncept', color: 'text-slate-400', bg: 'bg-white/[0.06]', icon: FileText },
  sent: { label: 'Odeslaná', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Send },
  partial: { label: 'Částečně uhrazena', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  paid: { label: 'Zaplacená', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  overdue: { label: 'Po splatnosti', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
  cancelled: { label: 'Stornovaná', color: 'text-slate-400', bg: 'bg-white/[0.04]', icon: Ban },
};

const METHOD_LABELS: Record<string, { label: string; icon: typeof Banknote }> = {
  bank_transfer: { label: 'Bankovní převod', icon: Building },
  cash: { label: 'Hotovost', icon: Banknote },
  card: { label: 'Karta', icon: CreditCard },
};

const LINK_TYPE_LABELS: Record<string, string> = {
  deposit_to_settlement: 'Záloha pro vyúčtování',
  original_to_credit: 'Původní faktura',
  deposit_to_tax_doc: 'Záloha pro daňový doklad',
};

const TYPE_ICONS: Record<string, typeof FileText> = {
  [INVOICE_TYPES.STANDARD]: FileText,
  [INVOICE_TYPES.CREDIT_NOTE]: CreditCard,
  [INVOICE_TYPES.DEPOSIT_INVOICE]: ArrowDownCircle,
  [INVOICE_TYPES.TAX_DOCUMENT]: Receipt,
  [INVOICE_TYPES.SETTLEMENT_INVOICE]: FileCheck,
  [INVOICE_TYPES.CASH_RECEIPT]: Banknote,
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [relatedInvoice, setRelatedInvoice] = useState<{ invoice_number: string; total: number; invoice_type: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [showTaxDocPrompt, setShowTaxDocPrompt] = useState(false);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Finance', href: '/finance' },
        { label: 'Detail dokladu' },
      ],
    });
  }, [setConfig]);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    const [{ data: inv }, { data: itms }, { data: pmts }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
      supabase.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false }),
    ]);
    setInvoice(inv as Invoice | null);
    setItems((itms || []) as InvoiceItem[]);
    setPayments((pmts || []) as Payment[]);

    if (inv) {
      const [{ data: outLinks }, { data: inLinks }] = await Promise.all([
        supabase.from('invoice_document_links').select('*').eq('source_invoice_id', id),
        supabase.from('invoice_document_links').select('*').eq('target_invoice_id', id),
      ]);

      const docs: LinkedDoc[] = [];

      for (const link of (outLinks || [])) {
        const { data: target } = await supabase.from('invoices')
          .select('id, invoice_number, invoice_type, total, status, invoice_date')
          .eq('id', link.target_invoice_id).maybeSingle();
        if (target) docs.push({ ...target, link_type: link.link_type, direction: 'outgoing' });
      }
      for (const link of (inLinks || [])) {
        const { data: source } = await supabase.from('invoices')
          .select('id, invoice_number, invoice_type, total, status, invoice_date')
          .eq('id', link.source_invoice_id).maybeSingle();
        if (source) docs.push({ ...source, link_type: link.link_type, direction: 'incoming' });
      }

      setLinkedDocs(docs);

      if (inv.related_invoice_id) {
        const { data: rel } = await supabase.from('invoices')
          .select('invoice_number, total, invoice_type')
          .eq('id', inv.related_invoice_id).maybeSingle();
        setRelatedInvoice(rel || null);
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  useEffect(() => {
    if (!invoice) return;
    const remaining = invoice.total - (invoice.paid_amount || 0);
    const amountForQr = remaining > 0 ? remaining : invoice.total;
    const spaydStr = generateSpayd(invoice.iban, amountForQr, invoice.variable_symbol, 'CZK', invoice.bank_account);
    if (!spaydStr) { setQrDataUrl(''); return; }
    QRCode.toDataURL(spaydStr, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [invoice]);

  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    if (!invoice) return;
    const { error } = await supabase.from('invoices')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', invoice.id);
    if (error) { toast('Chyba', 'error'); return; }
    toast('Stav aktualizován');
    loadInvoice();
  };

  const handlePay = async () => {
    if (!invoice || payAmount <= 0) return;

    const { data: paymentData } = await supabase.from('payments').insert({
      invoice_id: invoice.id,
      amount: payAmount,
      method: payMethod,
      note: payNote,
      paid_at: new Date(payDate).toISOString(),
    }).select('id').maybeSingle();

    const newPaidAmount = (invoice.paid_amount || 0) + payAmount;
    const fullyPaid = newPaidAmount >= invoice.total;

    await supabase.from('invoices').update({
      paid_amount: newPaidAmount,
      status: fullyPaid ? 'paid' : 'partial',
      paid_at: fullyPaid ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', invoice.id);

    if (payMethod === 'cash' && paymentData?.id) {
      await supabase.from('cash_transactions').insert({
        transaction_type: 'income',
        amount: payAmount,
        description: `${INVOICE_TYPE_LABELS[invoice.invoice_type] || 'Faktura'} ${invoice.invoice_number} – ${invoice.client_name || 'platba hotově'}`,
        note: payNote,
        source: 'invoice_payment',
        reference_id: paymentData.id,
        performed_by: user?.id || null,
        performed_by_name: profile?.display_name || '',
        transaction_date: payDate,
        created_by: user!.id,
      });

      if (invoice.invoice_type === INVOICE_TYPES.STANDARD && fullyPaid) {
        toast('Platba hotově zaznamenána a zapsána do pokladny');
        setShowPayModal(false);
        setPayNote('');
        loadInvoice();
        return;
      }
    }

    toast(fullyPaid ? 'Doklad plně uhrazen' : `Zaznamenáno ${formatCZK(payAmount)} Kč`);
    setShowPayModal(false);
    setPayNote('');

    if (invoice.invoice_type === INVOICE_TYPES.DEPOSIT_INVOICE && fullyPaid) {
      setShowTaxDocPrompt(true);
    } else {
      loadInvoice();
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoice) return;
    await supabase.from('payments').delete().eq('invoice_id', invoice.id);
    await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
    await supabase.from('invoice_document_links').delete().or(`source_invoice_id.eq.${invoice.id},target_invoice_id.eq.${invoice.id}`);
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Doklad smazán');
    navigate('/finance');
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!invoice) return;
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;
    await supabase.from('payments').delete().eq('id', paymentId);
    const newPaid = Math.max(0, (invoice.paid_amount || 0) - Number(payment.amount));
    const newStatus = newPaid <= 0 ? 'sent' : newPaid < invoice.total ? 'partial' : 'paid';
    await supabase.from('invoices').update({
      paid_amount: newPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? invoice.paid_at : null,
      updated_at: new Date().toISOString(),
    }).eq('id', invoice.id);
    toast('Platba smazána');
    setDeletingPaymentId(null);
    loadInvoice();
  };

  const handlePrint = async () => {
    if (!invoice) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('Nelze otevřít okno tisku. Povolte pop-up okna pro tento web.', 'error');
      return;
    }

    const invType = (invoice.invoice_type as InvoiceType) || INVOICE_TYPES.STANDARD;
    const printTitle = INVOICE_TYPE_PRINT_TITLE[invType] || 'FAKTURA';

    const spaydStr = generateSpayd(invoice.iban, invoice.total - (invoice.paid_amount || 0), invoice.variable_symbol, 'CZK', invoice.bank_account);
    let qrImgTag = '';
    if (spaydStr && invoice.status !== 'paid' && invoice.payment_method === 'bank_transfer') {
      try {
        const qrUrl = await QRCode.toDataURL(spaydStr, { width: 120, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        qrImgTag = `<div class="qr-section">
          <img src="${qrUrl}" style="width:100px;height:100px;" />
          <div class="info"><strong>QR platba</strong>Naskenujte QR kód v mobilní bankovní aplikaci pro rychlou platbu.</div>
        </div>`;
      } catch { /* skip */ }
    }

    const vb = calcVatBreakdown(items);
    const typeColorHex = invType === INVOICE_TYPES.CREDIT_NOTE ? '#d97706'
      : invType === INVOICE_TYPES.DEPOSIT_INVOICE ? '#3b82f6'
      : invType === INVOICE_TYPES.TAX_DOCUMENT ? '#06b6d4'
      : invType === INVOICE_TYPES.SETTLEMENT_INVOICE ? '#10b981'
      : invType === INVOICE_TYPES.CASH_RECEIPT ? '#f97316'
      : '#334155';

    const relatedBlock = relatedInvoice ? `
      <div style="margin-bottom:16px;padding:10px 14px;border-left:3px solid ${typeColorHex};background:#f8fafc;border-radius:4px;font-size:11px;">
        <strong>Vazba na doklad:</strong> ${INVOICE_TYPE_LABELS[relatedInvoice.invoice_type] || 'Faktura'} ${relatedInvoice.invoice_number} – ${formatCZK(relatedInvoice.total)} Kč
        ${invoice.credit_reason ? `<br/><strong>Důvod:</strong> ${invoice.credit_reason}` : ''}
      </div>` : '';

    const html = `<!DOCTYPE html><html><head><title>${printTitle} ${invoice.invoice_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; font-size: 13px; line-height: 1.5; }
  .type-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background: ${typeColorHex}22; color: ${typeColorHex}; margin-bottom: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .header .meta { color: #94a3b8; font-size: 11px; }
  .header .meta span { color: #475569; font-weight: 600; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 28px; }
  .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 6px; }
  .party-name { font-size: 14px; font-weight: 700; }
  .party-detail { font-size: 11px; color: #64748b; margin-top: 2px; }
  .pay-info { background: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 28px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; font-size: 11px; }
  .pay-info .label { color: #94a3b8; }
  .pay-info .value { font-weight: 600; color: #334155; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
  th.right, td.right { text-align: right; }
  tbody td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-box { width: 280px; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #64748b; }
  .total-row span:last-child { font-weight: 600; }
  .grand-total { display: flex; justify-content: space-between; padding: 12px 0 0; margin-top: 8px; border-top: 2px solid #0f172a; font-size: 16px; font-weight: 800; color: #0f172a; }
  .note { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  .note-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 4px; }
  .note-text { font-size: 11px; color: #475569; }
  .qr-section { margin-top: 24px; display: flex; align-items: center; gap: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .qr-section .info { font-size: 11px; color: #64748b; }
  .qr-section .info strong { color: #0f172a; display: block; font-size: 12px; margin-bottom: 2px; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="type-badge">${printTitle}</div>
    <h1>${invoice.invoice_number}</h1>
    <div class="meta">
      Datum vystavení: <span>${formatDate(invoice.invoice_date)}</span><br/>
      Datum zdan. plnění: <span>${formatDate(invoice.taxable_date)}</span>
      ${invoice.due_date ? `<br/>Splatnost: <span>${formatDate(invoice.due_date)}</span>` : ''}
    </div>
  </div>
</div>
${relatedBlock}
<div class="parties">
  <div>
    <div class="party-label">Dodavatel</div>
    <div class="party-name">${invoice.issuer_name || ''}</div>
    ${invoice.issuer_ico ? `<div class="party-detail">IČO: ${invoice.issuer_ico}</div>` : ''}
    ${invoice.issuer_dic ? `<div class="party-detail">DIČ: ${invoice.issuer_dic}</div>` : ''}
    ${invoice.issuer_address ? `<div class="party-detail" style="margin-top:4px">${invoice.issuer_address}</div>` : ''}
  </div>
  <div>
    <div class="party-label">Odběratel</div>
    <div class="party-name">${invoice.client_name || ''}</div>
    ${invoice.client_ico ? `<div class="party-detail">IČO: ${invoice.client_ico}</div>` : ''}
    ${invoice.client_dic ? `<div class="party-detail">DIČ: ${invoice.client_dic}</div>` : ''}
    ${invoice.client_address ? `<div class="party-detail" style="margin-top:4px">${invoice.client_address}</div>` : ''}
  </div>
</div>
<div class="pay-info">
  <div><div class="label">Způsob platby</div><div class="value">${invoice.payment_method === 'bank_transfer' ? 'Bankovní převod' : invoice.payment_method === 'cash' ? 'Hotovost' : 'Kartou'}</div></div>
  ${invoice.bank_account ? `<div><div class="label">Číslo účtu</div><div class="value">${invoice.bank_account}</div></div>` : ''}
  ${invoice.variable_symbol ? `<div><div class="label">Variabilní symbol</div><div class="value">${invoice.variable_symbol}</div></div>` : ''}
  ${invoice.constant_symbol ? `<div><div class="label">Konstantní symbol</div><div class="value">${invoice.constant_symbol}</div></div>` : ''}
</div>
<table>
  <thead><tr>
    <th>Popis</th><th class="right" style="width:70px">Množství</th><th style="width:50px">Jedn.</th>
    <th class="right" style="width:90px">Cena/j.</th><th class="right" style="width:50px">DPH</th>
    <th class="right" style="width:100px">Celkem</th>
  </tr></thead>
  <tbody>
    ${items.map(it => `<tr>
      <td>${it.description}</td><td class="right">${it.quantity}</td><td>${it.unit}</td>
      <td class="right">${formatCZK(it.unit_price)}</td><td class="right">${it.vat_rate}%</td>
      <td class="right" style="font-weight:600">${formatCZK(it.total_price)} Kč</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="totals"><div class="totals-box">
  <div class="total-row"><span>Základ celkem</span><span>${formatCZK(invoice.subtotal || 0)} Kč</span></div>
  ${vb.map(v => `<div class="total-row"><span>DPH ${v.rate}% (základ ${formatCZK(v.base)} Kč)</span><span>${formatCZK(v.vat)} Kč</span></div>`).join('')}
  <div class="grand-total"><span>Celkem k úhradě</span><span>${formatCZK(invoice.total || 0)} Kč</span></div>
</div></div>
${invoice.note ? `<div class="note"><div class="note-label">Poznámka</div><div class="note-text">${invoice.note}</div></div>` : ''}
${qrImgTag}
${invoice.issued_by ? `<div class="footer">Vystavil: ${invoice.issued_by}</div>` : ''}
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Doklad nenalezen</p>
        <button onClick={() => navigate('/finance')} className="text-sm text-blue-400 mt-2 hover:underline">Zpět</button>
      </div>
    );
  }

  const invType = (invoice.invoice_type as InvoiceType) || INVOICE_TYPES.STANDARD;
  const typeColors = INVOICE_TYPE_COLORS[invType] || INVOICE_TYPE_COLORS[INVOICE_TYPES.STANDARD];
  const typeLabel = INVOICE_TYPE_LABELS[invType] || 'Faktura';
  const TypeIcon = TYPE_ICONS[invType] || FileText;
  const canShowQr = invType !== INVOICE_TYPES.CASH_RECEIPT && invoice.payment_method === 'bank_transfer';
  const canRecordPayment = !INVOICE_TYPES_NO_PAYMENT.includes(invType);

  const effectiveStatus = invoice.status === 'sent' && invoice.due_date && new Date(invoice.due_date) < new Date() ? 'overdue' : invoice.status;
  const st = STATUS_CFG[effectiveStatus] || STATUS_CFG.draft;
  const StIcon = st.icon;
  const vatBreakdown: VatBreakdown[] = calcVatBreakdown(items);
  const remaining = invoice.total - (invoice.paid_amount || 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/finance')} className="p-2 rounded-xl hover:bg-white/[0.06] transition">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <TypeIcon className={`w-4 h-4 ${typeColors.text}`} />
                <h1 className="text-xl font-extrabold text-white">{invoice.invoice_number}</h1>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${st.bg} ${st.color}`}>
                  <StIcon className="w-3 h-3 inline mr-1" />
                  {st.label}
                </span>
              </div>
              <p className={`text-xs font-bold mt-0.5 ${typeColors.text}`}>{typeLabel.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.status === 'draft' && (
              <>
                <button onClick={() => navigate(`/finance/faktura/${invoice.id}/edit`)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg transition">
                  <Edit2 className="w-3.5 h-3.5" /> Upravit
                </button>
                <button onClick={() => updateStatus('sent', { sent_at: new Date().toISOString() })} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition">
                  <Send className="w-3.5 h-3.5" /> Odeslat
                </button>
              </>
            )}
            {canRecordPayment && (invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue') && (
              <>
                <button onClick={() => { setPayAmount(remaining > 0 ? remaining : invoice.total); setPayDate(new Date().toISOString().split('T')[0]); setPayNote(''); setShowPayModal(true); }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition">
                  <CreditCard className="w-3.5 h-3.5" /> Zaplatit
                </button>
                <button onClick={() => updateStatus('cancelled', { cancelled_at: new Date().toISOString() })} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition">
                  <Ban className="w-3.5 h-3.5" /> Storno
                </button>
              </>
            )}
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg transition">
              <Printer className="w-3.5 h-3.5" /> PDF / Tisk
            </button>
            {profile?.role === 'admin' && (
              <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition">
                <Trash2 className="w-3.5 h-3.5" /> Smazat
              </button>
            )}
          </div>
        </div>

        {relatedInvoice && (
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${typeColors.bg} ${typeColors.border}`}>
            <Link2 className={`w-5 h-5 shrink-0 ${typeColors.text}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold uppercase tracking-wide ${typeColors.text}`}>
                {invType === INVOICE_TYPES.CREDIT_NOTE ? 'Opravuje fakturu' : invType === INVOICE_TYPES.SETTLEMENT_INVOICE ? 'Záloha odečtena' : 'Na základě dokladu'}
              </p>
              <p className="text-sm font-semibold text-white mt-0.5">
                {INVOICE_TYPE_LABELS[relatedInvoice.invoice_type] || 'Faktura'} {relatedInvoice.invoice_number} – {formatCZK(relatedInvoice.total)} Kč
              </p>
              {invoice.credit_reason && <p className="text-xs text-slate-400 mt-0.5">Důvod: {invoice.credit_reason}</p>}
            </div>
            <button
              onClick={() => navigate(`/finance/faktura/${invoice.related_invoice_id}`)}
              className={`text-xs font-bold flex items-center gap-1 ${typeColors.text} hover:underline shrink-0`}
            >
              Zobrazit <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {canShowQr && qrDataUrl && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 flex items-center gap-6">
            <div className="shrink-0">
              <img src={qrDataUrl} alt="QR platba" className="w-36 h-36 rounded-lg border border-white/[0.06] bg-white p-1" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">QR platba (SPAYD)</h3>
              </div>
              <p className="text-xs text-slate-500">Naskenujte QR kód v mobilní bankovní aplikaci pro rychlou platbu.</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {invoice.bank_account && (
                  <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                    <span className="text-slate-400 block">Číslo účtu</span>
                    <span className="font-bold text-slate-300">{invoice.bank_account}</span>
                  </div>
                )}
                <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                  <span className="text-slate-400 block">VS</span>
                  <span className="font-bold text-slate-300">{invoice.variable_symbol}</span>
                </div>
                <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                  <span className="text-slate-400 block">Zbývá uhradit</span>
                  <span className="font-bold text-slate-300">{formatCZK(remaining > 0 ? remaining : 0)} Kč</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={printRef} className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
          <div className="p-8">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold mb-2 ${typeColors.bg} ${typeColors.text}`}>
                  <TypeIcon className="w-3.5 h-3.5" />
                  {typeLabel.toUpperCase()}
                </div>
                <h2 className="text-2xl font-extrabold text-white mb-1">{invoice.invoice_number}</h2>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>Datum vystavení: <span className="font-semibold text-slate-400">{formatDate(invoice.invoice_date)}</span></div>
                  <div>Datum zdan. plnění: <span className="font-semibold text-slate-400">{formatDate(invoice.taxable_date)}</span></div>
                  {invoice.due_date && <div>Splatnost: <span className="font-semibold text-slate-400">{formatDate(invoice.due_date)}</span></div>}
                  {invoice.deposit_percent && <div>Záloha: <span className="font-semibold text-blue-300">{invoice.deposit_percent}%</span></div>}
                </div>
              </div>
              <div className={`px-4 py-2 rounded-xl text-sm font-bold ${st.bg} ${st.color}`}>
                {st.label}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Dodavatel</div>
                <div className="text-sm font-bold text-white">{invoice.issuer_name}</div>
                {invoice.issuer_ico && <div className="text-xs text-slate-500">IČO: {invoice.issuer_ico}</div>}
                {invoice.issuer_dic && <div className="text-xs text-slate-500">DIČ: {invoice.issuer_dic}</div>}
                {invoice.issuer_address && <div className="text-xs text-slate-500 mt-1">{invoice.issuer_address}</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Odběratel</div>
                <div className="text-sm font-bold text-white">{invoice.client_name}</div>
                {invoice.client_ico && <div className="text-xs text-slate-500">IČO: {invoice.client_ico}</div>}
                {invoice.client_dic && <div className="text-xs text-slate-500">DIČ: {invoice.client_dic}</div>}
                {invoice.client_address && <div className="text-xs text-slate-500 mt-1">{invoice.client_address}</div>}
              </div>
            </div>

            <div className="bg-white/[0.04] rounded-xl p-4 mb-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Způsob platby</span>
                  <div className="font-semibold text-slate-300">{METHOD_LABELS[invoice.payment_method]?.label || invoice.payment_method}</div>
                </div>
                {invoice.bank_account && <div><span className="text-slate-400">Číslo účtu</span><div className="font-semibold text-slate-300">{invoice.bank_account}</div></div>}
                {invoice.variable_symbol && <div><span className="text-slate-400">Variabilní symbol</span><div className="font-semibold text-slate-300">{invoice.variable_symbol}</div></div>}
                {invoice.constant_symbol && <div><span className="text-slate-400">Konstantní symbol</span><div className="font-semibold text-slate-300">{invoice.constant_symbol}</div></div>}
              </div>
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b-2 border-white/10">
                  <th className="pb-3 pr-4">Popis</th>
                  <th className="pb-3 pr-4 text-right w-20">Množství</th>
                  <th className="pb-3 pr-4 w-16">Jedn.</th>
                  <th className="pb-3 pr-4 text-right w-24">Cena/j.</th>
                  <th className="pb-3 pr-4 text-right w-16">DPH</th>
                  <th className="pb-3 text-right w-28">Celkem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 pr-4 text-white">{item.description}</td>
                    <td className="py-3 pr-4 text-right text-slate-400 tabular-nums">{item.quantity}</td>
                    <td className="py-3 pr-4 text-slate-500">{item.unit}</td>
                    <td className="py-3 pr-4 text-right text-slate-400 tabular-nums">{formatCZK(item.unit_price)}</td>
                    <td className="py-3 pr-4 text-right text-slate-500">{item.vat_rate}%</td>
                    <td className="py-3 text-right font-semibold text-white tabular-nums">{formatCZK(item.total_price)} Kč</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-80">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Základ celkem</span>
                    <span className="font-semibold tabular-nums">{formatCZK(invoice.subtotal)} Kč</span>
                  </div>
                  {vatBreakdown.map(vb => (
                    <div key={vb.rate} className="flex justify-between text-slate-500">
                      <span>DPH {vb.rate}% (základ {formatCZK(vb.base)} Kč)</span>
                      <span className="font-semibold tabular-nums">{formatCZK(vb.vat)} Kč</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 border-t-2 border-slate-900 text-lg font-extrabold text-white">
                    <span>Celkem k úhradě</span>
                    <span className="tabular-nums">{formatCZK(invoice.total)} Kč</span>
                  </div>
                </div>
              </div>
            </div>

            {invoice.note && (
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Poznámka</div>
                <div className="text-sm text-slate-400 whitespace-pre-wrap">{invoice.note}</div>
              </div>
            )}
          </div>
        </div>

        {linkedDocs.length > 0 && (
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-white">Navázané doklady</h3>
            </div>
            <div className="p-4 space-y-2">
              {linkedDocs.map(doc => {
                const docColors = INVOICE_TYPE_COLORS[doc.invoice_type] || INVOICE_TYPE_COLORS[INVOICE_TYPES.STANDARD];
                const DocIcon = TYPE_ICONS[doc.invoice_type] || FileText;
                const docSt = STATUS_CFG[doc.status] || STATUS_CFG.draft;
                return (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/finance/faktura/${doc.id}`)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] transition text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${docColors.bg}`}>
                      <DocIcon className={`w-4 h-4 ${docColors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{doc.invoice_number}</span>
                        <span className={`text-[10px] font-bold ${docColors.text}`}>{INVOICE_TYPE_LABELS[doc.invoice_type] || 'Doklad'}</span>
                        <span className={`text-[10px] font-bold ${docSt.color}`}>{docSt.label}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {LINK_TYPE_LABELS[doc.link_type] || doc.link_type} · {formatDate(doc.invoice_date)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-300 tabular-nums shrink-0">
                      {formatCZK(doc.total)} Kč
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {canRecordPayment && (
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-white">Přehled plateb</h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400">Uhrazeno: <span className="font-bold text-emerald-400">{formatCZK(totalPaid)} Kč</span></span>
                <span className="text-slate-400">Zbývá: <span className={`font-bold ${remaining > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{formatCZK(remaining > 0 ? remaining : 0)} Kč</span></span>
                <span className="text-slate-400">Celkem: <span className="font-bold text-slate-300">{formatCZK(invoice.total)} Kč</span></span>
              </div>
            </div>

            {totalPaid > 0 && (
              <div className="px-6 py-2">
                <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${totalPaid >= invoice.total ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min((totalPaid / invoice.total) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="p-6">
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Banknote className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">Zatím žádné platby</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(p => {
                    const ml = METHOD_LABELS[p.method] || METHOD_LABELS.bank_transfer;
                    const MIcon = ml.icon;
                    return (
                      <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] transition group">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <MIcon className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{ml.label}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(p.paid_at).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {p.note && <span className="ml-2 text-slate-500">– {p.note}</span>}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-emerald-400 tabular-nums shrink-0">
                          +{formatCZK(Number(p.amount))} Kč
                        </div>
                        {profile?.role === 'admin' && (
                          <button
                            onClick={() => setDeletingPaymentId(p.id)}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Zaznamenat platbu" size="sm" footer={
        <>
          <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handlePay} disabled={payAmount <= 0} className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50">Zaznamenat</button>
        </>
      }>
        <div className="space-y-4">
          <div className="bg-white/[0.04] rounded-xl p-3 text-xs flex justify-between">
            <span className="text-slate-500">Zbývá uhradit</span>
            <span className="font-bold text-white">{formatCZK(remaining > 0 ? remaining : 0)} Kč z {formatCZK(invoice.total)} Kč</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Částka (Kč)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum platby</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Metoda</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="bank_transfer">Bankovní převod</option>
              <option value="cash">Hotovost</option>
              <option value="card">Karta</option>
            </select>
          </div>
          {invoice.invoice_type === INVOICE_TYPES.DEPOSIT_INVOICE && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300">
              Po plném uhrazení zálohy bude nabídnuto vytvoření daňového dokladu.
            </div>
          )}
          {payMethod === 'cash' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">
              Platba hotově bude automaticky zapsána do pokladny jako příjmový doklad.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Volitelná poznámka..." className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
      </Modal>

      <Modal open={showTaxDocPrompt} onClose={() => { setShowTaxDocPrompt(false); loadInvoice(); }} title="Záloha uhrazena" size="sm" footer={
        <>
          <button onClick={() => { setShowTaxDocPrompt(false); loadInvoice(); }} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Přeskočit</button>
          <button
            onClick={() => {
              setShowTaxDocPrompt(false);
              loadInvoice();
              navigate(`/finance/faktura/nova?type=tax_document&related=${invoice.id}`);
            }}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Vytvořit daňový doklad
          </button>
        </>
      }>
        <div className="space-y-3">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-cyan-300 mb-1">Záloha {invoice.invoice_number} byla plně uhrazena.</p>
            <p className="text-slate-400 text-xs">Chcete automaticky vytvořit daňový doklad k přijaté platbě?</p>
          </div>
          <div className="text-xs text-slate-500 bg-white/[0.04] rounded-xl p-3">
            <div className="flex justify-between mb-1">
              <span>Záloha</span>
              <span className="font-semibold text-slate-300">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span>Uhrazená částka</span>
              <span className="font-semibold text-slate-300">{formatCZK(invoice.total)} Kč</span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Smazat doklad" size="sm" footer={
        <>
          <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleDeleteInvoice} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition">
            <Trash2 className="w-4 h-4" /> Smazat trvale
          </button>
        </>
      }>
        <div className="space-y-3">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-red-400 mb-1">Tato akce je nevratná!</p>
            <p className="text-slate-400 text-xs">Doklad <strong className="text-white">{invoice.invoice_number}</strong> bude trvale smazán včetně všech plateb a vazeb na jiné doklady.</p>
          </div>
        </div>
      </Modal>

      <Modal open={!!deletingPaymentId} onClose={() => setDeletingPaymentId(null)} title="Smazat platbu" size="sm" footer={
        <>
          <button onClick={() => setDeletingPaymentId(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={() => deletingPaymentId && handleDeletePayment(deletingPaymentId)} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition">
            <Trash2 className="w-4 h-4" /> Smazat platbu
          </button>
        </>
      }>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm">
          <p className="font-semibold text-red-400 mb-1">Smazat tuto platbu?</p>
          <p className="text-slate-400 text-xs">Úhrada bude odstraněna a stav dokladu bude přepočítán.</p>
        </div>
      </Modal>
    </>
  );
}
