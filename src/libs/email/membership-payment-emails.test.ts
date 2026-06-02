import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  renderPublishedEmailTemplateForSend: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/libs/email-templates/emailTemplateRendering', () => ({
  renderPublishedEmailTemplateForSend:
    mocks.renderPublishedEmailTemplateForSend,
}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

const reminderEmail = {
  amount: '$175.00',
  cardType: 'racing' as const,
  cardYear: 2026,
  emailDedupeKey: 'payment_1:2026-06-01',
  onboardingUrl: 'https://mitsailing.test/onboarding',
  paymentId: 'payment_1',
  recipientEmail: 'sailor@example.com',
  userId: 'user_1',
};

describe('membership payment email wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValue(null);
    mocks.sendTransactionalEmail.mockResolvedValue({
      providerMessageId: 'email_123',
    });
  });

  it('sends reminders with payment metadata in the code-owned fallback', async () => {
    const { sendMembershipPaymentReminderEmail } =
      await import('@/libs/email/membership-payment-emails');

    await expect(
      sendMembershipPaymentReminderEmail(reminderEmail)
    ).resolves.toEqual({
      providerMessageId: 'email_123',
    });

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'membership_payment_reminder',
        idempotencyKey: 'membership-payment-reminder:payment_1:2026-06-01',
        metadata: {
          cardType: 'racing',
          cardYear: 2026,
          paymentId: 'payment_1',
        },
        subject: 'Finish your MIT Sailing onboarding',
        to: 'sailor@example.com',
        userId: 'user_1',
      })
    );
  });

  it('sends published reminders with payment and template metadata', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValueOnce({
      bodyHtml: '<p>Custom reminder</p>',
      emailTemplateKey: 'membership_payment_reminder',
      emailTemplateRevisionId: 'revision_membership',
      html: '<html>custom reminder</html>',
      previewText: 'Custom reminder preview',
      subject: 'Custom reminder subject',
      text: 'Custom reminder text',
    });
    const { sendMembershipPaymentReminderEmail } =
      await import('@/libs/email/membership-payment-emails');

    await sendMembershipPaymentReminderEmail(reminderEmail);

    expect(mocks.renderPublishedEmailTemplateForSend).toHaveBeenCalledWith({
      key: 'membership_payment_reminder',
      values: {
        amount: '$175.00',
        cardType: 'Pavilion racing',
        cardYear: '2026',
        onboardingUrl: 'https://mitsailing.test/onboarding',
      },
    });
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'membership_payment_reminder',
        html: '<html>custom reminder</html>',
        metadata: {
          cardType: 'racing',
          cardYear: 2026,
          emailTemplateKey: 'membership_payment_reminder',
          emailTemplateRevisionId: 'revision_membership',
          paymentId: 'payment_1',
        },
        subject: 'Custom reminder subject',
        text: 'Custom reminder text',
      })
    );
  });

  it('stops reminders when published rendering fails', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockRejectedValueOnce(
      new Error('template render failed')
    );
    const { sendMembershipPaymentReminderEmail } =
      await import('@/libs/email/membership-payment-emails');

    await expect(
      sendMembershipPaymentReminderEmail(reminderEmail)
    ).rejects.toThrow('template render failed');

    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
