import { useState, useEffect } from 'react';
import { X, Shield, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import { DUE_TYPE_LABELS } from '../../types/assets';
import type { DueType, DueItem, InsuranceCoverageType } from '../../types/assets';
import type { Profile } from '../../types/database';

interface Props {
  assetId: string;
  item?: DueItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function DueItemFormModal({ assetId, item, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [coverageTypes, setCoverageTypes] = useState<InsuranceCoverageType[]>([]);
  const [newCoverageName, setNewCoverageName] = useState('');
  const [addingCoverage, setAddingCoverage] = useState(false);

  const [form, setForm] = useState({
    due_type: (item?.due_type || 'revision') as DueType,
    label: item?.label || '',
    due_date: item?.due_date || '',
    interval_months: item?.interval_months?.toString() || '',
    interval_km: item?.interval_km?.toString() || '',
    responsible_user_id: item?.responsible_user_id || '',
    insurance_company: item?.insurance_company || '',
    insurance_policy_number: item?.insurance_policy_number || '',
    insurance_price: item?.insurance_price ? String(item.insurance_price) : '',
    insurance_payment_frequency: item?.insurance_payment_frequency || 'annual',
    insurance_coverages: item?.insurance_coverages || [] as string[],
  });

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => setProfiles((data || []) as Profile[]));
    loadCoverageTypes();
  }, []);

  const loadCoverageTypes = async () => {
    const { data } = await supabase
      .from('insurance_coverage_types')
      .select('*')
      .order('sort_order');
    setCoverageTypes((data || []) as InsuranceCoverageType[]);
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const isEdit = !!item;
  const isInsurance = form.due_type === 'insurance';

  const toggleCoverage = (code: string) => {
    setForm(prev => ({
      ...prev,
      insurance_coverages: prev.insurance_coverages.includes(code)
        ? prev.insurance_coverages.filter(c => c !== code)
        : [...prev.insurance_coverages, code],
    }));
  };

  const handleAddCustomCoverage = async () => {
    if (!newCoverageName.trim()) return;
    setAddingCoverage(true);
    const code = newCoverageName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { data: orgData } = await supabase.rpc('get_my_organization_id');
    const orgId = orgData;
    const { error } = await supabase.from('insurance_coverage_types').insert({
      name: newCoverageName.trim(),
      code,
      is_default: false,
      organization_id: orgId,
      sort_order: coverageTypes.length + 1,
    });
    setAddingCoverage(false);
    if (error) {
      toast('Chyba při přidávání typu', 'error');
      return;
    }
    setNewCoverageName('');
    await loadCoverageTypes();
    setForm(prev => ({
      ...prev,
      insurance_coverages: [...prev.insurance_coverages, code],
    }));
  };

  const handleSave = async () => {
    if (!form.label.trim()) { toast('Zadejte popis', 'error'); return; }
    setSaving(true);

    const payload: Record<string, unknown> = {
      due_type: form.due_type,
      label: form.label.trim(),
      due_date: form.due_date || null,
      interval_months: form.interval_months ? parseInt(form.interval_months) : null,
      interval_km: form.interval_km ? parseInt(form.interval_km) : null,
      responsible_user_id: form.responsible_user_id || null,
      insurance_company: isInsurance ? (form.insurance_company || null) : null,
      insurance_policy_number: isInsurance ? (form.insurance_policy_number || null) : null,
      insurance_price: isInsurance && form.insurance_price ? parseFloat(form.insurance_price) : null,
      insurance_payment_frequency: isInsurance ? form.insurance_payment_frequency : null,
      insurance_coverages: isInsurance ? form.insurance_coverages : [],
    };

    if (isEdit) {
      const { error } = await supabase.from('due_items').update(payload).eq('id', item.id);
      setSaving(false);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      await logAudit('due_item', item.id, 'updated', { asset_id: assetId, type: form.due_type });
      toast('Uloženo');
    } else {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('due_items').insert({
        ...payload,
        asset_id: assetId,
        status: 'ok',
        created_by: user.user?.id,
      });
      setSaving(false);
      if (error) { toast('Chyba při vytváření', 'error'); return; }
      await logAudit('due_item', null, 'created', { asset_id: assetId, type: form.due_type });
      toast('Přidáno');
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-navy-800/60 rounded-2xl shadow-2xl w-full overflow-hidden ${isInsurance ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Upravit' : 'Přidat'} {isInsurance ? 'pojištění' : 'termín'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Typ *</label>
            <select
              value={form.due_type}
              onChange={e => set('due_type', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {Object.entries(DUE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Popis *</label>
            <input
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder={isInsurance ? 'Např. Pojištění vozidla' : 'Např. Revize elektro'}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {isInsurance && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                Údaje pojištění
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Pojišťovna</label>
                  <input
                    value={form.insurance_company}
                    onChange={e => set('insurance_company', e.target.value)}
                    placeholder="Např. Česká pojišťovna"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Číslo smlouvy</label>
                  <input
                    value={form.insurance_policy_number}
                    onChange={e => set('insurance_policy_number', e.target.value)}
                    placeholder="Např. 123456789"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Frekvence platby</label>
                  <select
                    value={form.insurance_payment_frequency}
                    onChange={e => set('insurance_payment_frequency', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="annual">Ročně</option>
                    <option value="semi_annual">Pololetně</option>
                    <option value="quarterly">Čtvrtletně</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Cena za {form.insurance_payment_frequency === 'quarterly' ? 'čtvrtletí' : form.insurance_payment_frequency === 'semi_annual' ? 'pololetí' : 'rok'} (Kč)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.insurance_price}
                    onChange={e => set('insurance_price', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              {form.insurance_price && parseFloat(form.insurance_price) > 0 && form.insurance_payment_frequency !== 'annual' && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-xs text-amber-400">
                    {form.insurance_payment_frequency === 'quarterly'
                      ? `Roční náklad: ${(parseFloat(form.insurance_price) * 4).toLocaleString('cs-CZ')} Kč (4 x ${parseFloat(form.insurance_price).toLocaleString('cs-CZ')} Kč)`
                      : `Roční náklad: ${(parseFloat(form.insurance_price) * 2).toLocaleString('cs-CZ')} Kč (2 x ${parseFloat(form.insurance_price).toLocaleString('cs-CZ')} Kč)`
                    }
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Oblasti pojištění</label>
                <div className="space-y-2">
                  {coverageTypes.map(ct => (
                    <label
                      key={ct.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                        form.insurance_coverages.includes(ct.code)
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.insurance_coverages.includes(ct.code)}
                        onChange={() => toggleCoverage(ct.code)}
                        className="w-4 h-4 rounded accent-blue-500"
                      />
                      <span className="text-sm text-white flex-1">{ct.name}</span>
                      {!ct.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/10">
                          Vlastní
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    value={newCoverageName}
                    onChange={e => setNewCoverageName(e.target.value)}
                    placeholder="Přidat vlastní typ..."
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomCoverage()}
                    className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    onClick={handleAddCustomCoverage}
                    disabled={!newCoverageName.trim() || addingCoverage}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Přidat
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Platnost do</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Interval (měsíce)</label>
              <input
                type="number"
                value={form.interval_months}
                onChange={e => set('interval_months', e.target.value)}
                placeholder="např. 12"
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Interval (km)</label>
              <input
                type="number"
                value={form.interval_km}
                onChange={e => set('interval_km', e.target.value)}
                placeholder="např. 15000"
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Odpovědná osoba</label>
            <select
              value={form.responsible_user_id}
              onChange={e => set('responsible_user_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Nevybráno</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.04]">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] rounded-xl transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.label.trim()}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : isEdit ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}
