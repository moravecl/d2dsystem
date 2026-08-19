import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import { EVENT_TYPE_LABELS } from '../../types/assets';
import type { EventType, AssetEvent } from '../../types/assets';

interface Props {
  assetId: string;
  event?: AssetEvent | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventFormModal({ assetId, event, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    event_type: (event?.event_type || 'service') as EventType,
    title: event?.title || '',
    description: event?.description || '',
    event_date: event?.event_date || new Date().toISOString().split('T')[0],
    cost: event?.cost ? String(event.cost) : '',
    supplier: event?.supplier || '',
    odometer_km: event?.odometer_km ? String(event.odometer_km) : '',
  });

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const isEdit = !!event;

  const handleSave = async () => {
    if (!form.title.trim()) { toast('Zadejte název', 'error'); return; }
    setSaving(true);

    const payload = {
      event_type: form.event_type,
      title: form.title.trim(),
      description: form.description,
      event_date: form.event_date,
      cost: form.cost ? parseFloat(form.cost) : 0,
      supplier: form.supplier,
      odometer_km: form.odometer_km ? parseInt(form.odometer_km) : null,
    };

    if (isEdit) {
      const { error } = await supabase.from('asset_events').update(payload).eq('id', event.id);
      setSaving(false);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      await logAudit('asset_event', event.id, 'updated', { asset_id: assetId, type: form.event_type });
      toast('Událost uložena');
    } else {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('asset_events').insert({
        ...payload,
        asset_id: assetId,
        created_by: user.user?.id,
        performed_by: user.user?.id,
      });
      setSaving(false);
      if (error) { toast('Chyba při vytváření', 'error'); return; }
      await logAudit('asset_event', null, 'created', { asset_id: assetId, type: form.event_type });
      toast('Událost přidána');
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Upravit událost' : 'Přidat událost'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Typ *</label>
            <select value={form.event_type} onChange={e => set('event_type', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Název *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Popis</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Datum</label>
              <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Cena (Kč)</label>
              <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Dodavatel</label>
              <input value={form.supplier} onChange={e => set('supplier', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Stav km</label>
              <input type="number" value={form.odometer_km} onChange={e => set('odometer_km', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.04]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition">Zrušit</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {saving ? 'Ukládám...' : isEdit ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}
