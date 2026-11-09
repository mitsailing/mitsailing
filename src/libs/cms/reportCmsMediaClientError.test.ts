import * as Sentry from '@sentry/nextjs';
import { describe, expect, it, vi } from 'vitest';
import { reportCmsMediaClientError } from './reportCmsMediaClientError';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('reportCmsMediaClientError', () => {
  it('captures thrown errors as exceptions', () => {
    const error = new Error('cancel failed');

    reportCmsMediaClientError({
      action: 'cancelUpload',
      assetId: 'asset-1',
      error,
      message: 'Failed to cancel CMS media upload',
      route: '/api/admin/cms-media/uploads/asset-1',
      status: 500,
      userId: 'user-1',
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { cmsMediaAction: 'cancelUpload' },
      contexts: {
        cmsMediaUpload: {
          assetId: 'asset-1',
          route: '/api/admin/cms-media/uploads/asset-1',
          sessionAssetId: undefined,
          status: 500,
          uploadAssetId: undefined,
          userId: 'user-1',
        },
      },
      user: { id: 'user-1' },
    });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('captures finalize failures as exceptions with route and status', () => {
    reportCmsMediaClientError({
      action: 'finalizeUpload',
      message: 'CMS media upload finalize failed',
      route: '/api/admin/cms-media/uploads/upload-1/finalize',
      sessionAssetId: 'session-1',
      status: 500,
      uploadAssetId: 'upload-1',
      userId: 'user-1',
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      level: 'error',
      tags: { cmsMediaAction: 'finalizeUpload' },
      contexts: {
        cmsMediaUpload: {
          assetId: undefined,
          route: '/api/admin/cms-media/uploads/upload-1/finalize',
          sessionAssetId: 'session-1',
          status: 500,
          uploadAssetId: 'upload-1',
          userId: 'user-1',
        },
      },
      user: { id: 'user-1' },
    });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
