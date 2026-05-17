import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('two host deploy script', () => {
  const script = readRepoFile('bin/deploy-two-host.sh');

  it('requires the app and data host ssh targets', () => {
    expect(script).toContain('APP_HOST_BLUE');
    expect(script).toContain('APP_HOST_GREEN');
    expect(script).toContain('DATA_MEDIA_HOST');
  });

  it('uses file based traffic gating for app hosts', () => {
    expect(script).toContain('.deploy/traffic-enabled');
    expect(script).toContain('/run/mitsailing/traffic-enabled');
    expect(script).toContain('mode=service');
    expect(script).not.toMatch(/HOST_TRAFFIC_ENABLED=(true|false)/);
  });

  it('runs app and data compose operations from the split compose files', () => {
    expect(script).toContain('compose.prod.app-host.yaml');
    expect(script).toContain('compose.prod.data.yaml');
    expect(script).toContain('docker compose');
    expect(script).toContain('--env-file .env.production.app-host');
    expect(script).toContain('--env-file .env.production.data');
    expect(script).toContain('--env-file .env.production.worker');
  });

  it('runs prisma migrations once from the data host image', () => {
    expect(script).toContain('up -d postgres redis');
    expect(script).toContain('node ./node_modules/prisma/build/index.js');
    expect(script).toContain('migrate deploy');
  });

  it('restarts the data media worker before app host promotion', () => {
    const migrationIndex = script.indexOf('run_migrations');
    const workerIndex = script.indexOf('restart_data_worker');
    const readinessIndex = script.indexOf(
      'wait_for_readiness "$target_host" service'
    );

    expect(script).toContain('--force-recreate worker');
    expect(migrationIndex).toBeGreaterThanOrEqual(0);
    expect(workerIndex).toBeGreaterThan(migrationIndex);
    expect(readinessIndex).toBeGreaterThan(workerIndex);
  });

  it('warns rollback does not reverse database migrations', () => {
    expect(script).toContain('database migrations are not reversed');
  });
});
