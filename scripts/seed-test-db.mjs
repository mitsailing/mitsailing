#!/usr/bin/env node
/**
 * Run `prisma/seed.ts` against the E2E `test_db` (same connection pattern as
 * `migrate-test-db.mjs`). Cal.com runs `db-see`d before `playwright` in
 * `test-e2e`; this is the `test_db` version of that.
 */
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

console.log(
  `[seed-test-db] running prisma db seed on ${redact(testDatabaseUrl)}`
);

execFileSync('npx', ['prisma', 'db', 'seed'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

/**
 * @param {string} url - Database URL (password is redacted in the output)
 * @returns {string} Same URL with credentials masked, or the original string if parsing fails
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
