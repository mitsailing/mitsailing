import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  emailTemplateMetadata: vi.fn(
    (rendered: {
      emailTemplateKey: string;
      emailTemplateRevisionId: string;
    }) => ({
      emailTemplateKey: rendered.emailTemplateKey,
      emailTemplateRevisionId: rendered.emailTemplateRevisionId,
    })
  ),
  renderPublishedEmailTemplateForSend: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/libs/email-templates/emailTemplateRendering', () => ({
  emailTemplateMetadata: mocks.emailTemplateMetadata,
  renderPublishedEmailTemplateForSend:
    mocks.renderPublishedEmailTemplateForSend,
}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

const paymentEmail = {
  amount: '$45.00',
  checkoutUrl: 'https://mitsailing.test/events/frostbite/checkout',
  deadline: 'June 1, 2026, 7:00 AM ET',
  emailDedupeKey: 'payment-1:request:2026-06-01',
  eventAddress:
    'MIT Sailing Pavilion, 134 Memorial Drive, Cambridge MA 02139, US',
  eventAddressUrl:
    'https://www.google.com/maps/search/?api=1&query=MIT%20Sailing%20Pavilion',
  eventName: 'Frostbite Regatta',
  receiptUrl: 'https://pay.stripe.com/receipts/test',
  recipientEmail: 'sailor@example.com',
  recipientName: 'Ada Sailor',
  selectedFeeDescription: 'Adult entry',
};

describe('event payment email wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValue(null);
    mocks.sendTransactionalEmail.mockResolvedValue({
      providerMessageId: 'email_123',
    });
  });

  it('sends payment requests with the event payment category', async () => {
    const { sendEventPaymentRequestEmail } =
      await import('@/libs/email/event-payment-emails');

    await expect(sendEventPaymentRequestEmail(paymentEmail)).resolves.toEqual({
      providerMessageId: 'email_123',
    });

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_payment_request',
        idempotencyKey: 'event-payment-request:payment-1:request:2026-06-01',
        subject: 'Payment requested for Frostbite Regatta',
        to: 'sailor@example.com',
      })
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].text).toContain(
      'https://mitsailing.test/events/frostbite/checkout'
    );
  });

  it('sends published payment request revisions with template metadata', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValueOnce({
      bodyHtml: '<p>Custom request</p>',
      emailTemplateKey: 'event_payment_request',
      emailTemplateRevisionId: 'revision_1',
      html: '<html>custom request</html>',
      previewText: 'Custom request preview',
      subject: 'Custom payment subject',
      text: 'Custom payment text',
    });
    const { sendEventPaymentRequestEmail } =
      await import('@/libs/email/event-payment-emails');

    await sendEventPaymentRequestEmail(paymentEmail);

    expect(mocks.renderPublishedEmailTemplateForSend).toHaveBeenCalledWith({
      key: 'event_payment_request',
      values: expect.objectContaining({
        eventName: 'Frostbite Regatta',
        recipientName: 'Ada Sailor',
      }),
    });
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_payment_request',
        html: '<html>custom request</html>',
        metadata: {
          emailTemplateKey: 'event_payment_request',
          emailTemplateRevisionId: 'revision_1',
        },
        subject: 'Custom payment subject',
        text: 'Custom payment text',
        to: 'sailor@example.com',
      })
    );
  });

  it('stops payment requests when published rendering fails', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockRejectedValueOnce(
      new Error('template render failed')
    );
    const { sendEventPaymentRequestEmail } =
      await import('@/libs/email/event-payment-emails');

    await expect(sendEventPaymentRequestEmail(paymentEmail)).rejects.toThrow(
      'template render failed'
    );

    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('sends receipts with receipt links when present', async () => {
    const { sendEventPaymentReceiptEmail } =
      await import('@/libs/email/event-payment-emails');

    await sendEventPaymentReceiptEmail(paymentEmail);

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_payment_receipt',
        subject: 'Receipt for Frostbite Regatta',
        to: 'sailor@example.com',
      })
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].text).toContain(
      'https://pay.stripe.com/receipts/test'
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].text).toContain(
      'https://www.google.com/maps/search/'
    );
  });

  it('sends reminders with the payment checkout URL', async () => {
    const { sendEventPaymentReminderEmail } =
      await import('@/libs/email/event-payment-emails');

    await sendEventPaymentReminderEmail(paymentEmail);

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_payment_reminder',
        subject: 'Payment reminder for Frostbite Regatta',
        to: 'sailor@example.com',
      })
    );
  });

  it('sends one admin digest email for an event', async () => {
    const { sendEventPaymentAdminDigestEmail } =
      await import('@/libs/email/event-payment-emails');

    await sendEventPaymentAdminDigestEmail({
      adminEmail: 'admin@example.com',
      deadline: 'June 1, 2026, 7:00 AM ET',
      emailDedupeKey: 'event-1:admin_digest:2026-06-01',
      eventName: 'Frostbite Regatta',
      overduePayments: [
        {
          amount: '$45.00',
          id: 'payment-1',
          recipientEmail: 'sailor@example.com',
          recipientName: 'Ada Sailor',
          selectedFeeDescription: 'Adult entry',
        },
      ],
    });

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_payment_admin_digest',
        subject: 'Overdue payments for Frostbite Regatta',
        to: 'admin@example.com',
      })
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].text).toContain(
      'Ada Sailor'
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].html).toContain(
      'Deadline'
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].html).toContain(
      'June 1, 2026, 7:00 AM ET'
    );
  });

  it('sends published admin digests with overdue payment context', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValueOnce({
      bodyHtml: '<p>Custom digest</p>',
      emailTemplateKey: 'event_payment_admin_digest',
      emailTemplateRevisionId: 'revision_admin',
      html: '<html>custom digest</html>',
      previewText: 'Custom digest preview',
      subject: 'Custom digest subject',
      text: 'Custom digest text',
    });
    const { sendEventPaymentAdminDigestEmail } =
      await import('@/libs/email/event-payment-emails');

    await sendEventPaymentAdminDigestEmail({
      adminEmail: 'admin@example.com',
      deadline: 'June 1, 2026, 7:00 AM ET',
      emailDedupeKey: 'event-1:admin_digest:2026-06-01',
      eventName: 'Frostbite Regatta',
      overduePayments: [
        {
          amount: '$45.00',
          id: 'payment-1',
          recipientEmail: 'sailor@example.com',
          recipientName: 'Ada Sailor',
          selectedFeeDescription: 'Adult entry',
        },
      ],
    });

    expect(mocks.renderPublishedEmailTemplateForSend).toHaveBeenCalledWith({
      context: {
        eventPaymentAdminDigest: {
          overduePayments: [
            {
              amount: '$45.00',
              id: 'payment-1',
              recipientEmail: 'sailor@example.com',
              recipientName: 'Ada Sailor',
              selectedFeeDescription: 'Adult entry',
            },
          ],
        },
      },
      key: 'event_payment_admin_digest',
      values: {
        deadline: 'June 1, 2026, 7:00 AM ET',
        eventName: 'Frostbite Regatta',
      },
    });
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_payment_admin_digest',
        metadata: {
          emailTemplateKey: 'event_payment_admin_digest',
          emailTemplateRevisionId: 'revision_admin',
        },
        subject: 'Custom digest subject',
        to: 'admin@example.com',
      })
    );
  });
});
