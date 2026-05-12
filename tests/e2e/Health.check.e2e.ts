import { expect, test } from '@playwright/test';

test.describe('Health endpoints', () => {
  test('returns live status', async ({ request }) => {
    const response = await request.get('/api/health/live');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'nextjs',
    });
  });

  test('returns ready status with monitor secret', async ({ request }) => {
    test.skip(
      !process.env.HEALTHCHECK_SECRET,
      'HEALTHCHECK_SECRET is required for protected readiness monitoring'
    );

    const response = await request.get('/api/health/ready', {
      headers: {
        Authorization: `Bearer ${process.env.HEALTHCHECK_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'nextjs',
    });
  });
});
