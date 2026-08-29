import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit, newsletterSignupRateLimit } from '@/libs/rateLimit';

const mockEnv = vi.hoisted(() => ({
  IS_E2E: undefined as '1' | undefined,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/libs/Env', () => ({ Env: mockEnv }));

describe('checkRateLimit', () => {
  it('allow five newsletter signup consumes then block the sixth', async () => {
    mockEnv.IS_E2E = undefined;
    const clientId = 'signup-1';
    for (let i = 0; i < newsletterSignupRateLimit.points - 1; i += 1) {
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      });
    }

    expect(
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      })
    ).toEqual({ rateLimited: false });
    expect(
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      })
    ).toEqual({ rateLimited: true });
  });

  it('allow sixth consume when e2e is enabled', async () => {
    mockEnv.IS_E2E = '1';
    const clientId = 'signup-2';
    for (let i = 0; i < newsletterSignupRateLimit.points; i += 1) {
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      });
    }

    expect(
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      })
    ).toEqual({ rateLimited: false });
  });
});
