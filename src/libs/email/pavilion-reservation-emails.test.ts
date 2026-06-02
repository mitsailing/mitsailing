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

const reservationEmail = {
  eventName: 'Frostbite Banquet',
  referenceCode: 'PAV-2026-0042',
  requesterEmail: 'host@example.com',
  scheduleLines: ['June 8, 2026, 6:00 PM-9:00 PM'],
};

describe('pavilion reservation email wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValue(null);
    mocks.sendTransactionalEmail.mockResolvedValue({
      providerMessageId: 'email_123',
    });
  });

  it('sends submitted emails with the code-owned fallback', async () => {
    const { sendPavilionReservationSubmittedEmail } =
      await import('@/libs/email/pavilion-reservation-emails');

    await sendPavilionReservationSubmittedEmail(reservationEmail);

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Pavilion reservation request PAV-2026-0042',
        to: 'host@example.com',
      })
    );
    expect(mocks.sendTransactionalEmail.mock.calls[0]?.[0].text).toContain(
      'June 8, 2026, 6:00 PM-9:00 PM'
    );
  });

  it('sends published submitted revisions with template metadata', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValueOnce({
      bodyHtml: '<p>Custom submitted</p>',
      emailTemplateKey: 'pavilion_reservation_submitted',
      emailTemplateRevisionId: 'revision_pavilion_submitted',
      html: '<html>custom submitted</html>',
      previewText: 'Custom submitted preview',
      subject: 'Custom submitted subject',
      text: 'Custom submitted text',
    });
    const { sendPavilionReservationSubmittedEmail } =
      await import('@/libs/email/pavilion-reservation-emails');

    await sendPavilionReservationSubmittedEmail(reservationEmail);

    expect(mocks.renderPublishedEmailTemplateForSend).toHaveBeenCalledWith({
      context: {
        pavilionReservation: {
          scheduleLines: ['June 8, 2026, 6:00 PM-9:00 PM'],
        },
      },
      key: 'pavilion_reservation_submitted',
      values: {
        eventName: 'Frostbite Banquet',
        referenceCode: 'PAV-2026-0042',
      },
    });
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<html>custom submitted</html>',
        metadata: {
          emailTemplateKey: 'pavilion_reservation_submitted',
          emailTemplateRevisionId: 'revision_pavilion_submitted',
        },
        subject: 'Custom submitted subject',
        text: 'Custom submitted text',
        to: 'host@example.com',
      })
    );
  });

  it('sends published status revisions with the status token', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockResolvedValueOnce({
      bodyHtml: '<p>Custom status</p>',
      emailTemplateKey: 'pavilion_reservation_status',
      emailTemplateRevisionId: 'revision_pavilion_status',
      html: '<html>custom status</html>',
      previewText: 'Custom status preview',
      subject: 'Custom status subject',
      text: 'Custom status text',
    });
    const { sendPavilionReservationStatusEmail } =
      await import('@/libs/email/pavilion-reservation-emails');

    await sendPavilionReservationStatusEmail({
      ...reservationEmail,
      status: 'approved',
      statusLabel: 'Approved',
    });

    expect(mocks.renderPublishedEmailTemplateForSend).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'pavilion_reservation_status',
        values: {
          eventName: 'Frostbite Banquet',
          referenceCode: 'PAV-2026-0042',
          status: 'Approved',
        },
      })
    );
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          emailTemplateKey: 'pavilion_reservation_status',
          emailTemplateRevisionId: 'revision_pavilion_status',
        },
        subject: 'Custom status subject',
        to: 'host@example.com',
      })
    );
  });

  it('stops submitted emails when published rendering fails', async () => {
    mocks.renderPublishedEmailTemplateForSend.mockRejectedValueOnce(
      new Error('template render failed')
    );
    const { sendPavilionReservationSubmittedEmail } =
      await import('@/libs/email/pavilion-reservation-emails');

    await expect(
      sendPavilionReservationSubmittedEmail(reservationEmail)
    ).rejects.toThrow('template render failed');

    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
