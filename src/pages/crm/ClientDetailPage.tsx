import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Phone, Mail, MapPin, FileText, Globe, Eye, EyeOff, Copy, Check, Loader2, KeyRound } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import Tabs from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/auditLog';
import CrmActivitiesTab from '../../components/crm/CrmActivitiesTab';
import ClientMeetingsSection from '../../components/crm/ClientMeetingsSection';
import type { Client, ClientContact, ClientAddress, ClientNote, Profile } from '../../types/database';

const clientTabs = [
  { key: 'overview', label: 'Přehled' },
  { key: 'contacts', label: 'Kontakty' },
  { key: 'addresses', label: 'Adresy' },
  { key: 'projects', label: 'Projekty' },
  { key: 'meetings', label: 'Schůzky' },
  { key: 'activities', label: 'Aktivity' },
  { key: 'documents', label: 'Dokumenty' },
  { key: 'notes', label: 'Poznámky' },
];

interface ProjectRow {
  id: string;
  project_name: string;
  status: string;
  address: string;
  created_at: string;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');

  const [projectForm, setProjectForm] = useState({
    project_name: '',
    address: '',
    status: 'lead',
    responsible_user_id: '',
    deadline: '',
  });

  const [contactForm, setContactForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    is_primary: false,
  });

  const [addressForm, setAddressForm] = useState({
    address_type: 'billing' as 'billing' | 'delivery' | 'realization',
    street: '',
    city: '',
    zip: '',
    label: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    client_type: 'rd' as 'rd' | 'firma' | 'obec',
    city: '',
    ico: '',
    dic: '',
  });

  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalName, setPortalName] = useState('');
  const [portalShowPw, setPortalShowPw] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalCreated, setPortalCreated] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);
  const [hasPortalAccess, setHasPortalAccess] = useState(false);
  const [portalUserEmail, setPortalUserEmail] = useState('');
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPortalPassword, setNewPortalPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [clientRes, contactsRes, addressesRes, notesRes, projectsRes, profilesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).maybeSingle(),
      supabase.from('client_contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }),
      supabase.from('client_addresses').select('*').eq('client_id', id),
      supabase.from('client_notes').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('projects').select('id, project_name, status, address, created_at').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    if (clientRes.data) setClient(clientRes.data as Client);
    setContacts((contactsRes.data || []) as ClientContact[]);
    setAddresses((addressesRes.data || []) as ClientAddress[]);
    setNotes((notesRes.data || []) as ClientNote[]);
    setProjects((projectsRes.data || []) as ProjectRow[]);
    setProfiles((profilesRes.data || []) as Profile[]);

    const { data: portalUsers } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('client_id', id)
      .limit(1);
    const hasAccess = (portalUsers || []).length > 0;
    setHasPortalAccess(hasAccess);
    if (hasAccess && portalUsers && portalUsers[0]) {
      setPortalUserEmail(portalUsers[0].email);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'CRM', href: '/crm' },
        { label: 'Klienti', href: '/crm' },
        { label: client?.name || '...' },
      ],
      primaryAction: {
        label: 'Nový projekt',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowProjectModal(true),
      },
      menuActions: [
        {
          label: 'Upravit klienta',
          onClick: () => {
            if (client) {
              setEditForm({
                name: client.name,
                email: client.email,
                phone: client.phone,
                client_type: client.client_type,
                city: client.city,
                ico: client.ico,
                dic: client.dic,
              });
              setShowEditModal(true);
            }
          },
        },
        {
          label: 'Deaktivovat',
          onClick: async () => {
            if (!id) return;
            await supabase.from('clients').update({ is_active: false }).eq('id', id);
            toast('Klient deaktivován');
            navigate('/crm');
          },
        },
      ],
    });
  }, [setConfig, client, id, navigate, toast]);

  const handleCreateProject = async () => {
    if (!projectForm.project_name || !user || !id) {
      toast('Vyplňte název projektu', 'error');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: projectForm.project_name,
        project_name: projectForm.project_name,
        client_name: client?.name || '',
        client_id: id,
        status: projectForm.status,
        address: projectForm.address,
        responsible_user_id: projectForm.responsible_user_id || null,
        deadline: projectForm.deadline || null,
      })
      .select()
      .maybeSingle();
    setSaving(false);

    if (error) {
      toast('Chyba při vytváření projektu', 'error');
      return;
    }
    if (data) {
      await logAudit('project', data.id, 'created', { name: projectForm.project_name, client_id: id });
      toast('Projekt vytvořen');
      setShowProjectModal(false);
      setProjectForm({ project_name: '', address: '', status: 'lead', responsible_user_id: '', deadline: '' });
      navigate(`/projekty/${data.id}`);
    }
  };

  const handleCreateContact = async () => {
    if (!contactForm.name || !id) {
      toast('Vyplňte jméno kontaktu', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('client_contacts').insert({ client_id: id, ...contactForm });
    setSaving(false);
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    toast('Kontakt přidán');
    setShowContactModal(false);
    setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false });
    loadAll();
  };

  const handleCreateAddress = async () => {
    if (!addressForm.street || !id) {
      toast('Vyplňte ulici', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('client_addresses').insert({ client_id: id, ...addressForm });
    setSaving(false);
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    toast('Adresa přidána');
    setShowAddressModal(false);
    setAddressForm({ address_type: 'billing', street: '', city: '', zip: '', label: '' });
    loadAll();
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !id || !user) return;
    const { error } = await supabase.from('client_notes').insert({
      client_id: id,
      content: noteText.trim(),
      created_by: user.id,
    });
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    toast('Poznámka uložena');
    setNoteText('');
    loadAll();
  };

  const handleCreatePortalUser = async () => {
    if (!portalEmail || !portalPassword || !id) {
      toast('Vyplňte email a heslo', 'error');
      return;
    }
    setPortalSaving(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-user`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast('Nejste přihlášeni', 'error');
        setPortalSaving(false);
        return;
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: portalEmail,
          password: portalPassword,
          displayName: portalName || portalEmail,
          clientId: id,
        }),
      });

      let result: { error?: string; success?: boolean };
      try {
        result = await res.json();
      } catch {
        toast(`Server vrátil chybu (${res.status})`, 'error');
        setPortalSaving(false);
        return;
      }

      if (!res.ok || result.error) {
        toast(result.error || `Chyba serveru (${res.status})`, 'error');
        setPortalSaving(false);
        return;
      }

      await logAudit('client', id, 'portal_access_created', { email: portalEmail });
      toast('Portál přístup vytvořen');
      setPortalCreated(true);
      setHasPortalAccess(true);
    } catch (err) {
      toast('Chyba připojení k serveru', 'error');
    }
    setPortalSaving(false);
  };

  const handleCopyCredentials = () => {
    const text = `Portal: ${window.location.origin}/portal/login\nEmail: ${portalEmail}\nHeslo: ${portalPassword}`;
    navigator.clipboard.writeText(text);
    setPortalCopied(true);
    setTimeout(() => setPortalCopied(false), 2000);
  };

  const handleChangePortalPassword = async () => {
    if (!id || !newPortalPassword.trim()) return;
    if (newPortalPassword.length < 6) {
      toast('Heslo musí mít alespoň 6 znaků', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Nejste přihlášeni', 'error');
        setChangingPassword(false);
        return;
      }
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-change-password`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId: id, newPassword: newPortalPassword }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('Portal password change failed:', result);
        toast(result.error || 'Chyba při změně hesla', 'error');
      } else {
        toast('Heslo portálu bylo změněno');
        setShowPasswordChangeModal(false);
        setNewPortalPassword('');
      }
    } catch (err) {
      console.error('Portal password change error:', err);
      toast('Chyba při změně hesla', 'error');
    }
    setChangingPassword(false);
  };

  const handleUpdateClient = async () => {
    if (!editForm.name || !id) return;
    setSaving(true);
    const { error } = await supabase.from('clients').update({
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      client_type: editForm.client_type,
      city: editForm.city,
      ico: editForm.ico,
      dic: editForm.dic,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setSaving(false);
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    toast('Klient upraven');
    setShowEditModal(false);
    loadAll();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-white/[0.08] rounded animate-pulse" />
        <div className="h-64 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
      </div>
    );
  }

  if (!client) {
    return <div className="text-center py-12 text-slate-400">Klient nenalezen</div>;
  }

  const addressTypeLabels: Record<string, string> = { billing: 'Fakturační', delivery: 'Doručovací', realization: 'Realizační' };

  return (
    <div className="space-y-4">
      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold shrink-0">
            {client.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">{client.name}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              {client.email && (
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{client.email}</span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{client.phone}</span>
              )}
              {client.city && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{client.city}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08]">
        <Tabs tabs={clientTabs} active={activeTab} onChange={setActiveTab} />

        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Základní údaje</h3>
                <dl className="space-y-3">
                  {[
                    ['Typ', client.client_type === 'rd' ? 'Rodinný dům' : client.client_type === 'firma' ? 'Firma' : 'Obec'],
                    ['Email', client.email],
                    ['Telefon', client.phone],
                    ['Město', client.city],
                    ['IČO', client.ico],
                    ['DIČ', client.dic],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-sm text-slate-500">{label}</dt>
                      <dd className="text-sm font-medium text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    Klientský portál
                  </h3>
                  {hasPortalAccess ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-200">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">Přístup aktivní</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Přístupové údaje</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">URL:</span>
                            <span className="font-mono text-white">{window.location.origin}/portál/login</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Email:</span>
                            <span className="font-mono text-white">{portalUserEmail}</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => {
                                const text = `Portal: ${window.location.origin}/portal/login\nEmail: ${portalUserEmail}`;
                                navigator.clipboard.writeText(text);
                                toast('Údaje zkopírovány');
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-400 border border-blue-200 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Kopírovat údaje
                            </button>
                            <button
                              onClick={() => {
                                setNewPortalPassword('');
                                setShowPasswordChangeModal(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 border border-amber-200 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Změnit heslo
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPortalEmail(client.email || '');
                        setPortalName(client.name || '');
                        setPortalPassword('');
                        setPortalCreated(false);
                        setShowPortalModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-400 border border-blue-200 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      Vytvořit portál přístup
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Projekty ({projects.length})</h3>
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-400">Žádné projekty</p>
                ) : (
                  <div className="space-y-2">
                    {projects.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/projekty/${p.id}`)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-white/10 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-white">{p.project_name}</span>
                        <StatusBadge status={p.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowContactModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/100/10 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Přidat kontakt
                </button>
              </div>
              {contacts.length === 0 ? (
                <p className="text-center py-8 text-sm text-slate-400">Žádné kontakty</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contacts.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-white">{c.name}</span>
                        {c.is_primary && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">Primární</span>
                        )}
                      </div>
                      {c.role && <div className="text-xs text-slate-500">{c.role}</div>}
                      <div className="flex flex-col gap-1 text-sm text-slate-400">
                        {c.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{c.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/100/10 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Přidat adresu
                </button>
              </div>
              {addresses.length === 0 ? (
                <p className="text-center py-8 text-sm text-slate-400">Žádné adresy</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {addresses.map((a) => (
                    <div key={a.id} className="p-4 rounded-xl border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase">{addressTypeLabels[a.address_type] || a.address_type}</span>
                        {a.label && <span className="text-xs text-slate-400">{a.label}</span>}
                      </div>
                      <div className="text-sm text-white">
                        <div>{a.street}</div>
                        <div>{a.zip} {a.city}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowProjectModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/100/10 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Nový projekt
                </button>
              </div>
              {projects.length === 0 ? (
                <p className="text-center py-8 text-sm text-slate-400">Žádné projekty</p>
              ) : (
                <div className="space-y-2">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projekty/${p.id}`)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{p.project_name}</div>
                        {p.address && <div className="text-xs text-slate-400 mt-0.5">{p.address}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('cs-CZ')}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'meetings' && id && (
            <ClientMeetingsSection clientId={id} />
          )}

          {activeTab === 'activities' && id && (
            <CrmActivitiesTab clientId={id} />
          )}

          {activeTab === 'documents' && (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Správa dokumentů bude brzy k dispozici</p>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Přidat poznámku..."
                  className="flex-1 px-4 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                />
                <button
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Přidat
                </button>
              </div>
              {notes.length === 0 ? (
                <p className="text-center py-8 text-sm text-slate-400">Žádné poznámky</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="p-4 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">
                          {new Date(n.created_at).toLocaleString('cs-CZ')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        title="Nový projekt"
        footer={
          <>
            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors">
              Zrušit
            </button>
            <button onClick={handleCreateProject} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Vytvářím...' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Název projektu *</label>
            <input
              type="text"
              value={projectForm.project_name}
              onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Novak RD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Adresa realizace</label>
            <input
              type="text"
              value={projectForm.address}
              onChange={(e) => setProjectForm({ ...projectForm, address: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Stav</label>
            <select
              value={projectForm.status}
              onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/[0.06]"
            >
              <option value="lead">Lead / Poptávka</option>
              <option value="design">Návrh</option>
              <option value="quote">Nabídka</option>
              <option value="in_progress">Realizace</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Odpovědná osoba</label>
            <select
              value={projectForm.responsible_user_id}
              onChange={(e) => setProjectForm({ ...projectForm, responsible_user_id: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/[0.06]"
            >
              <option value="">-- Vyberte --</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Termín</label>
            <input
              type="date"
              value={projectForm.deadline}
              onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Přidat kontakt"
        footer={
          <>
            <button onClick={() => setShowContactModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors">Zrušit</button>
            <button onClick={handleCreateContact} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">Uložit</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Jméno *</label>
            <input type="text" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
            <input type="text" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Investor, Architekt..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefon</label>
              <input type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={contactForm.is_primary} onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500" />
            <span className="text-sm text-slate-300">Primární kontakt</span>
          </label>
        </div>
      </Modal>

      <Modal
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Přidat adresu"
        footer={
          <>
            <button onClick={() => setShowAddressModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors">Zrušit</button>
            <button onClick={handleCreateAddress} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">Uložit</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Typ adresy</label>
            <select value={addressForm.address_type} onChange={(e) => setAddressForm({ ...addressForm, address_type: e.target.value as 'billing' | 'delivery' | 'realization' })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/[0.06]">
              <option value="billing">Fakturační</option>
              <option value="delivery">Doručovací</option>
              <option value="realization">Realizační</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Ulice *</label>
            <input type="text" value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Město</label>
              <input type="text" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">PSČ</label>
              <input type="text" value={addressForm.zip} onChange={(e) => setAddressForm({ ...addressForm, zip: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Poznámka</label>
            <input type="text" value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Sklad, Kancelář..." />
          </div>
        </div>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Upravit klienta"
        footer={
          <>
            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors">Zrušit</button>
            <button onClick={handleUpdateClient} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">Uložit</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Název / Jméno *</label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefon</label>
              <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Město</label>
            <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">IČO</label>
              <input type="text" value={editForm.ico} onChange={(e) => setEditForm({ ...editForm, ico: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">DIČ</label>
              <input type="text" value={editForm.dic} onChange={(e) => setEditForm({ ...editForm, dic: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showPortalModal}
        onClose={() => { if (!portalSaving) setShowPortalModal(false); }}
        title="Vytvořit portál přístup"
        size="sm"
        footer={portalCreated ? (
          <>
            <button
              onClick={handleCopyCredentials}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/100/10 rounded-lg transition-colors"
            >
              {portalCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {portalCopied ? 'Zkopírováno' : 'Kopírovat údaje'}
            </button>
            <button
              onClick={() => setShowPortalModal(false)}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Hotovo
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setShowPortalModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors">
              Zrušit
            </button>
            <button
              onClick={handleCreatePortalUser}
              disabled={portalSaving || !portalEmail || !portalPassword}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {portalSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Vytvořit
            </button>
          </>
        )}
      >
        {portalCreated ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-200">
              <p className="text-sm font-medium text-emerald-800 mb-3">Portál přístup vytvořen. Předejte klientovi tyto údaje:</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-emerald-400">Portál URL</dt>
                  <dd className="font-mono font-medium text-emerald-900">{window.location.origin}/portál/login</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-emerald-400">Email</dt>
                  <dd className="font-mono font-medium text-emerald-900">{portalEmail}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-emerald-400">Heslo</dt>
                  <dd className="font-mono font-medium text-emerald-900">{portalPassword}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Jméno klienta</label>
              <input
                type="text"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
              <input
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="klient@email.cz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Heslo *</label>
              <div className="relative">
                <input
                  type={portalShowPw ? 'text' : 'password'}
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min. 6 znaků"
                />
                <button
                  type="button"
                  onClick={() => setPortalShowPw(!portalShowPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-400"
                >
                  {portalShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Klient se přihlásí na {window.location.origin}/portál/login s těmito údaji.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={showPasswordChangeModal}
        onClose={() => { if (!changingPassword) setShowPasswordChangeModal(false); }}
        title="Změnit heslo portálu"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowPasswordChangeModal(false)}
              disabled={changingPassword}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              onClick={handleChangePortalPassword}
              disabled={changingPassword || newPortalPassword.length < 6}
              className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              {changingPassword ? 'Měním...' : 'Změnit heslo'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-200">
            <p className="text-xs text-amber-800">
              Klient se po změně bude muset přihlásit novým heslem.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nové heslo *</label>
            <input
              type="password"
              autoFocus
              value={newPortalPassword}
              onChange={(e) => setNewPortalPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleChangePortalPassword(); }}
              className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Min. 6 znaků..."
            />
            <p className="text-xs text-slate-400 mt-1">Heslo musí mít alespoň 6 znaků</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
