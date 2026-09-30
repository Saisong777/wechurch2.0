import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { withDisposableRestore } from './verify-b-recovery-set.mjs';

function fixture(t) {
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'wechurch-cleanup-test-'));
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const backup=path.join(parent,'backup.enc');
  const previous=path.join(parent,'restore-previous');
  fs.writeFileSync(backup,'encrypted fixture');
  fs.mkdirSync(previous);
  fs.writeFileSync(path.join(previous,'untouched'),'previous run');
  return {parent,backup,previous};
}

function writePlaintext(restore) {
  fs.writeFileSync(path.join(restore,'database.dump'),'synthetic dump');
  for(const name of ['uploads','reference']) {
    fs.mkdirSync(path.join(restore,name));
    fs.writeFileSync(path.join(restore,name,'fixture'),'synthetic plaintext');
  }
}

test('success removes only this run after resource shutdown, before returning its result',async t=>{
  const {parent,backup,previous}=fixture(t);
  let created;
  const order=[];
  const result=await withDisposableRestore(parent,async restore=>{
    created=restore;writePlaintext(restore);
    assert.equal(fs.statSync(restore).mode&0o777,0o700);
    try { return {verified:true}; }
    finally {
      await Promise.resolve();order.push('db ended');
      assert(fs.existsSync(restore));order.push('container stopped');
    }
  });
  assert.deepEqual(order,['db ended','container stopped']);
  assert.deepEqual(result,{verified:true,temporaryPlaintextRemoved:true});
  assert(!fs.existsSync(created));
  assert(!Object.hasOwn(result,'restoreDirectory'));
  assert.equal(fs.readFileSync(backup,'utf8'),'encrypted fixture');
  assert.equal(fs.readFileSync(path.join(previous,'untouched'),'utf8'),'previous run');
});

for(const phase of ['key loading','decryption','extraction','verification','db shutdown','container shutdown']) {
  test(`failure during ${phase} still removes this run's plaintext`,async t=>{
    const {parent}=fixture(t);
    let created;
    const original=new Error(`synthetic ${phase} failure`);
    await assert.rejects(withDisposableRestore(parent,async restore=>{
      created=restore;
      if(phase!=='key loading')writePlaintext(restore);
      throw original;
    }),error=>{
      assert.equal(error,original);
      assert.equal(error.temporaryPlaintextRemoved,true);
      assert(!fs.existsSync(created));
      return true;
    });
  });
}

test('a failed removal cannot produce a success claim',async t=>{
  const {parent}=fixture(t);
  let created;
  const rm=t.mock.method(fs,'rmSync',()=>{throw new Error('synthetic permission failure');});
  try {
    await assert.rejects(withDisposableRestore(parent,async restore=>{
      created=restore;writePlaintext(restore);return {verified:true};
    }),error=>{
      assert.equal(error.name,'RestoreCleanupError');
      assert.equal(error.temporaryPlaintextRemoved,false);
      assert(fs.existsSync(created));
      return true;
    });
  } finally {rm.mock.restore();}
});

test('a no-op removal is detected by filesystem readback',async t=>{
  const {parent}=fixture(t);
  const rm=t.mock.method(fs,'rmSync',()=>{});
  try {
    await assert.rejects(withDisposableRestore(parent,async restore=>{
      writePlaintext(restore);return {verified:true};
    }),{name:'RestoreCleanupError',temporaryPlaintextRemoved:false});
  } finally {rm.mock.restore();}
});

test('cleanup refuses a substituted link and preserves its target',async t=>{
  const {parent,previous}=fixture(t);
  await assert.rejects(withDisposableRestore(parent,async restore=>{
    fs.rmdirSync(restore);
    fs.symlinkSync(previous,restore);
    return {verified:true};
  }),{name:'RestoreCleanupError',temporaryPlaintextRemoved:false});
  assert.equal(fs.readFileSync(path.join(previous,'untouched'),'utf8'),'previous run');
});
