import { execSync } from 'node:child_process';
import waitOn from 'wait-on';

// Local production build helper: brings up the docker-compose Postgres (and
// Mailpit, to keep the compose topology consistent with `npm run dev`),
// waits for the server to accept connections, runs migrations against
// `dev_db`, then `next build`. Compose is left running on exit so repeat
// builds are fast and `npm run dev` can reuse the same stack; tear it down
// with `npm run db:down` when you're done.
execSync('npm run db:up', { stdio: 'inherit', shell: true });

await waitOn({
  resources: ['tcp:127.0.0.1:5432'],
  timeout: 60_000,
});

execSync('npm run db:migrate', { stdio: 'inherit', shell: true });
execSync('npm run build:next', { stdio: 'inherit', shell: true });
