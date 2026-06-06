import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function shellVariable(value: string): string {
  return `${String.fromCodePoint(36)}{${value}}`;
}

const mailpitRoute = shellVariable('MAILPIT_ROUTE');
const pgheroRoute = shellVariable('PGHERO_ROUTE');

const mailpitProxyHeaders = [
  String.raw`proxy_set_header Host \$host;`,
  String.raw`proxy_set_header X-Forwarded-Proto \$forwarded_proto;`,
  String.raw`proxy_set_header Upgrade \$http_upgrade;`,
  String.raw`proxy_set_header Connection \$connection_upgrade;`,
];

const pgheroProxyHeaders = [
  String.raw`proxy_set_header Host \$host;`,
  String.raw`proxy_set_header X-Forwarded-Proto \$forwarded_proto;`,
  `proxy_set_header X-Forwarded-Prefix ${pgheroRoute};`,
  String.raw`proxy_set_header Upgrade \$http_upgrade;`,
  String.raw`proxy_set_header Connection \$connection_upgrade;`,
];

describe('single host deploy script', () => {
  const script = readRepoFile('bin/deploy.sh');
  const deployDrainSeconds = `${shellVariable('DEPLOY_DRAIN_SECONDS')}s`;
  const shellEscape = String.fromCodePoint(92);
  const defaultProductionDataRoot = shellVariable(
    'PRODUCTION_DATA_ROOT:-/srv/mitsailing-data'
  );
  const productionDataRoot = shellVariable('PRODUCTION_DATA_ROOT');

  it('keeps nginx upload timeouts aligned with the release drain default', () => {
    expect(script).toContain('DEPLOY_DRAIN_SECONDS:-120');
    expect(script).toContain(`client_body_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_read_timeout ${deployDrainSeconds};`);
  });

  it('keeps production data paths outside deploy user control', () => {
    expect(script).toContain('/srv/mitsailing-data');
    expect(script).toContain('server admin must create');
    expect(script).toContain(
      `readonly PRODUCTION_DATA_ROOT="${defaultProductionDataRoot}"`
    );
    expect(script).toContain('export PRODUCTION_DATA_ROOT');
    expect(script).toContain(
      `readonly PRODUCTION_POSTGRES_DIR="${productionDataRoot}/postgres"`
    );
    expect(script).toContain(
      `readonly PRODUCTION_REDIS_DIR="${productionDataRoot}/redis"`
    );
    expect(script).toContain(
      `readonly PRODUCTION_CMS_MEDIA_DIR="${productionDataRoot}/cms-media"`
    );
    expect(script).toContain(
      `readonly PRODUCTION_MAILPIT_DIR="${productionDataRoot}/mailpit"`
    );
    expect(script).toContain('validate_production_data_root');
    expect(script).toContain('PRODUCTION_DATA_ROOT must be an absolute path');
    expect(script).toContain('PRODUCTION_DATA_ROOT must not be empty');
    expect(script).toContain('PRODUCTION_DATA_ROOT must not be /');
    expect(script).toContain('PRODUCTION_DATA_ROOT must not end with /');
    expect(script).toContain('PRODUCTION_DATA_ROOT must not contain .. or ~');
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
      'verify_bind_mount mailpit /data "$PRODUCTION_MAILPIT_DIR"'
    );
    expect(script).toContain('verify_cms_media_bind_mount tusd');
    expect(script).toContain('verify_cms_media_bind_mount media');
    expect(script).toContain('verify_started_app_cms_media_bind_mounts');
  });

  it('resolves relative deploy dir before deriving state paths', () => {
    const deployDirDefault = shellVariable('DEPLOY_DIR:-$HOME/apps/mitsailing');
    const deployDir = shellVariable('DEPLOY_DIR');

    expect(script).toContain('resolve_deploy_dir');
    expect(script).toContain(
      `readonly DEPLOY_DIR="$(resolve_deploy_dir "${deployDirDefault}")"`
    );
    expect(
      script.indexOf('readonly DEPLOY_DIR="$(resolve_deploy_dir')
    ).toBeLessThan(
      script.indexOf(`readonly DEPLOY_STATE_DIR="${deployDir}/.deploy"`)
    );
  });

  it('keeps pgdata marker expansion inside the postgres container shell', () => {
    const pgdata = `${shellEscape}${shellVariable('PGDATA')}`;
    const pgdataWithFallback = `${shellEscape}${shellVariable('PGDATA:-')}`;

    expect(script).toContain(
      String.raw`compose exec -T postgres sh -ec "test -n \"${pgdataWithFallback}\" && test -s \"${pgdata}/PG_VERSION\""`
    );
  });

  it('verifies CMS media mounts for started web and worker containers', () => {
    expect(script).toMatch(
      /verify_started_app_cms_media_bind_mounts\(\) \{[\s\S]*web_\*\|worker[\s\S]*verify_bind_mount "\$service" \/var\/lib\/mitsailing\/cms-media "\$PRODUCTION_CMS_MEDIA_DIR"[\s\S]*compose config --services/u
    );
    expect(script).toMatch(
      /verify_production_bind_mounts\(\) \{[\s\S]*verify_started_app_cms_media_bind_mounts/u
    );
    expect(script).toMatch(
      /start_web_color\(\) \{[\s\S]*wait_for_service_health "\$service" "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*verify_production_bind_mounts/u
    );
    expect(script).toMatch(
      /restart_worker\(\) \{[\s\S]*wait_for_service_health worker "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*verify_production_bind_mounts/u
    );
  });

  it('starts ingress and media services without recreating media during app releases', () => {
    expect(script).toContain('ensure_ingress_services');
    expect(script).toContain(
      'compose up --detach --no-recreate postgres redis'
    );
    expect(script).toContain(
      'compose up --detach --no-recreate postgres redis mailpit pghero tusd media'
    );
    expect(script).toMatch(
      /ensure_ingress_services\(\) \{[\s\S]*wait_for_service_health mailpit "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*wait_for_service_health pghero "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*wait_for_service_health tusd "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*verify_production_bind_mounts/u
    );
    expect(script).toContain('compose up --detach --no-deps cloudflared');
    expect(script).toMatch(
      /ensure_ingress_services\(\) \{[\s\S]*compose up --detach --no-deps cloudflared[\s\S]*wait_for_service_health cloudflared "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"/u
    );
    expect(script).toContain('media-maintenance)');
    expect(script).toContain('tusd-maintenance)');
    expect(script).not.toMatch(/release_ref\(\)[\s\S]*--force-recreate tusd/u);
    expect(script).not.toMatch(/release_ref\(\)[\s\S]*--force-recreate media/u);
  });

  it('proxies authenticated Mailpit UI at /mail', () => {
    expect(script).toContain('readonly MAILPIT_ROUTE="/mail"');
    expect(script).toContain(`location = ${mailpitRoute}`);
    expect(script).toContain(`return 308 ${mailpitRoute}/;`);
    expect(script).toContain(`location ${mailpitRoute}/`);
    expect(script).toContain('proxy_pass http://mailpit:8025;');
    expect(script).toContain(`proxy_send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_read_timeout ${deployDrainSeconds};`);
    for (const header of mailpitProxyHeaders) {
      expect(script).toContain(header);
    }
  });

  it('proxies PgHero behind PgHero basic auth at /pghero', () => {
    expect(script).toContain('readonly PGHERO_ROUTE="/pghero"');
    expect(script).toContain(`location = ${pgheroRoute}`);
    expect(script).toContain(`return 308 ${pgheroRoute}/;`);
    expect(script).toContain(`location ${pgheroRoute}/`);
    expect(script).toContain('proxy_pass http://pghero:8080;');
    expect(script).not.toContain('auth_request /api/internal/pghero-auth;');
    expect(script).not.toContain('location = /api/internal/pghero-auth');
    for (const header of pgheroProxyHeaders) {
      expect(script).toContain(header);
    }
  });

  it('waits for media maintenance services to pass health checks', () => {
    expect(script).toMatch(
      /restart_media_maintenance\(\) \{[\s\S]*wait_for_service_health media "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"/u
    );
    expect(script).toMatch(
      /restart_tusd_maintenance\(\) \{[\s\S]*wait_for_service_health tusd "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"/u
    );
  });

  it('bounds readiness smoke fetch by deploy health timeout', () => {
    expect(script).toContain(
      'const timeoutMs = Number(process.env.DEPLOY_HEALTH_TIMEOUT_SECONDS || 10) * 1000;'
    );
    expect(script).toContain('const signal = AbortSignal.timeout(timeoutMs);');
    expect(script).toMatch(
      /fetch\("http:\/\/127\.0\.0\.1:3000\/api\/health\/ready\?mode=service", \{\s+headers: \{ Authorization: `Bearer \$\{secret\}` \},\s+signal,\s+\}\)/u
    );
  });

  it('lists all image-ref commands in missing-ref usage', () => {
    expect(script).toContain(
      'usage: <deploy|media-maintenance|migrate|release|tusd-maintenance> <image-ref>'
    );
  });

  it('accepts only OCI image tags as deploy refs', () => {
    const validRefFunction = /valid_ref\(\) \{[\s\S]*?\n\}/u.exec(script);
    expect(validRefFunction).not.toBeNull();
    const patternSource = /\[\[ "\$ref" =~ \^([\s\S]+)\$ \]\]/u.exec(
      validRefFunction?.[0] ?? ''
    )?.[1];
    expect(patternSource).toBe('[A-Za-z0-9_][A-Za-z0-9._-]{0,127}');
    const deployRefPattern = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/u;

    for (const ref of [
      'sha-abc123def456',
      'v1.0.0',
      '_build',
      'a'.repeat(128),
    ]) {
      expect(deployRefPattern.test(ref)).toBe(true);
    }
    for (const ref of [
      '',
      'feature/foo',
      'sha256:abc',
      'user@digest',
      '-bad',
      'a'.repeat(129),
    ]) {
      expect(deployRefPattern.test(ref)).toBe(false);
    }
  });
});
