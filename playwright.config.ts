import 'dotenv/config';
import * as os from 'node:os';
import type { ChromaticConfig } from '@chromatic-com/playwright';
import { defineConfig, devices } from '@playwright/test';

// Cal.com–style: e2e uses a dedicated port (not `PORT` from `.env`, often 3000
// for `npm run dev`). See https://github.com/calcom/cal.com/blob/main/playwright.config.ts
const PORT = process.env.PLAYWRIGHT_E2E_PORT ?? '3008';
const baseURL = `http://localhost:${PORT}`;

const e2eDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

process.env.DATABASE_URL = e2eDatabaseUrl;

const isCi = !!process.env.CI;
const includeFirefox = process.env.PLAYWRIGHT_INCLUDE_FIREFOX === '1';

// Fast (default): short limits but enough headroom for cold `next start` and
// cal-style high parallelism. Set PLAYWRIGHT_SLOW=1 for 120s nav/expect/action.
const slowLocal = !isCi && process.env.PLAYWRIGHT_SLOW === '1';
const defaultNavigationTimeout = slowLocal ? 120_000 : 30_000;
const defaultExpectTimeout = slowLocal ? 120_000 : 10_000;
const defaultActionTimeout = slowLocal ? 120_000 : 30_000;
const defaultTestTimeout = slowLocal ? 240_000 : 90_000;
const DEFAULT_WORKERS = 4;

function playwrightWorkers(): number {
  if (process.env.PWDEBUG) {
    return 1;
  }
  if (process.env.PLAYWRIGHT_WORKERS) {
    return Math.max(
      1,
      Number.parseInt(process.env.PLAYWRIGHT_WORKERS, 10) || 1
    );
  }
  return Math.min(DEFAULT_WORKERS, os.cpus().length);
}

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig<ChromaticConfig>({
  // Vitest integration specs live under `tests/integration/` (`*.contract.spec.ts`);
  // they must not be discovered here — Playwright loads test files as CJS.
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.?(c|m)[jt]s?(x)',
  timeout: defaultTestTimeout,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  fullyParallel: true,
  // Keep production Next + Postgres + Argon2 auth flows inside a stable
  // local/CI budget. `PLAYWRIGHT_WORKERS=8` can raise this on beefier runners.
  workers: playwrightWorkers(),
  maxFailures: isCi ? 10 : undefined,
  reporter: isCi ? [['github'], ['blob']] : 'list',
  expect: {
    timeout: defaultExpectTimeout,
  },
  // DB prep is `e2e:preflight` + `e2e:build` in `npm run test:e2e`.
  // Next's standalone production server matches the Docker runtime path and
  // keeps CI e2e on the same server entrypoint as deploys.
  webServer: {
    command: 'node .next/standalone/server.js',
    port: Number(PORT),
    timeout: 60_000,
    // Always spawn a fresh standalone server tied to this Playwright run so the
    // server uses the build env from `e2e:build` (correct NEXT_PUBLIC_APP_URL,
    // e2e DB, etc.). Reusing a stale listener — left over from a crashed run
    // or a `npm run dev` — would serve a bundle with a different baked
    // `baseURL`, producing confusing "Invalid origin" failures from Better
    // Auth. `e2e:preflight` runs `e2e:killport` before we get here so the
    // port is free.
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--dns-result-order=ipv4first',
      NEXT_PUBLIC_IS_E2E: '1',
      NEXT_PUBLIC_SENTRY_DISABLED: 'true',
      NEXT_PUBLIC_APP_URL: baseURL,
      PORT: String(PORT),
      HOSTNAME: '0.0.0.0',
      DATABASE_URL: e2eDatabaseUrl,
    },
  },
  use: {
    baseURL,
    trace: isCi ? 'on-first-retry' : 'retain-on-failure',
    screenshot: isCi ? 'only-on-failure' : undefined,
    video: isCi ? 'retain-on-failure' : undefined,
    disableAutoSnapshot: true,
    navigationTimeout: defaultNavigationTimeout,
    actionTimeout: defaultActionTimeout,
  },
  // E2E defaults to Chromium only in local and CI runs.
  // PLAYWRIGHT_INCLUDE_FIREFOX=1 opts local runs into Firefox coverage.
  // `*.a11y.e2e.ts` is a separate project: axe scans many URLs × themes (slower than smoke e2e).
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/*.a11y.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(includeFirefox
      ? [
          {
            name: 'firefox',
            testIgnore: '**/*.a11y.e2e.ts',
            use: { ...devices['Desktop Firefox'] },
          },
        ]
      : []),
    {
      name: 'a11y-chromium',
      testMatch: '**/*.a11y.e2e.ts',
      timeout: 300_000,
      workers: isCi ? 2 : 4,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
