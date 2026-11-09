'use client';

import * as Sentry from '@sentry/nextjs';

type CmsMediaClientErrorAction =
  | 'cancelUpload'
  | 'finalizeUpload'
  | 'listAssets'
  | 'uploadFile';

/**
 * Reports CMS media client failures to Sentry using the browser SDK namespace.
 *
 * @param options - Upload action context and optional thrown error.
 */
export function reportCmsMediaClientError(options: {
  action: CmsMediaClientErrorAction;
  message: string;
  assetId?: string;
  route?: string;
  sessionAssetId?: string;
  status?: number;
  uploadAssetId?: string;
  userId?: string | null;
  error?: unknown;
}) {
  const cmsMediaUpload = {
    assetId: options.assetId,
    route: options.route,
    sessionAssetId: options.sessionAssetId,
    status: options.status,
    uploadAssetId: options.uploadAssetId,
    userId: options.userId ?? undefined,
  };
  const tags = { cmsMediaAction: options.action };

  if (options.error instanceof Error) {
    Sentry.captureException(options.error, {
      tags,
      contexts: { cmsMediaUpload },
      user: options.userId ? { id: options.userId } : undefined,
    });
    return;
  }

  const error = new Error(options.message);
  Sentry.captureException(error, {
    level: 'error',
    tags,
    contexts: { cmsMediaUpload },
    user: options.userId ? { id: options.userId } : undefined,
  });
}
