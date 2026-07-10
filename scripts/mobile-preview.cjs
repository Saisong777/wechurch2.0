#!/usr/bin/env node

const { spawn } = require('node:child_process');

const rawUrl = process.argv[2] || process.env.MOBILE_PREVIEW_URL || 'http://localhost:5099/';
const width = process.env.MOBILE_PREVIEW_WIDTH || '390';
const height = process.env.MOBILE_PREVIEW_HEIGHT || '844';
const userDataDir = process.env.MOBILE_PREVIEW_PROFILE || '/tmp/wechurch-mobile-preview';
const chromeApp = process.env.CHROME_APP || 'Google Chrome';

const args = [
  '-na',
  chromeApp,
  '--args',
  `--app=${rawUrl}`,
  `--window-size=${width},${height}`,
  `--user-data-dir=${userDataDir}`,
  '--force-device-scale-factor=1',
  '--hide-crash-restore-bubble',
];

const child = spawn('open', args, {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log(`Opened WeChurch mobile preview: ${rawUrl} (${width}x${height})`);
    return;
  }

  console.error('Failed to open Chrome mobile preview.');
  process.exit(code || 1);
});
