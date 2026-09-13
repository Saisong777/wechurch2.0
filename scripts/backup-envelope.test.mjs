import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seal,unseal } from './backup-envelope.mjs';
test('round trips binary archives without exposing plaintext and uses a new nonce',()=>{
  const key=randomBytes(32),input=Buffer.from('PRIVATE_FIXTURE\0資料'),encrypted=seal(input,key);
  assert.deepEqual(unseal(encrypted,key),input);assert(!encrypted.includes(input));
  assert.notDeepEqual(seal(input,key),encrypted);
});
test('rejects wrong keys, corruption and truncated archives before returning plaintext',()=>{
  const key=randomBytes(32),encrypted=seal(Buffer.from('private'),key);
  assert.throws(()=>unseal(encrypted,randomBytes(32)));
  for(const position of [0,20,35,encrypted.length-1]) { const bad=Buffer.from(encrypted);bad[position]^=1;assert.throws(()=>unseal(bad,key)); }
  assert.throws(()=>unseal(encrypted.subarray(0,15),key));assert.throws(()=>seal(Buffer.from('x'),Buffer.alloc(16)));
});
