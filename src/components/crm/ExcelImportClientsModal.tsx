import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, X, Download, TableProperties } from 'lucide-react';
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
  street: string;
  zip: string;
  note: string;
  _valid: boolean;
  _errors: string[];
  _raw: Record<string, string>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const COL_MAP: { headers: string[]; field: keyof ParsedClient; label: string }[] = [
  {
    headers: ['název', 'nazev', 'firma / osoba', 'firma/osoba', 'fakturační název', 'fakturacni nazev', 'jméno', 'jmeno', 'name', 'company', 'klient'],
    field: 'name',
    label: 'Název',
  },
  {
    headers: ['hlavní kontakt - email', 'hlavni kontakt - email', 'kontakt 2 - email', 'email', 'e-mail', 'mail'],
    field: 'email',
    label: 'Email',
  },
  {
    headers: [
      'hlavní kontakt - telefon 1', 'hlavni kontakt - telefon 1',
      'hlavní kontakt - telefon 2', 'hlavni kontakt - telefon 2',
      'kontakt 2 - telefon 1',
      'telefon', 'phone', 'mobil', 'mobile', 'tel',
    ],
    field: 'phone',
    label: 'Telefon',
  },
  {
    headers: ['fakturační adresa - město', 'fakturacni adresa - mesto', 'město', 'mesto', 'city', 'obec'],
    field: 'city',
    label: 'Město',
  },
  {
    headers: ['fakturační adresa - ulice', 'fakturacni adresa - ulice', 'ulice', 'street', 'adresa'],
    field: 'street',
    label: 'Ulice',
  },
  {
    headers: ['fakturační adresa - psč', 'fakturacni adresa - psc', 'psč', 'psc', 'zip', 'postal'],
    field: 'zip',
    label: 'PSČ',
  },
  {
    headers: ['ič', 'ic', 'ico', 'ičo', 'registration_number'],
    field: 'ico',
    label: 'IČO',
  },
  {
    headers: ['dič', 'dic', 'dič', 'vat', 'vat_number'],
    field: 'dic',
    label: 'DIČ',
  },
  {
    headers: ['typ', 'type', 'podtyp', 'client_type'],
    field: 'client_type',
    label: 'Typ',
  },
  {
    headers: ['poznámka', 'poznamka', 'note', 'notes'],
    field: 'note',
    label: 'Poznámka',
  },
];

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeClientType(raw: string): 'rd' | 'firma' | 'obec' {
  const v = raw.toLowerCase().trim();
  if (['firma', 'company', 'business', 's.r.o.', 'a.s.', 'spol', 'ltd', 'inc', 'právnická'].some(x => v.includes(x))) return 'firma';
  if (['obec', 'mestys', 'město', 'mesto', 'municipality', 'town', 'city', 'úřad'].some(x => v.includes(x))) return 'obec';
  return 'rd';
}

function buildColumnIndex(headerRow: string[]): Map<keyof ParsedClient, number> {
  const index = new Map<keyof ParsedClient, number>();
  headerRow.forEach((h, colIdx) => {
    const normalized = normalizeHeader(String(h ?? ''));
    for (const mapping of COL_MAP) {
      if (index.has(mapping.field)) continue;
      if (mapping.headers.some(mh => normalizeHeader(mh) === normalized)) {
        index.set(mapping.field, colIdx);
      }
    }
  });
  return index;
}

function parseExcel(buffer: ArrayBuffer): ParsedClient[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  if (rows.length < 2) return [];

  const headerRow = rows[0].map(c => String(c ?? ''));
  const colIndex = buildColumnIndex(headerRow);

  const getVal = (row: string[], field: keyof ParsedClient): string => {
    const idx = colIndex.get(field);
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  return rows.slice(1).map((row): ParsedClient => {
    const raw: Record<string, string> = {};
    headerRow.forEach((h, i) => {
      if (h) raw[h] = String(row[i] ?? '');
    });

    const name = getVal(row, 'name');
    const email = getVal(row, 'email');
    const phone = getVal(row, 'phone');
    const city = getVal(row, 'city');
    const street = getVal(row, 'street');
    const zip = getVal(row, 'zip');
    const ico = getVal(row, 'ico');
    const dic = getVal(row, 'dic');
    const note = getVal(row, 'note');
    const typeRaw = getVal(row, 'client_type');
    const client_type = typeRaw ? normalizeClientType(typeRaw) : (ico ? 'firma' : 'rd');

    const warnings: string[] = [];
    if (!name) warnings.push('Chybí název');
    if (!email && !phone) warnings.push('Chybí email i telefon');

    return {
      name,
      email,
      phone,
      client_type,
      city,
      street,
      zip,
      ico,
      dic,
      note,
      _valid: true,
      _errors: warnings,
      _raw: raw,
    };
  }).filter(c => c.name || c.email || c.phone);
}

const EXAMPLE_HEADERS = [
  'Název', 'Fakturační adresa - ulice', 'Fakturační adresa - PSČ', 'Fakturační adresa - město',
  'IČ', 'DIČ', 'Typ', 'Poznámka',
  'Hlavní kontakt - jméno', 'Hlavní kontakt - příjmení', 'Hlavní kontakt - email', 'Hlavní kontakt - telefon 1',
];
const EXAMPLE_ROWS = [
  ['Jan Novák', 'Náměstí 1', '10000', 'Praha', '', '', 'fyzická', '', 'Jan', 'Novák', 'jan.novak@email.cz', '777 000 111'],
  ['ACME s.r.o.', 'Průmyslová 5', '60200', 'Brno', '12345678', 'CZ12345678', 'firma', 'VIP klient', 'Pavel', 'Dvořák', 'pavel@acme.cz', '602 111 222'],
];

function downloadExample() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([EXAMPLE_HEADERS, ...EXAMPLE_ROWS]);
  XLSX.utils.book_append_sheet(wb, ws, 'Klienti');
  XLSX.writeFile(wb, 'klienti_vzor.xlsx');
}

