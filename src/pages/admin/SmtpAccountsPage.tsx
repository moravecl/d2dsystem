import { useEffect, useState } from 'react';
import { Mail, Plus, CreditCard as Edit2, Trash2, Check, X, Eye, EyeOff, Zap, Inbox, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

interface SmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password_encrypted: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  imap_host: string | null;
  imap_port: number;
  imap_username: string | null;
  imap_password: string | null;
  imap_use_ssl: boolean;
  imap_enabled: boolean;
  imap_last_synced_at: string | null;
}

const EMPTY_FORM = {
  name: '',
  host: '',
  port: 587,
  username: '',
  password_encrypted: '',
  from_email: '',
  from_name: '',
  use_tls: true,
  is_default: false,
  imap_host: '',
  imap_port: 993,
  imap_username: '',
  imap_password: '',
  imap_use_ssl: true,
  imap_enabled: false,
};

export default function SmtpAccountsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SmtpAccount | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('smtp_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (acc: SmtpAccount) => {
    setEditing(acc);
    setForm({
      name: acc.name,
      host: acc.host,
      port: acc.port,
      username: acc.username,
      password_encrypted: acc.password_encrypted,
      from_email: acc.from_email,
      from_name: acc.from_name,
      use_tls: acc.use_tls,
      is_default: acc.is_default,
      imap_host: acc.imap_host ?? '',
      imap_port: acc.imap_port ?? 993,
      imap_username: acc.imap_username ?? '',
      imap_password: acc.imap_password ?? '',
      imap_use_ssl: acc.imap_use_ssl !== false,
      imap_enabled: acc.imap_enabled === true,
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.host || !form.from_email) {
      toast('Vyplňte název, SMTP server a odesílací email', 'error');
      return;
    }
    if (form.imap_enabled && (!form.imap_host || !form.imap_username)) {
      toast('Pro zapnutí příchozí pošty vyplňte IMAP server a přihlašovací jméno', 'error');
      return;
    }
    setSaving(true);

    if (form.is_default) {
      await supabase.from('smtp_accounts').update({ is_default: false }).eq('is_default', true);
    }

    if (editing) {
      const { error } = await supabase
        .from('smtp_accounts')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
      toast('SMTP účet aktualizován');
    } else {
      const { error } = await supabase
        .from('smtp_accounts')
        .insert({ ...form, user_id: user!.id });
      if (error) { toast('Chyba při vytváření', 'error'); setSaving(false); return; }
      toast('SMTP účet vytvořen');
    }

    setSaving(false);
    setShowModal(false);
    loadAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tento SMTP účet?')) return;
    const { error } = await supabase.from('smtp_accounts').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('SMTP účet smazán');
    loadAccounts();
  };

  const handleToggleActive = async (acc: SmtpAccount) => {
    await supabase.from('smtp_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id);
    loadAccounts();
  };

  const handleSetDefault = async (acc: SmtpAccount) => {
    await supabase.from('smtp_accounts').update({ is_default: false }).eq('is_default', true);
    await supabase.from('smtp_accounts').update({ is_default: true }).eq('id', acc.id);
    loadAccounts();
    toast('Výchozí účet nastaven');
  };

  const handleTestImap = async (acc: SmtpAccount) => {
    setTesting(acc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/imap-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode: 'test', account_id: acc.id }),
        }
      );
      const result = await res.json();
      const r = result.results?.[0];
      if (r?.ok) {
        toast(`IMAP spojení funguje — ve schránce ${r.messages ?? 0} zpráv (${r.unseen ?? 0} nepřečtených)`);
      } else {
        toast(r?.error || result.error || 'IMAP test selhal', 'error');
      }
    } catch {
      toast('IMAP test selhal', 'error');
    }
    setTesting(null);
  };

  const handleSyncNow = async (acc: SmtpAccount) => {
    setTesting(acc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/imap-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ account_id: acc.id }),
        }
      );
      const result = await res.json();
      const r = result.results?.[0];
      if (r && !r.error) {
        toast(`Synchronizace hotova — staženo ${r.inserted ?? 0} nových e-mailů`);
        loadAccounts();
      } else {
        toast(r?.error || result.error || 'Synchronizace selhala', 'error');
      }
    } catch {
      toast('Synchronizace selhala', 'error');
    }
    setTesting(null);
  };

  const handleTestConnection = async (acc: SmtpAccount) => {
    setTesting(acc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            smtp_account_id: acc.id,
            to_emails: [acc.from_email],
            subject: 'HouseSmart - Test SMTP',
            body_html: '<h2>Test SMTP spojeni</h2><p>Toto je testovaci email z HouseSmart systemu.</p>',
            body_text: 'Test SMTP spojeni - HouseSmart',
          }),
        }
      );
      const result = await res.json();
      if (result.success) {
        toast('Testovací email odeslán úspěšně');
      } else {
        toast(result.detail || result.error || 'Test selhal', 'error');
      }
    } catch {
      toast('Chyba při testování spojení', 'error');
    }
    setTesting(null);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2].map(i => <div key={i} className="h-20 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Mail className="w-6 h-6 text-slate-300" />
            <h1 className="text-xl font-bold text-white">SMTP účty</h1>
          </div>
          <p className="text-sm text-slate-500">Správa SMTP serverů pro odesílání emailů ze systému</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Přidat SMTP
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-navy-800/60 rounded-2xl border border-white/10 p-12 text-center">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Zatím žádné SMTP účty</p>
          <p className="text-xs text-slate-400 mt-1">Přidejte SMTP server pro odesílání emailů</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((acc) => (
            <div key={acc.id} className={`bg-navy-800/60 rounded-2xl border p-5 transition ${acc.is_active ? 'border-white/10' : 'border-white/10 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${acc.is_default ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.06] text-slate-500'}`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{acc.name}</span>
                      {acc.is_default && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Výchozí</span>
                      )}
                      {!acc.is_active && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">Neaktivní</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>{acc.host}:{acc.port} {acc.use_tls ? '(TLS)' : ''}</div>
                      <div>{acc.from_name} &lt;{acc.from_email}&gt;</div>
                      {acc.imap_enabled ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Inbox className="w-3 h-3" />
                          IMAP zapnuto ({acc.imap_host}:{acc.imap_port})
                          {acc.imap_last_synced_at && (
                            <span className="text-slate-500">
                              — poslední sync {new Date(acc.imap_last_synced_at).toLocaleString('cs-CZ')}
                            </span>
                          )}
                        </div>
                      ) : acc.imap_host ? (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Inbox className="w-3 h-3" /> IMAP vyplněno, ale vypnuto
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTestConnection(acc)}
                    disabled={testing === acc.id || !acc.is_active}
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50"
                    title="Otestovat SMTP (odešle testovací e-mail)"
                  >
                    <Zap className={`w-4 h-4 ${testing === acc.id ? 'animate-pulse' : ''}`} />
                  </button>
                  {acc.imap_host && (
                    <button
                      onClick={() => handleTestImap(acc)}
                      disabled={testing === acc.id || !acc.is_active}
                      className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition disabled:opacity-50"
                      title="Otestovat IMAP spojení"
                    >
                      <Inbox className={`w-4 h-4 ${testing === acc.id ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                  {acc.imap_enabled && (
                    <button
                      onClick={() => handleSyncNow(acc)}
                      disabled={testing === acc.id || !acc.is_active}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-50"
                      title="Synchronizovat poštu teď"
                    >
                      <RefreshCw className={`w-4 h-4 ${testing === acc.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  {!acc.is_default && acc.is_active && (
                    <button
                      onClick={() => handleSetDefault(acc)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition"
                      title="Nastavit jako výchozí"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(acc)}
                    className={`p-2 rounded-lg transition ${acc.is_active ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                    title={acc.is_active ? 'Deaktivovat' : 'Aktivovat'}
                  >
                    {acc.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(acc)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Upravit SMTP účet' : 'Nový SMTP účet'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.06] rounded-xl hover:bg-white/[0.08] transition">
              Zrušit
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Ukládám...' : editing ? 'Uložit změny' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název účtu</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Např. Firemní SMTP"
              className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">SMTP server</label>
              <input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 587 })}
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Uživatelské jméno</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="user@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Heslo</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password_encrypted}
                  onChange={(e) => setForm({ ...form, password_encrypted: e.target.value })}
                  className="w-full px-3.5 py-2.5 pr-10 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Odesílací email</label>
              <input
                value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                placeholder="info@firma.cz"
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno odesílatele</label>
              <input
                value={form.from_name}
                onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                placeholder="HouseSmart"
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.use_tls}
                onChange={(e) => setForm({ ...form, use_tls: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-300">Použít TLS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-300">Výchozí účet</span>
            </label>
          </div>

          <div className="pt-4 mt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">Příchozí pošta (IMAP)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.imap_enabled}
                  onChange={(e) => setForm({ ...form, imap_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-300">Stahovat poštu</span>
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Schránka se synchronizuje automaticky každých 5 minut. E-maily se heuristicky
              přiřazují k projektům, nepřiřazené najdete v Poště se štítkem „Nepřiřazeno".
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">IMAP server</label>
                <input
                  value={form.imap_host}
                  onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                  placeholder="imap.gmail.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Port</label>
                <input
                  type="number"
                  value={form.imap_port}
                  onChange={(e) => setForm({ ...form, imap_port: parseInt(e.target.value) || 993 })}
                  className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Přihlašovací jméno</label>
                <input
                  value={form.imap_username}
                  onChange={(e) => setForm({ ...form, imap_username: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Heslo</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.imap_password}
                  onChange={(e) => setForm({ ...form, imap_password: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={form.imap_use_ssl}
                onChange={(e) => setForm({ ...form, imap_use_ssl: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-300">Použít SSL (port 993)</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
