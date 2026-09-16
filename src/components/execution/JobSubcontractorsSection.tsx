import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Plus, FileSignature, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import { logAudit } from '../../lib/auditLog';
import { renderTemplate } from '../../lib/placeholderEngine';
import type { DocumentTemplate } from '../../types/database';
import {
  type Subcontractor, type JobSubcontractor, type JobSubStatus,
  SUB_TRADE_LABELS, JOB_SUB_STATUS_LABELS, docValidity,
} from '../../types/subcontractors';

interface Props {
  jobId: string;
  projectId: string;
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';

export default function JobSubcontractorsSection({ jobId, projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<JobSubcontractor[]>([]);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [expiredSubIds, setExpiredSubIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    subcontractor_id: '', trade: '', scope: '', agreed_price: 0, date_from: '', date_to: '', note: '',
  });

  const loadData = useCallback(async () => {
    const [rowsRes, subsRes, docsRes] = await Promise.all([
      supabase.from('job_subcontractors').select('*, subcontractors(*)').eq('job_id', jobId).order('created_at'),
      supabase.from('subcontractors').select('*').eq('is_active', true).order('name'),
      supabase.from('subcontractor_documents').select('subcontractor_id, valid_until'),
    ]);
    setRows((rowsRes.data || []) as JobSubcontractor[]);
    setSubs((subsRes.data || []) as Subcontractor[]);
    const expired = new Set<string>();
    for (const d of (docsRes.data || []) as { subcontractor_id: string; valid_until: string | null }[]) {
      if (docValidity(d.valid_until) === 'expired') expired.add(d.subcontractor_id);
    }
    setExpiredSubIds(expired);
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!form.subcontractor_id) { toast('Vyberte subdodavatele', 'error'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('job_subcontractors').insert({
      job_id: jobId,
      subcontractor_id: form.subcontractor_id,
      trade: form.trade,
      scope: form.scope,
      agreed_price: form.agreed_price,
      date_from: form.date_from || null,
      date_to: form.date_to || null,
      note: form.note,
      created_by: user!.id,
    }).select('id').maybeSingle();
    setSaving(false);
    if (error || !data) { toast('Chyba při přiřazení subdodavatele', 'error'); return; }
    await logAudit('job_subcontractor', data.id, 'created', { job_id: jobId, subcontractor_id: form.subcontractor_id });
    toast('Subdodavatel přiřazen k zakázce');
    setShowAdd(false);
    setForm({ subcontractor_id: '', trade: '', scope: '', agreed_price: 0, date_from: '', date_to: '', note: '' });
    loadData();
  };

  const handleRemove = async (row: JobSubcontractor) => {
    const { error } = await supabase.from('job_subcontractors').delete().eq('id', row.id);
    if (error) { toast('Chyba při odebrání', 'error'); return; }
    toast('Subdodavatel odebrán ze zakázky');
    loadData();
  };

  const handleStatusChange = async (row: JobSubcontractor, status: JobSubStatus) => {
    const { error } = await supabase.from('job_subcontractors')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) { toast('Chyba', 'error'); return; }
    loadData();
  };

  /**
   * Vygeneruje smlouvu o dílo ze šablony typu 'smlouva' do dokumentů
   * projektu a přilinkuje ji k vazbě zakázka×subdodavatel.
   */
  const handleGenerateContract = async (row: JobSubcontractor) => {
    const sub = row.subcontractors;
    if (!sub) return;
    setGeneratingId(row.id);
    try {
      const { data: templates } = await supabase.from('document_templates')
        .select('*').eq('template_type', 'smlouva').eq('is_active', true).order('name');
      const template = (templates || [])[0] as DocumentTemplate | undefined;
      if (!template) {
        toast('Chybí aktivní šablona typu „Smlouva o dílo" — vytvořte ji v Dokumentech', 'error');
        return;
      }

      const [{ data: proj }, { data: companyRow }, { data: authUser }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
        supabase.from('company_info').select('*').limit(1).maybeSingle(),
        supabase.auth.getUser(),
      ]);

      let clientData: Record<string, unknown> = {};
      if (proj?.client_id) {
        const { data: client } = await supabase.from('clients').select('*').eq('id', proj.client_id).maybeSingle();
        if (client) {
          clientData = {
            name: client.name, email: client.email || '', phone: client.phone || '',
            address: client.address || '', ico: client.ico || '', dic: client.dic || '',
          };
        }
      }

      const ctx = {
        company: companyRow ? {
          name: companyRow.company_name || '', ico: companyRow.company_id || '', dic: companyRow.tax_id || '',
          address: companyRow.address || '', city: companyRow.city || '', zip: companyRow.zip || '',
          phone: companyRow.phone || '', email: companyRow.email || '',
        } : {},
        project: proj ? {
          name: proj.project_name || proj.name || '', address: proj.address || '',
          status: proj.status || '', description: proj.description || '',
          deadline: proj.deadline ? new Date(proj.deadline).toLocaleDateString('cs-CZ') : '',
        } : {},
        client: clientData,
        subcontractor: {
          name: sub.name, ico: sub.ico || '', dic: sub.dic || '',
          address: sub.address || '', city: sub.city || '',
          email: sub.email || '', phone: sub.phone || '',
        },
        contract: {
          scope: row.scope || '',
          price: `${(row.agreed_price || 0).toLocaleString('cs-CZ')} Kč`,
          trade: SUB_TRADE_LABELS[row.trade] || row.trade || '',
          date_from: row.date_from ? new Date(row.date_from).toLocaleDateString('cs-CZ') : '',
          date_to: row.date_to ? new Date(row.date_to).toLocaleDateString('cs-CZ') : '',
        },
        currentUser: authUser.user?.user_metadata?.display_name || authUser.user?.email || '',
      };

      const renderedHtml = renderTemplate(template.content, ctx, 'empty');

      const { data: doc, error: docError } = await supabase.from('project_documents').insert({
        project_id: projectId,
        template_id: template.id,
        template_version: template.version,
        name: `SoD — ${sub.name} — ${new Date().toLocaleDateString('cs-CZ')}`,
        status: 'DRAFT',
        rendered_html: renderedHtml,
        render_context: { project_id: projectId, job_id: jobId, subcontractor_id: sub.id, job_subcontractor_id: row.id },
        document_type: 'smlouva',
        created_by: user!.id,
      }).select('id').maybeSingle();

      if (docError || !doc) { toast('Chyba při generování smlouvy', 'error'); return; }

      await supabase.from('job_subcontractors')
        .update({ contract_document_id: doc.id, status: 'contract_generated', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      await logAudit('project_document', doc.id, 'created', { template: template.name, subcontractor_id: sub.id });

      toast('Smlouva o dílo vygenerována');
      navigate(`/projekty/${projectId}/dokument/${doc.id}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const selectedSub = subs.find(s => s.id === form.subcontractor_id);

  return (
    <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <HardHat className="w-4 h-4 text-orange-400" /> Subdodavatelé
        </h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" /> Přiřadit subdodavatele
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">Na zakázce zatím nejsou žádní subdodavatelé.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const meta = JOB_SUB_STATUS_LABELS[row.status];
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white truncate">{row.subcontractors?.name || '—'}</span>
                    {row.trade && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300">
                        {SUB_TRADE_LABELS[row.trade] || row.trade}
                      </span>
                    )}
                    {expiredSubIds.has(row.subcontractor_id) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-400">
                        <AlertTriangle className="w-3 h-3" /> Neplatné dokumenty
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
                  onChange={e => handleStatusChange(row, e.target.value as JobSubStatus)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border bg-transparent ${meta.cls}`}
                >
                  {Object.entries(JOB_SUB_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k} className="bg-slate-900">{v.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 shrink-0">
                  {row.contract_document_id ? (
                    <button
                      onClick={() => navigate(`/projekty/${projectId}/dokument/${row.contract_document_id}`)}
                      title="Otevřít smlouvu"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Smlouva
                    </button>
                  ) : (
                    <button
                      onClick={() => handleGenerateContract(row)}
                      disabled={generatingId === row.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition disabled:opacity-50"
                    >
                      <FileSignature className="w-3 h-3" />
                      {generatingId === row.id ? 'Generuji…' : 'Vygenerovat SoD'}
                    </button>
                  )}
                  <button onClick={() => handleRemove(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.08] transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Přiřadit subdodavatele k zakázce"
        size="md"
        footer={
          <>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleAdd} disabled={saving} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
              Přiřadit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Subdodavatel *</label>
            <select value={form.subcontractor_id} onChange={e => setForm(p => ({ ...p, subcontractor_id: e.target.value }))} className={inputCls}>
              <option value="">-- Vyberte --</option>
              {subs.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{expiredSubIds.has(s.id) ? ' ⚠ neplatné dokumenty' : ''}
                </option>
              ))}
            </select>
            {subs.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">Zatím nemáte žádné subdodavatele — založte je v sekci Subdodavatelé.</p>
            )}
          </div>
          {selectedSub && expiredSubIds.has(selectedSub.id) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Subdodavatel má expirované dokumenty (pojištění/oprávnění). Zkontrolujte je před podpisem smlouvy.
            </div>
          )}
          <div>
            <label className={labelCls}>Řemeslo</label>
            <select value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))} className={inputCls}>
              <option value="">-- Nezvoleno --</option>
              {(selectedSub?.trades?.length ? selectedSub.trades : Object.keys(SUB_TRADE_LABELS)).map(t => (
                <option key={t} value={t}>{SUB_TRADE_LABELS[t] || t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rozsah prací (propíše se do smlouvy)</label>
            <textarea rows={3} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} placeholder="Např. Kompletní rozvod vody a odpadů dle PD, včetně tlakové zkoušky…" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Cena (Kč bez DPH)</label>
              <input type="number" min={0} value={form.agreed_price} onChange={e => setForm(p => ({ ...p, agreed_price: parseFloat(e.target.value) || 0 }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Zahájení</label>
              <input type="date" value={form.date_from} onChange={e => setForm(p => ({ ...p, date_from: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dokončení</label>
              <input type="date" value={form.date_to} onChange={e => setForm(p => ({ ...p, date_to: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div><label className={labelCls}>Poznámka</label><input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} className={inputCls} /></div>
        </div>
      </Modal>
    </div>
  );
}
