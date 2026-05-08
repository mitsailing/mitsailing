#!/usr/bin/env node
/**
 * Reset the E2E test database schema, then apply Prisma migrations.
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
import { Client } from 'pg';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

assertTestDatabaseUrl(testDatabaseUrl);

console.log(
  `[migrate-test-db] resetting public schema in ${redact(testDatabaseUrl)}`
);

const client = new Client({ connectionString: testDatabaseUrl });
let connected = false;
try {
  await client.connect();
  connected = true;
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
} finally {
  if (connected) {
    await client.end();
  }
}

console.log(
  `[migrate-test-db] applying current migrations to ${redact(testDatabaseUrl)}`
);

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

/**
 * Fail closed before running destructive schema reset work.
 *
 * @param {string} url Raw connection string from the environment.
 */
function assertTestDatabaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `[migrate-test-db] TEST_DATABASE_URL must be a valid URL; got ${redact(url)}`
    );
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(
      `[migrate-test-db] Refusing to reset non-Postgres database URL ${redact(url)}`
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (databaseName !== 'test_db') {
    throw new Error(
      `[migrate-test-db] Refusing to reset database "${databaseName}". ` +
        'db:migrate:test only resets the dedicated test_db database.'
    );
  }
}

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
