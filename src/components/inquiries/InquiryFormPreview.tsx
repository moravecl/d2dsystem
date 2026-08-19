import { Upload } from 'lucide-react';
import type { FormField, FormSettings } from '../../pages/admin/InquiryFormsPage';

interface Props {
  fields: FormField[];
  settings: FormSettings;
}

export default function InquiryFormPreview({ fields, settings }: Props) {
  return (
    <div
      className="bg-navy-800/60 rounded-xl shadow-lg border border-white/10 overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="px-6 pt-6 pb-4" style={{ borderBottom: `3px solid ${settings.primary_color}` }}>
        <h2 className="text-lg font-bold text-white">{settings.title || 'Formulář'}</h2>
        {settings.description && (
          <p className="text-sm text-slate-500 mt-1">{settings.description}</p>
        )}
      </div>
      <div className="p-6 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
              {field.label || 'Bez názvu'}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                disabled
                placeholder={field.placeholder || field.label}
                rows={3}
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm bg-white/[0.04]"
              />
            ) : field.type === 'select' ? (
              <select
                disabled
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm bg-white/[0.04] text-slate-400"
              >
                <option>Vyberte...</option>
                {(field.options || []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : field.type === 'multiselect' ? (
              <div className="flex flex-wrap gap-2">
                {(field.options || []).length === 0 ? (
                  <span className="text-xs text-slate-500 italic">Zatím žádné možnosti</span>
                ) : (
                  (field.options || []).map((o) => (
                    <label
                      key={o}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 rounded-lg text-sm bg-white/[0.04] text-slate-400 cursor-not-allowed select-none"
                    >
                      <input type="checkbox" disabled className="rounded border-slate-600 w-3.5 h-3.5" />
                      {o}
                    </label>
                  ))
                )}
              </div>
            ) : field.type === 'file' ? (
              <div className="border-2 border-dashed border-white/10 rounded-lg p-4 text-center bg-white/[0.04]">
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500">
                  Klikněte nebo přetáhněte soubor
                  {field.accept && (
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {field.accept} | max {field.maxSizeMB ?? 10} MB
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <input
                disabled
                type={field.type}
                placeholder={field.placeholder || field.label}
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm bg-white/[0.04]"
              />
            )}
          </div>
        ))}
        <button
          disabled
          className="w-full py-3 rounded-lg text-white font-bold text-sm transition"
          style={{ backgroundColor: settings.primary_color }}
        >
          {settings.submit_label || 'Odeslat'}
        </button>
      </div>
    </div>
  );
}
