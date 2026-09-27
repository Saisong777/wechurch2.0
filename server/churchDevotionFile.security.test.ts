import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { devotionWorkbook, readDevotionFile } from './churchDevotionFile';
import { validateXlsxArchive, XLSX_LIMITS } from './xlsxArchive';

async function archive(files: Record<string, Buffer | string>) {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Mutate metadata in a library-generated single-entry fixture, never parse ZIPs in production.
function changeDirectory(buffer: Buffer, offset: number, value: number, width = 4) {
  const result = Buffer.from(buffer);
  const header = result.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  if (header < 0) throw new Error('Missing test central directory');
  if (width === 2) result.writeUInt16LE(value, header + offset);
  else result.writeUInt32LE(value, header + offset);
  return result;
}

function falseSize(buffer: Buffer) {
  const changed = changeDirectory(buffer, 24, 1);
  changed.writeUInt32LE(1, 22); // Local-header uncompressed size in this single-entry fixture.
  return changed;
}

afterEach(() => vi.restoreAllMocks());

describe('bounded XLSX import', () => {
  it('accepts generated XLSX and CSV imports', async () => {
    const sheets = await readDevotionFile(Buffer.from(await devotionWorkbook()), 'template.xlsx');
    expect(sheets).toHaveLength(1);
    expect((await readDevotionFile(Buffer.from('日期,課表名稱,第幾天,讀經進度,短文標題,靈修短文\n2026-09-01,Plan,1,John 1,Title,Text'), 'a.csv'))[0].rows).toHaveLength(1);
  });

  it('rejects a compressed expansion before ExcelJS load, including a false declared size', async () => {
    const bomb = await archive({ 'large.xml': Buffer.alloc(XLSX_LIMITS.entryBytes + 1, 65) });
    expect(bomb.length).toBeLessThan(3 * 1024 * 1024);
    const load = vi.spyOn(ExcelJS.Workbook.prototype, 'xlsx', 'get');
    await expect(readDevotionFile(falseSize(bomb), 'bomb.xlsx')).rejects.toThrow('解壓縮限制');
    expect(load).not.toHaveBeenCalled();
    await expect(validateXlsxArchive(bomb)).rejects.toThrow('解壓縮限制');
  });

  it('enforces total expanded bytes across individually allowed entries', async () => {
    const data = Buffer.alloc(XLSX_LIMITS.entryBytes, 65);
    await expect(validateXlsxArchive(await archive({ a: data, b: data, c: data, d: 'x' }))).rejects.toThrow('解壓縮限制');
  });

  it('enforces the archive entry count', async () => {
    const entries = Object.fromEntries(Array.from({ length: XLSX_LIMITS.entries + 1 }, (_, i) => [`file${i}`, 'x']));
    await expect(validateXlsxArchive(await archive(entries))).rejects.toThrow('解壓縮限制');
  });

  it('fails closed on encrypted, unsupported, malformed and inconsistent archives', async () => {
    const zip = await archive({ a: 'hello' });
    const corrupt = Buffer.from(zip);
    corrupt[30 + corrupt.readUInt16LE(26) + corrupt.readUInt16LE(28)] = 0x06; // Invalid DEFLATE block type.
    for (const bad of [changeDirectory(zip, 8, 1, 2), changeDirectory(zip, 10, 99, 2), falseSize(zip), corrupt, zip.subarray(0, 30), Buffer.from('not a zip')]) {
      await expect(validateXlsxArchive(bad)).rejects.toThrow('XLSX');
    }
  });

  it('rejects concurrent parsers and releases the slot after success and error', async () => {
    const pending = readDevotionFile(Buffer.from('日期,短文標題\n2026-09-01,Title'), 'a.csv');
    await expect(readDevotionFile(Buffer.from('a'), 'b.csv')).rejects.toThrow('稍後再試');
    await pending;
    await expect(readDevotionFile(Buffer.from('bad'), 'bad.xlsx')).rejects.toThrow('XLSX');
    await expect(readDevotionFile(Buffer.from('日期,短文標題\n2026-09-01,Title'), 'c.csv')).resolves.toHaveLength(1);
  });

  it('rebuilds a bounded archive even when directory record counts lie', async () => {
    const zip = await archive({ a: 'hello', b: 'world' });
    const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    zip.writeUInt16LE(1, end + 8);
    zip.writeUInt16LE(1, end + 10);
    const safe = await JSZip.loadAsync(await validateXlsxArchive(zip));
    expect(Object.keys(safe.files)).toEqual(['a', 'b']);
    expect(await safe.file('b')!.async('string')).toBe('world');
  });

  it('rejects tiny worksheet expansion payloads before ExcelJS in a bounded subprocess', () => {
    const script = `
      import assert from 'node:assert/strict';
      import ExcelJS from 'exceljs';
      import JSZip from 'jszip';
      import { readDevotionFile } from './server/churchDevotionFile.ts';
      let loads = 0;
      Object.defineProperty(ExcelJS.Workbook.prototype, 'xlsx', { get() {
        loads++; throw new Error('EXCELJS_LOAD_REACHED');
      }});
      const cases = [
        '<mergeCells><mergeCell ref="A1:XFD1048576"/></mergeCells>',
        '<mergeCells><mergeCell ref="A1:&#88;FD1048576"/></mergeCells>',
        '<mergeCells><mergeCell ref="A1:invalid"/></mergeCells>',
        '<mergeCells><mergeCell ref="B2:A1"/></mergeCells>',
        '<mergeCells><mergeCell ref="A1:AN1030"/><mergeCell ref="A1:AN1030"/></mergeCells>',
        '<dataValidations><dataValidation sqref="A1:XFD1048576"/></dataValidations>',
        '<dataValidations><dataValidation sqref="A1:AN1030 A1:AN1030"/></dataValidations>',
        '<cols><col min="1" max="16384"/></cols>',
        '<sheetData><row r="1048576"><c r="A1048576"/></row></sheetData>',
        '<sheetData><row r="1"><c r="XFD1"/></row></sheetData>',
        '<dimension ref="A1:XFD1048576"/>',
        '<mergeCells><mergeCell ref="A1:B2"></mergeCells>',
      ];
      for (const body of cases) {
        const zip = new JSZip();
        zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + body + '</worksheet>');
        const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        assert.ok(bytes.length < 4096);
        await assert.rejects(readDevotionFile(bytes, 'small.xlsx'), /XLSX/);
      }
      assert.equal(loads, 0);
      console.log('worksheet preflight rejected all payloads before ExcelJS');
    `;
    const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: new URL('../', import.meta.url), timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
      env: { PATH: path.dirname(process.execPath), NODE_ENV: 'test' }, encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('before ExcelJS');
  }, 20000);

  it('keeps valid small merged worksheets importable', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Import');
    sheet.getCell('A1').value = 'Heading';
    sheet.mergeCells('A1:B1');
    sheet.addRow(['日期', '課表名稱', '第幾天', '讀經進度', '短文標題', '靈修短文']);
    sheet.addRow(['2026-09-01', 'Plan', 1, 'John 1', 'Title', 'Text']);
    expect(await readDevotionFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'valid.xlsx')).toHaveLength(1);
  });
});
