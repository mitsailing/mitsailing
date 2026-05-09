'use client';

import * as Sentry from '@sentry/nextjs';

/**
 * Captures unmapped auth client errors with Sentry-readable diagnostics.
 *
 * @param options - Error context from an auth client response.
 */
export function reportUnknownAuthClientError(options: {
  action: string;
  code: string | undefined;
  message: string | undefined;
}) {
  Sentry.captureMessage('Unknown auth client error', {
    level: 'warning',
    tags: {
      authAction: options.action,
      authErrorCode: options.code ?? 'missing',
    },
    contexts: {
      authClientError: {
        code: options.code,
        message: options.message,
      },
    },
  });
}
