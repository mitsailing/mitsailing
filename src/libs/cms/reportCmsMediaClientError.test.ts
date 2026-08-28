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
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { cmsMediaAction: 'cancelUpload' },
      contexts: {
        cmsMediaUpload: {
          assetId: 'asset-1',
          sessionAssetId: undefined,
          uploadAssetId: undefined,
        },
      },
    });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('captures finalize failures as error messages', () => {
    reportCmsMediaClientError({
      action: 'finalizeUpload',
      message: 'CMS media upload finalize failed',
      sessionAssetId: 'session-1',
      uploadAssetId: 'upload-1',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'CMS media upload finalize failed',
      {
        level: 'error',
        tags: { cmsMediaAction: 'finalizeUpload' },
        contexts: {
          cmsMediaUpload: {
            assetId: undefined,
            sessionAssetId: 'session-1',
            uploadAssetId: 'upload-1',
          },
        },
      }
    );
  });
});
