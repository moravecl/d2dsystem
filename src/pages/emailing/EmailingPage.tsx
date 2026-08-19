import { useEffect, useState, useCallback } from 'react';
import {
  Mail, Send, Search, Filter, RefreshCw, CheckCircle, XCircle, Clock,
  Eye, Users, ArrowUpRight, Inbox,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useHeader } from '../../contexts/HeaderContext';
import Modal from '../../components/ui/Modal';
import RecipientAutocomplete from '../../components/ui/RecipientAutocomplete';
import EmailComposer from './EmailComposer';

interface EmailLogEntry {
  id: string;
  smtp_account_id: string;
  template_id: string | null;
  sender_user_id: string;
  project_id: string | null;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_html: string;
  body_text: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  is_bulk: boolean;
  bulk_batch_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string;
  email: string;
}

interface ProjectRef {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  sent: { label: 'Odeslano', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-200', icon: CheckCircle },
  failed: { label: 'Selhalo', color: 'bg-red-500/10 text-red-400 border-red-200', icon: XCircle },
  queued: { label: 'Ve fronte', color: 'bg-amber-500/10 text-amber-400 border-amber-200', icon: Clock },
  bounced: { label: 'Vraceno', color: 'bg-orange-500/10 text-orange-700 border-orange-200', icon: XCircle },
};

export default function EmailingPage() {
  const { toast } = useToast();
  const { setConfig } = useHeader();

  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projectRefs, setProjectRefs] = useState<ProjectRef[]>([]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBulkRecipients, setComposerBulkRecipients] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState<string[]>([]);

  const [detailEntry, setDetailEntry] = useState<EmailLogEntry | null>(null);

  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [logsRes, profilesRes, projectsRes] = await Promise.all([
      supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, display_name, email'),
      supabase.from('projects').select('id, name'),
    ]);

    const logsData = logsRes.data || [];
    setLogs(logsData);
    setProfiles(profilesRes.data || []);
    setProjectRefs(projectsRes.data || []);

