import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { detectDevotionHeaderRow, devotionFields, MAX_DEVOTION_HEADER_ROWS, type DevotionEntry, type ImportSheet } from '../shared/churchDevotion';

export const MAX_DEVOTION_FILE_BYTES = 3 * 1024 * 1024;

export async function readDevotionFile(buffer: Buffer, filename: string): Promise<ImportSheet[]> {
  if (!buffer.length || buffer.length > MAX_DEVOTION_FILE_BYTES) throw new Error('檔案不可為空，且須小於 3 MB。');
  const workbook = new ExcelJS.Workbook();
  if (/\.xlsx$/i.test(filename)) {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } else if (/\.csv$/i.test(filename)) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new Error('CSV 請使用 UTF-8 編碼，可由 Excel 另存為「CSV UTF-8」。'); }
    if (/^\s*</.test(text)) throw new Error('取得的是網頁而不是試算表。私人 Google 試算表請下載 Excel 後匯入。');
    await workbook.csv.read(Readable.from([text]), { map: value => value, parserOptions: { maxRows: 1000 + MAX_DEVOTION_HEADER_ROWS + 1 } });
  } else throw new Error('僅支援 .xlsx 或 .csv；舊版 .xls 請先另存為 .xlsx。');
  if (workbook.worksheets.length > 10) throw new Error('一次最多讀取 10 個工作表。');
  const sheets: ImportSheet[] = [];
  for (const sheet of workbook.worksheets) {
    if (!sheet.actualRowCount) continue;
    if (sheet.rowCount > 1000 + MAX_DEVOTION_HEADER_ROWS || sheet.columnCount > 40) throw new Error(`「${sheet.name}」超過 1,000 筆或 40 欄，請分批匯入。`);
    const matrix: string[][] = [];
    for (let row = 1; row <= sheet.rowCount; row++) {
      const values: string[] = [];
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cell = sheet.getCell(row, col);
        if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) throw new Error(`「${sheet.name}」${cell.address} 包含公式或錯誤，請貼上為值後匯入。`);
        const text = cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text;
        if (text.length > 50000) throw new Error(`「${sheet.name}」${cell.address} 文字超過 50,000 字。`);
        values.push(text);
      }
      matrix.push(values);
    }
    const headerIndex = detectDevotionHeaderRow(matrix);
    const rows = matrix.slice(headerIndex + 1);
    if (rows.length > 1000) throw new Error(`「${sheet.name}」超過 1,000 筆，請分批匯入。`);
    sheets.push({ name: sheet.name, preamble: matrix.slice(0, headerIndex), headers: matrix[headerIndex], rows });
  }
  if (!sheets.length) throw new Error('檔案沒有可讀取的工作表。');
  return sheets;
}

export function googleSheetExportUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.username || url.password || url.port) throw new Error('請貼上 docs.google.com 的 Google Sheets 連結。');
  const normal = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  const published = url.pathname.match(/^\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.slice(1)).get('gid') || '0';
  if (!/^\d+$/.test(gid)) throw new Error('工作表 gid 格式錯誤。');
  if (published) return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv&single=true&gid=${gid}`;
  if (normal && normal[1] !== 'e') return `https://docs.google.com/spreadsheets/d/${normal[1]}/export?format=csv&gid=${gid}`;
  throw new Error('找不到 Google Sheets 文件編號。');
}

export async function readGoogleDevotionSheet(input: string) {
  let target = googleSheetExportUrl(input);
  const signal = AbortSignal.timeout(15000);
  for (let redirect = 0; redirect < 4; redirect++) {
    const response = await fetch(target, { redirect: 'manual', signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Google Sheets 沒有回傳下載位置。');
      const next = new URL(location, target);
      if (next.protocol !== 'https:' || next.port || next.username || next.password || !(next.hostname === 'docs.google.com' || next.hostname.endsWith('.googleusercontent.com'))) throw new Error('這份試算表需要登入，請下載 Excel 或 CSV 後匯入。');
      target = next.toString();
      continue;
    }
    if (!response.ok || !response.body || response.headers.get('content-type')?.includes('text/html')) {
      await response.body?.cancel();
      throw new Error('無法直接讀取這份試算表；請確認連結，或下載 Excel／CSV 匯入。無須將私人資料改成公開。');
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_DEVOTION_FILE_BYTES) throw new Error('Google 工作表超過 3 MB，請分批匯入。');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    return readDevotionFile(Buffer.concat(chunks), 'google-sheet.csv');
  }
  throw new Error('Google Sheets 重新導向過多，請下載檔案匯入。');
}

export async function devotionWorkbook(entries: DevotionEntry[] = []) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('每日靈修');
  sheet.columns = devotionFields.map(field => ({ header: field.label, key: field.key, width: field.key === 'devotionalText' ? 70 : 24 }));
  for (const entry of entries) sheet.addRow(entry);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
}
