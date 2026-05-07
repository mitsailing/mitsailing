import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@/libs/Env', () => ({
  Env: { CRON_SECRET: 'replace-with-a-32-char-test-secret' },
}));
vi.mock('@/libs/mit-sailing/siteAlertQueries', () => ({
  SITE_ALERTS_CACHE_TAG: 'site-alerts',
}));

describe('POST /api/cron/site-alerts/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
  });

  it('rejects missing bearer token', async () => {
    const { POST } = await import('./route');

    const response = POST(
      new Request('https://example.test/api/cron/site-alerts/revalidate', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects wrong bearer token', async () => {
    const { POST } = await import('./route');

    const response = POST(
      new Request('https://example.test/api/cron/site-alerts/revalidate', {
        headers: { authorization: 'Bearer wrong-secret' },
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('revalidates alert cache with correct bearer token', async () => {
    const { POST } = await import('./route');

    const response = POST(
      new Request('https://example.test/api/cron/site-alerts/revalidate', {
        headers: {
          authorization: 'Bearer replace-with-a-32-char-test-secret',
        },
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(revalidateTag).toHaveBeenCalledWith('site-alerts', { expire: 0 });
  });
});
