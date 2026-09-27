const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { pgConfig, isLocalDatabase } = require('./content-tables.cjs');

test('remote TLS verifies certificates and preserves explicit CA through driver URL parsing', () => {
  const ca = '-----BEGIN CERTIFICATE-----\nfixture-only\n-----END CERTIFICATE-----';
  const options = pgConfig('postgresql://user:password@db.example.test/db?sslmode=verify-full&application_name=export', { ca });
  const client = new Client(options); // Configuration only; never connect.
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.ssl.ca, ca);
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  assert.equal(pgConfig('postgresql://db.example.test/db', { ca: undefined }).ssl.rejectUnauthorized, true);
});

test('remote TLS rejects connection-string downgrades and replacement options', () => {
  for (const query of ['sslmode=disable', 'sslmode=no-verify', 'sslmode=require', 'sslmode=verify-ca', 'ssl=0', 'ssl=false', 'ssl=true', 'sslrootcert=anything', 'sslcert=anything', 'uselibpqcompat=true', 'sslmode=verify-full&sslmode=disable']) {
    assert.throws(() => pgConfig(`postgresql://db.example.test/db?${query}`), /TLS must verify/);
  }
  assert.throws(() => pgConfig('postgresql://db.example.test/db', { ca: 'bad' }), /PEM CA/);
});

test('only literal loopback hosts get the local exception; query hosts cannot bypass it', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(isLocalDatabase(`postgresql://${host}/db`), true);
    assert.equal(pgConfig(`postgresql://${host}/db`).ssl, undefined);
    assert.throws(() => pgConfig(`postgresql://${host}/db?host=remote.test`), /endpoint overrides/);
  }
  for (const host of ['localhost.evil.test', '127.0.0.2', 'db.example.test']) {
    assert.equal(isLocalDatabase(`postgresql://${host}/db`), false);
    assert.equal(pgConfig(`postgresql://${host}/db`).ssl.rejectUnauthorized, true);
  }
});
