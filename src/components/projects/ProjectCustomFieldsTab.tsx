import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Settings2, ExternalLink, Mail, Check, AlertCircle, Trash2, X, ChevronDown, ChevronRight, EyeOff, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../ui/Modal';

interface FieldDef {
  id: string;
  name: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  section: string;
  position: number;
  project_id: string | null;
}

interface FieldValue {
  id: string;
  field_id: string;
  value: string;
}

interface Props {
  projectId: string;
}

const FIELD_TYPES: { key: string; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'textarea', label: 'Dlouhý text' },
  { key: 'number', label: 'Číslo' },
  { key: 'date', label: 'Datum' },
  { key: 'select', label: 'Výběr' },
  { key: 'checkbox', label: 'Ano/Ne' },
  { key: 'url', label: 'URL' },
  { key: 'email', label: 'E-mail' },
];

export default function ProjectCustomFieldsTab({ projectId }: Props) {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const orgId = organization?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const [globalRes, localRes, valsRes, hiddenRes] = await Promise.all([
      supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('project_id', null)
        .order('section')
        .order('position'),
      supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('project_id', projectId)
        .order('section')
        .order('position'),
      supabase
        .from('custom_field_values')
        .select('*')
        .eq('project_id', projectId),
      supabase
        .from('project_hidden_sections')
        .select('section_name')
        .eq('project_id', projectId),
    ]);

    setDefinitions([...(globalRes.data || []), ...(localRes.data || [])] as FieldDef[]);

    const valMap: Record<string, string> = {};
    ((valsRes.data || []) as FieldValue[]).forEach((v) => {
      valMap[v.field_id] = v.value;
    });
    setValues(valMap);

    const hidden = new Set<string>();
    (hiddenRes.data || []).forEach((r: { section_name: string }) => hidden.add(r.section_name));
    setHiddenSections(hidden);

    setLoading(false);
  }, [orgId, projectId]);

  useEffect(() => { load(); }, [load]);

  const toggleSectionVisibility = useCallback(async (sectionName: string) => {
    if (!orgId) return;
    const key = sectionName || 'Obecné';
    const isHidden = hiddenSections.has(key);
    if (isHidden) {
      await supabase
        .from('project_hidden_sections')
        .delete()
        .eq('project_id', projectId)
        .eq('section_name', key);
      setHiddenSections((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast('Sekce zobrazena', 'success');
    } else {
      await supabase.from('project_hidden_sections').insert({
        project_id: projectId,
        section_name: key,
        organization_id: orgId,
      });
      setHiddenSections((prev) => new Set(prev).add(key));
      toast('Sekce skryta', 'success');
    }
  }, [orgId, projectId, hiddenSections, toast]);

  const toggleCollapse = (sectionName: string) => {
    const key = sectionName || 'Obecné';
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const persistValue = useCallback(async (fieldId: string, val: string) => {
    if (!orgId) return;
    setSavingField(fieldId);
    await supabase.from('custom_field_values').upsert(
      {
        project_id: projectId,
        field_id: fieldId,
        value: val,
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,field_id' }
    );
    setSavingField(null);
  }, [orgId, projectId]);

  const handleChange = (fieldId: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleImmediateSave = (fieldId: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
    persistValue(fieldId, val);
  };

  const handleDeleteField = async (fieldId: string) => {
    await supabase.from('custom_field_values').delete().eq('field_id', fieldId).eq('project_id', projectId);
    await supabase.from('custom_field_definitions').delete().eq('id', fieldId);
    setDefinitions((prev) => prev.filter((d) => d.id !== fieldId));
    setValues((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    toast('Pole smazáno', 'success');
  };

  const handleFieldCreated = (newDef: FieldDef) => {
    setDefinitions((prev) => [...prev, newDef]);
    setShowAddModal(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const grouped: Record<string, FieldDef[]> = {};
  definitions.forEach((d) => {
    const sec = d.section || 'Obecné';
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(d);
  });

  const hasFields = definitions.length > 0;
  const allSections = Object.keys(grouped);
  const visibleSections = allSections.filter((s) => !hiddenSections.has(s));
  const hiddenSectionsList = allSections.filter((s) => hiddenSections.has(s));
  const hiddenCount = hiddenSectionsList.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Specifikace projektu</h3>
          <p className="text-sm text-slate-500 mt-0.5">Vlastní pole a parametry projektu</p>
        </div>
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
 showHidden
 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
 : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
 }`}
            >
              {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showHidden ? 'Skryt skryte' : `Skryte sekce (${hiddenCount})`}
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Přidat pole
          </button>
        </div>
      </div>

      {!hasFields ? (
        <div className="text-center py-16">
          <Settings2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300 mb-2">Žádná vlastní pole</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Globální pole pro všechny projekty nastavíte v administraci. Zde můžete přidat pole specifická pro tento projekt.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Přidat první pole
          </button>
        </div>
      ) : (
        <>
          {visibleSections.map((section) => {
            const sectionFields = grouped[section];
            const isCollapsed = collapsedSections.has(section);
            return (
              <SectionCard
                key={section}
                section={section}
                fields={sectionFields}
                isCollapsed={isCollapsed}
                isHidden={false}
                values={values}
                savingField={savingField}
                onToggleCollapse={() => toggleCollapse(section)}
                onToggleVisibility={() => toggleSectionVisibility(section)}
                onChange={handleChange}
                onBlurSave={persistValue}
                onImmediateSave={handleImmediateSave}
                onDeleteField={handleDeleteField}
              />
            );
          })}

          {showHidden && hiddenSectionsList.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skryté sekce</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              {hiddenSectionsList.map((section) => {
                const sectionFields = grouped[section];
                const isCollapsed = collapsedSections.has(section);
                return (
                  <SectionCard
                    key={section}
                    section={section}
                    fields={sectionFields}
                    isCollapsed={isCollapsed}
                    isHidden={true}
                    values={values}
                    savingField={savingField}
                    onToggleCollapse={() => toggleCollapse(section)}
                    onToggleVisibility={() => toggleSectionVisibility(section)}
                    onChange={handleChange}
                    onBlurSave={persistValue}
                    onImmediateSave={handleImmediateSave}
                    onDeleteField={handleDeleteField}
                  />
                );
              })}
            </>
          )}
        </>
      )}

      {showAddModal && orgId && (
        <AddFieldModal
          orgId={orgId}
          projectId={projectId}
          existingSections={[...new Set(definitions.map((d) => d.section).filter(Boolean))]}
          nextPosition={definitions.length}
          onClose={() => setShowAddModal(false)}
          onCreated={handleFieldCreated}
        />
      )}
    </div>
  );
}

function SectionCard({
  section,
  fields,
  isCollapsed,
  isHidden,
  values,
  savingField,
  onToggleCollapse,
  onToggleVisibility,
  onChange,
  onBlurSave,
  onImmediateSave,
  onDeleteField,
}: {
  section: string;
  fields: FieldDef[];
  isCollapsed: boolean;
  isHidden: boolean;
  values: Record<string, string>;
  savingField: string | null;
  onToggleCollapse: () => void;
  onToggleVisibility: () => void;
  onChange: (fieldId: string, val: string) => void;
  onBlurSave: (fieldId: string, val: string) => void;
  onImmediateSave: (fieldId: string, val: string) => void;
  onDeleteField: (fieldId: string) => void;
}) {
  return (
    <div className={`bg-white/[0.06] rounded-xl border overflow-hidden transition-all ${
 isHidden ? 'border-dashed border-white/[0.12] opacity-70' : 'border-white/[0.08]'
 }`}>
      <div
        className={`px-5 py-3 border-b border-white/[0.08] flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.06] transition ${
 isHidden ? 'bg-white/[0.06]' : 'bg-white/[0.04]'
 }`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
          <h4 className="text-sm font-bold text-slate-300">{section}</h4>
          <span className="text-xs text-slate-400 font-medium">{fields.length}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          className={`p-1.5 rounded-lg transition ${
 isHidden
 ? 'text-amber-500 hover:bg-amber-500/10 hover:text-amber-400'
 : 'text-slate-300 hover:text-slate-500 hover:bg-white/[0.06]'
 }`}
          title={isHidden ? 'Zobrazit sekci' : 'Skryt sekci'}
        >
          {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
      {!isCollapsed && (
        <div className="divide-y divide-white/[0.06]">
          {fields.map((def) => (
            <FieldRow
              key={def.id}
              definition={def}
              value={values[def.id] || ''}
              isSaving={savingField === def.id}
              onChange={(val) => onChange(def.id, val)}
              onBlurSave={(val) => onBlurSave(def.id, val)}
              onImmediateSave={(val) => onImmediateSave(def.id, val)}
              onDelete={def.project_id ? () => onDeleteField(def.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  definition,
  value,
  isSaving,
  onChange,
  onBlurSave,
  onImmediateSave,
  onDelete,
}: {
  definition: FieldDef;
  value: string;
  isSaving: boolean;
  onChange: (val: string) => void;
  onBlurSave: (val: string) => void;
  onImmediateSave: (val: string) => void;
  onDelete?: () => void;
}) {
  const { name, field_type, options, is_required } = definition;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleTextChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onBlurSave(val), 800);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const renderInput = () => {
    switch (field_type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); onBlurSave(value); } }}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); onBlurSave(value); } }}
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onImmediateSave(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onImmediateSave(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">-- vyberte --</option>
            {(options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <button
            onClick={() => onImmediateSave(value === 'true' ? 'false' : 'true')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
 value === 'true'
 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
 : 'bg-white/[0.06] border-white/[0.08] text-slate-500 hover:bg-white/[0.04]'
 }`}
          >
            {value === 'true' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded border border-white/[0.12]" />}
            {value === 'true' ? 'Ano' : 'Ne'}
          </button>
        );
      case 'url':
        return (
          <div className="flex gap-2">
            <input
              type="url"
              value={value}
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); onBlurSave(value); } }}
              placeholder="https://..."
              className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {value && (
              <a href={value} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/[0.06] text-slate-500 hover:text-blue-400 transition">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        );
      case 'email':
        return (
          <div className="flex gap-2">
            <input
              type="email"
              value={value}
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); onBlurSave(value); } }}
              placeholder="email@example.com"
              className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {value && (
              <a href={`mailto:${value}`} className="p-2 rounded-lg bg-white/[0.06] text-slate-500 hover:text-blue-400 transition">
                <Mail className="w-4 h-4" />
              </a>
            )}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); onBlurSave(value); } }}
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        );
    }
  };

  return (
    <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-start gap-2 group">
      <div className="sm:w-1/3 shrink-0 flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-300">{name}</span>
        {is_required && <AlertCircle className="w-3 h-3 text-red-400" />}
        {isSaving && <div className="w-3 h-3 border-2 border-blue-500/40 border-t-blue-600 rounded-full animate-spin" />}
      </div>
      <div className="flex-1 flex items-start gap-2">
        <div className="flex-1">{renderInput()}</div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
            title="Smazat pole"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddFieldModal({
  orgId,
  projectId,
  existingSections,
  nextPosition,
  onClose,
  onCreated,
}: {
  orgId: string;
  projectId: string;
  existingSections: string[];
  nextPosition: number;
  onClose: () => void;
  onCreated: (def: FieldDef) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [section, setSection] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addOption = () => {
    if (!optionInput.trim()) return;
    setOptions((prev) => [...prev, optionInput.trim()]);
    setOptionInput('');
  };

  const handleSave = async () => {
    if (!name.trim()) { toast('Zadejte název pole', 'error'); return; }
    setSaving(true);

    const { data, error } = await supabase.from('custom_field_definitions').insert({
      organization_id: orgId,
      project_id: projectId,
      name: name.trim(),
      field_type: fieldType,
      options: fieldType === 'select' ? options : [],
      is_required: false,
      section: section.trim(),
      position: nextPosition,
      is_active: true,
    }).select('*').maybeSingle();

    setSaving(false);
    if (error || !data) { toast('Chyba při vytváření pole', 'error'); return; }

    toast('Pole přidáno', 'success');
    onCreated(data as FieldDef);
  };

  return (
    <Modal open onClose={onClose} title="Přidat vlastní pole" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">Název pole *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Typ střechy, Plocha podlah..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">Typ pole</label>
          <div className="grid grid-cols-4 gap-1.5">
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.key}
                onClick={() => setFieldType(ft.key)}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition ${
 fieldType === ft.key
 ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
 : 'bg-white/[0.06] border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
 }`}
              >
                {ft.label}
              </button>
            ))}
          </div>
        </div>

        {fieldType === 'select' && (
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Možnosti výběru</label>
            <div className="flex gap-2 mb-2">
              <input
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                placeholder="Přidejte možnost..."
                className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                onKeyDown={(e) => e.key === 'Enter' && addOption()}
              />
              <button onClick={addOption} className="px-3 py-2 bg-white/[0.06] rounded-lg text-sm font-bold text-slate-400 hover:bg-white/[0.08] transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {options.map((opt, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.06] rounded-lg text-xs font-semibold text-slate-300">
                    {opt}
                    <button onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">Sekce (seskupení)</label>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="např. Technické údaje, Rozměry..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            list="section-suggestions-local"
          />
          {existingSections.length > 0 && (
            <datalist id="section-suggestions-local">
              {existingSections.map((s) => <option key={s} value={s} />)}
            </datalist>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/[0.06] rounded-xl transition">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
            {saving ? 'Vytváří se...' : 'Přidat pole'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
