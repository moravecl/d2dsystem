import { useState, useEffect } from 'react';
import { FileText, MapPin, CircleUser as UserCircle, Calendar, Clock, TrendingUp, Hash, Navigation, Phone, Mail, ExternalLink, Pencil, Check, X, UserPlus } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import DesignPreviewSection from './DesignPreviewSection';

interface ProjectData {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  status: string;
  address: string;
  address_lat?: number | null;
  address_lon?: number | null;
  description: string;
  deadline: string | null;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
}

interface ClientContact {
  phone: string;
  email: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  project: ProjectData;
  auditEntries: AuditEntry[];
  getProfileName: (userId: string | null) => string;
  onClientChange?: (clientId: string | null, clientName: string) => void;
  onNavigate?: (tab: string) => void;
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    created: 'Projekt vytvořen',
    updated: 'Projekt aktualizován',
    portal_access_created: 'Portál přístup vytvořen',
    deleted: 'Projekt smazán',
  };
  return map[action] || action;
}

function openNavigation(address: string, lat?: number | null, lon?: number | null) {
  if (lat && lon) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, '_blank');
  } else if (address) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  }
}

interface MetricCardProps {
  label: string;
  value?: string;
  custom?: React.ReactNode;
  accent?: 'red' | 'amber';
}

function MetricCard({ label, value, custom, accent }: MetricCardProps) {
  const accentClass = accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-white';
  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl p-4 border border-white/[0.08] text-center">
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</div>
      {custom ? custom : <div className={`text-lg font-bold ${accentClass}`}>{value ?? '-'}</div>}
    </div>
  );
}

export default function ProjectOverviewTab({ project, auditEntries, getProfileName, onClientChange, onNavigate }: Props) {
  const [clientContact, setClientContact] = useState<ClientContact | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(project.client_id ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project.client_id) {
      setClientContact(null);
      return;
    }
    supabase
      .from('clients')
      .select('name, phone, email')
      .eq('id', project.client_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setClientContact(data as ClientContact);
        else setClientContact(null);
      });
  }, [project.client_id]);

  const openClientEdit = async () => {
    if (clients.length === 0) {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setClients((data || []) as ClientOption[]);
    }
    setSelectedClientId(project.client_id ?? '');
    setEditingClient(true);
  };

  const handleSaveClient = async () => {
    setSaving(true);
    const chosen = clients.find(c => c.id === selectedClientId);
    const newClientId = selectedClientId || null;
    const newClientName = chosen?.name ?? '';

    const { error } = await supabase
      .from('projects')
      .update({ client_id: newClientId, client_name: newClientName })
      .eq('id', project.id);

    if (!error) {
      onClientChange?.(newClientId, newClientName);
    }
    setSaving(false);
    setEditingClient(false);
  };

  const daysActive = Math.ceil((Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilDeadline = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const infoItems = [
    { icon: Hash, label: 'Název', value: project.project_name },
    { icon: Calendar, label: 'Termín', value: project.deadline ? new Date(project.deadline).toLocaleDateString('cs-CZ') : '-' },
    { icon: TrendingUp, label: 'Odpovědná osoba', value: getProfileName(project.responsible_user_id) || '-' },
    { icon: Clock, label: 'Vytvořeno', value: new Date(project.created_at).toLocaleDateString('cs-CZ') },
  ];

  const hasClient = !!(clientContact || project.client_name);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Stav" custom={<StatusBadge status={project.status} />} />
        <MetricCard label="Dní aktivní" value={`${daysActive}`} />
        <MetricCard
          label="Do termínu"
          value={daysUntilDeadline !== null ? `${daysUntilDeadline}d` : '-'}
          accent={
            daysUntilDeadline !== null && daysUntilDeadline < 0
              ? 'red'
              : daysUntilDeadline !== null && daysUntilDeadline <= 7
              ? 'amber'
              : undefined
          }
        />
        <MetricCard label="Poslední aktivita" value={
          auditEntries.length > 0
            ? new Date(auditEntries[0].created_at).toLocaleDateString('cs-CZ')
            : '-'
        } />
      </div>

      {onNavigate && (
        <DesignPreviewSection
          projectId={project.id}
          onNavigate={onNavigate}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/[0.08]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Základní informace</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{item.label}</div>
                    <div className="text-sm font-medium text-white mt-0.5 truncate">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {project.address && (
            <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/[0.08]">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                Adresa stavby
              </h3>
              <button
                onClick={() => openNavigation(project.address, project.address_lat, project.address_lon)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/50 hover:bg-blue-500/10 transition-all group cursor-pointer text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <Navigation className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{project.address}</div>
                  {project.address_lat && project.address_lon && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      GPS: {project.address_lat.toFixed(5)}, {project.address_lon.toFixed(5)}
                    </div>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>
            </div>
          )}

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/[0.08]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCircle className="w-3.5 h-3.5" />
              Klient
              {!editingClient && (
                <button
                  onClick={openClientEdit}
                  className="ml-auto p-1 rounded-lg hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition"
                  title="Změnit klienta"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </h3>

            {editingClient ? (
              <div className="space-y-3">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm bg-navy-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                >
                  <option value="">-- Bez klienta --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveClient}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {saving ? 'Ukládám...' : 'Uložit'}
                  </button>
                  <button
                    onClick={() => setEditingClient(false)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-slate-400 hover:text-white rounded-lg text-sm font-semibold transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    Zrušit
                  </button>
                </div>
              </div>
            ) : hasClient ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0">
                    <UserCircle className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {clientContact?.name || project.client_name || '-'}
                  </div>
                </div>

                {clientContact?.phone && (
                  <a
                    href={`tel:${clientContact.phone}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                      <Phone className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Telefon</div>
                      <div className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">{clientContact.phone}</div>
                    </div>
                  </a>
                )}

                {clientContact?.email && (
                  <a
                    href={`mailto:${clientContact.email}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/40 hover:bg-blue-500/10 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                      <Mail className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Email</div>
                      <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors truncate">{clientContact.email}</div>
                    </div>
                  </a>
                )}

                {clientContact && !clientContact.phone && !clientContact.email && (
                  <div className="text-xs text-slate-500 px-3 py-2">Klient nemá vyplněné kontaktní údaje</div>
                )}
              </div>
            ) : (
              <button
                onClick={openClientEdit}
                className="w-full flex items-center gap-2 px-4 py-3 border border-dashed border-white/10 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:border-white/20 transition"
              >
                <UserPlus className="w-4 h-4" />
                Přiřadit klienta
              </button>
            )}
          </div>

          {project.description && (
            <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/[0.08]">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Popis projektu
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/[0.08] sticky top-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Aktivita
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditEntries.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Zatím žádná aktivita</p>
              ) : (
                auditEntries.map((entry) => (
                  <div key={entry.id} className="flex gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-300">{getActionLabel(entry.action)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {entry.user_id && ` · ${getProfileName(entry.user_id)}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
