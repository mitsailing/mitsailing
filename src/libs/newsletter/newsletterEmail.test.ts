import { beforeEach, describe, expect, it, vi } from 'vitest';

type SendPayload = {
  category?: string;
  headers?: Record<string, string>;
  html: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  newsletterBroadcastId?: string | null;
  newsletterDeliveryId?: string | null;
  newsletterSubscriberId?: string | null;
  subject: string;
  tags?: { name: string; value: string }[];
  text?: string;
  to: string;
  topicId?: string | null;
};

type SendEmailMock = (
  params: SendPayload
) => Promise<{ providerMessageId: string | null }>;

const mocks = vi.hoisted(() => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret',
  },
  getBaseUrl: vi.fn(() => 'https://mitsailing.test'),
  getTranslations: vi.fn(() =>
    vi.fn((key: string) =>
      key === 'postal_address'
        ? 'MIT Sailing Pavilion, 134 Memorial Drive, Cambridge, MA 02139'
        : key
    )
  ),
  sendTransactionalEmail: vi.fn<SendEmailMock>(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
}));

vi.mock('@/utils/Helpers', () => ({
  getBaseUrl: mocks.getBaseUrl,
}));

function sentPayload(): SendPayload {
  const call = mocks.sendTransactionalEmail.mock.calls.at(-1);
  if (!call) {
    throw new Error('Expected an email to be sent.');
  }
  const [payload] = call;
  return payload;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBaseUrl.mockReturnValue('https://mitsailing.test');
  mocks.sendTransactionalEmail.mockResolvedValue({ providerMessageId: null });
});

describe('newsletter email', () => {
  it('renders broadcast preview html and plaintext links', async () => {
    const { renderNewsletterBroadcastEmail } =
      await import('@/libs/newsletter/newsletterEmail');

    const rendered = await renderNewsletterBroadcastEmail({
      body: 'The pavilion is open.\n\nRacing starts Friday.',
      listName: 'General',
      managePreferencesLabel: 'Manage all newsletter preferences',
      manageUrl: 'https://example.test/manage',
      postalAddress: 'MIT Sailing Pavilion, Cambridge, MA',
      previewText: 'News from the pavilion',
      subject: 'Spring sailing',
      unsubscribeUrl: 'https://example.test/unsubscribe',
    });

    expect(rendered.html).toContain('Spring sailing');
    expect(rendered.html).toContain('Racing starts Friday.');
    expect(rendered.text).toContain(
      'Unsubscribe from General: https://example.test/unsubscribe'
    );
    expect(rendered.text).toContain(
      'Manage all newsletter preferences: https://example.test/manage'
    );
  });

  it('renders editor html body safely', async () => {
    const { renderNewsletterBroadcastEmail } =
      await import('@/libs/newsletter/newsletterEmail');

    const rendered = await renderNewsletterBroadcastEmail({
      body: '<p>Hello sailors</p><script>alert("bad")</script>',
      listName: 'General',
      managePreferencesLabel: 'Manage all newsletter preferences',
      manageUrl: 'https://example.test/manage',
      postalAddress: 'MIT Sailing Pavilion, Cambridge, MA',
      previewText: 'News from the pavilion',
      subject: 'Spring sailing',
      unsubscribeUrl: 'https://example.test/unsubscribe',
    });

    expect(rendered.html).toContain('Hello sailors');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.text).toContain('Hello sailors');
    expect(rendered.text).not.toContain('<p>');
  });

  it('sends test copies without delivery tracking headers', async () => {
    const { sendNewsletterBroadcastTestEmail } =
      await import('@/libs/newsletter/newsletterEmail');

    await sendNewsletterBroadcastTestEmail({
      body: 'The pavilion is open.',
      email: 'admin@example.com',
      listName: 'General',
      previewText: 'News from the pavilion',
      subject: 'Spring sailing',
    });

    const payload = sentPayload();
    expect(payload).toMatchObject({
      subject: '[TEST] Spring sailing',
      to: 'admin@example.com',
    });
    expect(payload.headers).toBeUndefined();
    expect(payload.tags).toBeUndefined();
    expect(payload.html).toContain('https://mitsailing.test/newsletter');
    expect(payload.text).toContain('134 Memorial Drive');
  });

  it('sends live deliveries with one-click unsubscribe metadata', async () => {
    const { sendNewsletterBroadcastEmail } =
      await import('@/libs/newsletter/newsletterEmail');

    await sendNewsletterBroadcastEmail({
      body: 'The pavilion is open.',
      broadcastId: 'broadcast_123',
      deliveryId: 'delivery_123',
      email: 'sailor@example.com',
      listId: 'list_123',
      listName: 'General',
      manageTokenHash: 'stored-token-hash',
      previewText: 'News from the pavilion',
      subject: 'Spring sailing',
      subscriberId: 'subscriber_123',
      topicId: 'topic_123',
    });

    const payload = sentPayload();
    expect(payload.headers).toEqual(
      expect.objectContaining({
        'List-ID': '<list-123.newsletter.mitsailing.test>',
        'List-Unsubscribe': expect.stringContaining(
          '/api/newsletter/unsubscribe?'
        ),
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      })
    );
    const unsubscribeHeader = payload.headers?.['List-Unsubscribe'] ?? '';
    const unsubscribeUrl = new URL(unsubscribeHeader.slice(1, -1));
    expect(unsubscribeUrl.searchParams.get('list')).toBe('list_123');
    expect(unsubscribeUrl.searchParams.get('token')).toContain(
      'subscriber_123'
    );
    expect(payload.tags).toEqual([
      { name: 'newsletter_delivery_id', value: 'delivery_123' },
      { name: 'newsletter_subscriber_id', value: 'subscriber_123' },
    ]);
    expect(payload.newsletterBroadcastId).toBe('broadcast_123');
    expect(payload.newsletterDeliveryId).toBe('delivery_123');
    expect(payload.newsletterSubscriberId).toBe('subscriber_123');
    expect(payload.idempotencyKey).toBe('newsletter-delivery/delivery_123');
    expect(payload.topicId).toBe('topic_123');
    expect(payload.text).toContain('134 Memorial Drive');
  });

  it('uses a safe List-ID fallback for invalid list ids', async () => {
    const { sendNewsletterBroadcastEmail } =
      await import('@/libs/newsletter/newsletterEmail');

    await sendNewsletterBroadcastEmail({
      body: 'The pavilion is open.',
      broadcastId: 'broadcast_123',
      deliveryId: 'delivery_123',
      email: 'sailor@example.com',
      listId: '!!!',
      listName: 'General',
      manageTokenHash: 'stored-token-hash',
      previewText: 'News from the pavilion',
      subject: 'Spring sailing',
      subscriberId: 'subscriber_123',
      topicId: null,
    });

    expect(sentPayload().headers).toEqual(
      expect.objectContaining({
        'List-ID': '<newsletter.newsletter.mitsailing.test>',
      })
    );
  });
});
