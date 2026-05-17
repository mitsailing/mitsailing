import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('durable CMS media schema contract', () => {
  const schema = readRepoFile('prisma/schema.prisma');

  it('models upload status and media kind for queued processing', () => {
    expect(schema).toContain('enum CmsMediaStatus');
    expect(schema).toContain('uploading');
    expect(schema).toContain('queued');
    expect(schema).toContain('processing');
    expect(schema).toContain('ready');
    expect(schema).toContain('failed');
    expect(schema).toContain('enum CmsMediaKind');
    expect(schema).toContain('image');
    expect(schema).toContain('file');
    expect(schema).toContain('video');
  });

  it('stores server-folder upload and ready-file paths', () => {
    expect(schema).toContain('enum CmsMediaStorageProvider');
    expect(schema).toContain('server_folder');
    expect(schema).toContain('storageProvider');
    expect(schema).toContain('rawUploadId');
    expect(schema).toContain('rawFilePath');
    expect(schema).toContain('readyFilePath');
    expect(schema).toContain('thumbnailFilePath');
    expect(schema).toContain('processingErrorCode');
    expect(schema).toContain('processedAt');
    expect(schema).toContain('metadata');
    expect(schema).toMatch(/publicPath\s+String\s+@unique/u);
  });
});
