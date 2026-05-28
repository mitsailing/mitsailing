import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

function readYamlServiceBlock(source: string, service: string): string {
  const marker = `  ${service}:`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextService = source.slice(start + marker.length).search(/\n {2}\w/u);
  if (nextService === -1) {
    return source.slice(start);
  }
  return source.slice(start, start + marker.length + nextService);
}

function composeVariable(value: string): string {
  return `\${${value}}`;
}

describe('production docker compose', () => {
  const productionCompose = readRepoFile('compose.prod.yaml');
  const deployRunbook = readRepoFile('docs/deploy.md');
  const deployWorkflow = readRepoFile('.github/workflows/deploy.yml');
  const localDevelopmentRunbook = readRepoFile('docs/local-development.md');
  const mediaMaintenanceRunbook = readRepoFile('docs/media-maintenance.md');
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
    expect(productionCompose).toContain('tusd:');
    expect(productionCompose).toContain('image: tusproject/tusd:v2.9.2');
    expect(productionCompose).toContain("user: '1001:1001'");
    expect(productionCompose).toContain('media:');
    expect(productionCompose).toContain('cloudflared:');
    expect(productionCompose).toContain(`${productionDataRoot}/postgres`);
    expect(productionCompose).toContain(`${productionDataRoot}/redis`);
    expect(productionCompose).toContain(`${productionDataRoot}/cms-media`);
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
  });

  it('routes the MIT Sailing tunnel to in-stack docker services', () => {
    const cloudflaredBlock = readYamlServiceBlock(
      productionCompose,
      'cloudflared'
    );
    expect(productionCompose).toContain('cloudflare/cloudflared');
    expect(productionCompose).toContain('CLOUDFLARE_TUNNEL_TOKEN');
    expect(cloudflaredBlock).toContain('depends_on:');
    expect(cloudflaredBlock).toContain('app:');
    expect(cloudflaredBlock).toContain('tusd:');
    expect(cloudflaredBlock).toContain('media:');
    expect(cloudflaredBlock).toMatch(/tusd:\s+condition: service_healthy/u);
    expect(cloudflaredBlock).not.toContain('ports:');
    expect(deployRunbook).toContain('service: http://tusd:1080');
    expect(deployRunbook).toContain('service: http://media:8080');
    expect(deployRunbook).toContain('service: http://app:3000');
  });

  it('documents the CI-first production deploy flow', () => {
    expect(deployRunbook).toContain('Open a PR.');
    expect(deployRunbook).toContain(
      'Wait for CI, CodeRabbit, Codacy, Sonar, and human review.'
    );
    expect(deployRunbook).toContain(
      'If CodeRabbit is unavailable, run a local sub-agent code review before merge.'
    );
    expect(deployRunbook).toContain('Merge the approved PR to `main`.');
    expect(deployRunbook).toContain(
      'GitHub runs `Deploy (production)` from `main`.'
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
      '`PRODUCTION_DATA_ROOT/cms-media/ready` from the remote `media` container'
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

    expect(deployWorkflow).toContain('validate_remote_app_dir');
    expect(deployWorkflow).toContain(
      'PRODUCTION_REMOTE_APP_DIR must use safe path characters'
    );
    expect(deployWorkflow).toContain(
      'PRODUCTION_REMOTE_APP_DIR must not contain path segments starting with -'
    );
    expect(deployWorkflow).toContain(
      `"mkdir -p ${escapedAppDir}/bin ${escapedAppDir}/docker/postgres ${escapedAppDir}/docker/nginx"`
    );
    expect(deployWorkflow).toContain(
      `"chmod +x ${escapedAppDir}/bin/deploy.sh"`
    );
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
      `"${escapedDataRootAssignment}DEPLOY_DIR=${escapedAppDir} ${escapedDeployScript} release ${escapedImageTag}"`
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
    expect(deployScript).toContain('validate_production_data_root');
    expect(deployScript).toContain(
      'PRODUCTION_DATA_ROOT must be an absolute path'
    );
    expect(deployScript).toContain('PRODUCTION_DATA_ROOT must not be empty');
    expect(deployScript).toContain('PRODUCTION_DATA_ROOT must not be /');
    expect(deployScript).toContain('PRODUCTION_DATA_ROOT must not end with /');
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

  it('verifies production data mounts before running migrations', () => {
    expect(deployScript).toContain('verify_migration_data_mounts');
    expect(deployScript).toContain(
      'verify_bind_mount postgres /var/lib/postgresql "$PRODUCTION_POSTGRES_DIR"'
    );
    expect(deployScript).toContain(
      'verify_bind_mount redis /data "$PRODUCTION_REDIS_DIR"'
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

  it('starts local upload and media services on loopback ports', () => {
    expect(localCompose).toContain('tusd:');
    expect(localCompose).toContain('image: tusproject/tusd:v2.9.2');
    expect(localCompose).toContain(
      `'127.0.0.1:${composeVariable('MEDIA_UPLOAD_PUBLISH_PORT:-1080')}:1080'`
    );
    expect(localCompose).toContain('-port=1080');
    expect(localCompose).toContain(
      '-upload-dir=/var/lib/mitsailing/cms-media/uploads'
    );
    expect(localCompose).toContain(
      '-hooks-http=http://host.docker.internal:3000/api/internal/cms-media/tusd/hooks'
    );
    expect(localCompose).toContain('http://127.0.0.1:1080/metrics');
    expect(localCompose).toContain('media:');
    expect(localCompose).toContain('image: nginx:1.29-alpine');
    expect(localCompose).toContain(
      `'127.0.0.1:${composeVariable('MEDIA_PUBLIC_PUBLISH_PORT:-8088')}:8080'`
    );
  });

  it('uses the gitignored local media tree for upload processing and serving', () => {
    expect(localCompose).toContain('source: ./local/cms-media');
    expect(localCompose).toContain('target: /var/lib/mitsailing/cms-media');
    expect(localCompose).toContain('source: ./docker/nginx/media.conf');
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
