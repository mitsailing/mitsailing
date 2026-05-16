import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips internal request without a revalidation secret', async () => {
    await expect(requestNewsletterArchiveRevalidation()).resolves.toBe(false);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends internal request with configured revalidation secret', async () => {
    mockEnv.NEWSLETTER_REVALIDATE_SECRET = 'test-secret';
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await expect(requestNewsletterArchiveRevalidation()).resolves.toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      new URL(
        '/api/internal/newsletter/archive/revalidate',
        'https://mitsailing.test'
      ),
      {
        headers: {
          authorization: 'Bearer test-secret',
        },
        method: 'POST',
      }
    );
  });

  it('returns false when internal request is unsuccessful', async () => {
    mockEnv.NEWSLETTER_REVALIDATE_SECRET = 'test-secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(requestNewsletterArchiveRevalidation()).resolves.toBe(false);
  });

  it('returns false when internal request rejects', async () => {
    mockEnv.NEWSLETTER_REVALIDATE_SECRET = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    );

    await expect(requestNewsletterArchiveRevalidation()).resolves.toBe(false);
  });
});
