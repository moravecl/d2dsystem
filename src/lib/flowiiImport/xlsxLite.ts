/**
 * Minimalistická čtečka XLSX bez závislostí — náhrada za ExcelJS pro soubory,
 * které generují některé systémy (např. Flowii) bez atributu `r` u buněk;
 * na těch ExcelJS padá v Row.getCellEx. Umí: ZIP (stored/deflate přes
 * DecompressionStream), inline řetězce, sdílené řetězce, čísla, booleany.
 * Pozice buňky bez `r` = pořadí v řádku (tak to tyto soubory myslí).
 */
import type { CellValue } from '../excelCompat';

// ------------------------------------------------------------------ ZIP
interface ZipEntry { name: string; method: number; compSize: number; offset: number }

function readZipEntries(buf: ArrayBuffer): ZipEntry[] {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // End of central directory (hledá se od konce, signatura 0x06054b50)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Neplatný XLSX (chybí ZIP central directory)');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder('utf-8');
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readZipFile(buf: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const dv = new DataView(buf);
  const p = entry.offset;
  if (dv.getUint32(p, true) !== 0x04034b50) throw new Error('Neplatný XLSX (local header)');
  const nameLen = dv.getUint16(p + 26, true);
  const extraLen = dv.getUint16(p + 28, true);
  const start = p + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, entry.compSize);
  if (entry.method === 0) return new TextDecoder('utf-8').decode(data);
  if (entry.method !== 8) throw new Error(`Nepodporovaná komprese ZIP (${entry.method})`);
  if (typeof DecompressionStream === 'undefined') throw new Error('Prohlížeč nepodporuje DecompressionStream');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}

// ------------------------------------------------------------------ XML
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

function decodeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (_m, named, dec, hex) => {
    if (named) return ENTITIES[`&${named};`];
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return String.fromCodePoint(parseInt(hex, 16));
  });
}

/** Spojí všechny <t>…</t> uvnitř úseku (inline string i sdílený řetězec s více runy). */
function textOf(inner: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) out += decodeXml(m[1]);
  return out;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function colIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(textOf(m[1]));
  return out;
}

function parseSheet(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) !== null) {
    const rAttr = attr(rm[1], 'r');
    const rowIdx = rAttr ? parseInt(rAttr, 10) - 1 : rows.length;
    const cells: CellValue[] = [];
    let pos = 0;
    let cm: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cm = cellRe.exec(rm[2])) !== null) {
      const tag = cm[1]; const inner = cm[2] || '';
      const ref = attr(tag, 'r');
      const idx = ref ? colIndex(ref) : pos;
      pos = idx + 1;
      const t = attr(tag, 't') || 'n';
      let v: CellValue = '';
      if (t === 'inlineStr') v = textOf(inner);
      else {
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        const raw = vm ? decodeXml(vm[1]) : '';
        if (t === 's') v = shared[parseInt(raw, 10)] ?? '';
        else if (t === 'b') v = raw === '1';
        else if (t === 'str' || t === 'e') v = raw;
        else v = raw === '' ? '' : (Number.isFinite(Number(raw)) ? Number(raw) : raw);
      }
      while (cells.length < idx) cells.push('');
      cells[idx] = v;
    }
    while (rows.length < rowIdx) rows.push([]);
    rows[rowIdx] = cells;
  }
  while (rows.length && rows[rows.length - 1].every(v => v === '' || v === null)) rows.pop();
  return rows;
}

/** Načte první list XLSX jako pole řádků (stejný tvar jako readSheetRows). */
export async function readFirstSheetLite(buf: ArrayBuffer): Promise<CellValue[][]> {
  const entries = readZipEntries(buf);
  const byName = (n: string) => entries.find(e => e.name === n || e.name === n.replace(/^\//, ''));

  // cesta k prvnímu listu z workbook.xml + rels; fallback sheet1.xml
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = byName('xl/workbook.xml');
  const rels = byName('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const wbXml = await readZipFile(buf, wb);
    const firstSheet = wbXml.match(/<sheet\b[^>]*\/>/);
    const rid = firstSheet ? attr(firstSheet[0], 'r:id') : null;
    if (rid) {
      const relsXml = await readZipFile(buf, rels);
      const rel = relsXml.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*/>`)) || relsXml.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`));
      const target = rel ? attr(rel[0], 'Target') : null;
      if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    }
  }
  const sheet = byName(sheetPath) || byName('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('XLSX neobsahuje žádný list');
  const sst = byName('xl/sharedStrings.xml');
  const shared = sst ? parseSharedStrings(await readZipFile(buf, sst)) : [];
  return parseSheet(await readZipFile(buf, sheet), shared);
}
