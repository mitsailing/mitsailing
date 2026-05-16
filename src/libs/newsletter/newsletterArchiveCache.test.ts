import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestNewsletterArchiveRevalidation } from '@/libs/newsletter/newsletterArchiveCache';

const mockEnv = vi.hoisted(() => ({
  NEWSLETTER_REVALIDATE_SECRET: undefined as string | undefined,
}));

vi.mock('@/libs/Env', () => ({
  Env: mockEnv,
}));

vi.mock('@/utils/Helpers', () => ({
  getBaseUrl: () => 'https://mitsailing.test',
}));

describe('requestNewsletterArchiveRevalidation', () => {
  beforeEach(() => {
    mockEnv.NEWSLETTER_REVALIDATE_SECRET = undefined;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('skips internal request without a revalidation secret', async () => {
    await expect(requestNewsletterArchiveRevalidation()).resolves.toBe(false);

    expect(fetch).not.toHaveBeenCalled();
  });
});
