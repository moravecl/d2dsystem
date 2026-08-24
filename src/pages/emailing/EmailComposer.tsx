import { useState, useEffect } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { Send, Code } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import RecipientAutocomplete from '../../components/ui/RecipientAutocomplete';
import { PLACEHOLDER_REGISTRY } from '../../lib/placeholderEngine';

interface SmtpAccount {
  id: string;
  name: string;
  from_email: string;
  from_name: string;
  is_default: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  category: string;
}

interface Project {
  id: string;
  name: string;
  project_name: string;
}

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  prefillTo?: string[];
  prefillProjectId?: string;
  bulkMode?: boolean;
  bulkRecipients?: string[];
}

export default function EmailComposer({ open, onClose, onSent, prefillTo, prefillProjectId, bulkMode, bulkRecipients }: EmailComposerProps) {
  const { toast } = useToast();
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sending, setSending] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [showHtmlSource, setShowHtmlSource] = useState(false);

  const [form, setForm] = useState({
    smtp_account_id: '',
    template_id: '',
    project_id: prefillProjectId || '',
    to_emails: prefillTo || (bulkRecipients || []),
    cc_emails: [] as string[],
    bcc_emails: [] as string[],
    subject: '',
    body_html: '',
    body_text: '',
  });

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [smtpRes, tplRes, projRes] = await Promise.all([
        supabase.from('smtp_accounts').select('id, name, from_email, from_name, is_default').eq('is_active', true).order('is_default', { ascending: false }),
        supabase.from('email_templates').select('id, name, subject, body_html, body_text, category').eq('is_active', true).order('name'),
        supabase.from('projects').select('id, name, project_name').order('name'),
      ]);
      setSmtpAccounts(smtpRes.data || []);
      setTemplates(tplRes.data || []);
      setProjects(projRes.data || []);

      const defaultSmtp = (smtpRes.data || []).find(s => s.is_default) || (smtpRes.data || [])[0];
      if (defaultSmtp) {
        setForm(f => ({ ...f, smtp_account_id: f.smtp_account_id || defaultSmtp.id }));
      }
    };
    load();
  }, [open]);

  useEffect(() => {
    if (prefillTo) setForm(f => ({ ...f, to_emails: prefillTo }));
    if (bulkRecipients) setForm(f => ({ ...f, to_emails: bulkRecipients }));
    if (prefillProjectId) setForm(f => ({ ...f, project_id: prefillProjectId }));
  }, [prefillTo, bulkRecipients, prefillProjectId]);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) {
      setForm(f => ({ ...f, template_id: '' }));
      return;
    }
    setForm(f => ({
      ...f,
      template_id: templateId,
      subject: tpl.subject,
      body_html: tpl.body_html,
      body_text: tpl.body_text,
    }));
  };

  const insertPlaceholder = (key: string) => {
    setForm(f => ({ ...f, body_html: f.body_html + `{{${key}}}` }));
  };

  const handleSend = async () => {
    if (!form.smtp_account_id) {
      toast('Vyberte SMTP ucet', 'error');
      return;
    }
    if (form.to_emails.length === 0) {
      toast('Zadejte alespon jednoho prijemce', 'error');
      return;
    }
    if (!form.subject) {
      toast('Vyplnte predmet', 'error');
      return;
    }

    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (bulkMode && form.to_emails.length > 1) {
      const batchId = crypto.randomUUID();
      let successCount = 0;
      let failCount = 0;

      for (const email of form.to_emails) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                smtp_account_id: form.smtp_account_id,
                template_id: form.template_id || undefined,
                to_emails: [email],
                subject: form.subject,
                body_html: form.body_html,
                body_text: form.body_text,
                project_id: form.project_id || undefined,
                is_bulk: true,
                bulk_batch_id: batchId,
              }),
            }
          );
          const result = await res.json();
          if (result.success) successCount++; else failCount++;
        } catch {
          failCount++;
        }
      }

      if (failCount === 0) {
        toast(`Hromadny emailing dokoncen: ${successCount} emailu odeslano`);
      } else {
        toast(`Odeslano ${successCount}, selhalo ${failCount}`, failCount > successCount ? 'error' : 'info');
      }
    } else {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              smtp_account_id: form.smtp_account_id,
              template_id: form.template_id || undefined,
              to_emails: form.to_emails,
              cc_emails: form.cc_emails.length ? form.cc_emails : undefined,
              bcc_emails: form.bcc_emails.length ? form.bcc_emails : undefined,
              subject: form.subject,
              body_html: form.body_html,
              body_text: form.body_text,
              project_id: form.project_id || undefined,
            }),
          }
        );
        const result = await res.json();
        if (result.success) {
          toast('Email uspesne odeslan');
        } else {
          toast(result.detail || result.error || 'Chyba pri odesilani', 'error');
        }
      } catch {
        toast('Chyba pri odesilani emailu', 'error');
      }
    }

    setSending(false);
    onSent();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bulkMode ? 'Hromadny emailing' : 'Novy email'}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.06] rounded-xl hover:bg-white/[0.08] transition">
            Zrusit
          </button>
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
            <Send className="w-4 h-4" />
            {sending ? 'Odesilam...' : bulkMode ? `Odeslat (${form.to_emails.length})` : 'Odeslat'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">SMTP ucet</label>
            <select
              value={form.smtp_account_id}
              onChange={(e) => setForm(f => ({ ...f, smtp_account_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none bg-white/[0.06] transition"
            >
              <option value="">Vyberte SMTP...</option>
              {smtpAccounts.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.from_email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Sablona (volitelne)</label>
            <select
              value={form.template_id}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none bg-white/[0.06] transition"
            >
              <option value="">Bez sablony</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            Prijemci ({form.to_emails.length})
          </label>
          <RecipientAutocomplete
            emails={form.to_emails}
            onChange={(to_emails) => setForm(f => ({ ...f, to_emails }))}
            placeholder="Zadejte jmeno nebo email klienta..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt (volitelne)</label>
          <select
            value={form.project_id}
            onChange={(e) => setForm(f => ({ ...f, project_id: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none bg-white/[0.06] transition"
          >
            <option value="">Bez projektu</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name || p.project_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Predmet</label>
          <input
            value={form.subject}
            onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Predmet emailu..."
            className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-400">
              {showHtmlSource ? 'HTML zdrojovy kod' : 'Telo emailu (HTML)'}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-400 transition"
              >
                <Code className="w-3.5 h-3.5" />
                Zastupne znaky
              </button>
              <button
                onClick={() => setShowHtmlSource(!showHtmlSource)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
              >
                {showHtmlSource ? 'Nahled' : 'Zdrojovy kod'}
              </button>
            </div>
          </div>

          {showPlaceholders && (
            <div className="mb-3 p-3 bg-white/[0.04] rounded-xl border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Kliknutim vlozite</div>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDER_REGISTRY.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => insertPlaceholder(p.key)}
                    className="text-[11px] font-mono px-2 py-1 rounded-lg bg-navy-800/60 border border-white/[0.08] text-slate-400 hover:bg-blue-500/100/10 hover:border-blue-300 hover:text-blue-400 transition"
                    title={p.description}
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showHtmlSource ? (
            <textarea
              value={form.body_html}
              onChange={(e) => setForm(f => ({ ...f, body_html: e.target.value }))}
              rows={10}
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition resize-y"
              placeholder="<h1>Dobry den,</h1>..."
            />
          ) : (
            <div className="space-y-2">
              <textarea
                value={form.body_html}
                onChange={(e) => setForm(f => ({ ...f, body_html: e.target.value }))}
                rows={10}
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition resize-y"
                placeholder="Obsah emailu... Muzete pouzit HTML tagy a zastupne znaky {{placeholder}}"
              />
              {form.body_html && (
                <details className="rounded-xl border border-white/10 overflow-hidden">
                  <summary className="px-4 py-2 bg-white/[0.04] text-xs font-semibold text-slate-500 cursor-pointer hover:bg-white/[0.06] transition">
                    Nahled HTML
                  </summary>
                  <div className="p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.body_html) }} />
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
