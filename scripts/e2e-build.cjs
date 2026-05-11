/**
 * Build the Next app with e2e DB and flags before Playwright starts the
 * standalone server. In GitHub Actions, the `build` job already produced `.next`
 * (see CI.yml + cache restore on the e2e job) — set `E2E_SKIP_BUILD=1` to avoid
 * a second full `next build`.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

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

if (process.env.E2E_SKIP_BUILD === '1') {
  console.log(
    '[e2e-build] E2E_SKIP_BUILD=1 — using existing .next (e.g. CI cache).'
  );
  prepareStandaloneAssets();
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
const e2ePort = process.env.PLAYWRIGHT_E2E_PORT ?? '3008';
const e2eAppUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${e2ePort}`;
const buildEnv = {
  ...process.env,
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
  prepareStandaloneAssets();
}

process.exit(result.status ?? 1);
