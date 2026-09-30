import { afterEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { batchInput, devotionDate, detectDevotionHeaderRow, devotionSheetRows, importRowsInput, missingDevotionFields, needsDevotionImportYear, normalizeDevotionRows, selectDevotionHeaderRow, shiftDevotionDate, suggestDevotionImportOptions, suggestDevotionMapping } from '../shared/churchDevotion';
import { googleSheetExportUrl, readDevotionFile, readGoogleDevotionSheet, devotionWorkbook } from './churchDevotionFile';
import { managedDevotionBrief } from './churchDevotionPublic';

const headers = ['日期', '課表名稱', '第幾天', '讀經進度', '短文標題', '靈修短文'];
const row = ['2026-09-11', '測試課表', '1', '約翰福音 1:1', '測試標題', '第一段\n\n第二段，含逗號'];
afterEach(() => vi.unstubAllGlobals());

describe('church devotion input', () => {
  it('accepts leap days but rejects impossible dates', () => {
    expect(devotionDate.safeParse('2028-02-29').success).toBe(true);
    expect(devotionDate.safeParse('2026-02-29').success).toBe(false);
    expect(devotionDate.safeParse('2026-13-01').success).toBe(false);
    expect(shiftDevotionDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDevotionDate('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('maps Chinese headers and preserves paragraph text as a draft', () => {
    const result = normalizeDevotionRows([row], suggestDevotionMapping(headers));
    expect(result.issues).toEqual([]);
    expect(result.entries[0].entry.devotionalText).toBe(row[5]);
    expect(result.entries[0].entry.status).toBe('draft');
  });
  it('rejects duplicate dates and incomplete mappings without partial import', () => {
    expect(normalizeDevotionRows([row, row], suggestDevotionMapping(headers)).issues[0].row).toBe(3);
    expect(normalizeDevotionRows([row], {}).issues).toHaveLength(6);
  });
  it('normalizes slash dates and reports missing text with row numbers', () => {
    expect(normalizeDevotionRows([['2026/9/11', ...row.slice(1)]], suggestDevotionMapping(headers)).entries[0].entry.date).toBe('2026-09-11');
    const result = normalizeDevotionRows([[...row.slice(0, 5), '']], suggestDevotionMapping(headers));
    expect(result.issues[0].row).toBe(2);
    expect(result.issues[0].message).toContain('靈修短文');
  });
  it('rejects unsafe batch requests', () => {
    expect(batchInput.safeParse({ items: [], action: 'publish' }).success).toBe(false);
    expect(batchInput.safeParse({ items: [{ id: '77051061-8512-4d74-9b1c-07ddd01413fd', version: 1 }], action: 'swap' }).success).toBe(false);
  });
  it('recognizes whitespace, full-width punctuation, required markers, and English aliases', () => {
    expect(suggestDevotionMapping(['\uFEFF 日\n期（YYYY-MM-DD）*', '課表 名稱（必填）', 'ＤＡＹ＿ＮＵＭＢＥＲ', '讀經\n進度', '靈修主題', '靈修文章'])).toEqual(suggestDevotionMapping(headers));
    expect(suggestDevotionMapping(['Reading Date', 'plan_name', 'Day No.', 'Bible Reading', 'Title', 'Reflection'])).toEqual(suggestDevotionMapping(headers));
    expect(suggestDevotionMapping(['date', 'plan_name', 'day number', 'scripture_reference', 'devotional_title', 'devotional_text'])).toEqual(suggestDevotionMapping(headers));
  });
  it('does not guess between duplicate headers or loosely related content', () => {
    expect(suggestDevotionMapping(['日期', '日期', '聖經內容說明', '短文標題', '標題'])).toEqual({});
    expect(suggestDevotionMapping(['經文內容', '靈修內容'])).toEqual({ scriptureText: 0, devotionalText: 1 });
    expect(detectDevotionHeaderRow([['九月課表'], headers, ['短文標題']])).toBe(1);
  });
  it('retains physical row numbers and validates the header row bound', () => {
    const result = normalizeDevotionRows([[], row, row], suggestDevotionMapping(headers), 4);
    expect(result.entries[0].row).toBe(6);
    expect(result.issues[0].row).toBe(7);
    expect(normalizeDevotionRows([row], {}, 4).issues[0].row).toBe(4);
    expect(importRowsInput.safeParse({ rows: [row], mapping: {}, headerRow: 31 }).success).toBe(false);
    expect(importRowsInput.parse({ rows: [row], mapping: {} }).headerRow).toBe(1);
  });
  it('does not disclose a draft or fabricate substitute devotion content', () => {
    const brief = managedDevotionBrief('2026-09-11', null);
    expect(brief.sourceStatus).toBe('unpublished');
    expect(brief.devotionalText).toBe('');
    expect(brief.previewVerses).toEqual([]);
  });
});

describe('spreadsheet import', () => {
  it('supports the actual five-column Isaiah layout without inventing a year or rewriting content', async () => {
    const sourceHeaders = ['日期 (Day)', '天數', '經文進度', '每日重點／ 真理導航／生活練習', '今日金句卡'];
    const body = '每日重點：測試重點\n\n真理導航：測試原文\n\n生活練習：測試練習\n\n今日禱告：測試禱告';
    const card = '測試金句\n#測試';
    const csv = [['測試課表名稱', '', '', '', ''], ['簡介：測試介紹', '', '', '', ''], ['', '', '', '', ''], sourceHeaders, ['8/1', '第 1 天', '以賽亞書 1:1-全', body, card]]
      .map(cells => cells.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
    const [sheet] = await readDevotionFile(Buffer.from(csv), 'isaiah.csv');
    const mapping = suggestDevotionMapping(sheet.headers);
    const options = suggestDevotionImportOptions(sheet, mapping);
    expect(sheet.preamble).toHaveLength(3);
    expect(mapping).toEqual({ date: 0, dayNumber: 1, scriptureReference: 2, devotionalText: 3 });
    expect(options).toEqual({ planName: '測試課表名稱', titleFromDailyFocus: true, verseCardColumn: 4 });
    expect(missingDevotionFields(mapping, options)).toEqual([]);
    expect(needsDevotionImportYear(sheet.rows, mapping)).toBe(true);
    expect(normalizeDevotionRows(sheet.rows, mapping, 4, options).issues[0]).toMatchObject({ row: 5, message: expect.stringContaining('年份') });
    const result = normalizeDevotionRows(sheet.rows, mapping, 4, { ...options, year: 2026 });
    expect(result.issues).toEqual([]);
    expect(result.entries[0]).toMatchObject({ row: 5, entry: { date: '2026-08-01', dayNumber: 1, devotionalTitle: '測試重點', devotionalText: body + '\n\n今日金句卡：\n' + card, status: 'draft' } });
  });
  it('validates fallback options, missing focus titles, impossible dates and ambiguous year rollovers', () => {
    const mapping = suggestDevotionMapping(headers);
    expect(importRowsInput.safeParse({ rows: [row], mapping, options: { year: 2200 } }).success).toBe(false);
    expect(importRowsInput.safeParse({ rows: [row], mapping, options: { verseCardColumn: 40 } }).success).toBe(false);
    const invalid = normalizeDevotionRows([['2/29', ...row.slice(1)]], mapping, 1, { year: 2026 });
    expect(invalid.issues[0].message).toContain('日期');
    expect(normalizeDevotionRows([['12/31', ...row.slice(1)], ['1/1', ...row.slice(1)]], mapping, 1, { year: 2026 }).issues[0].message).toContain('跨年');
    const { devotionalTitle: _title, ...noTitle } = mapping;
    expect(normalizeDevotionRows([row], noTitle, 1, { titleFromDailyFocus: true }).issues[0].message).toContain('短文標題');
    const withOptions = normalizeDevotionRows([row], mapping, 1, { planName: '不應覆蓋', titleFromDailyFocus: true, verseCardColumn: 5 });
    expect(withOptions.entries[0].entry).toMatchObject({ planName: row[1], devotionalTitle: row[4], devotionalText: row[5] });
  });
  it('does not suggest extraction when one day lacks a focus, or choose between duplicate cards', () => {
    const sheet = { name: '課表', headers: ['靈修短文', '今日金句卡', '金句卡'], rows: [['每日重點：測試', '', ''], ['沒有重點', '', '']] };
    expect(suggestDevotionImportOptions(sheet, suggestDevotionMapping(sheet.headers))).toEqual({});
  });
  it('finds CSV headers below a title and a blank row without changing content', async () => {
    const matrix = [['教會九月每日讀經', '', '', '', '', ''], ['', '', '', '', '', ''], headers, row];
    const csv = matrix.map(cells => cells.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const [sheet] = await readDevotionFile(Buffer.from(csv), 'test.csv');
    expect(sheet.preamble).toHaveLength(2);
    expect(sheet.headers).toEqual(headers);
    expect(sheet.rows).toEqual([row]);
    expect(devotionSheetRows(sheet)).toEqual(matrix);
    const changed = selectDevotionHeaderRow(sheet, 0);
    expect(selectDevotionHeaderRow(changed, 2)).toEqual(sheet);
    expect(() => selectDevotionHeaderRow(sheet, -1)).toThrow();
  });
  it('detects Excel headers below merged titles and preserves blank row offsets', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('九月');
    sheet.mergeCells('A1:F1'); sheet.getCell('A1').value = '教會每日讀經';
    sheet.getRow(4).values = headers;
    sheet.getRow(6).values = row;
    const [result] = await readDevotionFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'test.xlsx');
    expect(result.preamble).toHaveLength(3);
    expect(normalizeDevotionRows(result.rows, suggestDevotionMapping(result.headers), 4).entries[0]).toMatchObject({ row: 6, entry: { devotionalText: row[5] } });
  });
  it('enforces the data limit even when introductory rows are allowed', async () => {
    const csvRow = row.map(value => JSON.stringify(value.replaceAll('\n', ' '))).join(',');
    await expect(readDevotionFile(Buffer.from(headers.join(',') + '\n' + Array(1001).fill(csvRow).join('\n')), 'test.csv')).rejects.toThrow('1,000');
    const [sheet] = await readDevotionFile(Buffer.from('九月課表,,,,,\n' + headers.join(',') + '\n' + Array(1000).fill(csvRow).join('\n')), 'test.csv');
    expect(sheet.rows).toHaveLength(1000);
  });
  it('reads quoted UTF-8 CSV with BOM, commas, quotes, and multiline paragraphs', async () => {
    const csv = '\uFEFF' + headers.join(',') + '\r\n' + row.map(value => `"${value.replaceAll('"', '""')}"`).join(',');
    const sheets = await readDevotionFile(Buffer.from(csv), 'test.csv');
    expect(sheets[0].rows[0]).toEqual(row);
  });
  it('reads Excel date cells and multiple sheets', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('課表');
    sheet.addRow(headers); sheet.addRow([new Date('2026-09-11T00:00:00Z'), ...row.slice(1)]);
    workbook.addWorksheet('其他').addRow(['備註']);
    const result = await readDevotionFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'test.xlsx');
    expect(result).toHaveLength(2);
    expect(result[0].rows[0][0]).toBe('2026-09-11');
  });
  it('rejects formula cells, oversized input, and legacy xls', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('課表').getCell('A1').value = { formula: '1+1', result: 2 };
    await expect(readDevotionFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'test.xlsx')).rejects.toThrow('公式');
    await expect(readDevotionFile(Buffer.alloc(4 * 1024 * 1024), 'test.csv')).rejects.toThrow('3 MB');
    await expect(readDevotionFile(Buffer.from('xls'), 'test.xls')).rejects.toThrow('.xls');
  });
  it('produces an Excel template with the expected headers', async () => {
    const sheets = await readDevotionFile(Buffer.from(await devotionWorkbook()), 'template.xlsx');
    expect(sheets[0].headers.slice(0, 6)).toEqual(headers);
  });
});

