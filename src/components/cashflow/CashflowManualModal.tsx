import { useState, useEffect, useRef } from 'react';
import { X, Search, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useOrganization } from '../../contexts/OrganizationContext';
import type { CashflowManualEntry, VatRefund } from '../../types/cashflow';

interface ProjectRef { id: string; project_name: string; }
interface ClientRef {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  ico: string | null;
  dic: string | null;
}

interface ManualProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entry?: CashflowManualEntry | null;
}

interface VatProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  refund?: VatRefund | null;
}

export function ManualEntryModal({ open, onClose, onSaved, entry }: ManualProps) {
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'inflow' as 'inflow' | 'outflow',
    amount_gross: '',
    title: '',
    note: '',
    project_id: '',
    client_name: '',
    client_address: '',
    client_email: '',
    client_phone: '',
    client_ico: '',
    client_dic: '',
  });

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientRef[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [searchingClients, setSearchingClients] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('projects').select('id, project_name').order('project_name').then(({ data }) => {
      setProjects((data || []) as ProjectRef[]);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const t = (entry.type === 'in' ? 'inflow' : entry.type === 'out' ? 'outflow' : entry.type) as 'inflow' | 'outflow';
      setForm({
        date: entry.date,
        type: t,
        amount_gross: String(entry.amount_gross),
        title: entry.title,
        note: entry.note || '',
        project_id: entry.project_id || '',
        client_name: '',
        client_address: '',
        client_email: '',
        client_phone: '',
        client_ico: '',
        client_dic: '',
      });
    } else {
      setForm({ date: new Date().toISOString().slice(0, 10), type: 'inflow', amount_gross: '', title: '', note: '', project_id: '', client_name: '', client_address: '', client_email: '', client_phone: '', client_ico: '', client_dic: '' });
    }
    setClientSearch('');
    setClientResults([]);
    setShowClientDropdown(false);
  }, [open, entry]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingClients(true);
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, phone, address, city, zip, ico, dic')
        .or(`name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%,ico.ilike.%${clientSearch}%`)
        .limit(10);
      setClientResults((data || []) as ClientRef[]);
      setSearchingClients(false);
      setShowClientDropdown(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  const selectClient = (client: ClientRef) => {
    const fullAddress = [client.address, client.city, client.zip].filter(Boolean).join(', ');
    setForm(f => ({
      ...f,
      client_name: client.name,
      client_address: fullAddress,
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_ico: client.ico || '',
      client_dic: client.dic || '',
    }));
    setClientSearch('');
    setShowClientDropdown(false);
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.amount_gross || !form.date) {
      toast('Vyplňte popis, datum a částku', 'error');
      return;
    }
    if (!organization?.id) {
      toast('Chyba: organizace nenalezena', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      org_id: organization.id,
      date: form.date,
      type: form.type,
      amount_gross: parseFloat(form.amount_gross.replace(',', '.')) || 0,
      title: form.title,
      note: form.note || null,
      project_id: form.project_id || null,
    };

    if (entry) {
      const { error } = await supabase.from('cashflow_manual_entries').update(payload).eq('id', entry.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('cashflow_manual_entries').insert(payload);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    }

    toast(entry ? 'Záznam upraven' : 'Záznam přidán');
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <h2 className="text-lg font-bold text-white">{entry ? 'Upravit záznam' : 'Nový ruční záznam'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-2">
            {(['inflow', 'outflow'] as const).map(t => (
              <button key={t} onClick={() => set('type', t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                  form.type === t
                    ? t === 'inflow' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                }`}>
                {t === 'inflow' ? 'Příjem' : 'Výdaj'}
              </button>
            ))}
          </div>

          <div ref={clientSearchRef} className="relative">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Vyhledat klienta</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Hledat podle jmena, emailu nebo ICO..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            {showClientDropdown && clientResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#1e293b] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {clientResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectClient(c)}
                    className="w-full px-3 py-2 text-left hover:bg-white/[0.08] transition flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{c.name}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {[c.email, c.ico].filter(Boolean).join(' | ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showClientDropdown && clientSearch.length >= 2 && clientResults.length === 0 && !searchingClients && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#1e293b] border border-white/10 rounded-xl shadow-xl px-3 py-2 text-sm text-slate-400">
                Zadny klient nenalezen
              </div>
            )}
          </div>

          {form.client_name && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Vybrany klient</span>
                <button
                  onClick={() => setForm(f => ({ ...f, client_name: '', client_address: '', client_email: '', client_phone: '', client_ico: '', client_dic: '' }))}
                  className="text-xs text-slate-400 hover:text-red-400 transition"
                >
                  Zrusit
                </button>
              </div>
              <div className="text-sm text-white font-medium">{form.client_name}</div>
              {form.client_address && <div className="text-xs text-slate-400">{form.client_address}</div>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {form.client_email && <span>{form.client_email}</span>}
                {form.client_phone && <span>{form.client_phone}</span>}
                {form.client_ico && <span>ICO: {form.client_ico}</span>}
                {form.client_dic && <span>DIC: {form.client_dic}</span>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Popis záznamu"
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Částka (Kč) *</label>
              <input type="number" value={form.amount_gross} onChange={e => set('amount_gross', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="" className="bg-[#0f172a]">-- Bez projektu --</option>
              {projects.map(p => <option key={p.id} value={p.id} className="bg-[#0f172a]">{p.project_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] transition">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VatRefundModal({ open, onClose, onSaved, refund }: VatProps) {
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount_gross: '',
    note: '',
  });

  useEffect(() => {
    if (!open) return;
    if (refund) {
      setForm({ date: refund.date, amount_gross: String(refund.amount_gross), note: refund.note || '' });
    } else {
      setForm({ date: new Date().toISOString().slice(0, 10), amount_gross: '', note: '' });
    }
  }, [open, refund]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.amount_gross || !form.date) {
      toast('Vyplňte datum a částku', 'error');
      return;
    }
    if (!organization?.id) {
      toast('Chyba: organizace nenalezena', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      org_id: organization.id,
      date: form.date,
      amount_gross: parseFloat(form.amount_gross) || 0,
      note: form.note || null,
    };

    if (refund) {
      const { error } = await supabase.from('vat_refunds').update(payload).eq('id', refund.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('vat_refunds').insert(payload);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
    }

    toast(refund ? 'Vratka DPH upravena' : 'Vratka DPH přidána');
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <h2 className="text-lg font-bold text-white">{refund ? 'Upravit vratku DPH' : 'Nová vratka DPH'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum *</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Částka vratky (Kč) *</label>
            <input type="number" value={form.amount_gross} onChange={e => set('amount_gross', e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <input value={form.note} onChange={e => set('note', e.target.value)}
              placeholder="Volitelný popis"
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] transition">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}
