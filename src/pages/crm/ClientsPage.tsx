import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ExternalLink, Building2, Home, Landmark, Users, FileSpreadsheet } from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/auditLog';
import type { Client } from '../../types/database';
import ExcelImportClientsModal from '../../components/crm/ExcelImportClientsModal';

const clientTypeLabels: Record<string, { label: string; icon: typeof Home }> = {
  rd: { label: 'RD', icon: Home },
  firma: { label: 'Firma', icon: Building2 },
  obec: { label: 'Obec', icon: Landmark },
};

export default function ClientsPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    client_type: 'rd' as 'rd' | 'firma' | 'obec',
    city: '',
    ico: '',
    dic: '',
  });

  const loadClients = useCallback(async () => {
    let query = supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (typeFilter) {
      query = query.eq('client_type', typeFilter);
    }

    const { data } = await query;
    setClients((data || []) as Client[]);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'CRM', href: '/crm' }, { label: 'Klienti' }],
      primaryAction: {
        label: 'Nový klient',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowModal(true),
      },
    });
  }, [setConfig]);

  const handleSave = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast('Vyplňte povinné údaje', 'error');
      return;
    }
    if (!user) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        client_type: form.client_type,
        city: form.city,
        ico: form.ico,
        dic: form.dic,
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (error) {
      toast('Chyba při vytváření klienta', 'error');
      return;
    }

    if (data) {
      await logAudit('client', data.id, 'created', { name: form.name });
      toast('Klient vytvořen');
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', client_type: 'rd', city: '', ico: '', dic: '' });
      navigate(`/crm/${data.id}`);
    }
  };

  const clientSortOptions = [
    { key: 'name', label: 'Jméno' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'Město' },
    { key: 'client_type', label: 'Typ' },
    { key: 'created_at', label: 'Datum přidání' },
  ];

  const filtered = sortItems(
    clients.filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }),
    sortKey,
    sortDir
  );

  const inputClasses = 'w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Hledat klienty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
          />
        </div>
        <SortControl
          options={clientSortOptions}
          sortKey={sortKey}
          sortDir={sortDir}
          onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
        />
        <button
          onClick={() => setShowXmlModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 bg-white/[0.06]/[0.07] border border-white/10 rounded-xl hover:bg-white/[0.06]/[0.12] transition shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          Import Excel
        </button>
        <div className="flex gap-1.5">
          {['', 'rd', 'firma', 'obec'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 text-sm font-medium rounded-xl border transition-all ${
                typeFilter === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white/[0.06]/[0.07] text-slate-400 border-white/10 hover:bg-white/[0.06]/[0.12]'
              }`}
            >
              {t === '' ? 'Vše' : clientTypeLabels[t]?.label || t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden panel-3d">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-navy-700/50 rounded-lg animate-skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Žádní klienti</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.07]">Jméno</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell border-b border-white/[0.07]">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell border-b border-white/[0.07]">Telefon</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell border-b border-white/[0.07]">Typ</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell border-b border-white/[0.07]">Město</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.07]">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.map((client) => {
                  const TypeIcon = clientTypeLabels[client.client_type]?.icon || Home;
                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-white/[0.06]/[0.04] transition-colors cursor-pointer group"
                      onClick={() => navigate(`/crm/${client.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-blue-300 shrink-0">
                            <span className="text-sm font-bold">{client.name[0]?.toUpperCase()}</span>
                          </div>
                          <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{client.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-400 hidden sm:table-cell">{client.email}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-400 hidden md:table-cell">{client.phone}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 bg-white/[0.06]/[0.08] px-2 py-1 rounded-lg border border-white/10">
                          <TypeIcon className="w-3 h-3" />
                          {clientTypeLabels[client.client_type]?.label || client.client_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-400 hidden lg:table-cell">{client.city}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/${client.id}`);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/100/100/15 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExcelImportClientsModal
        open={showXmlModal}
        onClose={() => setShowXmlModal(false)}
        onImported={() => { loadClients(); }}
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nový klient"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.07] rounded-xl transition-colors"
            >
              Zrušit
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Název / Jméno *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClasses} placeholder="Jan Novák" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClasses} placeholder="jan@email.cz" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Telefon *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClasses} placeholder="+420 123 456 789" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Typ klienta</label>
            <div className="flex gap-2">
              {(['rd', 'firma', 'obec'] as const).map((t) => {
                const TypeIcon = clientTypeLabels[t].icon;
                return (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, client_type: t })}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all flex-1 justify-center ${
                      form.client_type === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white/[0.06]/[0.07] text-slate-400 border-white/10 hover:bg-white/[0.06]/[0.12]'
                    }`}
                  >
                    <TypeIcon className="w-4 h-4" />
                    {clientTypeLabels[t].label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Město</label>
            <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClasses} placeholder="Praha" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">IČO</label>
              <input type="text" value={form.ico} onChange={(e) => setForm({ ...form, ico: e.target.value })} className={inputClasses} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">DIČ</label>
              <input type="text" value={form.dic} onChange={(e) => setForm({ ...form, dic: e.target.value })} className={inputClasses} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
