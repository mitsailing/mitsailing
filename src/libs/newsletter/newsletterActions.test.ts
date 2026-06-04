import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSubscriberPreferenceStateByToken: vi.fn(),
  loggerError: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  unsubscribeNewsletterTokenFromList: vi.fn(),
  updateNewsletterPreferences: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => {
    await Promise.resolve();
    return new Headers();
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock('@/libs/newsletter/newsletterSubscriptions', () => ({
  getSubscriberPreferenceStateByToken:
    mocks.getSubscriberPreferenceStateByToken,
  unsubscribeNewsletterTokenFromList: mocks.unsubscribeNewsletterTokenFromList,
  updateNewsletterPreferences: mocks.updateNewsletterPreferences,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSubscriberPreferenceStateByToken.mockResolvedValue({
    id: 'subscriber_123',
    subscriptions: [
      { listId: 'general_id', status: 'unsubscribed' },
      { listId: 'racing_id', status: 'subscribed' },
    ],
  });
  mocks.unsubscribeNewsletterTokenFromList.mockResolvedValue({
    id: 'subscriber_123',
  });
  mocks.updateNewsletterPreferences.mockImplementation(async () => {
    await Promise.resolve();
  });
});

describe('newsletterActions unsubscribe links', () => {
  it('unsubscribes a tokenized list and redirects to confirmation', async () => {
    const { unsubscribeTokenNewsletterListAction } =
      await import('@/libs/newsletter/newsletterActions');

    await expect(
      unsubscribeTokenNewsletterListAction(
        'token_123',
        'en',
        'general_id',
        new FormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/newsletter/manage?token=token_123&unsubscribed=1&list=general_id'
    );

    expect(mocks.unsubscribeNewsletterTokenFromList).toHaveBeenCalledWith(
      'token_123',
      'general_id'
    );
  });

  it('resubscribes one list without removing other active preferences', async () => {
    const { resubscribeTokenNewsletterListAction } =
      await import('@/libs/newsletter/newsletterActions');

    await expect(
      resubscribeTokenNewsletterListAction(
        'token_123',
        'en',
        'general_id',
        new FormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/newsletter/manage?token=token_123&resubscribed=1&list=general_id'
    );

    expect(mocks.updateNewsletterPreferences).toHaveBeenCalledWith({
      listIds: ['racing_id', 'general_id'],
      source: 'token_manage',
      subscriberId: 'subscriber_123',
    });
  });
});
