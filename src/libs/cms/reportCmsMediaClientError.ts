'use client';

import * as Sentry from '@sentry/nextjs';

type CmsMediaClientErrorAction = 'cancelUpload' | 'finalizeUpload';

/**
 * Reports CMS media client failures to Sentry using the browser SDK namespace.
 *
 * @param options - Upload action context and optional thrown error.
 */
export function reportCmsMediaClientError(options: {
  action: CmsMediaClientErrorAction;
  message: string;
  assetId?: string;
  sessionAssetId?: string;
  uploadAssetId?: string;
  error?: unknown;
}) {
  const cmsMediaUpload = {
    assetId: options.assetId,
    sessionAssetId: options.sessionAssetId,
    uploadAssetId: options.uploadAssetId,
  };
  const tags = { cmsMediaAction: options.action };

  if (options.error instanceof Error) {
    Sentry.captureException(options.error, {
      tags,
      contexts: { cmsMediaUpload },
    });
    return;
  }

  Sentry.captureMessage(options.message, {
    level: 'error',
    tags,
    contexts: { cmsMediaUpload },
  });
}
