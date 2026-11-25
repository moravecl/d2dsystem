import { readSheetRows, excelSerialToIso, type CellValue } from '../excelCompat';
import { readFirstSheetLite } from './xlsxLite';

/** Entity exportu z Flowii (záloha dat = 8 XLSX souborů, první list "Data"). */
export type FlowiiEntity =
  | 'partners' | 'cases' | 'jobs' | 'tasks' | 'events' | 'documents' | 'pricelist' | 'finance';

export const ENTITY_LABELS: Record<FlowiiEntity, string> = {
  partners: 'Partneři (klienti a dodavatelé)',
  cases: 'Obchodní případy',
  jobs: 'Zakázky',
  tasks: 'Úkoly',
  events: 'Události',
  documents: 'Doklady (faktury)',
  pricelist: 'Ceník',
  finance: 'Příjmy a výdaje',
};

/** Pořadí, ve kterém se entity importují (kvůli vazbám). */
export const ENTITY_ORDER: FlowiiEntity[] = [
  'partners', 'pricelist', 'jobs', 'cases', 'tasks', 'events', 'documents', 'finance',
];

/** Řádek exportu: hodnoty vždy jako ořezané řetězce ('' = prázdná buňka). */
export type Row = Record<string, string>;

export interface ParsedFile {
  fileName: string;
  entity: FlowiiEntity | null;
  headers: string[];
  rows: Row[];
}

