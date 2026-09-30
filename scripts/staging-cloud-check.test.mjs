import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCloudReleaseCheck, assertHomepageOnlyChanges, requiredCloudSteps } from './staging-cloud-check.mjs';

const commit = 'a'.repeat(40);
const passing = () => ({ headSha: commit, event: 'push', status: 'completed', conclusion: 'success', jobs: [{ name: 'validate', conclusion: 'success', steps: requiredCloudSteps.map(name => ({ name, conclusion: 'success' })) }] });

test('accepts complete cloud checks for the exact source', () => assert.doesNotThrow(() => assertCloudReleaseCheck(passing(), commit)));
test('rejects a different source commit', () => assert.throws(() => assertCloudReleaseCheck(passing(), 'b'.repeat(40))));
test('rejects pending, failed and unrelated events', () => {
  for (const patch of [{ status: 'in_progress' }, { conclusion: 'failure' }, { event: 'schedule' }]) {
    assert.throws(() => assertCloudReleaseCheck({ ...passing(), ...patch }, commit));
  }
});
test('accepts a pull request check of the exact source commit', () => assert.doesNotThrow(() => assertCloudReleaseCheck({ ...passing(), event: 'pull_request' }, commit)));
test('restricts cloud release to homepage files', () => {
  assert.doesNotThrow(() => assertHomepageOnlyChanges(['src/components/home/DailyHome.tsx', 'design/release.md']));
  for (const file of ['server/routes.ts', 'migrations/0023_test.sql', 'src/pages/Login.tsx', 'public/wechurch-handshake.png', 'Dockerfile']) {
    assert.throws(() => assertHomepageOnlyChanges([file]));
  }
  assert.throws(() => assertHomepageOnlyChanges([]));
});
test('rejects every missing or skipped required step', () => {
  for (const name of requiredCloudSteps) {
    const run = passing();
    run.jobs[0].steps = run.jobs[0].steps.filter(step => step.name !== name);
    assert.throws(() => assertCloudReleaseCheck(run, commit));
    run.jobs[0].steps.push({ name, conclusion: 'skipped' });
    assert.throws(() => assertCloudReleaseCheck(run, commit));
  }
});
