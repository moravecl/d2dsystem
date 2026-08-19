import { useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import type { DueItem } from '../../types/assets';

interface Props {
  item: DueItem;
  assetName: string;
  onClose: () => void;
  onCompleted: () => void;
}

export default function CompleteDueItemModal({ item, assetName, onClose, onCompleted }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'complete' | 'renew'>('complete');
  const [renewDate, setRenewDate] = useState('');
  const [renewInterval, setRenewInterval] = useState(item.interval_months || 12);

  const isPeriodic = !!item.interval_months;

  const computeNextDate = (fromDate: string, months: number) => {
    const d = new Date(fromDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const handleComplete = async () => {
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    const { error: updateError } = await supabase.from('due_items')
      .update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: userId, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (updateError) { toast('Chyba', 'error'); setSaving(false); return; }

    await supabase.from('asset_events').insert({
      asset_id: item.asset_id,
      event_type: item.due_type === 'stk' ? 'stk' : item.due_type === 'service' ? 'service' : 'revision',
      title: item.label,
      description: note,
      event_date: eventDate,
      created_by: userId,
      performed_by: userId,
    });

    await logAudit('due_item', item.id, 'completed', { asset_id: item.asset_id, label: item.label });
    setSaving(false);

    if (isPeriodic) {
      const nextDate = computeNextDate(eventDate, item.interval_months!);
      setRenewDate(nextDate);
      setStep('renew');
    } else {
      toast('Termin splnen');
      onCompleted();
    }
  };

  const handleRenew = async () => {
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    await supabase.from('due_items').insert({
      asset_id: item.asset_id,
      due_type: item.due_type,
      label: item.label,
      due_date: renewDate,
      interval_months: renewInterval,
      interval_km: item.interval_km,
      responsible_user_id: item.responsible_user_id,
      status: 'ok',
      notify: item.notify,
      created_by: userId,
    });

    setSaving(false);
    toast('Termin obnoven');
    onCompleted();
  };

  const handleSkipRenew = () => {
    toast('Termin splnen');
    onCompleted();
  };

  if (step === 'renew') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-navy-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              Obnovit periodicky termin
            </h2>
            <p className="text-sm text-slate-500 mt-1">{item.label} - {assetName}</p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-300">
              Termin byl splnen. Chcete vytvorit dalsi periodicky termin?
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Datum dalsiho terminu</label>
              <input
                type="date"
                value={renewDate}
                onChange={e => setRenewDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Interval (mesice)</label>
              <input
                type="number"
                min={1}
                value={renewInterval}
                onChange={e => setRenewInterval(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-300">
                Vypocet: {eventDate} + {renewInterval} mesicu = {computeNextDate(eventDate, renewInterval)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
            <button
              onClick={handleSkipRenew}
              className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition"
            >
              Preskocit
            </button>
            <button
              onClick={handleRenew}
              disabled={saving || !renewDate}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {saving ? 'Ukladam...' : 'Vytvorit dalsi termin'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-navy-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Oznacit jako splneno</h2>
          <p className="text-sm text-slate-500 mt-1">{item.label} - {assetName}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Datum provedeni</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Poznamka</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>
          {isPeriodic && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-300">
                Toto je periodicky termin (interval: {item.interval_months} mesicu). Po splneni budete vyzváni k vytvoreni dalsiho terminu.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition">Zrusit</button>
          <button onClick={handleComplete} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Ukladam...' : 'Splnit'}
          </button>
        </div>
      </div>
    </div>
  );
}
