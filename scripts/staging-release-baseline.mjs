export function assertReleaseBaseline({ fingerprint, expected, records, origin, isAncestor }) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint || '')) throw new Error('Invalid live B fingerprint');
  if (expected && fingerprint !== expected) throw new Error('B changed during validation; merge and validate again before deployment');
  const candidates = records.filter(record => record.environment === 'staging' && record.origin === origin &&
    record.fingerprint === fingerprint && record.sourceMatchesCommit === true && /^[a-f0-9]{40}$/.test(record.sourceCommit || ''));
  if (!candidates.length) throw new Error('Live B release has no verified source record in this checkout; recover its release record first');
  if (!candidates.some(record => isAncestor(record.sourceCommit))) throw new Error('Live B contains unmerged work; merge its source before deployment');
  return fingerprint;
}

export function assertKnownMigrations(applied, local) {
  for (const row of applied) {
    if (!local.some(entry => Number(row.created_at) === entry.when && row.hash === entry.hash)) {
      throw new Error('B has a migration missing or changed in this checkout; merge the deployed source first');
    }
  }
}
