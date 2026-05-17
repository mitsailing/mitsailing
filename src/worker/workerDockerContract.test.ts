import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function readPackageScripts(): Record<string, string> {
  const packageJson: unknown = JSON.parse(readRepoFile('package.json'));
  if (
    typeof packageJson !== 'object' ||
    packageJson === null ||
    !('scripts' in packageJson) ||
    !isStringRecord(packageJson.scripts)
  ) {
    throw new TypeError('package.json scripts must be a string record');
  }

  return packageJson.scripts;
}

describe('worker Docker contract', () => {
  it('builds an ESM worker bundle with a Node require shim', () => {
    const scripts = readPackageScripts();
    const dockerfile = readRepoFile('Dockerfile');
    const dockerWorkflow = readRepoFile('.github/workflows/docker-pr.yml');

    expect(scripts['build:worker']).toContain(
      'esbuild src/worker/index.ts --bundle --platform=node --target=node24 --outfile=worker.mjs --format=esm'
    );
    expect(scripts['build:worker']).toContain(
      '--banner:js="import { createRequire } from \'node:module\'; const require = createRequire(import.meta.url);"'
    );
    expect(scripts['build:worker']).toContain(
      '--alias:server-only=./src/worker/serverOnlyShim.ts'
    );
    expect(readRepoFile('src/worker/serverOnlyShim.ts')).toContain(
      'Worker-safe replacement'
    );
    expect(dockerfile).toContain('/app/worker.mjs ./worker.mjs');
    expect(scripts['build:upload-service']).toContain(
      'esbuild src/upload-service/index.ts --bundle --platform=node --target=node24 --outfile=upload-service.mjs --format=esm'
    );
    expect(dockerfile).toContain(
      '/app/upload-service.mjs ./upload-service.mjs'
    );
    expect(dockerWorkflow).toContain('mitsailing-pr:ci node worker.mjs');
  });

  it('uses stable Redis 8 Alpine images for Docker smoke checks', () => {
    const composeFile = readRepoFile('compose.yaml');
    const dockerWorkflow = readRepoFile('.github/workflows/docker-pr.yml');

    expect(composeFile).toContain('image: redis:8-alpine');
    expect(dockerWorkflow).toContain('redis:8-alpine');
  });
});
