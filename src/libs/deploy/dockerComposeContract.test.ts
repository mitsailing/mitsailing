import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function composeVariable(value: string): string {
  return `${String.fromCodePoint(36)}{${value}}`;
}

describe('production docker compose', () => {
  const productionCompose = readRepoFile('compose.prod.yaml');
  const mediaNginx = readRepoFile('docker/nginx/media.conf');

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
    expect(productionCompose).toContain('/srv/mitsailing-data/postgres');
    expect(productionCompose).toContain('/srv/mitsailing-data/redis');
    expect(productionCompose).toContain('/srv/mitsailing-data/cms-media');
    expect(productionCompose).not.toContain('PRODUCTION_DATA_ROOT');
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
      /source: \/srv\/mitsailing-data\/postgres\s+target: \/var\/lib\/postgresql\s+bind:\s+create_host_path: false/u
    );
    expect(productionCompose).toMatch(
      /source: \/srv\/mitsailing-data\/redis\s+target: \/data\s+bind:\s+create_host_path: false/u
    );
    expect(productionCompose).toMatch(
      /source: \/srv\/mitsailing-data\/cms-media\s+target: \/var\/lib\/mitsailing\/cms-media\s+bind:\s+create_host_path: false/u
    );
  });

  it('runs tusd with local disk storage and upload hardening', () => {
    expect(productionCompose).toContain('tusd:');
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
  });

  it('routes the MIT Sailing tunnel to in-stack docker services', () => {
    expect(productionCompose).toContain('cloudflare/cloudflared');
    expect(productionCompose).toContain('CLOUDFLARE_TUNNEL_TOKEN');
    expect(productionCompose).toContain('depends_on:');
    expect(productionCompose).toContain('app:');
    expect(productionCompose).toContain('tusd:');
    expect(productionCompose).toContain('media:');
    expect(productionCompose).not.toContain('ports:');
  });
});

describe('production deploy script', () => {
  const deployScript = readRepoFile('bin/deploy.sh');

  it('requires admin-created production data directories without sudo', () => {
    expect(deployScript).toContain('server admin must create');
    expect(deployScript).toContain('verify_production_bind_mounts');
    expect(deployScript).not.toContain('sudo ');
    expect(deployScript).not.toContain('install_production_data_dirs');
    expect(deployScript).not.toContain('verify_production_data_dirs');
    expect(deployScript).not.toContain('[[ -d "$dir" ]]');
  });

  it('uses the fixed production data root', () => {
    expect(deployScript).toContain(
      'readonly PRODUCTION_DATA_ROOT="/srv/mitsailing-data"'
    );
    expect(deployScript).not.toContain('PRODUCTION_DATA_OWNER');
    expect(deployScript).not.toContain('PRODUCTION_DATA_GROUP');
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
    expect(localCompose).toContain(
      '-upload-dir=/var/lib/mitsailing/cms-media/uploads'
    );
    expect(localCompose).toContain(
      '-hooks-http=http://host.docker.internal:3000/api/internal/cms-media/tusd/hooks'
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
});
