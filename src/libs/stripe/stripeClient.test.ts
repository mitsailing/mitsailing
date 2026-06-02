import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

describe('getStripeClient', () => {
  beforeEach(() => {
    globalThis.cachedStripeClient = undefined;
    mocks.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  });

  it('initializes client with pinned api version', async () => {
    const { getStripeClient } = await import('@/libs/stripe/stripeClient');

    const stripe = getStripeClient();

    expect(stripe.getApiField('version')).toBe('2026-05-27.dahlia');
  });
});
