import type { WebhookEventPayload } from 'resend';

/** Default Resend send id from official webhook examples. */
export const RESEND_TEST_EMAIL_ID = '56761188-7520-42d8-8898-ff6fc54ce618';

/** Default SMTP Message-ID from official webhook examples (RFC 5322). */
export const RESEND_TEST_SMTP_MESSAGE_ID =
  '<111-222-333@email.example.com>' as const;

/**
 * Resend's SMTP Message-ID header (RFC 5322), e.g. `<111-222-333@domain>`.
 *
 * Independent of {@link RESEND_TEST_EMAIL_ID} / `data.email_id`. Handlers key
 * the outbound ledger on `email_id`; Resend recommends Svix `id` for webhook
 * dedupe. `message_id` is for SMTP threading (inbound `email.received` replies).
 *
 * @param localPart - Local part before `@` in the Message-ID
 * @param domain - Domain after `@` in the Message-ID
 * @returns RFC 5322 Message-ID wrapped in angle brackets
 * @see https://resend.com/docs/webhooks/emails/delivered
 * @see https://resend.com/docs/webhooks/ingester
 */
export function resendTestSmtpMessageId(
  localPart = '111-222-333',
  domain = 'email.example.com'
): `<${string}>` {
  return `<${localPart}@${domain}>`;
}

type ResendEmailWebhookBase = {
  createdAt?: string;
  dataCreatedAt?: string;
  emailId?: string;
  from?: string;
  id?: string;
  messageId?: `<${string}>`;
  subject?: string;
  to?: string[];
};

function resendEmailWebhookData(params: ResendEmailWebhookBase) {
  return {
    created_at: params.dataCreatedAt ?? '2026-05-14T14:29:59.000Z',
    email_id: params.emailId ?? RESEND_TEST_EMAIL_ID,
    from: params.from ?? 'MIT Sailing <news@mitsailing.test>',
    message_id: params.messageId ?? RESEND_TEST_SMTP_MESSAGE_ID,
    subject: params.subject ?? 'Spring sailing',
    to: params.to ?? ['sailor@example.com'],
  };
}

/**
 * Builds a typed `email.delivered` webhook payload matching Resend's documented shape.
 *
 * @param params - Optional overrides for event fields
 * @returns Typed Resend `email.delivered` webhook payload
 */
export function buildResendDeliveredWebhookEvent(
  params: ResendEmailWebhookBase = {}
): Extract<WebhookEventPayload, { type: 'email.delivered' }> {
  return {
    created_at: params.createdAt ?? '2026-05-14T14:30:00.000Z',
    data: resendEmailWebhookData(params),
    ...(params.id ? { id: params.id } : {}),
    type: 'email.delivered',
  };
}

/**
 * Builds a typed `email.bounced` webhook payload matching Resend's documented shape.
 *
 * @param params - Optional overrides for event fields
 * @returns Typed Resend `email.bounced` webhook payload
 */
export function buildResendBouncedWebhookEvent(
  params: ResendEmailWebhookBase = {}
): Extract<WebhookEventPayload, { type: 'email.bounced' }> {
  return {
    created_at: params.createdAt ?? '2026-05-14T14:30:00.000Z',
    data: {
      bounce: {
        message: 'Mailbox unavailable',
        subType: 'General',
        type: 'Permanent',
      },
      ...resendEmailWebhookData({
        ...params,
        from: params.from ?? 'MIT Sailing <accounts@mitsailing.test>',
        subject: params.subject ?? 'Account notice',
        to: params.to ?? ['Sailor@Example.com'],
      }),
    },
    type: 'email.bounced',
  };
}

/**
 * Builds a typed `email.complained` webhook payload matching Resend's documented shape.
 *
 * @param params - Optional overrides for event fields
 * @returns Typed Resend `email.complained` webhook payload
 */
export function buildResendComplainedWebhookEvent(
  params: ResendEmailWebhookBase = {}
): Extract<WebhookEventPayload, { type: 'email.complained' }> {
  return {
    created_at: params.createdAt ?? '2026-05-14T14:30:00.000Z',
    data: resendEmailWebhookData({
      ...params,
      from: params.from ?? 'MIT Sailing <accounts@mitsailing.test>',
      subject: params.subject ?? 'Account notice',
      to: params.to ?? ['Sailor@Example.com'],
    }),
    type: 'email.complained',
  };
}

/**
 * Untyped builder for tests that need `as WebhookEventPayload` widening (e.g. invalid timestamps).
 *
 * @param params - Optional overrides for event fields
 * @returns Resend webhook payload widened to the union type
 */
export function buildResendDeliveredWebhookPayload(
  params: ResendEmailWebhookBase = {}
): WebhookEventPayload {
  return buildResendDeliveredWebhookEvent(params) as WebhookEventPayload;
}
