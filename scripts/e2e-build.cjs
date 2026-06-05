/**
 * Build the Next app with e2e DB and flags before Playwright starts the
 * standalone server. In GitHub Actions, the `build` job already produced `.next`
 * (see CI.yml + cache restore on the e2e job) — set `E2E_SKIP_BUILD=1` to avoid
 * a second full `next build`.
 *
 * E2E reuse requires `.next/e2e.ready` (written after a matching `next build`, or
 * via `node scripts/e2e-build.cjs --write-e2e-ready-marker` in CI) so inlined
 * `NEXT_PUBLIC_APP_URL` matches the Playwright origin (`webServer.url` / `use.baseURL`
 * in playwright.config.ts). Next.js replaces `process.env.NEXT_PUBLIC_*` at build time
 * (see https://nextjs.org/docs/app/guides/environment-variables).
 */
const esbuild = require('esbuild');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const e2eReadyPath = path.join(repoRoot, '.next', 'e2e.ready');

/**
 * Resolves the public app URL this e2e run expects (Playwright `baseURL` / `webServer.url`).
 *
 * @returns {string} - Resolved `NEXT_PUBLIC_APP_URL` or default `http://localhost:<port>`.
 */
function getExpectedE2eAppUrl() {
  const e2ePort = process.env.PLAYWRIGHT_E2E_PORT ?? '3008';
  return process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${e2ePort}`;
}

/**
 * Normalizes to `URL.origin` so trailing slashes or empty paths do not break checks.
 *
 * @param {string} urlString - Absolute URL string (may include path or trailing slash).
 * @returns {string} - Origin only (`protocol` + `host`).
 */
function canonicalPublicAppUrl(urlString) {
  return new URL(urlString).origin;
}

/**
 * Writes `.next/e2e.ready` with a canonical origin for skip-build validation.
 *
 * @param {string} appUrl - Same logical URL passed to `next build` as `NEXT_PUBLIC_APP_URL`.
 * @returns {void}
 */
function writeE2eReadyMarker(appUrl) {
  fs.mkdirSync(path.dirname(e2eReadyPath), { recursive: true });
  const canonical = canonicalPublicAppUrl(appUrl);
  fs.writeFileSync(e2eReadyPath, `NEXT_PUBLIC_APP_URL=${canonical}\n`, 'utf8');
}

/**
 * Parses the first non-empty `KEY=value` line from the marker file.
 *
 * @param {string} contents - Raw UTF-8 file body.
 * @returns {{ error: string } | { url: string }} - Parsed URL or a machine-readable error code.
 */
function parseE2eReadyMarker(contents) {
  const line = contents.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) {
    return { error: 'empty' };
  }
  const idx = line.indexOf('=');
  if (idx === -1) {
    return { error: 'bad_format' };
  }
  const key = line.slice(0, idx).trim();
  const val = line.slice(idx + 1).trim();
  if (key !== 'NEXT_PUBLIC_APP_URL') {
    return { error: 'bad_key' };
  }
  if (!val) {
    return { error: 'empty_value' };
  }
  return { url: val };
}

function assertE2eReadyMarkerOrExit() {
  let expectedOrigin;
  try {
    expectedOrigin = canonicalPublicAppUrl(getExpectedE2eAppUrl());
  } catch {
    console.error(
      '[e2e-build] NEXT_PUBLIC_APP_URL / PLAYWRIGHT_E2E_PORT must form a valid absolute URL (e.g. http://localhost:3008).'
    );
    process.exit(1);
  }
  if (!fs.existsSync(e2eReadyPath)) {
    console.error(
      `[e2e-build] E2E_SKIP_BUILD=1 but ${path.relative(
        repoRoot,
        e2eReadyPath
      )} is missing. This file records the NEXT_PUBLIC_APP_URL used at build time.\n` +
        'Fix: run a full `npm run e2e:build` without E2E_SKIP_BUILD, or in CI ensure the `build` job runs `node scripts/e2e-build.cjs --write-e2e-ready-marker` after `next build` with the same NEXT_PUBLIC_APP_URL as the e2e job (see CI.yml).'
    );
    process.exit(1);
  }
  let parsed;
  try {
    parsed = parseE2eReadyMarker(fs.readFileSync(e2eReadyPath, 'utf8'));
  } catch (error) {
    console.error(
      `[e2e-build] Could not read ${path.relative(repoRoot, e2eReadyPath)}:`,
      error
    );
    process.exit(1);
  }
  if ('error' in parsed) {
    console.error(
      `[e2e-build] Invalid marker in ${path.relative(repoRoot, e2eReadyPath)} (${parsed.error}). Expected a line: NEXT_PUBLIC_APP_URL=<origin>. Rebuild without E2E_SKIP_BUILD or rewrite the marker from CI.`
    );
    process.exit(1);
  }
  let markerOrigin;
  try {
    markerOrigin = canonicalPublicAppUrl(parsed.url);
  } catch {
    console.error(
      `[e2e-build] Marker contains invalid URL: ${JSON.stringify(parsed.url)}. Rewrite .next/e2e.ready or rebuild without E2E_SKIP_BUILD.`
    );
    process.exit(1);
  }
  if (markerOrigin !== expectedOrigin) {
    console.error(
      `[e2e-build] Cached .next was built for NEXT_PUBLIC_APP_URL=${markerOrigin}, but this run expects ${expectedOrigin} (set NEXT_PUBLIC_APP_URL / PLAYWRIGHT_E2E_PORT to match Playwright baseURL, or rebuild without E2E_SKIP_BUILD).`
    );
    process.exit(1);
  }
}

if (process.argv.includes('--write-e2e-ready-marker')) {
  const nextDir = path.join(repoRoot, '.next');
  if (!fs.existsSync(nextDir)) {
    console.error(
      `[e2e-build] Cannot write marker: ${path.relative(
        repoRoot,
        nextDir
      )} does not exist. Run next build first.`
    );
    process.exit(1);
  }
  const appUrl = getExpectedE2eAppUrl();
  writeE2eReadyMarker(appUrl);
  console.log(
    `[e2e-build] Wrote ${path.relative(repoRoot, e2eReadyPath)} for NEXT_PUBLIC_APP_URL=${canonicalPublicAppUrl(appUrl)}.`
  );
  process.exit(0);
}

function prepareStandaloneAssets() {
  const standaloneDir = path.join(repoRoot, '.next', 'standalone');
  const standaloneStaticDir = path.join(standaloneDir, '.next', 'static');
  const nextStaticDir = path.join(repoRoot, '.next', 'static');
  const publicDir = path.join(repoRoot, 'public');
  const standalonePublicDir = path.join(standaloneDir, 'public');

  const missing = [];
  if (!fs.existsSync(standaloneDir)) {
    missing.push(path.relative(repoRoot, standaloneDir));
  }
  if (!fs.existsSync(nextStaticDir)) {
    missing.push(path.relative(repoRoot, nextStaticDir));
  }
  if (missing.length > 0) {
    console.error(
      `[e2e-build] Missing required Next.js build outputs: ${missing.join(
        ', '
      )}. Run a full \`next build\` (for example without E2E_SKIP_BUILD=1) or restore a complete .next from CI.`
    );
    process.exit(1);
  }

  fs.rmSync(standaloneStaticDir, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(standaloneStaticDir), { recursive: true });
  fs.cpSync(nextStaticDir, standaloneStaticDir, { recursive: true });

  if (fs.existsSync(publicDir)) {
    fs.rmSync(standalonePublicDir, { force: true, recursive: true });
    fs.cpSync(publicDir, standalonePublicDir, { recursive: true });
  }
}

