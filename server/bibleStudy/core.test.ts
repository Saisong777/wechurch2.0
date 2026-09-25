import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { createReader, parsePassage, sourceIds } from './core.mjs';
import { bibleStudyRoutes, bibleStudyCreditsRoutes } from './routes';

it('parses explicit discontinuous ranges without adding intervening verses', () => {
  expect(parsePassage('詩38:3,18')).toEqual([19038003, 19038018]);
  expect(parsePassage('John 3:16–18')).toEqual([43003016, 43003017, 43003018]);
  for (const text of ['../.env', '詩151:1', '約3:18-16', '約3:0', '約3:177']) expect(() => parsePassage(text)).toThrow();
});

const directory = path.resolve(process.env.BIBLE_STUDY_DIR || 'bible-study-data');
const filename = path.join(directory, 'data/core.sqlite');
describe.skipIf(!fs.existsSync(filename))('delivered Bible study database acceptance', () => {
  const reader = fs.existsSync(filename) ? createReader(filename) : null;
  const query = (a: string, q = {}) => reader!.query(a, q);
  afterAll(() => reader?.close());
  it('only includes approved sources and translations', () => {
    const info = query('info');
    expect(info.books).toHaveLength(66);
    expect(info.sources.map((s: { id: string }) => s.id).sort()).toEqual([...sourceIds].sort());
    expect(Object.keys(info.translations)).toEqual(['cmn-cu89t', 'cmncbt', 'engwebp']);
    expect(info.default_translation).toBe('cmn-cu89t');
  });
  it('retains merged verses and attribution', () => {
    const verses = query('chapter', { book: 43, chapter: 3, translation: 'cmncbt' });
    expect(verses.find((v: { verse: number }) => v.verse === 23).end_verse).toBe(24);
    expect(verses.find((v: { verse: number }) => v.verse === 16).metadata.license_url).toContain('https://');
    expect(query('chapter', { book: 43, chapter: 3, translation: 'engwebp' })).toHaveLength(36);
  });
  it('defaults to the attributed CUV and preserves its merged verse ranges', () => {
    const first = query('chapter', { book: 1, chapter: 1 })[0];
    expect(first.body).toBe('起初，上帝創造天地。');
    expect(first.source_id).toBe('cmn-cu89t');
    expect(first.license).toBe('Public-Domain');
    expect(first.metadata.download_sha256).toBe('49aca5dffaeeb27c24f05ec30a7e64080f36c0e132095b83f2773b2c9b4455b7');
    const merged = query('chapter', { book: 1, chapter: 24 }).find((v: { verse: number }) => v.verse === 29);
    expect(merged.end_verse).toBe(30);
    expect(query('preview', { q: '創24:30' }).verses[0].body).toBe(merged.body);
    const results = query('search', { q: '創造天地', source: 'cmn-cu89t' });
    expect(results.length).toBeGreaterThan(0);
    expect(query('item', { id: results[0].id }).source_id).toBe('cmn-cu89t');
  });
  it('returns Chinese commentaries from each allowed reference source', () => {
    for (const source of query('info').note_sources) {
      const notes = query('notes', { book: 43, chapter: 3, verse: 16, source });
      expect(notes.every((n: { source_id: string; license: string }) => n.source_id === source && n.license)).toBe(true);
    }
  });
  it('preserves Hebrew tokens and Greek limitation', () => {
    const hebrew = query('tokens', { book: 1, chapter: 1, verse: 1 });
    expect(hebrew.tokens).toHaveLength(7);
    expect(hebrew.tokens.flatMap((t: { terms: string[] }) => t.terms)).toContain('H1254');
    expect(hebrew.attributions).toHaveLength(2);
    const greek = query('tokens', { book: 43, chapter: 3, verse: 16 });
    expect(greek.tokens.length).toBeGreaterThan(15);
    expect(greek.note).toContain('尚未逐詞對齊');
    expect(query('dictionary', { term: 'G25' })[0].source_id).toBe('step-abbott-smith');
    expect(query('dictionary', { term: 'H1' })[0].definition).toBeTruthy();
  });
  it('previews exact discontinuous references and cross references', () => {
    expect(query('preview', { q: '詩38:3,18', translation: 'engwebp' }).verses.map((v: { reference: string }) => v.reference)).toEqual(['詩 38:3', '詩 38:18']);
    expect(query('xrefs', { book: 43, chapter: 3, verse: 16 }).length).toBeGreaterThan(5);
  });
  it('supports indexed and two-character Chinese searches with no SQL injection', () => {
    expect(query('search', { q: '創造天地' }).length).toBeGreaterThan(0);
    expect(query('search', { q: '上帝', source: 'cmncbt' }).length).toBeGreaterThan(0);
    expect(query('search', { q: '" OR *' })).toEqual([]);
    expect(() => query('search', { q: '上帝', source: 'cuv1919' })).toThrow();
  });
  it('rejects unapproved sources, invalid chapter/verse, ranges and actions', () => {
    for (const [a, q] of [['chapter', { translation: 'cuv1919' }], ['chapter', { book: '1.5' }], ['chapter', { book: 66, chapter: 23 }], ['notes', { source: 'TAHOT' }], ['item', { id: '../.env' }], ['preview', { start: 0 }], ['private', {}]] as const) expect(() => query(a, q)).toThrow();
  });
  it('cannot mutate the SQLite file in read-only mode', () => {
    const db = new DatabaseSync(filename, { readOnly: true });
    expect(() => db.exec("INSERT INTO settings(key,value) VALUES('test-write','blocked')")).toThrow();
    db.close();
  });
  it('serves same-origin read API with strict query and method checks', async () => {
    const app = express();
    app.use('/api/bible-study', bibleStudyRoutes()); app.use('/open', bibleStudyCreditsRoutes());
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      expect((await fetch(origin + '/api/bible-study/info')).status).toBe(200);
      for (const [url, status] of [['/api/bible-study/chapter?book=1&book=2', 400], ['/api/bible-study/chapter?file=../../.env', 400], ['/api/bible-study/private', 404], ['/open/data/core.sqlite', 404], ['/open/../../library/bible-reference.sqlite', 404]] as const) expect((await fetch(origin + url)).status).toBe(status);
      expect((await fetch(origin + '/api/bible-study/info', { method: 'POST' })).status).toBe(405);
      expect((await fetch(origin + '/api/bible-study/info', { method: 'HEAD' })).headers.get('access-control-allow-origin')).toBeNull();
      const licenses = await (await fetch(origin + '/open/licenses')).text();
      for (const phrase of ['Copyright 2010', 'Original work of the Open Scriptures Hebrew Bible', 'https://www.stepbible.org', 'CC-BY-SA-4.0', 'Biblica®']) expect(licenses).toContain(phrase);
    } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  }, 30000);
});
