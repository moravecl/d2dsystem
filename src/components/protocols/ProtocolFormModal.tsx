import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square, FileCheck } from 'lucide-react';
import Modal from '../ui/Modal';
import SignaturePad from '../projects/SignaturePad';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import type { ProjectProtocol, ChecklistItem } from './protocolTypes';
import {
  PROTOCOL_TYPES, RESULT_OPTIONS, MEASURED_VALUE_TEMPLATES,
} from './protocolTypes';

interface SavedTemplate {
  id: string;
  protocol_type: string;
  name: string;
  description: string;
  default_result: string;
  measured_value_fields: { key: string; label: string; unit: string }[];
  default_description: string;
  default_findings: string;
  default_recommendations: string;
  items: { label: string; sort_order: number }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  protocol?: ProjectProtocol | null;
  onSaved: () => void;
}

interface FormState {
  protocol_type: string;
  title: string;
  protocol_date: string;
  valid_until: string;
  inspector_name: string;
  inspector_company: string;
  result: string;
  description: string;
  findings: string;
  recommendations: string;
  notes: string;
  measured_values: Record<string, string>;
  inspector_signature: string;
  client_signature: string;
  status: string;
}

const INITIAL_FORM: FormState = {
  protocol_type: 'pressure_test',
  title: '',
  protocol_date: new Date().toISOString().slice(0, 10),
  valid_until: '',
  inspector_name: '',
  inspector_company: '',
  result: 'pass',
  description: '',
  findings: '',
  recommendations: '',
  notes: '',
  measured_values: {},
  inspector_signature: '',
  client_signature: '',
  status: 'draft',
};

type TabKey = 'basic' | 'checklist' | 'measurements' | 'signatures';

