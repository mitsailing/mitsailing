import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function shellVariable(value: string): string {
  return `${String.fromCodePoint(36)}{${value}}`;
}

describe('single host deploy script', () => {
  const script = readRepoFile('bin/deploy.sh');
  const deployDrainSeconds = `${shellVariable('DEPLOY_DRAIN_SECONDS')}s`;

  it('keeps nginx upload timeouts aligned with the drain window default', () => {
    expect(script).toContain('DEPLOY_DRAIN_SECONDS:-900');
    expect(script).toContain(`client_body_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_read_timeout ${deployDrainSeconds};`);
  });

  it('keeps production data paths outside deploy user control', () => {
    expect(script).toContain('/srv/mitsailing-data');
    expect(script).toContain('server admin must create');
    expect(script).not.toContain('ensure_production_data_dirs');
    expect(script).not.toContain('PRODUCTION_DATA_OWNER');
    expect(script).not.toContain('-m 0750 "$PRODUCTION_CMS_MEDIA_DIR"');
    expect(script).not.toContain('[[ -d "$dir" ]]');
    expect(script).toContain('verify_bind_mount');
    expect(script).toContain('docker inspect --format');
    expect(script).toContain(
      'verify_bind_mount postgres /var/lib/postgresql "$PRODUCTION_POSTGRES_DIR"'
    );
    expect(script).toContain(
      'verify_bind_mount redis /data "$PRODUCTION_REDIS_DIR"'
    );
    expect(script).toContain(
      'verify_bind_mount media /var/lib/mitsailing/cms-media "$PRODUCTION_CMS_MEDIA_DIR"'
    );
  });

  it('starts ingress and media services without recreating media during app releases', () => {
    expect(script).toContain('ensure_ingress_services');
    expect(script).toContain(
      'compose up --detach --no-recreate postgres redis'
    );
    expect(script).toContain(
      'compose up --detach --no-recreate postgres redis tusd media'
    );
    expect(script).toContain('compose up --detach --no-deps cloudflared');
    expect(script).toContain('media-maintenance)');
    expect(script).toContain('tusd-maintenance)');
    expect(script).not.toMatch(/release_ref\(\)[\s\S]*--force-recreate tusd/u);
    expect(script).not.toMatch(/release_ref\(\)[\s\S]*--force-recreate media/u);
  });

  it('waits for media maintenance services to pass health checks', () => {
    expect(script).toMatch(
      /restart_media_maintenance\(\) \{[\s\S]*wait_for_service_health media "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"/u
    );
    expect(script).toMatch(
      /restart_tusd_maintenance\(\) \{[\s\S]*wait_for_service_health tusd "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"/u
    );
  });
});
