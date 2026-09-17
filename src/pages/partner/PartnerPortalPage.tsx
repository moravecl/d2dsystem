import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat, LogOut, Loader2, MapPin, CalendarDays, Clock, FileSignature,
  CheckCircle2, XCircle, Send, ArrowLeft, Paperclip, X, Wrench, Package, Upload,
  Inbox, ChevronRight, GanttChart, MessageSquare,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from '../../lib/supabase';
import ProjectMiniGantt from '../../components/execution/ProjectMiniGantt';
import SubJobChat from '../../components/subcontractors/SubJobChat';
import {
  type Subcontractor, type SubInquiryRecipient, type JobSubcontractor,
  SUB_TRADE_LABELS, SUB_RECIPIENT_STATUS_LABELS, JOB_SUB_STATUS_LABELS,
} from '../../types/subcontractors';

const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('cs-CZ') : '';
}

function PortalShell({ name, onLogout, children }: { name: string; onLogout: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col deep-bg">
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <HardHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">Partnerský portál</div>
                <div className="text-[10px] font-medium text-slate-400 leading-tight">{name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 items-center justify-center text-xs font-bold text-white shadow-md">
                {(name || '?').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Odhlásit se"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 animate-fade-in">{children}</main>
      <footer className="border-t border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">HouseSmart &copy; {new Date().getFullYear()}</span>
          <span className="text-[11px] text-slate-500 font-medium">Partnerský portál</span>
        </div>
      </footer>
    </div>
  );
}

export default function PartnerPortalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Subcontractor | null>(null);
  const [tab, setTab] = useState<'inquiries' | 'jobs'>('inquiries');
  const [recipients, setRecipients] = useState<SubInquiryRecipient[]>([]);
  const [jobs, setJobs] = useState<JobSubcontractor[]>([]);
  const [detail, setDetail] = useState<SubInquiryRecipient | null>(null);
  const [contractJob, setContractJob] = useState<JobSubcontractor | null>(null);
  const [jobDetail, setJobDetail] = useState<JobSubcontractor | null>(null);
  const [jobWork, setJobWork] = useState<{ id: string; started_at: string | null; duration_minutes: number; note: string; approval_status: string }[]>([]);
  const [jobMaterials, setJobMaterials] = useState<{ id: string; material_name: string; unit: string; actual_qty: number; approval_status: string }[]>([]);
  const [jobFiles, setJobFiles] = useState<{ id: string; file_name: string; file_url: string; by_sub: boolean; uploaded_by: string | null }[]>([]);
  const [workForm, setWorkForm] = useState({ date: new Date().toISOString().split('T')[0], from: '07:00', to: '15:30', note: '' });
  const [matForm, setMatForm] = useState({ name: '', qty: '', unit: 'ks', note: '' });
  const [matOptions, setMatOptions] = useState<{ name: string; unit: string; trade?: string }[]>([]);
  const [jobTab, setJobTab] = useState('work');
  const [sharedFolders, setSharedFolders] = useState<{ id: string; name: string }[]>([]);
  const [sharedFiles, setSharedFiles] = useState<{ id: string; folder_id: string | null; name: string; file_url: string }[]>([]);
  const [contractHtml, setContractHtml] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerPeople, setOfferPeople] = useState('');
  const [inqFiles, setInqFiles] = useState<{ id: string; recipient_id: string | null; file_name: string; file_url: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { navigate('/partner/login'); return; }
    await supabase.rpc('link_subcontractor_user');
    const { data: mapping } = await supabase.from('subcontractor_users')
      .select('subcontractor_id').eq('user_id', session.session.user.id).limit(1).maybeSingle();
    if (!mapping) { navigate('/partner/login'); return; }

    const [meRes, recRes, jobsRes] = await Promise.all([
      supabase.from('subcontractors').select('*').eq('id', mapping.subcontractor_id).maybeSingle(),
      supabase.from('sub_inquiry_recipients').select('*, sub_inquiries(*)').order('created_at', { ascending: false }),
      supabase.from('job_subcontractors').select('*').order('created_at', { ascending: false }),
    ]);
    setMe(meRes.data as Subcontractor | null);
    setRecipients((recRes.data || []) as SubInquiryRecipient[]);
    setJobs((jobsRes.data || []) as JobSubcontractor[]);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadInqFiles = async (inquiryId: string) => {
    const { data } = await supabase.from('sub_inquiry_files')
      .select('id, recipient_id, file_name, file_url')
      .eq('inquiry_id', inquiryId)
      .order('created_at');
    setInqFiles((data || []) as { id: string; recipient_id: string | null; file_name: string; file_url: string }[]);
  };

  const openDetail = async (rec: SubInquiryRecipient) => {
    setDetail(rec);
    setError('');
    setOfferPrice('');
    setOfferNote('');
    setOfferPeople('');
    setInqFiles([]);
    loadInqFiles(rec.inquiry_id);
    if (rec.status === 'sent') {
      await supabase.rpc('respond_sub_inquiry', { p_recipient: rec.id, p_action: 'viewed' });
    }
  };

  const uploadResponseFile = async (file: File) => {
    if (!detail) return;
    setUploadingFile(true);
    try {
      const path = `subresp/${detail.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file);
      if (upErr) { setError('Soubor se nepodařilo nahrát.'); return; }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      const { data: session } = await supabase.auth.getSession();
      const { error: insErr } = await supabase.from('sub_inquiry_files').insert({
        inquiry_id: detail.inquiry_id,
        recipient_id: detail.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        uploaded_by: session.session?.user.id,
      });
      if (insErr) { setError('Přílohu se nepodařilo uložit.'); return; }
      loadInqFiles(detail.inquiry_id);
    } finally {
      setUploadingFile(false);
    }
  };

  const removeResponseFile = async (fileId: string) => {
    await supabase.from('sub_inquiry_files').delete().eq('id', fileId);
    if (detail) loadInqFiles(detail.inquiry_id);
  };

  const loadJobDetail = async (job: JobSubcontractor) => {
    const projectId = (job as JobSubcontractor & { project_id?: string | null }).project_id;
    const [workRes, matRes, filesRes, foldersRes, pfilesRes, matListRes] = await Promise.all([
      supabase.from('job_worklogs')
        .select('id, started_at, ended_at, duration_minutes, note, approval_status')
        .eq('job_id', job.job_id)
        .order('started_at', { ascending: false }),
      supabase.from('job_material_entries')
        .select('id, material_name, unit, actual_qty, approval_status')
        .eq('job_id', job.job_id)
        .order('created_at', { ascending: false }),
      supabase.from('sub_job_files')
        .select('id, file_name, file_url, by_sub, uploaded_by')
        .eq('job_subcontractor_id', job.id)
        .order('created_at', { ascending: false }),
      projectId
        ? supabase.from('project_folders').select('id, name').eq('project_id', projectId).order('name')
        : Promise.resolve({ data: [] }),
      projectId
        ? supabase.from('project_files').select('id, folder_id, name, file_url').eq('project_id', projectId).order('name')
        : Promise.resolve({ data: [] }),
      supabase.rpc('sub_list_materials', { p_job_sub: job.id }),
    ]);
    setJobWork((workRes.data || []) as typeof jobWork);
    setJobMaterials((matRes.data || []) as typeof jobMaterials);
    setJobFiles((filesRes.data || []) as typeof jobFiles);
    setSharedFolders((foldersRes.data || []) as { id: string; name: string }[]);
    setSharedFiles((pfilesRes.data || []) as { id: string; folder_id: string | null; name: string; file_url: string }[]);
    setMatOptions((matListRes.data || []) as { name: string; unit: string; trade?: string }[]);
  };

  const openJobDetail = (job: JobSubcontractor) => {
    setJobDetail(job);
    setError('');
    setWorkForm({ date: new Date().toISOString().split('T')[0], from: '07:00', to: '15:30', note: '' });
    setMatForm({ name: '', qty: '', unit: 'ks', note: '' });
    setJobTab('work');
    loadJobDetail(job);
  };

  const submitWork = async () => {
    if (!jobDetail) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('sub_log_work', {
      p_job_sub: jobDetail.id,
      p_date: workForm.date,
      p_from: workForm.from,
      p_to: workForm.to,
      p_note: workForm.note,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setWorkForm({ date: new Date().toISOString().split('T')[0], from: workForm.from, to: workForm.to, note: '' });
    loadJobDetail(jobDetail);
  };

  const submitMaterial = async () => {
    if (!jobDetail) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('sub_log_material', {
      p_job_sub: jobDetail.id,
      p_name: matForm.name,
      p_qty: parseFloat(matForm.qty) || 0,
      p_unit: matForm.unit,
      p_note: matForm.note,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setMatForm({ name: '', qty: '', unit: 'ks', note: '' });
    loadJobDetail(jobDetail);
  };

  const uploadJobFile = async (file: File) => {
    if (!jobDetail) return;
    setUploadingFile(true);
    try {
      const path = `subjob/${jobDetail.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file);
      if (upErr) { setError('Soubor se nepodařilo nahrát.'); return; }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      const { data: session } = await supabase.auth.getSession();
      const { error: insErr } = await supabase.from('sub_job_files').insert({
        job_subcontractor_id: jobDetail.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        by_sub: true,
        uploaded_by: session.session?.user.id,
      });
      if (insErr) { setError('Soubor se nepodařilo uložit.'); return; }
      loadJobDetail(jobDetail);
    } finally {
      setUploadingFile(false);
    }
  };

  const removeJobFile = async (fileId: string) => {
    await supabase.from('sub_job_files').delete().eq('id', fileId);
    if (jobDetail) loadJobDetail(jobDetail);
  };

  const respond = async (action: 'accept' | 'offer' | 'decline') => {
    if (!detail) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('respond_sub_inquiry', {
      p_recipient: detail.id,
      p_action: action,
      p_price: action === 'offer' ? parseFloat(offerPrice) || 0 : null,
      p_note: offerNote,
      p_people: offerPeople ? parseInt(offerPeople) : null,
    });
    setBusy(false);
    if (err) { setError(err.message.replace(/^.*Exception:\s*/, '')); return; }
    setDetail(null);
    loadData();
  };

  const openContract = async (job: JobSubcontractor) => {
    if (!job.contract_document_id) return;
    setContractJob(job);
    setContractHtml('');
    const { data } = await supabase.from('project_documents')
      .select('rendered_html').eq('id', job.contract_document_id).maybeSingle();
    setContractHtml((data as { rendered_html?: string } | null)?.rendered_html || '');
  };

  const confirmContract = async () => {
    if (!contractJob) return;
    setBusy(true);
    const { error: err } = await supabase.rpc('confirm_sub_contract', {
      p_job_sub: contractJob.id,
      p_user_agent: navigator.userAgent.slice(0, 250),
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setContractJob(null);
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/partner/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen deep-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Načítání...</span>
        </div>
      </div>
    );
  }

  const openInquiries = recipients.filter(r => r.sub_inquiries?.status === 'sent');
  const pastInquiries = recipients.filter(r => r.sub_inquiries?.status !== 'sent');

  // -------------------------------------------------- detail zakázky (výkazy + soubory)
  if (jobDetail) {
    const APPROVAL: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Čeká na schválení', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
      approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      rejected: { label: 'Zamítnuto', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    };
    const jmeta = JOB_SUB_STATUS_LABELS[jobDetail.status];
    const closed = jobDetail.status === 'cancelled' || jobDetail.status === 'completed';
    const jdProjectId = (jobDetail as JobSubcontractor & { project_id?: string | null }).project_id;
    return (
      <PortalShell name={me?.name || ''} onLogout={handleLogout}>
        <div className="space-y-4">
          <button onClick={() => { setJobDetail(null); loadData(); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Zpět na zakázky
          </button>

          <div className="glass-card p-5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold text-white">{jobDetail.scope || SUB_TRADE_LABELS[jobDetail.trade] || 'Zakázka'}</h1>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${jmeta.cls}`}>{jmeta.label}</span>
            </div>
            <div className="text-xs text-slate-400">
              {jobDetail.agreed_price > 0 && `${jobDetail.agreed_price.toLocaleString('cs-CZ')} Kč`}
              {jobDetail.date_from ? ` · od ${fmtDate(jobDetail.date_from)}` : ''}
              {jobDetail.date_to ? ` do ${fmtDate(jobDetail.date_to)}` : ''}
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/[0.06] px-2 py-2">
              <nav className="flex gap-1 overflow-x-auto">
                {([
                  ['work', 'Výkaz práce', Wrench],
                  ['material', 'Materiál', Package],
                  ['files', 'Soubory', Paperclip],
                  ['chat', 'Komunikace', MessageSquare],
                  ['gantt', 'Harmonogram', GanttChart],
                ] as const).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    onClick={() => setJobTab(k)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      jobTab === k
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="p-5">

          {jobTab === 'work' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" /> Vykázat práci
            </h2>
            {!closed && (
              <div className="grid grid-cols-2 sm:grid-cols-[130px_95px_95px_1fr_auto] gap-2">
                <input type="date" value={workForm.date} onChange={e => setWorkForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                <input type="time" value={workForm.from} onChange={e => setWorkForm(f => ({ ...f, from: e.target.value }))} title="Od" className={inputCls} />
                <input type="time" value={workForm.to} onChange={e => setWorkForm(f => ({ ...f, to: e.target.value }))} title="Do" className={inputCls} />
                <input value={workForm.note} onChange={e => setWorkForm(f => ({ ...f, note: e.target.value }))} placeholder="Co se dělalo…" className={`${inputCls} col-span-2 sm:col-span-1`} />
                <button onClick={submitWork} disabled={busy} className="px-4 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 col-span-2 sm:col-span-1">Vykázat</button>
              </div>
            )}
            {jobWork.length > 0 && (
              <div className="space-y-1.5">
                {jobWork.map(w => {
                  const am = APPROVAL[w.approval_status] || APPROVAL.pending;
                  return (
                    <div key={w.id} className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                      <span className="font-bold text-white">{(w.duration_minutes / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h</span>
                      <span className="text-slate-500">
                        {w.started_at ? `${fmtDate(w.started_at)} ${new Date(w.started_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        {(w as typeof w & { ended_at?: string | null }).ended_at ? `–${new Date((w as typeof w & { ended_at?: string | null }).ended_at!).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                      <span className="text-slate-400 truncate flex-1">{w.note}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0 ${am.cls}`}>{am.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {jobTab === 'material' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" /> Vykázat materiál
            </h2>
            {!closed && (
              <div className="space-y-2">
                <div className="border border-white/[0.08] rounded-xl overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
                    {matOptions.length === 0 && (
                      <p className="text-xs text-slate-500 px-3 py-3">Organizace zatím nemá seznam materiálů.</p>
                    )}
                    {matOptions.map((o, i) => {
                      const tradeLabel = ({ electric: 'Elektro', water: 'Voda', heating: 'Topení', recuperation: 'Rekuperace' } as Record<string, string>)[o.trade || ''] || 'Materiál';
                      const showHeader = i === 0 || (matOptions[i - 1].trade || '') !== (o.trade || '');
                      const selected = matForm.name === o.name;
                      return (
                        <div key={`${o.trade}-${o.name}`}>
                          {showHeader && (
                            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-white/[0.04]">{tradeLabel}</div>
                          )}
                          <button
                            type="button"
                            onClick={() => setMatForm(f => ({ ...f, name: selected ? '' : o.name, unit: o.unit || 'ks' }))}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition ${
                              selected ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-200 hover:bg-white/[0.05]'
                            }`}
                          >
                            <span className="truncate flex items-center gap-2">
                              {selected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                              {o.name}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0">{o.unit}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {matForm.name && (
                  <div className="grid grid-cols-[1fr_90px_70px_auto] gap-2 items-center bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                    <span className="text-sm font-semibold text-white truncate">{matForm.name}</span>
                    <input type="number" min={0} value={matForm.qty} onChange={e => setMatForm(f => ({ ...f, qty: e.target.value }))} placeholder="Množ." className={inputCls} />
                    <span className="text-sm text-slate-400 text-center">{matForm.unit}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={submitMaterial} disabled={busy} className="px-4 py-2 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50">Vykázat</button>
                      <button onClick={() => setMatForm(f => ({ ...f, name: '', qty: '' }))} className="p-2 text-slate-500 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {jobMaterials.length > 0 && (
              <div className="space-y-1.5">
                {jobMaterials.map(m => {
                  const am = APPROVAL[m.approval_status] || APPROVAL.pending;
                  return (
                    <div key={m.id} className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                      <span className="font-bold text-white truncate flex-1">{m.material_name}</span>
                      <span className="text-slate-400 shrink-0">{m.actual_qty} {m.unit}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0 ${am.cls}`}>{am.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {jobTab === 'files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-amber-400" /> Soubory zakázky
              </h2>
              {!closed && (
                <label className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer transition ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="w-3 h-3" /> {uploadingFile ? 'Nahrávám…' : 'Nahrát soubor'}
                  <input type="file" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadJobFile(f);
                    e.target.value = '';
                  }} />
                </label>
              )}
            </div>
            {sharedFolders.length > 0 && (
              <div className="space-y-2 mb-3">
                {sharedFolders.map(folder => {
                  const filesIn = sharedFiles.filter(f => f.folder_id === folder.id);
                  return (
                    <div key={folder.id}>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{folder.name}</div>
                      {filesIn.length === 0 && (
                        <p className="text-[11px] text-slate-600 px-1">Složka je zatím prázdná.</p>
                      )}
                      <div className="space-y-1">
                        {filesIn.map(f => (
                          <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 hover:border-blue-400/40 transition">
                            <Paperclip className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold text-slate-200 truncate">{f.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {jobFiles.length > 0 && (
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Vaše soubory</div>
            )}
            {jobFiles.length === 0 && sharedFolders.length === 0 ? (
              <p className="text-xs text-slate-500">Zatím žádné soubory. Objednatel sem sdílí podklady, vy můžete nahrát fotky nebo revizní zprávy.</p>
            ) : jobFiles.length === 0 ? null : (
              <div className="space-y-1.5">
                {jobFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                    <Paperclip className={`w-3.5 h-3.5 shrink-0 ${f.by_sub ? 'text-amber-400' : 'text-blue-400'}`} />
                    <a href={f.file_url} target="_blank" rel="noreferrer" className="font-semibold text-slate-200 hover:text-blue-300 truncate flex-1">{f.file_name}</a>
                    <span className="text-[10px] text-slate-500 shrink-0">{f.by_sub ? 'nahráli jste' : 'od objednatele'}</span>
                    {f.by_sub && !closed && (
                      <button onClick={() => removeJobFile(f.id)} className="p-0.5 rounded text-slate-500 hover:text-red-400 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {jobTab === 'chat' && (
            <SubJobChat jobSubId={jobDetail.id} viewer="sub" />
          )}

          {jobTab === 'gantt' && (
            jdProjectId
              ? <ProjectMiniGantt projectId={jdProjectId} />
              : <p className="text-xs text-slate-500">Harmonogram není k dispozici.</p>
          )}

            </div>
          </div>
        </div>
      </PortalShell>
    );
  }

  // -------------------------------------------------- detail smlouvy
  if (contractJob) {
    return (
      <PortalShell name={me?.name || ''} onLogout={handleLogout}>
        <div className="space-y-4 max-w-3xl mx-auto">
          <button onClick={() => setContractJob(null)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Zpět
          </button>
          <div className="bg-white rounded-xl p-8 text-slate-900 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contractHtml || '<p>Načítám smlouvu…</p>') }}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          {contractJob.status !== 'contract_signed' ? (
            <button
              onClick={confirmContract}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
              Závazně potvrzuji smlouvu o dílo
            </button>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-400 py-3">
              <CheckCircle2 className="w-4 h-4" /> Smlouva byla potvrzena
            </p>
          )}
        </div>
      </PortalShell>
    );
  }

  // -------------------------------------------------- detail poptávky
  if (detail) {
    const inq = detail.sub_inquiries;
    if (!inq) { setDetail(null); return null; }
    const rmeta = SUB_RECIPIENT_STATUS_LABELS[detail.status];
    const deadlinePassed = inq.response_deadline ? new Date(inq.response_deadline) < new Date(new Date().toDateString()) : false;
    const canRespond = !deadlinePassed && !['accepted', 'offered', 'declined'].includes(detail.status);
    return (
      <PortalShell name={me?.name || ''} onLogout={handleLogout}>
        <div className="space-y-4">
          <button onClick={() => { setDetail(null); loadData(); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Zpět na poptávky
          </button>

          <div className="glass-card p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-extrabold text-white">{inq.title}</h1>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${rmeta.cls}`}>{rmeta.label}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                {inq.trade && <span>{SUB_TRADE_LABELS[inq.trade] || inq.trade}</span>}
                {inq.place && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {inq.place}</span>}
                {(inq.date_from || inq.date_to) && (
                  <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {[fmtDate(inq.date_from), fmtDate(inq.date_to)].filter(Boolean).join(' – ')}</span>
                )}
                {inq.response_deadline && (
                  <span className={`inline-flex items-center gap-1 ${deadlinePassed ? 'text-red-400' : 'text-amber-400'}`}>
                    <Clock className="w-3 h-3" /> Odpovědět do {fmtDate(inq.response_deadline)}
                  </span>
                )}
              </div>
            </div>

            {inq.scope && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Rozsah prací</div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{inq.scope}</p>
              </div>
            )}

            {inqFiles.filter(f => !f.recipient_id).length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Podklady od objednatele</div>
                <div className="flex flex-wrap gap-2">
                  {inqFiles.filter(f => !f.recipient_id).map(f => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg px-3 py-2 transition">
                      <Paperclip className="w-3.5 h-3.5" /> {f.file_name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {inq.project_id && <ProjectMiniGantt projectId={inq.project_id} />}

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
              {inq.mode === 'fixed_price' ? (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nabízená cena</div>
                    <div className="text-2xl font-extrabold text-white">{inq.fixed_price.toLocaleString('cs-CZ')} Kč <span className="text-xs font-semibold text-slate-500">bez DPH</span></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Vaše cenová nabídka {inq.people_needed > 1 ? `(hledáme ${inq.people_needed} lidí/firem)` : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" min={0} value={offerPrice} onChange={e => setOfferPrice(e.target.value)} placeholder="Cena v Kč bez DPH" className={inputCls} disabled={!canRespond} />
                    {inq.people_needed > 1 && (
                      <input type="number" min={1} value={offerPeople} onChange={e => setOfferPeople(e.target.value)} placeholder="Počet lidí" className={inputCls} disabled={!canRespond} />
                    )}
                  </div>
                </div>
              )}
              <textarea rows={4} value={offerNote} onChange={e => setOfferNote(e.target.value)} placeholder="Zpráva pro objednatele — podmínky, termíny, co je / není v ceně… (volitelné)" className={`${inputCls} mt-3`} disabled={!canRespond} />

              <div className="mt-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Přílohy nabídky (např. nabídka v PDF)</div>
                <div className="flex flex-wrap items-center gap-2">
                  {inqFiles.filter(f => f.recipient_id === detail.id).map(f => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                      <Paperclip className="w-3 h-3" />
                      <a href={f.file_url} target="_blank" rel="noreferrer" className="max-w-40 truncate hover:underline">{f.file_name}</a>
                      {canRespond && (
                        <button type="button" onClick={() => removeResponseFile(f.id)} className="text-slate-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {canRespond && (
                    <label className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer transition ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Paperclip className="w-3 h-3" /> {uploadingFile ? 'Nahrávám…' : 'Přiložit soubor'}
                      <input type="file" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) uploadResponseFile(f);
                        e.target.value = '';
                      }} />
                    </label>
                  )}
                </div>
              </div>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              {canRespond ? (
                <div className="flex items-center gap-2 mt-3">
                  {inq.mode === 'fixed_price' ? (
                    <button onClick={() => respond('accept')} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4" /> Přijmout za {inq.fixed_price.toLocaleString('cs-CZ')} Kč
                    </button>
                  ) : (
                    <button onClick={() => respond('offer')} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition disabled:opacity-50">
                      <Send className="w-4 h-4" /> Odeslat nabídku
                    </button>
                  )}
                  <button onClick={() => respond('decline')} disabled={busy} className="flex items-center gap-1.5 px-4 py-2.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 font-bold rounded-xl transition disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Odmítnout
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-3">
                  {deadlinePassed && !['accepted', 'offered', 'declined'].includes(detail.status)
                    ? 'Termín pro odpověď vypršel.'
                    : 'Na tuto poptávku jste již odpověděli. O výsledku vás budeme informovat.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </PortalShell>
    );
  }

  // -------------------------------------------------- přehled
  return (
    <PortalShell name={me?.name || ''} onLogout={handleLogout}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Vítejte, {me?.name}</h1>
          <p className="text-xs text-slate-400 mt-1">Poptávky, zakázky a komunikace s objednatelem na jednom místě.</p>
        </div>

        <div className="glass-card px-2 py-2">
          <nav className="flex gap-1 overflow-x-auto">
            {([
              ['inquiries', `Poptávky (${openInquiries.length})`, Inbox],
              ['jobs', `Moje zakázky (${jobs.length})`, HardHat],
            ] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  tab === k
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'inquiries' && (
          <div className="space-y-2">
            {openInquiries.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-10">Žádné otevřené poptávky.</p>
            )}
            {openInquiries.map(rec => {
              const inq = rec.sub_inquiries!;
              const rmeta = SUB_RECIPIENT_STATUS_LABELS[rec.status];
              return (
                <button
                  key={rec.id}
                  onClick={() => openDetail(rec)}
                  className="w-full text-left glass-card hover:border-blue-400/40 px-4 py-3 transition"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white">{inq.title}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${rmeta.cls}`}>{rmeta.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                    {inq.place && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {inq.place}</span>}
                    {(inq.date_from || inq.date_to) && <span>{[fmtDate(inq.date_from), fmtDate(inq.date_to)].filter(Boolean).join(' – ')}</span>}
                    <span>{inq.mode === 'fixed_price' ? `Pevná cena ${inq.fixed_price.toLocaleString('cs-CZ')} Kč` : 'Cenová nabídka'}</span>
                    {inq.response_deadline && <span className="text-amber-400">do {fmtDate(inq.response_deadline)}</span>}
                  </div>
                </button>
              );
            })}
            {pastInquiries.length > 0 && (
              <>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 pt-4">Historie</div>
                {pastInquiries.map(rec => (
                  <div key={rec.id} className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-2.5 opacity-70">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-400">{rec.sub_inquiries?.title}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${SUB_RECIPIENT_STATUS_LABELS[rec.status].cls}`}>
                        {SUB_RECIPIENT_STATUS_LABELS[rec.status].label}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'jobs' && (
          <div className="space-y-2">
            {jobs.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-10">Zatím žádné zadané zakázky.</p>
            )}
            {jobs.map(job => {
              const meta = JOB_SUB_STATUS_LABELS[job.status];
              return (
                <div
                  key={job.id}
                  onClick={() => openJobDetail(job)}
                  className="glass-card hover:border-blue-400/40 px-4 py-3.5 flex flex-wrap items-center gap-3 cursor-pointer transition group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-white group-hover:text-blue-300 transition-colors">{job.scope || (SUB_TRADE_LABELS[job.trade] || 'Zakázka')}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {job.agreed_price > 0 && `${job.agreed_price.toLocaleString('cs-CZ')} Kč`}
                      {job.date_from ? ` · od ${fmtDate(job.date_from)}` : ''}
                      {job.date_to ? ` do ${fmtDate(job.date_to)}` : ''}
                    </div>
                  </div>
                  {job.contract_document_id && (
                    <button
                      onClick={e => { e.stopPropagation(); openContract(job); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition ${
                        job.status === 'contract_signed'
                          ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                          : 'text-white bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      {job.status === 'contract_signed' ? 'Smlouva' : 'Smlouva k potvrzení'}
                    </button>
                  )}
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-extrabold text-blue-300 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-lg transition">
                    Otevřít <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
