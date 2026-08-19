import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import type { FormField, FormSettings } from '../../pages/admin/InquiryFormsPage';

interface Props {
  form: {
    id: string;
    name: string;
    fields: FormField[];
    settings: FormSettings;
  };
  onClose: () => void;
}

function buildEmbedScript(form: Props['form']) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasFileFields = form.fields.some((f) => f.type === 'file');

  return `<!-- HouseSmart Form: ${form.name} -->
<div id="hs-inquiry-${form.id}"></div>
<script>
(function() {
  var formId = "${form.id}";
  var apiUrl = "${supabaseUrl}/functions/v1/submit-inquiry";
  var storageUrl = "${supabaseUrl}/storage/v1/object/form-uploads";
  var apiKey = "${supabaseAnonKey}";
  var fields = ${JSON.stringify(form.fields)};
  var settings = ${JSON.stringify(form.settings)};

  var container = document.getElementById("hs-inquiry-" + formId);
  if (!container) return;

  var style = document.createElement("style");
  style.textContent = \`
    .hs-form { font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; }
    .hs-form-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; }
    .hs-form-header { padding: 24px 24px 16px; border-bottom: 3px solid \${settings.primary_color}; }
    .hs-form-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
    .hs-form-header p { margin: 6px 0 0; font-size: 14px; color: #64748b; }
    .hs-form-body { padding: 24px; }
    .hs-form-group { margin-bottom: 16px; }
    .hs-form-label { display: block; font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 4px; }
    .hs-form-required { color: #ef4444; margin-left: 2px; }
    .hs-form-input, .hs-form-textarea, .hs-form-select {
      width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; color: #0f172a; background: #fff; box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s; outline: none; font-family: inherit;
    }
    .hs-form-input:focus, .hs-form-textarea:focus, .hs-form-select:focus {
      border-color: \${settings.primary_color}; box-shadow: 0 0 0 3px \${settings.primary_color}33;
    }
    .hs-form-textarea { min-height: 80px; resize: vertical; }
    .hs-form-file-zone {
      border: 2px dashed #e2e8f0; border-radius: 8px; padding: 20px; text-align: center;
      cursor: pointer; transition: border-color 0.2s, background 0.2s; position: relative;
    }
    .hs-form-file-zone:hover, .hs-form-file-zone.dragover { border-color: \${settings.primary_color}; background: \${settings.primary_color}08; }
    .hs-form-file-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .hs-form-file-zone .hs-file-icon { width: 24px; height: 24px; margin: 0 auto 6px; color: #94a3b8; }
    .hs-form-file-zone .hs-file-text { font-size: 13px; color: #64748b; }
    .hs-form-file-zone .hs-file-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .hs-form-file-name { font-size: 12px; color: #334155; margin-top: 8px; padding: 6px 10px; background: #f8fafc; border-radius: 6px; display: none; align-items: center; gap: 6px; }
    .hs-form-file-name.visible { display: flex; }
    .hs-form-file-remove { color: #ef4444; cursor: pointer; margin-left: auto; font-weight: 700; font-size: 14px; border: none; background: none; padding: 0 4px; }
    .hs-form-btn {
      width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 14px;
      font-weight: 700; color: #fff; cursor: pointer; transition: opacity 0.2s;
      background: \${settings.primary_color}; font-family: inherit;
    }
    .hs-form-btn:hover { opacity: 0.9; }
    .hs-form-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .hs-form-success { text-align: center; padding: 40px 24px; }
    .hs-form-success svg { margin: 0 auto 12px; }
    .hs-form-success p { font-size: 15px; color: #334155; font-weight: 500; margin: 0; }
  \`;
  container.appendChild(style);

  var wrapper = document.createElement("div");
  wrapper.className = "hs-form";

  var html = '<div class="hs-form-card">';
  html += '<div class="hs-form-header"><h2>' + (settings.title || "Formulář") + '</h2>';
  if (settings.description) html += '<p>' + settings.description + '</p>';
  html += '</div>';
  html += '<form class="hs-form-body" id="hs-form-' + formId + '">';

  fields.forEach(function(f) {
    html += '<div class="hs-form-group">';
    html += '<label class="hs-form-label">' + f.label;
    if (f.required) html += '<span class="hs-form-required">*</span>';
    html += '</label>';
    if (f.type === "textarea") {
      html += '<textarea class="hs-form-textarea" name="' + f.key + '"' + (f.required ? ' required' : '') + ' placeholder="' + (f.placeholder || f.label) + '"></textarea>';
    } else if (f.type === "select") {
      html += '<select class="hs-form-select" name="' + f.key + '"' + (f.required ? ' required' : '') + '><option value="">Vyberte...</option>';
      (f.options || []).forEach(function(o) { html += '<option value="' + o + '">' + o + '</option>'; });
      html += '</select>';
    } else if (f.type === "file") {
      var accept = f.accept ? ' accept="' + f.accept + '"' : '';
      var maxMB = f.maxSizeMB || 10;
      html += '<div class="hs-form-file-zone" data-key="' + f.key + '">';
      html += '<input type="file" name="' + f.key + '"' + accept + ' data-max-mb="' + maxMB + '"' + (f.required ? ' required' : '') + ' />';
      html += '<svg class="hs-file-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>';
      html += '<div class="hs-file-text">Klikněte nebo přetáhněte soubor</div>';
      if (f.accept) html += '<div class="hs-file-hint">' + f.accept + ' | max ' + maxMB + ' MB</div>';
      html += '</div>';
      html += '<div class="hs-form-file-name" id="hs-fname-' + f.key + '"><span></span><button type="button" class="hs-form-file-remove">&times;</button></div>';
    } else {
      html += '<input class="hs-form-input" type="' + f.type + '" name="' + f.key + '"' + (f.required ? ' required' : '') + ' placeholder="' + (f.placeholder || f.label) + '" />';
    }
    html += '</div>';
  });

  html += '<button type="submit" class="hs-form-btn">' + (settings.submit_label || "Odeslat") + '</button>';
  html += '</form></div>';

  wrapper.innerHTML = html;
  container.appendChild(wrapper);

  var formEl = document.getElementById("hs-form-" + formId);
${hasFileFields ? `
  var fileFields = fields.filter(function(f) { return f.type === "file"; });
  fileFields.forEach(function(f) {
    var zone = formEl.querySelector('.hs-form-file-zone[data-key="' + f.key + '"]');
    var input = zone.querySelector('input[type=file]');
    var nameEl = document.getElementById("hs-fname-" + f.key);
    ["dragover","dragenter"].forEach(function(ev) {
      zone.addEventListener(ev, function(e) { e.preventDefault(); zone.classList.add("dragover"); });
    });
    ["dragleave","drop"].forEach(function(ev) {
      zone.addEventListener(ev, function() { zone.classList.remove("dragover"); });
    });
    input.addEventListener("change", function() {
      if (input.files && input.files[0]) {
        var file = input.files[0];
        var maxBytes = (parseInt(input.getAttribute("data-max-mb")) || 10) * 1024 * 1024;
        if (file.size > maxBytes) {
          alert("Soubor je příliš velký. Maximální velikost: " + input.getAttribute("data-max-mb") + " MB");
          input.value = "";
          nameEl.classList.remove("visible");
          return;
        }
        nameEl.querySelector("span").textContent = file.name;
        nameEl.classList.add("visible");
      } else {
        nameEl.classList.remove("visible");
      }
    });
    nameEl.querySelector(".hs-form-file-remove").addEventListener("click", function() {
      input.value = "";
      nameEl.classList.remove("visible");
    });
  });

  function uploadFile(file, fieldKey) {
    var ts = Date.now();
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    var path = formId + "/" + ts + "_" + safeName;
    return fetch(storageUrl + "/" + path, {
      method: "POST",
      headers: { "apikey": apiKey, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
      body: file
    }).then(function(res) {
      if (!res.ok) throw new Error("Upload failed");
      return storageUrl + "/" + path;
    });
  }
` : ''}
  formEl.addEventListener("submit", function(e) {
    e.preventDefault();
    var btn = formEl.querySelector(".hs-form-btn");
    btn.disabled = true;
    btn.textContent = "Odesílám...";

    var data = {};
    fields.forEach(function(f) {
      if (f.type === "file") return;
      var el = formEl.querySelector('[name="' + f.key + '"]');
      if (el) data[f.key] = el.value;
    });

    var uploadPromises = [];
    var fileUrls = {};
${hasFileFields ? `
    fileFields.forEach(function(f) {
      var input = formEl.querySelector('input[name="' + f.key + '"]');
      if (input && input.files && input.files[0]) {
        uploadPromises.push(
          uploadFile(input.files[0], f.key).then(function(url) { fileUrls[f.key] = url; })
        );
      }
    });
` : ''}
    Promise.all(uploadPromises).then(function() {
      return fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apiKey },
        body: JSON.stringify({ form_id: formId, data: data, file_urls: fileUrls })
      });
    })
    .then(function(res) {
      if (!res.ok) throw new Error("Submit failed");
      var card = wrapper.querySelector(".hs-form-card");
      card.innerHTML = '<div class="hs-form-success">' +
        '<svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="' + settings.primary_color + '" stroke-width="2"/><path d="M8 12l2.5 2.5L16 9" stroke="' + settings.primary_color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<p>' + (settings.success_message || "Děkujeme!") + '</p></div>';
    })
    .catch(function() {
      btn.disabled = false;
      btn.textContent = settings.submit_label || "Odeslat";
      alert("Nepodařilo se odeslat formulář. Zkuste to prosím znovu.");
    });
  });
})();
</script>`;
}

export default function EmbedScriptModal({ form, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const embedScript = buildEmbedScript(form);

  const handleCopy = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open onClose={onClose} title="Kód pro vložení na web" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Zkopírujte tento kód a vložte ho na svou webovou stránku tam, kde chcete zobrazit
          formulář.
        </p>

        <div className="relative">
          <pre className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto font-mono">
            {embedScript}
          </pre>
          <button
            onClick={handleCopy}
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Zkopírováno
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Kopírovat
              </>
            )}
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium">
            Formulář funguje na libovolné webové stránce. Stačí vložit kód do HTML a formulář se
            automaticky vykreslí a odesílá data do vašeho systému.
          </p>
        </div>
      </div>
    </Modal>
  );
}
