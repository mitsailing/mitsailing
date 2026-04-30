/**
 * After `npm install` / `npm ci`, browser binaries must match the installed
 * `@playwright/test` version (see Playwright + Next.js testing docs). This
 * keeps local `npm run test:e2e` working when the lockfile bumps Playwright.
 *
 * Skips when `CI` (GitHub Actions installs browsers in the e2e job) or when
 * `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (Docker deps stage / opt-out).
 */
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (
  process.env.CI === 'true' ||
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1'
) {
  console.log(
    '[playwright-postinstall] skip (CI or PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)'
  );
  process.exit(0);
}

// Matches default local `test:e2e` (Chromium). Use `npx playwright install` for Firefox/WebKit.
const result = spawnSync('npx', ['playwright', 'install', 'chromium'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

if (result.error) {
  console.error('[playwright-postinstall]', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
