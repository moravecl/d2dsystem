import { useState, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2,
  Download, ArrowLeft, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { readSheetObjects, downloadXlsx } from '../../lib/excelCompat';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import type { Category, Subcategory } from '../../types/database';

interface ParsedRow {
  cislo: string;
  nazev: string;
  mj: string;
  typ: string;
  prodejni_bez_dph: number;
  prodejni_s_dph: number;
  nakupni_bez_dph: number;
  nakupni_s_dph: number;
  dph_sazba: number;
  obchodni_prirazka: number;
  mena: string;
  text_faktura: string;
  vyrobce: string;
  kategorie: string;
  podkategorie: string;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  categoriesCreated: number;
  subcategoriesCreated: number;
  errors: string[];
}

const EXPECTED_HEADERS = [
  'Číslo', 'Nazev', 'MJ', 'Typ zbozi/sluzba',
  'Prodejni cena (bez DPH)', 'Prodejni cena (s DPH)',
  'Nakupni cena (bez DPH)', 'Nakupni cena (s DPH)',
  'Vyse DPH (%)', 'Obchodní přirážka (%)', 'Mena',
  'Doplnujici text na fakturu', 'Vyrobce', 'Kategorie', 'Podkategorie',
];

const HEADER_ALIASES: Record<string, string> = {
  'cislo': 'cislo',
  'kod': 'cislo',
  'code': 'cislo',
  'nazev': 'nazev',
  'název': 'nazev',
  'name': 'nazev',
  'mj': 'mj',
  'typ zbozi/sluzba': 'typ',
  'typ': 'typ',
  'prodejni cena (bez dph)': 'prodejni_bez_dph',
  'prodejní cena (bez dph)': 'prodejni_bez_dph',
  'prodejni cena bez dph': 'prodejni_bez_dph',
  'prodejni cena (s dph)': 'prodejni_s_dph',
  'prodejní cena (s dph)': 'prodejni_s_dph',
  'prodejni cena s dph': 'prodejni_s_dph',
  'nakupni cena (bez dph)': 'nakupni_bez_dph',
  'nákupní cena (bez dph)': 'nakupni_bez_dph',
  'nakupni cena bez dph': 'nakupni_bez_dph',
  'nakupni cena (s dph)': 'nakupni_s_dph',
  'nákupní cena (s dph)': 'nakupni_s_dph',
  'nakupni cena s dph': 'nakupni_s_dph',
  'vyse dph (%)': 'dph_sazba',
  'výše dph (%)': 'dph_sazba',
  'vyse dph': 'dph_sazba',
  'dph': 'dph_sazba',
  'obchodni prirazka (%)': 'obchodni_prirazka',
  'obchodní přirážka (%)': 'obchodni_prirazka',
  'obchodni prirazka': 'obchodni_prirazka',
  'mena': 'mena',
  'měna': 'mena',
  'doplnujici text na fakturu': 'text_faktura',
  'doplňující text na fakturu': 'text_faktura',
  'vyrobce': 'vyrobce',
  'výrobce': 'vyrobce',
  'brand': 'vyrobce',
  'kategorie': 'kategorie',
  'category': 'kategorie',
  'podkategorie': 'podkategorie',
  'subcategory': 'podkategorie',
};

function normalizeHeader(h: string): string | null {
  const key = h.trim().toLowerCase().replace(/\s+/g, ' ');
  return HEADER_ALIASES[key] ?? null;
}

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function generateTemplate(): void {
  void downloadXlsx(
    [
      EXPECTED_HEADERS,
      [
        'ABB3559H-A00651', 'ABB LEVI 3559H-A00651 01, KRYT SPINACE', 'ks', 'dobr',
        29.59, 35.80, 23.67, 28.64, 21, 25, 'CZK', '', 'ABB', 'Elektroinstalace', 'Kompletace',
      ],
    ],
    'Data',
    'import_produktu_sablona.xlsx',
    [18, 50, 6, 12, 18, 18, 18, 18, 10, 16, 8, 30, 15, 20, 20],
  );
}

interface Props {
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}

export default function ProductImport({ categories, onClose, onDone }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [defaultCategory, setDefaultCategory] = useState(categories[0]?.id ?? '');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'csv'].includes(ext || '')) {
      toast('Nepodporovaný formát. Nahrajte .xlsx nebo .csv soubor (starý .xls uložte v Excelu jako .xlsx).', 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const jsonData = await readSheetObjects(data, file.name);

        if (jsonData.length === 0) {
          toast('Soubor je prázdný', 'error');
          return;
        }

        const rawHeaders = Object.keys(jsonData[0]);
        const headerMap: Record<string, string> = {};
        const unmapped: string[] = [];

        rawHeaders.forEach(h => {
          const mapped = normalizeHeader(h);
          if (mapped) {
            headerMap[h] = mapped;
          } else {
            unmapped.push(h);
          }
        });

        if (!Object.values(headerMap).includes('cislo') && !Object.values(headerMap).includes('nazev')) {
          toast('Nepodařilo se rozpoznat sloupce. Zkontrolujte hlavičky.', 'error');
          return;
        }

        setUnmappedHeaders(unmapped);

        const parsed: ParsedRow[] = jsonData.map(row => {
          const get = (field: string): unknown => {
            const key = rawHeaders.find(h => headerMap[h] === field);
            return key ? row[key] : '';
          };
          return {
            cislo: String(get('cislo') ?? '').trim(),
            nazev: String(get('nazev') ?? '').trim(),
            mj: String(get('mj') ?? '').trim(),
            typ: String(get('typ') ?? '').trim(),
            prodejni_bez_dph: parseNum(get('prodejni_bez_dph')),
            prodejni_s_dph: parseNum(get('prodejni_s_dph')),
            nakupni_bez_dph: parseNum(get('nakupni_bez_dph')),
            nakupni_s_dph: parseNum(get('nakupni_s_dph')),
            dph_sazba: parseNum(get('dph_sazba')),
            obchodni_prirazka: parseNum(get('obchodni_prirazka')),
            mena: String(get('mena') ?? '').trim(),
            text_faktura: String(get('text_faktura') ?? '').trim(),
            vyrobce: String(get('vyrobce') ?? '').trim(),
            kategorie: String(get('kategorie') ?? '').trim(),
            podkategorie: String(get('podkategorie') ?? '').trim(),
          };
        }).filter(r => r.cislo || r.nazev);

        if (parsed.length === 0) {
          toast('Žádné platné řádky', 'error');
          return;
        }

        setRows(parsed);
        setStep('preview');
      } catch {
        toast('Chyba při čtení souboru', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleImport = async () => {
    if (!defaultCategory) {
      toast('Vyberte výchozí kategorii', 'error');
      return;
    }

    setStep('importing');

    const res: ImportResult = {
      total: rows.length, created: 0, updated: 0, skipped: 0,
      categoriesCreated: 0, subcategoriesCreated: 0, errors: [],
    };

    const categoryMap = new Map<string, string>();
    categories.forEach(c => {
      categoryMap.set(c.name.toLowerCase(), c.id);
    });

    const { data: existingSubs } = await supabase.from('subcategories').select('*');
    const subcategoryMap = new Map<string, string>();
    (existingSubs ?? []).forEach((s: Subcategory) => {
      subcategoryMap.set(`${s.category_id}::${s.name.toLowerCase()}`, s.id);
    });

    const uniqueCategories = new Set<string>();
    const uniqueSubcategories = new Set<string>();
    rows.forEach(r => {
      if (r.kategorie) uniqueCategories.add(r.kategorie);
      if (r.podkategorie && r.kategorie) uniqueSubcategories.add(`${r.kategorie}::${r.podkategorie}`);
    });

    for (const catName of uniqueCategories) {
      if (!categoryMap.has(catName.toLowerCase())) {
        const slug = slugify(catName);
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 1;
        const { data: newCat, error } = await supabase.from('categories').insert({
          name: catName,
          slug: slug || `cat_${Date.now()}`,
          sort_order: maxOrder,
        }).select().maybeSingle();
        if (error) {
          res.errors.push(`Chyba při vytváření kategorie "${catName}": ${error.message}`);
        } else if (newCat) {
          categoryMap.set(catName.toLowerCase(), newCat.id);
          res.categoriesCreated++;
        }
      }
    }

    for (const key of uniqueSubcategories) {
      const [catName, subName] = key.split('::');
      const catId = categoryMap.get(catName.toLowerCase());
      if (!catId) continue;

      const subKey = `${catId}::${subName.toLowerCase()}`;
      if (!subcategoryMap.has(subKey)) {
        const slug = slugify(subName);
        const { data: newSub, error } = await supabase.from('subcategories').insert({
          category_id: catId,
          name: subName,
          slug: slug || `sub_${Date.now()}`,
        }).select().maybeSingle();
        if (error) {
          res.errors.push(`Chyba při vytváření podkategorie "${subName}": ${error.message}`);
        } else if (newSub) {
          subcategoryMap.set(subKey, newSub.id);
          res.subcategoriesCreated++;
        }
      }
    }

    const existingCodes = new Set<string>();
    if (updateExisting) {
      const { data: existing } = await supabase.from('products').select('code');
      (existing ?? []).forEach(p => existingCodes.add(p.code.toUpperCase()));
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { code: string; data: Record<string, unknown> }[] = [];

      for (const row of batch) {
        if (!row.nazev) {
          res.skipped++;
          continue;
        }

        const code = (row.cislo || '').toUpperCase();
        const catId = categoryMap.get(row.kategorie.toLowerCase()) || defaultCategory;

        let subcategoryId: string | null = null;
        if (row.podkategorie) {
          const subKey = `${catId}::${row.podkategorie.toLowerCase()}`;
          subcategoryId = subcategoryMap.get(subKey) ?? null;
        }

        const payload: Record<string, unknown> = {
          name: row.nazev,
          code,
          brand: row.vyrobce,
          price: row.prodejni_bez_dph || 0,
          purchase_price: row.nakupni_bez_dph || 0,
          margin_percent: row.obchodni_prirazka || 0,
          description: row.text_faktura,
          category_id: catId,
          subcategory_id: subcategoryId,
          tag: row.podkategorie,
          is_active: true,
        };

        if (updateExisting && code && existingCodes.has(code)) {
          toUpdate.push({ code, data: payload });
        } else {
          toInsert.push(payload);
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('products').insert(toInsert);
        if (error) {
          res.errors.push(`Chyba při vkládání (řádky ${i + 1}-${i + toInsert.length}): ${error.message}`);
        } else {
          res.created += toInsert.length;
        }
      }

      for (const item of toUpdate) {
        const { error } = await supabase.from('products')
          .update(item.data)
          .eq('code', item.code);
        if (error) {
          res.errors.push(`Chyba při aktualizaci ${item.code}: ${error.message}`);
        } else {
          res.updated++;
        }
      }
    }

    setResult(res);
    setStep('done');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Import produktů z XLS</h1>
          <p className="text-sm text-slate-500 mt-0.5">Nahrajte soubor ve formátu vašich ceníků</p>
        </div>
      </div>

      {step === 'upload' && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all ${
              dragOver
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/10 hover:border-white/[0.12] bg-white/[0.06]'
            }`}
          >
            <FileSpreadsheet className={`w-16 h-16 mx-auto mb-4 ${dragOver ? 'text-blue-400' : 'text-slate-200'}`} />
            <p className="text-lg font-extrabold text-slate-300 mb-2">
              Přetáhněte XLS soubor sem
            </p>
            <p className="text-sm text-slate-400 mb-6">
              Podporované formáty: .xlsx, .csv
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 transition cursor-pointer shadow-lg">
              <Upload className="w-4 h-4" />
              Vybrat soubor
              <input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>

          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6">
            <h3 className="font-extrabold text-white mb-3">Šablona pro import</h3>
            <p className="text-sm text-slate-500 mb-4">
              Stáhněte šablonu, která odpovídá formátu vašich ceníků. Můžete použít i přímo váš export z XML systému - sloupce se automaticky namapují.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={generateTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 font-extrabold rounded-xl hover:bg-emerald-500/20 transition"
              >
                <Download className="w-4 h-4" />
                Stáhnout šablonu (.xlsx)
              </button>
            </div>

            <div className="mt-5 bg-white/[0.04] rounded-xl p-4">
              <p className="text-xs font-extrabold text-slate-400 mb-2">Rozpoznávané sloupce:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                {EXPECTED_HEADERS.map(h => (
                  <div key={h} className="flex items-center gap-1.5 text-slate-500">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    {h}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-white">Náhled importu</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {fileName} &middot; {rows.length} položek
                </p>
              </div>
              <button
                onClick={() => { setStep('upload'); setRows([]); }}
                className="text-sm text-slate-500 hover:text-slate-300 font-semibold"
              >
                Zrušit
              </button>
            </div>

            {unmappedHeaders.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-400">
                  <span className="font-extrabold">Nerozpoznané sloupce:</span>{' '}
                  {unmappedHeaders.join(', ')}. Tyto sloupce budou ignorovány.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs font-extrabold text-slate-400 mb-1.5 block">
                  Výchozí kategorie
                </label>
                <select
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Použije se, pokud se název kategorie v souboru neshoduje s existující
                </p>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-400 mb-1.5 block">
                  Chování při duplicitách
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setUpdateExisting(true)}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-extrabold text-sm transition ${
                      updateExisting
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                    }`}
                  >
                    Aktualizovat
                  </button>
                  <button
                    onClick={() => setUpdateExisting(false)}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-extrabold text-sm transition ${
                      !updateExisting
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                    }`}
                  >
                    Přeskočit
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Dle shody kódu (Číslo) s existujícími produkty
                </p>
              </div>
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] border-b border-white/[0.06] sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 font-extrabold text-slate-500 uppercase tracking-wider">#</th>
                    <th className="text-left p-3 font-extrabold text-slate-500 uppercase tracking-wider">Číslo</th>
                    <th className="text-left p-3 font-extrabold text-slate-500 uppercase tracking-wider min-w-[200px]">Název</th>
                    <th className="text-left p-3 font-extrabold text-slate-500 uppercase tracking-wider">Výrobce</th>
                    <th className="text-right p-3 font-extrabold text-slate-500 uppercase tracking-wider">Prodej</th>
                    <th className="text-right p-3 font-extrabold text-slate-500 uppercase tracking-wider">Nákup</th>
                    <th className="text-right p-3 font-extrabold text-slate-500 uppercase tracking-wider">Marže %</th>
                    <th className="text-left p-3 font-extrabold text-slate-500 uppercase tracking-wider">Kategorie</th>
                    <th className="text-left p-3 font-extrabold text-slate-500 uppercase tracking-wider">Podkategorie</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-white/[0.04]">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-300">{row.cislo}</td>
                      <td className="p-3 text-white font-semibold">{row.nazev}</td>
                      <td className="p-3 text-slate-400">{row.vyrobce}</td>
                      <td className="p-3 text-right font-semibold text-slate-300">
                        {row.prodejni_bez_dph > 0 ? `${row.prodejni_bez_dph.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        {row.nakupni_bez_dph > 0 ? `${row.nakupni_bez_dph.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        {row.obchodni_prirazka > 0 ? `${row.obchodni_prirazka}%` : '-'}
                      </td>
                      <td className="p-3 text-slate-400">{row.kategorie || '-'}</td>
                      <td className="p-3 text-slate-400">{row.podkategorie || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && (
              <div className="px-4 py-2 bg-white/[0.04] text-xs text-slate-500 font-semibold border-t border-white/[0.06]">
                Zobrazeno 100 z {rows.length} řádků
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setStep('upload'); setRows([]); }}
              className="px-5 py-2.5 rounded-xl font-extrabold text-slate-400 hover:bg-white/[0.06] transition"
            >
              Zpět
            </button>
            <button
              onClick={handleImport}
              className="px-8 py-3 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Importovat {rows.length} položek
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-16 text-center">
          <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
          <p className="text-lg font-extrabold text-slate-300">Importuji produkty...</p>
          <p className="text-sm text-slate-400 mt-1">Prosím nepřerušte operaci</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-6">
          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-8">
            <div className="text-center mb-8">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              ) : (
                <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              )}
              <h2 className="text-xl font-extrabold text-white">Import dokončen</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/[0.04] rounded-xl p-4 text-center">
                <div className="text-2xl font-extrabold text-white">{result.total}</div>
                <div className="text-xs text-slate-500 font-semibold mt-1">Celkem řádků</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-extrabold text-emerald-400">{result.created}</div>
                <div className="text-xs text-emerald-400 font-semibold mt-1">Vytvořeno</div>
              </div>
              <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-extrabold text-blue-400">{result.updated}</div>
                <div className="text-xs text-blue-400 font-semibold mt-1">Aktualizováno</div>
              </div>
              <div className="bg-white/[0.04] rounded-xl p-4 text-center">
                <div className="text-2xl font-extrabold text-slate-500">{result.skipped}</div>
                <div className="text-xs text-slate-500 font-semibold mt-1">Přeskočeno</div>
              </div>
              {(result.categoriesCreated > 0 || result.subcategoriesCreated > 0) && (
                <>
                  <div className="bg-amber-500/10 rounded-xl p-4 text-center">
                    <div className="text-2xl font-extrabold text-amber-400">{result.categoriesCreated}</div>
                    <div className="text-xs text-amber-400 font-semibold mt-1">Nových kategorií</div>
                  </div>
                  <div className="bg-amber-500/10 rounded-xl p-4 text-center">
                    <div className="text-2xl font-extrabold text-amber-400">{result.subcategoriesCreated}</div>
                    <div className="text-xs text-amber-400 font-semibold mt-1">Nových podkategorií</div>
                  </div>
                </>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-200 rounded-xl p-4">
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-extrabold text-red-400">
                      {result.errors.length} chyb
                    </span>
                  </div>
                  {showErrors ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
                </button>
                {showErrors && (
                  <div className="mt-3 space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-400 font-mono">{err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => { setStep('upload'); setRows([]); setResult(null); }}
                className="px-5 py-2.5 rounded-xl font-extrabold text-slate-400 hover:bg-white/[0.06] transition"
              >
                Další import
              </button>
              <button
                onClick={onDone}
                className="px-8 py-3 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 transition shadow-lg"
              >
                Hotovo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
