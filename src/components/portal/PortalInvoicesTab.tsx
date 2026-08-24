import { useState, useEffect, useCallback } from 'react';
import {
  FileText, CheckCircle2, Clock, AlertCircle, QrCode, Printer, Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  calcVatBreakdown, formatCZK, formatDate, generateSpayd,
  type InvoiceItem, type VatBreakdown,
} from '../../lib/invoiceUtils';
import Modal from '../ui/Modal';

interface PortalInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  taxable_date: string;
  due_date: string;
  status: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  paid_amount: number;
  client_name: string;
  client_ico: string;
  client_dic: string;
  client_address: string;
  issuer_name: string;
  issuer_ico: string;
  issuer_dic: string;
  issuer_address: string;
  payment_method: string;
  bank_account: string;
  iban: string;
  variable_symbol: string;
  constant_symbol: string;
  note: string;
  paid_at: string | null;
  invoice_type: string;
}

interface Props {
  projectId: string;
  clientId: string;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Koncept', color: 'text-slate-500', bg: 'bg-white/[0.06]' },
  sent: { label: 'K úhradě', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  partial: { label: 'Částečně uhrazena', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  paid: { label: 'Zaplacena', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  overdue: { label: 'Po splatnosti', color: 'text-red-400', bg: 'bg-red-500/10' },
  cancelled: { label: 'Stornovana', color: 'text-slate-400', bg: 'bg-white/[0.04]' },
};

export default function PortalInvoicesTab({ projectId, clientId }: Props) {
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<PortalInvoice | null>(null);
  const [detailItems, setDetailItems] = useState<InvoiceItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadInvoices = useCallback(async () => {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, taxable_date, due_date, status, total, subtotal, tax_amount, paid_amount, client_name, client_ico, client_dic, client_address, issuer_name, issuer_ico, issuer_dic, issuer_address, payment_method, bank_account, iban, variable_symbol, constant_symbol, note, paid_at, invoice_type')
      .eq('project_id', projectId)
      .eq('client_id', clientId)
      .in('status', ['sent', 'paid', 'partial', 'overdue'])
      .order('invoice_date', { ascending: false });
    setInvoices((data || []) as PortalInvoice[]);
    setLoading(false);
  }, [projectId, clientId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const openDetail = async (inv: PortalInvoice) => {
    setDetailInvoice(inv);
    setDetailLoading(true);
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
      .order('sort_order');
    setDetailItems((data || []) as InvoiceItem[]);
    setDetailLoading(false);
  };

  const handlePrint = () => {
    if (!detailInvoice) return;
    const inv = detailInvoice;
    const items = detailItems;
    const spayd = generateSpayd(inv.iban, inv.total - (inv.paid_amount || 0), inv.variable_symbol);
    const vb = calcVatBreakdown(items);

    const pw = window.open('', '_blank');
    if (!pw) return;

    pw.document.write(`<!DOCTYPE html><html><head><title>Faktura ${inv.invoice_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; font-size: 13px; line-height: 1.5; }
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
  .qr-section img { width: 100px; height: 100px; }
  .qr-section .info { font-size: 11px; color: #64748b; }
  .qr-section .info strong { color: #0f172a; display: block; font-size: 12px; margin-bottom: 2px; }
  @media print { body { padding: 20px; } }
</style></head><body>`);

    pw.document.write(`
<div class="header"><div>
  <h1>${inv.invoice_type === 'credit_note' ? 'DOBROPIS' : 'FAKTURA'} ${inv.invoice_number}</h1>
  <div class="meta">Datum vystavení: <span>${formatDate(inv.invoice_date)}</span><br/>Datum zdan. plnění: <span>${formatDate(inv.taxable_date)}</span><br/>Splatnost: <span>${formatDate(inv.due_date)}</span></div>
</div></div>

<div class="parties">
  <div>
    <div class="party-label">Dodavatel</div>
    <div class="party-name">${inv.issuer_name}</div>
    ${inv.issuer_ico ? `<div class="party-detail">ICO: ${inv.issuer_ico}</div>` : ''}
    ${inv.issuer_dic ? `<div class="party-detail">DIC: ${inv.issuer_dic}</div>` : ''}
    ${inv.issuer_address ? `<div class="party-detail" style="margin-top:4px">${inv.issuer_address}</div>` : ''}
  </div>
  <div>
    <div class="party-label">Odberatel</div>
    <div class="party-name">${inv.client_name}</div>
    ${inv.client_ico ? `<div class="party-detail">ICO: ${inv.client_ico}</div>` : ''}
    ${inv.client_dic ? `<div class="party-detail">DIC: ${inv.client_dic}</div>` : ''}
    ${inv.client_address ? `<div class="party-detail" style="margin-top:4px">${inv.client_address}</div>` : ''}
  </div>
</div>

<div class="pay-info">
  <div><div class="label">Způsob platby</div><div class="value">${inv.payment_method === 'bank_transfer' ? 'Bankovní převod' : inv.payment_method === 'cash' ? 'Hotovost' : 'Kartou'}</div></div>
  ${inv.bank_account ? `<div><div class="label">Číslo účtu</div><div class="value">${inv.bank_account}</div></div>` : ''}
  ${inv.variable_symbol ? `<div><div class="label">Variabilní symbol</div><div class="value">${inv.variable_symbol}</div></div>` : ''}
  ${inv.constant_symbol ? `<div><div class="label">Konstantní symbol</div><div class="value">${inv.constant_symbol}</div></div>` : ''}
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
</table>`);

    pw.document.write(`
<div class="totals"><div class="totals-box">
  <div class="total-row"><span>Základ celkem</span><span>${formatCZK(inv.subtotal)} Kč</span></div>
  ${vb.map(v => `<div class="total-row"><span>DPH ${v.rate}% (základ ${formatCZK(v.base)} Kč)</span><span>${formatCZK(v.vat)} Kč</span></div>`).join('')}
  <div class="grand-total"><span>Celkem k úhradě</span><span>${formatCZK(inv.total)} Kč</span></div>
</div></div>`);

    if (inv.note) {
      pw.document.write(`<div class="note"><div class="note-label">Poznámka</div><div class="note-text">${inv.note}</div></div>`);
    }
    if (spayd && inv.status !== 'paid') {
      pw.document.write(`<div class="qr-section">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(spayd)}" />
        <div class="info"><strong>QR platba</strong>Naskenujte QR kód v mobilní bankovní aplikaci pro rychlou platbu.</div>
      </div>`);
    }

    pw.document.write('</body></html>');
    pw.document.close();
    setTimeout(() => { pw.print(); }, 500);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-20 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500 mb-1">Žádné faktury</p>
        <p className="text-xs text-slate-400">K tomuto projektu zatím nebyly vystaveny žádné faktury.</p>
      </div>
    );
  }

  const totalDue = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'partial')
    .reduce((s, i) => s + i.total - (i.paid_amount || 0), 0);

  return (
    <div className="space-y-4">
      {totalDue > 0 && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-800">K úhradě celkem: {formatCZK(totalDue)} Kč</div>
            <div className="text-xs text-amber-400">Prosím uhraďte faktury do data splatnosti</div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {invoices.map(inv => {
          const st = STATUS_CFG[inv.status] || STATUS_CFG.sent;
          const isOverdue = inv.status === 'sent' && new Date(inv.due_date) < new Date();
          const spayd = generateSpayd(inv.iban, inv.total - (inv.paid_amount || 0), inv.variable_symbol);

          return (
            <div key={inv.id} className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${inv.status === 'paid' ? 'bg-emerald-500/10' : isOverdue ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                  {inv.status === 'paid' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isOverdue ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-white">{inv.invoice_number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-500/10 text-red-400' : `${st.bg} ${st.color}`}`}>
                      {isOverdue ? 'Po splatnosti' : st.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Splatnost: {formatDate(inv.due_date)}
                    {inv.paid_at && <span className="ml-2 text-emerald-400">Zaplaceno {formatDate(inv.paid_at)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 mr-2">
                  <div className="text-lg font-extrabold text-white tabular-nums">{formatCZK(inv.total)} Kč</div>
                  <div className="text-[10px] text-slate-400">včetně DPH</div>
                </div>
                <button
                  onClick={() => openDetail(inv)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" /> Zobrazit
                </button>
              </div>

              {spayd && inv.status !== 'paid' && (
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-4 bg-blue-500/10 rounded-xl p-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(spayd)}`}
                      alt="QR platba"
                      className="w-16 h-16 rounded-lg border border-blue-500/20"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 mb-0.5">
                        <QrCode className="w-3.5 h-3.5" /> QR platba
                      </div>
                      <p className="text-[10px] text-blue-400">Naskenujte v mobilní bance</p>
                    </div>
                    {inv.bank_account && (
                      <div className="text-right text-[10px] shrink-0">
                        <span className="text-slate-400 block">Účet</span>
                        <span className="font-semibold text-slate-300">{inv.bank_account}</span>
                        {inv.variable_symbol && (
                          <>
                            <span className="text-slate-400 block mt-0.5">VS</span>
                            <span className="font-semibold text-slate-300">{inv.variable_symbol}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={!!detailInvoice}
        onClose={() => { setDetailInvoice(null); setDetailItems([]); }}
        title={detailInvoice ? `${detailInvoice.invoice_type === 'credit_note' ? 'Dobropis' : 'Faktura'} ${detailInvoice.invoice_number}` : ''}
        size="lg"
        footer={
          <>
            <button
              onClick={() => { setDetailInvoice(null); setDetailItems([]); }}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
            >
              Zavřít
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <Printer className="w-4 h-4" /> Tisknout / PDF
            </button>
          </>
        }
      >
        {detailInvoice && (
          <InvoiceDetailContent
            invoice={detailInvoice}
            items={detailItems}
            loading={detailLoading}
          />
        )}
      </Modal>
    </div>
  );
}

function InvoiceDetailContent({
  invoice: inv,
  items,
  loading,
}: {
  invoice: PortalInvoice;
  items: InvoiceItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const vatBreakdown: VatBreakdown[] = calcVatBreakdown(items);
  const remaining = inv.total - (inv.paid_amount || 0);
  const spayd = generateSpayd(inv.iban, remaining > 0 ? remaining : inv.total, inv.variable_symbol);
  const isOverdue = inv.status === 'sent' && new Date(inv.due_date) < new Date();

  return (
    <div className="space-y-6 -mx-2">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white">
            {inv.invoice_type === 'credit_note' ? 'DOBROPIS' : 'FAKTURA'} {inv.invoice_number}
          </h2>
          <div className="text-xs text-slate-400 space-y-0.5 mt-1">
            <div>Datum vystavení: <span className="font-semibold text-slate-400">{formatDate(inv.invoice_date)}</span></div>
            <div>Datum zdan. plnění: <span className="font-semibold text-slate-400">{formatDate(inv.taxable_date)}</span></div>
            <div>Splatnost: <span className="font-semibold text-slate-400">{formatDate(inv.due_date)}</span></div>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400'
          : isOverdue ? 'bg-red-500/10 text-red-400'
          : inv.status === 'partial' ? 'bg-amber-500/10 text-amber-400'
          : 'bg-blue-500/10 text-blue-400'
        }`}>
          {inv.status === 'paid' ? 'Zaplacena' : isOverdue ? 'Po splatnosti' : inv.status === 'partial' ? 'Částečně uhrazena' : 'K úhradě'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Dodavatel</div>
          <div className="text-sm font-bold text-white">{inv.issuer_name}</div>
          {inv.issuer_ico && <div className="text-xs text-slate-500">IČO: {inv.issuer_ico}</div>}
          {inv.issuer_dic && <div className="text-xs text-slate-500">DIC: {inv.issuer_dic}</div>}
          {inv.issuer_address && <div className="text-xs text-slate-500 mt-1">{inv.issuer_address}</div>}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Odběratel</div>
          <div className="text-sm font-bold text-white">{inv.client_name}</div>
          {inv.client_ico && <div className="text-xs text-slate-500">IČO: {inv.client_ico}</div>}
          {inv.client_dic && <div className="text-xs text-slate-500">DIC: {inv.client_dic}</div>}
          {inv.client_address && <div className="text-xs text-slate-500 mt-1">{inv.client_address}</div>}
        </div>
      </div>

      <div className="bg-white/[0.04] rounded-xl p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400">Způsob platby</span>
            <div className="font-semibold text-slate-300">
              {inv.payment_method === 'bank_transfer' ? 'Bankovní převod' : inv.payment_method === 'cash' ? 'Hotovost' : 'Kartou'}
            </div>
          </div>
          {inv.bank_account && (
            <div>
              <span className="text-slate-400">Číslo účtu</span>
              <div className="font-semibold text-slate-300">{inv.bank_account}</div>
            </div>
          )}
          {inv.variable_symbol && (
            <div>
              <span className="text-slate-400">Variabilní symbol</span>
              <div className="font-semibold text-slate-300">{inv.variable_symbol}</div>
            </div>
          )}
          {inv.constant_symbol && (
            <div>
              <span className="text-slate-400">Konstantní symbol</span>
              <div className="font-semibold text-slate-300">{inv.constant_symbol}</div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b-2 border-white/10">
              <th className="pb-2.5 pr-3">Popis</th>
              <th className="pb-2.5 pr-3 text-right w-16">Mn.</th>
              <th className="pb-2.5 pr-3 w-12">Jedn.</th>
              <th className="pb-2.5 pr-3 text-right w-20">Cena/j.</th>
              <th className="pb-2.5 pr-3 text-right w-12">DPH</th>
              <th className="pb-2.5 text-right w-24">Celkem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-2.5 pr-3 text-white">{item.description}</td>
                <td className="py-2.5 pr-3 text-right text-slate-400 tabular-nums">{item.quantity}</td>
                <td className="py-2.5 pr-3 text-slate-500">{item.unit}</td>
                <td className="py-2.5 pr-3 text-right text-slate-400 tabular-nums">{formatCZK(item.unit_price)}</td>
                <td className="py-2.5 pr-3 text-right text-slate-500">{item.vat_rate}%</td>
                <td className="py-2.5 text-right font-semibold text-white tabular-nums">{formatCZK(item.total_price)} Kč</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-72">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Základ celkem</span>
              <span className="font-semibold tabular-nums">{formatCZK(inv.subtotal)} Kč</span>
            </div>
            {vatBreakdown.map(vb => (
              <div key={vb.rate} className="flex justify-between text-slate-500">
                <span>DPH {vb.rate}%</span>
                <span className="font-semibold tabular-nums">{formatCZK(vb.vat)} Kč</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t-2 border-slate-900 text-base font-extrabold text-white">
              <span>Celkem k úhradě</span>
              <span className="tabular-nums">{formatCZK(inv.total)} Kč</span>
            </div>
          </div>
        </div>
      </div>

      {spayd && inv.status !== 'paid' && (
        <div className="flex items-center gap-5 bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(spayd)}`}
            alt="QR platba"
            className="w-24 h-24 rounded-lg border border-blue-200"
          />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-blue-800 mb-1">
              <QrCode className="w-4 h-4" /> QR platba (SPAYD)
            </div>
            <p className="text-xs text-blue-400 mb-2">Naskenujte QR kód v mobilní bankovní aplikaci pro rychlou platbu.</p>
            {remaining > 0 && remaining < inv.total && (
              <div className="text-xs font-semibold text-blue-800">
                Zbývá uhradit: {formatCZK(remaining)} Kč
              </div>
            )}
          </div>
        </div>
      )}

      {inv.note && (
        <div className="border-t border-white/10 pt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Poznámka</div>
          <div className="text-sm text-slate-400 whitespace-pre-wrap">{inv.note}</div>
        </div>
      )}
    </div>
  );
}
