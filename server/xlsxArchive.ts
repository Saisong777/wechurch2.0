import { createRequire } from 'node:module';
import { Readable, Writable, type Duplex } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import { MAX_DEVOTION_HEADER_ROWS } from '../shared/churchDevotion';

interface ZipEntry extends Readable {
  path: string;
  type: string;
  vars: { flags: number; compressionMethod: number; uncompressedSize: number };
}
const { Parse } = createRequire(import.meta.url)('unzipper') as {
  Parse(options: { forceStream: boolean }): Duplex & AsyncIterable<ZipEntry>;
};

export const XLSX_LIMITS = Object.freeze({ entries: 128, entryBytes: 8 * 1024 * 1024, totalBytes: 24 * 1024 * 1024 });
const SHEET_ROWS = 1000 + MAX_DEVOTION_HEADER_ROWS;
const SHEET_COLUMNS = 40;
const SHEET_CELLS = SHEET_ROWS * SHEET_COLUMNS;

function boundedInteger(value: string | undefined, max: number) {
  if (!value || !/^[1-9]\d*$/.test(value)) throw new Error('Invalid worksheet index');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) throw new Error('Worksheet index exceeds import limit');
  return number;
}

function boundedAddress(value: string) {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/.exec(value);
  if (!match) throw new Error('Invalid worksheet address');
  let column = 0;
  for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64;
  if (column > SHEET_COLUMNS) throw new Error('Worksheet column exceeds import limit');
  return { column, row: boundedInteger(match[2], SHEET_ROWS) };
}

function boundedRange(value: string) {
  const parts = value.split(':');
  if (parts.length > 2) throw new Error('Invalid worksheet range');
  const start = boundedAddress(parts[0]);
  const end = boundedAddress(parts[1] ?? parts[0]);
  if (end.column < start.column || end.row < start.row) throw new Error('Reversed worksheet range');
  return (end.column - start.column + 1) * (end.row - start.row + 1);
}

function validateWorksheetXml(buffer: Buffer) {
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0;
  let nodes = 0;
  let rows = 0;
  let cells = 0;
  let merges = 0;
  let expandedCells = 0;
  parser.on('error', error => { throw error; });
  parser.on('doctype', () => { throw new Error('Worksheet DTD is not supported'); });
  parser.on('opentag', tag => {
    if (++depth > 64 || ++nodes > SHEET_CELLS * 8) throw new Error('Worksheet XML exceeds structural limits');
    const attribute = (name: string) => tag.attributes[name]?.value;
    if (tag.local === 'row') {
      if (++rows > SHEET_ROWS) throw new Error('Too many worksheet rows');
      boundedInteger(attribute('r'), SHEET_ROWS);
      const spans = attribute('spans');
      if (spans) {
        const parts = spans.split(':');
        if (parts.length !== 2 || boundedInteger(parts[0], SHEET_COLUMNS) > boundedInteger(parts[1], SHEET_COLUMNS)) throw new Error('Invalid worksheet row span');
      }
    }
    if (tag.local === 'c') {
      if (++cells > SHEET_CELLS) throw new Error('Too many worksheet cells');
      boundedAddress(attribute('r') ?? '');
    }
    if (tag.local === 'col' && boundedInteger(attribute('min'), SHEET_COLUMNS) > boundedInteger(attribute('max'), SHEET_COLUMNS)) {
      throw new Error('Invalid worksheet column span');
    }
    if (tag.local === 'mergeCell' && ++merges > 1024) throw new Error('Too many worksheet merges');
    // ExcelJS expands merges and data validations into cells during load, not during our later row checks.
    for (const name of ['ref', 'sqref']) {
      const value = attribute(name);
      if (value !== undefined) {
        let references = 0;
        for (const match of value.matchAll(/\S+/g)) {
          if (++references > SHEET_CELLS) throw new Error('Too many worksheet references');
          const area = boundedRange(match[0]);
          if (tag.local === 'mergeCell' || tag.local === 'dataValidation') {
            expandedCells += area;
            if (expandedCells > SHEET_CELLS) throw new Error('Worksheet range expansion exceeds import limit');
          }
        }
        if (!references) throw new Error('Empty worksheet reference');
      }
    }
    if ((tag.local === 'mergeCell' && !attribute('ref')) || (tag.local === 'dataValidation' && !attribute('sqref'))) throw new Error('Missing worksheet range');
  });
  parser.on('closetag', () => { depth--; });
  parser.write(new TextDecoder('utf-8', { fatal: true }).decode(buffer)).close();
}

export async function validateXlsxArchive(buffer: Buffer): Promise<Buffer> {
  const parser = Parse({ forceStream: true });
  const source = Readable.from([buffer]);
  let current: Readable | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const stop = () => { parser.destroy(new Error('ZIP validation timed out')); };
  controller.signal.addEventListener('abort', stop, { once: true });
  // A parser error must also terminate the entry pipeline, not leave it waiting.
  parser.on('error', error => current?.destroy(error));
  try {
    source.pipe(parser);
    const safe = new JSZip();
    let total = 0;
    let entries = 0;
    let worksheets = 0;
    const names = new Set<string>();
    for await (const entry of parser) {
      current = entry;
      if (++entries > XLSX_LIMITS.entries) throw new Error('Too many ZIP entries');
      if ((entry.vars.flags & 0x41) || ![0, 8].includes(entry.vars.compressionMethod)) {
        throw new Error('Encrypted or unsupported ZIP entry');
      }
      if (!entry.path || names.has(entry.path) || entry.path.includes('\\') || entry.path.startsWith('/') || entry.path.split('/').some(part => part === '..' || part === '.')) {
        throw new Error('Invalid ZIP entry name');
      }
      names.add(entry.path);
      let bytes = 0;
      const chunks: Buffer[] = [];
      // Count actual output, including directories; declared sizes are not a budget.
      await pipeline(entry, new Writable({
        write(chunk: Buffer, _encoding, done) {
          bytes += chunk.length;
          total += chunk.length;
          if (bytes > XLSX_LIMITS.entryBytes || total > XLSX_LIMITS.totalBytes) return done(new Error('ZIP expansion limit exceeded'));
          chunks.push(chunk);
          done();
        },
      }), { signal: controller.signal });
      if (!(entry.vars.flags & 8) && bytes !== entry.vars.uncompressedSize) throw new Error('ZIP size mismatch');
      if (entry.type === 'Directory' && bytes) throw new Error('Nonempty ZIP directory');
      const content = Buffer.concat(chunks);
      // Match ExcelJS's worksheet path recognition, including its unanchored pattern.
      if (/xl\/worksheets\/sheet\d+[.]xml/.test(entry.path)) {
        if (++worksheets > 10) throw new Error('Too many worksheets');
        validateWorksheetXml(content);
      }
      safe.file(entry.path, content, { dir: entry.type === 'Directory', createFolders: false });
    }
    if (!entries) throw new Error('Empty ZIP');
    // Metadata-only validation rejects unsupported central-directory encryption/methods.
    await JSZip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
    // ExcelJS receives bounded STORE entries, not a second interpretation of the upload.
    return await safe.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  } catch {
    throw new Error('XLSX 壓縮檔無效、已加密或超過解壓縮限制，請分批或改用 CSV 匯入。');
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', stop);
    source.destroy();
    current?.destroy();
    parser.destroy();
  }
}
