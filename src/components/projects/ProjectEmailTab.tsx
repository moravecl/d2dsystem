import { useEffect, useState, useCallback } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import {
  Mail, Send, CheckCircle, XCircle, Clock, Eye, Inbox, RefreshCw, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import EmailComposer from '../../pages/emailing/EmailComposer';

interface EmailLogEntry {
  id: string;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_html: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  is_bulk: boolean;
  created_at: string;
  sender_user_id: string;
}

interface Profile {
  id: string;
  display_name: string;
  email: string;
}

interface Props {
  projectId: string;
  clientId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  sent: { label: 'Odeslano', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  failed: { label: 'Selhalo', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  queued: { label: 'Ve fronte', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
};

export default function ProjectEmailTab({ projectId, clientId }: Props) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<EmailLogEntry | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [logsRes, profilesRes] = await Promise.all([
      supabase
        .from('email_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name, email'),
    ]);
    setLogs(logsRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!clientId) return;
    supabase
      .from('clients')
      .select('email')
      .eq('id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email) setClientEmail(data.email);
      });
  }, [clientId]);

  const getProfileName = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8);
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

  const prefillTo = clientEmail ? [clientEmail] : undefined;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Mail className="w-5 h-5 text-slate-400" />
          <h3 className="text-base font-bold text-white">E-maily projektu</h3>
          <span className="text-xs font-bold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full">{logs.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition"
            title="Obnovit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            <Send className="w-4 h-4" />
            Odeslat email
          </button>
        </div>
      </div>

      {clientEmail && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <Users className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm text-blue-400">
            Klient projektu: <span className="font-semibold">{clientEmail}</span> (bude predvypln jako prijemce)
          </span>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] rounded-2xl border border-white/[0.08]">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-400">Zatim zadne emaily</p>
          <p className="text-xs text-slate-400 mt-1">Emaily odeslane z tohoto projektu se zobrazi zde</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const statusConf = STATUS_CONFIG[log.status] || STATUS_CONFIG.queued;
            const StatusIcon = statusConf.icon;
            return (
              <div
                key={log.id}
                className="flex items-center gap-4 p-3.5 bg-white/[0.06] rounded-xl border border-white/[0.08] hover:border-white/[0.12] transition cursor-pointer group"
                onClick={() => setDetailEntry(log)}
              >
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${statusConf.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConf.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{log.subject}</span>
                    {log.is_bulk && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">Bulk</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    Komu: {log.to_emails.join(', ')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">{formatDate(log.created_at)}</div>
                  <div className="text-xs text-slate-400">{getProfileName(log.sender_user_id)}</div>
                </div>
                <Eye className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      <EmailComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSent={loadData}
        prefillTo={prefillTo}
        prefillProjectId={projectId}
      />

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
                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2 border border-red-500/20">{detailEntry.error_message}</div>
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
                  <span key={i} className="text-xs px-2 py-0.5 bg-white/[0.06] rounded-lg border border-white/[0.08] text-slate-300">{e}</span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Predmet</div>
              <div className="text-sm font-semibold text-white">{detailEntry.subject}</div>
            </div>

            <div className="border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="bg-white/[0.04] px-4 py-2 border-b border-white/[0.08]">
                <span className="text-xs font-semibold text-slate-500">Obsah emailu</span>
              </div>
              <div
                className="p-4 prose prose-sm max-w-none max-h-[40vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(detailEntry.body_html) }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
