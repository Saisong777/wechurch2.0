import { z } from 'zod';

export const devotionDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD').refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2199-12-31';
}, '日期不存在或超出 1900–2199 年');

export const devotionInput = z.object({
  date: devotionDate,
  planName: z.string().trim().min(1, '請填課表名稱').max(200),
  dayNumber: z.number().int().min(1).max(10000),
  scriptureReference: z.string().trim().min(1, '請填讀經進度').max(500),
  scriptureText: z.string().trim().max(30000).default(''),
  devotionalTitle: z.string().trim().min(1, '請填短文標題').max(300),
  devotionalText: z.string().trim().min(1, '請填靈修短文').max(50000),
  prayer: z.string().trim().max(10000).default(''),
  loveAction: z.string().trim().max(10000).default(''),
  status: z.enum(['draft', 'published']).default('draft'),
});
export type DevotionInput = z.infer<typeof devotionInput>;
export type DevotionEntry = DevotionInput & { id: string; version: number; updatedAt: string };
export const devotionFields = [
  { key: 'date', label: '日期', required: true },
  { key: 'planName', label: '課表名稱', required: true },
  { key: 'dayNumber', label: '第幾天', required: true },
  { key: 'scriptureReference', label: '讀經進度', required: true },
  { key: 'devotionalTitle', label: '短文標題', required: true },
  { key: 'devotionalText', label: '靈修短文', required: true },
  { key: 'scriptureText', label: '經文內容', required: false },
  { key: 'prayer', label: '禱告', required: false },
  { key: 'loveAction', label: '生活實踐', required: false },
] as const;
export type DevotionField = typeof devotionFields[number]['key'];
export type ImportSheet = { name: string; headers: string[]; rows: string[][]; preamble?: string[][] };
export const MAX_DEVOTION_HEADER_ROWS = 30;
export type ImportIssue = { row: number; message: string };
export type ImportPreview = {
  id?: string; expiresAt?: string; issues: ImportIssue[];
  rows: Array<{ row: number; entry: DevotionInput; action: 'create' | 'replace' | 'skip'; existingId: string | null; existingVersion: number | null; before?: DevotionEntry }>;
};
export const devotionImportOptionsInput = z.object({
  planName: z.string().trim().max(200).optional(),
  year: z.number().int().min(1900).max(2199).optional(),
  titleFromDailyFocus: z.boolean().optional(),
  verseCardColumn: z.number().int().min(0).max(39).optional(),
});
export type DevotionImportOptions = z.infer<typeof devotionImportOptionsInput>;
export const importRowsInput = z.object({
  rows: z.array(z.array(z.string().max(50000)).max(40)).min(1).max(1000),
  mapping: z.record(z.string(), z.number().int().min(0).max(39)),
  mode: z.enum(['skip', 'replace']).default('skip'),
  headerRow: z.number().int().min(1).max(MAX_DEVOTION_HEADER_ROWS).default(1),
  options: devotionImportOptionsInput.default({}),
});
export const batchInput = z.object({
  items: z.array(z.object({ id: z.string().uuid(), version: z.number().int().positive() })).min(1).max(1000),
  action: z.enum(['publish', 'draft', 'shift', 'swap']),
  days: z.number().int().min(-366).max(366).optional(),
}).superRefine((value, ctx) => {
  if (new Set(value.items.map(item => item.id)).size !== value.items.length) ctx.addIssue({ code: 'custom', message: '重複的選取項目' });
  if (value.action === 'shift' && (!value.days || value.days === 0)) ctx.addIssue({ code: 'custom', message: '請輸入順延或提前天數' });
  if (value.action === 'swap' && value.items.length !== 2) ctx.addIssue({ code: 'custom', message: '交換日期須選取兩筆' });
});

export function taipeiToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function shiftDevotionDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return devotionDate.parse(shifted.toISOString().slice(0, 10));
}