    setStats({
      total: logsData.length,
      sent: logsData.filter(l => l.status === 'sent').length,
      failed: logsData.filter(l => l.status === 'failed').length,
      queued: logsData.filter(l => l.status === 'queued').length,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Emailing' },
      ],
      primaryAction: {
        label: 'Novy email',
        icon: <Send className="w-4 h-4" />,
        onClick: handleOpenSingleComposer,
      },
      secondaryAction: {
        label: 'Hromadne odeslat',
        icon: <Users className="w-4 h-4" />,
        onClick: () => setBulkOpen(true),
      },
    });
  }, [setConfig]);

  const getProfileName = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8);
  };

  const getProjectName = (projectId: string) => {
    const p = projectRefs.find(pr => pr.id === projectId);
    return p?.name || projectId.slice(0, 8);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filtered = logs.filter(log => {
    if (search) {
      const q = search.toLowerCase();
      const matchSubject = log.subject.toLowerCase().includes(q);
      const matchTo = log.to_emails.some(e => e.toLowerCase().includes(q));
      const matchFrom = log.from_email.toLowerCase().includes(q);
      if (!matchSubject && !matchTo && !matchFrom) return false;
    }
    if (filterStatus && log.status !== filterStatus) return false;
    if (filterUser && log.sender_user_id !== filterUser) return false;
    if (filterProject && log.project_id !== filterProject) return false;
    return true;
  });

  const uniqueSenders = [...new Set(logs.map(l => l.sender_user_id))];
  const uniqueProjects = [...new Set(logs.filter(l => l.project_id).map(l => l.project_id!))];

  const handleBulkSend = () => {
    if (bulkEmails.length === 0) {
      toast('Zadejte alespon jednu emailovou adresu', 'error');
      return;
    }
    setComposerBulkRecipients(bulkEmails);
    setBulkOpen(false);
    setBulkEmails([]);
    setComposerOpen(true);
  };

  const handleOpenSingleComposer = () => {
    setComposerBulkRecipients([]);
    setComposerOpen(true);
  };

  const statCards = [
    { label: 'Celkem', value: stats.total, icon: Mail, color: 'bg-white/[0.04] text-slate-300' },
    { label: 'Odeslano', value: stats.sent, icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Selhalo', value: stats.failed, icon: XCircle, color: 'bg-red-500/10 text-red-400' },
    { label: 'Ve fronte', value: stats.queued, icon: Clock, color: 'bg-amber-500/10 text-amber-400' },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] animate-pulse" />)}
        </div>
        <div className="h-96 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div data-tour="email-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-4 hover: transition">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center`}>
                <card.icon className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">{card.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat dle predmetu, prijemce, odesilatele..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl transition ${
            showFilters || filterStatus || filterUser || filterProject
              ? 'bg-blue-500/10 text-blue-400 border-blue-200'
              : 'bg-white/[0.06] text-slate-400 border-white/10 hover:bg-white/[0.04]'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtry
          {(filterStatus || filterUser || filterProject) && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              {[filterStatus, filterUser, filterProject].filter(Boolean).length}
            </span>
          )}
        </button>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 bg-navy-800/60 border border-white/[0.08] rounded-xl hover:bg-white/[0.04] transition"
        >
          <RefreshCw className="w-4 h-4" />
          Obnovit
        </button>
      </div>

      {showFilters && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Stav</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-white/10 rounded-xl bg-white/[0.06] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            >
              <option value="">Vsechny</option>
              <option value="sent">Odeslano</option>
              <option value="failed">Selhalo</option>
              <option value="queued">Ve fronte</option>
              <option value="bounced">Vraceno</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Odeslal</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-3 py-2 text-sm border border-white/10 rounded-xl bg-white/[0.06] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            >
              <option value="">Vsichni</option>
              {uniqueSenders.map(uid => (
                <option key={uid} value={uid}>{getProfileName(uid)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Projekt</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-3 py-2 text-sm border border-white/10 rounded-xl bg-white/[0.06] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            >
              <option value="">Vsechny</option>
              {uniqueProjects.map(pid => (
                <option key={pid} value={pid}>{getProjectName(pid)}</option>
              ))}
            </select>
          </div>
          {(filterStatus || filterUser || filterProject) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterUser(''); setFilterProject(''); }}
              className="px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/100/10 rounded-xl transition"
            >
              Resetovat filtry
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Zatim zadne emaily</p>
          <p className="text-xs text-slate-400 mt-1">Emaily odeslane ze systemu se zobrazi zde</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04]/80">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Stav</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Predmet</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Prijemci</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Odeslal</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Projekt</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Datum</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map((log) => {
                  const statusConf = STATUS_CONFIG[log.status] || STATUS_CONFIG.queued;
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.04]/50 transition group">
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusConf.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate max-w-[220px]">{log.subject}</span>
                          {log.is_bulk && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 border border-cyan-200 shrink-0">Bulk</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-slate-400 truncate max-w-[160px]">{log.to_emails[0]}</span>
                          {log.to_emails.length > 1 && (
                            <span className="text-[10px] font-bold text-slate-400">+{log.to_emails.length - 1}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-slate-400">{getProfileName(log.sender_user_id)}</span>
                      </td>
                      <td className="px-5 py-3">
                        {log.project_id ? (
                          <span className="text-sm text-blue-400 font-medium">{getProjectName(log.project_id)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-500">{formatDate(log.created_at)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setDetailEntry(log)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition opacity-0 group-hover:opacity-100"
                            title="Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.04]/50 text-xs text-slate-500">
            Zobrazeno {filtered.length} z {logs.length} zaznamu
          </div>
        </div>
      )}

      <EmailComposer
        open={composerOpen}
        onClose={() => { setComposerOpen(false); setComposerBulkRecipients([]); }}
        onSent={loadData}
        bulkMode={composerBulkRecipients.length > 1}
        bulkRecipients={composerBulkRecipients.length > 0 ? composerBulkRecipients : undefined}
      />

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Hromadny emailing"
        size="md"
        footer={
          <>
            <button onClick={() => setBulkOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.06] rounded-xl hover:bg-white/[0.08] transition">
              Zrusit
            </button>
            <button
              onClick={handleBulkSend}
              disabled={bulkEmails.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              <ArrowUpRight className="w-4 h-4" />
              Pokracovat ({bulkEmails.length})
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Vyhledejte klienty podle jmena nebo zadejte emailove adresy rucne.
          </p>
          <RecipientAutocomplete
            emails={bulkEmails}
            onChange={setBulkEmails}
            placeholder="Zadejte jmeno nebo email klienta..."
          />
        </div>
      </Modal>

      <Modal
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        title="Detail emailu"
        size="xl"
      >
        {detailEntry && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/[0.04] rounded-xl">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Stav</div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[detailEntry.status]?.color || ''}`}>
                  {STATUS_CONFIG[detailEntry.status]?.label || detailEntry.status}
                </span>
                {detailEntry.error_message && (
                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2 border border-red-200">{detailEntry.error_message}</div>
                )}
              </div>
              <div className="p-3 bg-white/[0.04] rounded-xl">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Datum</div>
                <div className="text-sm font-medium text-white">{formatDate(detailEntry.created_at)}</div>
                {detailEntry.sent_at && (
                  <div className="text-xs text-slate-500 mt-0.5">Odeslano: {formatDate(detailEntry.sent_at)}</div>
                )}
              </div>
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Od</div>
              <div className="text-sm text-white">{detailEntry.from_name} &lt;{detailEntry.from_email}&gt;</div>
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Komu</div>
              <div className="flex flex-wrap gap-1.5">
                {detailEntry.to_emails.map((e, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-navy-800/60 rounded-lg border border-white/10 text-slate-300">{e}</span>
                ))}
              </div>
              {detailEntry.cc_emails.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">CC</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailEntry.cc_emails.map((e, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-navy-800/60 rounded-lg border border-white/10 text-slate-300">{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Predmet</div>
              <div className="text-sm font-semibold text-white">{detailEntry.subject}</div>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden">
              <div className="bg-white/[0.04] px-4 py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-slate-500">Obsah emailu</span>
              </div>
              <div
                className="p-4 prose prose-sm max-w-none max-h-[40vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: detailEntry.body_html }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
