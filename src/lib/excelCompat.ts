/**
 * Náhrada za knihovnu `xlsx` (SheetJS) postavená na ExcelJS.
 *
 * Důvod: npm balíček `xlsx` má neopravené zranitelnosti (prototype pollution,
 * ReDoS) přímo na cestě zpracování souborů nahraných uživatelem (A2 z auditu).
 *
 * Podporované formáty: .xlsx (ExcelJS) a .csv (vlastní parser s detekcí
 * oddělovače a kódování windows-1250). Starý binární formát .xls a .ods
 * podporován není — uživatel soubor uloží jako .xlsx.
 */
import ExcelJS from 'exceljs';

export type CellValue = string | number | boolean | Date | null;

/** Převede hodnotu buňky ExcelJS na primitiv (richtext, hyperlink, vzorec…). */
function normalizeCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map(r => r.text ?? '').join('');
    }
    if ('result' in o) return normalizeCell(o.result);
    if ('text' in o) return normalizeCell(o.text);
    if ('hyperlink' in o) return String(o.hyperlink);
    if ('error' in o) return null;
    return String(v);
  }
  return v as CellValue;
}

function isCsv(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}

/** Dekóduje CSV: zkusí UTF-8, při znacích � přepne na windows-1250 (české banky). */
function decodeCsv(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1250').decode(buffer);
  } catch {
    return utf8;
  }
}

/** Jednoduchý CSV parser s podporou uvozovek; oddělovač detekuje z prvního řádku. */
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const delimiter = [';', ',', '\t']
    .map(d => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

/**
 * Načte první list souboru jako pole řádků (ekvivalent sheet_to_json s header:1).
 * Prázdné buňky vrací jako ''.
 */
export async function readSheetRows(buffer: ArrayBuffer, fileName: string): Promise<CellValue[][]> {
  if (isCsv(fileName)) {
    return parseCsv(decodeCsv(buffer));
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xls') || lower.endsWith('.ods')) {
    throw new Error('UNSUPPORTED_FORMAT');
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: CellValue[][] = [];
  let maxCols = 0;
  ws.eachRow({ includeEmpty: false }, (row) => {
    maxCols = Math.max(maxCols, row.cellCount);
  });
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values: CellValue[] = [];
    for (let c = 1; c <= Math.max(maxCols, row.cellCount); c++) {
      const v = normalizeCell(row.getCell(c).value);
      values.push(v === null ? '' : v);
    }
    rows.push(values);
  });
  // odřízni zcela prázdné řádky na konci
  while (rows.length && rows[rows.length - 1].every(v => v === '' || v === null)) rows.pop();
  return rows;
}

/**
 * Načte první list jako pole objektů — klíče z prvního (hlavičkového) řádku
 * (ekvivalent sheet_to_json s defval: '').
 */
export async function readSheetObjects(buffer: ArrayBuffer, fileName: string): Promise<Record<string, unknown>[]> {
  const rows = await readSheetRows(buffer, fileName);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h, i) => {
    const s = String(h ?? '').trim();
    return s || `__col${i}`;
  });
  return rows.slice(1).map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

/** Excelové sériové číslo data → ISO řetězec YYYY-MM-DD (náhrada XLSX.SSF.parse_date_code). */
export function excelSerialToIso(serial: number): string {
  if (!isFinite(serial) || serial <= 0) return '';
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Date objekt → ISO řetězec YYYY-MM-DD (ExcelJS vrací datumové buňky jako Date). */
export function dateToIso(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Vytvoří .xlsx z pole řádků a stáhne ho v prohlížeči (náhrada XLSX.writeFile). */
export async function downloadXlsx(
  aoa: (string | number)[][],
  sheetName: string,
  fileName: string,
  colWidths?: number[],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  aoa.forEach(row => ws.addRow(row));
  if (colWidths) {
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  }
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
