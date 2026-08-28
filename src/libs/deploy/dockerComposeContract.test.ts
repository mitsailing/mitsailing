import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

const minProductionSshRemotes = 5;

function sshRemoteCommandBodies(workflowYaml: string): string[] {
  const bodies: string[] = [];
  let inSsh = false;

  for (const line of workflowYaml.split('\n')) {
    if (/\bssh\s+\\$/u.test(line)) {
      inSsh = true;
      continue;
    }
    if (!inSsh) {
      continue;
    }

    const continuation = line.trimEnd().endsWith('\\');
    const quoted = /^\s+"(.*)"\s*\\?$/u.exec(line);
    const remoteCommand = quoted === null ? undefined : quoted[1];
    if (remoteCommand !== undefined && !continuation) {
      bodies.push(remoteCommand);
      inSsh = false;
      continue;
    }
    if (!continuation && line.trim() !== '') {
      inSsh = false;
    }
  }

  return bodies;
}

function unescapeGithubActionsRemote(remote: string): string {
  return remote
    .replaceAll('\\"', '"')
    .replaceAll('\\$(', '$(')
    .replaceAll('\\$', '$');
}

function readYamlServiceBlock(source: string, service: string): string {
  const marker = `\n  ${service}:`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const blockStart = start + 1;
  const nextService = source
    .slice(blockStart + marker.length - 1)
    .search(/\n {2}\w/u);
  if (nextService === -1) {
    return source.slice(blockStart);
  }
  return source.slice(blockStart, blockStart + marker.length - 1 + nextService);
}

function composeVariable(value: string): string {
  return `\${${value}}`;
}

const mailpitRoute = '/mail';
const mailpitWebroot = `${mailpitRoute}/`;
const mailpitRouteVariable = composeVariable('MAILPIT_ROUTE');
const pgheroOrigin = 'https://pghero.mitsailing.com';

function expectMailpitRelayEnvExample(envExample: string): void {
  for (const fragment of [
    'MAIL_TRANSPORT=smtp',
    'MAILPIT_UI_AUTH=',
    'MAILPIT_SMTP_RELAY_MATCHING=(?i)^',
    String.raw`ak(\+[^@]+)?@callred\.com`,
    String.raw`delivered(\+[^@]+)?@resend\.dev`,
    String.raw`suppressed@resend\.dev`,
    String.raw`)\z`,
  ]) {
    expect(envExample).toContain(fragment);
  }
  expect(envExample).not.toContain('EMAIL_REAL_DELIVERY_ALLOWLIST');
}

function expectContainsFragments(source: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(source).toContain(fragment);
  }
}

function expectCpuAndMemoryLimits(serviceBlock: string): void {
  expect(serviceBlock).toContain('deploy:');
  expect(serviceBlock).toContain('resources:');
  expect(serviceBlock).toContain('limits:');
  expect(serviceBlock).toContain('cpus:');
  expect(serviceBlock).toContain('memory:');
  expect(serviceBlock).toContain('reservations:');
}

const pgheroHistoricalStatsMigrationPath =
  'prisma/migrations/20260828000000_enable_pghero_historical_stats/migration.sql';