export default function ProtocolFormModal({ open, onClose, projectId, protocol, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>('basic');
  const [, setShowSignatures] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const isEdit = !!protocol;

  useEffect(() => {
    if (!open) return;
    supabase
      .from('protocol_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(async ({ data: tpls }) => {
        if (!tpls || tpls.length === 0) { setTemplates([]); return; }
        const { data: allItems } = await supabase
          .from('protocol_template_items')
          .select('*')
          .in('template_id', tpls.map(t => t.id))
          .order('sort_order');
        setTemplates(tpls.map((t: any) => ({
          ...t,
          measured_value_fields: t.measured_value_fields || [],
          items: (allItems || []).filter((i: any) => i.template_id === t.id),
        })));
      });

    if (protocol) {
      setForm({
        protocol_type: protocol.protocol_type,
        title: protocol.title,
        protocol_date: protocol.protocol_date,
        valid_until: protocol.valid_until || '',
        inspector_name: protocol.inspector_name,
        inspector_company: protocol.inspector_company,
        result: protocol.result,
        description: protocol.description,
        findings: protocol.findings,
        recommendations: protocol.recommendations,
        notes: protocol.notes,
        measured_values: protocol.measured_values || {},
        inspector_signature: protocol.inspector_signature,
        client_signature: protocol.client_signature,
        status: protocol.status,
      });
      supabase
        .from('protocol_checklist_items')
        .select('*')
        .eq('protocol_id', protocol.id)
        .order('sort_order')
        .then(({ data }) => {
          setChecklist((data || []).map((d: any) => ({
            id: d.id,
            protocol_id: d.protocol_id,
            label: d.label,
            checked: d.checked,
            note: d.note,
            sort_order: d.sort_order,
          })));
        });
      setSelectedTemplateId('');
    } else {
      setForm(INITIAL_FORM);
      const typeConf = PROTOCOL_TYPES.find(t => t.key === INITIAL_FORM.protocol_type);
      setChecklist(
        (typeConf?.defaultChecklist || []).map((label, i) => ({
          label, checked: false, note: '', sort_order: i,
        }))
      );
      setSelectedTemplateId('');
      supabase.from('profiles').select('display_name, full_name').eq('id', user!.id).maybeSingle().then(({ data }) => {
        if (data) setForm(f => ({ ...f, inspector_name: data.full_name || data.display_name || '' }));
      });
    }
    setTab('basic');
    setShowSignatures(false);
  }, [open, protocol, user]);

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setForm(f => ({
      ...f,
      protocol_type: tpl.protocol_type,
      title: tpl.name,
      result: tpl.default_result,
      description: tpl.default_description,
      findings: tpl.default_findings,
      recommendations: tpl.default_recommendations,
      measured_values: {},
    }));
    setChecklist(
      tpl.items.map((item, i) => ({
        label: item.label, checked: false, note: '', sort_order: i,
      }))
    );
  };

  const handleTypeChange = (type: string) => {
    const typeConf = PROTOCOL_TYPES.find(t => t.key === type);
    setForm(f => ({
      ...f,
      protocol_type: type,
      title: f.title || typeConf?.label || '',
      measured_values: {},
    }));
    if (!isEdit) {
      setChecklist(
        (typeConf?.defaultChecklist || []).map((label, i) => ({
          label, checked: false, note: '', sort_order: i,
        }))
      );
    }
  };

  const updateMV = (key: string, val: string) => {
    setForm(f => ({ ...f, measured_values: { ...f.measured_values, [key]: val } }));
  };

  const toggleCheck = (idx: number) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c));
  };

  const updateCheckNote = (idx: number, note: string) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, note } : c));
  };

  const updateCheckLabel = (idx: number, label: string) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, label } : c));
  };

  const addCheckItem = () => {
    setChecklist(prev => [...prev, { label: '', checked: false, note: '', sort_order: prev.length }]);
  };

  const removeCheckItem = (idx: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.title.trim() && !PROTOCOL_TYPES.find(t => t.key === form.protocol_type)?.label) return;
    setSaving(true);

    const title = form.title.trim() || PROTOCOL_TYPES.find(t => t.key === form.protocol_type)?.label || '';
    const protocolNumber = isEdit ? protocol!.protocol_number : `PR-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      project_id: projectId,
      protocol_number: protocolNumber,
      protocol_type: form.protocol_type,
      title,
      protocol_date: form.protocol_date,
      valid_until: form.valid_until || null,
      inspector_name: form.inspector_name,
      inspector_company: form.inspector_company,
      result: form.result,
      description: form.description,
      findings: form.findings,
      recommendations: form.recommendations,
      notes: form.notes,
      measured_values: form.measured_values,
      inspector_signature: form.inspector_signature,
      client_signature: form.client_signature,
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    let protocolId: string;

    if (isEdit) {
      const { error } = await supabase.from('project_protocols').update(payload).eq('id', protocol!.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
      protocolId = protocol!.id;
      await supabase.from('protocol_checklist_items').delete().eq('protocol_id', protocolId);
    } else {
      const { data, error } = await supabase.from('project_protocols').insert({
        ...payload,
        created_by: user!.id,
      }).select('id').single();
      if (error || !data) { toast('Chyba při vytváření', 'error'); setSaving(false); return; }
      protocolId = data.id;
    }

    if (checklist.length > 0) {
      const items = checklist.map((c, i) => ({
        protocol_id: protocolId,
        label: c.label,
        checked: c.checked,
        note: c.note,
        sort_order: i,
      }));
      await supabase.from('protocol_checklist_items').insert(items);
    }

    setSaving(false);
    toast(isEdit ? 'Protokol uložen' : 'Protokol vytvořen');
    onSaved();
    onClose();
  };

  const selectedTpl = templates.find(t => t.id === selectedTemplateId);
  const mvTemplate = (selectedTpl?.measured_value_fields.length ? selectedTpl.measured_value_fields : null)
    || MEASURED_VALUE_TEMPLATES[form.protocol_type] || [];
  const typeConf = PROTOCOL_TYPES.find(t => t.key === form.protocol_type);
  const checkedCount = checklist.filter(c => c.checked).length;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'basic', label: 'Základní údaje' },
    { key: 'checklist', label: `Kontrolní body (${checkedCount}/${checklist.length})` },
    { key: 'measurements', label: 'Naměřené hodnoty' },
    { key: 'signatures', label: 'Podpisy' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Upravit: ${protocol!.title}` : 'Nový protokol'}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : isEdit ? 'Uložit' : 'Vytvořit protokol'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center bg-white/[0.06] rounded-xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                tab === t.key ? 'bg-white/[0.06] text-blue-400 ' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'basic' && (
          <div className="space-y-4">
            {!isEdit && templates.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  <FileCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Načíst ze šablony
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e => applyTemplate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-blue-500/10"
                >
                  <option value="">-- vyberte šablonu --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({PROTOCOL_TYPES.find(pt => pt.key === t.protocol_type)?.label || t.protocol_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ protokolu *</label>
              <select
                value={form.protocol_type}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {PROTOCOL_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název / popis protokolu</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={typeConf?.label}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum protokolu *</label>
                <input
                  type="date"
                  value={form.protocol_date}
                  onChange={e => setForm(f => ({ ...f, protocol_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Platnost do</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno revizního technika</label>
                <input
                  value={form.inspector_name}
                  onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Společnost</label>
                <input
                  value={form.inspector_company}
                  onChange={e => setForm(f => ({ ...f, inspector_company: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výsledek</label>
              <div className="flex items-center gap-2">
                {RESULT_OPTIONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setForm(f => ({ ...f, result: r.key }))}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                      form.result === r.key ? r.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white/[0.06] text-slate-500 border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis předmětu kontroly</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Zjištění / nálezy</label>
              <textarea
                value={form.findings}
                onChange={e => setForm(f => ({ ...f, findings: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Doporučení</label>
              <textarea
                value={form.recommendations}
                onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="draft">Koncept</option>
                <option value="completed">Dokončeno</option>
                <option value="archived">Archivováno</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'checklist' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">
                {checkedCount} z {checklist.length} splněno
              </p>
              <button onClick={addCheckItem} className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-400">
                <Plus className="w-3.5 h-3.5" /> Přidat bod
              </button>
            </div>

            {checklist.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">
                Zatím žádné kontrolní body. Přidejte je tlačítkem výše.
              </div>
            )}

            {checklist.map((item, idx) => (
              <div key={idx} className={`flex items-start gap-2 p-3 rounded-xl border transition ${item.checked ? 'bg-emerald-500/10 border-emerald-200' : 'bg-white/[0.06] border-white/[0.06]'}`}>
                <button onClick={() => toggleCheck(idx)} className="mt-0.5 shrink-0">
                  {item.checked
                    ? <CheckSquare className="w-5 h-5 text-emerald-400" />
                    : <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                  }
                </button>
                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    value={item.label}
                    onChange={e => updateCheckLabel(idx, e.target.value)}
                    placeholder="Název kontrolního bodu"
                    className="w-full text-sm font-medium text-white bg-transparent focus:outline-none"
                  />
                  <input
                    value={item.note}
                    onChange={e => updateCheckNote(idx, e.target.value)}
                    placeholder="Poznámka..."
                    className="w-full text-xs text-slate-400 bg-transparent focus:outline-none"
                  />
                </div>
                <button onClick={() => removeCheckItem(idx)} className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'measurements' && (
          <div className="space-y-4">
            {mvTemplate.length > 0 ? (
              <>
                <p className="text-xs text-slate-500 mb-2">
                  Přednastavené hodnoty pro typ: {typeConf?.label}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {mvTemplate.map(mv => (
                    <div key={mv.key}>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{mv.label}</label>
                      <div className="flex items-center gap-1">
                        <input
                          value={form.measured_values[mv.key] || ''}
                          onChange={e => updateMV(mv.key, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="—"
                        />
                        <span className="text-xs text-slate-400 w-12 text-right">{mv.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-sm text-slate-400">
                Pro tento typ protokolu nejsou předdefinované měřené hodnoty.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky k měření</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Doplňující poznámky k naměřeným hodnotám..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>
        )}

        {tab === 'signatures' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Podpis revizního technika</label>
              <SignaturePad
                value={form.inspector_signature}
                onChange={v => setForm(f => ({ ...f, inspector_signature: v }))}
                width={460}
                height={160}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Podpis zákazníka / objednatele</label>
              <SignaturePad
                value={form.client_signature}
                onChange={v => setForm(f => ({ ...f, client_signature: v }))}
                width={460}
                height={160}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
