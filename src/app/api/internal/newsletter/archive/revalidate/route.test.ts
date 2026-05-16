import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    NEWSLETTER_REVALIDATE_SECRET:
      'test-newsletter-revalidate-secret-with-thirty-two-chars',
  },
}));

function revalidateRequest(authorization: string | null) {
  const headers = new Headers();
  if (authorization) {
    headers.set('authorization', authorization);
  }

  return new Request(
    'https://mitsailing.test/api/internal/newsletter/archive/revalidate',
    { headers, method: 'POST' }
  );
}

describe('newsletter archive revalidation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates the archive with the internal bearer token', async () => {
    const response = POST(
      revalidateRequest(
        'Bearer test-newsletter-revalidate-secret-with-thirty-two-chars'
      )
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/newsletter/archive');
  });

  it('rejects requests without the internal bearer token', async () => {
    const response = POST(revalidateRequest(null));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(401);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects malformed bearer tokens without throwing', async () => {
    const response = POST(revalidateRequest('Bearer short'));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(401);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
