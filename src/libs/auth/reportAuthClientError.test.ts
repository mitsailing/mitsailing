import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportUnknownAuthClientError } from './reportAuthClientError';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportUnknownAuthClientError', () => {
  it('redacts provider auth client error messages', () => {
    reportUnknownAuthClientError({
      action: 'sign_up',
      code: 'PROVIDER_DOWN',
      message: 'Provider failed',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      {
        level: 'warning',
        tags: {
          authAction: 'sign_up',
          authErrorCode: 'PROVIDER_DOWN',
        },
        contexts: {
          authClientError: {
            code: 'PROVIDER_DOWN',
            message: '[redacted]',
          },
        },
      }
    );
  });

  it('keeps mapped auth client error messages', () => {
    reportUnknownAuthClientError({
      action: 'sign_up',
      code: 'PASSWORD_CHECK_FAILED',
      message: 'Password check failed',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authAction: 'sign_up',
          authErrorCode: 'PASSWORD_CHECK_FAILED',
        }),
        contexts: {
          authClientError: {
            code: 'PASSWORD_CHECK_FAILED',
            message: 'Password check failed',
          },
        },
      })
    );
  });

  it('reports missing error codes safely', () => {
    reportUnknownAuthClientError({
      action: 'reset_password',
      code: undefined,
      message: 'Provider failed',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authErrorCode: 'missing',
        }),
        contexts: {
          authClientError: {
            code: undefined,
            message: '[redacted]',
          },
        },
      })
    );
  });

  it('redacts unknown auth client error messages', () => {
    reportUnknownAuthClientError({
      action: 'reset_password',
      code: 'unknown',
      message: 'Provider failed',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authAction: 'reset_password',
          authErrorCode: 'unknown',
        }),
        contexts: {
          authClientError: {
            code: 'unknown',
            message: '[redacted]',
          },
        },
      })
    );
  });
});