const aliases: Record<DevotionField, string[]> = {
  date: ['日期', '日期 (Day)', '靈修日期', '讀經日期', 'date', 'readingDate'],
  planName: ['課表名稱', '課表', '計畫名稱', '計劃名稱', '讀經計畫', '讀經計劃', '課程名稱', 'planName', 'plan', 'readingPlan'],
  dayNumber: ['第幾天', '天數', '序號', '天次', '日次', '第幾日', 'dayNumber', 'day', 'dayNo', 'dayNo.'],
  scriptureReference: ['讀經進度', '經文進度', '每日讀經', '讀經範圍', '讀經經文', '經文範圍', '經文出處', '經文', 'scriptureReference', 'bibleReading', 'passage', 'reference'],
  devotionalTitle: ['短文標題', '靈修標題', '標題', '短文主題', '靈修主題', '主題', 'devotionalTitle', 'title'],
  devotionalText: ['靈修短文', '靈修文章', '靈修內容', '每日靈修', '每日重點／真理導航／生活練習', '短文', '內文', '內容', 'devotionalText', 'devotion', 'devotional', 'reflection'],
  scriptureText: ['經文內容', '經文全文', 'scriptureText'], prayer: ['禱告', '回應禱告', 'prayer'],
  loveAction: ['生活實踐', '愛人行動', '應用', 'loveAction'],
};
function normalizeHeader(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\s\u200B-\u200D\uFEFF_\-*＊:：]/g, '')
    .replace(/\((?:必填|選填|required|optional|yyyymmdd|yyyy\/mm\/dd)\)/g, '');
}
export function suggestDevotionMapping(headers: string[]) {
  const mapping: Record<string, number> = {};
  for (const field of devotionFields) {
    const matches = headers.flatMap((header, index) => aliases[field.key].some(alias => normalizeHeader(alias) === normalizeHeader(header)) ? [index] : []);
    // Ambiguous columns require an explicit choice instead of silently taking the first.
    if (matches.length === 1) mapping[field.key] = matches[0];
  }
  return mapping;
}

export function detectDevotionHeaderRow(matrix: string[][]) {
  let bestRow = Math.max(0, matrix.slice(0, MAX_DEVOTION_HEADER_ROWS).findIndex(row => row.some(cell => cell.trim())));
  let bestScore = 1;
  matrix.slice(0, MAX_DEVOTION_HEADER_ROWS).forEach((row, index) => {
    const mapping = suggestDevotionMapping(row);
    const score = devotionFields.filter(field => field.required && mapping[field.key] !== undefined).length;
    if (score > bestScore) { bestRow = index; bestScore = score; }
  });
  return bestRow;
}

export function devotionSheetRows(sheet: ImportSheet) {
  return [...(sheet.preamble || []), sheet.headers, ...sheet.rows];
}

export function selectDevotionHeaderRow(sheet: ImportSheet, index: number): ImportSheet {
  const matrix = devotionSheetRows(sheet);
  if (!Number.isInteger(index) || index < 0 || index >= Math.min(matrix.length, MAX_DEVOTION_HEADER_ROWS)) throw new Error('欄名列超出範圍');
  return { name: sheet.name, preamble: matrix.slice(0, index), headers: matrix[index], rows: matrix.slice(index + 1) };
}

export function dailyFocusTitle(text: string) {
  return text.match(/(?:^|\n)[ \t]*每日重點[：:][ \t]*([^\r\n]+)/)?.[1].trim() || '';
}

const monthDay = /^(\d{1,2})\/(\d{1,2})$/;
export function needsDevotionImportYear(rows: string[][], mapping: Record<string, number>) {
  return mapping.date !== undefined && rows.some(row => monthDay.test(row[mapping.date]?.normalize('NFKC').trim() || ''));
}

