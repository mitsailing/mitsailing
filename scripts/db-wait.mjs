#!/usr/bin/env node
/**
 * Wait until Postgres accepts TCP on the host-mapped port (see
 * `POSTGRES_PUBLISH_PORT` in `.env.example` and `compose.override.yaml`).
 *
 * After TCP is up, the official Postgres image may still be running
 * `docker-entrypoint-initdb.d` (including `init.sql` that creates `test_db`).
 * `prisma migrate` against `test_db` can race and fail with "database does not
 * exist" — so we poll until `test_db` answers inside the container.
 */
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import waitOn from 'wait-on';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const port = process.env.POSTGRES_PUBLISH_PORT ?? '5432';

await waitOn({
  resources: [`tcp:127.0.0.1:${port}`],
  timeout: 60_000,
});

const pollMs = 500;
const maxAttempts = 180;

for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
  try {
    execFileSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'postgres',
        '-d',
        'test_db',
        '-c',
        'SELECT 1',
      ],
      { stdio: 'pipe' },
    );
    break;
  } catch {
    if (attempt === maxAttempts - 1) {
      throw new Error(
        'Postgres is up but `test_db` is not ready — check docker/postgres/init.sql and compose logs',
      );
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
