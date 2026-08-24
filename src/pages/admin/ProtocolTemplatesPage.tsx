import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Copy, ChevronDown, ChevronRight, CheckSquare, GripVertical, FileCheck, ToggleLeft, ToggleRight, Gauge, Zap, Wind, Flame, Thermometer, Droplets, Scan } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { PROTOCOL_TYPES, RESULT_OPTIONS, MEASURED_VALUE_TEMPLATES } from '../../components/protocols/protocolTypes';

interface Template {
  id: string;
  protocol_type: string;
  name: string;
  description: string;
  default_result: string;
  measured_value_fields: { key: string; label: string; unit: string }[];
  default_description: string;
  default_findings: string;
  default_recommendations: string;
  is_active: boolean;
  sort_order: number;
  items: TemplateItem[];
}

interface TemplateItem {
  id?: string;
  label: string;
  sort_order: number;
}

interface FormState {
  protocol_type: string;
  name: string;
  description: string;
  default_result: string;
  measured_value_fields: { key: string; label: string; unit: string }[];
  default_description: string;
  default_findings: string;
  default_recommendations: string;
  is_active: boolean;
}

const INITIAL_FORM: FormState = {
  protocol_type: 'pressure_test',
  name: '',
  description: '',
  default_result: 'pass',
  measured_value_fields: [],
  default_description: '',
  default_findings: '',
  default_recommendations: '',
  is_active: true,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  pressure_test: <Gauge className="w-4 h-4" />,
  electrical_inspection: <Zap className="w-4 h-4" />,
  recuperation_regulation: <Wind className="w-4 h-4" />,
  gas_inspection: <Flame className="w-4 h-4" />,
  fire_inspection: <Flame className="w-4 h-4" />,
  hvac_commissioning: <Thermometer className="w-4 h-4" />,
  waterproofing_test: <Droplets className="w-4 h-4" />,
  thermal_imaging: <Scan className="w-4 h-4" />,
  heating_test: <Thermometer className="w-4 h-4" />,
  other: <FileCheck className="w-4 h-4" />,
};

