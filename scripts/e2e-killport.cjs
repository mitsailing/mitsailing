/**
 * Kill any process listening on the Playwright e2e port before a run.
 *
 * Why: with `reuseExistingServer: false`, Playwright refuses to start if the
 * port is already bound. More subtly, a stale `next start` left over from a
 * previous run (or a `npm run dev` on the same port) would be served with a
 * build that may have baked a different `NEXT_PUBLIC_APP_URL`, producing
 * confusing "Invalid origin" failures. Clearing the port up-front makes
 * `npm run test:e2e` deterministic on laptops and in CI retries alike.
 *
 * Portable across macOS (BSD lsof) and Linux (procfs). Silent when nothing is
 * listening.
 */
const { spawnSync } = require('node:child_process');

const port = process.env.PLAYWRIGHT_E2E_PORT ?? '3008';

function pidsFromLsof() {
  const res = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
  if (res.status !== 0) {
    return [];
  }
  return (res.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

const pids = pidsFromLsof();

if (pids.length === 0) {
  process.exit(0);
}

console.log(
  `[e2e-killport] Killing stale process(es) on port ${port}: ${pids.join(', ')}`
);

for (const pid of pids) {
  try {
    process.kill(Number(pid), 'SIGKILL');
  } catch (error) {
    if (error && error.code !== 'ESRCH') {
      console.warn(
        `[e2e-killport] Failed to kill pid ${pid}: ${error.message}`
      );
    }
  }
}
