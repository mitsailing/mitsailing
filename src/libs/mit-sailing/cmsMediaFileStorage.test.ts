import { describe, expect, it } from 'vitest';
import {
  buildCmsMediaReadyPath,
  buildCmsMediaReadyUrl,
  resolveTusUploadFilePath,
} from '@/libs/mit-sailing/cmsMediaFileStorage';

describe('cms media server-folder storage', () => {
  const root = '/var/lib/mitsailing/cms-media';

  it('builds root-contained ready paths', () => {
    expect(
      buildCmsMediaReadyPath({
        assetId: 'asset-1',
        filename: 'race-day.jpg',
        root,
      })
    ).toBe('/var/lib/mitsailing/cms-media/ready/asset-1/race-day.jpg');
  });

  it('rejects unsafe tus upload ids', () => {
    expect(
      resolveTusUploadFilePath({
        root,
        uploadId: '../escape',
      })
    ).toBeNull();
  });

  it('maps ready file paths to media URLs', () => {
    expect(
      buildCmsMediaReadyUrl({
        baseUrl: 'https://mitsailing.com/',
        publicPath: '/cms-media/asset-1/race-day.jpg',
      })
    ).toBe('https://mitsailing.com/cms-media/asset-1/race-day.jpg');
  });
});
