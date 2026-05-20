import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
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
});
