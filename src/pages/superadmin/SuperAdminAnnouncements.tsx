import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Megaphone, Plus, Trash2, X, Save, CheckCircle,
  AlertTriangle, Wrench, Sparkles, Building2, Globe
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  announcement_type: string;
  target_org_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  target_org_name?: string;
}

interface Org { id: string; name: string; }

const typeConfig = {
  info: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-700/40', label: 'Informace' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-700/40', label: 'Varování' },
  maintenance: { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-700/40', label: 'Údržba' },
  feature: { icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/40', label: 'Novinka' },
};

export default function SuperAdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    announcement_type: 'info',
    target_org_id: '',
    is_active: true,
    expires_at: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [annRes, orgsRes] = await Promise.all([
      supabase.from('system_announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('id, name').order('name'),
    ]);

    const orgMap: Record<string, string> = {};
    for (const o of orgsRes.data ?? []) orgMap[o.id] = o.name;

    const enriched = (annRes.data ?? []).map(a => ({
      ...a,
      target_org_name: a.target_org_id ? orgMap[a.target_org_id] : undefined,
    }));

    setItems(enriched);
    setOrgs(orgsRes.data ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('system_announcements').insert({
      title: form.title,
      body: form.body,
      announcement_type: form.announcement_type,
      target_org_id: form.target_org_id || null,
      is_active: form.is_active,
      expires_at: form.expires_at || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    setShowForm(false);
    setForm({ title: '', body: '', announcement_type: 'info', target_org_id: '', is_active: true, expires_at: '' });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('system_announcements').delete().eq('id', id);
    loadData();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('system_announcements').update({ is_active: !current }).eq('id', id);
    loadData();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Oznámení</h1>
          <p className="text-gray-500 text-sm">Systémová oznámení pro organizace</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          Nové oznámení
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Žádná oznámení</p>
          <p className="text-gray-600 text-sm mt-1">Vytvořte první oznámení pro organizace</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const cfg = typeConfig[item.announcement_type as keyof typeof typeConfig] ?? typeConfig.info;
            const Icon = cfg.icon;
            const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
            return (
              <div key={item.id} className={`bg-gray-900 border rounded-xl p-4 ${!item.is_active || isExpired ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-white">{item.title}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {item.is_active && !isExpired ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">Aktivní</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">Neaktivní</span>
                      )}
                    </div>
                    {item.body && <p className="text-sm text-gray-400 mb-2">{item.body}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        {item.target_org_id ? (
                          <><Building2 className="w-3 h-3" /> {item.target_org_name ?? 'Konkrétní org.'}</>
                        ) : (
                          <><Globe className="w-3 h-3" /> Všechny organizace</>
                        )}
                      </span>
                      {item.expires_at && (
                        <span>Vyprší: {new Date(item.expires_at).toLocaleDateString('cs-CZ')}</span>
                      )}
                      <span>Vytvořeno: {new Date(item.created_at).toLocaleDateString('cs-CZ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(item.id, item.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${item.is_active ? 'border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400' : 'border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/20'}`}
                    >
                      {item.is_active ? 'Deaktivovat' : 'Aktivovat'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-600 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-gray-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="font-semibold text-white">Nové oznámení</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Titulek *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Název oznámení"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Obsah</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={3}
                  placeholder="Text oznámení..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Typ</label>
                  <select
                    value={form.announcement_type}
                    onChange={e => setForm(f => ({ ...f, announcement_type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="info">Informace</option>
                    <option value="warning">Varování</option>
                    <option value="maintenance">Údržba</option>
                    <option value="feature">Novinka</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Cíl</label>
                  <select
                    value={form.target_org_id}
                    onChange={e => setForm(f => ({ ...f, target_org_id: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Všechny organizace</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Vypršení (volitelné)</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition">
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Ukládám...' : 'Vytvořit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
