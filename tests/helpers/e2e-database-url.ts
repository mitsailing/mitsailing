/**
 * Shared Postgres URL defaults for Playwright e2e. Keeps `playwright.config.ts`
 * and direct `pg` pools in specs aligned with docker-compose `test_db` and CI.
 */

/** Default when `TEST_DATABASE_URL` is unset (matches `.env.example` / CI). */
const E2E_DEFAULT_POSTGRES_URL =
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

/**
 * Database URL for the Playwright web server (`DATABASE_URL`). Uses
 * `TEST_DATABASE_URL` when set; otherwise the shared default (not `.env`
 * `DATABASE_URL`, which may point at `dev_db`).
 *
 * @returns Postgres connection string for the e2e app server.
 */
export function playwrightE2eDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? E2E_DEFAULT_POSTGRES_URL;
}

/**
 * Connection string for direct `pg` use in e2e specs (avoid importing app
 * Prisma). Prefers `TEST_DATABASE_URL`, then `DATABASE_URL` (Playwright sets
 * this from {@link playwrightE2eDatabaseUrl} before specs load).
 *
 * @returns Postgres connection string for `pg` pools in e2e tests.
 */
export function e2ePgConnectionString(): string {
  return (
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    E2E_DEFAULT_POSTGRES_URL
  );
}
