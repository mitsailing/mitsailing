import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('production docker compose split', () => {
  const appHostCompose = readRepoFile('compose.prod.app-host.yaml');
  const dataCompose = readRepoFile('compose.prod.data.yaml');
  const mediaNginx = readRepoFile('docker/nginx/media.conf');

  it('keeps durable services on the data and media server', () => {
    expect(dataCompose).toContain('postgres:');
    expect(dataCompose).toContain('redis:');
    expect(dataCompose).toContain('upload-service:');
    expect(dataCompose).toContain("command: ['node', 'upload-service.mjs']");
    expect(dataCompose).toContain('worker:');
    expect(dataCompose).toContain("command: ['node', 'worker.mjs']");
    expect(dataCompose).toContain('media:');
    expect(dataCompose).toContain('docker/nginx/media.conf');
    expect(dataCompose).toContain('source: /srv/mitsailing-data/postgres');
    expect(dataCompose).toContain('source: /srv/mitsailing-data/redis');
  });

  it('uses one media storage path for upload processing and serving', () => {
    expect(dataCompose).toContain(
      'MEDIA_STORAGE_ROOT: /srv/mitsailing-data/cms-media'
    );
    expect(dataCompose).toContain('source: /srv/mitsailing-data/cms-media');
    expect(dataCompose).toContain('target: /srv/mitsailing-data/cms-media');
    expect(mediaNginx).toContain('location = /healthz');
    expect(mediaNginx).toContain('alias /srv/mitsailing-data/cms-media/ready/');
  });

  it('keeps app hosts stateless for uploaded media', () => {
    expect(appHostCompose).toContain('web:');
    expect(appHostCompose).toContain('.env.production');
    expect(appHostCompose).toContain('.env.production.app-host');
    expect(appHostCompose).toContain('HOST_TRAFFIC_STATE_FILE');
    expect(appHostCompose).toContain('/run/mitsailing/traffic-enabled');
    expect(appHostCompose).not.toContain('upload-service:');
    expect(appHostCompose).not.toContain('worker:');
    expect(appHostCompose).not.toContain('postgres:');
    expect(appHostCompose).not.toContain('redis:');
    expect(appHostCompose).not.toContain('/srv/mitsailing-data/cms-media');
  });
});
