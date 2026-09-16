import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, HardHat, Building2, User, Phone, Mail,
  Star, FileText, Upload, ExternalLink, AlertTriangle, ShieldCheck, X,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { logAudit } from '../../lib/auditLog';
import {
  type Subcontractor, type SubcontractorDocument, type SubDocType,
  type JobSubcontractor, type JobSubStatus,
  SUB_TRADE_LABELS, SUB_DOC_TYPE_LABELS, JOB_SUB_STATUS_LABELS, docValidity,
} from '../../types/subcontractors';

interface AssignmentRow extends JobSubcontractor {
  subcontractors?: Subcontractor;
  jobs?: { id: string; project_id: string; projects?: { id: string; project_name: string } };
}

const EMPTY_FORM = {
  sub_type: 'company' as 'company' | 'individual',
  name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '',
  trades: [] as string[], hourly_rate: 0, rating: 0, note: '',
};

const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';

function ValidityBadge({ validUntil }: { validUntil: string | null }) {
  const v = docValidity(validUntil);
  if (v === 'none') return null;
  const dateStr = validUntil ? new Date(validUntil).toLocaleDateString('cs-CZ') : '';
  if (v === 'expired') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border text-red-400 bg-red-500/10 border-red-500/20"><AlertTriangle className="w-2.5 h-2.5" /> Expirováno {dateStr}</span>;
  }
  if (v === 'expiring') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/20"><AlertTriangle className="w-2.5 h-2.5" /> Vyprší {dateStr}</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20"><ShieldCheck className="w-2.5 h-2.5" /> Platné do {dateStr}</span>;
}

