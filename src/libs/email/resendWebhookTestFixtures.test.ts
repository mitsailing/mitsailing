import { describe, expect, it } from 'vitest';
import {
  RESEND_TEST_EMAIL_ID,
  RESEND_TEST_SMTP_MESSAGE_ID,
  buildResendBouncedWebhookEvent,
  buildResendComplainedWebhookEvent,
  buildResendDeliveredWebhookEvent,
  resendTestSmtpMessageId,
} from '@/libs/email/resendWebhookTestFixtures';

/**
 * Values mirrored from Resend webhook docs (Context7 / resend.com/docs/webhooks/emails/*).
 */
const RESEND_DOC_EXAMPLE = {
  emailId: '56761188-7520-42d8-8898-ff6fc54ce618',
  messageId: '<111-222-333@email.example.com>',
} as const;

describe('resendWebhookTestFixtures', () => {
  it('uses Resend documented email_id and message_id defaults', () => {
    expect(RESEND_TEST_EMAIL_ID).toBe(RESEND_DOC_EXAMPLE.emailId);
    expect(RESEND_TEST_SMTP_MESSAGE_ID).toBe(RESEND_DOC_EXAMPLE.messageId);
    expect(RESEND_TEST_EMAIL_ID).not.toBe(RESEND_TEST_SMTP_MESSAGE_ID);
  });

  it('builds email.delivered payloads with documented core fields', () => {
    const event = buildResendDeliveredWebhookEvent();

    expect(event.type).toBe('email.delivered');
    expect(event.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.data.email_id).toBe(RESEND_DOC_EXAMPLE.emailId);
    expect(event.data.message_id).toBe(RESEND_DOC_EXAMPLE.messageId);
    expect(event.data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.data.from).toContain('<');
    expect(event.data.to.length).toBeGreaterThan(0);
    expect(event.data.subject.length).toBeGreaterThan(0);
  });

  it('builds email.bounced payloads with nested bounce object', () => {
    const event = buildResendBouncedWebhookEvent();

    expect(event.type).toBe('email.bounced');
    expect(event.data.bounce).toEqual({
      message: 'Mailbox unavailable',
      subType: 'General',
      type: 'Permanent',
    });
  });

  it('builds email.complained payloads without bounce details', () => {
    const event = buildResendComplainedWebhookEvent();

    expect(event.type).toBe('email.complained');
    expect('bounce' in event.data).toBe(false);
  });

  it('keeps message_id independent when email_id is overridden', () => {
    const event = buildResendDeliveredWebhookEvent({ emailId: 'message_1' });

    expect(event.data.email_id).toBe('message_1');
    expect(event.data.message_id).toBe(RESEND_DOC_EXAMPLE.messageId);
  });

  it('formats custom smtp message ids in angle brackets', () => {
    expect(resendTestSmtpMessageId()).toBe(RESEND_DOC_EXAMPLE.messageId);
    expect(resendTestSmtpMessageId('abc', 'mitsailing.test')).toBe(
      '<abc@mitsailing.test>'
    );
  });
});
