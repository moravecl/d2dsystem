import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, Users, Building2, Phone, Mail,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';

export interface Supplier {
  id: string;
  name: string;
  ico: string;
  dic: string;
  address: string;
  email: string;
  phone: string;
  contact_person: string;
  default_due_days: number;
  note: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

interface Props {
  embedded?: boolean;
}

const EMPTY_FORM = {
  name: '', ico: '', dic: '', address: '', email: '', phone: '',
  contact_person: '', default_due_days: 14, note: '',
};

export default function SuppliersPage({ embedded }: Props) {
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (embedded) return;
    setConfig({
      breadcrumbs: [
        { label: 'Finance', href: '/finance' },
        { label: 'Dodavatelé' },
      ],
      primaryAction: {
        label: 'Nový dodavatel',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => { setEditSupplier(null); setForm(EMPTY_FORM); setShowModal(true); },
      },
    });
  }, [setConfig, embedded]);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setSuppliers((data || []) as Supplier[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editSupplier) {
      const { error } = await supabase
        .from('suppliers')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editSupplier.id);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Dodavatel aktualizován');
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert({ ...form, created_by: user!.id });
      if (error) { toast('Chyba', 'error'); return; }
      toast('Dodavatel vytvořen');
    }
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Smazat dodavatele ${s.name}?`)) return;
    await supabase.from('suppliers').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', s.id);
    toast('Dodavatel smazán');
    loadData();
  };

  const filtered = suppliers.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.ico.includes(q) || s.contact_person.toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dodavatelů</div>
              <div className="text-lg font-extrabold text-white">{suppliers.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">S IČO</div>
              <div className="text-lg font-extrabold text-white">{suppliers.filter(s => s.ico).length}</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">S emailem</div>
              <div className="text-lg font-extrabold text-white">{suppliers.filter(s => s.email).length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat dodavatele..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          {embedded && (
            <button
              onClick={() => { setEditSupplier(null); setForm(EMPTY_FORM); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" /> Nový dodavatel
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/10">
                <th className="pb-3 pr-4">Název</th>
                <th className="pb-3 pr-4">IČO</th>
                <th className="pb-3 pr-4">DIČ</th>
                <th className="pb-3 pr-4">Kontakt</th>
                <th className="pb-3 pr-4">Splatnost</th>
                <th className="pb-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.04] transition">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-white">{s.name}</div>
                    {s.address && <div className="text-xs text-slate-400 mt-0.5">{s.address}</div>}
                  </td>
                  <td className="py-3 pr-4 text-slate-400">{s.ico || '-'}</td>
                  <td className="py-3 pr-4 text-slate-400">{s.dic || '-'}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-0.5">
                      {s.contact_person && <span className="text-slate-300 text-xs font-medium">{s.contact_person}</span>}
                      {s.email && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Mail className="w-3 h-3" />{s.email}
                        </span>
                      )}
                      {s.phone && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Phone className="w-3 h-3" />{s.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs font-bold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded">
                      {s.default_due_days} dní
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditSupplier(s);
                          setForm({
                            name: s.name, ico: s.ico, dic: s.dic, address: s.address,
                            email: s.email, phone: s.phone, contact_person: s.contact_person,
                            default_due_days: s.default_due_days, note: s.note,
                          });
                          setShowModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded-lg hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Žádní dodavatelé</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editSupplier ? 'Upravit dodavatele' : 'Nový dodavatel'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {editSupplier ? 'Uložit' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Název firmy"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kontaktní osoba</label>
              <input
                value={form.contact_person}
                onChange={e => setForm(prev => ({ ...prev, contact_person: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">IČO</label>
              <input
                value={form.ico}
                onChange={e => setForm(prev => ({ ...prev, ico: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="12345678"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">DIČ</label>
              <input
                value={form.dic}
                onChange={e => setForm(prev => ({ ...prev, dic: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="CZ12345678"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Standardní splatnost (dny)</label>
              <input
                type="number"
                value={form.default_due_days}
                onChange={e => setForm(prev => ({ ...prev, default_due_days: parseInt(e.target.value) || 14 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Adresa</label>
            <input
              value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Ulice, Město, PSČ"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Telefon</label>
              <input
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <textarea
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
