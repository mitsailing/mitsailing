#!/usr/bin/env node
/**
 * Apply Prisma migrations to the E2E test database.
 *
 * Why this script exists (instead of an npm-scripts one-liner):
 *   The previous incarnation was
 *     dotenv -c -- cross-env-shell 'DATABASE_URL=$TEST_DATABASE_URL prisma migrate deploy'
 *   That three-layer wrapping (dotenv-cli -> cross-env-shell -> /bin/sh)
 *   silently swallowed prisma's stdout and, in one failure mode I hit
 *   locally, swallowed the command entirely — `npm run db:migrate:test`
 *   would exit 0 with zero output and no migrations applied. A bare
 *   Node shim is simpler, cross-platform, and shows up in CI logs.
 *
 * Pattern cribbed from Documenso's `with-env` helper and Cal.com's
 * split between `db-up` and `test-e2e` (both > 10k-star repos). They
 * treat DB bring-up + migrations as an *explicit preflight* rather
 * than chaining it into Playwright's `webServer.command`.
 */

import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

console.log(
  `[migrate-test-db] applying migrations to ${redact(testDatabaseUrl)}`
);

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

/**
 * Replace a Postgres password in the connection string with `***` so CI
 * logs don't leak credentials.
 *
 * @param {string} url Raw connection string from the environment.
 * @returns {string} `url` with the password redacted (or unchanged if it
 *   doesn't parse as a URL).
 */
function redact(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