describe('Google Sheets', () => {
  it('auto-maps downloadable Google sheets with a title before reordered, differently named columns', async () => {
    const csv = '九月每日靈修,,,,,\n靈修文章,讀經日期,靈修主題,讀經計畫,Day,讀經範圍\n今天的短文,2026/9/12,測試主題,九月課表,1,約翰福音1:1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(csv, { headers: { 'Content-Type': 'text/csv' } })));
    const [sheet] = await readGoogleDevotionSheet('https://docs.google.com/spreadsheets/d/test/edit#gid=42');
    const result = normalizeDevotionRows(sheet.rows, suggestDevotionMapping(sheet.headers), sheet.preamble!.length + 1);
    expect(result.issues).toEqual([]);
    expect(result.entries[0]).toMatchObject({ row: 3, entry: { date: '2026-09-12', planName: '九月課表', devotionalText: '今天的短文', status: 'draft' } });
  });
  it('uses only a fixed Google export URL and preserves the selected gid', () => {
    expect(googleSheetExportUrl('https://docs.google.com/spreadsheets/d/abc-123/edit#gid=42')).toBe('https://docs.google.com/spreadsheets/d/abc-123/export?format=csv&gid=42');
    expect(googleSheetExportUrl('https://docs.google.com/spreadsheets/d/e/pub123/pubhtml?gid=7')).toContain('/pub?output=csv&single=true&gid=7');
    for (const url of ['http://127.0.0.1/private', 'https://docs.google.com.evil.test/spreadsheets/d/a', 'https://evil.test/', 'https://user@docs.google.com/spreadsheets/d/a']) expect(() => googleSheetExportUrl(url)).toThrow();
  });
  it('reads downloadable Google CSV and rejects login/redirect destinations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(headers.join(',') + '\n' + row.map(value => `"${value}"`).join(','), { headers: { 'Content-Type': 'text/csv' } })));
    expect((await readGoogleDevotionSheet('https://docs.google.com/spreadsheets/d/test/edit'))[0].rows).toHaveLength(1);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })));
    await expect(readGoogleDevotionSheet('https://docs.google.com/spreadsheets/d/test/edit')).rejects.toThrow('需要登入');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(readGoogleDevotionSheet('https://docs.google.com/spreadsheets/d/test/edit')).rejects.toThrow('私人資料');
  });
});
