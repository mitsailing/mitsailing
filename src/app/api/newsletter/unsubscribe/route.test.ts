import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  newsletterManageUrl: vi.fn(
    (token: string, options?: { unsubscribedListId?: string }) => {
      const search = new URLSearchParams({ token });
      if (options?.unsubscribedListId) {
        search.set('unsubscribedList', options.unsubscribedListId);
      }
      return `https://mitsailing.test/newsletter/manage?${search.toString()}`;
    }
  ),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  unsubscribeNewsletterTokenFromList: vi.fn(),
}));

vi.mock('@/libs/newsletter/newsletterSubscriptions', () => ({
  unsubscribeNewsletterTokenFromList: mocks.unsubscribeNewsletterTokenFromList,
}));

vi.mock('@/libs/newsletter/newsletterUrls', () => ({
  newsletterManageUrl: mocks.newsletterManageUrl,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unsubscribeNewsletterTokenFromList.mockResolvedValue({
    id: 'subscriber_123',
  });
});

function unsubscribeRequest(options?: {
  body?: BodyInit;
  method?: string;
  url?: string;
}) {
  return new Request(
    options?.url ??
      'https://mitsailing.test/api/newsletter/unsubscribe?token=token_123&list=list_123',
    {
      body: options?.body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: options?.method ?? 'GET',
    }
  );
}

describe('newsletter one-click unsubscribe route', () => {
  it('unsubscribes get requests before redirecting to manage preferences', async () => {
    const response = await GET(unsubscribeRequest());

    expect(mocks.unsubscribeNewsletterTokenFromList).toHaveBeenCalledWith(
      'token_123',
      'list_123'
    );
    expect(mocks.newsletterManageUrl).toHaveBeenCalledWith('token_123', {
      unsubscribedListId: 'list_123',
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://mitsailing.test/newsletter/manage?token=token_123&unsubscribedList=list_123'
    );
  });

  it('returns internal errors when browser unsubscribe links fail', async () => {
    mocks.unsubscribeNewsletterTokenFromList.mockRejectedValueOnce(
      new Error('db down')
    );

    const response = await GET(unsubscribeRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'internal',
      ok: false,
    });
    expect(response.status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to unsubscribe newsletter token: {error}',
      expect.objectContaining({
        error: expect.any(Error),
        listId: 'list_123',
      })
    );
  });

  it('unsubscribes post requests using url identity', async () => {
    const response = await POST(
      unsubscribeRequest({
        body: 'List-Unsubscribe=One-Click',
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mocks.unsubscribeNewsletterTokenFromList).toHaveBeenCalledWith(
      'token_123',
      'list_123'
    );
  });

  it('unsubscribes post requests using form identity', async () => {
    const response = await POST(
      unsubscribeRequest({
        body: 'List-Unsubscribe=One-Click&token=token_456&list=list_456',
        method: 'POST',
        url: 'https://mitsailing.test/api/newsletter/unsubscribe',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mocks.unsubscribeNewsletterTokenFromList).toHaveBeenCalledWith(
      'token_456',
      'list_456'
    );
  });

  it('rejects form posts without one-click semantics', async () => {
    const response = await POST(
      unsubscribeRequest({
        body: 'token=token_456&list=list_456',
        method: 'POST',
        url: 'https://mitsailing.test/api/newsletter/unsubscribe',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.unsubscribeNewsletterTokenFromList).not.toHaveBeenCalled();
  });

  it('rejects json post bodies', async () => {
    const response = await POST(
      new Request(
        'https://mitsailing.test/api/newsletter/unsubscribe?token=token_123&list=list_123',
        {
          body: JSON.stringify({ ListUnsubscribe: 'One-Click' }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }
      )
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.unsubscribeNewsletterTokenFromList).not.toHaveBeenCalled();
  });

  it('rejects post requests with missing identity', async () => {
    const response = await POST(
      unsubscribeRequest({
        body: 'List-Unsubscribe=One-Click',
        method: 'POST',
        url: 'https://mitsailing.test/api/newsletter/unsubscribe',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.unsubscribeNewsletterTokenFromList).not.toHaveBeenCalled();
  });

  it('returns not found for invalid tokens or lists', async () => {
    mocks.unsubscribeNewsletterTokenFromList.mockResolvedValueOnce(null);

    const response = await POST(
      unsubscribeRequest({
        body: 'List-Unsubscribe=One-Click',
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(404);
    expect(mocks.unsubscribeNewsletterTokenFromList).toHaveBeenCalledWith(
      'token_123',
      'list_123'
    );
  });

  it('rejects text posts without identity', async () => {
    const response = await POST(
      new Request('https://mitsailing.test/api/newsletter/unsubscribe', {
        body: 'List-Unsubscribe=One-Click',
        headers: { 'content-type': 'text/plain' },
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.unsubscribeNewsletterTokenFromList).not.toHaveBeenCalled();
  });

  it('accepts exact one-click text posts when identity is in the url', async () => {
    const response = await POST(
      new Request(
        'https://mitsailing.test/api/newsletter/unsubscribe?token=token_123&list=list_123',
        {
          body: 'List-Unsubscribe=One-Click',
          headers: { 'content-type': 'text/plain' },
          method: 'POST',
        }
      )
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mocks.unsubscribeNewsletterTokenFromList).toHaveBeenCalledWith(
      'token_123',
      'list_123'
    );
  });

  it('rejects one-click text posts with extra whitespace', async () => {
    const response = await POST(
      new Request(
        'https://mitsailing.test/api/newsletter/unsubscribe?token=token_123&list=list_123',
        {
          body: 'List-Unsubscribe=One-Click\n',
          headers: { 'content-type': 'text/plain' },
          method: 'POST',
        }
      )
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.unsubscribeNewsletterTokenFromList).not.toHaveBeenCalled();
  });

  it('returns internal errors for persistence failures', async () => {
    mocks.unsubscribeNewsletterTokenFromList.mockRejectedValueOnce(
      new Error('db down')
    );

    const response = await POST(
      unsubscribeRequest({
        body: 'List-Unsubscribe=One-Click',
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: 'internal',
      ok: false,
    });
    expect(response.status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to unsubscribe newsletter token: {error}',
      expect.objectContaining({
        error: expect.any(Error),
        listId: 'list_123',
      })
    );
  });
});
