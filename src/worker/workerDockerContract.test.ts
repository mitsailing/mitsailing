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
  const readonlySeedCopyPrefix =
    'COPY --from=builder --chown=nextjs:nodejs --chmod=0444';

  it('builds an ESM worker bundle with a Node require shim', () => {
    const scripts = readPackageScripts();
    const dockerfile = readRepoFile('Dockerfile');
    const dockerWorkflow = readRepoFile('.github/workflows/docker-pr.yml');

    expect(scripts['build:worker']).toContain(
      'esbuild src/worker/index.ts --bundle --platform=node --target=node24 --outfile=worker.mjs --format=esm'
    );
    expect(scripts['build:worker']).toContain('--packages=external');
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
    expect(scripts).not.toHaveProperty('build:upload-service');
    expect(dockerfile).not.toContain('upload-service.mjs');
    expect(dockerWorkflow).toContain('mitsailing-pr:ci node worker.mjs');
  });

  it('uses stable Redis 8 Alpine images for Docker smoke checks', () => {
    const composeFile = readRepoFile('compose.yaml');
    const dockerWorkflow = readRepoFile('.github/workflows/docker-pr.yml');

    expect(composeFile).toContain('image: redis:8-alpine');
    expect(dockerWorkflow).toContain('redis:8-alpine');
  });

  it('ships production seed dependencies with the production image', () => {
    const dockerfile = readRepoFile('Dockerfile');

    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/tsconfig.json ./tsconfig.json`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/lib/mit-sailing/nyTime.ts ./src/lib/mit-sailing/nyTime.ts`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/data ./src/data`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/generated ./src/generated`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/libs/DB.ts ./src/libs/DB.ts`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/libs/Env.ts ./src/libs/Env.ts`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/libs/auth/passwordHashing.ts ./src/libs/auth/passwordHashing.ts`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/libs/auth/roles.ts ./src/libs/auth/roles.ts`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/libs/legacy-sync/legacyMysqlSyncConstants.ts ./src/libs/legacy-sync/legacyMysqlSyncConstants.ts`
    );
    expect(dockerfile).toContain(
      `${readonlySeedCopyPrefix} /app/src/libs/mit-sailing/pavilionReservationPersonas.ts ./src/libs/mit-sailing/pavilionReservationPersonas.ts`
    );
  });

  it('raises Node heap only during the Docker builder stage', () => {
    const dockerfile = readRepoFile('Dockerfile');
    const builderStagePattern =
      /FROM node:\$\{NODE_VERSION\} AS builder[\s\S]*?FROM node:\$\{NODE_VERSION\} AS prod/u;
    const prodStagePattern = /FROM node:\$\{NODE_VERSION\} AS prod[\s\S]*/u;
    const builderStage = builderStagePattern.exec(dockerfile)?.[0];
    const prodStage = prodStagePattern.exec(dockerfile)?.[0];

    expect(builderStage).toContain(
      'ENV NODE_OPTIONS=--max-old-space-size=4096'
    );
    expect(prodStage).not.toContain(
      'ENV NODE_OPTIONS=--max-old-space-size=4096'
    );
  });
});