describe('production docker compose', () => {
  const productionCompose = readRepoFile('compose.prod.yaml');
  const productionDockerfile = readRepoFile('Dockerfile');
  const deployRunbook = readRepoFile('docs/deploy.md');
  const deployWorkflow = readRepoFile('.github/workflows/deploy.yml');
  const dependabotConfig = readRepoFile('.github/dependabot.yml');
  const remoteAppDirValidationScript = readRepoFile(
    '.github/scripts/validate_remote_app_dir.sh'
  );
  const localDevelopmentRunbook = readRepoFile('docs/local-development.md');
  const mediaMaintenanceRunbook = readRepoFile('docs/media-maintenance.md');
  const productionReadinessChecklist = readRepoFile(
    'docs/production-readiness-checklists.md'
  );
  const mediaNginx = readRepoFile('docker/nginx/media.conf');
  const productionDataRoot = composeVariable(
    'PRODUCTION_DATA_ROOT:-/srv/mitsailing-data'
  );
  const productionDataRootReference = composeVariable('PRODUCTION_DATA_ROOT');

  it('defines one docker-only production stack', () => {
    expect(productionCompose).toContain('app:');
    expect(productionCompose).toContain('image: nginx:1.29-alpine');
    expect(productionCompose).toContain('web_blue:');
    expect(productionCompose).toContain('web_green:');
    expect(productionCompose).toContain('worker:');
    expect(productionCompose).toContain("command: ['node', 'worker.mjs']");
    expect(productionCompose).toContain('mailpit:');
    expect(productionCompose).toContain('image: axllent/mailpit:v1.31.0');
    expect(productionCompose).toContain('pghero:');
    expect(productionCompose).toContain('image: ankane/pghero:v4.0.1');
    expect(productionCompose).toContain('pghero_query_stats:');
    expect(productionCompose).toContain('pghero_space_stats:');
    expect(productionCompose).toContain('tusd:');
    expect(productionCompose).toContain('image: tusproject/tusd:v2.10.0');
    expect(productionCompose).toContain("user: '1001:1001'");
    expect(productionCompose).toContain('media:');
    expect(productionCompose).toContain('cloudflared:');
    expect(productionCompose).toContain(`${productionDataRoot}/postgres`);
    expect(productionCompose).toContain(`${productionDataRoot}/redis`);
    expect(productionCompose).toContain(`${productionDataRoot}/cms-media`);
    expect(productionCompose).toContain(`${productionDataRoot}/mailpit`);
    expect(productionCompose).not.toContain('PRODUCTION_RUNTIME_UID');
    expect(productionCompose).not.toContain('upload-service:');
    expect(productionCompose).not.toContain('media-worker:');
    expect(productionCompose).not.toContain('media-upload:');
  });

  it('uses one media storage path for upload processing and serving', () => {
    expect(productionCompose).toContain(
      'MEDIA_STORAGE_ROOT: /var/lib/mitsailing/cms-media'
    );
    expect(productionCompose).not.toContain('cms_media:');
    expect(productionCompose).not.toContain(
      'cms_media:/var/lib/mitsailing/cms-media'
    );
    expect(mediaNginx).toContain('location = /cms-media/healthz');
    expect(mediaNginx).toContain('alias /var/lib/mitsailing/cms-media/ready/');
  });

  it('requires admin-created production bind mount paths', () => {
    expect(productionCompose).toContain('create_host_path: false');
    expect(productionCompose).toMatch(
      /source: \$\{PRODUCTION_DATA_ROOT:-\/srv\/mitsailing-data\}\/postgres\s+target: \/var\/lib\/postgresql\s+bind:\s+create_host_path: false/u
    );
    expect(productionCompose).toMatch(
      /source: \$\{PRODUCTION_DATA_ROOT:-\/srv\/mitsailing-data\}\/redis\s+target: \/data\s+bind:\s+create_host_path: false/u
    );
    expect(productionCompose).toMatch(
      /source: \$\{PRODUCTION_DATA_ROOT:-\/srv\/mitsailing-data\}\/cms-media\s+target: \/var\/lib\/mitsailing\/cms-media\s+bind:\s+create_host_path: false/u
    );
    expect(productionCompose).toMatch(
      /source: \$\{PRODUCTION_DATA_ROOT:-\/srv\/mitsailing-data\}\/mailpit\s+target: \/data\s+bind:\s+create_host_path: false/u
    );
  });

  it('checks Redis queue-safety settings in the container healthcheck', () => {
    const baseCompose = readRepoFile('compose.yaml');

    expect(baseCompose).toContain('--appendonly yes');
    expect(baseCompose).toContain('--maxmemory-policy noeviction');
    expect(baseCompose).toContain('redis-cli ping | grep -qx PONG');
    expect(baseCompose).toContain('CONFIG GET appendonly');
    expect(baseCompose).toContain('CONFIG GET maxmemory-policy');
  });

  it('loads pg_stat_statements for PgHero query stats', () => {
    const baseCompose = readRepoFile('compose.yaml');
    const postgresBlock = readYamlServiceBlock(baseCompose, 'postgres');

    expectContainsFragments(postgresBlock, [
      '- postgres',
      '- shared_preload_libraries=pg_stat_statements',
      '- pg_stat_statements.track=all',
      '- pg_stat_statements.max=10000',
      '- track_activity_query_size=2048',
    ]);
  });

  it('prevents privilege escalation for public production services', () => {
    const servicesStart = productionCompose.indexOf('services:');
    expect(servicesStart).toBeGreaterThanOrEqual(0);
    const webDefaultsStart = productionCompose.indexOf('x-web: &web');
    expect(webDefaultsStart).toBeGreaterThanOrEqual(0);
    const webDefaultsBlock = productionCompose.slice(
      webDefaultsStart,
      servicesStart
    );
    const webBlueBlock = readYamlServiceBlock(productionCompose, 'web_blue');
    const webGreenBlock = readYamlServiceBlock(productionCompose, 'web_green');
    const appBlock = readYamlServiceBlock(productionCompose, 'app');
    const workerBlock = readYamlServiceBlock(productionCompose, 'worker');
    const mailpitBlock = readYamlServiceBlock(productionCompose, 'mailpit');
    const pgheroBlock = readYamlServiceBlock(productionCompose, 'pghero');
    const pgheroQueryStatsBlock = readYamlServiceBlock(
      productionCompose,
      'pghero_query_stats'
    );
    const pgheroSpaceStatsBlock = readYamlServiceBlock(
      productionCompose,
      'pghero_space_stats'
    );
    const tusdBlock = readYamlServiceBlock(productionCompose, 'tusd');
    const mediaBlock = readYamlServiceBlock(productionCompose, 'media');
    const cloudflaredBlock = readYamlServiceBlock(
      productionCompose,
      'cloudflared'
    );

    expect(webBlueBlock).toContain('<<: *web');
    expect(webGreenBlock).toContain('<<: *web');
    expect(pgheroQueryStatsBlock).toContain('<<: *pghero-capture');
    expect(pgheroSpaceStatsBlock).toContain('<<: *pghero-capture');

    for (const serviceBlock of [
      webDefaultsBlock,
      appBlock,
      workerBlock,
      mailpitBlock,
      pgheroBlock,
      tusdBlock,
      mediaBlock,
      cloudflaredBlock,
    ]) {
      expect(serviceBlock).toContain('security_opt:');
      expect(serviceBlock).toContain('- no-new-privileges:true');
    }
  });

  it('runs tusd with local disk storage and upload hardening', () => {
    expect(productionCompose).toContain('tusd:');
    expect(productionCompose).toContain('-port=1080');
    expect(productionCompose).toContain(
      '-upload-dir=/var/lib/mitsailing/cms-media/uploads'
    );
    expect(productionCompose).toContain('-base-path=/cms-media/uploads/');
    expect(productionCompose).toContain('-disable-download');
    expect(productionCompose).toContain('-behind-proxy');
    expect(productionCompose).toContain(
      `-max-size=${composeVariable('MEDIA_UPLOAD_MAX_BYTES:-104857600')}`
    );
    expect(productionCompose).toContain(
      `-hooks-http=${composeVariable('TUSD_HOOKS_HTTP_URL:?set TUSD_HOOKS_HTTP_URL')}`
    );
    expect(productionCompose).toContain(
      '-hooks-http-forward-headers=x-mitsailing-upload-token'
    );
    expect(productionCompose).toContain(
      `-cors-allow-origin=${composeVariable('MEDIA_UPLOAD_CORS_ALLOW_ORIGIN:-https://mitsailing.com')}`
    );
    expect(productionCompose).toContain(
      '-cors-allow-headers=authorization,content-type,tus-resumable,upload-length,upload-metadata,upload-offset,x-mitsailing-upload-token'
    );
    expect(productionCompose).toContain(
      '-cors-expose-headers=location,tus-resumable,upload-offset,upload-length,upload-metadata,upload-expires'
    );
    expect(productionCompose).toContain('http://127.0.0.1:1080/metrics');
    expect(productionCompose).toMatch(
      /tusd:[\s\S]*healthcheck:[\s\S]*start_period: 30s/u
    );
  });

  it('routes the MIT Sailing tunnel to in-stack docker services', () => {
    const cloudflaredBlock = readYamlServiceBlock(
      productionCompose,
      'cloudflared'
    );
    expect(productionCompose).toContain(
      'image: cloudflare/cloudflared:2026.8.2'
    );
    expect(productionCompose).not.toContain('cloudflare/cloudflared:latest');
    expect(productionCompose).toContain('CLOUDFLARE_TUNNEL_TOKEN');
    expect(cloudflaredBlock).toContain('--autoupdate-freq');
    expect(cloudflaredBlock).toContain('- 24h');
    expect(cloudflaredBlock).not.toContain('--no-autoupdate');
    expect(cloudflaredBlock).toContain('depends_on:');
    expect(cloudflaredBlock).toContain('app:');
    expect(cloudflaredBlock).toContain('tusd:');
    expect(cloudflaredBlock).toContain('media:');
    expect(cloudflaredBlock).toContain('pghero:');
    expect(cloudflaredBlock).toMatch(/tusd:\s+condition: service_healthy/u);
    expect(cloudflaredBlock).toMatch(/pghero:\s+condition: service_healthy/u);
    expect(cloudflaredBlock).not.toContain('ports:');
    expect(deployRunbook).toContain('service: http://tusd:1080');
    expect(deployRunbook).toContain('service: http://media:8080');
    expect(deployRunbook).toContain('service: http://app:3000');
    expect(deployRunbook).toContain('service: http://pghero:8080');
  });

  it('automates container image update PRs', () => {
    expect(dependabotConfig).toContain('package-ecosystem: docker');
    expect(dependabotConfig).toContain('package-ecosystem: docker-compose');
    expect(dependabotConfig).toContain('directory: /');
    expect(dependabotConfig).toContain("time: '06:15'");
    expect(productionDockerfile).toContain(
      `FROM node:${composeVariable('NODE_VERSION')} AS deps`
    );
    expect(productionCompose).not.toContain(':latest');
    expect(productionReadinessChecklist).toContain(
      'Dependabot monitors Dockerfile and Docker Compose images.'
    );
    expect(productionReadinessChecklist).toContain(
      'uses `--autoupdate-freq 24h` as a security override'
    );
    expect(productionReadinessChecklist).toContain(
      'PgHero is protected by PgHero basic auth and has CPU/memory limits.'
    );
  });

  it('runs production Mailpit behind authenticated app nginx', () => {
    const appBlock = readYamlServiceBlock(productionCompose, 'app');
    const webDefaultsBlock = productionCompose.slice(
      productionCompose.indexOf('x-web: &web'),
      productionCompose.indexOf('services:')
    );
    const workerBlock = readYamlServiceBlock(productionCompose, 'worker');
    const mailpitBlock = readYamlServiceBlock(productionCompose, 'mailpit');

    expectContainsFragments(mailpitBlock, [
      'image: axllent/mailpit:v1.31.0',
      `MP_MAX_MESSAGES: ${composeVariable('MAILPIT_MAX_MESSAGES:-10000')}`,
      `MP_MAX_AGE: ${composeVariable('MAILPIT_MAX_AGE:-30d')}`,
      'MP_DATABASE: /data/mailpit.db',
      `MP_WEBROOT: ${mailpitWebroot}`,
      `MP_UI_AUTH: ${composeVariable('MAILPIT_UI_AUTH:?set MAILPIT_UI_AUTH')}`,
      `MP_SMTP_RELAY_HOST: ${composeVariable('MAILPIT_SMTP_RELAY_HOST:-smtp.resend.com')}`,
      `MP_SMTP_RELAY_PORT: ${composeVariable('MAILPIT_SMTP_RELAY_PORT:-587')}`,
      `MP_SMTP_RELAY_STARTTLS: ${composeVariable('MAILPIT_SMTP_RELAY_STARTTLS:-true')}`,
      `MP_SMTP_RELAY_AUTH: ${composeVariable('MAILPIT_SMTP_RELAY_AUTH:-plain')}`,
      `MP_SMTP_RELAY_USERNAME: ${composeVariable('MAILPIT_SMTP_RELAY_USERNAME:-resend')}`,
      `MP_SMTP_RELAY_PASSWORD: ${composeVariable('RESEND_API_KEY:?set RESEND_API_KEY')}`,
      `MP_SMTP_RELAY_MATCHING: ${composeVariable('MAILPIT_SMTP_RELAY_MATCHING:?set MAILPIT_SMTP_RELAY_MATCHING')}`,
      `${productionDataRoot}/mailpit`,
      'target: /data',
      'create_host_path: false',
      "'/mailpit', 'readyz'",
      'start_period: 10s',
    ]);
    expect(mailpitBlock).not.toContain('ports:');
    expect(appBlock).toMatch(/mailpit:\s+condition: service_healthy/u);
    expect(webDefaultsBlock).toMatch(/mailpit:\s+condition: service_healthy/u);
    expect(workerBlock).toMatch(/mailpit:\s+condition: service_healthy/u);
  });

  it('runs PgHero as a private basic-auth operations service', () => {
    const appBlock = readYamlServiceBlock(productionCompose, 'app');
    const cloudflaredBlock = readYamlServiceBlock(
      productionCompose,
      'cloudflared'
    );
    const pgheroBlock = readYamlServiceBlock(productionCompose, 'pghero');

    expectContainsFragments(pgheroBlock, [
      'image: ankane/pghero:v4.0.1',
      `DATABASE_URL: ${composeVariable('PGHERO_DATABASE_URL:?set PGHERO_DATABASE_URL')}`,
      `PGHERO_USERNAME: ${composeVariable('PGHERO_USERNAME:?set PGHERO_USERNAME')}`,
      `PGHERO_PASSWORD: ${composeVariable('PGHERO_PASSWORD:?set PGHERO_PASSWORD')}`,
      'http://127.0.0.1:8080/health',
      "cpus: '0.25'",
      'memory: 512M',
      "cpus: '0.05'",
      'memory: 128M',
    ]);
    expect(pgheroBlock).not.toContain('RAILS_RELATIVE_URL_ROOT');
    expect(pgheroBlock).not.toContain('ports:');
    expect(appBlock).not.toMatch(/pghero:\s+condition: service_healthy/u);
    expect(cloudflaredBlock).toMatch(/pghero:\s+condition: service_healthy/u);
    expect(deployRunbook).toContain(`PgHero is served at \`${pgheroOrigin}\``);
    expect(deployRunbook).toContain('PGHERO_USERNAME');
    expect(deployRunbook).toContain('PGHERO_PASSWORD');
    expect(deployRunbook).toContain('https://pgtune.leopard.in.ua/');
    expect(deployRunbook).toContain('bin/rake pghero:capture_query_stats');
    expect(deployRunbook).toContain('bin/rake pghero:capture_space_stats');
    expect(deployRunbook).not.toContain(
      'PgHero 4.0 only needs extra SQL if historical query stats capture was already enabled'
    );
  });

  it('captures historical PgHero query and space stats', () => {
    const pgheroCaptureDefaultsBlock = productionCompose.slice(
      productionCompose.indexOf('x-pghero-capture: &pghero-capture'),
      productionCompose.indexOf('services:')
    );
    const pgheroQueryStatsBlock = readYamlServiceBlock(
      productionCompose,
      'pghero_query_stats'
    );
    const pgheroSpaceStatsBlock = readYamlServiceBlock(
      productionCompose,
      'pghero_space_stats'
    );
    const pgheroHistoricalStatsMigration = readRepoFile(
      pgheroHistoricalStatsMigrationPath
    );

    expectContainsFragments(pgheroCaptureDefaultsBlock, [
      'image: ankane/pghero:v4.0.1',
      `DATABASE_URL: ${composeVariable('PGHERO_DATABASE_URL:?set PGHERO_DATABASE_URL')}`,
      'no-new-privileges:true',
      "cpus: '0.25'",
      'memory: 512M',
      "cpus: '0.05'",
      'memory: 128M',
      'kill -0 1',
    ]);
    expect(pgheroCaptureDefaultsBlock).not.toContain('ports:');
    expect(pgheroCaptureDefaultsBlock).not.toContain('PGHERO_USERNAME');
    expectContainsFragments(pgheroQueryStatsBlock, [
      '<<: *pghero-capture',
      'set -eu',
      'bin/rake pghero:capture_query_stats',
      'sleep 300',
    ]);
    expectContainsFragments(pgheroSpaceStatsBlock, [
      '<<: *pghero-capture',
      'set -eu',
      'bin/rake pghero:capture_space_stats',
      'bin/rake pghero:clean_query_stats KEEP_DAYS=14',
      'bin/rake pghero:clean_space_stats KEEP_DAYS=90',
      'sleep 86400',
    ]);
    expectContainsFragments(pgheroHistoricalStatsMigration, [
      'CREATE TABLE pghero_queries',
      'CREATE TABLE pghero_query_stats',
      'query_id bigint',
      'CREATE TABLE pghero_space_stats',
      'CREATE SCHEMA IF NOT EXISTS pghero',
      'CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public',
      'ALTER EXTENSION pg_stat_statements SET SCHEMA public',
      'CREATE ROLE pghero',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pghero_queries',
    ]);
    expect(pgheroHistoricalStatsMigration).not.toContain("PASSWORD 'secret'");
    expect(pgheroHistoricalStatsMigration).not.toContain(
      'ALTER TABLE pghero_query_stats ADD COLUMN query_id'
    );
    expect(productionReadinessChecklist).toContain(
      'Historical query and space stats are captured on a schedule.'
    );
  });

  it('sets cpu and memory limits on every compose image', () => {
    const baseCompose = readRepoFile('compose.yaml');
    const localCompose = readRepoFile('compose.override.yaml');
    const pgheroCaptureDefaultsBlock = productionCompose.slice(
      productionCompose.indexOf('x-pghero-capture: &pghero-capture'),
      productionCompose.indexOf('services:')
    );

    for (const service of ['postgres', 'redis']) {
      expectCpuAndMemoryLimits(readYamlServiceBlock(baseCompose, service));
    }

    expectCpuAndMemoryLimits(
      productionCompose.slice(
        productionCompose.indexOf('x-web: &web'),
        productionCompose.indexOf('x-pghero-capture: &pghero-capture')
      )
    );
    expectCpuAndMemoryLimits(pgheroCaptureDefaultsBlock);

    for (const service of [
      'app',
      'worker',
      'mailpit',
      'pghero',
      'tusd',
      'media',
      'cloudflared',
    ]) {
      expectCpuAndMemoryLimits(
        readYamlServiceBlock(productionCompose, service)
      );
    }

    for (const service of ['mailpit', 'tusd', 'media']) {
      expectCpuAndMemoryLimits(readYamlServiceBlock(localCompose, service));
    }
  });

  it('documents protected Mailpit UI verification', () => {
    expect(deployRunbook).toContain(
      'mail_status="$(curl -sS -o /dev/null -w \'%{http_code}\' -I https://mitsailing.com/mail/)"'
    );
    expect(deployRunbook).toContain('302|401|403) ;;');
    expect(deployRunbook).toContain(
      'ERROR: /mail/ accepted an unauthenticated request'
    );
    expect(deployRunbook).not.toContain(
      'curl -fsSI https://mitsailing.com/mail/'
    );
    expect(deployRunbook).toContain(
      'request `/mail/` immediately; it should still return 401 or'
    );
    expect(deployRunbook).toContain('not 502');
  });

  it('documents protected PgHero subdomain verification', () => {
    expect(deployRunbook).toContain(
      `pghero_status="$(curl -sS -o /dev/null -w '%{http_code}' -I ${pgheroOrigin}/)"`
    );
    expect(deployRunbook).toContain(
      'ERROR: PgHero accepted an unauthenticated request'
    );
  });

  it('documents the CI-first production deploy flow', () => {
    expect(deployRunbook).toContain('Open a PR.');
    expect(deployRunbook).toContain(
      'Wait for all required PR checks, the Docker PR build, code-scanning/security'
    );
    expect(deployRunbook).toContain('gates, and human review.');
    expect(deployRunbook).toContain(
      'If CodeRabbit is unavailable, run a local sub-agent code review before merge.'
    );
    expect(deployRunbook).toContain('Merge the approved PR to `main`.');
    expect(deployRunbook).toContain(
      'GitHub runs `Deploy (production)` from `main`.'
    );
    expect(deployRunbook).toContain(
      'approval may happen before the image build and again before release'
    );
    expect(deployRunbook).toContain('`feature/<slug>`');
    expect(deployRunbook).toContain('`fix/<slug>`');
    expect(deployRunbook).toContain('`issue-<number>-<slug>`');
  });

  it('documents the production data root for direct host commands', () => {
    const shellProductionDataRoot = `${String.fromCodePoint(36)}PRODUCTION_DATA_ROOT`;

    expect(deployRunbook).toContain(
      `PRODUCTION_DATA_ROOT='${productionDataRootReference}' DEPLOY_DIR=apps/mitsailing`
    );
    expect(deployRunbook).toContain(
      'PRODUCTION_DATA_ROOT=/srv/mitsailing-data'
    );
    expect(mediaMaintenanceRunbook).toContain(
      `PRODUCTION_DATA_ROOT='${shellProductionDataRoot}' docker compose`
    );
    expect(mediaMaintenanceRunbook).toContain(
      `PRODUCTION_DATA_ROOT='${shellProductionDataRoot}' DEPLOY_DIR=$DEPLOY_DIR`
    );
    expect(localDevelopmentRunbook).toContain(
      '`/var/lib/mitsailing/cms-media/ready` from the remote `media` container'
    );
    expect(localDevelopmentRunbook).toContain(
      '`PRODUCTION_DATA_ROOT/cms-media/ready` on the host'
    );
  });

  it('shell-escapes the remote deploy command values', () => {
    const dollar = String.fromCodePoint(36);
    const remoteAppDir = composeVariable('REMOTE_APP_DIR');
    const remoteDeployScriptPath = `${remoteAppDir}/bin/deploy.sh`;
    const escapedAppDir = composeVariable('remote_app_dir');
    const escapedDataRoot = composeVariable('remote_data_root');
    const escapedDataRootAssignment = composeVariable(
      'remote_data_root_assignment'
    );
    const escapedDeployScript = composeVariable('remote_deploy_script');
    const escapedImageTag = composeVariable('remote_image_tag');
    const checkedOutSha = composeVariable('checked_out_sha');
    const checkedOutShortSha = `${dollar}{checked_out_sha::12}`;
    const deploymentVersionExpression = `${dollar}{{ steps.meta.outputs.deployment_version }}`;
    const productionDataRootExpression = `${dollar}{{ vars.PRODUCTION_DATA_ROOT }}`;
    const productionDataRootFallbackExpression = `${dollar}{{ vars.PRODUCTION_DATA_ROOT || '/srv/mitsailing-data' }}`;
    const githubShaExpression = `${dollar}{{ github.sha }}`;

    expect(deployWorkflow).toContain(
      '. .github/scripts/validate_remote_app_dir.sh'
    );
    expect(deployWorkflow).toContain('validate_remote_app_dir');
    expect(remoteAppDirValidationScript).toContain('validate_remote_app_dir');
    expect(remoteAppDirValidationScript).toContain(
      'PRODUCTION_REMOTE_APP_DIR must use safe path characters'
    );
    expect(remoteAppDirValidationScript).toContain(
      'PRODUCTION_REMOTE_APP_DIR must not contain path segments starting with -'
    );
    expect(deployWorkflow).toContain(
      `"mkdir -p ${escapedAppDir}/bin ${escapedAppDir}/docker/postgres ${escapedAppDir}/docker/nginx"`
    );
    expect(deployWorkflow).toContain(
      `chmod 755 ${escapedAppDir}/bin ${escapedAppDir}/docker ${escapedAppDir}/docker/postgres ${escapedAppDir}/docker/nginx`
    );
    expect(deployWorkflow).toContain(
      `chmod 700 ${escapedAppDir}/bin/deploy.sh`
    );
    expect(deployWorkflow).toContain(
      `chmod 644 ${escapedAppDir}/compose.yaml ${escapedAppDir}/compose.prod.yaml ${escapedAppDir}/docker/postgres/init.sql ${escapedAppDir}/docker/nginx/media.conf`
    );
    expect(deployWorkflow).not.toContain(`${escapedAppDir}/.env.production`);
    expect(deployWorkflow).toContain(
      `printf -v remote_data_root '%q' "${dollar}PRODUCTION_DATA_ROOT"`
    );
    expect(deployWorkflow).toContain(
      `PRODUCTION_DATA_ROOT: ${productionDataRootExpression}`
    );
    expect(deployWorkflow).not.toContain(
      `PRODUCTION_DATA_ROOT: ${productionDataRootFallbackExpression}`
    );
    expect(deployWorkflow).toContain('remote_data_root_assignment=');
    expect(deployWorkflow).toContain(
      `remote_data_root_assignment="PRODUCTION_DATA_ROOT=${escapedDataRoot} "`
    );
    expect(deployWorkflow).toContain(
      `printf -v remote_app_dir '%q' "${dollar}REMOTE_APP_DIR"`
    );
    expect(deployWorkflow).toContain(
      `printf -v remote_deploy_script '%q' "${remoteDeployScriptPath}"`
    );
    expect(deployWorkflow).toContain(
      'printf -v remote_image_tag \'%q\' "$IMAGE_TAG"'
    );
    expect(deployWorkflow).toContain(
      'printf -v remote_docker_config \'%q\' "$REMOTE_DOCKER_CONFIG"'
    );
    expect(deployWorkflow).not.toContain(`"mkdir -p '${remoteAppDir}/bin'`);
    expect(deployWorkflow).toContain('checked_out_sha="$(git rev-parse HEAD)"');
    expect(deployWorkflow).toContain(`short_sha="${checkedOutShortSha}"`);
    expect(deployWorkflow).toContain(
      `echo "deployment_version=${checkedOutSha}"`
    );
    expect(deployWorkflow).toContain(
      `DEPLOYMENT_VERSION=${deploymentVersionExpression}`
    );
    expect(deployWorkflow).not.toContain(
      `DEPLOYMENT_VERSION=${githubShaExpression}`
    );
    const remoteUser = composeVariable('remote_user');
    const remoteDockerConfig = composeVariable('remote_docker_config');
    const ghcrLoginOutcome = `${dollar}{{ always() && steps.ghcr_login.outcome == 'success' }}`;
    const githubTokenExpression = `${dollar}{{ secrets.GITHUB_TOKEN }}`;
    const githubActorExpression = `${dollar}{{ github.actor }}`;
    const remoteDockerConfigPath = `/tmp/mitsailing-ghcr-${dollar}{{ github.run_id }}-${dollar}{{ github.run_attempt }}`;
    expect(deployWorkflow).toContain('packages: read');
    expect(deployWorkflow).toContain('id: ghcr_login');
    expect(deployWorkflow).toContain(
      `REMOTE_DOCKER_CONFIG: ${remoteDockerConfigPath}`
    );
    // Login and release must share isolated DOCKER_CONFIG + rootless DOCKER_HOST
    // on the same remote shell (do not assert these tokens loosely elsewhere).
    const remoteDockerEnvSetup = `export DOCKER_CONFIG=${remoteDockerConfig}; sock=\\"/run/user/\\$(id -u)/docker.sock\\"; if [[ -S \\"\\$sock\\" ]]; then export DOCKER_HOST=\\"unix://\\$sock\\"; fi`;
    expect(deployWorkflow).toContain(
      `bash -c 'set -euo pipefail; mkdir -p -m 700 ${remoteDockerConfig}; ${remoteDockerEnvSetup}; docker login ghcr.io -u ${remoteUser} --password-stdin'`
    );
    expect(deployWorkflow).toContain(
      `bash -c 'set -euo pipefail; ${remoteDockerEnvSetup}; ${escapedDataRootAssignment}DEPLOY_DIR=${escapedAppDir} ${escapedDeployScript} release ${escapedImageTag}'`
    );
    expect(deployWorkflow).toContain(
      `printf '%s\\n' "${dollar}GHCR_TOKEN" | ssh \\`
    );
    expect(deployWorkflow).toContain('unset GHCR_TOKEN');
    expect(deployWorkflow).toContain(`if: ${ghcrLoginOutcome}`);
    expect(deployWorkflow).toContain(
      `DOCKER_CONFIG=${remoteDockerConfig} docker logout ghcr.io; rm -rf ${remoteDockerConfig}`
    );
    expect(deployWorkflow).toContain('StrictHostKeyChecking=yes');
    expect(deployWorkflow).toContain('IdentitiesOnly=yes');
    expect(deployWorkflow).toContain('RequestTTY=no');
    expect(deployWorkflow).toContain(`GHCR_TOKEN: ${githubTokenExpression}`);
    expect(deployWorkflow).toContain(`GHCR_USERNAME: ${githubActorExpression}`);
  });

  it('runs ghcr login and release remotes through bash -c', () => {
    const remotes = sshRemoteCommandBodies(deployWorkflow);
    const loginRemote = remotes.find((remote) =>
      remote.includes('docker login ghcr.io')
    );
    const releaseRemote = remotes.find(
      (remote) =>
        remote.includes(composeVariable('remote_deploy_script')) &&
        remote.includes(' release ')
    );

    expect(remotes.length).toBeGreaterThanOrEqual(minProductionSshRemotes);
    expect(loginRemote).toBeDefined();
    expect(releaseRemote).toBeDefined();
    expect(loginRemote?.startsWith('bash -c ')).toBe(true);
    expect(releaseRemote?.startsWith('bash -c ')).toBe(true);
  });

  it('runs the ghcr login remote payload under the login shell', () => {
    const remotes = sshRemoteCommandBodies(deployWorkflow);
    const loginRemote = remotes.find((remote) =>
      remote.includes('docker login ghcr.io')
    );
    expect(loginRemote).toBeDefined();
    if (loginRemote === undefined) {
      throw new TypeError('missing ghcr login remote command');
    }

    const stubDir = mkdtempSync(path.join(tmpdir(), 'mitsailing-posix-sh-'));
    const dockerConfigDir = path.join(stubDir, 'docker-config');
    writeFileSync(
      path.join(stubDir, 'docker'),
      '#!/bin/sh\ncat >/dev/null\necho Login Succeeded\n'
    );
    chmodSync(path.join(stubDir, 'docker'), 0o755);

    const remoteScript = unescapeGithubActionsRemote(loginRemote)
      .replaceAll(composeVariable('remote_docker_config'), dockerConfigDir)
      .replaceAll(composeVariable('remote_user'), 'contract-user');

    const result = spawnSync('/bin/sh', ['-c', remoteScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${stubDir}:/bin:/usr/bin`,
      },
      input: 'fake-token\n',
    });
    rmSync(stubDir, { force: true, recursive: true });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Login Succeeded');
  });

  it('rejects unsafe remote app directory values', () => {
    for (const remoteAppDir of [
      '',
      '/',
      'apps/../mitsailing',
      '~/mitsailing',
    ]) {
      const result = spawnSync(
        '/bin/bash',
        [
          '-c',
          '. .github/scripts/validate_remote_app_dir.sh && validate_remote_app_dir',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: '/bin:/usr/bin',
            REMOTE_APP_DIR: remoteAppDir,
          },
        }
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PRODUCTION_REMOTE_APP_DIR must');
    }
  });
});

describe('local Mailpit capture', () => {
  const localCompose = readRepoFile('compose.override.yaml');
  const envExample = readRepoFile('.env.example');
  const stagingEnvExample = readRepoFile('.env.staging.example');
  const productionEnvExample = readRepoFile('.env.production.example');
  const playwrightConfig = readRepoFile('playwright.config.ts');
  const mailpitHelper = readRepoFile('tests/helpers/mailpit.ts');

  it('runs Mailpit as loopback-only bounded SMTP capture', () => {
    expect(localCompose).toContain('mailpit:');
    expect(localCompose).toContain('image: axllent/mailpit:v1.31.0');
    expect(localCompose).toContain(
      `'127.0.0.1:${composeVariable('MAILPIT_SMTP_PUBLISH_PORT:-1025')}:1025'`
    );
    expect(localCompose).toContain(
      `'127.0.0.1:${composeVariable('MAILPIT_HTTP_PUBLISH_PORT:-8025')}:8025'`
    );
    expect(localCompose).toContain("MP_MAX_MESSAGES: '5000'");
    expect(localCompose).toContain('MP_MAX_AGE: 7d');
    expect(localCompose).toContain('MP_DATABASE: /data/mailpit.db');
    expect(localCompose).toContain("MP_SMTP_AUTH_ACCEPT_ANY: '1'");
    expect(localCompose).toContain("MP_SMTP_AUTH_ALLOW_INSECURE: '1'");
    expect(localCompose).toContain('http://localhost:8025/readyz');
    expect(localCompose).toContain('mailpit_data:/data');
    expect(localCompose).not.toContain('MP_API_CORS');
  });

  it('documents matching Mailpit SMTP and API ports', () => {
    expect(envExample).toContain('MAILPIT_SMTP_PUBLISH_PORT=1025');
    expect(envExample).toContain('MAILPIT_HTTP_PUBLISH_PORT=8025');
    expect(envExample).toContain('SMTP_URL=smtp://127.0.0.1:1025');
    expect(envExample).toContain('MAILPIT_API_URL=http://127.0.0.1:8025');
    expect(envExample).toContain('EMAIL_FROM="');
  });

  it('starts Playwright with complete Mailpit SMTP settings', () => {
    expect(playwrightConfig).toContain("MAIL_TRANSPORT: 'smtp'");
    expect(playwrightConfig).toContain("SMTP_URL: 'smtp://127.0.0.1:1025'");
    expect(playwrightConfig).toContain(
      "MAILPIT_API_URL: 'http://127.0.0.1:8025'"
    );
    expect(playwrightConfig).toContain(
      "EMAIL_FROM: 'MIT Sailing <noreply@mitsailing.test>'"
    );
    expect(playwrightConfig).toContain('process.env[key] ??= value');
    expect(playwrightConfig).toContain('...process.env,');
  });

  it('uses the Mailpit API for isolated email assertions', () => {
    expect(mailpitHelper).toContain('/api/v1/messages');
    expect(mailpitHelper).toContain("method: 'DELETE'");
    expect(mailpitHelper).toContain('/api/v1/search?query=');
    expect(mailpitHelper).toMatch(/to:\$\{params\.email\}/u);
    expect(mailpitHelper).toMatch(/\/api\/v1\/message\/\$\{summary\.ID\}/u);
  });

  it('keeps shared and production Mailpit capture authenticated', () => {
    expectMailpitRelayEnvExample(stagingEnvExample);
    expectMailpitRelayEnvExample(productionEnvExample);
    expect(productionEnvExample).toContain('SMTP_URL=smtp://mailpit:1025');
    expect(productionEnvExample).toContain(
      'MAILPIT_API_URL=http://mailpit:8025'
    );
  });
});

describe('production deploy script', () => {
  const deployScript = readRepoFile('bin/deploy.sh');
  const defaultProductionDataRoot = composeVariable(
    'PRODUCTION_DATA_ROOT:-/srv/mitsailing-data'
  );
  const productionDataRoot = composeVariable('PRODUCTION_DATA_ROOT');

  it('requires admin-created production data directories without sudo', () => {
    expect(deployScript).toContain('server admin must create');
    expect(deployScript).toContain('verify_production_bind_mounts');
    expect(deployScript).not.toContain('sudo ');
    expect(deployScript).not.toContain('install_production_data_dirs');
    expect(deployScript).not.toContain('verify_production_data_dirs');
    expect(deployScript).not.toContain('[[ -d "$dir" ]]');
  });

  it('derives production data paths from a configurable root', () => {
    expect(deployScript).toContain(
      `readonly PRODUCTION_DATA_ROOT="${defaultProductionDataRoot}"`
    );
    expect(deployScript).toContain('export PRODUCTION_DATA_ROOT');
    expect(deployScript).toContain(
      `readonly PRODUCTION_POSTGRES_DIR="${productionDataRoot}/postgres"`
    );
    expect(deployScript).toContain(
      `readonly PRODUCTION_REDIS_DIR="${productionDataRoot}/redis"`
    );
    expect(deployScript).toContain(
      `readonly PRODUCTION_CMS_MEDIA_DIR="${productionDataRoot}/cms-media"`
    );
    expect(deployScript).toContain(
      `readonly PRODUCTION_MAILPIT_DIR="${productionDataRoot}/mailpit"`
    );
    expect(deployScript).toContain('validate_production_data_root');
    expect(deployScript).toContain(
      'PRODUCTION_DATA_ROOT must be an absolute path'
    );
    expect(deployScript).toContain('PRODUCTION_DATA_ROOT must not be empty');
    expect(deployScript).toContain('PRODUCTION_DATA_ROOT must not be /');
    expect(deployScript).toContain('PRODUCTION_DATA_ROOT must not end with /');
    expect(deployScript).toContain(
      'PRODUCTION_DATA_ROOT must not contain .. or ~'
    );
    expect(deployScript).not.toContain('PRODUCTION_DATA_OWNER');
    expect(deployScript).not.toContain('PRODUCTION_DATA_GROUP');
  });

  it('sets deploy state directory modes explicitly', () => {
    expect(deployScript).toContain('ensure_deploy_state');
    expect(deployScript).toContain('DEPLOY_STATE_DIR');
    expect(deployScript).toContain('NGINX_STATE_DIR');
    expect(deployScript).toContain('chmod 700 "$DEPLOY_STATE_DIR"');
    expect(deployScript).toContain('chmod 700 "$NGINX_STATE_DIR"');
  });

  it('generates subpath routes for production operations services', () => {
    expect(deployScript).toContain(`readonly MAILPIT_ROUTE="${mailpitRoute}"`);
    expect(deployScript).toContain(`location = ${mailpitRouteVariable}`);
    expect(deployScript).toContain(`return 308 ${mailpitRouteVariable}/;`);
    expect(deployScript).toContain(`location ${mailpitRouteVariable}/`);
    expect(deployScript).toContain('port_in_redirect off;');
    expect(deployScript).toContain('resolver 127.0.0.11 valid=1s ipv6=off;');
    expect(deployScript).toContain(
      String.raw`set \$mailpit_upstream mailpit:8025;`
    );
    expect(deployScript).toContain(
      String.raw`proxy_pass http://\$mailpit_upstream;`
    );
    expect(deployScript).toContain('proxy_connect_timeout 2s;');
    expect(deployScript).toContain('proxy_next_upstream error timeout;');
    expect(deployScript).toContain('proxy_next_upstream_tries 2;');
  });

  it('verifies production data mounts before running migrations', () => {
    expect(deployScript).toContain('verify_migration_data_mounts');
    expect(deployScript).toContain(
      'verify_bind_mount postgres /var/lib/postgresql "$PRODUCTION_POSTGRES_DIR"'
    );
    expect(deployScript).toContain(
      'verify_bind_mount redis /data "$PRODUCTION_REDIS_DIR"'
    );
    expect(deployScript).toContain(
      'verify_bind_mount mailpit /data "$PRODUCTION_MAILPIT_DIR"'
    );
    expect(deployScript).toContain('PG_VERSION');
    expect(deployScript).toContain('appendonlydir');
    expect(deployScript).toMatch(
      /run_migrations_for_service\(\) \{[\s\S]*wait_for_service_health postgres "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*wait_for_service_health redis "\$DEPLOY_HEALTH_TIMEOUT_SECONDS"[\s\S]*verify_migration_data_mounts[\s\S]*compose run --rm --no-deps "\$service" node \.\/node_modules\/prisma\/build\/index\.js migrate deploy/u
    );
  });
});

describe('local docker compose', () => {
  const localCompose = readRepoFile('compose.override.yaml');
  const e2eComposeScript = readRepoFile('scripts/e2e-compose-up.cjs');

  it('starts local upload and media services on loopback ports', () => {
    expect(localCompose).toContain('tusd:');
    expect(localCompose).toContain('image: tusproject/tusd:v2.10.0');
    expect(localCompose).toContain(
      `user: '${composeVariable('LOCAL_DOCKER_UID:-1000')}:${composeVariable('LOCAL_DOCKER_GID:-1000')}'`
    );
    expect(localCompose).toContain(
      `'127.0.0.1:${composeVariable('MEDIA_UPLOAD_PUBLISH_PORT:-1080')}:1080'`
    );
    expect(localCompose).toContain('-port=1080');
    expect(localCompose).toContain(
      '-upload-dir=/var/lib/mitsailing/cms-media/uploads'
    );
    expect(localCompose).toContain(
      `-hooks-http=${composeVariable('MEDIA_UPLOAD_HOOK_URL:-http://host.docker.internal:3000/api/internal/cms-media/tusd/hooks')}`
    );
    const defaultLocalAppUrl = composeVariable(
      'NEXT_PUBLIC_APP_URL:-http://localhost:3000'
    );
    const defaultCorsOrigin = composeVariable(
      'MEDIA_UPLOAD_CORS_ALLOW_ORIGIN:-'.concat(defaultLocalAppUrl)
    );
    expect(localCompose).toContain(`-cors-allow-origin=${defaultCorsOrigin}`);
    expect(localCompose).toContain(
      '-cors-allow-headers=authorization,content-type,tus-resumable,upload-length,upload-metadata,upload-offset,x-mitsailing-upload-token'
    );
    expect(localCompose).toContain(
      '-cors-expose-headers=location,tus-resumable,upload-offset,upload-length,upload-metadata,upload-expires'
    );
    expect(localCompose).toContain('http://127.0.0.1:1080/metrics');
    expect(localCompose).toMatch(
      /tusd:[\s\S]*healthcheck:[\s\S]*start_period: 30s/u
    );
    expect(localCompose).toContain('media:');
    expect(localCompose).toContain('image: nginx:1.29-alpine');
    expect(localCompose).toContain(
      `'127.0.0.1:${composeVariable('MEDIA_PUBLIC_PUBLISH_PORT:-8088')}:8080'`
    );
  });

  it('uses the gitignored local media tree for upload processing and serving', () => {
    expect(localCompose).toContain('source: ./local/cms-media');
    expect(localCompose).toContain('target: /var/lib/mitsailing/cms-media');
    expect(localCompose).toMatch(
      /source: \.\/local\/cms-media[\s\S]*target: \/var\/lib\/mitsailing\/cms-media[\s\S]*bind:[\s\S]*create_host_path: false/u
    );
    expect(localCompose).toContain('source: ./docker/nginx/media.conf');
  });

  it('starts local E2E tusd with the runner host user', () => {
    expect(e2eComposeScript).toContain('prepareLocalMediaStorage');
    expect(e2eComposeScript).toMatch(
      /prepareLocalMediaStorage\(\);[\s\S]*docker[\s\S]*compose[\s\S]*up/u
    );
    expect(e2eComposeScript).toContain('configureLocalDockerUser');
    expect(e2eComposeScript).toContain('process.getuid');
    expect(e2eComposeScript).toContain('process.getgid');
    expect(e2eComposeScript).toContain(
      'process.env.LOCAL_DOCKER_UID ??= String(uid)'
    );
    expect(e2eComposeScript).toContain(
      'process.env.LOCAL_DOCKER_GID ??= String(gid)'
    );
  });

  it('discovers the tusd service container for E2E diagnostics', () => {
    expect(e2eComposeScript).toContain('discoverTusdContainerIdentifier');
    expect(e2eComposeScript).toContain(
      "['compose', 'ps', '--format', 'json', 'tusd']"
    );
    expect(e2eComposeScript).toContain(
      "stringRecordValue(record, 'Service') === 'tusd'"
    );
    expect(e2eComposeScript).not.toContain('mitsailing-tusd-1');
  });

  it('prepares local media storage before generic compose startup', () => {
    const packageJson = readRepoFile('package.json');
    const prepareScript = readRepoFile(
      'scripts/prepare-local-media-storage.cjs'
    );

    expect(packageJson).toContain(
      'node scripts/prepare-local-media-storage.cjs && docker compose up'
    );
    expect(prepareScript).toContain(
      "prepareWritableDirectory(path.join(root, 'uploads'))"
    );
    expect(prepareScript).toContain('constants.W_OK');
  });
});

describe('production media sync script', () => {
  const syncScript = readRepoFile('scripts/sync-prod-media.mjs');
  const legacyProductionHost = [
    ['sailing', 'dock'].join('-'),
    'mit',
    'edu',
  ].join('.');

  it('requires an explicit ready-media ssh target', () => {
    expect(syncScript).toContain('PRODUCTION_SSH_TARGET');
    expect(syncScript).toContain('resolveSshTarget');
    expect(syncScript).toContain('--ssh-target');
    expect(syncScript).not.toContain('DEFAULT_SSH_TARGET');
    expect(syncScript).not.toContain(legacyProductionHost);
    expect(syncScript).toContain('DEFAULT_REMOTE_DIR');
    expect(syncScript).toContain('apps/mitsailing');
    expect(syncScript).toContain('DEFAULT_LOCAL_ROOT');
    expect(syncScript).toContain('local/cms-media');
    expect(syncScript).toContain('ready');
    expect(syncScript).not.toContain('--delete');
  });

  it('does not pipe unsanitized arguments through a local shell', () => {
    expect(syncScript).not.toContain("spawnSync('sh'");
    expect(syncScript).not.toContain("'-c'");
  });

  it('does not search PATH for local sync commands', () => {
    expect(syncScript).not.toContain("spawnSync('mkdir'");
    expect(syncScript).not.toContain("spawn('ssh'");
    expect(syncScript).not.toContain("spawn('tar'");
    expect(syncScript).toContain("const SSH_BIN = '/usr/bin/ssh';");
    expect(syncScript).toContain("const TAR_BIN = '/usr/bin/tar';");
    expect(syncScript).toContain('spawn(SSH_BIN');
    expect(syncScript).toContain('spawn(TAR_BIN');
  });

  it('aborts child process listeners after waiting for close or error', () => {
    expect(syncScript).toContain('waitForChildProcess');
    expect(syncScript).toContain("import { once } from 'node:events';");
    expect(syncScript).toContain("once(options.child, 'close'");
    expect(syncScript).toContain("once(options.child, 'error'");
    expect(syncScript).toContain('new globalThis.AbortController()');
    expect(syncScript).toContain('events.abort()');
  });

  it('uses an absolute mkdir command for local media roots', () => {
    expect(syncScript).not.toContain("from 'node:fs'");
    expect(syncScript).not.toContain('mkdirSync(');
    expect(syncScript).toContain("const MKDIR_BIN = '/bin/mkdir';");
    expect(syncScript).toContain('spawnSync(MKDIR_BIN');
  });

  it('rejects shell metacharacters in the remote app directory', () => {
    expect(syncScript).toContain('SAFE_REMOTE_DIR_PATTERN');
    expect(syncScript).toContain('remote directory path with safe characters');
  });

  it('rejects parent segments in the remote app directory', () => {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/sync-prod-media.mjs',
        '--remote-dir',
        'apps/mitsailing/..',
        '--help',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      '--remote-dir must be a remote directory path with safe characters'
    );
  });

  it('rejects unexpanded tilde segments in the remote app directory', () => {
    const tildeRemoteDirError = [
      '--remote-dir must not contain unexpanded ~ segments;',
      'expand the tilde locally or pass an absolute path',
    ].join(' ');

    expect(syncScript).not.toContain('._~/-');

    for (const remoteDir of ['~/apps/mitsailing', 'apps/~/mitsailing']) {
      const result = spawnSync(
        process.execPath,
        ['scripts/sync-prod-media.mjs', '--remote-dir', remoteDir, '--help'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(tildeRemoteDirError);
    }
  });

  it('rejects dangling ssh target at signs before connecting', () => {
    for (const target of ['@host', 'user@']) {
      const result = spawnSync(
        process.execPath,
        ['scripts/sync-prod-media.mjs', '--ssh-target', target, '--help'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        '--ssh-target must be a host target such as host or user@host'
      );
    }
  });
});
