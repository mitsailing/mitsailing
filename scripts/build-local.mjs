import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import waitOn from 'wait-on';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

// Local production build helper: brings up the docker-compose Postgres (and
// Mailpit, to keep the compose topology consistent with `npm run dev`),
// waits for the server to accept connections, runs migrations against
// `dev_db`, then `next build`. Compose is left running on exit so repeat
// builds are fast and `npm run dev` can reuse the same stack; tear it down
// with `npm run db:down` when you're done.
execSync('npm run db:up', { stdio: 'inherit', shell: true });

const pgPort = process.env.POSTGRES_PUBLISH_PORT || '5432';
await waitOn({
  resources: [`tcp:127.0.0.1:${pgPort}`],
  timeout: 60_000,
});

execSync('npm run db:migrate', { stdio: 'inherit', shell: true });
execSync('npm run build:next', { stdio: 'inherit', shell: true });
