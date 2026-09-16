import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat, LogOut, Loader2, MapPin, CalendarDays, Clock, FileSignature,
  CheckCircle2, XCircle, Send, ArrowLeft,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from '../../lib/supabase';
import ProjectMiniGantt from '../../components/execution/ProjectMiniGantt';
import {
  type Subcontractor, type SubInquiryRecipient, type JobSubcontractor,
  SUB_TRADE_LABELS, SUB_RECIPIENT_STATUS_LABELS, JOB_SUB_STATUS_LABELS,
} from '../../types/subcontractors';

const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('cs-CZ') : '';
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
  const [contractHtml, setContractHtml] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerPeople, setOfferPeople] = useState('');
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

  const openDetail = async (rec: SubInquiryRecipient) => {
    setDetail(rec);
    setError('');
    setOfferPrice('');
    setOfferNote('');
    setOfferPeople('');
    if (rec.status === 'sent') {
      await supabase.rpc('respond_sub_inquiry', { p_recipient: rec.id, p_action: 'viewed' });
    }
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
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const openInquiries = recipients.filter(r => r.sub_inquiries?.status === 'sent');
  const pastInquiries = recipients.filter(r => r.sub_inquiries?.status !== 'sent');

  // -------------------------------------------------- detail smlouvy
  if (contractJob) {
    return (
      <div className="min-h-screen bg-navy-900">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
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
      </div>
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
      <div className="min-h-screen bg-navy-900">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <button onClick={() => { setDetail(null); loadData(); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Zpět na poptávky
          </button>

          <div className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5 space-y-4">
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
              <textarea rows={2} value={offerNote} onChange={e => setOfferNote(e.target.value)} placeholder="Poznámka (volitelné)" className={`${inputCls} mt-3`} disabled={!canRespond} />
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
      </div>
    );
  }

  // -------------------------------------------------- přehled
  return (
    <div className="min-h-screen bg-navy-900">
      <header className="border-b border-white/[0.08] bg-navy-800/60">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">Portál subdodavatele</div>
              <div className="text-[11px] text-slate-500">{me?.name}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition">
            <LogOut className="w-3.5 h-3.5" /> Odhlásit
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          {([['inquiries', `Poptávky (${openInquiries.length})`], ['jobs', `Moje zakázky (${jobs.length})`]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-extrabold transition ${
                tab === k ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
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
                  className="w-full text-left bg-navy-800/60 border border-white/[0.08] hover:border-blue-400/40 rounded-xl px-4 py-3 transition"
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
                <div key={job.id} className="bg-navy-800/60 border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-white">{job.scope || (SUB_TRADE_LABELS[job.trade] || 'Zakázka')}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {job.agreed_price > 0 && `${job.agreed_price.toLocaleString('cs-CZ')} Kč`}
                      {job.date_from ? ` · od ${fmtDate(job.date_from)}` : ''}
                      {job.date_to ? ` do ${fmtDate(job.date_to)}` : ''}
                    </div>
                  </div>
                  {job.contract_document_id && (
                    <button
                      onClick={() => openContract(job)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition ${
                        job.status === 'contract_signed'
                          ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                          : 'text-white bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      {job.status === 'contract_signed' ? 'Zobrazit smlouvu' : 'Smlouva k potvrzení'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
