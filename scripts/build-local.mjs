import { execSync } from 'node:child_process';
import waitOn from 'wait-on';

execSync('npx prisma dev --detach -p 51213 -P 51214', {
  stdio: 'inherit',
  shell: true,
});

await waitOn({
  resources: ['tcp:127.0.0.1:51214'],
  timeout: 60_000,
});

try {
  execSync('npm run db:migrate', { stdio: 'inherit', shell: true });
  execSync('npm run build:next', { stdio: 'inherit', shell: true });
} finally {
  execSync('npx prisma dev stop default', { stdio: 'inherit', shell: true });
}
