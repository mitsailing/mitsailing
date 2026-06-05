import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBaseUrl: vi.fn(() => 'https://mitsailing.test/'),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/utils/Helpers', () => ({
  getBaseUrl: mocks.getBaseUrl,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBaseUrl.mockReturnValue('https://mitsailing.test/');
});

describe('newsletterUrls', () => {
  it('builds manage links with just-unsubscribed list state', async () => {
    const { newsletterManageUrl } =
      await import('@/libs/newsletter/newsletterUrls');

    expect(
      newsletterManageUrl('token_123', {
        unsubscribedListId: 'racing updates',
      })
    ).toBe(
      'https://mitsailing.test/newsletter/manage?token=token_123&unsubscribedList=racing+updates'
    );
  });

  it('builds one-click unsubscribe links with token and list', async () => {
    const { newsletterOneClickUnsubscribeUrl } =
      await import('@/libs/newsletter/newsletterUrls');

    expect(
      newsletterOneClickUnsubscribeUrl({
        listId: 'list_123',
        token: 'token_123',
      })
    ).toBe(
      'https://mitsailing.test/api/newsletter/unsubscribe?list=list_123&token=token_123'
    );
  });
});
