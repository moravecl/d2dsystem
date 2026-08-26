import { useEffect, useState } from 'react';
import { Paperclip, Download, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sanitizeHtml } from '../../lib/sanitize';

export interface IncomingEmail {
  id: string;
  account_id: string | null;
  message_id: string;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails: string[];
  subject: string;
  body_html: string;
  body_text: string;
  received_at: string;
  is_read: boolean;
  project_id: string | null;
  client_id: string | null;
  assignment_status: 'auto' | 'manual' | 'unassigned';
  assignment_confidence: number | null;
  assignment_reason: string;
  assignment_engine: string;
  attachments: { name: string; path: string; size: number; content_type: string }[];
}

export function formatEmailDate(date: string): string {
  return new Date(date).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Čtecí panel příchozího e-mailu — sdílený mezi poštou (/posta)
 * a záložkou e-mailů na projektu. Tělo se renderuje sanitizované
 * na bílém „papíru", přílohy přes podepsané URL ze storage.
 */
export default function EmailDetail({ email }: { email: IncomingEmail }) {
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const urls: Record<string, string> = {};
      for (const att of email.attachments ?? []) {
        const { data } = await supabase.storage
          .from('email-attachments')
          .createSignedUrl(att.path, 3600);
        if (data?.signedUrl) urls[att.path] = data.signedUrl;
      }
      if (!cancelled) setAttachmentUrls(urls);
    };
    if ((email.attachments ?? []).length > 0) load();
    else setAttachmentUrls({});
    return () => { cancelled = true; };
  }, [email.id, email.attachments]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-white break-words">{email.subject || '(bez předmětu)'}</h3>
        <div className="mt-2 text-xs text-slate-400 space-y-1">
          <div>
            <span className="text-slate-500">Od:</span>{' '}
            <span className="font-semibold text-slate-300">
              {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
            </span>
          </div>
          {email.to_emails.length > 0 && (
            <div><span className="text-slate-500">Komu:</span> {email.to_emails.join(', ')}</div>
          )}
          {email.cc_emails.length > 0 && (
            <div><span className="text-slate-500">Kopie:</span> {email.cc_emails.join(', ')}</div>
          )}
          <div><span className="text-slate-500">Přijato:</span> {formatEmailDate(email.received_at)}</div>
        </div>
      </div>

      {email.assignment_reason && email.assignment_status !== 'manual' && (
        <div className="flex items-start gap-2 p-2.5 bg-white/[0.04] rounded-xl border border-white/[0.08]">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span className="text-xs text-slate-400">
            {email.assignment_reason}
            {email.assignment_confidence !== null && email.assignment_status === 'auto'
              ? ` (jistota ${Math.round(email.assignment_confidence * 100)} %)`
              : ''}
          </span>
        </div>
      )}

      {(email.attachments ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {email.attachments.map((att) => (
            <a
              key={att.path}
              href={attachmentUrls[att.path] ?? '#'}
              target="_blank"
              rel="noreferrer"
              download={att.name}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                attachmentUrls[att.path]
                  ? 'bg-white/[0.06] border-white/[0.10] text-slate-300 hover:bg-white/[0.10]'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-500 pointer-events-none'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="max-w-[180px] truncate">{att.name}</span>
              <span className="text-slate-500">{formatSize(att.size)}</span>
              <Download className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}

      <div className="bg-white text-slate-900 rounded-xl p-5 shadow-inner overflow-x-auto">
        {email.body_html ? (
          <div
            className="prose prose-sm max-w-none break-words"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }}
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans">{email.body_text || '(prázdná zpráva)'}</pre>
        )}
      </div>
    </div>
  );
}
