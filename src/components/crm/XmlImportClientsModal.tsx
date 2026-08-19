import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, X, Download } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';

interface ParsedClient {
  name: string;
  email: string;
  phone: string;
  client_type: 'rd' | 'firma' | 'obec';
  city: string;
  ico: string;
  dic: string;
  _valid: boolean;
  _errors: string[];
  _raw: Record<string, string>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const FIELD_MAP: { xmlTags: string[]; field: keyof ParsedClient; label: string }[] = [
  { xmlTags: ['name', 'jmeno', 'nazev', 'klient', 'firma', 'client', 'fullname', 'full_name', 'company'], field: 'name', label: 'Název' },
  { xmlTags: ['email', 'mail', 'e-mail', 'email_address'], field: 'email', label: 'Email' },
  { xmlTags: ['phone', 'telefon', 'tel', 'mobile', 'mobil', 'phone_number', 'mobilni_telefon', 'cell', 'cellphone', 'gsm', 'handphone'], field: 'phone', label: 'Telefon' },
  { xmlTags: ['city', 'mesto', 'obec', 'place'], field: 'city', label: 'Město' },
  { xmlTags: ['ico', 'ic', 'registration_number', 'reg_number', 'cin'], field: 'ico', label: 'IČO' },
  { xmlTags: ['dic', 'vat', 'vat_number', 'vat_id', 'tax_id'], field: 'dic', label: 'DIČ' },
  { xmlTags: ['type', 'typ', 'client_type', 'customer_type'], field: 'client_type', label: 'Typ' },
];

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function getTextContent(el: Element, tags: string[]): string {
  for (const tag of tags) {
    const child = el.querySelector(tag);
    if (child?.textContent?.trim()) return child.textContent.trim();
    const normalized = el.querySelector(`[data-field="${tag}"]`);
    if (normalized?.textContent?.trim()) return normalized.textContent.trim();
  }
  const allChildren = Array.from(el.children);
  for (const child of allChildren) {
    const childTag = normalizeTag(child.tagName);
    if (tags.some(t => normalizeTag(t) === childTag)) {
      if (child.textContent?.trim()) return child.textContent.trim();
    }
  }
  return '';
}

function normalizeClientType(raw: string): 'rd' | 'firma' | 'obec' {
  const v = raw.toLowerCase().trim();
  if (['firma', 'company', 'business', 's.r.o.', 'a.s.', 'spol', 'ltd', 'inc'].some(x => v.includes(x))) return 'firma';
  if (['obec', 'mestys', 'mesto', 'municipality', 'town', 'city'].some(x => v.includes(x))) return 'obec';
  return 'rd';
}

function parseXml(xmlString: string): ParsedClient[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Neplatný XML soubor');

  const clientNodes: Element[] = [];
  const candidates = ['client', 'klient', 'customer', 'zakaznik', 'contact', 'kontakt', 'record', 'item', 'row', 'entry'];
  for (const tag of candidates) {
    const found = Array.from(doc.querySelectorAll(tag));
    if (found.length > 0) {
      clientNodes.push(...found);
      break;
    }
  }

  if (clientNodes.length === 0) {
    const root = doc.documentElement;
    const firstLevelChildren = Array.from(root.children);
    if (firstLevelChildren.length > 0 && firstLevelChildren[0].children.length > 0) {
      clientNodes.push(...firstLevelChildren);
    } else if (root.children.length > 0) {
      clientNodes.push(root);
    }
  }

  return clientNodes.map((node): ParsedClient => {
    const raw: Record<string, string> = {};
    Array.from(node.children).forEach(child => {
      raw[child.tagName.toLowerCase()] = child.textContent?.trim() || '';
    });

    const name = getTextContent(node, FIELD_MAP[0].xmlTags);
    const email = getTextContent(node, FIELD_MAP[1].xmlTags);
    const phone = getTextContent(node, FIELD_MAP[2].xmlTags);
    const city = getTextContent(node, FIELD_MAP[3].xmlTags);
    const ico = getTextContent(node, FIELD_MAP[4].xmlTags);
    const dic = getTextContent(node, FIELD_MAP[5].xmlTags);
    const typeRaw = getTextContent(node, FIELD_MAP[6].xmlTags);
    const client_type = typeRaw ? normalizeClientType(typeRaw) : (ico ? 'firma' : 'rd');

    const errors: string[] = [];
    if (!name) errors.push('Chybí název');
    if (!email && !phone) errors.push('Chybí email nebo telefon');

    return {
      name: name || '',
      email: email || '',
      phone: phone || '',
      client_type,
      city: city || '',
      ico: ico || '',
      dic: dic || '',
      _valid: errors.length === 0,
      _errors: errors,
      _raw: raw,
    };
  }).filter(c => c.name || c.email || c.phone);
}

const EXAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<clients>
  <client>
    <name>Jan Novák</name>
    <email>jan.novak@email.cz</email>
    <phone>+420 123 456 789</phone>
    <city>Praha</city>
    <type>rd</type>
  </client>
  <client>
    <name>ACME s.r.o.</name>
    <email>info@acme.cz</email>
    <phone>+420 987 654 321</phone>
    <city>Brno</city>
    <ico>12345678</ico>
    <dic>CZ12345678</dic>
    <type>firma</type>
  </client>
</clients>`;

export default function XmlImportClientsModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsed, setParsed] = useState<ParsedClient[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleClose = () => {
    setStep('upload');
    setParsed([]);
    setSelected(new Set());
    setExpandedRow(null);
    setImporting(false);
    setImportResult(null);
    setFileName('');
    onClose();
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.xml') && file.type !== 'application/xml' && file.type !== 'text/xml') {
      toast('Vyberte XML soubor', 'error');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const clients = parseXml(content);
        if (clients.length === 0) {
          toast('XML neobsahuje žádné klienty', 'error');
          return;
        }
        setParsed(clients);
        setSelected(new Set(clients.map((_, i) => i).filter(i => clients[i]._valid)));
        setStep('preview');
      } catch (err: any) {
        toast(err.message || 'Chyba při zpracování XML', 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    const validIndices = parsed.map((_, i) => i).filter(i => parsed[i]._valid);
    if (selected.size === validIndices.length) setSelected(new Set());
    else setSelected(new Set(validIndices));
  };

  const handleImport = async () => {
    if (!user || selected.size === 0) return;
    setImporting(true);
    setStep('importing');

    let success = 0;
    let failed = 0;

    const toInsert = [...selected].map(i => parsed[i]).filter(c => c._valid);

    for (const client of toInsert) {
      const { data, error } = await supabase.from('clients').insert({
        user_id: user.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        client_type: client.client_type,
        city: client.city,
        ico: client.ico,
        dic: client.dic,
      }).select('id').maybeSingle();

      if (error) {
        failed++;
      } else {
        success++;
        if (data) await logAudit('client', data.id, 'created', { name: client.name, source: 'xml_import' });
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
    setStep('done');
    if (success > 0) onImported();
  };

  const downloadExample = () => {
    const blob = new Blob([EXAMPLE_XML], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'klienti_vzor.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsed.filter(c => c._valid).length;
  const invalidCount = parsed.length - validCount;
  const selectedArray = [...selected];

  const clientTypeLabels = { rd: 'RD', firma: 'Firma', obec: 'Obec' };
  const clientTypeColors = {
    rd: 'bg-blue-500/10 text-blue-400 border-blue-200',
    firma: 'bg-amber-500/10 text-amber-400 border-amber-200',
    obec: 'bg-emerald-500/10 text-emerald-400 border-emerald-200',
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import klientů z XML"
      size="lg"
      footer={
        step === 'preview' ? (
          <>
            <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition">
              Zpět
            </button>
            <button
              onClick={handleImport}
              disabled={selectedArray.length === 0 || importing}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Importovat {selectedArray.length > 0 ? `(${selectedArray.length})` : ''}
            </button>
          </>
        ) : step === 'done' ? (
          <button onClick={handleClose} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
            Zavřít
          </button>
        ) : null
      }
    >
      {step === 'upload' && (
        <div className="space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-white/10 hover:border-white/[0.12] hover:bg-white/[0.04]'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xml,application/xml,text/xml" onChange={handleFileChange} className="hidden" />
            <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragOver ? 'text-blue-500' : 'text-slate-300'}`} />
            <p className="text-sm font-semibold text-slate-300 mb-1">Přetáhněte XML soubor sem</p>
            <p className="text-xs text-slate-400">nebo klikněte pro výběr souboru</p>
            <p className="text-xs text-slate-300 mt-2">Podporované formáty: .xml</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">Struktura XML souboru</p>
                <p className="text-xs text-slate-500 mb-3">
                  XML soubor musí obsahovat elementy klientů s podřízenými elementy. Podporované tagy pro každé pole:
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {FIELD_MAP.map(f => (
                    <div key={f.field} className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-400 w-16">{f.label}:</span>
                      <span className="text-slate-400 font-mono text-[10px]">{f.xmlTags.slice(0, 3).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); downloadExample(); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 bg-navy-800/60 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Vzorový soubor
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] rounded-lg text-xs font-semibold text-slate-300">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {fileName}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {validCount} platných
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-200 rounded-lg text-xs font-semibold text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {invalidCount} neplatných
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-white/[0.04] border-b border-white/10 px-4 py-2.5 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === validCount && validCount > 0}
                onChange={toggleAll}
                className="rounded border-slate-300 text-blue-400"
              />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1">Klient</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 text-center hidden sm:block">Typ</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-8"></span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {parsed.map((client, i) => (
                <div key={i} className={`${!client._valid ? 'bg-red-500/10' : ''}`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      disabled={!client._valid}
                      className="rounded border-slate-300 text-blue-400 disabled:opacity-40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${!client._valid ? 'text-slate-400' : 'text-white'}`}>
                          {client.name || <span className="italic text-slate-400">bez jména</span>}
                        </span>
                        {!client._valid && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-200 px-1.5 py-0.5 rounded-full">
                            <AlertCircle className="w-2.5 h-2.5" />
                            {client._errors[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {client.email && <span className="text-xs text-slate-400">{client.email}</span>}
                        {client.phone && <span className="text-xs text-slate-400">{client.phone}</span>}
                        {client.city && <span className="text-xs text-slate-400">{client.city}</span>}
                      </div>
                    </div>
                    <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${clientTypeColors[client.client_type]}`}>
                      {clientTypeLabels[client.client_type]}
                    </span>
                    <button
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      className="p-1 rounded hover:bg-white/[0.06] text-slate-400 transition"
                    >
                      {expandedRow === i ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {expandedRow === i && (
                    <div className="px-4 pb-3 ml-8">
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 grid grid-cols-2 gap-x-6 gap-y-1">
                        {Object.entries(client._raw).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-slate-400 w-20 shrink-0">{key}:</span>
                            <span className="text-slate-400 truncate">{val || '–'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedArray.length > 0 && (
            <p className="text-xs text-slate-500 text-right">
              Vybráno <span className="font-bold text-slate-300">{selectedArray.length}</span> klientů k importu
            </p>
          )}
        </div>
      )}

      {step === 'importing' && (
        <div className="py-16 text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-300">Importuji klienty...</p>
          <p className="text-xs text-slate-400 mt-1">Prosím čekejte</p>
        </div>
      )}

      {step === 'done' && importResult && (
        <div className="py-12 text-center space-y-4">
          {importResult.success > 0 ? (
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          ) : (
            <X className="w-12 h-12 text-red-400 mx-auto" />
          )}
          <div>
            <p className="text-lg font-bold text-white">Import dokončen</p>
            <p className="text-sm text-slate-500 mt-1">
              {importResult.success > 0 && (
                <span className="text-emerald-400 font-semibold">{importResult.success} klientů úspěšně importováno</span>
              )}
              {importResult.success > 0 && importResult.failed > 0 && ' · '}
              {importResult.failed > 0 && (
                <span className="text-red-400 font-semibold">{importResult.failed} selhalo</span>
              )}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
