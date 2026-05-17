import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function readShellFunction(script: string, name: string): string {
  const startIndex = script.indexOf(`${name}() {`);
  if (startIndex === -1) {
    return '';
  }

  const remainingScript = script.slice(startIndex + name.length);
  const nextFunctionMatch = /\n[a-zA-Z_][a-zA-Z0-9_]*\(\) \{/u.exec(
    remainingScript
  );

  if (!nextFunctionMatch) {
    return script.slice(startIndex);
  }

  return script.slice(
    startIndex,
    startIndex + name.length + nextFunctionMatch.index
  );
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

  it('persists promoted host state before draining the old host', () => {
    const promoteRef = readShellFunction(script, 'promote_ref');
    const rollbackRef = readShellFunction(script, 'rollback_ref');

    expect(
      promoteRef.indexOf('record_state "$target" "$ref" "$current_ref"')
    ).toBeGreaterThan(
      promoteRef.indexOf('wait_for_readiness "$target_host" public')
    );
    expect(promoteRef.indexOf('log "draining $active host')).toBeGreaterThan(
      promoteRef.indexOf('record_state "$target" "$ref" "$current_ref"')
    );
    expect(
      rollbackRef.indexOf('record_state "$target" "$ref" "$current_ref"')
    ).toBeGreaterThan(
      rollbackRef.indexOf('wait_for_readiness "$(color_host "$target")" public')
    );
    expect(rollbackRef.indexOf('log "draining $active host')).toBeGreaterThan(
      rollbackRef.indexOf('record_state "$target" "$ref" "$current_ref"')
    );
  });

  it('uses a 900 second default drain window for large uploads', () => {
    expect(script).toContain('DEPLOY_DRAIN_SECONDS:-900');
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

  it('restarts tusd only through an explicit maintenance command', () => {
    const promoteRef = readShellFunction(script, 'promote_ref');
    const releaseRef = readShellFunction(script, 'release_ref');
    const rollbackRef = readShellFunction(script, 'rollback_ref');
    const restartDataWorker = readShellFunction(script, 'restart_data_worker');
    const restartTusdMaintenance = readShellFunction(
      script,
      'restart_tusd_maintenance'
    );

    expect(script).toContain('tusd-maintenance)');
    expect(restartTusdMaintenance).toContain('--force-recreate tusd');
    expect(restartDataWorker).toContain('--no-deps --force-recreate worker');
    expect(restartDataWorker).toContain('--env-file .env.image');
    expect(restartDataWorker).not.toContain('tusd');
    expect(promoteRef).toContain('restart_data_worker');
    expect(promoteRef).not.toContain('restart_tusd_maintenance');
    expect(promoteRef).not.toContain('--force-recreate tusd');
    expect(releaseRef).not.toContain('restart_tusd_maintenance');
    expect(rollbackRef).toContain('restart_data_worker');
    expect(rollbackRef).not.toContain('restart_tusd_maintenance');
    expect(rollbackRef).not.toContain('--force-recreate tusd');
  });
});
