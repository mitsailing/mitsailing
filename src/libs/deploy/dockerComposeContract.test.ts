import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function composeVariable(value: string): string {
  return `${String.fromCodePoint(36)}{${value}}`;
}

describe('production docker compose split', () => {
  const appHostCompose = readRepoFile('compose.prod.app-host.yaml');
  const dataCompose = readRepoFile('compose.prod.data.yaml');
  const mediaNginx = readRepoFile('docker/nginx/media.conf');

  it('keeps durable services on the data and media server', () => {
    expect(dataCompose).toContain('postgres:');
    expect(dataCompose).toContain('redis:');
    expect(dataCompose).toContain('tusd:');
    expect(dataCompose).toContain('image: tusproject/tusd:v2.9.2');
    expect(dataCompose).not.toContain('upload-service:');
    expect(dataCompose).not.toContain('media-worker:');
    expect(dataCompose).not.toContain('media-upload:');
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

  it('runs tusd with local disk storage and upload hardening', () => {
    expect(dataCompose).toContain('tusd:');
    expect(dataCompose).toContain(
      'source: /srv/mitsailing-data/cms-media/uploads'
    );
    expect(dataCompose).toContain(
      'target: /srv/mitsailing-data/cms-media/uploads'
    );
    expect(dataCompose).toContain(
      '-upload-dir=/srv/mitsailing-data/cms-media/uploads'
    );
    expect(dataCompose).toContain('-base-path=/cms-media/uploads/');
    expect(dataCompose).toContain('-disable-download');
    expect(dataCompose).toContain('-behind-proxy');
    expect(dataCompose).toContain(
      `-max-size=${composeVariable('MEDIA_UPLOAD_MAX_BYTES:-104857600')}`
    );
    expect(dataCompose).toContain(
      `-hooks-http=${composeVariable('TUSD_HOOKS_HTTP_URL:?set TUSD_HOOKS_HTTP_URL')}`
    );
    expect(dataCompose).toContain(
      '-hooks-http-forward-headers=x-mitsailing-upload-token'
    );
    expect(dataCompose).toContain(
      `-cors-allow-origin=${composeVariable('MEDIA_UPLOAD_CORS_ALLOW_ORIGIN:-https://mitsailing.com')}`
    );
    expect(dataCompose).toContain(
      '-cors-allow-headers=authorization,content-type,tus-resumable,upload-length,upload-metadata,upload-offset,x-mitsailing-upload-token'
    );
    expect(dataCompose).toContain(
      '-cors-expose-headers=location,tus-resumable,upload-offset,upload-length,upload-metadata,upload-expires'
    );
    expect(dataCompose).toContain(
      `'${composeVariable('UPLOAD_SERVICE_BIND_HOST:?set UPLOAD_SERVICE_BIND_HOST')}:${composeVariable('UPLOAD_SERVICE_PORT:-3001')}:1080'`
    );
    expect(dataCompose).toContain(
      `'${composeVariable('DATA_PRIVATE_BIND_HOST:?set DATA_PRIVATE_BIND_HOST')}:${composeVariable('POSTGRES_PORT:-5432')}:5432'`
    );
    expect(dataCompose).toContain(
      `'${composeVariable('MEDIA_HTTP_BIND_HOST:?set MEDIA_HTTP_BIND_HOST')}:${composeVariable('MEDIA_HTTP_PORT:-8080')}:8080'`
    );
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
