import { DatabaseSync } from 'node:sqlite';
import { releaseId } from '../../scripts/bible-study-assets.mjs';

// The v2 reference release adds a pinned eBible CUV without changing the v1 sources.
export const names = '創世記 出埃及記 利未記 民數記 申命記 約書亞記 士師記 路得記 撒母耳記上 撒母耳記下 列王紀上 列王紀下 歷代志上 歷代志下 以斯拉記 尼希米記 以斯帖記 約伯記 詩篇 箴言 傳道書 雅歌 以賽亞書 耶利米書 耶利米哀歌 以西結書 但以理書 何西阿書 約珥書 阿摩司書 俄巴底亞書 約拿書 彌迦書 那鴻書 哈巴谷書 西番雅書 哈該書 撒迦利亞書 瑪拉基書 馬太福音 馬可福音 路加福音 約翰福音 使徒行傳 羅馬書 哥林多前書 哥林多後書 加拉太書 以弗所書 腓立比書 歌羅西書 帖撒羅尼迦前書 帖撒羅尼迦後書 提摩太前書 提摩太後書 提多書 腓利門書 希伯來書 雅各書 彼得前書 彼得後書 約翰一書 約翰二書 約翰三書 猶大書 啟示錄'.split(' ');
const shorts = '創 出 利 民 申 書 士 得 撒上 撒下 王上 王下 代上 代下 拉 尼 斯 伯 詩 箴 傳 歌 賽 耶 哀 結 但 何 珥 摩 俄 拿 彌 鴻 哈 番 該 亞 瑪 太 可 路 約 徒 羅 林前 林後 加 弗 腓 西 帖前 帖後 提前 提後 多 門 來 雅 彼前 彼後 約一 約二 約三 猶 啟'.split(' ');
const osis = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const aliases = new Map(names.flatMap((name, i) => [name, shorts[i], osis[i]].map(n => [n.toLowerCase(), i + 1])));
export const translations = { 'cmn-cu89t': '新標點和合本（繁體）', cmncbt: 'Biblica® 當代譯本開放資源（繁體）', engwebp: 'World English Bible' };
export const noteSources = ['aquiferopenstudynotes-zht', 'uwtranslationnotes-zht', 'biblicastudynotes-zht', 'aquiferopenbibledictionary-zht', 'uwtranslationwords-zht'];
export const sourceIds = [...Object.keys(translations), ...noteSources, 'oshb', 'sblgnt', 'step-abbott-smith', 'step-hebrew-forms', 'openbible-crossrefs'];
export const actions = ['info', 'chapter', 'notes', 'tokens', 'dictionary', 'xrefs', 'preview', 'search', 'item'];
const sql = 'SELECT e.*,s.name source_name,s.license,s.metadata FROM entries e JOIN sources s ON s.id=e.source_id';
const passageSql = sql.replace('SELECT e.*,', 'SELECT p.start_ref,p.end_ref,e.*,') + ' JOIN passages p ON p.entry_rowid=e.rowid';
const metadata = r => ({ ...r, metadata: JSON.parse(r.metadata) });
const record = r => ({ ...metadata(r), extra: JSON.parse(r.extra) });
const credit = r => ({ source_id: r.source_id || r.id, source_name: r.source_name || r.name, license: r.license, metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata });
const reference = n => `${shorts[Math.floor(n / 1000000) - 1]} ${Math.floor(n % 1000000 / 1000)}:${n % 1000}`;
const invalid = () => { throw Object.assign(new Error('查不到資料或輸入格式不正確，請調整後再試。'), { status: 400 }); };
const integer = (value, low, high) => {
  const n = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(n) || n < low || n > high) invalid();
  return n;
};
const validRef = n => {
  integer(n, 1001001, 66150176);
  integer(Math.floor(n / 1000000), 1, 66);
  integer(Math.floor(n % 1000000 / 1000), 1, 150);
  integer(n % 1000, 1, 176);
};
export function parsePassage(text) {
  const match = /^(.*?)\s*(\d+)[:：章]\s*(\d+(?:\s*[-–,，、]\s*\d+)*)節?$/.exec(text.trim());
  if (!match || !aliases.has(match[1].trim().toLowerCase())) invalid();
  const base = aliases.get(match[1].trim().toLowerCase()) * 1000000 + integer(match[2], 1, 150) * 1000;
  const refs = new Set();
  for (const part of match[3].split(/[,，、]/)) {
    const ends = part.split(/[-–]/).map(v => v.trim());
    const lo = integer(ends[0], 1, 176), hi = integer(ends.at(-1), lo, 176);
    for (let v = lo; v <= hi; v++) refs.add(base + v);
  }
  return [...refs];
}