export default function ExcelImportClientsModal({ open, onClose, onImported }: Props) {
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
    const allowed = ['.xlsx', '.xls', '.csv', '.ods'];
    const ok = allowed.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!ok) {
      toast('Vyberte soubor Excel (.xlsx, .xls) nebo CSV', 'error');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const clients = parseExcel(buffer);
        if (clients.length === 0) {
          toast('Soubor neobsahuje žádné klienty nebo se nepodařilo rozpoznat sloupce', 'error');
          return;
        }
        setParsed(clients);
        setSelected(new Set(clients.map((_, i) => i)));
        setStep('preview');
      } catch (err: any) {
        toast(err.message || 'Chyba při zpracování souboru', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
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
    if (selected.size === parsed.length) setSelected(new Set());
    else setSelected(new Set(parsed.map((_, i) => i)));
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
        if (data) await logAudit('client', data.id, 'created', { name: client.name, source: 'excel_import' });
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
    setStep('done');
    if (success > 0) onImported();
  };

  const warningCount = parsed.filter(c => c._errors.length > 0).length;
  const selectedArray = [...selected];

  const clientTypeLabels = { rd: 'RD', firma: 'Firma', obec: 'Obec' };
  const clientTypeColors = {
    rd: 'bg-blue-500/10 text-blue-400 border-blue-200',
    firma: 'bg-amber-500/10 text-amber-400 border-amber-200',
    obec: 'bg-emerald-500/10 text-emerald-400 border-emerald-200',
  };

  const DISPLAYED_FIELDS: { field: keyof ParsedClient; label: string }[] = [
    { field: 'name', label: 'Název' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Telefon' },
    { field: 'city', label: 'Město' },
    { field: 'street', label: 'Ulice' },
    { field: 'zip', label: 'PSČ' },
    { field: 'ico', label: 'IČO' },
    { field: 'dic', label: 'DIČ' },
    { field: 'note', label: 'Poznámka' },
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import klientů z Excelu"
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
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" onChange={handleFileChange} className="hidden" />
            <TableProperties className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragOver ? 'text-blue-500' : 'text-slate-300'}`} />
            <p className="text-sm font-semibold text-slate-300 mb-1">Přetáhněte Excel soubor sem</p>
            <p className="text-xs text-slate-400">nebo klikněte pro výběr souboru</p>
            <p className="text-xs text-slate-300 mt-2">Podporované formáty: .xlsx, .xls, .csv, .ods</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 mb-1">Rozpoznávané sloupce</p>
                <p className="text-xs text-slate-500 mb-3">
                  Systém automaticky rozpozná sloupce podle jejich názvu. Podporované jsou exporty z Fakturoid, Money S3 a podobných systémů.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {[
                    { label: 'Název', tags: 'Název, Firma / osoba, Fakturační název' },
                    { label: 'Email', tags: 'Hlavní kontakt - email' },
                    { label: 'Telefon', tags: 'Hlavní kontakt - telefon 1, Telefon' },
                    { label: 'Město', tags: 'Fakturační adresa - město, Město' },
                    { label: 'IČO', tags: 'IČ, IČO, IC' },
                    { label: 'DIČ', tags: 'DIČ, DIC, VAT' },
                    { label: 'Ulice', tags: 'Fakturační adresa - ulice' },
                    { label: 'PSČ', tags: 'Fakturační adresa - PSČ' },
                  ].map(f => (
                    <div key={f.label} className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-slate-400 w-16 shrink-0">{f.label}:</span>
                      <span className="text-slate-400 font-mono text-[10px] leading-relaxed">{f.tags}</span>
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
              {parsed.length} nalezeno
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-200 rounded-lg text-xs font-semibold text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {warningCount} s upozorněním
              </div>
            )}
          </div>

          {warningCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-200 rounded-xl text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>Záznamy s upozorněním lze stále importovat. Chybějící údaje bude možné doplnit v detailu klienta.</span>
            </div>
          )}

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-white/[0.04] border-b border-white/10 px-4 py-2.5 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === parsed.length && parsed.length > 0}
                onChange={toggleAll}
                className="rounded border-slate-300 text-blue-400"
              />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1">Klient</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 text-center hidden sm:block">Typ</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-8"></span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {parsed.map((client, i) => (
                <div key={i} className={`${client._errors.length > 0 ? 'bg-amber-500/10' : ''}`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      className="rounded border-slate-300 text-blue-400"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {client.name || <span className="italic text-slate-400">bez jména</span>}
                        </span>
                        {client._errors.map((err, ei) => (
                          <span key={ei} className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <AlertCircle className="w-2.5 h-2.5" />
                            {err}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {client.email && <span className="text-xs text-slate-400">{client.email}</span>}
                        {client.phone && <span className="text-xs text-slate-400">{client.phone}</span>}
                        {client.city && <span className="text-xs text-slate-400">{client.city}</span>}
                        {client.ico && <span className="text-xs text-slate-400">IČO: {client.ico}</span>}
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
                        {DISPLAYED_FIELDS.map(({ field, label }) => {
                          const val = client[field] as string;
                          if (!val) return null;
                          return (
                            <div key={field} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 w-20 shrink-0">{label}:</span>
                              <span className="text-slate-400 truncate">{val}</span>
                            </div>
                          );
                        })}
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
