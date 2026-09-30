import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(change){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wechurch-checkpoint-test-'));
  try {
    fs.mkdirSync(path.join(root,'ops'));
    fs.copyFileSync(new URL('./verify-b-checkpoint.mjs',import.meta.url),path.join(root,'ops/verify-b-checkpoint.mjs'));
    fs.writeFileSync(path.join(root,'file.txt'),'fixture');
    const files=[{file:'file.txt',sha256:sha('fixture')}];
    change?.(root,files);
    fs.writeFileSync(path.join(root,'release-manifest.json'),JSON.stringify({files,fingerprint:sha(JSON.stringify(files))}));
    return spawnSync(process.execPath,[path.join(root,'ops/verify-b-checkpoint.mjs')],{encoding:'utf8'});
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
test('verifies exact files without credentials or dependencies',()=>{
  const result=fixture();assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).files,1);
});
test('rejects changed content',()=>{
  assert.notEqual(fixture(root=>fs.writeFileSync(path.join(root,'file.txt'),'changed')).status,0);
});
test('rejects duplicate entries',()=>{
  assert.notEqual(fixture((_root,files)=>files.push({...files[0]})).status,0);
});
test('rejects traversal even if the manifest fingerprint is valid',()=>{
  assert.notEqual(fixture((_root,files)=>{files[0].file='../outside';}).status,0);
});
