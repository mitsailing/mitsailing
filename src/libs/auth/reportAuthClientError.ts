'use client';

import * as Sentry from '@sentry/nextjs';

const redactedAuthClientErrorMessage = '[redacted]';

function isUntrustedAuthClientErrorCode(code: string | undefined) {
  if (!code || code.toLowerCase() === 'unknown') {
    return true;
  }
  return code.toLowerCase().includes('provider');
}

function sanitizeAuthClientErrorMessage(options: {
  code: string | undefined;
  message: string | undefined;
}) {
  return options.message && isUntrustedAuthClientErrorCode(options.code)
    ? redactedAuthClientErrorMessage
    : options.message;
}

/**
 * Captures unmapped auth client errors without surfacing provider copy.
 *
 * @param options - Error context from an auth client response.
 */
export function reportUnknownAuthClientError(options: {
  action: string;
  code: string | undefined;
  message: string | undefined;
}) {
  const message = sanitizeAuthClientErrorMessage(options);

  Sentry.captureMessage('Unknown auth client error', {
    level: 'warning',
    tags: {
      authAction: options.action,
      authErrorCode: options.code ?? 'missing',
    },
    contexts: {
      authClientError: {
        code: options.code,
        message,
      },
    },
  });
}
