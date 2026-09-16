import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import { logAudit } from '../../lib/auditLog';
import {
  type SubInquiry, type SubInquiryRecipient,
  SUB_TRADE_LABELS, SUB_INQUIRY_STATUS_LABELS, SUB_RECIPIENT_STATUS_LABELS,
} from '../../types/subcontractors';

interface Props {
  inquiry: SubInquiry | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function SubInquiryDetailModal({ inquiry, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<SubInquiryRecipient[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    if (!inquiry) return;
    const { data } = await supabase.from('sub_inquiry_recipients')
      .select('*, subcontractors(*)')
      .eq('inquiry_id', inquiry.id)
      .order('created_at');
    setRecipients((data || []) as SubInquiryRecipient[]);
  }, [inquiry]);

  useEffect(() => { loadRecipients(); }, [loadRecipients]);

  if (!inquiry) return null;

  const confirmedCount = recipients.filter(r => r.confirmed_at).length;

  /** Potvrzení odpovědi z naší strany: založí vazbu na zakázku (fáze 1). */
  const handleConfirm = async (rec: SubInquiryRecipient) => {
    setBusyId(rec.id);
    try {
      const price = inquiry.mode === 'fixed_price' ? inquiry.fixed_price : (rec.offer_price || 0);
      const { data: js, error } = await supabase.from('job_subcontractors').insert({
        job_id: inquiry.job_id,
        subcontractor_id: rec.subcontractor_id,
        trade: inquiry.trade,
        scope: inquiry.scope,
        agreed_price: price,
        date_from: inquiry.date_from,
        date_to: inquiry.date_to,
        note: `Z poptávky: ${inquiry.title}`,
        created_by: user!.id,
      }).select('id').maybeSingle();
      if (error || !js) { toast('Chyba při potvrzení', 'error'); return; }

      await supabase.from('sub_inquiry_recipients')
        .update({ confirmed_at: new Date().toISOString(), confirmed_by: user!.id, awarded_job_subcontractor_id: js.id })
        .eq('id', rec.id);

      const newConfirmed = confirmedCount + 1;
      if (newConfirmed >= inquiry.people_needed) {
        await supabase.from('sub_inquiries')
          .update({ status: 'awarded', updated_at: new Date().toISOString() })
          .eq('id', inquiry.id);
      }
      await logAudit('sub_inquiry', inquiry.id, 'recipient_confirmed', { subcontractor_id: rec.subcontractor_id });
      toast('Potvrzeno — subdodavatel je přiřazen k zakázce. Nezapomeňte vygenerovat smlouvu v Realizaci.');
      loadRecipients();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const handleCloseInquiry = async (status: 'closed' | 'cancelled') => {
    await supabase.from('sub_inquiries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', inquiry.id);
    toast(status === 'closed' ? 'Poptávka uzavřena' : 'Poptávka zrušena');
    onChanged();
    onClose();
  };

  const meta = SUB_INQUIRY_STATUS_LABELS[inquiry.status];

  return (
    <Modal open onClose={onClose} title={inquiry.title} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`font-extrabold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
          {inquiry.trade && <span className="font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300">{SUB_TRADE_LABELS[inquiry.trade] || inquiry.trade}</span>}
          <span className="text-slate-400">
            {inquiry.mode === 'fixed_price'
              ? `Pevná cena ${inquiry.fixed_price.toLocaleString('cs-CZ')} Kč`
              : `Nabídková · hledáme ${inquiry.people_needed}`}
          </span>
          {inquiry.response_deadline && <span className="text-slate-500">odpovědi do {new Date(inquiry.response_deadline).toLocaleDateString('cs-CZ')}</span>}
          <span className="text-slate-500">potvrzeno {confirmedCount}/{inquiry.people_needed}</span>
        </div>
        {inquiry.scope && <p className="text-xs text-slate-400 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 whitespace-pre-wrap">{inquiry.scope}</p>}

        <div className="space-y-2">
          {recipients.map(rec => {
            const rmeta = SUB_RECIPIENT_STATUS_LABELS[rec.status];
            const canConfirm = !rec.confirmed_at
              && (rec.status === 'accepted' || rec.status === 'offered')
              && ['sent'].includes(inquiry.status);
            return (
              <div key={rec.id} className="flex flex-wrap items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white truncate">{rec.subcontractors?.name || '—'}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${rmeta.cls}`}>{rmeta.label}</span>
                    {rec.confirmed_at && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Potvrzeno námi
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {rec.offer_price != null && `Nabídka: ${rec.offer_price.toLocaleString('cs-CZ')} Kč`}
                    {rec.people_offered ? ` · ${rec.people_offered} lidí` : ''}
                    {rec.offer_note ? ` · ${rec.offer_note}` : ''}
                    {rec.responded_at ? ` · ${new Date(rec.responded_at).toLocaleDateString('cs-CZ')}` : ''}
                  </div>
                </div>
                {canConfirm && (
                  <button
                    onClick={() => handleConfirm(rec)}
                    disabled={busyId === rec.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
                  >
                    {busyId === rec.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Potvrdit
                  </button>
                )}
              </div>
            );
          })}
          {recipients.length === 0 && <p className="text-xs text-slate-500">Poptávka nemá příjemce.</p>}
        </div>

        {inquiry.status === 'sent' && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.08]">
            <button onClick={() => handleCloseInquiry('closed')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition">
              Uzavřít poptávku
            </button>
            <button onClick={() => handleCloseInquiry('cancelled')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition">
              <XCircle className="w-3.5 h-3.5" /> Zrušit poptávku
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
