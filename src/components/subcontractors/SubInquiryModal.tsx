import { useEffect, useState } from 'react';
import { AlertTriangle, Send, Users, Paperclip, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import { logAudit } from '../../lib/auditLog';
import ProjectMiniGantt from '../execution/ProjectMiniGantt';
import { sendSubInquiryEmail } from '../../lib/transactionalEmail';
import {
  type Subcontractor, SUB_TRADE_LABELS, docValidity,
} from '../../types/subcontractors';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Bez jobId/projectId se v modalu vybírá projekt (vstup z modulu Subdodavatelé). */
  jobId?: string;
  projectId?: string;
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';

export default function SubInquiryModal({ open, onClose, onCreated, jobId, projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ jobId: string; projectId: string; name: string }[]>([]);
  const [selJobId, setSelJobId] = useState('');
  const [selProjectId, setSelProjectId] = useState('');
  const [expiredSubIds, setExpiredSubIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: '', scope: '', trade: '', mode: 'bid' as 'bid' | 'fixed_price',
    fixed_price: 0, people_needed: 1, reveal_client: false, place: '',
    date_from: '', date_to: '', response_deadline: '', note: '',
  });

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setFiles([]);
    setSelJobId(jobId || '');
    setSelProjectId(projectId || '');
    const load = async () => {
      const [subsRes, docsRes] = await Promise.all([
        supabase.from('subcontractors').select('*').eq('is_active', true).order('name'),
        supabase.from('subcontractor_documents').select('subcontractor_id, valid_until'),
      ]);
      setSubs((subsRes.data || []) as Subcontractor[]);
      const expired = new Set<string>();
      for (const d of (docsRes.data || []) as { subcontractor_id: string; valid_until: string | null }[]) {
        if (docValidity(d.valid_until) === 'expired') expired.add(d.subcontractor_id);
      }
      setExpiredSubIds(expired);
      if (!jobId) {
        // vstup z modulu Subdodavatele: nabidnout projekty se zahajenou realizaci
        const { data: jobsData } = await supabase.from('jobs')
          .select('id, project_id, projects(id, project_name)')
          .order('created_at', { ascending: false });
        const seen = new Set<string>();
        const opts: { jobId: string; projectId: string; name: string }[] = [];
        for (const j of (jobsData || []) as { id: string; project_id: string; projects?: { project_name?: string } }[]) {
          if (!j.project_id || seen.has(j.project_id)) continue;
          seen.add(j.project_id);
          opts.push({ jobId: j.id, projectId: j.project_id, name: j.projects?.project_name || 'Projekt' });
        }
        setProjectOptions(opts);
      }
    };
    load();
  }, [open, jobId, projectId]);

  // prefill nazvu a lokality podle zvoleneho projektu
  useEffect(() => {
    if (!open || !selProjectId) return;
    supabase.from('projects').select('project_name, address').eq('id', selProjectId).maybeSingle()
      .then(({ data }) => {
        const proj = data as { project_name?: string; address?: string } | null;
        const place = (proj?.address || '').split(',').pop()?.trim().replace(/^\d+\s*/, '') || '';
        setForm(p => ({
          ...p,
          title: p.title || `Subdodávka — ${proj?.project_name || 'zakázka'}`,
          place: p.place || place,
        }));
      });
  }, [open, selProjectId]);

  const toggleSub = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredSubs = form.trade ? subs.filter(s => (s.trades || []).includes(form.trade)) : subs;

  const handleSend = async () => {
    if (!selJobId || !selProjectId) { toast('Vyberte projekt', 'error'); return; }
    if (!form.title.trim()) { toast('Zadejte název poptávky', 'error'); return; }
    if (selectedIds.size === 0) { toast('Vyberte alespoň jednoho subdodavatele', 'error'); return; }
    if (form.mode === 'fixed_price' && form.fixed_price <= 0) { toast('Zadejte pevnou cenu', 'error'); return; }
    setSending(true);
    try {
      const { data: inquiry, error } = await supabase.from('sub_inquiries').insert({
        job_id: selJobId,
        project_id: selProjectId,
        title: form.title.trim(),
        scope: form.scope,
        trade: form.trade,
        mode: form.mode,
        fixed_price: form.mode === 'fixed_price' ? form.fixed_price : 0,
        people_needed: Math.max(1, form.people_needed),
        reveal_client: form.reveal_client,
        place: form.place,
        date_from: form.date_from || null,
        date_to: form.date_to || null,
        response_deadline: form.response_deadline || null,
        status: 'sent',
        note: form.note,
        created_by: user!.id,
      }).select('id, organization_id').maybeSingle();
      if (error || !inquiry) { toast('Chyba při vytváření poptávky', 'error'); return; }

      const recipients = Array.from(selectedIds).map(subId => ({
        inquiry_id: inquiry.id,
        subcontractor_id: subId,
      }));
      const { error: recError } = await supabase.from('sub_inquiry_recipients').insert(recipients);
      if (recError) { toast('Chyba při přidávání příjemců', 'error'); return; }

      await logAudit('sub_inquiry', inquiry.id, 'created', { title: form.title, recipients: recipients.length });

      // prilohy poptavky (vykresy, vykaz vymer...) - uvidi vsichni osloveni
      for (const file of files) {
        const path = `subinq/${inquiry.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('uploads').upload(path, file);
        if (upErr) { toast(`Soubor ${file.name} se nepodařilo nahrát`, 'error'); continue; }
        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
        await supabase.from('sub_inquiry_files').insert({
          inquiry_id: inquiry.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          uploaded_by: user!.id,
        });
      }

      // portalova pozvanka: zajistit subcontractor_users zaznam pro e-mail
      // subky, aby se ji ucet po registraci privazal automaticky
      const invited = subs.filter(s => selectedIds.has(s.id) && s.email);
      if (invited.length > 0) {
        const { data: existing } = await supabase.from('subcontractor_users')
          .select('subcontractor_id, email')
          .in('subcontractor_id', invited.map(s => s.id));
        const have = new Set((existing || []).map(r => `${r.subcontractor_id}:${(r.email || '').toLowerCase()}`));
        const missing = invited
          .filter(s => !have.has(`${s.id}:${s.email.toLowerCase()}`))
          .map(s => ({ subcontractor_id: s.id, email: s.email, created_by: user!.id }));
        if (missing.length > 0) {
          await supabase.from('subcontractor_users').insert(missing);
        }
      }

      // e-maily best-effort — poptávka je v portálu i bez nich
      try {
        const { data: org } = await supabase.from('organizations').select('name').eq('id', inquiry.organization_id).maybeSingle();
        await sendSubInquiryEmail({
          organizationId: inquiry.organization_id,
          organizationName: org?.name || '',
          recipients: subs.filter(s => selectedIds.has(s.id)).map(s => ({ email: s.email, name: s.name })),
          title: form.title,
          place: form.place,
          dateFrom: form.date_from || null,
          dateTo: form.date_to || null,
          deadline: form.response_deadline || null,
        });
      } catch { /* e-mail není kritický */ }

      toast(`Poptávka odeslána ${selectedIds.size} subdodavatelům`);
      onCreated();
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Poptat subdodavatele"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Odesílám…' : `Odeslat poptávku (${selectedIds.size})`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!jobId && (
          <div>
            <label className={labelCls}>Projekt *</label>
            <select
              value={selProjectId}
              onChange={e => {
                const opt = projectOptions.find(o => o.projectId === e.target.value);
                setSelProjectId(e.target.value);
                setSelJobId(opt?.jobId || '');
              }}
              className={inputCls}
            >
              <option value="">-- Vyberte projekt --</option>
              {projectOptions.map(o => <option key={o.projectId} value={o.projectId}>{o.name}</option>)}
            </select>
            {projectOptions.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">Žádný projekt nemá zahájenou realizaci — poptávka se váže na zakázku (Realizace).</p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Název poptávky *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Řemeslo</label>
            <select value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))} className={inputCls}>
              <option value="">-- Vše --</option>
              {Object.entries(SUB_TRADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Rozsah prací (uvidí subdodavatel)</label>
          <textarea rows={3} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} placeholder="Popište co nejpřesněji, co poptáváte…" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Přílohy (výkresy, výkaz výměr…)</label>
          <div className="flex flex-wrap items-center gap-2">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1.5">
                <Paperclip className="w-3 h-3 text-blue-400" />
                <span className="max-w-40 truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, x) => x !== i))} className="text-slate-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer transition">
              <Paperclip className="w-3 h-3" /> Přidat soubor
              <input type="file" multiple className="hidden" onChange={e => {
                const list = Array.from(e.target.files || []);
                if (list.length) setFiles(prev => [...prev, ...list]);
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>

        {selProjectId && (
          <ProjectMiniGantt
            projectId={selProjectId}
            onPickRange={(from, to) => setForm(p => ({ ...p, date_from: from, date_to: to }))}
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Zahájení</label>
            <input type="date" value={form.date_from} onChange={e => setForm(p => ({ ...p, date_from: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dokončení</label>
            <input type="date" value={form.date_to} onChange={e => setForm(p => ({ ...p, date_to: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Odpovědět do</label>
            <input type="date" value={form.response_deadline} onChange={e => setForm(p => ({ ...p, response_deadline: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-2">
            {([['bid', 'Nabídková cena'], ['fixed_price', 'Pevná cena']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm(p => ({ ...p, mode: k }))}
                className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                  form.mode === k ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-white/[0.08] text-slate-400 hover:border-white/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {form.mode === 'fixed_price' ? (
            <div>
              <label className={labelCls}>Pevná cena (Kč bez DPH) *</label>
              <input type="number" min={0} value={form.fixed_price} onChange={e => setForm(p => ({ ...p, fixed_price: parseFloat(e.target.value) || 0 }))} className={inputCls} />
            </div>
          ) : (
            <div>
              <label className={labelCls}>Hledaný počet lidí / firem</label>
              <input type="number" min={1} value={form.people_needed} onChange={e => setForm(p => ({ ...p, people_needed: parseInt(e.target.value) || 1 }))} className={inputCls} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Lokalita (uvidí subdodavatel)</label>
            <input value={form.place} onChange={e => setForm(p => ({ ...p, place: e.target.value }))} placeholder="Např. Liberec" className={inputCls} />
          </div>
          <label className="flex items-center gap-2.5 pt-5 cursor-pointer select-none">
            <input type="checkbox" checked={form.reveal_client} onChange={e => setForm(p => ({ ...p, reveal_client: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
            <span className="text-xs font-semibold text-slate-300">Odkrýt klienta a přesnou adresu už v poptávce</span>
          </label>
        </div>
        {!form.reveal_client && (
          <p className="text-[11px] text-slate-500 -mt-2">Subdodavatel uvidí jen lokalitu; klient a adresa se odkryjí po potvrzení a smlouvě.</p>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelCls} mb-0`}>Komu poslat {form.trade ? `(řemeslo: ${SUB_TRADE_LABELS[form.trade]})` : ''}</label>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set(filteredSubs.filter(s => s.email).map(s => s.id)))}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300"
            >
              Vybrat všechny s e-mailem
            </button>
          </div>
          {filteredSubs.length === 0 ? (
            <p className="text-xs text-amber-400">Žádní aktivní subdodavatelé pro zvolené řemeslo.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {filteredSubs.map(s => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    selectedIds.has(s.id) ? 'border-blue-500 bg-blue-500/10' : 'border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSub(s.id)} className="w-4 h-4 accent-blue-600 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-200 truncate">{s.name}</span>
                    <span className="block text-[10px] text-slate-500 truncate">
                      {(s.trades || []).map(t => SUB_TRADE_LABELS[t] || t).join(', ') || '—'}
                      {!s.email && ' · bez e-mailu'}
                    </span>
                  </span>
                  {expiredSubIds.has(s.id) && <span title="Neplatné dokumenty"><AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" /></span>}
                </label>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
            <Users className="w-3 h-3" /> Subdodavatelům bez portálového účtu přijde e-mail s odkazem na registraci — poptávka se jim přiřadí automaticky podle e-mailu.
          </p>
        </div>
      </div>
    </Modal>
  );
}
