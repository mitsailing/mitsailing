#!/usr/bin/env node
/**
 * Wait until Postgres accepts TCP on the host-mapped port (see
 * `POSTGRES_PUBLISH_PORT` in `.env.example` and `compose.override.yaml`).
 */
import { config as loadEnv } from 'dotenv';
import waitOn from 'wait-on';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const port = process.env.POSTGRES_PUBLISH_PORT || '5432';

await waitOn({
  resources: [`tcp:127.0.0.1:${port}`],
  timeout: 60_000,
});
