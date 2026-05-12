import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getReadinessHealthMock } = vi.hoisted(() => ({
  getReadinessHealthMock: vi.fn(),
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    HEALTHCHECK_SECRET: 'ready-secret-that-is-long-enough-000',
  },
}));

vi.mock('@/libs/health/readiness', () => ({
  getReadinessHealth: getReadinessHealthMock,
}));

async function importRoute() {
  const route = await import('./route');
  return route;
}

function readyRequest(secret?: string) {
  const headers = new Headers();
  if (secret) {
    headers.set('authorization', `Bearer ${secret}`);
  }
  return new Request('https://example.test/api/health/ready', { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  getReadinessHealthMock.mockResolvedValue({
    status: 'ok',
    service: 'nextjs',
    appEnv: 'production',
    timestamp: '2026-05-12T00:00:00.000Z',
    latencyMs: 12,
    checks: {
      postgres: { status: 'ok', required: true, latencyMs: 4 },
      redis: { status: 'ok', required: true, latencyMs: 8 },
    },
  });
});

describe('GET /api/health/ready', () => {
  it('rejects missing bearer auth', async () => {
    const { GET } = await importRoute();
    const response = await GET(readyRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: 'unauthorized' });
    expect(getReadinessHealthMock).not.toHaveBeenCalled();
  });

  it('returns ok readiness status', async () => {
    const { GET } = await importRoute();
    const response = await GET(
      readyRequest('ready-secret-that-is-long-enough-000')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body.status).toBe('ok');
    expect(getReadinessHealthMock).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable readiness status', async () => {
    getReadinessHealthMock.mockResolvedValue({
      status: 'fail',
      service: 'nextjs',
      appEnv: 'production',
      timestamp: '2026-05-12T00:00:00.000Z',
      latencyMs: 12,
      checks: {
        postgres: { status: 'fail', required: true, latencyMs: 4 },
        redis: { status: 'ok', required: true, latencyMs: 8 },
      },
    });

    const { GET } = await importRoute();
    const response = await GET(
      readyRequest('ready-secret-that-is-long-enough-000')
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('fail');
  });

  it('runs readiness check for head', async () => {
    const { HEAD } = await importRoute();
    const response = await HEAD(
      readyRequest('ready-secret-that-is-long-enough-000')
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(getReadinessHealthMock).toHaveBeenCalledTimes(1);
  });
});