export default function ProtocolTemplatesPage() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const [tRes, iRes] = await Promise.all([
      supabase.from('protocol_templates').select('*').eq('organization_id', organization.id).order('sort_order'),
      supabase.from('protocol_template_items').select('*').order('sort_order'),
    ]);
    const tpls = (tRes.data || []) as any[];
    const items = (iRes.data || []) as any[];
    const mapped = tpls.map(t => ({
      ...t,
      measured_value_fields: t.measured_value_fields || [],
      items: items.filter(i => i.template_id === t.id).map((i: any) => ({
        id: i.id, label: i.label, sort_order: i.sort_order,
      })),
    }));
    setTemplates(mapped);
    setLoading(false);
    return mapped.length;
  }, [organization?.id]);

  const seedDefaults = useCallback(async () => {
    if (!organization?.id) return;
    const typesWithDefaults = PROTOCOL_TYPES.filter(t => t.defaultChecklist.length > 0);
    for (let i = 0; i < typesWithDefaults.length; i++) {
      const pt = typesWithDefaults[i];
      const mvFields = MEASURED_VALUE_TEMPLATES[pt.key] || [];
      const { data } = await supabase.from('protocol_templates').insert({
        organization_id: organization.id,
        protocol_type: pt.key,
        name: pt.label,
        description: '',
        default_result: 'pass',
        measured_value_fields: mvFields,
        is_active: true,
        sort_order: i,
      }).select('id').single();
      if (data && pt.defaultChecklist.length > 0) {
        await supabase.from('protocol_template_items').insert(
          pt.defaultChecklist.map((label, idx) => ({
            template_id: data.id,
            label,
            sort_order: idx,
          }))
        );
      }
    }
  }, [organization?.id]);

  useEffect(() => {
    (async () => {
      const count = await load();
      if (count === 0) {
        await seedDefaults();
        await load();
      }
    })();
  }, [load, seedDefaults]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('protocol_template_items').delete().eq('template_id', deleteTarget.id);
    await supabase.from('protocol_templates').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    toast('Šablona smazána');
    load();
  };

  const handleDuplicate = async (t: Template) => {
    const { data } = await supabase.from('protocol_templates').insert({
      organization_id: organization!.id,
      protocol_type: t.protocol_type,
      name: t.name + ' (kopie)',
      description: t.description,
      default_result: t.default_result,
      measured_value_fields: t.measured_value_fields,
      default_description: t.default_description,
      default_findings: t.default_findings,
      default_recommendations: t.default_recommendations,
      is_active: t.is_active,
      sort_order: templates.length,
    }).select('id').single();
    if (data && t.items.length > 0) {
      await supabase.from('protocol_template_items').insert(
        t.items.map((item, i) => ({ template_id: data.id, label: item.label, sort_order: i }))
      );
    }
    toast('Šablona duplikována');
    load();
  };

  const handleToggleActive = async (t: Template) => {
    await supabase.from('protocol_templates').update({ is_active: !t.is_active, updated_at: new Date().toISOString() }).eq('id', t.id);
    setTemplates(prev => prev.map(p => p.id === t.id ? { ...p, is_active: !p.is_active } : p));
  };

  const filtered = search
    ? templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        getTypeLabel(t.protocol_type).toLowerCase().includes(search.toLowerCase())
      )
    : templates;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Šablony protokolů</h1>
          <p className="text-sm text-slate-500 mt-1">Spravujte šablony pro protokoly tlakových zkoušek, revizí, zaregulování a dalších</p>
        </div>
        <button
          onClick={() => { setEditTemplate(null); setEditorOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition "
        >
          <Plus className="w-4 h-4" /> Nová šablona
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hledat šablonu..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/[0.06] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-500 mb-1">Žádné šablony</h3>
          <p className="text-xs text-slate-400">Vytvořte šablony pro různé typy protokolů.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className={`bg-white/[0.06] border rounded-xl transition ${t.is_active ? 'border-white/[0.06]' : 'border-white/[0.06] opacity-60'}`}>
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpandedId(expanded ? null : t.id)} className="shrink-0 text-slate-400">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-slate-500">
                    {TYPE_ICONS[t.protocol_type] || <FileCheck className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate">{t.name}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-white/[0.06] text-slate-500 shrink-0">
                        {getTypeLabel(t.protocol_type)}
                      </span>
                      {!t.is_active && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">Neaktivní</span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                      <span>{t.items.length} kontrolních bodů</span>
                      <span>{t.measured_value_fields.length} měřených hodnot</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggleActive(t)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition" title={t.is_active ? 'Deaktivovat' : 'Aktivovat'}>
                      {t.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-slate-300" />}
                    </button>
                    <button onClick={() => { setEditTemplate(t); setEditorOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDuplicate(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-50 space-y-4">
                    {t.items.length > 0 && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kontrolní body</h5>
                        <div className="space-y-1">
                          {t.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-slate-400 py-1">
                              <CheckSquare className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              {item.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {t.measured_value_fields.length > 0 && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Měřené hodnoty</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {t.measured_value_fields.map((mv, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-lg text-xs">
                              <span className="text-slate-400 font-medium">{mv.label}</span>
                              <span className="text-slate-400">[{mv.unit}]</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(t.default_description || t.default_findings || t.default_recommendations) && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Předvyplněné texty</h5>
                        {t.default_description && <p className="text-xs text-slate-500 mb-1"><span className="font-semibold">Popis:</span> {t.default_description}</p>}
                        {t.default_findings && <p className="text-xs text-slate-500 mb-1"><span className="font-semibold">Zjištění:</span> {t.default_findings}</p>}
                        {t.default_recommendations && <p className="text-xs text-slate-500"><span className="font-semibold">Doporučení:</span> {t.default_recommendations}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editorOpen && (
        <TemplateEditorModal
          template={editTemplate}
          orgId={organization!.id}
          onClose={() => { setEditorOpen(false); setEditTemplate(null); }}
          onSaved={() => { setEditorOpen(false); setEditTemplate(null); load(); }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Smazat šablonu?"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg">Zrušit</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Smazat</button>
          </>
        }
      >
        <p className="text-sm text-slate-400">Opravdu chcete smazat šablonu <strong>{deleteTarget?.name}</strong>? Tato akce je nevratná.</p>
      </Modal>
    </div>
  );
}

function getTypeLabel(key: string) {
  return PROTOCOL_TYPES.find(t => t.key === key)?.label || key;
}

interface EditorProps {
  template: Template | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateEditorModal({ template, orgId, onClose, onSaved }: EditorProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'basic' | 'checklist' | 'measurements' | 'texts'>('basic');
  const [newMvLabel, setNewMvLabel] = useState('');
  const [newMvUnit, setNewMvUnit] = useState('');

  const isEdit = !!template;

  useEffect(() => {
    if (template) {
      setForm({
        protocol_type: template.protocol_type,
        name: template.name,
        description: template.description,
        default_result: template.default_result,
        measured_value_fields: template.measured_value_fields || [],
        default_description: template.default_description,
        default_findings: template.default_findings,
        default_recommendations: template.default_recommendations,
        is_active: template.is_active,
      });
      setItems(template.items.map(i => ({ ...i })));
    } else {
      setForm(INITIAL_FORM);
      setItems([]);
    }
    setTab('basic');
  }, [template]);

  const handleTypeChange = (type: string) => {
    setForm(f => ({ ...f, protocol_type: type }));
    if (!isEdit && items.length === 0) {
      const typeConf = PROTOCOL_TYPES.find(t => t.key === type);
      if (typeConf?.defaultChecklist.length) {
        setItems(typeConf.defaultChecklist.map((label, i) => ({ label, sort_order: i })));
      }
      const mvt = MEASURED_VALUE_TEMPLATES[type];
      if (mvt) {
        setForm(f => ({ ...f, measured_value_fields: mvt.map(m => ({ ...m })) }));
      }
    }
  };

  const loadDefaults = () => {
    const type = form.protocol_type;
    const typeConf = PROTOCOL_TYPES.find(t => t.key === type);
    if (typeConf?.defaultChecklist.length) {
      setItems(typeConf.defaultChecklist.map((label, i) => ({ label, sort_order: i })));
    }
    const mvt = MEASURED_VALUE_TEMPLATES[type];
    if (mvt) {
      setForm(f => ({ ...f, measured_value_fields: mvt.map(m => ({ ...m })) }));
    }
    toast('Výchozí hodnoty načteny');
  };

  const addItem = () => {
    setItems(prev => [...prev, { label: '', sort_order: prev.length }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemLabel = (idx: number, label: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, label } : it));
  };

  const addMv = () => {
    if (!newMvLabel.trim()) return;
    const key = newMvLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setForm(f => ({
      ...f,
      measured_value_fields: [...f.measured_value_fields, { key, label: newMvLabel.trim(), unit: newMvUnit.trim() || '-' }],
    }));
    setNewMvLabel('');
    setNewMvUnit('');
  };

  const removeMv = (idx: number) => {
    setForm(f => ({ ...f, measured_value_fields: f.measured_value_fields.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Vyplňte název šablony', 'error'); return; }
    setSaving(true);

    const payload = {
      organization_id: orgId,
      protocol_type: form.protocol_type,
      name: form.name.trim(),
      description: form.description,
      default_result: form.default_result,
      measured_value_fields: form.measured_value_fields,
      default_description: form.default_description,
      default_findings: form.default_findings,
      default_recommendations: form.default_recommendations,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let templateId: string;

    if (isEdit) {
      const { error } = await supabase.from('protocol_templates').update(payload).eq('id', template!.id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
      templateId = template!.id;
      await supabase.from('protocol_template_items').delete().eq('template_id', templateId);
    } else {
      const { data, error } = await supabase.from('protocol_templates').insert(payload).select('id').single();
      if (error || !data) { toast('Chyba při vytváření', 'error'); setSaving(false); return; }
      templateId = data.id;
    }

    if (items.filter(i => i.label.trim()).length > 0) {
      await supabase.from('protocol_template_items').insert(
        items.filter(i => i.label.trim()).map((item, i) => ({
          template_id: templateId,
          label: item.label.trim(),
          sort_order: i,
        }))
      );
    }

    setSaving(false);
    toast(isEdit ? 'Šablona uložena' : 'Šablona vytvořena');
    onSaved();
  };

  const tabs = [
    { key: 'basic' as const, label: 'Základní' },
    { key: 'checklist' as const, label: `Kontrolní body (${items.length})` },
    { key: 'measurements' as const, label: `Měřené hodnoty (${form.measured_value_fields.length})` },
    { key: 'texts' as const, label: 'Výchozí texty' },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Upravit: ${template!.name}` : 'Nová šablona protokolu'}
      size="xl"
      footer={
        <>
          <button onClick={loadDefaults} className="mr-auto px-3 py-2 text-xs font-medium text-slate-500 hover:text-blue-400 hover:bg-blue-500/100/10 rounded-lg transition">
            Načíst výchozí hodnoty pro typ
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {saving ? 'Ukládám...' : isEdit ? 'Uložit' : 'Vytvořit'}
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
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název šablony *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Např. Tlaková zkouška - podlahové vytápění"
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis šablony</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výchozí výsledek</label>
              <div className="flex items-center gap-2">
                {RESULT_OPTIONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setForm(f => ({ ...f, default_result: r.key }))}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                      form.default_result === r.key ? r.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white/[0.06] text-slate-500 border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-400">Aktivní</label>
              <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} className="text-slate-500">
                {form.is_active ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
              </button>
            </div>
          </div>
        )}

        {tab === 'checklist' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">{items.length} kontrolních bodů</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-400">
                <Plus className="w-3.5 h-3.5" /> Přidat bod
              </button>
            </div>

            {items.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">
                Zatím žádné kontrolní body. Přidejte je nebo načtěte výchozí.
              </div>
            )}

            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.06]">
                <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-xs text-slate-400 w-5 shrink-0">{idx + 1}.</span>
                <input
                  value={item.label}
                  onChange={e => updateItemLabel(idx, e.target.value)}
                  placeholder="Název kontrolního bodu"
                  className="flex-1 text-sm text-white bg-transparent focus:outline-none"
                />
                <button onClick={() => removeItem(idx)} className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'measurements' && (
          <div className="space-y-4">
            {form.measured_value_fields.length > 0 && (
              <div className="space-y-1">
                {form.measured_value_fields.map((mv, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.06]">
                    <span className="flex-1 text-sm text-slate-300 font-medium">{mv.label}</span>
                    <span className="text-xs text-slate-400 w-16 text-right">[{mv.unit}]</span>
                    <button onClick={() => removeMv(i)} className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 pt-2 border-t border-white/[0.06]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Název hodnoty</label>
                <input
                  value={newMvLabel}
                  onChange={e => setNewMvLabel(e.target.value)}
                  placeholder="Např. Průtok vzduchu"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Jednotka</label>
                <input
                  value={newMvUnit}
                  onChange={e => setNewMvUnit(e.target.value)}
                  placeholder="m³/h"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                onClick={addMv}
                disabled={!newMvLabel.trim()}
                className="px-3 py-2 text-sm font-semibold text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {tab === 'texts' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výchozí popis předmětu kontroly</label>
              <textarea
                value={form.default_description}
                onChange={e => setForm(f => ({ ...f, default_description: e.target.value }))}
                rows={3}
                placeholder="Text, který se předvyplní při vytváření nového protokolu..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výchozí zjištění</label>
              <textarea
                value={form.default_findings}
                onChange={e => setForm(f => ({ ...f, default_findings: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výchozí doporučení</label>
              <textarea
                value={form.default_recommendations}
                onChange={e => setForm(f => ({ ...f, default_recommendations: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
