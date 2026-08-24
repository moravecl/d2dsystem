import { useState, useEffect, useCallback } from 'react';
import { Clock, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface WorkItem {
  type: 'labor' | 'material';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

interface ProtocolForm {
  service_date: string;
  technician_name: string;
  description: string;
  findings: string;
  recommendations: string;
}

interface ReportPrefillData {
  work_description?: string;
  findings?: string;
  recommendation?: string;
  items?: Array<{
    item_type: 'work' | 'material' | 'travel' | 'other';
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    hours?: number;
    hourly_rate?: number;
  }>;
}

interface ServiceProtocolModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
  clientName?: string | null;
  clientAddress?: string | null;
  scheduleId?: string | null;
  ticketId?: string | null;
  prefillDescription?: string;
  prefillFromReport?: ReportPrefillData;
  onSaved: () => void;
}

export default function ServiceProtocolModal({
  open, onClose, projectId, clientName, clientAddress, scheduleId, ticketId, prefillDescription, prefillFromReport, onSaved,
}: ServiceProtocolModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProtocolForm>({
    service_date: new Date().toISOString().slice(0, 10),
    technician_name: '',
    description: prefillDescription || '',
    findings: '',
    recommendations: '',
  });
  const [laborItems, setLaborItems] = useState<WorkItem[]>([]);
  const [materialItems, setMaterialItems] = useState<WorkItem[]>([]);

  const hasReportData = !!prefillFromReport?.items?.length;

  useEffect(() => {
    if (open) {
      setForm({
        service_date: new Date().toISOString().slice(0, 10),
        technician_name: '',
        description: prefillFromReport?.work_description || prefillDescription || '',
        findings: prefillFromReport?.findings || '',
        recommendations: prefillFromReport?.recommendation || '',
      });

      if (prefillFromReport?.items) {
        const workItems = prefillFromReport.items
          .filter(i => i.item_type === 'work')
          .map((i, idx) => ({
            type: 'labor' as const,
            description: i.description || '',
            quantity: i.hours || i.quantity || 0,
            unit: 'hod',
            unit_price: i.hourly_rate || i.unit_price || 0,
            total_price: i.total_price || 0,
            sort_order: idx,
          }));
        const matItems = prefillFromReport.items
          .filter(i => i.item_type === 'material' || i.item_type === 'travel' || i.item_type === 'other')
          .map((i, idx) => ({
            type: 'material' as const,
            description: i.item_type === 'travel' ? `Doprava: ${i.description || i.quantity + ' km'}` : (i.description || ''),
            quantity: i.quantity || 0,
            unit: i.unit || 'ks',
            unit_price: i.unit_price || 0,
            total_price: i.total_price || 0,
            sort_order: idx,
          }));
        setLaborItems(workItems);
        setMaterialItems(matItems);
      } else {
        setLaborItems([]);
        setMaterialItems([]);
      }
    }
  }, [open, prefillDescription, prefillFromReport]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    if (data?.display_name) setForm(f => ({ ...f, technician_name: data.display_name }));
  }, [user]);

  useEffect(() => { if (open) loadProfile(); }, [open, loadProfile]);

  const laborTotal = laborItems.reduce((sum, i) => sum + (i.total_price || 0), 0);
  const materialTotal = materialItems.reduce((sum, i) => sum + (i.total_price || 0), 0);
  const grandTotal = laborTotal + materialTotal;

  const handleSave = async () => {
    if (!form.technician_name.trim() || !form.description.trim()) {
      toast('Vyplnte technika a popis prace', 'error');
      return;
    }
    setSaving(true);
    const protocolNumber = `SP-${Date.now().toString(36).toUpperCase()}`;
    const { data: proto, error: protoErr } = await supabase.from('service_protocols').insert({
      project_id: projectId || null,
      client_name: (!projectId && clientName) ? clientName : null,
      client_address: (!projectId && clientAddress) ? clientAddress : null,
      schedule_id: scheduleId || null,
      ticket_id: ticketId || null,
      protocol_number: protocolNumber,
      service_date: form.service_date,
      technician_name: form.technician_name,
      description: form.description,
      findings: form.findings,
      recommendations: form.recommendations,
      status: 'completed',
      created_by: user!.id,
    }).select('id').maybeSingle();

    if (protoErr || !proto) {
      toast('Chyba pri ukladani protokolu', 'error');
      setSaving(false);
      return;
    }

    const allItems = [
      ...laborItems.map((it, i) => ({ ...it, protocol_id: proto.id, sort_order: i })),
      ...materialItems.map((it, i) => ({ ...it, protocol_id: proto.id, sort_order: laborItems.length + i })),
    ].filter(it => it.description.trim());

    if (allItems.length > 0) {
      const { error: itemsErr } = await supabase.from('service_work_items').insert(
        allItems.map(it => ({
          protocol_id: it.protocol_id,
          type: it.type,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          total_price: it.total_price,
          sort_order: it.sort_order,
        }))
      );
      if (itemsErr) {
        console.error('Error saving protocol items:', itemsErr);
      }
    }

    setSaving(false);
    toast('Servisni protokol vytvoren');
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Servisni protokol" size="xl" footer={
      <>
        <div className="flex-1 text-sm font-semibold text-slate-300">
          Celkem: {grandTotal.toLocaleString('cs-CZ')} Kc
        </div>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrusit</button>
        <button onClick={handleSave} disabled={saving || !form.technician_name.trim() || !form.description.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
          {saving ? 'Ukladam...' : 'Ulozit protokol'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Datum servisu *</label>
              <input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Technik *</label>
              <input value={form.technician_name} onChange={e => setForm({ ...form, technician_name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Popis provedenych praci *</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Zjisteni pri kontrole</label>
            <textarea value={form.findings} onChange={e => setForm({ ...form, findings: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Stav zarizeni, namerene hodnoty..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Doporuceni</label>
            <textarea value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Doporuceni pro klienta..." />
          </div>
        </div>

        {hasReportData && (
          <div className="space-y-4 pt-4 border-t border-white/[0.08]">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Polozky z vykazu (pouze pro cteni)</div>

            {laborItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <Clock className="w-3.5 h-3.5" /> Prace
                </div>
                <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
                  {laborItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-white">{item.description || 'Prace'}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">{item.quantity} {item.unit}</span>
                        <span className="text-xs text-slate-400">{item.unit_price.toLocaleString('cs-CZ')} Kc/{item.unit}</span>
                        <span className="text-sm font-bold text-blue-400">{item.total_price.toLocaleString('cs-CZ')} Kc</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right text-xs font-bold text-blue-400">
                  Prace celkem: {laborTotal.toLocaleString('cs-CZ')} Kc
                </div>
              </div>
            )}

            {materialItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Package className="w-3.5 h-3.5" /> Material a ostatni
                </div>
                <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
                  {materialItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-white">{item.description || 'Polozka'}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">{item.quantity} {item.unit}</span>
                        <span className="text-xs text-slate-400">{item.unit_price.toLocaleString('cs-CZ')} Kc/{item.unit}</span>
                        <span className="text-sm font-bold text-amber-400">{item.total_price.toLocaleString('cs-CZ')} Kc</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right text-xs font-bold text-amber-400">
                  Material celkem: {materialTotal.toLocaleString('cs-CZ')} Kc
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm font-bold text-emerald-400">Celkova castka</span>
              <span className="text-lg font-bold text-emerald-400">{grandTotal.toLocaleString('cs-CZ')} Kc</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