function RatingStars({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i === rating ? 0 : i)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star className={`w-3.5 h-3.5 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
        </button>
      ))}
    </span>
  );
}

export default function SubcontractorsPage() {
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [docs, setDocs] = useState<SubcontractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editSub, setEditSub] = useState<Subcontractor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailSub, setDetailSub] = useState<Subcontractor | null>(null);
  const [view, setView] = useState<'subs' | 'assignments'>('subs');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [docForm, setDocForm] = useState({ doc_type: 'pojisteni' as SubDocType, name: '', valid_until: '', file: null as File | null });

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Subdodavatelé' }],
      primaryAction: {
        label: 'Nový subdodavatel',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => { setEditSub(null); setForm(EMPTY_FORM); setShowModal(true); },
      },
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    const [subsRes, docsRes, assignRes] = await Promise.all([
      supabase.from('subcontractors').select('*').order('name'),
      supabase.from('subcontractor_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('job_subcontractors')
        .select('*, subcontractors(*), jobs(id, project_id, projects(id, project_name))')
        .order('created_at', { ascending: false }),
    ]);
    setSubs((subsRes.data || []) as Subcontractor[]);
    setDocs((docsRes.data || []) as SubcontractorDocument[]);
    setAssignments((assignRes.data || []) as AssignmentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Zadejte jméno subdodavatele', 'error'); return; }
    const payload = {
      ...form,
      rating: form.rating > 0 ? form.rating : null,
      updated_at: new Date().toISOString(),
    };
    if (editSub) {
      const { error } = await supabase.from('subcontractors').update(payload).eq('id', editSub.id);
      if (error) { toast('Chyba při ukládání', 'error'); return; }
      await logAudit('subcontractor', editSub.id, 'updated', { name: form.name });
      toast('Subdodavatel uložen');
    } else {
      const { data, error } = await supabase.from('subcontractors')
        .insert({ ...payload, created_by: user!.id })
        .select('id').maybeSingle();
      if (error || !data) { toast('Chyba při vytváření', 'error'); return; }
      await logAudit('subcontractor', data.id, 'created', { name: form.name });
      toast('Subdodavatel vytvořen');
    }
    setShowModal(false);
    loadData();
  };

  const handleDeactivate = async (sub: Subcontractor) => {
    const { error } = await supabase.from('subcontractors')
      .update({ is_active: !sub.is_active, updated_at: new Date().toISOString() })
      .eq('id', sub.id);
    if (error) { toast('Chyba', 'error'); return; }
    toast(sub.is_active ? 'Subdodavatel deaktivován' : 'Subdodavatel aktivován');
    loadData();
  };

  const openEdit = (sub: Subcontractor) => {
    setEditSub(sub);
    setForm({
      sub_type: sub.sub_type, name: sub.name, ico: sub.ico, dic: sub.dic,
      email: sub.email, phone: sub.phone, address: sub.address, city: sub.city,
      trades: sub.trades || [], hourly_rate: sub.hourly_rate || 0,
      rating: sub.rating || 0, note: sub.note,
    });
    setShowModal(true);
  };

  const toggleTrade = (t: string) => {
    setForm(prev => ({
      ...prev,
      trades: prev.trades.includes(t) ? prev.trades.filter(x => x !== t) : [...prev.trades, t],
    }));
  };

  const handleUploadDoc = async () => {
    if (!detailSub || !docForm.name.trim()) { toast('Zadejte název dokumentu', 'error'); return; }
    setUploading(true);
    let fileUrl = '';
    if (docForm.file) {
      const path = `subdocs/${detailSub.id}/${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(path, docForm.file);
      if (uploadError) { toast('Chyba při nahrávání souboru', 'error'); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
    }
    const { error } = await supabase.from('subcontractor_documents').insert({
      subcontractor_id: detailSub.id,
      doc_type: docForm.doc_type,
      name: docForm.name.trim(),
      file_url: fileUrl,
      valid_until: docForm.valid_until || null,
      created_by: user!.id,
    });
    setUploading(false);
    if (error) { toast('Chyba při ukládání dokumentu', 'error'); return; }
    setDocForm({ doc_type: 'pojisteni', name: '', valid_until: '', file: null });
    toast('Dokument uložen');
    loadData();
  };

  const handleDeleteDoc = async (doc: SubcontractorDocument) => {
    const { error } = await supabase.from('subcontractor_documents').delete().eq('id', doc.id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Dokument smazán');
    loadData();
  };

  const handleAssignmentStatus = async (row: AssignmentRow, status: JobSubStatus) => {
    const { error } = await supabase.from('job_subcontractors')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) { toast('Chyba při změně stavu', 'error'); return; }
    loadData();
  };

  const subDocs = (subId: string) => docs.filter(d => d.subcontractor_id === subId);
  const worstValidity = (subId: string): 'expired' | 'expiring' | 'ok' => {
    const list = subDocs(subId);
    if (list.some(d => docValidity(d.valid_until) === 'expired')) return 'expired';
    if (list.some(d => docValidity(d.valid_until) === 'expiring')) return 'expiring';
    return 'ok';
  };

  const filtered = subs.filter(s => {
    if (!showInactive && !s.is_active) return false;
    if (tradeFilter && !(s.trades || []).includes(tradeFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.city.toLowerCase().includes(q) && !(s.ico || '').includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-slate-500">Načítám…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {([['subs', 'Subdodavatelé'], ['assignments', 'Poptávky a zakázky']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition ${
              view === key ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400 hover:text-white'
            }`}
          >
            {label}
            {key === 'assignments' && assignments.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20">{assignments.length}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'subs' && (<>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat podle jména, města, IČO…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className={`${inputCls} w-48`}>
          <option value="">Všechna řemesla</option>
          {Object.entries(SUB_TRADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          Zobrazit neaktivní
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <HardHat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Žádní subdodavatelé</p>
          <p className="text-xs text-slate-600 mt-1">Přidejte prvního tlačítkem „Nový subdodavatel".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(sub => {
            const validity = worstValidity(sub.id);
            const TypeIcon = sub.sub_type === 'company' ? Building2 : User;
            return (
              <div
                key={sub.id}
                className={`bg-navy-800/60 rounded-xl border border-white/[0.08] p-4 space-y-3 hover:border-blue-400/40 transition cursor-pointer ${!sub.is_active ? 'opacity-50' : ''}`}
                onClick={() => setDetailSub(sub)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <TypeIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-white truncate">{sub.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {sub.sub_type === 'company' ? 'Firma' : 'OSVČ / jednotlivec'}
                        {sub.city ? ` · ${sub.city}` : ''}
                        {sub.ico ? ` · IČO ${sub.ico}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(sub)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeactivate(sub)} title={sub.is_active ? 'Deaktivovat' : 'Aktivovat'} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.08] transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(sub.trades || []).map(t => (
                    <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300">
                      {SUB_TRADE_LABELS[t] || t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3 min-w-0">
                    {sub.phone && <span className="inline-flex items-center gap-1 truncate"><Phone className="w-3 h-3" />{sub.phone}</span>}
                    {sub.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{sub.email}</span>}
                  </div>
                  <RatingStars rating={sub.rating || 0} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {sub.hourly_rate > 0 ? `${sub.hourly_rate.toLocaleString('cs-CZ')} Kč/hod` : ''}
                  </span>
                  {validity === 'expired' && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-400"><AlertTriangle className="w-3 h-3" /> Neplatné dokumenty</span>}
                  {validity === 'expiring' && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-400"><AlertTriangle className="w-3 h-3" /> Dokumenty brzy vyprší</span>}
                  {validity === 'ok' && subDocs(sub.id).length > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400"><ShieldCheck className="w-3 h-3" /> Dokumenty OK</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {view === 'assignments' && (<>
      <div className="flex flex-wrap items-center gap-3">
        <select value={assignmentStatusFilter} onChange={e => setAssignmentStatusFilter(e.target.value)} className={`${inputCls} w-56`}>
          <option value="">Všechny stavy</option>
          {Object.entries(JOB_SUB_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-slate-500">
          {assignments.filter(a => !assignmentStatusFilter || a.status === assignmentStatusFilter).length} záznamů
        </span>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Zatím žádné poptávky ani přiřazení</p>
          <p className="text-xs text-slate-600 mt-1">Subdodavatele přiřadíte k zakázce v projektu na záložce Realizace.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments
            .filter(a => !assignmentStatusFilter || a.status === assignmentStatusFilter)
            .map(row => {
              const meta = JOB_SUB_STATUS_LABELS[row.status];
              const projectId = row.jobs?.project_id;
              const projectName = row.jobs?.projects?.project_name || 'Neznámý projekt';
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-3 bg-navy-800/60 border border-white/[0.08] rounded-xl px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => projectId && navigate(`/projekty/${projectId}`)}
                        className="text-sm font-extrabold text-white hover:text-blue-300 transition truncate"
                      >
                        {projectName}
                      </button>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm font-semibold text-slate-300 truncate">{row.subcontractors?.name || '—'}</span>
                      {row.trade && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300">
                          {SUB_TRADE_LABELS[row.trade] || row.trade}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {row.agreed_price > 0 ? `${row.agreed_price.toLocaleString('cs-CZ')} Kč` : 'Cena nedohodnuta'}
                      {row.date_from ? ` · od ${new Date(row.date_from).toLocaleDateString('cs-CZ')}` : ''}
                      {row.date_to ? ` do ${new Date(row.date_to).toLocaleDateString('cs-CZ')}` : ''}
                      {row.scope ? ` · ${row.scope}` : ''}
                    </div>
                  </div>
                  <select
                    value={row.status}
                    onChange={e => handleAssignmentStatus(row, e.target.value as JobSubStatus)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border bg-transparent ${meta.cls}`}
                  >
                    {Object.entries(JOB_SUB_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k} className="bg-slate-900">{v.label}</option>
                    ))}
                  </select>
                  {row.contract_document_id && projectId && (
                    <button
                      onClick={() => navigate(`/projekty/${projectId}/dokument/${row.contract_document_id}`)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Smlouva
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
      </>)}

      {/* -------- formulář -------- */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editSub ? `Upravit — ${editSub.name}` : 'Nový subdodavatel'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleSave} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">
              {editSub ? 'Uložit změny' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['company', 'individual'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(p => ({ ...p, sub_type: t }))}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition ${
                  form.sub_type === t ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-white/[0.08] text-slate-400 hover:border-white/20'
                }`}
              >
                {t === 'company' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                {t === 'company' ? 'Firma' : 'OSVČ / jednotlivec'}
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>Název / Jméno *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>IČO</label><input value={form.ico} onChange={e => setForm(p => ({ ...p, ico: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>DIČ</label><input value={form.dic} onChange={e => setForm(p => ({ ...p, dic: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>E-mail</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Telefon</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Adresa</label><input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Město</label><input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls} /></div>
          </div>
          <div>
            <label className={labelCls}>Řemesla</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SUB_TRADE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleTrade(k)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                    form.trades.includes(k) ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-white/[0.08] text-slate-400 hover:border-white/20'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hodinová sazba (Kč)</label>
              <input type="number" min={0} value={form.hourly_rate} onChange={e => setForm(p => ({ ...p, hourly_rate: parseFloat(e.target.value) || 0 }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hodnocení</label>
              <div className="pt-2"><RatingStars rating={form.rating} onChange={r => setForm(p => ({ ...p, rating: r }))} /></div>
            </div>
          </div>
          <div><label className={labelCls}>Poznámka</label><textarea rows={2} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} className={inputCls} /></div>
        </div>
      </Modal>

      {/* -------- detail + dokumenty -------- */}
      <Modal
        open={!!detailSub}
        onClose={() => setDetailSub(null)}
        title={detailSub?.name || ''}
        size="lg"
      >
        {detailSub && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-slate-500 text-xs">Typ:</span> <span className="text-slate-200">{detailSub.sub_type === 'company' ? 'Firma' : 'OSVČ / jednotlivec'}</span></div>
              <div><span className="text-slate-500 text-xs">IČO / DIČ:</span> <span className="text-slate-200">{[detailSub.ico, detailSub.dic].filter(Boolean).join(' / ') || '—'}</span></div>
              <div><span className="text-slate-500 text-xs">Kontakt:</span> <span className="text-slate-200">{[detailSub.phone, detailSub.email].filter(Boolean).join(' · ') || '—'}</span></div>
              <div><span className="text-slate-500 text-xs">Adresa:</span> <span className="text-slate-200">{[detailSub.address, detailSub.city].filter(Boolean).join(', ') || '—'}</span></div>
              <div><span className="text-slate-500 text-xs">Sazba:</span> <span className="text-slate-200">{detailSub.hourly_rate > 0 ? `${detailSub.hourly_rate.toLocaleString('cs-CZ')} Kč/hod` : '—'}</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-500 text-xs">Hodnocení:</span> <RatingStars rating={detailSub.rating || 0} /></div>
            </div>
            {detailSub.note && <p className="text-xs text-slate-400 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3">{detailSub.note}</p>}

            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Dokumenty
              </h3>
              {subDocs(detailSub.id).length === 0 ? (
                <p className="text-xs text-slate-500 mb-3">Žádné dokumenty. Nahrajte pojištění odpovědnosti nebo oprávnění.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {subDocs(detailSub.id).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate">{doc.name}</div>
                        <div className="text-[11px] text-slate-500">{SUB_DOC_TYPE_LABELS[doc.doc_type]}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ValidityBadge validUntil={doc.valid_until} />
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-white/[0.08] transition">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => handleDeleteDoc(doc)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.08] transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Typ dokumentu</label>
                    <select value={docForm.doc_type} onChange={e => setDocForm(p => ({ ...p, doc_type: e.target.value as SubDocType }))} className={inputCls}>
                      {Object.entries(SUB_DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Platnost do</label>
                    <input type="date" value={docForm.valid_until} onChange={e => setDocForm(p => ({ ...p, valid_until: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Název dokumentu *</label>
                  <input value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} placeholder="Např. Pojištění odpovědnosti 10 mil. Kč" className={inputCls} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1">
                    <span className={labelCls}>Soubor (volitelné)</span>
                    <input type="file" onChange={e => setDocForm(p => ({ ...p, file: e.target.files?.[0] || null }))} className="text-xs text-slate-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/[0.08] file:text-slate-300 file:text-xs file:font-bold file:cursor-pointer" />
                  </label>
                  <button
                    onClick={handleUploadDoc}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 shrink-0 self-end"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? 'Nahrávám…' : 'Uložit dokument'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
