import { useState, useEffect } from 'react';
import { User, MapPin, Phone, Mail, Banknote, Building2, Clock, Package, Plus, Trash2, Save, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete';
import ClientAutocomplete from '../../components/ui/ClientAutocomplete';

interface ServiceType {
  id: string;
  name: string;
  interval_months: number;
}

interface WorkEntry {
  id?: string;
  worker_name: string;
  hours: number;
  hourly_rate: number;
  description: string;
  work_date: string;
}

interface MaterialEntry {
  id?: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  purchase_price: number;
}

interface ScheduleData {
  id: string;
  service_type_id: string;
  next_date: string;
  interval_months: number | null;
  notes: string;
  is_one_time: boolean;
  deadline: string | null;
  client_name: string;
  client_address: string;
  client_phone: string;
  client_email: string;
  client_ico: string;
  client_dic: string;
  address_lat: number | null;
  address_lon: number | null;
  agreed_price: number | null;
  project_id: string | null;
}

interface Props {
  open: boolean;
  scheduleId: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}

export default function ServiceEditModal({ open, scheduleId, onClose, onSaved, onDelete }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([]);
  const [deletedWorkIds, setDeletedWorkIds] = useState<string[]>([]);
  const [deletedMaterialIds, setDeletedMaterialIds] = useState<string[]>([]);

  const [form, setForm] = useState<ScheduleData>({
    id: '',
    service_type_id: '',
    next_date: '',
    interval_months: 12,
    notes: '',
    is_one_time: false,
    deadline: null,
    client_name: '',
    client_address: '',
    client_phone: '',
    client_email: '',
    client_ico: '',
    client_dic: '',
    address_lat: null,
    address_lon: null,
    agreed_price: null,
    project_id: null,
  });

  useEffect(() => {
    if (!open || !scheduleId) return;
    setLoading(true);
    setDeletedWorkIds([]);
    setDeletedMaterialIds([]);

    (async () => {
      const [schedRes, typesRes, workRes, matRes] = await Promise.all([
        supabase.from('service_schedules').select('*').eq('id', scheduleId).maybeSingle(),
        supabase.from('service_types').select('id, name, interval_months').eq('is_active', true).order('sort_order'),
        supabase.from('service_work_entries').select('*').eq('schedule_id', scheduleId).order('work_date'),
        supabase.from('service_material_entries').select('*').eq('schedule_id', scheduleId).order('created_at'),
      ]);

      if (schedRes.data) {
        const s = schedRes.data;
        setForm({
          id: s.id,
          service_type_id: s.service_type_id,
          next_date: s.next_date || '',
          interval_months: s.interval_months,
          notes: s.notes || '',
          is_one_time: s.is_one_time || false,
          deadline: s.deadline || null,
          client_name: s.client_name || '',
          client_address: s.client_address || '',
          client_phone: s.client_phone || '',
          client_email: s.client_email || '',
          client_ico: s.client_ico || '',
          client_dic: s.client_dic || '',
          address_lat: s.address_lat,
          address_lon: s.address_lon,
          agreed_price: s.agreed_price,
          project_id: s.project_id,
        });
      }

      setServiceTypes((typesRes.data || []) as ServiceType[]);
      setWorkEntries((workRes.data || []).map((w: any) => ({
        id: w.id,
        worker_name: w.worker_name,
        hours: w.hours,
        hourly_rate: w.hourly_rate,
        description: w.description,
        work_date: w.work_date,
      })));
      setMaterialEntries((matRes.data || []).map((m: any) => ({
        id: m.id,
        material_name: m.material_name,
        quantity: m.quantity,
        unit: m.unit,
        unit_price: m.unit_price,
        purchase_price: m.purchase_price,
      })));
      setLoading(false);
    })();
  }, [open, scheduleId]);

  const addWorkEntry = () => {
    setWorkEntries(prev => [...prev, {
      worker_name: '',
      hours: 0,
      hourly_rate: 0,
      description: '',
      work_date: new Date().toISOString().slice(0, 10),
    }]);
  };

  const updateWorkEntry = (idx: number, field: keyof WorkEntry, value: any) => {
    setWorkEntries(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w));
  };

  const removeWorkEntry = (idx: number) => {
    const entry = workEntries[idx];
    if (entry.id) setDeletedWorkIds(prev => [...prev, entry.id!]);
    setWorkEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const addMaterialEntry = () => {
    setMaterialEntries(prev => [...prev, {
      material_name: '',
      quantity: 1,
      unit: 'ks',
      unit_price: 0,
      purchase_price: 0,
    }]);
  };

  const updateMaterialEntry = (idx: number, field: keyof MaterialEntry, value: any) => {
    setMaterialEntries(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeMaterialEntry = (idx: number) => {
    const entry = materialEntries[idx];
    if (entry.id) setDeletedMaterialIds(prev => [...prev, entry.id!]);
    setMaterialEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddressChange = (address: string, lat: number | null, lon: number | null) => {
    setForm(prev => ({ ...prev, client_address: address, address_lat: lat, address_lon: lon }));
  };

  const handleSave = async () => {
    if (!form.service_type_id || !form.next_date) {
      toast('Vyplňte typ servisu a datum', 'error');
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      service_type_id: form.service_type_id,
      next_date: form.next_date,
      interval_months: form.is_one_time ? 0 : (form.interval_months || 12),
      notes: form.notes,
      is_one_time: form.is_one_time,
      deadline: form.is_one_time && form.deadline ? form.deadline : null,
      client_name: form.client_name,
      client_address: form.client_address,
      client_phone: form.client_phone,
      client_email: form.client_email,
      client_ico: form.client_ico,
      client_dic: form.client_dic,
      address_lat: form.address_lat,
      address_lon: form.address_lon,
      agreed_price: form.agreed_price,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('service_schedules').update(payload).eq('id', scheduleId);

    if (error) {
      toast('Chyba při ukládání', 'error');
      setSaving(false);
      return;
    }

    if (deletedWorkIds.length > 0) {
      await supabase.from('service_work_entries').delete().in('id', deletedWorkIds);
    }
    if (deletedMaterialIds.length > 0) {
      await supabase.from('service_material_entries').delete().in('id', deletedMaterialIds);
    }

    for (const w of workEntries) {
      if (w.id) {
        await supabase.from('service_work_entries').update({
          worker_name: w.worker_name,
          hours: w.hours,
          hourly_rate: w.hourly_rate,
          description: w.description,
          work_date: w.work_date,
        }).eq('id', w.id);
      } else if (w.worker_name || w.hours > 0) {
        await supabase.from('service_work_entries').insert({
          schedule_id: scheduleId,
          worker_name: w.worker_name,
          hours: w.hours,
          hourly_rate: w.hourly_rate,
          description: w.description,
          work_date: w.work_date,
        });
      }
    }

    for (const m of materialEntries) {
      if (m.id) {
        await supabase.from('service_material_entries').update({
          material_name: m.material_name,
          quantity: m.quantity,
          unit: m.unit,
          unit_price: m.unit_price,
          purchase_price: m.purchase_price,
        }).eq('id', m.id);
      } else if (m.material_name) {
        await supabase.from('service_material_entries').insert({
          schedule_id: scheduleId,
          material_name: m.material_name,
          quantity: m.quantity,
          unit: m.unit,
          unit_price: m.unit_price,
          purchase_price: m.purchase_price,
        });
      }
    }

    setSaving(false);
    toast('Servis uložen');
    onSaved();
  };

  const totalWorkCost = workEntries.reduce((sum, w) => sum + w.hours * w.hourly_rate, 0);
  const totalMaterialCost = materialEntries.reduce((sum, m) => sum + m.quantity * m.unit_price, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upravit servis"
      size="lg"
      footer={
        <>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={saving || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              Smazat
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ servisu *</label>
              <select
                value={form.service_type_id}
                onChange={e => setForm({ ...form, service_type_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {serviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Další servis do *</label>
              <input
                type="date"
                value={form.next_date}
                onChange={e => setForm({ ...form, next_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_one_time}
              onChange={e => setForm({ ...form, is_one_time: e.target.checked })}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <span className="text-sm font-semibold text-white">Jednorázový servis</span>
          </label>

          {!form.is_one_time && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Interval (měsíce)</label>
                <input
                  type="number"
                  min={1}
                  value={form.interval_months || 12}
                  onChange={e => setForm({ ...form, interval_months: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  Dohodnutá cena
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={form.agreed_price ?? ''}
                    onChange={e => setForm({ ...form, agreed_price: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Kč</span>
                </div>
              </div>
            </div>
          )}

          {form.is_one_time && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Provést do</label>
                <input
                  type="date"
                  value={form.deadline || ''}
                  onChange={e => setForm({ ...form, deadline: e.target.value || null })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  Dohodnutá cena
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={form.agreed_price ?? ''}
                    onChange={e => setForm({ ...form, agreed_price: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Kč</span>
                </div>
              </div>
            </div>
          )}

          {!form.project_id && (
            <div className="p-4 rounded-xl bg-slate-500/5 border border-slate-500/15 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <User className="w-3.5 h-3.5" />
                Kontaktní údaje zákazníka
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3 h-3" /> Vyhledat existujícího klienta
                </label>
                <ClientAutocomplete
                  onSelect={(client) => {
                    setForm(prev => ({
                      ...prev,
                      client_name: client.name || '',
                      client_email: client.email || '',
                      client_phone: client.phone || '',
                      client_address: client.address || '',
                      client_ico: client.ico || '',
                      client_dic: client.dic || '',
                      address_lat: client.address_lat,
                      address_lon: client.address_lon,
                    }));
                  }}
                  placeholder="Hledat klienta podle jména, emailu, telefonu nebo IČO..."
                />
              </div>

              {form.client_name && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {form.client_ico ? (
                        <Building2 className="w-4 h-4 text-blue-400" />
                      ) : (
                        <User className="w-4 h-4 text-blue-400" />
                      )}
                      <span className="text-sm font-bold text-white">{form.client_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        client_name: '',
                        client_email: '',
                        client_phone: '',
                        client_address: '',
                        client_ico: '',
                        client_dic: '',
                        address_lat: null,
                        address_lon: null,
                      }))}
                      className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    {form.client_phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {form.client_phone}
                      </div>
                    )}
                    {form.client_email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {form.client_email}
                      </div>
                    )}
                    {form.client_address && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{form.client_address}</span>
                      </div>
                    )}
                    {form.client_ico && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        ICO: {form.client_ico}
                      </div>
                    )}
                    {form.client_dic && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        DIC: {form.client_dic}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-2 border-t border-white/[0.06]">
                Nebo vyplňte ručně
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno / Název firmy</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={e => setForm({ ...form, client_name: e.target.value })}
                    placeholder="Jan Novak / Firma s.r.o."
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Telefon
                  </label>
                  <input
                    type="tel"
                    value={form.client_phone}
                    onChange={e => setForm({ ...form, client_phone: e.target.value })}
                    placeholder="+420 123 456 789"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Adresa (s vyhledáváním)
                </label>
                <AddressAutocomplete
                  value={form.client_address}
                  lat={form.address_lat}
                  lon={form.address_lon}
                  onChange={handleAddressChange}
                  placeholder="Zadejte ulici a město..."
                  includeClients
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={e => setForm({ ...form, client_email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> ICO
                  </label>
                  <input
                    type="text"
                    value={form.client_ico}
                    onChange={e => setForm({ ...form, client_ico: e.target.value })}
                    placeholder="12345678"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> DIC
                  </label>
                  <input
                    type="text"
                    value={form.client_dic}
                    onChange={e => setForm({ ...form, client_dic: e.target.value })}
                    placeholder="CZ12345678"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                Výkaz práce ({workEntries.length})
              </div>
              <button
                type="button"
                onClick={addWorkEntry}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="w-3 h-3" /> Přidat
              </button>
            </div>

            {workEntries.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">Žádné záznamy práce</p>
            ) : (
              <div className="space-y-2">
                {workEntries.map((w, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="col-span-3">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Pracovník</label>
                      <input
                        type="text"
                        value={w.worker_name}
                        onChange={e => updateWorkEntry(idx, 'worker_name', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Datum</label>
                      <input
                        type="date"
                        value={w.work_date}
                        onChange={e => updateWorkEntry(idx, 'work_date', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Hodiny</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={w.hours}
                        onChange={e => updateWorkEntry(idx, 'hours', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Sazba/h</label>
                      <input
                        type="number"
                        min={0}
                        value={w.hourly_rate}
                        onChange={e => updateWorkEntry(idx, 'hourly_rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-[10px] text-slate-500 mb-0.5">Celkem</div>
                      <div className="text-xs font-bold text-blue-400">{(w.hours * w.hourly_rate).toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeWorkEntry(idx)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {workEntries.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-white/[0.06]">
                <span className="text-xs text-slate-400">Celkem práce: <span className="font-bold text-blue-400">{totalWorkCost.toLocaleString('cs-CZ')} Kč</span></span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                <Package className="w-3.5 h-3.5" />
                Materiál ({materialEntries.length})
              </div>
              <button
                type="button"
                onClick={addMaterialEntry}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                <Plus className="w-3 h-3" /> Přidat
              </button>
            </div>

            {materialEntries.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">Žádný materiál</p>
            ) : (
              <div className="space-y-2">
                {materialEntries.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="col-span-4">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Název</label>
                      <input
                        type="text"
                        value={m.material_name}
                        onChange={e => updateMaterialEntry(idx, 'material_name', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Množství</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={m.quantity}
                        onChange={e => updateMaterialEntry(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Jedn.</label>
                      <input
                        type="text"
                        value={m.unit}
                        onChange={e => updateMaterialEntry(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Cena/j</label>
                      <input
                        type="number"
                        min={0}
                        value={m.unit_price}
                        onChange={e => updateMaterialEntry(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-xs"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-[10px] text-slate-500 mb-0.5">Celkem</div>
                      <div className="text-xs font-bold text-amber-400">{(m.quantity * m.unit_price).toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeMaterialEntry(idx)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {materialEntries.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-white/[0.06]">
                <span className="text-xs text-slate-400">Celkem materiál: <span className="font-bold text-amber-400">{totalMaterialCost.toLocaleString('cs-CZ')} Kč</span></span>
              </div>
            )}
          </div>

          {(workEntries.length > 0 || materialEntries.length > 0) && (
            <div className="flex justify-end p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm text-white">
                Celkové náklady: <span className="font-bold text-emerald-400">{(totalWorkCost + totalMaterialCost).toLocaleString('cs-CZ')} Kč</span>
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
