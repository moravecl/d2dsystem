import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import { ASSET_TYPE_LABELS, DEVICE_TYPES, BUILDING_TYPES, FUEL_TYPES } from '../../types/assets';
import type { Asset, AssetType } from '../../types/assets';

interface Props {
  asset?: Asset | null;
  defaultType?: AssetType;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function AssetFormModal({ asset, defaultType, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    asset_type: asset?.asset_type || defaultType || 'appliance' as AssetType,
    name: asset?.name || '',
    code: asset?.code || '',
    owner_type: asset?.owner_type || 'company',
    client_id: asset?.client_id || '',
    location_address: asset?.location_address || '',
    location_room: asset?.location_room || '',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    serial_number: asset?.serial_number || '',
    purchase_date: asset?.purchase_date || '',
    supplier: asset?.supplier || '',
    warranty_until: asset?.warranty_until || '',
    warranty_terms: asset?.warranty_terms || '',
    note: asset?.note || '',
    vin: asset?.vin || '',
    license_plate: asset?.license_plate || '',
    fuel_type: asset?.fuel_type || '',
    odometer_km: asset?.odometer_km || 0,
    device_type: asset?.device_type || '',
    building_type: asset?.building_type || '',
    main_breaker: asset?.main_breaker || '',
    connection_type: asset?.connection_type || '',
    heating_type: asset?.heating_type || '',
    has_fve: asset?.has_fve || false,
    has_recuperation: asset?.has_recuperation || false,
  });

  useEffect(() => {
    supabase.from('clients').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setClients((data || []) as { id: string; name: string }[]));
  }, []);

  const set = (key: string, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Zadejte název', 'error'); return; }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();

    const payload = {
      ...form,
      client_id: form.owner_type === 'client' && form.client_id ? form.client_id : null,
      purchase_date: form.purchase_date || null,
      warranty_until: form.warranty_until || null,
    };

    if (asset) {
      const { error } = await supabase.from('assets')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', asset.id);
      setSaving(false);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      await logAudit('asset', asset.id, 'updated', { name: form.name });
      toast('Majetek aktualizován');
      onSaved(asset.id);
    } else {
      const { data, error } = await supabase.from('assets')
        .insert({ ...payload, created_by: user.user?.id })
        .select('id')
        .maybeSingle();
      setSaving(false);
      if (error || !data) { toast('Chyba při vytváření', 'error'); return; }
      await logAudit('asset', data.id, 'created', { name: form.name, type: form.asset_type });

      if (form.warranty_until) {
        await supabase.from('due_items').insert({
          asset_id: data.id,
          due_type: 'warranty',
          label: `Konec záruky - ${form.name}`,
          due_date: form.warranty_until,
          status: 'ok',
          created_by: user.user?.id,
        });
      }

      toast('Majetek vytvořen');
      onSaved(data.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{asset ? 'Upravit majetek' : 'Nový majetek'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Typ majetku *</label>
              <select value={form.asset_type} onChange={e => set('asset_type', e.target.value)} disabled={!!asset} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-white/[0.04]">
                {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Název *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Vlastník</label>
              <select value={form.owner_type} onChange={e => set('owner_type', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="company">Firma</option>
                <option value="client">Klient</option>
              </select>
            </div>
            {form.owner_type === 'client' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Klient</label>
                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Vyberte klienta...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Adresa / Umístění</label>
              <input value={form.location_address} onChange={e => set('location_address', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Místnost</label>
              <input value={form.location_room} onChange={e => set('location_room', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          {form.asset_type === 'vehicle' && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-4">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Vozidlo</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">SPZ</label>
                  <input value={form.license_plate} onChange={e => set('license_plate', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">VIN</label>
                  <input value={form.vin} onChange={e => set('vin', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Palivo</label>
                  <select value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Vyberte...</option>
                    {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stav km</label>
                  <input type="number" value={form.odometer_km} onChange={e => set('odometer_km', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
            </div>
          )}

          {form.asset_type === 'appliance' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-4">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Zařízení</div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Typ zařízení</label>
                <select value={form.device_type} onChange={e => set('device_type', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Vyberte...</option>
                  {DEVICE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {form.asset_type === 'building' && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-4">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Budova</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Typ budovy</label>
                  <select value={form.building_type} onChange={e => set('building_type', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Vyberte...</option>
                    {BUILDING_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Hlavní jistič</label>
                  <input value={form.main_breaker} onChange={e => set('main_breaker', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Typ vytápění</label>
                  <input value={form.heating_type} onChange={e => set('heating_type', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.has_fve} onChange={e => set('has_fve', e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-300">FVE</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.has_recuperation} onChange={e => set('has_recuperation', e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-300">Rekuperace</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Výrobce</label>
              <input value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Model</label>
              <input value={form.model} onChange={e => set('model', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sériové číslo</label>
              <input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Datum pořízení</label>
              <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Dodavatel</label>
              <input value={form.supplier} onChange={e => set('supplier', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Záruka do</label>
              <input type="date" value={form.warranty_until} onChange={e => set('warranty_until', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.04]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition">Zrušit</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {saving ? 'Ukládám...' : asset ? 'Uložit' : 'Vytvořit'}
          </button>
        </div>
      </div>
    </div>
  );
}