// rozpoznání entity podle charakteristických hlaviček (nezávisle na názvu souboru)
const DETECT: { entity: FlowiiEntity; must: string[] }[] = [
  { entity: 'partners', must: ['Firma / osoba', 'Hlavní kontakt - jméno'] },
  { entity: 'cases', must: ['Předpokl. uzavření', 'Typ zakázky'] },
  { entity: 'jobs', must: ['Dohodnutá cena', 'Zbývá vyfakturovat'] },
  { entity: 'tasks', must: ['Úkol', 'Realizuje'] },
  { entity: 'events', must: ['Typ události'] },
  { entity: 'documents', must: ['DUZP', 'Celkem s DPH'] },
  { entity: 'pricelist', must: ['Prodejní cena (bez DPH)'] },
  { entity: 'finance', must: ['Příjem s DPH', 'Výdaj s DPH'] },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

function cellToString(v: CellValue | undefined): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // lokální složky — Excel ukládá půlnoc bez časové zóny, toISOString by posunul den
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())} ${pad2(v.getHours())}:${pad2(v.getMinutes())}:${pad2(v.getSeconds())}`;
  }
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Ano' : 'Ne';
  return String(v).trim();
}

export async function parseFlowiiFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  let sheet: CellValue[][];
  try {
    sheet = await readSheetRows(buffer, file.name);
  } catch {
    // Flowii zapisuje buňky bez atributu r — ExcelJS na tom padá, vlastní čtečka ne
    sheet = await readFirstSheetLite(buffer);
  }
  if (sheet.length === 0) return { fileName: file.name, entity: null, headers: [], rows: [] };
  const headers = sheet[0].map(h => cellToString(h));
  const entity = DETECT.find(d => d.must.every(m => headers.includes(m)))?.entity ?? null;
  const rows: Row[] = [];
  for (const r of sheet.slice(1)) {
    const o: Row = {};
    let any = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const s = cellToString(r[i]);
      o[h] = s;
      if (s) any = true;
    });
    if (any) rows.push(o);
  }
  return { fileName: file.name, entity, headers, rows };
}

// ------------------------------------------------------------------ hodnoty

export function num(v: string | undefined | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function str(v: string | undefined | null): string {
  return (v ?? '').trim();
}

interface DateParts { y: number; m: number; d: number; hh: number; mm: number; ss: number }

function parseParts(v: string | undefined | null): DateParts | null {
  const s = str(v);
  if (!s) return null;
  // 2026-11-25 00:00:00[.000] | 2026-11-25T10:20:30
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3], hh: +(m[4] || 0), mm: +(m[5] || 0), ss: +(m[6] || 0) };
  // 25.11.2026 | 9.9.2024 8:00 | 16.3.2026 6:00
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1], hh: +(m[4] || 0), mm: +(m[5] || 0), ss: +(m[6] || 0) };
  // excelové sériové číslo (desetinná část = čas)
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    const iso = excelSerialToIso(serial);
    const mm2 = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mm2) {
      const secs = Math.round((serial - Math.floor(serial)) * 86400);
      return { y: +mm2[1], m: +mm2[2], d: +mm2[3], hh: Math.floor(secs / 3600), mm: Math.floor((secs % 3600) / 60), ss: secs % 60 };
    }
  }
  return null;
}

/** YYYY-MM-DD nebo null. */
export function isoDate(v: string | undefined | null): string | null {
  const p = parseParts(v);
  if (!p) return null;
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

/** HH:MM nebo null (jen když byl ve zdroji čas). */
export function isoTime(v: string | undefined | null): string | null {
  const s = str(v);
  if (!/\d{1,2}:\d{2}/.test(s)) return null;
  const p = parseParts(s);
  if (!p) return null;
  return `${pad2(p.hh)}:${pad2(p.mm)}`;
}

/** ISO timestamp (lokální čas → UTC) nebo null. */
export function isoDateTime(v: string | undefined | null): string | null {
  const p = parseParts(v);
  if (!p) return null;
  return new Date(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss).toISOString();
}

/** Normalizace pro párování podle názvu (partner, zakázka). */
export function norm(s: string | undefined | null): string {
  return str(s).toLowerCase().replace(/\s+/g, ' ');
}

export function slugify(s: string): string {
  return str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ostatni';
}

/** Krátký stabilní hash (djb2) pro řádky bez vlastního identifikátoru. */
export function hashKey(...parts: (string | undefined | null)[]): string {
  const s = parts.map(p => str(p)).join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** Rozdělí "Moravec L.,  Kliment D." na jednotlivá jména. */
export function splitNames(v: string | undefined | null): string[] {
  return str(v).split(',').map(s => s.trim()).filter(s => s && s !== 'Více odpovědných');
}

/** Všechna jména uživatelů starého systému napříč soubory (pro mapování na účty). */
export function collectUserNames(files: Partial<Record<FlowiiEntity, Row[]>>): string[] {
  const set = new Set<string>();
  const add = (v?: string) => { for (const n of splitNames(v)) set.add(n); };
  for (const r of files.partners || []) add(r['Odpovědná osoba']);
  for (const r of files.cases || []) add(r['Odpovědný']);
  for (const r of files.jobs || []) add(r['Odpovědný']);
  for (const r of files.tasks || []) { add(r['Realizuje']); add(r['Přidal']); }
  for (const r of files.events || []) add(r['Realizátor (Jméno Příjmení)']);
  return [...set].sort((a, b) => a.localeCompare(b, 'cs'));
}

/** Subjekty (sloupec Firma) nalezené v záloze. */
export function collectFirms(files: Partial<Record<FlowiiEntity, Row[]>>): string[] {
  const set = new Set<string>();
  for (const e of ['jobs', 'cases', 'documents', 'finance'] as FlowiiEntity[]) {
    for (const r of files[e] || []) { const f = str(r['Firma']); if (f) set.add(f); }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'cs'));
}

/** Návrh mapování starého jména na uživatele podle shody příjmení. */
export function suggestUser(oldName: string, members: { id: string; name: string }[]): string | null {
  const skip = new Set(['ing', 'mgr', 'bc', 'st', 'ml', 'dis', 'phd']);
  const tokens = (s: string) => norm(s).replace(/\./g, ' ').split(' ').filter(t => t.length > 2 && !skip.has(t));
  const old = tokens(oldName);
  for (const m of members) {
    const mt = tokens(m.name);
    if (old.some(t => mt.includes(t))) return m.id;
  }
  return null;
}