function buildWorkerOrExit() {
  try {
    esbuild.buildSync({
      absWorkingDir: repoRoot,
      alias: { 'server-only': './src/worker/serverOnlyShim.ts' },
      banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      bundle: true,
      entryPoints: ['src/worker/index.ts'],
      format: 'esm',
      logLevel: 'warning',
      outfile: 'worker.mjs',
      platform: 'node',
      target: 'node24',
    });
  } catch (error) {
    console.error('[e2e-build] Worker build failed:', error);
    process.exit(1);
  }
}

if (process.env.E2E_SKIP_BUILD === '1') {
  console.log(
    '[e2e-build] E2E_SKIP_BUILD=1 — using existing .next (e.g. CI cache).'
  );
  assertE2eReadyMarkerOrExit();
  prepareStandaloneAssets();
  buildWorkerOrExit();
  process.exit(0);
}

const e2eDb =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time into both client
// and server bundles, so Better Auth's `baseURL` (= NEXT_PUBLIC_APP_URL) is
// baked during `next build`. If `.env` says `http://localhost:3000` and
// Playwright serves on `:3008`, every POST fails with `INVALID_ORIGIN`.
// Mirror the CI `build` job (CI.yml: NEXT_PUBLIC_APP_URL=http://localhost:3008)
// so local `test:e2e` bakes the same origin Playwright will serve from.
let e2eAppUrl;
try {
  e2eAppUrl = canonicalPublicAppUrl(getExpectedE2eAppUrl());
} catch {
  console.error(
    '[e2e-build] NEXT_PUBLIC_APP_URL / PLAYWRIGHT_E2E_PORT must form a valid absolute URL (e.g. http://localhost:3008).'
  );
  process.exit(1);
}
const buildEnv = {
  ...process.env,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    'e2e-auth-secret-placeholder-with-thirty-two-chars',
  DATABASE_URL: e2eDb,
  TEST_DATABASE_URL: '',
  IS_E2E: '1',
  // Match playwright webServer; keeps build-time client env aligned with e2e runs.
  NEXT_PUBLIC_SENTRY_DISABLED: 'true',
  NEXT_PUBLIC_APP_URL: e2eAppUrl,
};

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  cwd: repoRoot,
  env: buildEnv,
});

if (result.status === 0) {
  writeE2eReadyMarker(e2eAppUrl);
  prepareStandaloneAssets();
  buildWorkerOrExit();
}

process.exit(result.status ?? 1);
