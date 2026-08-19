import { describe, it, expect } from 'vitest';
import { readSheetRows, readSheetObjects, excelSerialToIso, dateToIso, downloadXlsx } from '../excelCompat';

function bufFromString(s: string, encoding: 'utf-8' | 'windows-1250' = 'utf-8'): ArrayBuffer {
  if (encoding === 'utf-8') {
    const b = new TextEncoder().encode(s);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  }
  // ručně zakódovaná česká slova ve windows-1250 pro test fallbacku
  const map: Record<string, number> = { 'č': 0xe8, 'á': 0xe1, 'í': 0xed, 'ř': 0xf8, 'ě': 0xec, 'ž': 0x9e, 'š': 0x9a };
  const bytes = Array.from(s).map(ch => map[ch] ?? ch.charCodeAt(0));
  return new Uint8Array(bytes).buffer;
}

describe('CSV parser', () => {
  it('parsuje CSV se středníky', async () => {
    const rows = await readSheetRows(bufFromString('a;b;c\n1;2;3\n'), 'data.csv');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('parsuje CSV s čárkami a uvozovkami', async () => {
    const rows = await readSheetRows(bufFromString('name,note\n"Novák, Jan","řekl ""ahoj"""\n'), 'x.csv');
    expect(rows).toEqual([['name', 'note'], ['Novák, Jan', 'řekl "ahoj"']]);
  });

  it('dekóduje windows-1250 (české bankovní exporty)', async () => {
    const rows = await readSheetRows(bufFromString('datum;částka\n1.1.2026;100\n', 'windows-1250'), 'vypis.csv');
    expect(rows[0][1]).toBe('částka');
  });

  it('odmítne starý .xls', async () => {
    await expect(readSheetRows(new ArrayBuffer(8), 'stary.xls')).rejects.toThrow('UNSUPPORTED_FORMAT');
  });
});

describe('readSheetObjects', () => {
  it('mapuje řádky na objekty podle hlaviček', async () => {
    const objs = await readSheetObjects(bufFromString('Jméno;Věk\nJan;30\nEva;25\n'), 'lidi.csv');
    expect(objs).toEqual([
      { 'Jméno': 'Jan', 'Věk': '30' },
      { 'Jméno': 'Eva', 'Věk': '25' },
    ]);
  });
});

describe('datumy', () => {
  it('excelSerialToIso převádí sériové číslo', () => {
    expect(excelSerialToIso(45000)).toBe('2023-03-15');
    expect(excelSerialToIso(0)).toBe('');
  });

  it('dateToIso formátuje Date', () => {
    expect(dateToIso(new Date(Date.UTC(2026, 7, 19)))).toBe('2026-08-19');
  });
});

describe('downloadXlsx roundtrip', () => {
  it('vytvořený .xlsx jde zpětně přečíst', async () => {
    // downloadXlsx používá DOM — otestujeme jádro přes ExcelJS přímo v readSheetRows
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(['kod', 'cena']);
    ws.addRow(['A1', 123.45]);
    const buffer = await wb.xlsx.writeBuffer();
    const rows = await readSheetRows(buffer as ArrayBuffer, 'test.xlsx');
    expect(rows[0]).toEqual(['kod', 'cena']);
    expect(rows[1][0]).toBe('A1');
    expect(rows[1][1]).toBe(123.45);
  });

  it('export existuje', () => {
    expect(typeof downloadXlsx).toBe('function');
  });
});
