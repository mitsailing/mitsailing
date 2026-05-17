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
    expect(script).toContain('wait_for_service_health postgres');
    expect(script).toContain('wait_for_service_health redis');
    expect(script).toContain('node ./node_modules/prisma/build/index.js');
    expect(script).toContain('migrate deploy');
  });

  it('uses the configured deploy ssh identity for remote operations', () => {
    expect(script).toContain('DEPLOY_SSH_KEY');
    expect(script).toContain('ssh -i "$DEPLOY_SSH_KEY"');
  });

  it('restarts the data media worker before app host promotion', () => {
    const promoteRef = script.slice(script.indexOf('promote_ref()'));
    const migrationIndex = promoteRef.indexOf('run_migrations');
    const workerIndex = promoteRef.indexOf('restart_data_worker');
    const startIndex = promoteRef.indexOf('start_app_host "$target_host"');
    const readinessIndex = promoteRef.indexOf(
      'wait_for_readiness "$target_host" service'
    );

    expect(script).toContain('--force-recreate worker');
    expect(migrationIndex).toBeGreaterThanOrEqual(0);
    expect(startIndex).toBeGreaterThan(workerIndex);
    expect(workerIndex).toBeGreaterThan(migrationIndex);
    expect(readinessIndex).toBeGreaterThan(workerIndex);
  });

  it('warns rollback does not reverse database migrations', () => {
    const rollbackRefIndex = script.indexOf('rollback_ref()');

    expect(script).toContain('database migrations are not reversed');
    expect(
      script.indexOf('restart_data_worker', rollbackRefIndex)
    ).toBeGreaterThan(
      script.indexOf('pin_image_everywhere "$ref"', rollbackRefIndex)
    );
  });
});
