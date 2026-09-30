export const requiredCloudSteps = ['Typecheck', 'Unit tests', 'Lint', 'Production build'];

// This path is deliberately limited to the homepage-only release, never backend changes.
export function assertHomepageOnlyChanges(files) {
  const allowed = new Set(['src/components/home/DailyHome.tsx', 'src/components/home/DailyHome.test.tsx', 'src/index.css',
    'public/images/home-community-v3.png', 'scripts/staging-cloud-check.mjs', 'scripts/staging-cloud-check.test.mjs',
    'scripts/railway-staging.mjs', 'package.json']);
  if (!files.length || files.some(file => !allowed.has(file) && !file.startsWith('design/'))) {
    throw new Error('Cloud homepage release cannot include backend, migration, authentication or unrelated changes');
  }
}

export function assertCloudReleaseCheck(run, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit || '') || run.headSha !== commit || !['push', 'pull_request'].includes(run.event) ||
      run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('Cloud release checks must succeed for this exact pushed source commit');
  }
  const job = run.jobs?.find(item => item.name === 'validate' && item.conclusion === 'success');
  if (!job || !requiredCloudSteps.every(name => job.steps?.some(step => step.name === name && step.conclusion === 'success'))) {
    throw new Error('Cloud release is missing one or more required validation steps');
  }
}