export function createReader(filename) {
  const db = new DatabaseSync(filename, { readOnly: true, allowExtension: false });
  const all = (query, ...params) => db.prepare(query).all(...params);
  const one = (query, ...params) => db.prepare(query).get(...params);
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;');
  const sources = all('SELECT * FROM sources').map(metadata);
  if (sources.length !== sourceIds.length || sources.some(s => !sourceIds.includes(s.id))) {
    db.close(); throw new Error('Unexpected Bible study sources');
  }
  const books = names.map((name, i) => ({ id: i + 1, name, chapters: 0 }));
  for (const { start_ref: n } of all("SELECT p.start_ref FROM passages p JOIN entries e ON e.rowid=p.entry_rowid WHERE e.source_id='cmncbt'")) {
    const book = books[Math.floor(n / 1000000) - 1];
    book.chapters = Math.max(book.chapters, Math.floor(n % 1000000 / 1000));
  }
  const rowsFor = (sid, lo, hi) => all(passageSql + ' WHERE e.source_id=? AND p.start_ref<=? AND p.end_ref>=? ORDER BY p.start_ref,e.id LIMIT 181', sid, hi, lo);
  const lexical = term => {
    const prefix = term[0] + String(Number(term.slice(1))).padStart(4, '0');
    return all(sql + " WHERE e.source_id IN ('step-abbott-smith','step-hebrew-forms') AND e.body LIKE ?", `${prefix}%\t%`).filter(r => {
      const match = /^([GH])0*(\d+)[A-Za-z]?$/.exec(r.body.split('\t')[0]);
      return match && match[1] + Number(match[2]) === term;
    });
  };
  return {
    close: () => db.close(),
    query(action, q = {}) {
      if (!actions.includes(action)) throw Object.assign(new Error('找不到此功能'), { status: 404 });
      const sid = q.translation || 'cmn-cu89t';
      if (!Object.hasOwn(translations, sid)) invalid();
      if (action === 'info') return { books, translations, sources, release_id: releaseId, default_translation: 'cmn-cu89t', copyright_url: '/open/licenses', note_sources: noteSources };
      if (action === 'item') {
        const row = one(sql + ' WHERE e.id=?', q.id || '');
        if (!row) invalid();
        return record(row);
      }
      if (action === 'search') {
        const term = (q.q || '').trim();
        if (term.length < 2 || term.length > 100 || (q.source && !sourceIds.includes(q.source))) invalid();
        const filter = q.source ? ' AND e.source_id=?' : '', args = q.source ? [q.source] : [];
        const rows = [...term].length >= 3
          ? all(sql + ' WHERE e.rowid IN (SELECT rowid FROM search_index WHERE search_index MATCH ?)' + filter + ' LIMIT 40', `"${term.replaceAll('"', '""')}"`, ...args)
          : all(sql + ' WHERE (instr(e.title,?)>0 OR instr(e.body,?)>0)' + filter + ' LIMIT 40', term, term, ...args);
        return rows.map(r => ({ id: r.id, title: r.title, preview: r.body.slice(0, 170), ...credit(r) }));
      }
      if (action === 'dictionary') {
        let term = (q.term || '').toUpperCase();
        if (!/^[GH][0-9]{1,5}$/.test(term)) invalid();
        term = term[0] + Number(term.slice(1));
        return [...lexical(term).map(r => {
          const f = r.body.split('\t');
          return { ...record(r), word: f[3], pronunciation: f[4], gloss: f[6], definition: f.length > 7 ? f.slice(7).join('\t') : f[6] };
        }), ...all(sql + " WHERE e.source_id='uwtranslationwords-zht' AND e.rowid IN (SELECT entry_rowid FROM terms WHERE term=?) ORDER BY e.title", term).map(record)];
      }
      if (action === 'preview') {
        const ranges = q.q ? parsePassage(q.q).map(n => [n, n]) : [[Number(q.start), Number(q.end || q.start)]];
        const seen = new Set(), verses = [];
        for (const [lo, hi] of ranges) {
          validRef(lo); validRef(hi); if (hi < lo) invalid();
          for (const r of rowsFor(sid, lo, hi)) {
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            verses.push({ id: r.id, reference: reference(r.start_ref) + (r.end_ref !== r.start_ref ? `－${reference(r.end_ref)}` : ''), body: r.body, url: r.original_url, ...credit(r) });
            if (verses.length > 180) invalid();
          }
        }
        return { verses, translation: translations[sid] };
      }
      const b = integer(q.book || 1, 1, 66), ch = integer(q.chapter || 1, 1, books[b - 1].chapters), v = integer(q.verse || 1, 1, 176);
      const base = b * 1000000 + ch * 1000, n = base + v;
      if (action === 'chapter') return all(passageSql + ' WHERE e.source_id=? AND p.start_ref BETWEEN ? AND ? ORDER BY p.start_ref', sid, base + 1, base + 999)
        .map(r => ({ id: r.id, verse: r.start_ref % 1000, end_verse: r.end_ref % 1000, body: r.body, ...credit(r) }));
      if (action === 'notes') {
        if (q.source && !noteSources.includes(q.source)) invalid();
        const selected = q.source ? ' AND e.source_id=?' : '';
        return all(sql + ` JOIN passages p ON p.entry_rowid=e.rowid WHERE e.source_id IN (${noteSources.map(() => '?').join(',')}) AND p.start_ref<=? AND p.end_ref>=?` + selected
          + " GROUP BY e.id ORDER BY CASE WHEN e.source_id='aquiferopenbibledictionary-zht' THEN 1 ELSE 0 END,min(p.end_ref-p.start_ref),e.source_id,e.id LIMIT 200", ...noteSources, n, n, ...(q.source ? [q.source] : [])).map(record);
      }
      if (action === 'xrefs') return all('SELECT start_ref,end_ref,votes FROM xrefs WHERE origin=? ORDER BY votes DESC LIMIT 60', n)
        .map(r => ({ start: r.start_ref, end: r.end_ref, label: reference(r.start_ref) + (r.end_ref !== r.start_ref ? `－${reference(r.end_ref)}` : ''), votes: r.votes }));
      const original = rowsFor(b <= 39 ? 'oshb' : 'sblgnt', n, n);
      const tokens = [];
      for (const row of original) {
        if (b > 39) {
          tokens.push(...row.body.trim().split(/\s+/).map(word => ({ word, gloss: '', pronunciation: '', morph: '', terms: [] })));
        } else for (const line of row.body.split('\n')) {
          const tab = line.indexOf('\t'); if (tab < 0) continue;
          const m = JSON.parse(line.slice(tab + 1));
          const terms = [...new Set((m.lemma?.match(/\d+/g) || []).map(t => `H${Number(t)}`))];
          const fields = terms.length ? lexical(terms[0])[0]?.body.split('\t') : [];
          tokens.push({ word: line.slice(0, tab).replaceAll('/', ''), terms, morph: m.morph || '', gloss: fields?.[6] || '', pronunciation: fields?.[4] || '' });
        }
      }
      return { tokens, source: original[0] ? record(original[0]) : null,
        attributions: [...(original[0] ? [credit(original[0])] : []), ...(b <= 39 ? [credit(sources.find(s => s.id === 'step-hebrew-forms'))] : [])],
        language: b <= 39 ? 'he' : 'el', note: b <= 39 ? 'OSHB 希伯來文與 STEP 英文簡義；不是中文逐字對齊。原文章節編號可能與譯本不同。' : 'SBL 希臘文尚未逐詞對齊中文；可用 G 字號查字典。' };
    },
  };
}
