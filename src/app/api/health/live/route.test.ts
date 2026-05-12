import { describe, expect, it } from 'vitest';
import { GET, HEAD } from './route';

describe('GET /api/health/live', () => {
  it('returns public liveness status', async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toMatchObject({
      status: 'ok',
      service: 'nextjs',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns head without body', async () => {
    const response = HEAD();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).toBe('');
  });
});
