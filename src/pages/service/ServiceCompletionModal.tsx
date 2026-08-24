import { useState, useEffect } from 'react';
import { CheckCircle2, Banknote, AlertTriangle, FileText, ArrowRight, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import ServiceWorkflowStepper, { WorkflowStatus } from '../../components/service/ServiceWorkflowStepper';

interface Schedule {
  id: string;
  type_name: string;
  client_name: string;
  client_address?: string;
  agreed_price: number | null;
  is_one_time: boolean;
  interval_months: number | null;
  next_date: string;
  service_type_id: string;
  project_id: string | null;
  notes?: string;
  workflow_status?: WorkflowStatus;
  report_required?: boolean;
}

interface Report {
  id: string;
  status: string;
  total_price: number;
  locked_at: string | null;
}

interface Props {
  open: boolean;
  schedule: Schedule;
  onClose: () => void;
  onCompleted: () => void;
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30';

export default function ServiceCompletionModal({ open, schedule, onClose, onCompleted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [finalPrice, setFinalPrice] = useState('');
  const [priceChangeNote, setPriceChangeNote] = useState('');
  const [markForInvoicing, setMarkForInvoicing] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [, setLoadingReport] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFinalPrice(schedule.agreed_price != null ? String(schedule.agreed_price) : '');
    setPriceChangeNote('');
    setMarkForInvoicing(true);
    loadReport();
  }, [open, schedule.id, schedule.agreed_price]);

  const loadReport = async () => {
    setLoadingReport(true);
    const { data } = await supabase
      .from('service_reports')
      .select('id, status, total_price, locked_at')
      .eq('schedule_id', schedule.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setReport(data);
    if (data?.total_price && !finalPrice) {
      setFinalPrice(String(data.total_price));
    }
    setLoadingReport(false);
  };

  const workflowStatus = (schedule.workflow_status || 'new') as WorkflowStatus;
  const reportRequired = schedule.report_required !== false;
  const hasLockedReport = !!report?.locked_at;
  const canComplete = !reportRequired || hasLockedReport;

  const agreedPrice = schedule.agreed_price;
  const parsedFinalPrice = parseFloat(finalPrice) || 0;
  const priceChanged = agreedPrice != null && parsedFinalPrice !== agreedPrice;

  const handleSubmit = async () => {
    if (!user) return;
    if (priceChanged && !priceChangeNote.trim()) {
      toast('Prosím vyplňte důvod změny ceny', 'error');
      return;
    }

    setSaving(true);

    const today = new Date().toISOString().slice(0, 10);
    const updates: Record<string, unknown> = {
      last_completed_date: today,
      final_price: parsedFinalPrice || null,
      price_change_note: priceChanged ? priceChangeNote.trim() : null,
      billing_status: markForInvoicing ? 'ready_for_invoicing' : 'not_ready',
      workflow_status: markForInvoicing ? 'to_bill' : 'closed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    updates.is_active = false;

    const { error } = await supabase
      .from('service_schedules')
      .update(updates)
      .eq('id', schedule.id);

    if (error) {
      toast('Chyba při ukládání', 'error');
      setSaving(false);
      return;
    }

    if (!schedule.is_one_time) {
      const interval = schedule.interval_months || 12;
      const nextDate = new Date(schedule.next_date);
      nextDate.setMonth(nextDate.getMonth() + interval);
      const newNextDate = nextDate.toISOString().slice(0, 10);

      const newSchedule: Record<string, unknown> = {
        service_type_id: schedule.service_type_id,
        next_date: newNextDate,
        interval_months: interval,
        is_active: true,
        is_one_time: false,
        created_by: user.id,
        billing_status: 'not_ready',
        notes: schedule.notes || '',
      };

      if (schedule.project_id) {
        newSchedule.project_id = schedule.project_id;
      } else {
        newSchedule.client_name = schedule.client_name || '';
        newSchedule.client_address = schedule.client_address || '';
      }

      const { error: insertError } = await supabase
        .from('service_schedules')
        .insert(newSchedule);

      if (insertError) {
        console.error('Failed to create next schedule:', insertError);
      }
    }

    setSaving(false);
    toast(schedule.is_one_time ? 'Servis dokončen' : 'Servis dokončen, další termín naplánován');
    onCompleted();
  };

  return (
    <Modal open={open} onClose={onClose} title="Dokončení servisu" size="md" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
        <button
          onClick={handleSubmit}
          disabled={saving || !canComplete || (priceChanged && !priceChangeNote.trim())}
          className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 rounded-xl shadow-sm shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? 'Ukládám...' : 'Dokončit servis'}
        </button>
      </>
    }>
      <div className="space-y-5">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
          <div className="text-sm font-bold text-white">{schedule.type_name}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {schedule.client_name}
            {schedule.client_address && <span className="ml-2">| {schedule.client_address}</span>}
          </div>
        </div>

        <ServiceWorkflowStepper
          currentStatus={workflowStatus}
          hasScheduledDate={!!schedule.next_date}
          hasReport={!!report}
          hasLockedReport={!!report?.locked_at}
        />

        {reportRequired && !hasLockedReport && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Chybí uzamčený výkaz</p>
              <p className="text-xs text-red-400/80 mt-1">
                Pro dokončení servisu je nutné nejprve vyplnit a uzamknout servisní výkaz.
                Výkaz obsahuje provedenou práci, materiál a kalkulaci.
              </p>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                Přejít na výkaz
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {hasLockedReport && (
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-300">Výkaz uzamčen</p>
              <p className="text-xs text-emerald-400/70">
                Celkem: {report?.total_price?.toLocaleString('cs-CZ') || 0} Kč
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        )}

        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/5 to-green-500/5 p-4 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            <Banknote className="w-3.5 h-3.5" />Fakturace
          </div>

          {agreedPrice != null && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-xs text-slate-400">Dohodnutá cena</span>
              <span className="text-sm font-bold text-white">{agreedPrice.toLocaleString('cs-CZ')} Kč</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Konečná cena *</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.01"
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Kč</span>
            </div>
          </div>

          {priceChanged && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300">
                  Cena se liší od dohodnuté ({agreedPrice?.toLocaleString('cs-CZ')} Kč)
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Důvod změny ceny *</label>
                <textarea
                  value={priceChangeNote}
                  onChange={e => setPriceChangeNote(e.target.value)}
                  rows={2}
                  placeholder="Například: dodatečné práce, sleva..."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition">
            <input
              type="checkbox"
              checked={markForInvoicing}
              onChange={e => setMarkForInvoicing(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <div>
              <span className="text-sm font-semibold text-white">Připravit k fakturaci</span>
              <span className="text-[10px] text-slate-500 block">Servis bude zobrazen v sekci K fakturaci</span>
            </div>
          </label>
        </div>

        {schedule.is_one_time ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300 font-medium">Jednorázový servis - bude označen jako dokončený</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs text-blue-300 font-medium">
              Další servis bude naplánován za {schedule.interval_months || 12} měsíců
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
