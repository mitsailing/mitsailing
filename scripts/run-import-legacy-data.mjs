import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const bundleDir = mkdtempSync(join(tmpdir(), 'mitsailing-legacy-import-'));
const bundlePath = join(bundleDir, 'import-legacy-data.mjs');

const esbuildArgs = [
  'esbuild',
  'scripts/import-legacy-data.ts',
  '--bundle',
  '--platform=node',
  '--target=node24',
  '--format=esm',
  `--outfile=${bundlePath}`,
  '--tsconfig=tsconfig.json',
  '--alias:server-only=./src/worker/serverOnlyShim.ts',
  '--banner:js=import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  '--log-level=warning',
];

const esbuild = spawnSync('npx', esbuildArgs, {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (esbuild.status !== 0) {
  process.stderr.write(esbuild.stderr ?? esbuild.stdout ?? 'esbuild failed\n');
  rmSync(bundleDir, { force: true, recursive: true });
  process.exit(esbuild.status ?? 1);
}

const run = spawnSync(
  'npx',
  ['dotenv', '-c', '--', 'node', bundlePath, ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  }
);

rmSync(bundleDir, { force: true, recursive: true });
process.exit(run.status ?? 1);
