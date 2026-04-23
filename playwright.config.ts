import 'dotenv/config';
import type { ChromaticConfig } from '@chromatic-com/playwright';
import { defineConfig, devices } from '@playwright/test';

// Use process.env.PORT by default and fallback to port 3008
// to avoid conflicts with the Next.js default port 3000.
const PORT = process.env.PORT ?? '3008';

// Set webServer.url and use.baseURL with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:${PORT}`;

// E2E tests run against the `test_db` Postgres provisioned by
// `docker/postgres/init.sql` on the docker-compose stack. `.env` already
// defines TEST_DATABASE_URL; the default keeps CI green without one.
const e2eDatabaseUrl =
  process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

// Specs (e.g. `AccountLockout.e2e.ts`) import `prisma` from the app, which
// opens a pool against `DATABASE_URL`. Align it with the test DB so the
// Playwright process and the Next.js webServer both see `test_db`.
process.env.DATABASE_URL = e2eDatabaseUrl;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<ChromaticConfig>({
  testDir: './tests',
  // Look for files with the .spec.js or .e2e.js extension
  testMatch: '*.@(spec|e2e).?(c|m)[jt]s?(x)',
  // Timeout per test. Auth flows and DB can be slower in CI and cold starts.
  timeout: 30 * 1000,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Reporter to use. See https://playwright.dev/docs/test-reporters
  reporter: process.env.CI ? 'github' : 'list',

  expect: {
    // Set timeout for async expect matchers
    timeout: 15 * 1000,
  },

  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  //
  // `test:e2e` runs `run-s e2e:preflight pw:test`, so by the time
  // Playwright starts this webServer the docker-compose stack is up,
  // Postgres is accepting connections on :5432, and `test_db` has been
  // migrated. The webServer here just starts Next — matching how
  // cal.com, Documenso and MakerKit structure their e2e suites (DB
  // prep is a separate explicit step, not chained into webServer.command).
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev:next',
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 2 * 1000 },
    env: {
      NEXT_PUBLIC_SENTRY_DISABLED: 'true',
      NEXT_PUBLIC_APP_URL: baseURL,
      PORT,
      DATABASE_URL: e2eDatabaseUrl,
    },
  },

  // Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions.
  use: {
    // Use baseURL so to make navigations relative.
    // More information: https://playwright.dev/docs/api/class-testoptions#test-options-base-url
    baseURL,

    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: process.env.CI ? 'on' : 'retain-on-failure',

    // Record videos when retrying the failed test.
    video: process.env.CI ? 'retain-on-failure' : undefined,

    // Disable automatic screenshots at test completion when using Chromatic test fixture.
    disableAutoSnapshot: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
        ]
      : []),
  ],
});
