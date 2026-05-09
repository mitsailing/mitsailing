import * as Sentry from '@sentry/nextjs';
import { describe, expect, it, vi } from 'vitest';
import { reportUnknownAuthClientError } from './reportAuthClientError';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

describe('reportUnknownAuthClientError', () => {
  it('captures unknown auth client error context', () => {
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
            message: 'Provider failed',
          },
        },
      }
    );
  });

  it('reports missing error codes safely', () => {
    reportUnknownAuthClientError({
      action: 'reset_password',
      code: undefined,
      message: undefined,
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authErrorCode: 'missing',
        }),
      })
    );
  });
});
