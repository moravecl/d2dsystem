import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/Toast';
import type { BankAccount, ParsedBankRow } from '../../../types/bank';

interface Props {
  accounts: BankAccount[];
  onClose: () => void;
  onImported: () => void;
}

const COLUMN_HINTS: { key: keyof ParsedBankRow; labels: string[] }[] = [
  { key: 'date', labels: ['datum', 'date', 'dátum', 'datum pohybu'] },
  { key: 'amount', labels: ['částka', 'castka', 'amount', 'objem', 'čiastka'] },
  { key: 'type', labels: ['typ', 'type', 'smer', 'směr'] },
  { key: 'description', labels: ['zpráva', 'popis', 'description', 'název', 'detaily'] },
  { key: 'counterparty_name', labels: ['název protistrany', 'protistrana', 'counterparty', 'jméno'] },
  { key: 'counterparty_account', labels: ['číslo účtu', 'protiúčet', 'account', 'iban'] },
  { key: 'vs', labels: ['vs', 'variabilní symbol', 'variable symbol', 'var. symbol'] },
  { key: 'ks', labels: ['ks', 'konstantní symbol', 'constant symbol'] },
  { key: 'ss', labels: ['ss', 'specifický symbol', 'specific symbol'] },
  { key: 'reference', labels: ['reference', 'referenční číslo', 'ref.'] },
];

function detectColumn(headers: string[], labels: string[]): number {
  for (const h of headers) {
    const lh = h.toLowerCase().trim();
    if (labels.some(l => lh.includes(l))) {
      return headers.indexOf(h);
    }
  }
  return -1;
}

function parseAmount(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-+]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

function parseDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${d.y}-${m}-${day}`;
    }
  }
  if (typeof val === 'string') {
    const parts = val.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
    if (parts) {
      const [, d, m, y] = parts;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const iso = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return '';
}

export default function BankImportModal({ accounts, onClose, onImported }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts.find(a => a.is_default)?.id ?? accounts[0]?.id ?? '');
  const [rows, setRows] = useState<ParsedBankRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [colMap, setColMap] = useState<Record<keyof ParsedBankRow, number>>({} as Record<keyof ParsedBankRow, number>);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      if (!json.length) return;
      const hdrs = (json[0] as unknown[]).map(h => String(h));
      setHeaders(hdrs);
      setRawRows(json.slice(1) as unknown[][]);

      const detected: Record<string, number> = {};
      COLUMN_HINTS.forEach(({ key, labels }) => {
        const idx = detectColumn(hdrs, labels);
        if (idx >= 0) detected[key] = idx;
      });
      setColMap(detected as Record<keyof ParsedBankRow, number>);
      setStep('map');
    };
    reader.readAsArrayBuffer(file);
  };

  const buildRows = () => {
    const result: ParsedBankRow[] = [];
    for (const raw of rawRows) {
      const get = (key: keyof ParsedBankRow) => colMap[key] !== undefined ? raw[colMap[key]] : '';
      const dateStr = parseDate(get('date'));
      if (!dateStr) continue;
      const rawAmt = parseAmount(get('amount'));
      if (rawAmt === 0) continue;
      const typeVal = String(get('type') || '').toLowerCase();
      let type: 'credit' | 'debit' = rawAmt >= 0 ? 'credit' : 'debit';
      if (typeVal.includes('odch') || typeVal.includes('debit') || typeVal.includes('výdaj') || typeVal.includes('odeps')) type = 'debit';
      if (typeVal.includes('přich') || typeVal.includes('credit') || typeVal.includes('příjem') || typeVal.includes('přips')) type = 'credit';
      result.push({
        date: dateStr,
        amount: Math.abs(rawAmt),
        type,
        description: String(get('description') || ''),
        counterparty_name: String(get('counterparty_name') || ''),
        counterparty_account: String(get('counterparty_account') || ''),
        vs: String(get('vs') || ''),
        ks: String(get('ks') || ''),
        ss: String(get('ss') || ''),
        reference: String(get('reference') || ''),
        raw_note: '',
      });
    }
    setRows(result);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const batch = `import_${Date.now()}`;
    const toInsert = rows.map(r => ({
      account_id: selectedAccountId || null,
      date: r.date,
      amount: r.amount,
      type: r.type,
      description: r.description,
      counterparty_name: r.counterparty_name,
      counterparty_account: r.counterparty_account,
      vs: r.vs,
      ks: r.ks,
      ss: r.ss,
      reference: r.reference,
      raw_note: r.raw_note,
      status: 'new',
      import_batch: batch,
    }));

    const { error } = await supabase.from('bank_transactions').insert(toInsert);
    setImporting(false);
    if (error) {
      toast('Chyba při importu', 'error');
      return;
    }
    toast(`Importováno ${rows.length} pohybů`, 'success');
    onImported();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-white">Import výpisu z banky</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'upload' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Bankovní účet</label>
                <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50">
                  <option value="">— bez účtu —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.account_number})</option>)}
                </select>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/15 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/[0.04] transition-all group">
                <FileSpreadsheet className="w-10 h-10 text-slate-500 group-hover:text-blue-400 mx-auto mb-3 transition-colors" />
                <p className="text-slate-300 font-medium text-sm">Vyberte soubor Excel (.xlsx, .xls, .csv)</p>
                <p className="text-slate-500 text-xs mt-1">nebo přetáhněte soubor sem</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-300 space-y-1">
                <p className="font-medium text-blue-200">Podporované formáty:</p>
                <p>FIO Banka, CSOB, KB, Raiffeisenbank, Moneta, UniCredit, Air Bank, Revolut, a další</p>
                <p className="text-blue-400">Systém automaticky rozpozná sloupce jako Datum, Částka, VS, KS, Protiúčet atd.</p>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Soubor načten: <strong>{fileName}</strong> — {rawRows.length} řádků</span>
              </div>

              <p className="text-slate-400 text-sm">Zkontrolujte mapování sloupců (automaticky rozpoznáno):</p>

              <div className="grid grid-cols-2 gap-3">
                {COLUMN_HINTS.map(({ key, labels: _ }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-400 mb-1 capitalize">{key.replace('_', ' ')}</label>
                    <select
                      value={colMap[key] !== undefined ? colMap[key] : -1}
                      onChange={e => setColMap(m => ({ ...m, [key]: parseInt(e.target.value) }))}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50">
                      <option value={-1}>— ignorovat —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Sloupec ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {colMap['date' as keyof ParsedBankRow] === undefined || colMap['amount' as keyof ParsedBankRow] === undefined ? (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Sloupce <strong>Datum</strong> a <strong>Částka</strong> jsou povinné</span>
                </div>
              ) : null}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Připraveno k importu: <strong>{rows.length} pohybů</strong></span>
                </div>
                <button
                  onClick={() => setShowPreview(p => !p)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                  {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showPreview ? 'Skrýt' : 'Zobrazit'} náhled
                </button>
              </div>

              {showPreview && (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/[0.04] text-slate-400">
                        <th className="px-3 py-2 text-left font-medium">Datum</th>
                        <th className="px-3 py-2 text-left font-medium">Typ</th>
                        <th className="px-3 py-2 text-right font-medium">Částka</th>
                        <th className="px-3 py-2 text-left font-medium">Popis</th>
                        <th className="px-3 py-2 text-left font-medium">Protistrana</th>
                        <th className="px-3 py-2 text-left font-medium">VS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 20).map((r, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="px-3 py-1.5 text-slate-300">{r.date}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.type === 'credit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {r.type === 'credit' ? 'Příjem' : 'Výdaj'}
                            </span>
                          </td>
                          <td className={`px-3 py-1.5 text-right font-medium ${r.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.type === 'credit' ? '+' : '-'}{r.amount.toLocaleString('cs-CZ')} Kč
                          </td>
                          <td className="px-3 py-1.5 text-slate-300 max-w-[180px] truncate">{r.description}</td>
                          <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate">{r.counterparty_name}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.vs}</td>
                        </tr>
                      ))}
                      {rows.length > 20 && (
                        <tr className="border-t border-white/5">
                          <td colSpan={6} className="px-3 py-2 text-center text-slate-500 text-[11px]">
                            ... a dalších {rows.length - 20} pohybů
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-4">
                <div className="flex-1 text-center">
                  <div className="text-emerald-400 font-bold text-lg">
                    +{rows.filter(r => r.type === 'credit').reduce((s, r) => s + r.amount, 0).toLocaleString('cs-CZ')} Kč
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5">Celkem příjmů ({rows.filter(r => r.type === 'credit').length})</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex-1 text-center">
                  <div className="text-red-400 font-bold text-lg">
                    -{rows.filter(r => r.type === 'debit').reduce((s, r) => s + r.amount, 0).toLocaleString('cs-CZ')} Kč
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5">Celkem výdajů ({rows.filter(r => r.type === 'debit').length})</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 shrink-0">
          <div>
            {step !== 'upload' && (
              <button onClick={() => setStep(step === 'preview' ? 'map' : 'upload')}
                className="text-sm text-slate-400 hover:text-white transition-colors">
                Zpět
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Zrušit</button>
            {step === 'map' && (
              <button onClick={buildRows}
                disabled={(colMap['date' as keyof ParsedBankRow] === undefined) || (colMap['amount' as keyof ParsedBankRow] === undefined)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                Pokračovat →
              </button>
            )}
            {step === 'preview' && (
              <button onClick={handleImport} disabled={importing || !rows.length}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                <Upload className="w-4 h-4" />
                {importing ? 'Importuji...' : `Importovat ${rows.length} pohybů`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