export function suggestDevotionImportOptions(sheet: ImportSheet, mapping: Record<string, number>): DevotionImportOptions {
  const options: DevotionImportOptions = {};
  if (mapping.planName === undefined) {
    const title = sheet.preamble?.map(row => [...new Set(row.map(cell => cell.trim()).filter(Boolean))])
      .find(row => row.length === 1 && row[0].length <= 200 && !/^(簡介|說明)[：:]/.test(row[0]));
    if (title) options.planName = title[0];
  }
  const rows = sheet.rows.filter(row => row.some(cell => cell.trim()));
  if (mapping.devotionalTitle === undefined && mapping.devotionalText !== undefined && rows.length && rows.every(row => dailyFocusTitle(row[mapping.devotionalText] || ''))) options.titleFromDailyFocus = true;
  const cards = sheet.headers.flatMap((header, index) => ['今日金句卡', '金句卡'].some(alias => normalizeHeader(header) === normalizeHeader(alias)) ? [index] : []);
  if (cards.length === 1) options.verseCardColumn = cards[0];
  return options;
}

export function missingDevotionFields(mapping: Record<string, number>, options: DevotionImportOptions = {}) {
  return devotionFields.filter(field => field.required && mapping[field.key] === undefined
    && !(field.key === 'planName' && options.planName?.trim())
    && !(field.key === 'devotionalTitle' && options.titleFromDailyFocus && mapping.devotionalText !== undefined));
}

export function normalizeDevotionRows(rows: string[][], mapping: Record<string, number>, headerRow = 1, options: DevotionImportOptions = {}) {
  const issues: ImportIssue[] = [];
  const entries: Array<{ row: number; entry: DevotionInput }> = [];
  for (const field of missingDevotionFields(mapping, options)) issues.push({ row: headerRow, message: `尚未對應「${field.label}」欄位` });
  if (issues.length) return { entries, issues };
  const seen = new Set<string>();
  let previousMonthDay = 0;
  rows.forEach((cells, index) => {
    if (!cells.some(cell => cell.trim())) return;
    const values = Object.fromEntries(devotionFields.map(field => [field.key, cells[mapping[field.key]]?.trim() || '']));
    values.date = values.date.normalize('NFKC');
    const partialDate = values.date.match(monthDay);
    if (partialDate) {
      if (!options.year) { issues.push({ row: index + headerRow + 1, message: '日期只有月／日，請先填寫年份。' }); return; }
      const currentMonthDay = Number(partialDate[1]) * 100 + Number(partialDate[2]);
      if (currentMonthDay < previousMonthDay) { issues.push({ row: index + headerRow + 1, message: '月／日順序倒退或跨年，請在原表填寫完整年月日，避免排錯年度。' }); return; }
      previousMonthDay = currentMonthDay;
      values.date = `${options.year}/${partialDate[1]}/${partialDate[2]}`;
    }
    values.date = values.date.replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, (_, y, m, d) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (mapping.planName === undefined) values.planName = options.planName || '';
    if (mapping.devotionalTitle === undefined && options.titleFromDailyFocus) values.devotionalTitle = dailyFocusTitle(values.devotionalText);
    if (options.verseCardColumn !== undefined && options.verseCardColumn !== mapping.devotionalText) {
      const card = cells[options.verseCardColumn]?.trim();
      if (card) values.devotionalText += `\n\n今日金句卡：\n${card}`;
    }
    const day = values.dayNumber.normalize('NFKC').replace(/\s/g, '').replace(/^第(\d+)[天日]$/, '$1').replace(/^day(\d+)$/i, '$1');
    const parsed = devotionInput.safeParse({ ...values, dayNumber: Number(day), status: 'draft' });
    if (!parsed.success) {
      issues.push({ row: index + headerRow + 1, message: parsed.error.issues.map(issue => `${devotionFields.find(field => field.key === issue.path[0])?.label || issue.path[0]}：${issue.message}`).join('；') });
    } else if (seen.has(parsed.data.date)) {
      issues.push({ row: index + headerRow + 1, message: `檔案內日期重複：${parsed.data.date}` });
    } else {
      seen.add(parsed.data.date);
      entries.push({ row: index + headerRow + 1, entry: parsed.data });
    }
  });
  if (!entries.length && !issues.length) issues.push({ row: headerRow + 1, message: '沒有可匯入的資料' });
  return { entries, issues };
}
