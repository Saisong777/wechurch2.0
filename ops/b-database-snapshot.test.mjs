import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshotProofSql } from './b-database-snapshot.mjs';
import { assertTableProofMatches } from './verify-b-recovery-set.mjs';

const entry=(table,rows=1,digest='a'.repeat(32),schema='public')=>({schema,table,rows,digest});

test('snapshot explicitly orders catalog and JSON output without changing row digests',()=>{
  assert.match(snapshotProofSql,/ORDER BY schemaname::text COLLATE "C",tablename::text COLLATE "C"/);
  assert.match(snapshotProofSql,/json_agg\(t ORDER BY schema COLLATE "C","table" COLLATE "C"\)/);
  assert.match(snapshotProofSql,/md5\(row_to_json\(t\)::text\)/);
  assert.match(snapshotProofSql,/string_agg\(h,'' ORDER BY h\)/);
  assert.match(snapshotProofSql,/SET TRANSACTION SNAPSHOT '__SNAPSHOT__'/);
  assert.match(snapshotProofSql,/SET TIME ZONE 'UTC'/);
});

test('legacy locale order and catalog order compare equal by table identity',()=>{
  const expected=[entry('__drizzle_migrations',3,'b'.repeat(32),'drizzle'),entry('devotional_notes'),entry('devotion_wall_posts'),entry('personal_prayers'),entry('person_identity_links')];
  const actual=[expected[4],expected[2],expected[0],expected[1],expected[3]];
  assert.doesNotThrow(()=>assertTableProofMatches(actual,expected));
  assert.deepEqual(actual.map(t=>t.table),['person_identity_links','devotion_wall_posts','__drizzle_migrations','devotional_notes','personal_prayers']);
});

test('content differences still fail with only table names, counts and hashes',()=>{
  assert.throws(()=>assertTableProofMatches([entry('notes',2,'b'.repeat(32))],[entry('notes')]),error=>{
    assert.equal(error.name,'TableProofMismatchError');
    assert.deepEqual(error.tableMismatches,[{table:'public.notes',expectedRows:1,actualRows:2,expectedHash:'a'.repeat(32),actualHash:'b'.repeat(32)}]);
    return true;
  });
});

test('same-count corruption and count-only mismatches are not accepted',()=>{
  assert.throws(()=>assertTableProofMatches([entry('notes',1,'b'.repeat(32))],[entry('notes')]),{name:'TableProofMismatchError'});
  assert.throws(()=>assertTableProofMatches([entry('notes',2)],[entry('notes')]),{name:'TableProofMismatchError'});
});

test('missing, unexpected and moved-schema tables are not accepted',()=>{
  for(const [actual,expected] of [[[],[entry('notes')]],[[entry('notes')],[]],[[entry('notes',1,'a'.repeat(32),'drizzle')],[entry('notes')]]]) {
    assert.throws(()=>assertTableProofMatches(actual,expected),{name:'TableProofMismatchError'});
  }
});

test('duplicates and malformed proof entries fail closed on both sides',()=>{
  for(const invalid of [
    [entry('notes'),entry('notes')],
    [entry('notes',-1)],
    [entry('notes',1,'not-a-digest')],
    [entry('notes',1,'a'.repeat(32),'private')],
    [entry('notes"; select 1; --')],
    [{...entry('notes'),content:'must not be logged'}],
  ]) {
    assert.throws(()=>assertTableProofMatches(invalid,[entry('notes')]));
    assert.throws(()=>assertTableProofMatches([entry('notes')],invalid));
  }
});
