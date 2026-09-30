import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectStaging, stagingSql, root } from '../scripts/railway-staging.mjs';

inspectStaging();
const file = path.join(root, 'artifacts/railway-staging/note-journal-fixture.json');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const mode = process.argv[2];
assert(['prepare', 'cleanup'].includes(mode));
if (mode === 'prepare') {
  assert(!fs.existsSync(file) || JSON.parse(fs.readFileSync(file, 'utf8')).cleanedAt);
  const owner = JSON.parse(stagingSql(`SELECT coalesce(json_agg(t),'[]') FROM (SELECT id FROM users WHERE lower(email)=${literal(process.env.WECHURCH_QA_RECIPIENT || '')}) t`));
  assert.equal(owner.length, 1);
  const fixture = { owner: owner[0].id, ids: [randomUUID(), randomUUID(), randomUUID()] };
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  const observation = Array.from({ length: 18 }, (_, i) => `${i === 0 ? '這是版面驗收文字，不是真實私人筆記。\n\n' : ''}今天，我留意身旁的人，也給自己一點安靜的時間。看見日常裡小小的善意，我想記下這份感謝，日後回頭閱讀。`).join('\n\n');
  stagingSql(`BEGIN;
    INSERT INTO devotional_notes(id,user_id,verse_reference,verse_text,title_phrase,observation,core_insight_note,action_plan,source_label,created_at,updated_at) VALUES
    (${literal(fixture.ids[0])},${literal(fixture.owner)},'詩篇 23:1','耶和華是我的牧者，我必不致缺乏。','閱讀驗收：在日常裡學習愛與感謝',${literal(observation)},'安靜領受，也練習把愛活在生活裡。','今天關心一位身旁的人。','版面驗收（測試）',now(),now());
    INSERT INTO devotional_notes(id,user_id,verse_reference,verse_text,observation,source_label,source_devotional_date) VALUES
    (${literal(fixture.ids[1])},${literal(fixture.owner)},'約翰福音 3:16','神愛世人。','這是舊日期筆記的版面驗收，保留原日期與換行。\n第二段原文。','版面驗收（測試）','2026-07-01'),
    (${literal(fixture.ids[2])},${literal(fixture.owner)},'空白筆記驗收','','','版面驗收（測試）','2026-06-01');
    COMMIT;`);
  assert.equal(Number(stagingSql(`SELECT count(*) FROM devotional_notes WHERE id IN (${fixture.ids.map(literal).join(',')}) AND user_id=${literal(fixture.owner)} AND source_label='版面驗收（測試）'`)), 3);
  console.log({ prepared: true, syntheticPrivateNotes: 3, productionUnchanged: true });
} else {
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.match(fixture.owner, /^[a-f0-9-]{36}$/);
  assert.equal(fixture.ids.length, 3);
  for (const id of fixture.ids) assert.match(id, /^[a-f0-9-]{36}$/);
  const ids = fixture.ids.map(literal).join(',');
  stagingSql(`BEGIN;
    DO $guard$ BEGIN
    IF EXISTS(SELECT 1 FROM devotional_notes WHERE id IN (${ids}) AND (user_id<>${literal(fixture.owner)} OR source_label IS DISTINCT FROM '版面驗收（測試）')) THEN RAISE EXCEPTION 'Fixture changed owner or source'; END IF;
    IF EXISTS(SELECT 1 FROM devotion_wall_posts WHERE source_note_id IN (${ids})) OR EXISTS(SELECT 1 FROM life_group_shares WHERE kind='note' AND source_id IN (${ids})) THEN RAISE EXCEPTION 'Fixture has been shared; cleanup refused'; END IF;
    END $guard$;
    DELETE FROM devotional_notes WHERE id IN (${ids}) AND user_id=${literal(fixture.owner)} AND source_label='版面驗收（測試）';
    COMMIT;`);
  assert.equal(Number(stagingSql(`SELECT count(*) FROM devotional_notes WHERE id IN (${ids})`)), 0);
  fs.writeFileSync(file, JSON.stringify({ ...fixture, cleanedAt: new Date().toISOString() }), { mode: 0o600 });
  console.log({ syntheticNotesRemoved: true, productionUnchanged: true });
}
