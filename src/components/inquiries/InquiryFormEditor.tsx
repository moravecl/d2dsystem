import { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { FormField, FormSettings, FormType } from '../../pages/admin/InquiryFormsPage';
import InquiryFormPreview from './InquiryFormPreview';

interface Props {
  form: {
    id: string;
    name: string;
    description: string;
    form_type: FormType;
    fields: FormField[];
    settings: FormSettings;
  } | null;
  onSave: () => void;
  onCancel: () => void;
}

const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'E-mail' },
  { value: 'tel', label: 'Telefon' },
  { value: 'textarea', label: 'Dlouhý text' },
  { value: 'number', label: 'Číslo' },
  { value: 'select', label: 'Výběr (1 možnost)' },
  { value: 'multiselect', label: 'Vícenásobný výběr' },
  { value: 'file', label: 'Soubor' },
];

const DEFAULT_FIELDS: FormField[] = [
  { key: 'name', label: 'Jméno a příjmení', type: 'text', required: true },
  { key: 'email', label: 'E-mail', type: 'email', required: true },
  { key: 'phone', label: 'Telefon', type: 'tel', required: false },
  { key: 'message', label: 'Zpráva', type: 'textarea', required: false },
];

const DEFAULT_SETTINGS: FormSettings = {
  primary_color: '#2563eb',
  success_message: 'Děkujeme za Vaši poptávku! Brzy se Vám ozveme.',
  submit_label: 'Odeslat poptávku',
  title: 'Poptávkový formulář',
  description: '',
};

export default function InquiryFormEditor({ form, onSave, onCancel }: Props) {
  const [name, setName] = useState(form?.name ?? '');
  const [description, setDescription] = useState(form?.description ?? '');
  const [formType, setFormType] = useState<FormType>(form?.form_type ?? 'inquiry');
  const [fields, setFields] = useState<FormField[]>(form?.fields ?? DEFAULT_FIELDS);
  const [settings, setSettings] = useState<FormSettings>(form?.settings ?? DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const addField = () => {
    setFields([
      ...fields,
      {
        key: `field_${Date.now()}`,
        label: '',
        type: 'text',
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const newFields = [...fields];
    const target = index + dir;
    if (target < 0 || target >= newFields.length) return;
    [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast('Zadejte název formuláře', 'error');
      return;
    }
    if (fields.length === 0) {
      toast('Přidejte alespoň jedno pole', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      form_type: formType,
      fields,
      settings,
      updated_at: new Date().toISOString(),
    };

    if (form) {
      const { error } = await supabase
        .from('inquiry_forms')
        .update(payload)
        .eq('id', form.id);
      if (error) {
        toast('Chyba při ukládání', 'error');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('inquiry_forms').insert(payload);
      if (error) {
        toast('Chyba při vytváření', 'error');
        setSaving(false);
        return;
      }
    }

    toast(form ? 'Formulář uložen' : 'Formulář vytvořen', 'success');
    setSaving(false);
    onSave();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-white/[0.06] transition text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-extrabold text-white">
          {form ? 'Upravit formulář' : 'Nový formulář'}
        </h1>
        <div className="flex-1" />
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:bg-white/[0.06] transition"
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Skrýt náhled' : 'Náhled'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? 'Ukládám...' : 'Uložit'}
        </button>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-6">
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Základní údaje</h2>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Název formuláře *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="např. Poptávka na realizaci"
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Interní popis</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nepovinný interní popis"
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Typ formuláře *</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormType('inquiry')}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-bold transition ${
                    formType === 'inquiry'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-white/10 text-slate-500 hover:border-white/[0.12]'
                  }`}
                >
                  <div className="text-base mb-0.5">Poptávka</div>
                  <div className="text-[11px] font-medium opacity-70">Data se uloží do Leadů</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('service')}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-bold transition ${
                    formType === 'service'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-white/10 text-slate-500 hover:border-white/[0.12]'
                  }`}
                >
                  <div className="text-base mb-0.5">Servis</div>
                  <div className="text-[11px] font-medium opacity-70">Data se uloží jako servisní tiket</div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Pole formuláře</h2>
              <button
                onClick={addField}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Přidat pole
              </button>
            </div>

            {fields.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">
                Zatím žádná pole. Klikněte na "Přidat pole".
              </p>
            )}

            <div className="space-y-2">
              {fields.map((field, i) => (
                <div
                  key={field.key}
                  className="border border-slate-150 rounded-lg p-3 bg-white/[0.04]"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5 pt-1">
                      <button
                        onClick={() => moveField(i, -1)}
                        disabled={i === 0}
                        className="p-0.5 text-slate-300 hover:text-slate-400 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveField(i, 1)}
                        disabled={i === fields.length - 1}
                        className="p-0.5 text-slate-300 hover:text-slate-400 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        value={field.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        placeholder="Název pole"
                        className="px-2.5 py-2 border border-white/10 rounded-lg text-sm sm:col-span-1"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField(i, { type: e.target.value as FormField['type'] })
                        }
                        className="px-2.5 py-2 border border-white/10 rounded-lg text-sm bg-white/[0.06]"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(i, { required: e.target.checked })}
                            className="rounded border-slate-300"
                          />
                          Povinné
                        </label>
                        <button
                          onClick={() => removeField(i)}
                          className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {(field.type === 'select' || field.type === 'multiselect') && (
                    <div className="mt-2 ml-7">
                      <input
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          updateField(i, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Možnosti oddělené čárkou, např. Ano, Ne, Nevím"
                        className="w-full px-2.5 py-1.5 border border-white/10 rounded-lg text-xs"
                      />
                      {field.type === 'multiselect' && (
                        <p className="text-[10px] text-slate-500 mt-1">Uživatel může vybrat více možností najednou</p>
                      )}
                    </div>
                  )}
                  {field.type === 'file' && (
                    <div className="mt-2 ml-7 flex gap-2">
                      <input
                        value={field.accept || ''}
                        onChange={(e) => updateField(i, { accept: e.target.value })}
                        placeholder="Povolené typy, např. .pdf,.jpg,.png"
                        className="flex-1 px-2.5 py-1.5 border border-white/10 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        value={field.maxSizeMB ?? 10}
                        onChange={(e) => updateField(i, { maxSizeMB: Number(e.target.value) || 10 })}
                        min={1}
                        max={50}
                        className="w-24 px-2.5 py-1.5 border border-white/10 rounded-lg text-xs"
                        title="Max. velikost v MB"
                      />
                      <span className="text-[10px] text-slate-400 self-center">MB max</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Nastavení vzhledu</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Nadpis formuláře</label>
                <input
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Popis (nepovinné)</label>
                <input
                  value={settings.description || ''}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Text tlačítka</label>
                <input
                  value={settings.submit_label}
                  onChange={(e) => setSettings({ ...settings, submit_label: e.target.value })}
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Barva</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer"
                  />
                  <input
                    value={settings.primary_color}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    className="flex-1 px-3 py-2.5 border border-white/10 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Zpráva po odeslání
              </label>
              <textarea
                value={settings.success_message}
                onChange={(e) => setSettings({ ...settings, success_message: e.target.value })}
                rows={2}
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {showPreview && (
          <div className="sticky top-6">
            <div className="bg-white/[0.06] rounded-xl p-6 border border-white/10">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                Náhled formuláře
              </div>
              <InquiryFormPreview fields={fields} settings={settings} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
